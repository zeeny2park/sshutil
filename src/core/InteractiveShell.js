import logger from '../utils/logger.js';
import { SSHConnectionError } from '../utils/errors.js';

/**
 * InteractiveShell provides a full interactive SSH terminal experience.
 * Handles raw mode, resize, and stdin/stdout piping.
 */
export class InteractiveShell {
  constructor(connectionManager) {
    this.connectionManager = connectionManager;
    this.stream = null;
    this.isActive = false;
    this._originalRawMode = null;
    this._resizeHandler = null;
    this._onClose = null;
  }

  /**
   * Start an interactive shell session
   * @param {object} options
   * @returns {Promise<void>} Resolves when the shell session ends
   */
  async start(options = {}) {
    if (!this.connectionManager.isConnected) {
      throw new SSHConnectionError('Not connected');
    }

    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;

    this.stream = await this.connectionManager.getShell({
      term: options.term || 'xterm-256color',
      cols,
      rows,
    });

    this.isActive = true;

    return new Promise((resolve) => {
      this._onClose = resolve;

      // Setup raw mode for stdin
      if (process.stdin.isTTY) {
        this._originalRawMode = process.stdin.isRaw;
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      // Pipe stdin → remote shell
      process.stdin.on('data', this._onStdinData);

      // Pipe remote shell → stdout
      this.stream.on('data', (data) => {
        process.stdout.write(data);
      });

      this.stream.stderr.on('data', (data) => {
        process.stderr.write(data);
      });

      // Handle terminal resize
      this._resizeHandler = () => {
        const newCols = process.stdout.columns;
        const newRows = process.stdout.rows;
        if (this.stream && !this.stream.destroyed) {
          this.stream.setWindow(newRows, newCols, 0, 0);
        }
      };
      process.stdout.on('resize', this._resizeHandler);

      // Handle stream close
      this.stream.on('close', () => {
        this._cleanup();
        resolve();
      });

      this.stream.on('error', (err) => {
        logger.error(`Shell stream error: ${err.message}`);
        this._cleanup();
        resolve();
      });

      // Handle exit
      this.stream.on('exit', (code) => {
        logger.debug(`Shell exited with code: ${code}`);
      });
    });
  }

  /**
   * Handle stdin data — forward to remote shell
   */
  _onStdinData = (data) => {
    if (this.stream && !this.stream.destroyed) {
      this.stream.write(data);
    }
  };

  /**
   * Clean up raw mode and event listeners
   */
  _cleanup() {
    this.isActive = false;

    // Restore stdin
    process.stdin.removeListener('data', this._onStdinData);
    if (process.stdin.isTTY && this._originalRawMode !== null) {
      process.stdin.setRawMode(this._originalRawMode);
    }
    process.stdin.pause();

    // Remove resize listener
    if (this._resizeHandler) {
      process.stdout.removeListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }

    // Clean up stream
    if (this.stream && !this.stream.destroyed) {
      this.stream.end();
    }
    this.stream = null;
  }

  /**
   * Force close the shell
   */
  close() {
    this._cleanup();
    if (this._onClose) {
      this._onClose();
      this._onClose = null;
    }
  }
}

export default InteractiveShell;
