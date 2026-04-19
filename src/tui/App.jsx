import React, { useState, useCallback, useEffect } from 'react';
import { render, useApp, Box, Text } from 'ink';
import Dashboard from './components/Dashboard.jsx';
import TargetSelector from './components/TargetSelector.jsx';
import Terminal from './components/Terminal.jsx';
import FileExplorer from './components/FileExplorer.jsx';
import StatusBar from './components/StatusBar.jsx';
import { useSSH } from './hooks/useSSH.js';
import { useTerminal } from './hooks/useTerminal.js';
import { FileTransfer } from '../core/FileTransfer.js';
import configManager from '../config/ConfigManager.js';
import sessionManager from '../core/SessionManager.js';
import { disableConsoleLogging } from '../utils/logger.js';
import { colors } from './theme.js';

/**
 * Main TUI Application
 */
function App() {
  const { exit } = useApp();
  const [mode, setMode] = useState('dashboard');
  const [error, setError] = useState(null);
  const [targets, setTargets] = useState({});
  const [sessions, setSessions] = useState([]);
  const [currentTarget, setCurrentTarget] = useState(null);

  const ssh = useSSH();
  const terminal = useTerminal();
  const [fileTransfer, setFileTransfer] = useState(null);

  // Load targets on mount
  useEffect(() => {
    try {
      configManager.load();
      setTargets(configManager.getAllTargets());
    } catch (err) {
      setError(`Config error: ${err.message}`);
    }
  }, []);

  // Update sessions periodically
  useEffect(() => {
    // Pause polling while in terminal mode to stop Ink from redrawing over the raw PTY stream
    if (mode === 'terminal') return;

    const interval = setInterval(() => {
      setSessions(sessionManager.getSummary());
    }, 1000);
    return () => clearInterval(interval);
  }, [mode]);

  // Handle connect
  const handleConnect = useCallback(() => {
    setMode('selectTarget');
    setError(null);
  }, []);

  // Handle target selection
  const handleTargetSelected = useCallback(async (targetName) => {
    try {
      setMode('dashboard');
      setCurrentTarget(targetName);

      const cm = await ssh.connect(targetName);
      sessionManager.createSession(targetName, cm);

      // Create file transfer instance
      setFileTransfer(new FileTransfer(cm));
    } catch (err) {
      setError(err.message);
      setMode('dashboard');
    }
  }, [ssh]);

  // Handle terminal mode
  const handleTerminal = useCallback(async () => {
    if (ssh.status !== 'connected') {
      setError('Not connected. Press [C] to connect first.');
      return;
    }

    try {
      setMode('terminal');
      await terminal.start(ssh.connection);
    } catch (err) {
      setError(err.message);
      setMode('dashboard');
    }
  }, [ssh, terminal]);

  // Handle file explorer
  const handleFiles = useCallback(() => {
    if (ssh.status !== 'connected') {
      setError('Not connected. Press [C] to connect first.');
      return;
    }
    setMode('files');
  }, [ssh]);

  // Handle quit
  const handleQuit = useCallback(async () => {
    await sessionManager.closeAll();
    exit();
  }, [exit]);

  // Key hints for status bar
  const keyHints = mode === 'dashboard' ? [
    { key: 'C', label: 'Connect' },
    { key: 'Q', label: 'Quit' },
  ] : [
    { key: 'Esc', label: 'Back' },
  ];

  return (
    <Box flexDirection="column" height="100%">
      {/* Main content */}
      <Box flexGrow={1}>
        {mode === 'dashboard' && (
          <Dashboard
            targets={targets}
            sessions={sessions}
            status={ssh.status}
            error={error}
            onConnect={handleConnect}
            onFiles={handleFiles}
            onTerminal={handleTerminal}
            onQuit={handleQuit}
          />
        )}

        {mode === 'selectTarget' && (
          <TargetSelector
            targets={targets}
            onSelect={handleTargetSelected}
            onCancel={() => setMode('dashboard')}
          />
        )}

        {mode === 'terminal' && (
          <Terminal
            stream={terminal.stream}
            onClose={() => {
              terminal.close();
              setMode('dashboard');
            }}
          />
        )}

        {mode === 'files' && (
          <FileExplorer
            connection={ssh.connection}
            fileTransfer={fileTransfer}
            onClose={() => setMode('dashboard')}
          />
        )}
      </Box>

      {/* Status bar */}
      {mode !== 'terminal' && (
        <StatusBar
          mode={mode}
          status={ssh.status}
          sessionCount={sessions.filter(s => s.status === 'active').length}
          targetName={currentTarget}
          keyHints={keyHints}
        />
      )}
    </Box>
  );
}

/**
 * Start the TUI application
 */
export function startTUI() {
  // Disable console logging in TUI mode
  disableConsoleLogging();

  // Load config
  try {
    configManager.load();
  } catch (err) {
    // Will show error in the UI
  }

  const { waitUntilExit } = render(<App />);

  waitUntilExit().then(() => {
    process.exit(0);
  });
}

export default App;
