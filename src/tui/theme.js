/**
 * TUI Theme — Cyberpunk-inspired dark theme
 */

export const colors = {
  // Primary palette
  primary: '#00D4FF',       // Electric cyan
  primaryDim: '#0099BB',
  secondary: '#FF6B9D',     // Hot pink
  accent: '#FFD93D',        // Warm gold

  // Status colors
  success: '#00E676',       // Bright green
  warning: '#FFB300',       // Amber
  error: '#FF5252',         // Red
  info: '#448AFF',          // Blue

  // Neutral palette
  bg: '#0A0E17',            // Deep dark blue
  bgLight: '#141B2D',       // Slightly lighter bg
  bgPanel: '#1A2236',       // Panel background
  border: '#2D3A52',        // Border color
  borderFocus: '#00D4FF',   // Focused border

  // Text colors
  text: '#E0E6F0',          // Primary text
  textDim: '#6B7A99',       // Dimmed text
  textMuted: '#3D4F6F',     // Muted text

  // File types
  directory: '#00D4FF',
  file: '#E0E6F0',
  symlink: '#FF6B9D',
  executable: '#00E676',
};

export const icons = {
  // Status
  connected: '●',
  disconnected: '○',
  connecting: '◐',
  error: '✗',
  success: '✓',
  warning: '⚠',

  // Navigation
  arrowRight: '→',
  arrowLeft: '←',
  arrowUp: '↑',
  arrowDown: '↓',

  // Files
  folder: '📁',
  folderOpen: '📂',
  file: '📄',
  fileCode: '📝',
  fileLock: '🔒',

  // Actions
  upload: '⬆',
  download: '⬇',
  refresh: '⟳',
  search: '🔍',
  terminal: '💻',
  settings: '⚙',

  // Borders
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  teeRight: '├',
  teeLeft: '┤',
  cross: '┼',

  // Box drawing (heavy)
  hTopLeft: '╔',
  hTopRight: '╗',
  hBottomLeft: '╚',
  hBottomRight: '╝',
  hHorizontal: '═',
  hVertical: '║',
};

export const borders = {
  single: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    top: '─',
    bottom: '─',
    left: '│',
    right: '│',
  },
  double: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    top: '═',
    bottom: '═',
    left: '║',
    right: '║',
  },
  round: {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    top: '─',
    bottom: '─',
    left: '│',
    right: '│',
  },
};

export const keyBindings = {
  quit: { key: 'q', ctrl: false, label: 'Q' },
  quitForce: { key: 'c', ctrl: true, label: 'Ctrl+C' },
  back: { key: 'escape', label: 'Esc' },

  connect: { key: 'c', label: 'C' },
  files: { key: 'f', label: 'F' },
  exec: { key: 'e', label: 'E' },

  tabSwitch: { key: 'tab', label: 'Tab' },
  enter: { key: 'return', label: 'Enter' },

  navUp: { key: 'upArrow', label: '↑' },
  navDown: { key: 'downArrow', label: '↓' },
};

export default { colors, icons, borders, keyBindings };
