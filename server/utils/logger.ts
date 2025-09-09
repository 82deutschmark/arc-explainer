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
 * Enhanced logger that wraps console methods with additional context and error handling
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
    const prefix = `[${provider}]`;
    switch (level) {
      case 'info':
        console.log(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      case 'debug':
        if (process.env.NODE_ENV !== 'production') {
          console.debug(`${prefix} ${message}`);
        }
        break;
    }
  },

  /**
   * Debug logging with session/request context
   * Consolidates patterns like: console.log('[SATURN-DEBUG] WebSocket...', data)
   */
  debugWithContext: (context: string, message: string, data?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${context}] ${message}`);
      if (data !== undefined) {
        console.log(`[${context}] Data:`, data);
      }
    }
  },

  /**
   * API response logging with truncation
   * Consolidates patterns like: console.log('Response preview:', response.substring(0, 200))
   */
  apiResponse: (provider: string, operation: string, responseData: string, previewLength: number = 200) => {
    const preview = responseData.length > previewLength 
      ? `${responseData.substring(0, previewLength)}...`
      : responseData;
    console.log(`[${provider}] ${operation} response preview: "${preview}"`);
  },

  /**
   * File operation logging
   * Consolidates patterns like: console.log('[ResponsePersistence] Saved to:', filename)
   */
  fileOperation: (operation: string, filepath: string, context: string = 'FileSystem') => {
    console.log(`[${context}] ${operation}: ${filepath}`);
  },

  /**
   * Token usage and cost logging
   * Consolidates patterns in AI services for token/cost tracking
   */
  tokenUsage: (provider: string, modelKey: string, inputTokens: number, outputTokens: number, reasoningTokens?: number, cost?: number) => {
    let message = `Token usage - Input=${inputTokens}, Output=${outputTokens}`;
    if (reasoningTokens) {
      message += `, Reasoning=${reasoningTokens}`;
    }
    if (cost) {
      message += `, Cost=$${cost.toFixed(6)}`;
    }
    console.log(`[${provider}] ${modelKey}: ${message}`);
  }
};
