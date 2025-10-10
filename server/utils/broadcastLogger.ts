/**
 * Author: Sonnet 4.5
 * Date: 2025-10-09
 * PURPOSE: Global logger wrapper that broadcasts ALL logs to WebSocket for browser visibility.
 * Uses AsyncLocalStorage to maintain session context across async operations.
 * This allows ANY service (OpenAI, PromptBuilder, etc.) to automatically broadcast logs.
 * SRP/DRY check: Pass - Single responsibility (augment logging with broadcast)
 * shadcn/ui: Pass - Backend utility, no UI
 */

import { logger as baseLogger, type LogLevel } from './logger.js';
import { broadcast } from '../services/wsService.js';
import { AsyncLocalStorage } from 'async_hooks';

// Re-export LogLevel for consumers
export type { LogLevel };

// Store session context across async calls
const sessionStorage = new AsyncLocalStorage<{ sessionId: string }>();

/**
 * Set session context for current async operation
 * Call this at the start of any operation that should broadcast logs
 */
export function setSessionContext(sessionId: string, fn: () => Promise<any>) {
  return sessionStorage.run({ sessionId }, fn);
}

/**
 * Get current session ID from async context
 */
export function getSessionId(): string | null {
  return sessionStorage.getStore()?.sessionId || null;
}

/**
 * Broadcast a log message to WebSocket if session exists
 */
function broadcastLog(level: LogLevel, context: string, message: string) {
  const sessionId = getSessionId();
  if (!sessionId) return; // No session, skip broadcast
  
  try {
    broadcast(sessionId, {
      type: 'log',
      phase: 'log',
      level,
      context,
      message,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    // Silent fail - don't break logging if broadcast fails
  }
}

/**
 * Enhanced logger that broadcasts ALL logs to browser WebSocket
 * Drop-in replacement for standard logger
 */
export const logger = {
  /**
   * Log informational message
   */
  info: (message: string, context: string = 'app') => {
    baseLogger.info(message, context);
    broadcastLog('info', context, message);
  },
  
  /**
   * Log warning message
   */
  warn: (message: string, context: string = 'app') => {
    baseLogger.warn(message, context);
    broadcastLog('warn', context, message);
  },
  
  /**
   * Log error message
   */
  error: (message: string, context: string = 'app') => {
    baseLogger.error(message, context);
    broadcastLog('error', context, message);
  },
  
  /**
   * Log debug message
   */
  debug: (message: string, context: string = 'app') => {
    baseLogger.debug(message, context);
    broadcastLog('debug', context, message);
  },

  /**
   * Service-specific logging (MOST COMMONLY USED)
   */
  service: (provider: string, message: string, level: LogLevel = 'info') => {
    baseLogger.service(provider, message, level);
    broadcastLog(level, provider, message);
  },

  /**
   * Enhanced error logging with structured error handling
   */
  logError: (message: string, options: any = {}) => {
    baseLogger.logError(message, options);
    const { context = 'app' } = options;
    broadcastLog('error', context, message);
  },

  /**
   * Debug logging with session/request context
   */
  debugWithContext: (context: string, message: string, data?: any) => {
    baseLogger.debugWithContext(context, message, data);
    broadcastLog('debug', context, message);
  },

  /**
   * API response logging with truncation
   */
  apiResponse: (provider: string, operation: string, responseData: string, previewLength: number = 200) => {
    baseLogger.apiResponse(provider, operation, responseData, previewLength);
    const preview = responseData.length > previewLength 
      ? `${responseData.substring(0, previewLength)}... [${responseData.length} total chars]`
      : responseData;
    broadcastLog('debug', provider, `${operation} response: ${preview}`);
  },

  /**
   * File operation logging
   */
  fileOperation: (operation: string, filepath: string, context: string = 'FileSystem') => {
    baseLogger.fileOperation(operation, filepath, context);
    broadcastLog('debug', context, `${operation}: ${filepath}`);
  },

  /**
   * Token usage and cost logging
   */
  tokenUsage: (provider: string, modelKey: string, inputTokens: number, outputTokens: number, reasoningTokens?: number, cost?: number) => {
    baseLogger.tokenUsage(provider, modelKey, inputTokens, outputTokens, reasoningTokens, cost);
    
    let message = `Token usage - Input=${inputTokens}, Output=${outputTokens}`;
    if (reasoningTokens) {
      message += `, Reasoning=${reasoningTokens}`;
    }
    if (cost) {
      message += `, Cost=$${cost.toFixed(6)}`;
    }
    broadcastLog('info', provider, `${modelKey}: ${message}`);
  }
};
