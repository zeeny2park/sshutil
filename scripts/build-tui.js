import { build } from 'esbuild';

await build({
  entryPoints: ['src/tui/App.jsx'],
  bundle: true,
  outfile: 'dist/tui.js',
  format: 'esm',
  platform: 'node',
  target: 'node18',
  jsx: 'automatic',
  loader: { '.jsx': 'jsx', '.js': 'js' },
  // External: keep node_modules as external (don't bundle them)
  external: [
    'ink',
    'ink-spinner',
    'ink-text-input',
    'react',
    'react/jsx-runtime',
    'ssh2',
    'js-yaml',
    'chalk',
    'winston',
    'yargs',
    'yargs/helpers',
    'fs',
    'path',
    'os',
    'events',
    'crypto',
    'node:*',
  ],
  banner: {
    js: '// SSHUtil TUI — Auto-generated, do not edit\n',
  },
});

console.log('✓ TUI built → dist/tui.js');
