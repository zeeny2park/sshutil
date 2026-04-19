import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for managing terminal state in TUI mode
 */
export function useTerminal() {
  const [isActive, setIsActive] = useState(false);
  const [outputLines, setOutputLines] = useState([]);
  const streamRef = useRef(null);
  const maxLines = 1000;

  const start = useCallback(async (connectionManager) => {
    if (!connectionManager || !connectionManager.isConnected) {
      throw new Error('Not connected');
    }

    const stream = await connectionManager.getShell({
      term: 'xterm-256color',
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
    });

    streamRef.current = stream;
    setIsActive(true);
    setOutputLines([]);

    // Capture initial shell output (like MoTD & prompt) before the React component mounts
    stream._initialBuffer = [];
    stream._captureListener = (data) => {
      if (stream._initialBuffer) {
        stream._initialBuffer.push(data);
      }
    };
    stream.on('data', stream._captureListener);

    stream.on('close', () => {
      setIsActive(false);
      streamRef.current = null;
    });

    return stream;
  }, []);

  const write = useCallback((data) => {
    if (streamRef.current && !streamRef.current.destroyed) {
      streamRef.current.write(data);
    }
  }, []);

  const resize = useCallback((cols, rows) => {
    if (streamRef.current && !streamRef.current.destroyed) {
      streamRef.current.setWindow(rows, cols, 0, 0);
    }
  }, []);

  const close = useCallback(() => {
    if (streamRef.current && !streamRef.current.destroyed) {
      streamRef.current.end();
      streamRef.current = null;
    }
    setIsActive(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current && !streamRef.current.destroyed) {
        streamRef.current.end();
      }
    };
  }, []);

  return {
    isActive,
    outputLines,
    stream: streamRef.current,
    start,
    write,
    resize,
    close,
  };
}
