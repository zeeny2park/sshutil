import { useState, useCallback, useEffect, useRef } from 'react';
import { ConnectionManager } from '../../core/ConnectionManager.js';
import configManager from '../../config/ConfigManager.js';

/**
 * Hook to manage SSH connections in TUI components
 */
export function useSSH() {
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected | error
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [hopStates, setHopStates] = useState([]);
  const connectionRef = useRef(null);

  const connect = useCallback(async (targetName) => {
    try {
      setStatus('connecting');
      setError(null);
      setProgress(null);
      setHopStates([]);

      const targetConfig = configManager.getTarget(targetName);
      const cm = new ConnectionManager();
      connectionRef.current = cm;

      cm.on('progress', (event) => {
        setProgress(event);
      });

      cm.on('hopStateChange', (event) => {
        setHopStates(prev => {
          const newStates = [...prev];
          newStates[event.hopIndex] = {
            host: event.host,
            state: event.newState,
          };
          return newStates;
        });
      });

      await cm.connect(targetConfig);
      setStatus('connected');
      setProgress(null);
      return cm;
    } catch (err) {
      setStatus('error');
      setError(err.message);
      connectionRef.current = null;
      throw err;
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (connectionRef.current) {
      await connectionRef.current.disconnect();
      connectionRef.current = null;
    }
    setStatus('disconnected');
    setError(null);
    setProgress(null);
    setHopStates([]);
  }, []);

  const exec = useCallback(async (command) => {
    if (!connectionRef.current) {
      throw new Error('Not connected');
    }
    return connectionRef.current.exec(command);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (connectionRef.current && connectionRef.current.isConnected) {
        connectionRef.current.disconnect().catch(() => {});
      }
    };
  }, []);

  return {
    status,
    error,
    progress,
    hopStates,
    connection: connectionRef.current,
    connect,
    disconnect,
    exec,
  };
}
