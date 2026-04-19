import configManager from '../../config/ConfigManager.js';
import { formatTargetList } from '../formatters.js';

export const command = 'list';
export const describe = 'List all configured targets';
export const builder = {};

export const handler = async () => {
  try {
    const targets = configManager.getAllTargets();
    console.log(formatTargetList(targets));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
};
