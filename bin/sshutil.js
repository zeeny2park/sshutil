#!/usr/bin/env node

// Direct ESM entry — no babel needed for CLI mode.
// TUI mode uses dynamic import which will handle JSX via babel register.

import('../src/index.js').catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
