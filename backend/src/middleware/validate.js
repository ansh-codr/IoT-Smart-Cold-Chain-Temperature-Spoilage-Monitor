/**
 * middleware/validate.js — Zod validation middleware factory
 *
 * Why a factory: each route has a different schema. The factory pattern
 * keeps route files clean — they just call validate(schema) and get back
 * a standard Express middleware.
 *
 * Usage in a route:
 *   import { validate } from '../middleware/validate.js';
 *   import { ReadingSchema } from '../config/schemas.js';
 *
 *   router.post('/readings', validate(ReadingSchema), handler);
 *
 * On failure, ZodError is forwarded to next() and the central error handler
 * in errorHandler.js converts it to { error: { code, message } }.
 */

/**
 * @param {import('zod').ZodSchema} schema  Zod schema to validate against
 * @param {'body'|'query'|'params'} source  Which part of the request to validate
 * @returns {import('express').RequestHandler}
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    // parse() throws ZodError on failure; the errorHandler catches it
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      // Forward ZodError directly — errorHandler knows how to format it
      return next(result.error);
    }
    // Replace req[source] with the parsed (and coerced) value
    // so downstream handlers don't need to re-parse
    req[source] = result.data;
    return next();
  };
}
