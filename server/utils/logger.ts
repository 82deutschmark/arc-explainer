/**
 * @file server/utils/logger.ts
 * @description An enhanced, centralized logging utility for the application.
 *
 * This module provides a singleton `logger` object that wraps standard `console` methods.
 * It is designed to consolidate all logging throughout the application, ensuring consistent formatting
 * and providing contextual information. Its features include:
 *  - Standard logging levels (info, warn, error, debug).
 *  - Structured error logging with support for error objects and metadata.
 *  - Contextual logging for different parts of the application (e.g., services, file operations).
 *  - Specialized formatters for API responses and token usage.
 *
 * @assessed_by Gemini 2.5 Pro
 * @assessed_on 2025-09-09
 */

/**
 * Log levels for different severity of messages
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Structured error logging options
 */
export interface ErrorLogOptions {
  error?: Error | any;
  context?: string;
  metadata?: Record<string, any>;
  stackTrace?: boolean;
}

/**
 * Determine minimum log level based on environment
 */
const getMinLogLevel = (): LogLevel => {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
  if (envLevel && ['error', 'warn', 'info', 'debug'].includes(envLevel)) {
    return envLevel;
  }
  
  // Default log levels by environment
  if (process.env.NODE_ENV === 'production') {
    return 'warn'; // Only warnings and errors in production
  } else if (process.env.NODE_ENV === 'test') {
    return 'error'; // Only errors during testing
  }
  return 'info'; // Info and above in development
};

const MIN_LOG_LEVEL = getMinLogLevel();
const LOG_LEVEL_PRIORITY = { error: 3, warn: 2, info: 1, debug: 0 };

/**
 * Check if message should be logged based on current log level
 */
const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LOG_LEVEL];
};

/**
 * Truncate long messages to prevent console spam
 */
const truncateMessage = (message: string, maxLength: number = 500): string => {
  if (message.length <= maxLength) return message;
  return `${message.substring(0, maxLength)}... [truncated ${message.length - maxLength} chars]`;
};

/**
 * Enhanced logger that wraps console methods with additional context and error handling
 */
export const logger = {
  /**
   * Log informational message
   */
  info: (message: string, context: string = 'app') => {
    if (shouldLog('info')) {
      console.log(`[INFO][${context}] ${truncateMessage(message)}`);
    }
  },
  
  /**
   * Log warning message
   */
  warn: (message: string, context: string = 'app') => {
    if (shouldLog('warn')) {
      console.warn(`[WARN][${context}] ${truncateMessage(message)}`);
    }
  },
  
  /**
   * Log error message
   */
  error: (message: string, context: string = 'app') => {
    if (shouldLog('error')) {
      console.error(`[ERROR][${context}] ${truncateMessage(message)}`);
    }
  },
  
  /**
   * Log debug message (only when debug level enabled)
   */
  debug: (message: string, context: string = 'app') => {
    if (shouldLog('debug')) {
      console.debug(`[DEBUG][${context}] ${truncateMessage(message)}`);
    }
  },

  /**
   * Enhanced error logging with structured error handling
   * Consolidates patterns like: console.error('Failed to...:', error)
   */
  logError: (message: string, options: ErrorLogOptions = {}) => {
    const { error, context = 'app', metadata, stackTrace = false } = options;
    
    let errorMessage = `[ERROR][${context}] ${message}`;
    
    if (error) {
      const errorDetails = error instanceof Error ? error.message : String(error);
      errorMessage += `: ${errorDetails}`;
    }
    
    console.error(errorMessage);
    
    if (metadata) {
      console.error(`[ERROR][${context}] Metadata:`, metadata);
    }
    
    if (stackTrace && error instanceof Error && error.stack) {
      console.error(`[ERROR][${context}] Stack trace:`, error.stack);
    }
  },

  /**
   * Service-specific logging with provider context
   * Consolidates patterns like: console.log(`[OpenRouter] Processing...`)
   */
  service: (provider: string, message: string, level: LogLevel = 'info') => {
    if (!shouldLog(level)) return;
    
    const prefix = `[${provider}]`;
    const truncatedMessage = truncateMessage(message);
    
    switch (level) {
      case 'info':
        console.log(`${prefix} ${truncatedMessage}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${truncatedMessage}`);
        break;
      case 'error':
        console.error(`${prefix} ${truncatedMessage}`);
        break;
      case 'debug':
        console.debug(`${prefix} ${truncatedMessage}`);
        break;
    }
  },

  /**
   * Debug logging with session/request context
   * Consolidates patterns like: console.log('[SATURN-DEBUG] WebSocket...', data)
   */
  debugWithContext: (context: string, message: string, data?: any) => {
    if (shouldLog('debug')) {
      console.log(`[${context}] ${truncateMessage(message)}`);
      if (data !== undefined) {
        // Truncate stringified data to prevent massive objects from spamming console
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
        console.log(`[${context}] Data: ${truncateMessage(dataStr, 200)}`);
      }
    }
  },

  /**
   * API response logging with truncation
   * Consolidates patterns like: console.log('Response preview:', response.substring(0, 200))
   */
  apiResponse: (provider: string, operation: string, responseData: string, previewLength: number = 200) => {
    if (shouldLog('debug')) { // Only log API responses in debug mode
      const preview = responseData.length > previewLength 
        ? `${responseData.substring(0, previewLength)}... [${responseData.length} total chars]`
        : responseData;
      console.log(`[${provider}] ${operation} response preview: "${preview.replace(/\n/g, '\\n')}"`);
    }
  },

  /**
   * File operation logging
   * Consolidates patterns like: console.log('[ResponsePersistence] Saved to:', filename)
   */
  fileOperation: (operation: string, filepath: string, context: string = 'FileSystem') => {
    if (shouldLog('debug')) { // Only log file operations in debug mode
      console.log(`[${context}] ${operation}: ${truncateMessage(filepath, 100)}`);
    }
  },

  /**
   * Token usage and cost logging
   * Consolidates patterns in AI services for token/cost tracking
   */
  tokenUsage: (provider: string, modelKey: string, inputTokens: number, outputTokens: number, reasoningTokens?: number, cost?: number) => {
    if (shouldLog('info')) { // Log token usage at info level
      let message = `Token usage - Input=${inputTokens}, Output=${outputTokens}`;
      if (reasoningTokens) {
        message += `, Reasoning=${reasoningTokens}`;
      }
      if (cost) {
        message += `, Cost=$${cost.toFixed(6)}`;
      }
      console.log(`[${provider}] ${modelKey}: ${message}`);
    }
  }
}
