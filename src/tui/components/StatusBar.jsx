import React from 'react';
import { Box, Text } from 'ink';
import { colors, icons } from '../theme.js';

/**
 * StatusBar — shows at the bottom of the screen
 * Displays connection status, session info, and key hints
 */
export default function StatusBar({ mode, status, sessionCount, targetName, keyHints }) {
  const statusIcon = {
    connected: { icon: icons.connected, color: colors.success, label: 'Connected' },
    connecting: { icon: icons.connecting, color: colors.warning, label: 'Connecting...' },
    disconnected: { icon: icons.disconnected, color: colors.textDim, label: 'Disconnected' },
    error: { icon: icons.error, color: colors.error, label: 'Error' },
  }[status] || { icon: icons.disconnected, color: colors.textDim, label: status };

  const modeLabel = {
    dashboard: 'Dashboard',
    terminal: 'Terminal',
    files: 'File Explorer',
  }[mode] || mode;

  return (
    <Box
      borderStyle="single"
      borderColor={colors.border}
      paddingX={1}
      justifyContent="space-between"
    >
      {/* Left: Mode + Status */}
      <Box gap={2}>
        <Text color={colors.primary} bold>{`⌘ ${modeLabel}`}</Text>
        <Text color={statusIcon.color}>
          {`${statusIcon.icon} ${statusIcon.label}`}
          {targetName ? ` (${targetName})` : ''}
        </Text>
        {sessionCount > 0 && (
          <Text color={colors.textDim}>{`Sessions: ${sessionCount}`}</Text>
        )}
      </Box>

      {/* Right: Key hints */}
      <Box gap={1}>
        {(keyHints || []).map((hint, i) => (
          <Text key={i} color={colors.textDim}>
            <Text color={colors.accent}>{hint.key}</Text>
            {` ${hint.label}`}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
