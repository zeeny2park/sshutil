// Custom error classes for SSHUtil

export class SSHUtilError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SSHUtilError';
    this.code = code;
  }
}

export class SSHConnectionError extends SSHUtilError {
  constructor(message, hop = null) {
    super(message, 'SSH_CONNECTION_ERROR');
    this.name = 'SSHConnectionError';
    this.hop = hop;
  }
}

export class AuthenticationError extends SSHUtilError {
  constructor(message, hop = null) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
    this.hop = hop;
  }
}

export class TimeoutError extends SSHUtilError {
  constructor(message, timeoutMs = 0) {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class FileTransferError extends SSHUtilError {
  constructor(message, remotePath = null) {
    super(message, 'FILE_TRANSFER_ERROR');
    this.name = 'FileTransferError';
    this.remotePath = remotePath;
  }
}

export class ConfigError extends SSHUtilError {
  constructor(message) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

export class HopCommandError extends SSHUtilError {
  constructor(message, command = null, hopIndex = null) {
    super(message, 'HOP_COMMAND_ERROR');
    this.name = 'HopCommandError';
    this.command = command;
    this.hopIndex = hopIndex;
  }
}
