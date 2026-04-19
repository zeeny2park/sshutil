import winston from 'winston';
import path from 'path';
import os from 'os';
import fs from 'fs';

const LOG_DIR = path.join(os.homedir(), '.sshutil', 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    let log = `${timestamp} [${level.toUpperCase().padEnd(5)}] ${message}`;
    if (stack) log += `\n${stack}`;
    return log;
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf(({ level, message }) => {
    return `${level}: ${message}`;
  })
);

const logger = winston.createLogger({
  level: process.env.SSHUTIL_LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Single log file — no session logging needed
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'sshutil.log'),
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 2,
    }),
  ],
});

// Console transport — disabled in TUI mode to avoid messing with Ink
let consoleTransport = null;

export function enableConsoleLogging(level = 'info') {
  if (!consoleTransport) {
    consoleTransport = new winston.transports.Console({
      level,
      format: consoleFormat,
    });
    logger.add(consoleTransport);
  }
}

export function disableConsoleLogging() {
  if (consoleTransport) {
    logger.remove(consoleTransport);
    consoleTransport = null;
  }
}

export default logger;
