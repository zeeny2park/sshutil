import chalk from 'chalk';

/**
 * CLI output formatters
 */

export function formatTargetList(targets) {
  if (Object.keys(targets).length === 0) {
    return chalk.yellow('No targets configured. Run: sshutil init');
  }

  let output = chalk.bold.cyan('\n  📡 Configured Targets\n');
  output += chalk.gray('  ─'.repeat(25)) + '\n';

  for (const [name, config] of Object.entries(targets)) {
    const hops = config.hops;
    const lastHop = hops[hops.length - 1];
    const icon = hops.length > 1 ? '🔗' : '🖥️';

    output += `\n  ${icon} ${chalk.bold.white(name)}\n`;
    
    hops.forEach((hop, i) => {
      const isLast = i === hops.length - 1;
      const prefix = isLast ? '  └─' : '  ├─';
      const authIcon = hop.auth?.type === 'privateKey' ? '🔑' : '🔒';
      const cmdCount = hop.commands?.length || 0;
      const cmdInfo = cmdCount > 0 ? chalk.yellow(` [${cmdCount} cmd]`) : '';

      output += `  ${chalk.gray(prefix)} ${authIcon} ${chalk.green(hop.user)}@${chalk.white(hop.host)}:${chalk.gray(hop.port)}${cmdInfo}\n`;
    });
  }

  output += '\n';
  return output;
}

export function formatConnectionProgress(event) {
  const { message, current, total } = event;
  const bar = current && total
    ? ` [${'█'.repeat(current)}${'░'.repeat(total - current)}]`
    : '';
  return `${chalk.cyan('⟳')} ${message}${chalk.gray(bar)}`;
}

export function formatSuccess(message) {
  return `${chalk.green('✓')} ${message}`;
}

export function formatError(message) {
  return `${chalk.red('✗')} ${message}`;
}

export function formatWarning(message) {
  return `${chalk.yellow('⚠')} ${message}`;
}

export function formatTransferProgress(event) {
  const { type, bytesTransferred, totalBytes, percentage } = event;
  const icon = type === 'download' ? '⬇' : '⬆';
  const sizeStr = formatBytes(bytesTransferred);
  const totalStr = totalBytes > 0 ? ` / ${formatBytes(totalBytes)}` : '';
  
  const barWidth = 30;
  const filled = Math.round((percentage / 100) * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

  return `${chalk.cyan(icon)} [${chalk.green(bar)}] ${percentage}% ${chalk.gray(`(${sizeStr}${totalStr})`)}`;
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const secs = (ms / 1000).toFixed(1);
  return `${secs}s`;
}
