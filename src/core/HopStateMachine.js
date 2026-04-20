import { EventEmitter } from 'events';
import logger from '../utils/logger.js';
import { TimeoutError, HopCommandError } from '../utils/errors.js';
import { DEFAULTS, PROMPT_PATTERNS } from '../config/defaults.js';

/**
 * States for each hop in the multi-hop chain
 */
export const HopState = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  AUTHENTICATING: 'AUTHENTICATING',
  AUTHENTICATED: 'AUTHENTICATED',
  EXECUTING_COMMANDS: 'EXECUTING_COMMANDS',
  WAITING_PROMPT: 'WAITING_PROMPT',
  HOP_READY: 'HOP_READY',
  FORWARDING: 'FORWARDING',
  CONNECTED: 'CONNECTED',
  RETRY: 'RETRY',
  FAILED: 'FAILED',
  DISCONNECTED: 'DISCONNECTED',
};

/**
 * HopStateMachine manages the state of a single hop in the chain.
 * Handles expect-like command execution (su -, password entry, vrctl, etc.)
 */
export class HopStateMachine extends EventEmitter {
  constructor(hopConfig, hopIndex, options = {}) {
    super();
    this.hopConfig = hopConfig;
    this.hopIndex = hopIndex;
    this.state = HopState.IDLE;
    this.retryCount = 0;
    this.maxRetries = options.maxRetries ?? DEFAULTS.hop.retryAttempts;
    this.commandTimeout = options.commandTimeout ?? DEFAULTS.hop.commandTimeout;
    this.promptTimeout = options.promptTimeout ?? DEFAULTS.hop.promptTimeout;
    this.outputBuffer = '';
    this.currentCommandIndex = 0;
    this._timeoutHandle = null;
    this._stream = null;
    this._onStdoutData = null;
    this._onStderrData = null;
  }

  /**
   * Transition to a new state
   */
  _transition(newState, data = {}) {
    const oldState = this.state;
    this.state = newState;
    logger.debug(`Hop ${this.hopIndex} [${this.hopConfig.host}]: ${oldState} → ${newState}`, data);
    this.emit('stateChange', {
      hopIndex: this.hopIndex,
      host: this.hopConfig.host,
      oldState,
      newState,
      ...data,
    });
  }

  /**
   * Set a timeout that will trigger failure
   */
  _setTimeout(ms, reason) {
    this._clearTimeout();
    this._timeoutHandle = setTimeout(() => {
      this._transition(HopState.FAILED, {
        error: new TimeoutError(`Timeout: ${reason}`, ms),
      });
      this.emit('error', new TimeoutError(`Hop ${this.hopIndex} timeout: ${reason}`, ms));
    }, ms);
  }

  _clearTimeout() {
    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
      this._timeoutHandle = null;
    }
  }

  /**
   * Start connection process
   */
  startConnecting() {
    this._transition(HopState.CONNECTING);
    this._setTimeout(DEFAULTS.ssh.readyTimeout, 'connection timeout');
  }

  /**
   * Handle successful authentication
   */
  onAuthenticated() {
    this._clearTimeout();
    this._transition(HopState.AUTHENTICATED);

    if (this.hopConfig.commands && this.hopConfig.commands.length > 0) {
      this.currentCommandIndex = 0;
      this._transition(HopState.EXECUTING_COMMANDS);
    } else {
      this._transition(HopState.HOP_READY);
      this.emit('ready');
    }
  }

  /**
   * Bind a shell stream for command execution
   * @param {Stream} stream - SSH shell stream
   */
  bindStream(stream) {
    this.unbindStream();
    this._stream = stream;
    this.outputBuffer = '';

    this._onStdoutData = (data) => {
      const text = data.toString('utf8');
      this.outputBuffer += text;
      this.emit('data', text);
      this._processOutput();
    };

    this._onStderrData = (data) => {
      logger.warn(`Hop ${this.hopIndex} stderr: ${data.toString('utf8')}`);
    };

    stream.on('data', this._onStdoutData);
    stream.stderr?.on('data', this._onStderrData);
  }

  /**
   * Detach stream listeners once command execution is complete.
   * This lets the same shell stream be reused as a raw transport.
   */
  unbindStream() {
    if (this._stream && this._onStdoutData) {
      this._stream.removeListener('data', this._onStdoutData);
    }
    if (this._stream?.stderr && this._onStderrData) {
      this._stream.stderr.removeListener('data', this._onStderrData);
    }

    this._stream = null;
    this._onStdoutData = null;
    this._onStderrData = null;
  }

  /**
   * Process accumulated output, looking for expected prompts
   */
  _processOutput() {
    if (this.state !== HopState.EXECUTING_COMMANDS && this.state !== HopState.WAITING_PROMPT) {
      return;
    }

    const commands = this.hopConfig.commands;
    if (this.currentCommandIndex >= commands.length) {
      // All commands done
      this._clearTimeout();
      this._transition(HopState.HOP_READY);
      this.emit('ready');
      return;
    }

    const cmd = commands[this.currentCommandIndex];

    if (cmd.expect) {
      // Waiting for a specific pattern
      const pattern = cmd.expect instanceof RegExp ? cmd.expect : new RegExp(cmd.expect);
      if (pattern.test(this.outputBuffer)) {
        this._clearTimeout();
        // Send the input
        if (cmd.input) {
          this._sendInput(cmd.input);
        }
        this.outputBuffer = '';
        this.currentCommandIndex++;
        this._transition(HopState.EXECUTING_COMMANDS);
        this._processNextCommand();
        return;
      }
    } else if (cmd.command) {
      // Check if we see a shell prompt indicating readiness
      const isPromptReady = PROMPT_PATTERNS.some(p => p.test(this.outputBuffer));
      if (isPromptReady || this.state === HopState.EXECUTING_COMMANDS) {
        this._clearTimeout();
        this._sendCommand(cmd.command);
        this.outputBuffer = '';
        this.currentCommandIndex++;

        // Wait for next prompt or command
        this._setTimeout(this.commandTimeout, `command "${cmd.command}" timeout`);
        this._transition(HopState.WAITING_PROMPT);
        return;
      }
    }
  }

  /**
   * Execute the next command in queue
   */
  _processNextCommand() {
    if (this.currentCommandIndex >= this.hopConfig.commands.length) {
      this._clearTimeout();
      // Wait a bit for prompt to settle
      setTimeout(() => {
        this._transition(HopState.HOP_READY);
        this.emit('ready');
      }, 500);
      return;
    }

    const cmd = this.hopConfig.commands[this.currentCommandIndex];

    if (cmd.expect) {
      // Wait for pattern
      this._setTimeout(cmd.timeout || this.promptTimeout, `expecting "${cmd.expect}"`);
      this._transition(HopState.WAITING_PROMPT);
    } else if (cmd.command) {
      // Wait for shell prompt before sending
      this._setTimeout(this.commandTimeout, `waiting for prompt before "${cmd.command}"`);
    }
  }

  /**
   * Start executing commands after shell is ready
   */
  startCommandExecution() {
    if (!this.hopConfig.commands || this.hopConfig.commands.length === 0) {
      this._transition(HopState.HOP_READY);
      this.emit('ready');
      return;
    }

    this.currentCommandIndex = 0;
    this._transition(HopState.EXECUTING_COMMANDS);

    // Wait for initial prompt
    this._setTimeout(this.promptTimeout, 'initial shell prompt');
  }

  /**
   * Send a command through the stream
   */
  _sendCommand(command) {
    if (this._stream && this._stream.writable) {
      logger.debug(`Hop ${this.hopIndex}: sending command: ${command}`);
      this._stream.write(command + '\n');
    } else {
      this.emit('error', new HopCommandError(
        `Stream not writable for command: ${command}`,
        command,
        this.hopIndex
      ));
    }
  }

  /**
   * Send input (e.g., password) through the stream
   */
  _sendInput(input) {
    if (this._stream && this._stream.writable) {
      logger.debug(`Hop ${this.hopIndex}: sending input (hidden)`);
      this._stream.write(input + '\n');
    }
  }

  /**
   * Handle connection failure, potentially retry
   */
  onConnectionFailed(error) {
    this._clearTimeout();

    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this._transition(HopState.RETRY, {
        attempt: this.retryCount,
        maxRetries: this.maxRetries,
        error: error.message,
      });
      this.emit('retry', { attempt: this.retryCount, error });
    } else {
      this._transition(HopState.FAILED, { error: error.message });
      this.emit('failed', error);
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this._clearTimeout();
    this.unbindStream();
    this.outputBuffer = '';
    this._transition(HopState.DISCONNECTED);
    this.removeAllListeners();
  }
}
