const logLevel = process.env.PI_LOG_LEVEL as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | undefined;

const enabledLevels = logLevel ? new Set([logLevel]) : null;

function isEnabled(level: string): boolean {
  if (!enabledLevels) return false;
  return enabledLevels.has(level as any);
}

function makeLogger(level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal') {
  return (...args: any[]) => {
    if (isEnabled(level)) {
      switch (level) {
        case 'trace':
          console.trace(...args);
          break;
        case 'debug':
          console.debug(...args);
          break;
        case 'info':
          console.info(...args);
          break;
        case 'warn':
          console.warn(...args);
          break;
        case 'error':
          console.error(...args);
          break;
        case 'fatal':
          console.error(...args);
          break;
      }
    }
  };
}

const noop = () => {};

const logger = {
  trace: logLevel ? makeLogger('trace') : noop,
  debug: logLevel ? makeLogger('debug') : noop,
  info: logLevel ? makeLogger('info') : noop,
  warn: logLevel ? makeLogger('warn') : noop,
  error: logLevel ? makeLogger('error') : noop,
  fatal: logLevel ? makeLogger('fatal') : noop,
};

export { logger };


