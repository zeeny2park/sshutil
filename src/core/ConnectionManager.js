import { Client } from 'ssh2';
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import logger from '../utils/logger.js';
import { SSHConnectionError, AuthenticationError } from '../utils/errors.js';
import { HopStateMachine } from './HopStateMachine.js';
import { DEFAULTS } from '../config/defaults.js';

const RAW_SHELL_MODES = Object.freeze({
  ECHO: 0,
  ECHOE: 0,
  ECHOK: 0,
  ECHOKE: 0,
  ECHONL: 0,
  ICANON: 0,
  ICRNL: 0,
  INLCR: 0,
  IGNCR: 0,
  OPOST: 0,
  ONLCR: 0,
  OCRNL: 0,
});

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * ConnectionManager orchestrates multi-hop SSH connections.
 *
 * Supports two modes:
 * 1. Standard SSH hop: Uses ssh2 forwardOut() for TCP tunneling
 * 2. Command-shell hop: Executes expect-like commands on a hop and, when needed,
 *    routes the next hop's SSH transport through that shell context.
 */
export class ConnectionManager extends EventEmitter {
  constructor() {
    super();
    this.connections = [];       // Array of ssh2.Client instances
    this.stateMachines = [];     // Array of HopStateMachine instances
    this.shellStreams = [];      // Shell streams opened for command execution
    this.commandShells = [];     // Per-hop command shell contexts for downstream proxying
    this.finalClient = null;     // The last ssh2.Client (for exec/sftp)
    this.finalShell = null;      // Shell stream if final hop uses shell mode
    this.isConnected = false;
    this._targetConfig = null;
  }

  /**
   * Connect through a multi-hop chain
   * @param {object} targetConfig - Normalized target configuration
   * @returns {Promise<Client>} The final SSH client
   */
  async connect(targetConfig) {
    this._targetConfig = targetConfig;
    const hops = targetConfig.hops;

    this.emit('progress', { message: `Connecting through ${hops.length} hop(s)...`, total: hops.length });

    try {
      for (let i = 0; i < hops.length; i++) {
        const hop = hops[i];

        this.emit('progress', {
          message: `Hop ${i + 1}/${hops.length}: ${hop.user}@${hop.host}`,
          current: i + 1,
          total: hops.length,
        });

        // Create state machine for this hop
        const sm = new HopStateMachine(hop, i);
        this.stateMachines.push(sm);

        // Forward state change events
        sm.on('stateChange', (event) => this.emit('hopStateChange', event));
        sm.on('retry', (event) => this.emit('hopRetry', { ...event, hopIndex: i }));
        sm.on('error', (error) => this.emit('hopError', { hopIndex: i, host: hop.host, error }));

        // Each hop decides its own transport:
        // - direct socket for the first hop
        // - forwardOut for normal downstream hops
        // - command-shell proxy when the previous hop changed context via commands
        await this._connectSSHHop(hop, i, sm);
      }

      this.finalClient = this.connections[this.connections.length - 1];
      this.isConnected = true;

      this.emit('connected', {
        message: 'All hops connected successfully',
        hops: hops.length,
        target: hops[hops.length - 1].host,
      });

      return this.finalClient;
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  /**
   * SSH hop using direct, forwardOut, or command-shell transport.
   */
  async _connectSSHHop(hop, hopIndex, stateMachine) {
    return new Promise((resolve, reject) => {
      const client = new Client();
      this.connections.push(client);

      const attemptConnect = (retryCount = 0) => {
        stateMachine.startConnecting();

        const connectConfig = {
          host: hop.host,
          port: hop.port,
          username: hop.user,
          readyTimeout: DEFAULTS.ssh.readyTimeout,
          keepaliveInterval: DEFAULTS.ssh.keepaliveInterval,
          keepaliveCountMax: DEFAULTS.ssh.keepaliveCountMax,
        };

        // Auth configuration
        if (hop.auth) {
          if (hop.auth.type === 'password') {
            connectConfig.password = hop.auth.value;
          } else if (hop.auth.type === 'privateKey') {
            const keyPath = hop.auth.value.replace('~', os.homedir());
            try {
              connectConfig.privateKey = fs.readFileSync(keyPath);
            } catch (err) {
              reject(new AuthenticationError(`Cannot read private key: ${keyPath}`, hop));
              return;
            }
          } else if (hop.auth.type === 'agent') {
            // Use SSH Agent (SSH_AUTH_SOCK)
            connectConfig.agent = process.env.SSH_AUTH_SOCK;
            connectConfig.agentForward = true;
          }
        } else {
          // No auth specified — try SSH Agent by default if available
          if (process.env.SSH_AUTH_SOCK) {
            connectConfig.agent = process.env.SSH_AUTH_SOCK;
            connectConfig.agentForward = true;
          }
        }

        const prevHop = hopIndex > 0 ? this._targetConfig?.hops?.[hopIndex - 1] : null;
        const prevHopUsesCommandShell = Boolean(prevHop?.commands?.length);

        // If not the first hop, tunnel through the previous hop.
        if (hopIndex > 0) {
          if (prevHopUsesCommandShell) {
            try {
              connectConfig.sock = this._createShellProxyStream(hopIndex - 1, hop);
              delete connectConfig.host;
              delete connectConfig.port;
              client.connect(connectConfig);
            } catch (err) {
              stateMachine.onConnectionFailed(err);
              reject(err);
            }
          } else {
            const prevClient = this.connections[hopIndex - 1];
            prevClient.forwardOut('127.0.0.1', 0, hop.host, hop.port, (err, stream) => {
              if (err) {
                if (retryCount < DEFAULTS.hop.retryAttempts) {
                  stateMachine.onConnectionFailed(err);
                  setTimeout(() => attemptConnect(retryCount + 1), DEFAULTS.hop.retryDelay);
                  return;
                }
                reject(new SSHConnectionError(
                  `forwardOut failed for hop ${hopIndex}: ${err.message}`, hop
                ));
                return;
              }
              connectConfig.sock = stream;
              delete connectConfig.host;
              delete connectConfig.port;
              client.connect(connectConfig);
            });
          }
        } else {
          client.connect(connectConfig);
        }

        client.on('ready', () => {
          stateMachine.onAuthenticated();
          logger.info(`Hop ${hopIndex}: connected to ${hop.user}@${hop.host}`);

          // If hop has commands, execute them via shell
          if (hop.commands && hop.commands.length > 0) {
            this._executeHopCommands(client, hop, hopIndex, stateMachine)
              .then(() => resolve(client))
              .catch(reject);
          } else {
            resolve(client);
          }
        });

        client.on('error', (err) => {
          logger.error(`Hop ${hopIndex} error: ${err.message}`);
          if (retryCount < DEFAULTS.hop.retryAttempts && !(prevHop?.commands?.length)) {
            stateMachine.onConnectionFailed(err);
            setTimeout(() => attemptConnect(retryCount + 1), DEFAULTS.hop.retryDelay);
          } else {
            stateMachine.onConnectionFailed(err);
            reject(new SSHConnectionError(
              `Hop ${hopIndex} (${hop.host}) failed: ${err.message}`, hop
            ));
          }
        });

        client.on('end', () => {
          logger.debug(`Hop ${hopIndex}: connection ended`);
        });

        client.on('close', () => {
          logger.debug(`Hop ${hopIndex}: connection closed`);
        });
      };

      attemptConnect();
    });
  }

  /**
   * Build a shell proxy stream from a previously prepared command shell.
   */
  _createShellProxyStream(prevHopIndex, nextHop) {
    const shellContext = this.commandShells[prevHopIndex];
    const prevHop = this._targetConfig?.hops?.[prevHopIndex];

    if (!shellContext?.stream) {
      throw new SSHConnectionError(
        `Hop ${prevHopIndex} has commands but no reusable shell context for ${nextHop.host}`,
        prevHop
      );
    }

    if (shellContext.consumedAsTransport) {
      throw new SSHConnectionError(
        `Hop ${prevHopIndex} command shell is already in use for downstream transport`,
        prevHop
      );
    }

    const stream = shellContext.stream;
    if (stream.destroyed || !stream.writable) {
      throw new SSHConnectionError(
        `Hop ${prevHopIndex} command shell is not writable for downstream transport`,
        prevHop
      );
    }

    const proxyCommand = this._buildShellProxyCommand(nextHop.host, nextHop.port);
    shellContext.consumedAsTransport = true;
    shellContext.proxyTarget = `${nextHop.user}@${nextHop.host}:${nextHop.port}`;

    logger.info(
      `Hop ${prevHopIndex}: routing next hop through command shell (${shellContext.proxyTarget})`
    );
    stream.write(proxyCommand + '\n');

    return stream;
  }

  /**
   * Build a shell command that turns the current shell into a TCP proxy.
   */
  _buildShellProxyCommand(host, port) {
    const hostArg = shellEscape(host);
    const portArg = shellEscape(port);

    return [
      '(stty raw -echo -onlcr -ocrnl -icrnl -inlcr -igncr 2>/dev/null || true);',
      'if command -v nc >/dev/null 2>&1; then',
      `exec nc ${hostArg} ${portArg};`,
      'elif command -v ncat >/dev/null 2>&1; then',
      `exec ncat ${hostArg} ${portArg};`,
      'else',
      `printf %s\\\\n ${shellEscape('sshutil requires nc or ncat on this hop for downstream SSH proxying')} >&2;`,
      'exit 127;',
      'fi',
    ].join(' ');
  }

  /**
   * Execute intermediate commands on a hop via shell (expect-like pattern)
   */
  async _executeHopCommands(client, hop, hopIndex, stateMachine) {
    return new Promise((resolve, reject) => {
      client.shell({ term: 'xterm-256color', modes: RAW_SHELL_MODES }, (err, stream) => {
        if (err) {
          reject(new SSHConnectionError(`Failed to open shell on hop ${hopIndex}: ${err.message}`, hop));
          return;
        }

        this.shellStreams.push(stream);
        stateMachine.bindStream(stream);

        const cleanup = () => {
          stateMachine.removeListener('ready', onReady);
          stateMachine.removeListener('failed', onFailed);
          stateMachine.removeListener('error', onError);
        };

        const onReady = () => {
          cleanup();
          stateMachine.unbindStream();
          this.commandShells[hopIndex] = {
            stream,
            hopIndex,
            consumedAsTransport: false,
          };
          logger.info(`Hop ${hopIndex}: all commands executed successfully`);
          resolve();
        };

        const onFailed = (error) => {
          cleanup();
          stateMachine.unbindStream();
          reject(error);
        };

        const onError = (error) => {
          cleanup();
          stateMachine.unbindStream();
          reject(error);
        };

        stateMachine.once('ready', onReady);
        stateMachine.once('failed', onFailed);
        stateMachine.once('error', onError);

        stateMachine.startCommandExecution();
      });
    });
  }

  /**
   * Get an interactive shell on the final hop
   * @param {object} options - Shell options
   * @returns {Promise<Stream>}
   */
  async getShell(options = {}) {
    if (!this.finalClient) {
      throw new SSHConnectionError('Not connected');
    }

    const shellOpts = {
      term: options.term || 'xterm-256color',
      cols: options.cols || process.stdout.columns || 80,
      rows: options.rows || process.stdout.rows || 24,
    };

    return new Promise((resolve, reject) => {
      this.finalClient.shell(shellOpts, (err, stream) => {
        if (err) {
          reject(new SSHConnectionError(`Failed to open shell: ${err.message}`));
          return;
        }
        this.finalShell = stream;
        resolve(stream);
      });
    });
  }

  /**
   * Execute a command on the final hop
   * @param {string} command
   * @returns {Promise<{stdout: string, stderr: string, code: number}>}
   */
  async exec(command) {
    if (!this.finalClient) {
      throw new SSHConnectionError('Not connected');
    }

    return new Promise((resolve, reject) => {
      this.finalClient.exec(command, (err, stream) => {
        if (err) {
          reject(new SSHConnectionError(`exec failed: ${err.message}`));
          return;
        }

        let stdout = '';
        let stderr = '';

        stream.on('data', (data) => {
          stdout += data.toString('utf8');
        });

        stream.stderr.on('data', (data) => {
          stderr += data.toString('utf8');
        });

        stream.on('close', (code) => {
          resolve({ stdout, stderr, code: code || 0 });
        });

        stream.on('error', (err) => {
          reject(new SSHConnectionError(`exec stream error: ${err.message}`));
        });
      });
    });
  }

  /**
   * Get SFTP client from the final hop
   * @returns {Promise<SFTPWrapper>}
   */
  async getSftp() {
    if (!this.finalClient) {
      throw new SSHConnectionError('Not connected');
    }

    return new Promise((resolve, reject) => {
      this.finalClient.sftp((err, sftp) => {
        if (err) {
          reject(new SSHConnectionError(`SFTP failed: ${err.message}`));
          return;
        }
        resolve(sftp);
      });
    });
  }

  /**
   * Gracefully disconnect all hops (reverse order)
   */
  async disconnect() {
    logger.info('Disconnecting all hops...');

    // Close connections in reverse order
    for (let i = this.connections.length - 1; i >= 0; i--) {
      try {
        const client = this.connections[i];
        if (client) {
          client.end();
        }
      } catch (e) {
        logger.debug(`Error closing connection ${i}: ${e.message}`);
      }
    }

    // Close shell streams after client shutdown so proxy-backed clients can end cleanly.
    for (const stream of new Set(this.shellStreams)) {
      try {
        if (stream && !stream.destroyed) {
          stream.end();
          stream.destroy();
        }
      } catch (e) {
        logger.debug(`Error closing shell stream: ${e.message}`);
      }
    }

    // Destroy state machines
    for (const sm of this.stateMachines) {
      sm.destroy();
    }

    this.connections = [];
    this.stateMachines = [];
    this.shellStreams = [];
    this.commandShells = [];
    this.finalClient = null;
    this.finalShell = null;
    this.isConnected = false;

    this.emit('disconnected');
    logger.info('All hops disconnected');
  }

  /**
   * Get connection status info
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      hops: this.stateMachines.map((sm, i) => ({
        index: i,
        host: sm.hopConfig.host,
        user: sm.hopConfig.user,
        state: sm.state,
      })),
      target: this._targetConfig,
    };
  }
}

export default ConnectionManager;
