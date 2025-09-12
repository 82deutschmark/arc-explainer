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
  // Extract enhanced error metadata if available
  const statusCode = (error as any).statusCode || 500;
  const provider = (error as any).provider;
  const modelKey = (error as any).modelKey;

  // Log error details for debugging (structured logging)
  console.error('Request failed:', {
    url: req.url,
    method: req.method,
    error: error.message,
    statusCode,
    provider,
    modelKey
  });

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.errorCode || 'APPLICATION_ERROR',
      message: error.message
    });
  }

  // Enhanced error handling for AI provider errors
  if (provider && modelKey) {
    return res.status(statusCode).json({
      success: false,
      error: 'MODEL_UNAVAILABLE',
      message: error.message, // Already user-friendly from provider service
      provider,
      modelKey,
      retryable: statusCode === 429 || statusCode >= 500
    });
  }

  // Handle specific HTTP status codes with user-friendly messages
  let userMessage = 'An unexpected error occurred';
  let errorCode = 'INTERNAL_SERVER_ERROR';

  if (statusCode === 400) {
    userMessage = 'Invalid request parameters';
    errorCode = 'BAD_REQUEST';
  } else if (statusCode === 404) {
    userMessage = 'Requested resource not found';
    errorCode = 'NOT_FOUND';
  } else if (statusCode === 429) {
    userMessage = 'Too many requests. Please try again later';
    errorCode = 'RATE_LIMITED';
  } else if (statusCode >= 500 && statusCode < 600) {
    userMessage = 'Server temporarily unavailable. Please try again';
    errorCode = 'SERVICE_UNAVAILABLE';
  }

  res.status(statusCode).json({
    success: false,
    error: errorCode,
    message: userMessage
  });
};
