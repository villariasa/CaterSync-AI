/**
 * CaterSync AI — Socket.IO Server Logger
 * Color-coded structured logger with timestamps and log levels.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const COLORS = {
  debug: '\x1b[36m',  // cyan
  info:  '\x1b[32m',  // green
  warn:  '\x1b[33m',  // yellow
  error: '\x1b[31m',  // red
  reset: '\x1b[0m'
};

const LOG_LEVEL = LEVELS[process.env.SOCKET_LOG_LEVEL] ?? LEVELS.info;

function log(level, ...args) {
  if (LEVELS[level] < LOG_LEVEL) return;
  const ts = new Date().toISOString();
  const color = COLORS[level] || '';
  const prefix = `${color}[SOCKET:${level.toUpperCase()}]${COLORS.reset} ${ts}`;
  if (level === 'error') console.error(prefix, ...args);
  else if (level === 'warn') console.warn(prefix, ...args);
  else console.log(prefix, ...args);
}

export const logger = {
  debug: (...a) => log('debug', ...a),
  info:  (...a) => log('info',  ...a),
  warn:  (...a) => log('warn',  ...a),
  error: (...a) => log('error', ...a),
};
