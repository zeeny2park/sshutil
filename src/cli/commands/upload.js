import path from 'path';
import configManager from '../../config/ConfigManager.js';
import { ConnectionManager } from '../../core/ConnectionManager.js';
import { FileTransfer } from '../../core/FileTransfer.js';
import {
  formatConnectionProgress,
  formatTransferProgress,
  formatSuccess,
  formatError,
  formatBytes,
  formatDuration,
} from '../formatters.js';

export const command = 'upload <source> <dest>';
export const describe = 'Upload a file to remote target';
export const builder = (yargs) => {
  return yargs
    .positional('source', {
      describe: 'Local source file path',
      type: 'string',
    })
    .positional('dest', {
      describe: 'Remote destination (target:/path/to/file)',
      type: 'string',
    })
    .option('method', {
      describe: 'Transfer method (sftp or exec)',
      type: 'string',
      default: 'sftp',
      choices: ['sftp', 'exec'],
    });
};

export const handler = async (argv) => {
  const { source, dest, method } = argv;

  // Parse target:path
  const colonIdx = dest.indexOf(':');
  if (colonIdx === -1) {
    console.error(formatError('Destination must be in format: target:/remote/path'));
    process.exit(1);
  }

  const targetName = dest.substring(0, colonIdx);
  const remotePath = dest.substring(colonIdx + 1);
  const localPath = path.resolve(source);

  try {
    const targetConfig = configManager.getTarget(targetName);
    const cm = new ConnectionManager();

    cm.on('progress', (event) => {
      console.error(formatConnectionProgress(event));
    });

    await cm.connect(targetConfig);

    const ft = new FileTransfer(cm);

    ft.on('progress', (event) => {
      process.stderr.write('\r' + formatTransferProgress(event));
    });

    const result = await ft.upload(localPath, remotePath, { method });
    console.error('');
    console.error(formatSuccess(
      `Uploaded ${formatBytes(result.bytesTransferred)} in ${formatDuration(result.duration)}`
    ));

    await cm.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('');
    console.error(formatError(err.message));
    process.exit(1);
  }
};
