type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let minLevel: Level = 'info';

export function setLogLevel(level: Level) {
  minLevel = level;
}

function write(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  if (ORDER[level] < ORDER[minLevel]) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields });
  // One JSON object per line: captured by the cPanel app log, PM2 or journald.
  if (level === 'error' || level === 'warn') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

/** Structured JSON logger. Never pass passwords, tokens or full card/PII data in `fields`. */
export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => write('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => write('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write('error', msg, fields),
};
