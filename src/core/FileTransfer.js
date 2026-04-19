import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';
import { FileTransferError } from '../utils/errors.js';
import { DEFAULTS } from '../config/defaults.js';

/**
 * FileTransfer handles streaming file transfer between local and remote.
 * Supports both SFTP and exec-based (cat pipe) methods.
 * No intermediate node storage — end-to-end streaming only.
 */
export class FileTransfer extends EventEmitter {
  constructor(connectionManager) {
    super();
    this.connectionManager = connectionManager;
  }

  /**
   * Download a file from remote to local (streaming)
   * @param {string} remotePath - Path on the remote server
   * @param {string} localPath - Local destination path
   * @param {object} options
   * @returns {Promise<{bytesTransferred: number, duration: number}>}
   */
  async download(remotePath, localPath, options = {}) {
    const method = options.method || 'sftp'; // 'sftp' or 'exec'
    logger.info(`Download: ${remotePath} → ${localPath} (method: ${method})`);

    const startTime = Date.now();

    if (method === 'sftp') {
      return this._downloadSftp(remotePath, localPath, startTime);
    } else {
      return this._downloadExec(remotePath, localPath, startTime);
    }
  }

  /**
   * SFTP-based download
   */
  async _downloadSftp(remotePath, localPath, startTime) {
    const sftp = await this.connectionManager.getSftp();

    // Get file size for progress
    let fileSize = 0;
    try {
      const stat = await new Promise((resolve, reject) => {
        sftp.stat(remotePath, (err, stats) => {
          if (err) reject(err);
          else resolve(stats);
        });
      });
      fileSize = stat.size;
    } catch (err) {
      logger.warn(`Cannot stat remote file: ${err.message}`);
    }

    return new Promise((resolve, reject) => {
      const localDir = path.dirname(localPath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      sftp.fastGet(remotePath, localPath, {
        step: (total_transferred, chunk, total) => {
          this.emit('progress', {
            type: 'download',
            bytesTransferred: total_transferred,
            totalBytes: total || fileSize, // Fallback if total is undefined
            percentage: (total || fileSize) > 0 ? Math.round((total_transferred / (total || fileSize)) * 100) : 100,
            remotePath,
            localPath,
          });
        }
      }, (err) => {
        if (err) {
          reject(new FileTransferError(`Download failed: ${err.message}`, remotePath));
          return;
        }

        const duration = Date.now() - startTime;
        this.emit('progress', {
          type: 'download',
          bytesTransferred: fileSize,
          totalBytes: fileSize,
          percentage: 100,
          remotePath,
          localPath,
        });

        this.emit('complete', {
          type: 'download',
          bytesTransferred: fileSize,
          duration,
          remotePath,
          localPath,
        });

        logger.info(`Download complete (fastGet): ${fileSize} bytes in ${duration}ms`);
        resolve({ bytesTransferred: fileSize, duration });
      });
    });
  }

  /**
   * exec-based download (cat → pipe → local file)
   * Used when SFTP is unavailable or through shell-based hops
   */
  async _downloadExec(remotePath, localPath, startTime) {
    return new Promise((resolve, reject) => {
      const localDir = path.dirname(localPath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      const writeStream = fs.createWriteStream(localPath);
      let bytesTransferred = 0;

      this.connectionManager.finalClient.exec(`cat "${remotePath}"`, (err, stream) => {
        if (err) {
          reject(new FileTransferError(`exec cat failed: ${err.message}`, remotePath));
          return;
        }

        const progressInterval = setInterval(() => {
          this.emit('progress', {
            type: 'download',
            bytesTransferred,
            totalBytes: 0,
            percentage: 0,
            remotePath,
            localPath,
          });
        }, DEFAULTS.transfer.progressInterval);

        stream.on('data', (chunk) => {
          bytesTransferred += chunk.length;
          writeStream.write(chunk);
        });

        stream.stderr.on('data', (data) => {
          const errMsg = data.toString('utf8').trim();
          if (errMsg) {
            logger.warn(`Download stderr: ${errMsg}`);
          }
        });

        stream.on('close', (code) => {
          clearInterval(progressInterval);
          writeStream.end();

          if (code !== 0) {
            reject(new FileTransferError(`cat exited with code ${code}`, remotePath));
            return;
          }

          const duration = Date.now() - startTime;
          this.emit('complete', {
            type: 'download',
            bytesTransferred,
            duration,
            remotePath,
            localPath,
          });

          logger.info(`Download (exec) complete: ${bytesTransferred} bytes in ${duration}ms`);
          resolve({ bytesTransferred, duration });
        });

        stream.on('error', (err) => {
          clearInterval(progressInterval);
          writeStream.destroy();
          reject(new FileTransferError(`Download stream error: ${err.message}`, remotePath));
        });
      });
    });
  }

  /**
   * Upload a file from local to remote (streaming)
   * @param {string} localPath - Local source path
   * @param {string} remotePath - Remote destination path
   * @param {object} options
   * @returns {Promise<{bytesTransferred: number, duration: number}>}
   */
  async upload(localPath, remotePath, options = {}) {
    const method = options.method || 'sftp';
    logger.info(`Upload: ${localPath} → ${remotePath} (method: ${method})`);

    if (!fs.existsSync(localPath)) {
      throw new FileTransferError(`Local file not found: ${localPath}`, localPath);
    }

    const startTime = Date.now();
    const stat = fs.statSync(localPath);
    const fileSize = stat.size;

    if (method === 'sftp') {
      return this._uploadSftp(localPath, remotePath, fileSize, startTime);
    } else {
      return this._uploadExec(localPath, remotePath, fileSize, startTime);
    }
  }

  /**
   * SFTP-based upload
   */
  async _uploadSftp(localPath, remotePath, fileSize, startTime) {
    const sftp = await this.connectionManager.getSftp();

    return new Promise((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, {
        step: (total_transferred, chunk, total) => {
          this.emit('progress', {
            type: 'upload',
            bytesTransferred: total_transferred,
            totalBytes: total || fileSize,
            percentage: (total || fileSize) > 0 ? Math.round((total_transferred / (total || fileSize)) * 100) : 100,
            localPath,
            remotePath,
          });
        }
      }, (err) => {
        if (err) {
          reject(new FileTransferError(`Upload failed: ${err.message}`, remotePath));
          return;
        }

        const duration = Date.now() - startTime;
        this.emit('progress', {
          type: 'upload',
          bytesTransferred: fileSize,
          totalBytes: fileSize,
          percentage: 100,
          localPath,
          remotePath,
        });

        this.emit('complete', {
          type: 'upload',
          bytesTransferred: fileSize,
          duration,
          localPath,
          remotePath,
        });

        logger.info(`Upload complete (fastPut): ${fileSize} bytes in ${duration}ms`);
        resolve({ bytesTransferred: fileSize, duration });
      });
    });
  }

  /**
   * exec-based upload (cat > remote file via stdin pipe)
   */
  async _uploadExec(localPath, remotePath, fileSize, startTime) {
    return new Promise((resolve, reject) => {
      this.connectionManager.finalClient.exec(`cat > "${remotePath}"`, (err, stream) => {
        if (err) {
          reject(new FileTransferError(`exec cat > failed: ${err.message}`, remotePath));
          return;
        }

        const readStream = fs.createReadStream(localPath);
        let bytesTransferred = 0;

        const progressInterval = setInterval(() => {
          this.emit('progress', {
            type: 'upload',
            bytesTransferred,
            totalBytes: fileSize,
            percentage: fileSize > 0 ? Math.round((bytesTransferred / fileSize) * 100) : 0,
            localPath,
            remotePath,
          });
        }, DEFAULTS.transfer.progressInterval);

        readStream.on('data', (chunk) => {
          bytesTransferred += chunk.length;
        });

        readStream.pipe(stream);

        readStream.on('end', () => {
          stream.end();
        });

        stream.on('close', (code) => {
          clearInterval(progressInterval);
          const duration = Date.now() - startTime;

          this.emit('complete', {
            type: 'upload',
            bytesTransferred,
            duration,
            localPath,
            remotePath,
          });

          logger.info(`Upload (exec) complete: ${bytesTransferred} bytes in ${duration}ms`);
          resolve({ bytesTransferred, duration });
        });

        readStream.on('error', (err) => {
          clearInterval(progressInterval);
          stream.destroy();
          reject(new FileTransferError(`Read failed: ${err.message}`, localPath));
        });

        stream.on('error', (err) => {
          clearInterval(progressInterval);
          readStream.destroy();
          reject(new FileTransferError(`Upload stream error: ${err.message}`, remotePath));
        });
      });
    });
  }

  /**
   * List remote directory contents
   * @param {string} remotePath
   * @returns {Promise<Array>}
   */
  async listRemote(remotePath) {
    const sftp = await this.connectionManager.getSftp();

    return new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) {
          reject(new FileTransferError(`readdir failed: ${err.message}`, remotePath));
          return;
        }

        const entries = list.map(item => ({
          name: item.filename,
          path: path.posix.join(remotePath, item.filename),
          isDirectory: (item.attrs.mode & 0o40000) !== 0,
          size: item.attrs.size,
          modifiedAt: new Date(item.attrs.mtime * 1000),
          permissions: item.attrs.mode,
        }));

        // Sort: directories first, then alphabetical
        entries.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        resolve(entries);
      });
    });
  }

  /**
   * Get remote file stats
   */
  async statRemote(remotePath) {
    const sftp = await this.connectionManager.getSftp();
    return new Promise((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) reject(new FileTransferError(`stat failed: ${err.message}`, remotePath));
        else resolve(stats);
      });
    });
  }

  /**
   * Get remote home directory path
   */
  async getHomeDir() {
    const sftp = await this.connectionManager.getSftp();
    return new Promise((resolve, reject) => {
      sftp.realpath('.', (err, rp) => {
        if (err) resolve('/'); // fallback
        else resolve(rp);
      });
    });
  }
}

export default FileTransfer;
