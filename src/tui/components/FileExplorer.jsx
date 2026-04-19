import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import LocalPanel from './LocalPanel.jsx';
import RemotePanel from './RemotePanel.jsx';
import TransferProgress from './TransferProgress.jsx';
import { useLocalExplorer, useRemoteExplorer } from '../hooks/useFileExplorer.js';
import { colors, icons } from '../theme.js';

/**
 * FileExplorer — dual-panel file browser (local + remote)
 */
export default function FileExplorer({ connection, fileTransfer, onClose, onTransfer }) {
  const [activePanel, setActivePanel] = useState('local'); // 'local' | 'remote'
  const [transfers, setTransfers] = useState([]);

  const local = useLocalExplorer();
  const remote = useRemoteExplorer(fileTransfer);

  useInput((input, key) => {
    // Panel switching
    if (key.tab) {
      setActivePanel(prev => prev === 'local' ? 'remote' : 'local');
      return;
    }

    // Back
    if (key.escape) {
      if (onClose) onClose();
      return;
    }

    // Navigation
    const explorer = activePanel === 'local' ? local : remote;

    if (key.upArrow || input === 'k') {
      explorer.moveUp();
    } else if (key.downArrow || input === 'j') {
      explorer.moveDown();
    } else if (key.return) {
      const entry = explorer.enterSelected();
      // If not a directory, it's a file selection (no auto-enter)
    } else if (input === 'c' || input === 'C') {
      // Copy: from active panel to other panel
      handleCopy();
    } else if (input === 'r' || input === 'R') {
      // Refresh current panel
      explorer.refresh();
    }
  });

  const handleCopy = useCallback(async () => {
    const source = activePanel === 'local' ? local : remote;
    const selected = source.getSelected();
    
    if (!selected || selected.isDirectory || selected.isParent) return;
    if (!fileTransfer) return;

    try {
      if (activePanel === 'local') {
        // Upload: local → remote
        const remoteDest = remote.currentPath + '/' + selected.name;
        const transferId = Date.now();
        setTransfers(prev => [...prev, {
          id: transferId,
          type: 'upload',
          filename: selected.name,
          percentage: 0,
          bytesTransferred: 0,
        }]);

        fileTransfer.on('progress', (event) => {
          if (event.type === 'upload') {
            setTransfers(prev => prev.map(t =>
              t.id === transferId ? { ...t, ...event } : t
            ));
          }
        });

        await fileTransfer.upload(selected.path, remoteDest);
        setTransfers(prev => prev.filter(t => t.id !== transferId));
        remote.refresh();
      } else {
        // Download: remote → local
        const localDest = local.currentPath + '/' + selected.name;
        const transferId = Date.now();
        setTransfers(prev => [...prev, {
          id: transferId,
          type: 'download',
          filename: selected.name,
          percentage: 0,
          bytesTransferred: 0,
        }]);

        fileTransfer.on('progress', (event) => {
          if (event.type === 'download') {
            setTransfers(prev => prev.map(t =>
              t.id === transferId ? { ...t, ...event } : t
            ));
          }
        });

        await fileTransfer.download(selected.path, localDest);
        setTransfers(prev => prev.filter(t => t.id !== transferId));
        local.refresh();
      }
    } catch (err) {
      setTransfers(prev => prev.map(t => 
        (t.filename === selected.name) ? { ...t, error: err.message, percentage: 100 } : t
      ));
      
      // Auto-clear failed transfer after 4 seconds
      setTimeout(() => {
        setTransfers(prev => prev.filter(t => t.filename !== selected.name));
      }, 4000);
    }
  }, [activePanel, local, remote, fileTransfer]);

  return (
    <Box flexDirection="column" height="100%">
      {/* Title */}
      <Box paddingX={1}>
        <Text color={colors.primary} bold>{` ${icons.folder} File Explorer `}</Text>
      </Box>

      {/* Dual panels */}
      <Box flexGrow={1}>
        <LocalPanel
          entries={local.entries}
          selectedIndex={local.selectedIndex}
          currentPath={local.currentPath}
          isFocused={activePanel === 'local'}
        />
        <RemotePanel
          entries={remote.entries}
          selectedIndex={remote.selectedIndex}
          currentPath={remote.currentPath}
          isFocused={activePanel === 'remote'}
          loading={remote.loading}
          error={remote.error}
        />
      </Box>

      {/* Transfer progress */}
      <TransferProgress transfers={transfers} />

      {/* Key hints */}
      <Box paddingX={1} gap={2}>
        <Text color={colors.textDim}>
          <Text color={colors.accent}>Tab</Text>{' Switch  '}
          <Text color={colors.accent}>↑↓</Text>{' Navigate  '}
          <Text color={colors.accent}>Enter</Text>{' Open  '}
          <Text color={colors.accent}>C</Text>{' Copy  '}
          <Text color={colors.accent}>R</Text>{' Refresh  '}
          <Text color={colors.accent}>Esc</Text>{' Back'}
        </Text>
      </Box>
    </Box>
  );
}
