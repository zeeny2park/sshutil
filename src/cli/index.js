import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as connectCmd from './commands/connect.js';
import * as execCmd from './commands/exec.js';
import * as downloadCmd from './commands/download.js';
import * as uploadCmd from './commands/upload.js';
import * as listCmd from './commands/list.js';
import configManager from '../config/ConfigManager.js';
import { enableConsoleLogging } from '../utils/logger.js';

export function runCLI() {
  // Load config on startup
  try {
    configManager.load();
  } catch (err) {
    // Config not found is OK, we'll create it
  }

  const cli = yargs(hideBin(process.argv))
    .scriptName('sshutil')
    .usage('$0 <command> [options]')
    .command(connectCmd)
    .command(execCmd)
    .command(downloadCmd)
    .command(uploadCmd)
    .command(listCmd)
    .command('init', 'Create example config file', {}, () => {
      configManager.createExampleConfig();
      console.log(`✓ Example config created at ~/.sshutil/targets.yaml`);
      console.log(`  Edit this file with your target servers.`);
    })
    .command('tui', 'Launch TUI mode', {}, async () => {
      // Dynamic import to avoid loading Ink/React unless TUI mode
      // Import from pre-built bundle (JSX pre-compiled)
      const { startTUI } = await import('../../dist/tui.js');
      startTUI();
    })
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      description: 'Enable verbose logging',
    })
    .middleware([(argv) => {
      if (argv.verbose) {
        enableConsoleLogging('debug');
      }
    }])
    .demandCommand(1, 'Please specify a command. Run with --help to see available commands.')
    .strict()
    .help()
    .alias('help', 'h')
    .version()
    .alias('version', 'V')
    .epilog('Multi-Hop SSH utility — https://github.com/sshutil')
    .wrap(80)
    .parse();
}
