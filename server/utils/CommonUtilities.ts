/**
 * @file server/utils/CommonUtilities.ts
 * @description A collection of common utility functions for data validation, normalization, and transformation.
 *
 * This module consolidates various helper functions that were previously duplicated across the codebase.
 * It provides a single source of truth for common tasks such as:
 *  - Safely parsing and stringifying JSON (`safeJsonParse`, `safeJsonStringify`).
 *  - Normalizing and validating data types like confidence scores, hints, tokens, and costs.
 *  - Cleaning string inputs and checking for valid objects and arrays.
 *  - Formatting values for display (e.g., `formatBytes`).
 *
 * @assessed_by Gemini 2.5 Pro
 * @assessed_on 2025-09-09
 */

import { logger } from './logger.ts';
import { jsonParser } from './JsonParser.js';

/**
 * Safe JSON parsing with fallback support
 * Handles various input types and provides comprehensive error handling
 */
export function safeJsonParse<T>(value: any, fieldName?: string, fallback: T | null = null): T | null {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return fallback;
  }
  
  // If already an object, return as-is
  if (typeof value === 'object') {
    return value as T;
  }
  
  // If string, attempt to parse
  if (typeof value === 'string') {
    // Handle empty strings
    if (value.trim() === '') {
      return fallback;
    }
    
    // Use static import - jsonParser is already imported at the top
    const result = jsonParser.parse<T>(value, {
      logErrors: false, // We'll handle logging here
      fieldName
    });

    if (result.success) {
      return result.data as T;
    } else {
      if (fieldName) {
        logger.warn(`Failed to parse JSON for ${fieldName}: ${result.error}`, 'utilities');
      }
      return fallback;
    }
  }
  
  // For other types, return fallback
  if (fieldName) {
    logger.warn(`Unexpected type for ${fieldName}: ${typeof value}`, 'utilities');
  }
  return fallback;
}

/**
 * Safe JSON stringification with consistent behavior
 * Handles null/undefined values and provides error recovery
 */
export function safeJsonStringify(value: any): string | null {
  // Handle explicit null/undefined
  if (value === null || value === undefined) {
    return null;
  }
  
  // If already a string, return as-is (assuming it's valid JSON)
  if (typeof value === 'string') {
    return value;
  }
  
  // Attempt to stringify
  try {
    return JSON.stringify(value);
  } catch (error) {
    logger.warn(`Failed to stringify JSON: ${error instanceof Error ? error.message : 'Unknown error'}`, 'utilities');
    return null;
  }
}

/**
 * Normalize confidence score to valid range [0-100]
 * Handles various input types with sensible defaults
 */
export function normalizeConfidence(confidence: any): number {
  // Handle null/undefined
  if (confidence === null || confidence === undefined) {
    return 50; // Default confidence
  }
  
  // Handle numeric values
  if (typeof confidence === 'number') {
    return Math.max(0, Math.min(100, Math.round(confidence)));
  }
  
  // Handle string values
  if (typeof confidence === 'string') {
    const parsed = parseFloat(confidence);
    if (isNaN(parsed)) {
      return 50; // Default for invalid strings
    }
    return Math.max(0, Math.min(100, Math.round(parsed)));
  }
  
  // Handle boolean values (for edge cases)
  if (typeof confidence === 'boolean') {
    return confidence ? 100 : 0;
  }
  
  // Default fallback
  return 50;
}

/**
 * Process hints array with validation and cleaning
 * Ensures hints are always returned as a clean string array
 */
export function processHints(hints: any): string[] {
  // Handle null/undefined
  if (hints === null || hints === undefined) {
    return [];
  }
  
  // If already an array, validate and clean
  if (Array.isArray(hints)) {
    return hints
      .filter(hint => hint !== null && hint !== undefined)
      .map(hint => String(hint))
      .filter(hint => hint.trim().length > 0)
      .slice(0, 10); // Limit to reasonable number of hints
  }
  
  // If string, try to parse as JSON array first
  if (typeof hints === 'string') {
    if (hints.trim() === '') {
      return [];
    }
    
    // Use static import - jsonParser is already imported at the top
    const result = jsonParser.parse<any[]>(hints, {
      logErrors: false,
      fieldName: 'hints'
    });

    if (result.success && Array.isArray(result.data)) {
      return processHints(result.data); // Recursive call to validate array
    }
    
    // If parse fails or not array, treat as single hint
    return [hints.trim()];
  }
  
  // For other types, convert to string if meaningful
  if (typeof hints === 'object') {
    try {
      const stringified = JSON.stringify(hints);
      return [stringified];
    } catch {
      return [];
    }
  }
  
  // Final fallback - convert to string
  return [String(hints)].filter(hint => hint.trim().length > 0);
}

/**
 * Validate and normalize temperature value
 * Ensures temperature is within valid range for AI models
 */
export function normalizeTemperature(temperature: any): number | null {
  if (temperature === null || temperature === undefined) {
    return null;
  }
  
  const parsed = typeof temperature === 'number' ? temperature : parseFloat(String(temperature));
  
  if (isNaN(parsed)) {
    return null;
  }
  
  // Most AI models use temperature range 0-2, clamp to reasonable bounds
  return Math.max(0, Math.min(2, parsed));
}

/**
 * Validate and normalize token counts
 * Ensures token counts are non-negative integers
 */
export function normalizeTokenCount(tokenCount: any): number | null {
  if (tokenCount === null || tokenCount === undefined) {
    return null;
  }
  
  const parsed = typeof tokenCount === 'number' ? tokenCount : parseInt(String(tokenCount));
  
  if (isNaN(parsed) || parsed < 0) {
    return null;
  }
  
  return parsed;
}

/**
 * Validate and normalize cost values
 * Ensures costs are non-negative numbers with reasonable precision
 */
export function normalizeCost(cost: any): number | null {
  if (cost === null || cost === undefined) {
    return null;
  }
  
  const parsed = typeof cost === 'number' ? cost : parseFloat(String(cost));
  
  if (isNaN(parsed) || parsed < 0) {
    return null;
  }
  
  // Round to 6 decimal places for cost precision
  return Math.round(parsed * 1000000) / 1000000;
}

/**
 * Clean and validate string inputs
 * Removes excessive whitespace and validates length
 */
export function cleanString(value: any, maxLength = 10000): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  const stringValue = String(value).trim();
  
  if (stringValue === '') {
    return null;
  }
  
  // Truncate if too long
  return stringValue.length > maxLength ? stringValue.slice(0, maxLength) : stringValue;
}

/**
 * Validate and normalize processing time
 * Ensures processing time is a positive integer in milliseconds
 */
export function normalizeProcessingTime(timeMs: any): number | null {
  if (timeMs === null || timeMs === undefined) {
    return null;
  }
  
  const parsed = typeof timeMs === 'number' ? timeMs : parseInt(String(timeMs));
  
  if (isNaN(parsed) || parsed < 0) {
    return null;
  }
  
  // Reasonable upper bound - 1 hour max processing time
  return Math.min(parsed, 3600000);
}

/**
 * Check if a value is a valid non-empty array
 */
export function isNonEmptyArray(value: any): value is any[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Check if a value is a valid object (not null, not array)
 */
export function isValidObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Generate a timestamp string for logging
 */
export function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Debounce function for rate limiting
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}