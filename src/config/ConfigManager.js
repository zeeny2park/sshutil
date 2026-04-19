import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import logger from '../utils/logger.js';
import { ConfigError } from '../utils/errors.js';
import { validateConfig, normalizeTarget } from './schema.js';
import { DEFAULTS } from './defaults.js';

const CONFIG_DIR = path.join(os.homedir(), DEFAULTS.configDir);
const CONFIG_FILE = path.join(CONFIG_DIR, DEFAULTS.configFile);

class ConfigManager {
  constructor(configPath = CONFIG_FILE) {
    this.configPath = configPath;
    this.config = null;
  }

  /**
   * Ensure config directory exists
   */
  ensureConfigDir() {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created config directory: ${dir}`);
    }
  }

  /**
   * Load and validate configuration
   * @returns {object} Validated config
   */
  load() {
    if (!fs.existsSync(this.configPath)) {
      logger.warn(`Config file not found: ${this.configPath}`);
      this.config = { targets: {} };
      return this.config;
    }

    try {
      const raw = fs.readFileSync(this.configPath, 'utf8');
      const parsed = yaml.load(raw);
      this.config = validateConfig(parsed);
      logger.info(`Loaded config from ${this.configPath} (${this.getTargetNames().length} targets)`);
      return this.config;
    } catch (err) {
      if (err instanceof ConfigError) throw err;
      throw new ConfigError(`Failed to parse config: ${err.message}`);
    }
  }

  /**
   * Save config to file
   */
  save() {
    this.ensureConfigDir();
    const content = yaml.dump(this.config, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });
    fs.writeFileSync(this.configPath, content, 'utf8');
    logger.info(`Saved config to ${this.configPath}`);
  }

  /**
   * Get all target names
   * @returns {string[]}
   */
  getTargetNames() {
    if (!this.config) this.load();
    return Object.keys(this.config.targets || {});
  }

  /**
   * Get a normalized target by name
   * @param {string} name
   * @returns {object} Normalized target config
   */
  getTarget(name) {
    if (!this.config) this.load();
    const target = this.config.targets[name];
    if (!target) {
      throw new ConfigError(`Target "${name}" not found. Available: ${this.getTargetNames().join(', ')}`);
    }
    return normalizeTarget(target);
  }

  /**
   * Add or update a target
   * @param {string} name
   * @param {object} target
   */
  setTarget(name, target) {
    if (!this.config) this.load();
    this.config.targets[name] = target;
    this.save();
    logger.info(`Saved target: ${name}`);
  }

  /**
   * Remove a target
   * @param {string} name
   */
  removeTarget(name) {
    if (!this.config) this.load();
    if (!this.config.targets[name]) {
      throw new ConfigError(`Target "${name}" not found`);
    }
    delete this.config.targets[name];
    this.save();
    logger.info(`Removed target: ${name}`);
  }

  /**
   * Get all targets (normalized)
   * @returns {Object.<string, object>}
   */
  getAllTargets() {
    if (!this.config) this.load();
    const result = {};
    for (const name of this.getTargetNames()) {
      result[name] = this.getTarget(name);
    }
    return result;
  }

  /**
   * Create example config file
   */
  createExampleConfig() {
    this.ensureConfigDir();
    this.config = {
      targets: {
        'example-server': {
          hops: [
            {
              host: '192.168.1.100',
              port: 22,
              user: 'admin',
              auth: { type: 'password', value: 'your-password' },
            },
          ],
        },
        'prod-router': {
          hops: [
            {
              host: '1.1.1.1',
              user: 'user1',
              auth: { type: 'privateKey', value: '~/.ssh/id_rsa' },
            },
            {
              host: '2.2.2.2',
              user: 'gate1',
              auth: { type: 'password', value: 'gate-password' },
              commands: [
                'su -',
                { password: 'root-password' },
                'vrctl 31 bash',
              ],
            },
            {
              host: '3.3.3.3',
              user: 'target-user',
              auth: { type: 'password', value: 'target-password' },
            },
          ],
        },
      },
    };
    this.save();
    logger.info('Created example configuration');
  }
}

// Singleton instance
const configManager = new ConfigManager();
export default configManager;
export { ConfigManager };
