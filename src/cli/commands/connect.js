import configManager from '../../config/ConfigManager.js';
import { ConnectionManager } from '../../core/ConnectionManager.js';
import { InteractiveShell } from '../../core/InteractiveShell.js';
import sessionManager from '../../core/SessionManager.js';
import { formatConnectionProgress, formatSuccess, formatError } from '../formatters.js';

export const command = 'connect <target>';
export const describe = 'Connect to a target via SSH (interactive shell)';
export const builder = (yargs) => {
  return yargs.positional('target', {
    describe: 'Target name from config',
    type: 'string',
  });
};

export const handler = async (argv) => {
  const { target } = argv;

  try {
    const targetConfig = configManager.getTarget(target);
    const cm = new ConnectionManager();

    // Show progress
    cm.on('progress', (event) => {
      console.log(formatConnectionProgress(event));
    });

    cm.on('hopStateChange', (event) => {
      if (event.newState === 'AUTHENTICATED') {
        console.log(formatSuccess(`Hop ${event.hopIndex + 1}: authenticated at ${event.host}`));
      }
    });

    // Connect
    await cm.connect(targetConfig);
    console.log(formatSuccess(`Connected to ${target}`));
    console.log('');

    // Register session
    const sessionId = sessionManager.createSession(target, cm);

    // Start interactive shell
    const shell = new InteractiveShell(cm);
    await shell.start();

    // Clean up on exit
    await sessionManager.closeSession(sessionId);
    console.log('\n' + formatSuccess('Disconnected'));
    process.exit(0);
  } catch (err) {
    console.error(formatError(err.message));
    process.exit(1);
  }
};
