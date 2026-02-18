/**
 * Request Logging Utility
 * 
 * Provides structured logging for API requests and responses.
 * In production, consider integrating with a logging service (e.g., Sentry, LogRocket, etc.)
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  ip?: string;
  userAgent?: string;
}

class Logger {
  private get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  }

  private get isDevelopment(): boolean {
    return process.env.NODE_ENV === "development";
  }

  private formatLog(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level}]`,
      entry.message,
    ];

    if (entry.requestId) {
      parts.push(`[req:${entry.requestId}]`);
    }

    if (entry.method && entry.path) {
      parts.push(`${entry.method} ${entry.path}`);
    }

    if (entry.statusCode) {
      parts.push(`[${entry.statusCode}]`);
    }

    if (entry.duration !== undefined) {
      parts.push(`[${entry.duration}ms]`);
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      parts.push(JSON.stringify(entry.metadata));
    }

    return parts.join(" ");
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata,
    };

    const formatted = this.formatLog(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.DEBUG:
        if (this.isDevelopment) {
          console.debug(formatted);
        }
        break;
      default:
        console.log(formatted);
    }

    // In production, you might want to send logs to an external service
    if (this.isProduction && level === LogLevel.ERROR) {
      // Example: Send to error tracking service
      // errorTrackingService.captureException(new Error(message), { extra: metadata });
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  /**
   * Log an API request
   */
  logRequest(
    request: Request,
    response: Response,
    duration: number,
    requestId?: string
  ): void {
    const url = new URL(request.url);
    const metadata: Record<string, unknown> = {
      method: request.method,
      path: url.pathname,
      statusCode: response.status,
      duration,
    };

    // Get client IP
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const cfConnectingIp = request.headers.get("cf-connecting-ip");
    const ip = forwarded?.split(",")[0]?.trim() || realIp || cfConnectingIp;
    if (ip) {
      metadata.ip = ip;
    }

    // Get user agent
    const userAgent = request.headers.get("user-agent");
    if (userAgent) {
      metadata.userAgent = userAgent;
    }

    const level = response.status >= 500
      ? LogLevel.ERROR
      : response.status >= 400
      ? LogLevel.WARN
      : LogLevel.INFO;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: "API Request",
      metadata,
      requestId,
      method: request.method,
      path: url.pathname,
      statusCode: response.status,
      duration,
      ip: ip || undefined,
      userAgent: userAgent || undefined,
    };

    const formatted = this.formatLog(entry);

    if (level === LogLevel.ERROR) {
      console.error(formatted);
    } else if (level === LogLevel.WARN) {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  /**
   * Log an error with context
   * SECURITY: Sanitizes error details in production to prevent information disclosure
   */
  logError(
    error: Error | unknown,
    context?: Record<string, unknown>
  ): void {
    const message = error instanceof Error ? error.message : String(error);
    
    // Sanitize error details for production
    const errorInfo = error instanceof Error
      ? {
          name: error.name,
          message: this.sanitizeErrorMessage(error.message),
          // Only include stack trace in development
          ...(this.isDevelopment && { stack: error.stack }),
        }
      : this.sanitizeErrorMessage(String(error));
    
    const metadata: Record<string, unknown> = {
      ...context,
      error: errorInfo,
    };

    this.error(this.sanitizeErrorMessage(message), metadata);
  }

  /**
   * Sanitize error messages to remove potentially sensitive information
   */
  private sanitizeErrorMessage(message: string): string {
    if (!message) return "Unknown error";
    
    // Remove potential secrets, tokens, and API keys from error messages
    return message
      // Remove Bearer tokens
      .replace(/Bearer\s+[A-Za-z0-9\-_]+/gi, "Bearer [REDACTED]")
      // Remove API keys (common patterns)
      .replace(/[A-Za-z0-9_-]{20,}/g, (match) => {
        // Preserve common non-sensitive identifiers
        if (/^(firebase|google|github|discord)/i.test(match)) {
          return match;
        }
        return "[REDACTED]";
      })
      // Remove email addresses
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_REDACTED]")
      // Remove file paths that might expose server structure
      .replace(/\/Users\/[^\/\s]+/g, "/Users/[REDACTED]")
      .replace(/\/home\/[^\/\s]+/g, "/home/[REDACTED]");
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * Safe error logging function for API routes.
 * Use this instead of console.error to ensure proper sanitization.
 */
export function logApiError(endpoint: string, error: unknown): void {
  logger.logError(error, { endpoint });
}

/**
 * Middleware to add request logging to API routes
 */
export function withLogging(
  handler: (request: Request) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      const response = await handler(request);
      const duration = Date.now() - startTime;
      logger.logRequest(request, response, duration, requestId);
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logError(error, {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        duration,
      });

      // Return error response
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          requestId,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
          },
        }
      );
    }
  };
}
