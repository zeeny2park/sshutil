import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { colors, icons } from '../theme.js';

const COMMANDS = [
  { name: 'Connect', key: 'c', description: 'Connect to a target', action: 'connect' },
  { name: 'File Explorer', key: 'f', description: 'Open file browser', action: 'files' },
  { name: 'Terminal', key: 't', description: 'Open interactive terminal', action: 'terminal' },
  { name: 'Execute', key: 'e', description: 'Execute remote command', action: 'exec' },
  { name: 'Disconnect', key: 'd', description: 'Disconnect current session', action: 'disconnect' },
  { name: 'Refresh', key: 'r', description: 'Refresh current view', action: 'refresh' },
  { name: 'Help', key: '?', description: 'Show help', action: 'help' },
  { name: 'Quit', key: 'q', description: 'Exit application', action: 'quit' },
];

