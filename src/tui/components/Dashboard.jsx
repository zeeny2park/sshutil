import React from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, icons } from '../theme.js';
import sessionManager from '../../core/SessionManager.js';

/**
 * Dashboard — main TUI screen showing targets and sessions
 */
export default function Dashboard({
  targets,
  sessions,
  status,
  onConnect,
  onFiles,
  onTerminal,
  onExec,
  onQuit,
  error,
}) {
  useInput((input, key) => {
    if (input === 'c' || input === 'C') {
      if (onConnect) onConnect();
    } else if (input === 'f' || input === 'F') {
      if (onFiles) onFiles();
    } else if (input === 't' || input === 'T') {
      if (onTerminal) onTerminal();
    } else if (input === 'e' || input === 'E') {
      if (onExec) onExec();
    } else if (input === 'q' || input === 'Q') {
      if (onQuit) onQuit();
    }
  });

  const targetNames = Object.keys(targets || {});
  const activeSessions = sessions || [];

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box
        borderStyle="double"
        borderColor={colors.primary}
        paddingX={2}
        justifyContent="center"
      >
        <Text color={colors.primary} bold>
          {` ❖  SSHUtil — Multi-Hop SSH Manager  ❖ `}
        </Text>
      </Box>

      {/* Main content */}
      <Box flexGrow={1} gap={1}>
        {/* Left: Targets */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={colors.border}
          width="55%"
          paddingX={1}
        >
          <Text color={colors.primary} bold>{` ⛭ Targets `}</Text>
          <Text color={colors.textMuted}>{'─'.repeat(30)}</Text>

          {targetNames.length === 0 ? (
            <Box flexDirection="column" paddingY={1}>
              <Text color={colors.warning}>{icons.warning} No targets configured</Text>
              <Text color={colors.textDim}>Run `sshutil init` to create config</Text>
            </Box>
          ) : (
            targetNames.map((name) => {
              const target = targets[name];
              const hops = target.hops;
              const lastHop = hops[hops.length - 1];
              const isActive = activeSessions.some(s => s.target === name && s.status === 'active');
              const hopIcon = hops.length > 1 ? '◈' : '◉';

              return (
                <Box key={name} flexDirection="column" marginY={0}>
                  <Box>
                    <Text wrap="truncate">
                      <Text color={isActive ? colors.success : colors.textDim}>
                        {isActive ? icons.connected : icons.disconnected}
                      </Text>{' '}
                      <Text color={colors.text} bold>{hopIcon} {name}</Text>{'  '}
                      <Text color={colors.textDim}>
                        {lastHop.user}@{lastHop.host}
                      </Text>
                    </Text>
                  </Box>
                  {hops.length > 1 && (
                    <Box paddingLeft={4}>
                      <Text color={colors.textMuted} wrap="truncate">
                        ↳ {hops.length} hops: {hops.map(h => h.host).join(' → ')}
                      </Text>
                    </Box>
                  )}
                </Box>
              );
            })
          )}
        </Box>

        {/* Right: Sessions */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={colors.border}
          width="45%"
          paddingX={1}
        >
          <Text color={colors.success} bold>{` ${icons.connected} Active Sessions `}</Text>
          <Text color={colors.textMuted}>{'─'.repeat(25)}</Text>

          {activeSessions.length === 0 ? (
            <Text color={colors.textDim} italic>No active sessions</Text>
          ) : (
            activeSessions.map((session, i) => (
              <Box key={session.id} gap={1}>
                <Text color={colors.success}>{icons.connected}</Text>
                <Text color={colors.text}>{session.target}</Text>
                <Text color={colors.textDim}>({session.duration})</Text>
              </Box>
            ))
          )}
        </Box>
      </Box>

      {/* Error display */}
      {error && (
        <Box borderStyle="round" borderColor={colors.error} paddingX={1}>
          <Text color={colors.error}>{icons.error} {error}</Text>
        </Box>
      )}

      {/* Action bar */}
      <Box
        borderStyle="round"
        borderColor={colors.border}
        paddingX={1}
        justifyContent="center"
        gap={2}
      >
        <Text>
          <Text color={colors.accent} bold>[C]</Text>
          <Text color={colors.text}>onnect</Text>
        </Text>
        <Text>
          <Text color={colors.accent} bold>[T]</Text>
          <Text color={colors.text}>erminal</Text>
        </Text>
        <Text>
          <Text color={colors.accent} bold>[F]</Text>
          <Text color={colors.text}>iles</Text>
        </Text>
        <Text>
          <Text color={colors.accent} bold>[E]</Text>
          <Text color={colors.text}>xec</Text>
        </Text>
        <Text>
          <Text color={colors.error} bold>[Q]</Text>
          <Text color={colors.text}>uit</Text>
        </Text>
      </Box>
    </Box>
  );
}
