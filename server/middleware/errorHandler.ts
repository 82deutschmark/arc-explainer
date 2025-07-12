/**
 * errorHandler.ts
 * 
 * Centralized error handling middleware for the Express application.
 * This provides consistent error responses across all API endpoints and
 * logs errors for debugging purposes.
 * 
 * The AppError class allows for custom error objects with status codes
 * and error codes to provide more context to the client.
 * 
 * @author Cascade
 */

import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public message: string, 
    public statusCode: number = 500,
    public errorCode?: string
  ) {
    super(message);
  }
}

export const errorHandler = (
  error: Error, 
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  console.error('Request failed:', {
    url: req.url,
    method: req.method,
    error: error.message
  });

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.errorCode || 'APPLICATION_ERROR',
      message: error.message
    });
  }

  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred'
  });
};
