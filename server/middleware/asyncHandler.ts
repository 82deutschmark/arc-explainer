/**
 * asyncHandler.ts
 * 
 * A utility middleware that wraps Express route handlers to automatically catch rejected promises
 * and pass them to the next middleware (typically the error handler).
 * 
 * This eliminates the need for try/catch blocks in each route handler that performs async operations.
 * 
 * @author Cascade
 */

import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
