import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

/**
 * SessionManager tracks the single active SSH session.
 * One tool instance = one target connection.
 */
export class SessionManager extends EventEmitter {
  constructor() {
    super();
    this.session = null;
  }

  /**
   * Create a new session (closes existing one if any)
   * @param {string} targetName - Target alias
   * @param {ConnectionManager} connectionManager - Active connection
   * @returns {string} Session ID
   */
  async createSession(targetName, connectionManager) {
    // Close existing session first (single session only)
    if (this.session && this.session.status === 'active') {
      await this.closeSession();
    }

    const id = `session-${Date.now()}`;
    this.session = {
      id,
      targetName,
      connectionManager,
      createdAt: new Date(),
      lastActivity: new Date(),
      status: 'active',
    };

    logger.info(`Session created: ${id} → ${targetName}`);
    this.emit('sessionCreated', this.session);
    return id;
  }

  /**
   * Get the current session
   */
  getSession() {
    return this.session;
  }

  /**
   * Check if there's an active session
   */
  hasActiveSession() {
    return this.session && this.session.status === 'active';
  }

  /**
   * Update last activity timestamp
   */
  touch() {
    if (this.session) {
      this.session.lastActivity = new Date();
    }
  }

  /**
   * Close the current session
   */
  async closeSession() {
    if (!this.session) {
      return;
    }

    try {
      if (this.session.connectionManager && this.session.connectionManager.isConnected) {
        await this.session.connectionManager.disconnect();
      }
    } catch (err) {
      logger.error(`Error closing session: ${err.message}`);
    }

    this.session.status = 'closed';
    this.session.closedAt = new Date();
    logger.info(`Session closed: ${this.session.id}`);
    this.emit('sessionClosed', this.session);
    this.session = null;
  }

  /**
   * Alias for closeSession (backward compat)
   */
  async closeAll() {
    await this.closeSession();
  }

  /**
   * Get session summary for display
   */
  getSummary() {
    if (!this.session || this.session.status !== 'active') {
      return [];
    }

    const s = this.session;
    const duration = Math.floor((Date.now() - s.createdAt.getTime()) / 1000);
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;

    return [{
      id: s.id,
      target: s.targetName,
      status: s.status,
      duration: mins > 0 ? `${mins}m ${secs}s` : `${secs}s`,
      lastActivity: s.lastActivity,
    }];
  }
}

// Singleton
const sessionManager = new SessionManager();
export default sessionManager;
