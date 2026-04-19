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

export const command = 'download <source> [dest]';
export const describe = 'Download a file from remote target';
export const builder = (yargs) => {
  return yargs
    .positional('source', {
      describe: 'Remote source (target:/path/to/file)',
      type: 'string',
    })
    .positional('dest', {
      describe: 'Local destination path (default: current dir)',
      type: 'string',
      default: '.',
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
  const colonIdx = source.indexOf(':');
  if (colonIdx === -1) {
    console.error(formatError('Source must be in format: target:/remote/path'));
    process.exit(1);
  }

  const targetName = source.substring(0, colonIdx);
  const remotePath = source.substring(colonIdx + 1);

  // Determine local path
  let localPath = dest;
  if (localPath === '.' || localPath === './') {
    localPath = path.join(process.cwd(), path.basename(remotePath));
  }
  localPath = path.resolve(localPath);

  try {
    const targetConfig = configManager.getTarget(targetName);
    const cm = new ConnectionManager();

    cm.on('progress', (event) => {
      console.error(formatConnectionProgress(event));
    });

    await cm.connect(targetConfig);

    const ft = new FileTransfer(cm);
    
    ft.on('progress', (event) => {
      // Use \r to overwrite progress line
      process.stderr.write('\r' + formatTransferProgress(event));
    });

    const result = await ft.download(remotePath, localPath, { method });
    console.error(''); // newline after progress
    console.error(formatSuccess(
      `Downloaded ${formatBytes(result.bytesTransferred)} in ${formatDuration(result.duration)}`
    ));
    console.log(localPath); // Output final path to stdout

    await cm.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('');
    console.error(formatError(err.message));
    process.exit(1);
  }
};
