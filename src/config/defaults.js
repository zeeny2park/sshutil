// Default configuration values

export const DEFAULTS = {
  ssh: {
    port: 22,
    readyTimeout: 20000,        // 20s to establish connection
    keepaliveInterval: 10000,    // 10s keepalive
    keepaliveCountMax: 3,
  },
  hop: {
    commandTimeout: 15000,       // 15s for intermediate commands
    promptTimeout: 10000,        // 10s to wait for prompt
    retryAttempts: 2,
    retryDelay: 3000,            // 3s between retries
  },
  transfer: {
    chunkSize: 64 * 1024,        // 64KB chunks
    progressInterval: 500,       // 500ms progress update interval
  },
  tui: {
    refreshInterval: 100,        // 100ms render interval
  },
  configDir: '.sshutil',
  configFile: 'targets.yaml',
};

// Default prompt patterns for expect-like matching
export const PROMPT_PATTERNS = [
  /\$\s*$/,                      // bash $ prompt
  /#\s*$/,                       // root # prompt
  />\s*$/,                       // generic > prompt
  /password:\s*$/i,              // password prompt
  /Password:\s*$/,               // Password prompt (case-sensitive)
  /\]\$\s*$/,                    // [user@host ~]$ prompt
  /\]#\s*$/,                     // [root@host ~]# prompt
];
