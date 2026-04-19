import configManager from '../../config/ConfigManager.js';
import { ConnectionManager } from '../../core/ConnectionManager.js';
import { formatConnectionProgress, formatSuccess, formatError } from '../formatters.js';

export const command = 'exec <target> <cmd>';
export const describe = 'Execute a command on a remote target';
export const builder = (yargs) => {
  return yargs
    .positional('target', {
      describe: 'Target name from config',
      type: 'string',
    })
    .positional('cmd', {
      describe: 'Command to execute remotely',
      type: 'string',
    });
};

export const handler = async (argv) => {
  const { target, cmd } = argv;

  try {
    const targetConfig = configManager.getTarget(target);
    const cm = new ConnectionManager();

    cm.on('progress', (event) => {
      console.error(formatConnectionProgress(event));
    });

    await cm.connect(targetConfig);

    const result = await cm.exec(cmd);

    // Stdout goes to stdout (for piping)
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }

    // Stderr goes to stderr
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    await cm.disconnect();
    process.exit(result.code);
  } catch (err) {
    console.error(formatError(err.message));
    process.exit(1);
  }
};
