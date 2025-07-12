/**
 * responseFormatter.ts
 * 
 * This utility provides standardized response formatting functions to ensure
 * consistent API responses across the application.
 * 
 * @author Cascade
 */

export const formatResponse = {
  success: (data: any, message?: string) => ({
    success: true,
    data,
    ...(message && { message })
  }),

  error: (error: string, message: string, details?: any) => ({
    success: false,
    error,
    message,
    ...(details && { details })
  })
};
