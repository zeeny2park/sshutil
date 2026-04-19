// Configuration schema validation

import { ConfigError } from '../utils/errors.js';

/**
 * Validate a single hop configuration
 */
function validateHop(hop, index, targetName) {
  if (!hop.host || typeof hop.host !== 'string') {
    throw new ConfigError(
      `Target "${targetName}" hop ${index + 1}: "host" is required and must be a string`
    );
  }
  if (!hop.user || typeof hop.user !== 'string') {
    throw new ConfigError(
      `Target "${targetName}" hop ${index + 1}: "user" is required and must be a string`
    );
  }
  if (hop.port !== undefined) {
    const port = Number(hop.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new ConfigError(
        `Target "${targetName}" hop ${index + 1}: "port" must be 1-65535`
      );
    }
  }
  if (hop.auth) {
    if (!['password', 'privateKey', 'agent'].includes(hop.auth.type)) {
      throw new ConfigError(
        `Target "${targetName}" hop ${index + 1}: auth.type must be "password", "privateKey", or "agent"`
      );
    }
  }
  if (hop.commands) {
    if (!Array.isArray(hop.commands)) {
      throw new ConfigError(
        `Target "${targetName}" hop ${index + 1}: "commands" must be an array`
      );
    }
    hop.commands.forEach((cmd, cmdIdx) => {
      if (typeof cmd === 'string') return; // Simple command string
      if (typeof cmd === 'object' && cmd !== null) {
        // Object with command/expect/input/password
        return;
      }
      throw new ConfigError(
        `Target "${targetName}" hop ${index + 1} command ${cmdIdx + 1}: invalid format`
      );
    });
  }
}

/**
 * Validate a target configuration
 */
function validateTarget(target, name) {
  if (!target.hops || !Array.isArray(target.hops) || target.hops.length === 0) {
    throw new ConfigError(`Target "${name}": "hops" must be a non-empty array`);
  }
  target.hops.forEach((hop, index) => validateHop(hop, index, name));
}

/**
 * Validate the entire configuration
 * @param {object} config - Parsed YAML config
 * @returns {object} Validated config
 */
export function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new ConfigError('Configuration must be an object');
  }
  if (!config.targets || typeof config.targets !== 'object') {
    throw new ConfigError('"targets" section is required');
  }

  for (const [name, target] of Object.entries(config.targets)) {
    validateTarget(target, name);
  }

  return config;
}

/**
 * Normalize a hop configuration with defaults
 */
export function normalizeHop(hop) {
  return {
    host: hop.host,
    port: hop.port || 22,
    user: hop.user,
    auth: hop.auth || null,
    commands: (hop.commands || []).map(cmd => {
      if (typeof cmd === 'string') {
        return { command: cmd, expect: null, input: null, timeout: null };
      }
      if (cmd.password !== undefined) {
        // Shorthand: { password: 'xxx' } → input password at password prompt
        return {
          command: null,
          expect: /[Pp]assword/,
          input: cmd.password,
          timeout: cmd.timeout || null,
          isPassword: true === true
        };
      }
      return {
        command: cmd.command || null,
        expect: cmd.expect ? new RegExp(cmd.expect) : null,
        input: cmd.input || null,
        timeout: cmd.timeout || null,
        isPassword: false === true
      };
    }),
  };
}

/**
 * Normalize entire target config
 */
export function normalizeTarget(target) {
  return {
    ...target,
    hops: target.hops.map(normalizeHop),
  };
}
