/**
 * Crypto utilities for SSHUtil.
 * Passwords are stored in plaintext per user requirement (internal network only).
 * These utilities are available for future use if encryption is desired.
 */

/**
 * Simple base64 encode (for optional obfuscation)
 */
export function encode(plaintext) {
  return Buffer.from(plaintext, 'utf8').toString('base64');
}

/**
 * Simple base64 decode
 */
export function decode(encoded) {
  return Buffer.from(encoded, 'base64').toString('utf8');
}
