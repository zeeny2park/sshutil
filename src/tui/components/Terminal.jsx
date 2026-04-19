import React, { useEffect } from 'react';
import { useStdin } from 'ink';

/**
 * Terminal — full screen raw interactive SSH terminal
 * Bypasses Ink's React rendering by returning 'null' and streams directly to process.stdout
 */
export default function Terminal({ stream, onClose }) {
  const { stdin, setRawMode } = useStdin();

  useEffect(() => {
    if (!stream) return;

    // First, clear the screen completely and explicitly SHOW the cursor
    // Ink hides the cursor globally by default (\x1b[?25l), so we must manually unhide it
    process.stdout.write('\x1b[2J\x1b[0;0H\x1b[?25h');

    // Ensure raw mode is enabled to capture every keystroke without waiting for Enter
    if (setRawMode) {
      setRawMode(true);
    }

    // Flush any buffered output (like the initial greeting and prompt)
    if (stream._initialBuffer && stream._captureListener) {
      stream.removeListener('data', stream._captureListener);
      stream._initialBuffer.forEach(chunk => process.stdout.write(chunk));
      stream._initialBuffer = null;
    }

    const onData = (data) => {
      // Pass the raw keystrokes directly to the remote SSH shell
      // User can exit by typing 'exit' or Ctrl+D usually.
      // Additionally, we can trap Ctrl+D (0x04) if the shell doesn't exit, but SSH handles Ctrl+D
      stream.write(data);
    };

    const onOutput = (data) => {
      // Write remote characters straight to local terminal
      process.stdout.write(data);
    };

    const onExit = () => {
      if (onClose) onClose();
    };

    // Attach listeners
    stdin.on('data', onData);
    stream.on('data', onOutput);
    stream.on('close', onExit);
    stream.on('exit', onExit);

    return () => {
      // Cleanup
      stdin.off('data', onData);
      stream.off('data', onOutput);
      stream.off('close', onExit);
      stream.off('exit', onExit);

      // Clear screen again and explicitly HIDE the cursor returning control to Ink
      process.stdout.write('\x1b[2J\x1b[0;0H\x1b[?25l');
    };
  }, [stream, stdin, setRawMode, onClose]);

  // Ink should not render ANYTHING. The raw terminal will draw.
  return null;
}
