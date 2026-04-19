import React from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, icons } from '../theme.js';

/**
 * LocalPanel — shows local file system in a panel
 */
export default function LocalPanel({ entries, selectedIndex, currentPath, isFocused, onNavigate }) {
  // Visible window (scroll)
  const maxVisible = (process.stdout.rows || 24) - 10;
  const startIdx = Math.max(0, selectedIndex - Math.floor(maxVisible / 2));
  const visibleEntries = entries.slice(startIdx, startIdx + maxVisible);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? colors.borderFocus : colors.border}
      flexGrow={1}
      flexBasis="50%"
    >
      {/* Header */}
      <Box paddingX={1} justifyContent="space-between">
        <Text color={isFocused ? colors.primary : colors.textDim} bold>
          {` ${icons.folder} Local `}
        </Text>
        <Text color={colors.textDim} wrap="truncate">
          {truncatePath(currentPath, 25)}
        </Text>
      </Box>

      {/* File list */}
      <Box flexDirection="column" paddingX={1}>
        {visibleEntries.map((entry, i) => {
          const realIdx = startIdx + i;
          const isSelected = realIdx === selectedIndex && isFocused;
          const entryIcon = entry.isParent ? icons.arrowUp 
            : entry.isDirectory ? icons.folder 
            : icons.file;
          const nameColor = entry.isDirectory ? colors.directory : colors.file;

          return (
            <Box key={realIdx} gap={1}>
              <Text
                backgroundColor={isSelected ? colors.bgPanel : undefined}
                color={isSelected ? colors.primary : nameColor}
                bold={isSelected}
              >
                {isSelected ? '▸' : ' '} {entryIcon} {entry.name}
              </Text>
              {!entry.isDirectory && (
                <Text color={colors.textDim}>{formatSize(entry.size)}</Text>
              )}
            </Box>
          );
        })}

        {entries.length === 0 && (
          <Text color={colors.textDim}>(empty)</Text>
        )}
      </Box>

      {/* Footer */}
      <Box paddingX={1}>
        <Text color={colors.textMuted}>
          {entries.length} items
        </Text>
      </Box>
    </Box>
  );
}

function truncatePath(p, maxLen) {
  if (!p) return '';
  if (p.length <= maxLen) return p;
  return '...' + p.slice(-(maxLen - 3));
}

function formatSize(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(0)}${units[i]}`;
}
