import React from 'react';
import { Box, Text } from 'ink';
import { colors, icons } from '../theme.js';

/**
 * TransferProgress — shows file transfer progress
 */
export default function TransferProgress({ transfers }) {
  if (!transfers || transfers.length === 0) return null;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.accent} paddingX={1}>
      <Text color={colors.accent} bold>{` ${icons.refresh} Active Transfers `}</Text>

      {transfers.map((t, i) => {
        const icon = t.type === 'download' ? icons.download : icons.upload;
        const barWidth = 20;
        const filled = Math.round((t.percentage / 100) * barWidth);
        const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

        return (
          <Box key={i} gap={1}>
            <Text color={t.type === 'download' ? colors.info : colors.secondary}>
              {icon}
            </Text>
            <Text color={colors.text}>{t.filename || 'file'}</Text>
            {t.error ? (
              <Text color={colors.error} bold> ✗ {t.error}</Text>
            ) : (
              <>
                <Text color={colors.success}>[{bar}]</Text>
                <Text color={colors.accent}>{t.percentage}%</Text>
                <Text color={colors.textDim}>({formatSize(t.bytesTransferred)})</Text>
              </>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
