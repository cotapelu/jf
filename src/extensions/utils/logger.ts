#!/usr/bin/env node

/**
 * Simple Logger for Extensions
 *
 * Lightweight wrapper around console.log/error/warn.
 * Avoids dependency on external logging library.
 */

// type LogLevel = 'log' | 'error' | 'warn' | 'info' | 'debug'; // unused

interface Logger {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

/**
 * Create a logger instance.
 * Can prefix messages with a tag for easier filtering.
 */
export function createLogger(tag?: string): Logger {
  const prefix = tag ? `[${tag}]` : '';
  return {
    log: (...args: any[]) => { if (prefix) console.log(prefix, ...args); else console.log(...args); },
    error: (...args: any[]) => { if (prefix) console.error(prefix, ...args); else console.error(...args); },
    warn: (...args: any[]) => { if (prefix) console.warn(prefix, ...args); else console.warn(...args); },
    info: (...args: any[]) => { if (prefix) console.info(prefix, ...args); else console.info(...args); },
    debug: (...args: any[]) => { if (prefix) console.debug(prefix, ...args); else console.debug(...args); }
  };
}

// Default logger without prefix
export const logger = createLogger();
