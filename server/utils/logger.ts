/**
 * Simple logger utility
 * @author Cascade
 * 
 * Provides consistent logging across the application
 */

/**
 * Log levels for different severity of messages
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Simple logger that wraps console methods with additional context
 */
export const logger = {
  /**
   * Log informational message
   */
  info: (message: string, context: string = 'app') => {
    console.log(`[INFO][${context}] ${message}`);
  },
  
  /**
   * Log warning message
   */
  warn: (message: string, context: string = 'app') => {
    console.warn(`[WARN][${context}] ${message}`);
  },
  
  /**
   * Log error message
   */
  error: (message: string, context: string = 'app') => {
    console.error(`[ERROR][${context}] ${message}`);
  },
  
  /**
   * Log debug message (only in development)
   */
  debug: (message: string, context: string = 'app') => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG][${context}] ${message}`);
    }
  }
};
