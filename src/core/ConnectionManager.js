import { Client } from 'ssh2';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import os from 'os';
import logger from '../utils/logger.js';
import { SSHConnectionError, AuthenticationError } from '../utils/errors.js';
import { HopStateMachine, HopState } from './HopStateMachine.js';
import { DEFAULTS } from '../config/defaults.js';

/**
 * ConnectionManager orchestrates multi-hop SSH connections.
 *
 * Supports two modes:
 * 1. Standard SSH hop: Uses ssh2 forwardOut() for TCP tunneling
 * 2. Shell-based hop: Uses shell + expect pattern for intermediate commands
 *    (e.g., su -, vrctl, etc.)
 */
export class ConnectionManager extends EventEmitter {
  constructor() {
    super();
    this.connections = [];       // Array of ssh2.Client instances
    this.stateMachines = [];     // Array of HopStateMachine instances
    this.shellStreams = [];       // Shell streams for command-based hops
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
        const isLastHop = i === hops.length - 1;
        const hasCommands = hop.commands && hop.commands.length > 0;

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

        if (hasCommands && !isLastHop) {
          // Shell-based hop: use the previous connection's shell
          await this._connectShellHop(hop, i, sm);
        } else {
          // Standard SSH hop: use forwardOut
          await this._connectSSHHop(hop, i, sm);
        }
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
   * Standard SSH hop using forwardOut TCP tunneling
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

        // If not the first hop, tunnel through previous connection
        if (hopIndex > 0) {
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
          if (retryCount < DEFAULTS.hop.retryAttempts) {
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
   * Shell-based hop: use existing connection's shell for intermediate commands
   */
  async _connectShellHop(hop, hopIndex, stateMachine) {
    const prevClient = this.connections[hopIndex - 1] || this.connections[this.connections.length - 1];

    return new Promise((resolve, reject) => {
      // First establish an SSH connection to this hop
      this._connectSSHHop(hop, hopIndex, stateMachine)
        .then((client) => resolve(client))
        .catch(reject);
    });
  }

  /**
   * Execute intermediate commands on a hop via shell (expect-like pattern)
   */
  async _executeHopCommands(client, hop, hopIndex, stateMachine) {
    return new Promise((resolve, reject) => {
      client.shell({ term: 'xterm-256color' }, (err, stream) => {
        if (err) {
          reject(new SSHConnectionError(`Failed to open shell on hop ${hopIndex}: ${err.message}`, hop));
          return;
        }

        this.shellStreams.push(stream);
        stateMachine.bindStream(stream);

        stateMachine.on('ready', () => {
          logger.info(`Hop ${hopIndex}: all commands executed successfully`);
          resolve();
        });

        stateMachine.on('failed', (error) => {
          reject(error);
        });

        stateMachine.on('error', (error) => {
          reject(error);
        });

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

    // Close shell streams
    for (const stream of this.shellStreams) {
      try {
        if (stream && !stream.destroyed) {
          stream.end();
          stream.destroy();
        }
      } catch (e) {
        logger.debug(`Error closing shell stream: ${e.message}`);
      }
    }

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

    // Destroy state machines
    for (const sm of this.stateMachines) {
      sm.destroy();
    }

    this.connections = [];
    this.stateMachines = [];
    this.shellStreams = [];
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
