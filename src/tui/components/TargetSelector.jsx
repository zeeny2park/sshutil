import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, icons } from '../theme.js';

/**
 * TargetSelector — scrollable list to pick a target
 */
export default function TargetSelector({ targets, onSelect, onCancel }) {
  const targetNames = Object.keys(targets);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex(prev => Math.min(targetNames.length - 1, prev + 1));
    } else if (key.return) {
      const name = targetNames[selectedIndex];
      if (name && onSelect) onSelect(name);
    } else if (key.escape || input === 'q') {
      if (onCancel) onCancel();
    }
  });

  if (targetNames.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color={colors.warning}>{icons.warning} No targets configured</Text>
        <Text color={colors.textDim}>Run `sshutil init` to create example config</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.primary} paddingX={1}>
      <Box paddingY={0} marginBottom={1}>
        <Text color={colors.primary} bold>{` ${icons.search} Select Target `}</Text>
      </Box>

      {targetNames.map((name, i) => {
        const target = targets[name];
        const isSelected = i === selectedIndex;
        const hops = target.hops;
        const lastHop = hops[hops.length - 1];

        return (
          <Box key={name} flexDirection="column">
            <Box>
              <Text
                color={isSelected ? colors.primary : colors.text}
                bold={isSelected}
                backgroundColor={isSelected ? colors.bgPanel : undefined}
              >
                {isSelected ? ' ▸ ' : '   '}
                {hops.length > 1 ? '🔗 ' : '🖥️ '}
                {name}
              </Text>
              <Text color={colors.textDim}>
                {`  ${lastHop.user}@${lastHop.host}`}
                {hops.length > 1 ? ` (${hops.length} hops)` : ''}
              </Text>
            </Box>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text color={colors.textDim}>
          <Text color={colors.accent}>↑↓</Text>{' Navigate  '}
          <Text color={colors.accent}>Enter</Text>{' Connect  '}
          <Text color={colors.accent}>Esc</Text>{' Back'}
        </Text>
      </Box>
    </Box>
  );
}
