import { zValidator } from '@hono/zod-validator';
import type { ZodType } from 'zod';
import { AppError } from './errors';

type Target = 'json' | 'query' | 'param' | 'header';

/** Zod validation that fails with the standard VALIDATION_ERROR envelope (docs/API.md §0). */
export function validate<T extends ZodType, Where extends Target>(target: Where, schema: T) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', {
        details: result.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      });
    }
  });
}
