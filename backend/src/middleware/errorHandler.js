/**
 * middleware/errorHandler.js — Central Express error handler
 *
 * Why centralised: All async route handlers must forward errors via next(err).
 * Having one handler ensures a consistent error shape (API_CONTRACT.md §Error Format)
 * across every endpoint, and prevents accidental exposure of stack traces
 * in production.
 *
 * To use from route handlers:
 *   next(err)                  — generic error
 *   next(createError(400, ..)) — or use the createHttpError helper below
 *
 * All errors must be forwarded; never send a response AND call next(err).
 */

import { ZodError } from 'zod';

/**
 * Constructs a structured HTTP error object that the central handler understands.
 *
 * @param {number} statusCode  HTTP status code
 * @param {string} code        Machine-readable error code (e.g. 'NOT_FOUND')
 * @param {string} message     Human-readable description
 * @returns {Error}
 */
export function createHttpError(statusCode, code, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/**
 * Express error-handling middleware (4-argument signature required by Express).
 * Must be registered LAST in app.js after all routes.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // ZodError from validation middleware — convert to 400 VALIDATION_ERROR
  if (err instanceof ZodError) {
    const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message },
    });
  }

  const statusCode = err.statusCode ?? 500;
  const code       = err.code       ?? 'INTERNAL_ERROR';
  const message    = err.message    ?? 'An unexpected error occurred';

  // Only log 5xx errors as server errors; 4xx are expected client errors
  if (statusCode >= 500) {
    console.error('[error]', err);
  }

  return res.status(statusCode).json({
    error: { code, message },
  });
}
