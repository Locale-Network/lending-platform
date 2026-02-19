/**
 * Structured Logging Utility
 *
 * Uses Pino for lightweight, high-performance structured logging.
 * Outputs JSON for easy integration with log aggregators (Vercel, DataDog, etc.)
 *
 * Features:
 * - JSON output for Vercel/cloud log aggregation
 * - Log levels: debug, info, warn, error
 * - Context support (userId, loanId, etc.)
 * - Correlation IDs for request tracing
 * - Child logger creation for scoped logging
 */

import pino from 'pino';

// Configure based on environment
const isDevelopment = process.env.NODE_ENV === 'development';

// Create base logger
// Note: pino-pretty transport uses worker threads which crash with Next.js Turbopack.
// We disable transport in development to avoid "worker has exited" errors.
// This means logs will be JSON in dev, but you can pipe to pino-pretty manually if needed:
//   npm run dev 2>&1 | npx pino-pretty
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  // Disable worker-based transport to avoid Turbopack crashes
  // Logs are still functional, just not pretty-printed
  transport: undefined,

  // Base fields included in every log
  base: {
    env: process.env.NODE_ENV,
  },

  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'token',
      'apiKey',
      'secret',
      'privateKey',
      'authorization',
      'cookie',
      'accessToken',
      'refreshToken',
      '*.password',
      '*.token',
      '*.apiKey',
      '*.secret',
      '*.privateKey',
    ],
    censor: '[REDACTED]',
  },

  // Timestamp format for production
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger with additional context
 *
 * @example
 * const log = createLogger({ module: 'circle-webhook', paymentId: '123' });
 * log.info('Processing payment');
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Create a request-scoped logger with correlation ID
 *
 * @example
 * const log = createRequestLogger(request);
 * log.info('Handling request');
 */
export function createRequestLogger(
  request: Request,
  additionalContext?: Record<string, unknown>
) {
  // Extract or generate correlation ID
  const correlationId =
    request.headers.get('x-correlation-id') ||
    request.headers.get('x-request-id') ||
    generateCorrelationId();

  // Extract useful request metadata
  const url = new URL(request.url);

  return logger.child({
    correlationId,
    method: request.method,
    path: url.pathname,
    ...additionalContext,
  });
}

/**
 * Generate a correlation ID for request tracing
 */
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Named loggers for specific modules
export const webhookLogger = createLogger({ module: 'webhook' });
export const cronLogger = createLogger({ module: 'cron' });
export const contractLogger = createLogger({ module: 'contract' });
export const authLogger = createLogger({ module: 'auth' });
export const paymentLogger = createLogger({ module: 'payment' });

/**
 * Log levels reference:
 *
 * - debug: Detailed debugging information (only in development)
 * - info: General operational messages
 * - warn: Warning conditions that should be reviewed
 * - error: Error conditions that need attention
 *
 * @example
 * logger.debug({ data }, 'Debug message');
 * logger.info({ userId }, 'User logged in');
 * logger.warn({ threshold }, 'Rate limit approaching');
 * logger.error({ err }, 'Payment failed');
 */

export default logger;
