type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMeta = Record<string, unknown>;

interface LogContext {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: LogMeta;
}

class JsonFormatter {
  static format(level: LogLevel, message: string, meta?: LogMeta): string {
    const context: LogContext = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
    };
    return JSON.stringify(context);
  }
}

class PrettyFormatter {
  private static colors: Record<LogLevel, (s: string) => string> = {
    debug: (s) => `\x1b[90m${s}\x1b[0m`, // gray
    info: (s) => s,
    warn: (s) => `\x1b[33m${s}\x1b[0m`, // yellow
    error: (s) => `\x1b[31m${s}\x1b[0m`, // red
  };

  static format(level: LogLevel, message: string): string {
    const colorize = this.colors[level] || ((s) => s);
    const prefix = level === 'info' ? '' : `[${level.toUpperCase()}] `;
    return colorize(prefix + message);
  }
}

function getLogLevel(): LogLevel {
  const envLevel = process.env.PICLAW_LOG_LEVEL?.toLowerCase();
  switch (envLevel) {
    case 'debug':
    case 'info':
    case 'warn':
    case 'error':
      return envLevel;
    default:
      return 'info'; // default
  }
}

function getLogFormat(): 'pretty' | 'json' {
  const format = process.env.PICLAW_LOG_FORMAT?.toLowerCase();
  return format === 'json' ? 'json' : 'pretty';
}

function shouldLog(level: LogLevel): boolean {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const currentLevel = getLogLevel();
  return levels.indexOf(level) >= levels.indexOf(currentLevel);
}

function formatMessage(level: LogLevel, message: string, meta?: LogMeta): string {
  const format = getLogFormat();
  if (format === 'json') {
    return JsonFormatter.format(level, message, meta);
  }
  return PrettyFormatter.format(level, message);
}

function logToConsole(level: LogLevel, message: string, meta?: LogMeta) {
  const formatted = formatMessage(level, message, meta);
  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'debug':
    case 'info':
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug: (message: string, meta?: LogMeta) => {
    if (shouldLog('debug')) {
      logToConsole('debug', message, meta);
    }
  },

  info: (message: string, meta?: LogMeta) => {
    if (shouldLog('info')) {
      logToConsole('info', message, meta);
    }
  },

  log: (message: string, meta?: LogMeta) => {
    if (shouldLog('info')) {
      logToConsole('info', message, meta);
    }
  },

  warn: (message: string, meta?: LogMeta) => {
    if (shouldLog('warn')) {
      logToConsole('warn', message, meta);
    }
  },

  error: (message: string, meta?: LogMeta) => {
    if (shouldLog('error')) {
      logToConsole('error', message, meta);
    }
  },
};
