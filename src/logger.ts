const logLevel = process.env.PI_LOG_LEVEL as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | undefined;
const logFormat = process.env.PI_LOG_FORMAT as 'pretty' | 'json' | undefined;

const enabledLevels = logLevel ? new Set([logLevel]) : null;


function isEnabled(level: string): boolean {
  if (!enabledLevels) return false;
  return enabledLevels.has(level as any);
}

function makePrettyLogger(level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal') {
  return (...args: any[]) => {
    if (isEnabled(level)) {
      const method = level === 'fatal' ? 'error' : level;
      // @ts-ignore
      console[method](`[${level.toUpperCase()}]`, ...args);
    }
  };
}

function makeJsonLogger(level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal') {
  return (...args: any[]) => {
    if (isEnabled(level)) {
      const msg = args.length > 0 ? args[0] : undefined;
      const rest = args.slice(1);
      const entry: any = {
        timestamp: new Date().toISOString(),
        level: level,
        message: msg,
        ...(rest.length > 0 ? { meta: rest } : {}),
      };
      console.log(JSON.stringify(entry));
    }
  };
}

const noop = () => {};

const createLogger =
  logFormat === 'json'
    ? (level: string) => makeJsonLogger(level as any)
    : (level: string) => makePrettyLogger(level as any);

const logger = {
  trace: logLevel ? createLogger('trace') : noop,
  debug: logLevel ? createLogger('debug') : noop,
  info: logLevel ? createLogger('info') : noop,
  warn: logLevel ? createLogger('warn') : noop,
  error: logLevel ? createLogger('error') : noop,
  fatal: logLevel ? createLogger('fatal') : noop,
};

export { logger };


