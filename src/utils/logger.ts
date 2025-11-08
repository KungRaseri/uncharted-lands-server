/**
 * Logger Utility
 *
 * Centralized logging with different levels and structured output
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private readonly minLevel: LogLevel;

  constructor() {
    // Set log level from environment or default to INFO
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    this.minLevel = LogLevel[envLevel as keyof typeof LogLevel] ?? LogLevel.INFO;
  }

  /**
   * Format timestamp for logs
   */
  private timestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Format log message with context
   */
  private format(level: string, message: string, context?: LogContext): string {
    const parts = [`[${this.timestamp()}]`, `[${level}]`, message];

    if (context && Object.keys(context).length > 0) {
      parts.push(JSON.stringify(context));
    }

    return parts.join(' ');
  }

  /**
   * Log debug messages
   */
  debug(message: string, context?: LogContext): void {
    if (this.minLevel <= LogLevel.DEBUG) {
      console.debug(this.format('DEBUG', message, context));
    }
  }

  /**
   * Log info messages
   */
  info(message: string, context?: LogContext): void {
    if (this.minLevel <= LogLevel.INFO) {
      console.log(this.format('INFO', message, context));
    }
  }

  /**
   * Log warning messages
   */
  warn(message: string, context?: LogContext): void {
    if (this.minLevel <= LogLevel.WARN) {
      console.warn(this.format('WARN', message, context));
    }
  }

  /**
   * Log error messages
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    if (this.minLevel <= LogLevel.ERROR) {
      const errorContext = {
        ...context,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
      };
      console.error(this.format('ERROR', message, errorContext));
    }
  }
}

// Export singleton instance
export const logger = new Logger();
