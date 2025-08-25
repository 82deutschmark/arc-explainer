/**
 * Data Transformation Utilities
 * 
 * Centralized location for data parsing, validation, and transformation logic.
 * Extracted from dbService.ts to maintain separation of concerns.
 * 
 * @author Cascade
 */

import { logger } from './logger.js';

/**
 * Normalizes confidence values to valid range [0-100]
 */
export const normalizeConfidence = (confidence: any): number => {
  try {
    const parsed = parseFloat(confidence);
    if (isNaN(parsed)) return 50; // Default confidence
    return Math.max(0, Math.min(100, parsed)); // Clamp to 0-100 range
  } catch {
    return 50; // Default confidence on any error
  }
};

/**
 * Safely converts values to JSON strings for TEXT database columns
 */
export const safeJsonStringify = (value: any): string => {
  // Handle null/undefined explicitly - return JSON string "null" for TEXT columns
  if (value === null || value === undefined) {
    return 'null'; // Return the string "null" for JSON null value
  }
  
  // Handle false explicitly (previously caught by !value check)
  if (value === false) {
    return 'false';
  }
  
  // Handle 0 explicitly (previously caught by !value check)
  if (value === 0) {
    return '0';
  }
  
  // Handle empty string
  if (value === '') {
    return '""';
  }
  
  // If already a string, try to parse it first to validate it's proper JSON
  if (typeof value === 'string') {
    try {
      JSON.parse(value); // Validate it's proper JSON
      return value;
    } catch {
      // If not valid JSON, treat as invalid and return string "null"
      return 'null';
    }
  }
  
  // If it's an array or object, stringify it directly with JSON.stringify
  // This prevents PostgreSQL parameter binding from auto-converting arrays to strings
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      // Force JSON.stringify to handle nested arrays properly
      return JSON.stringify(value);
    } catch (error) {
      logger.error(`Failed to stringify value: ${error instanceof Error ? error.message : String(error)}`, 'database');
      return 'null';
    }
  }
  
  // For numbers and booleans not caught above
  return JSON.stringify(value);
};

/**
 * Safely parses JSON strings from database TEXT columns
 */
export const safeJsonParse = (jsonString: string | null, fieldName: string) => {
  if (!jsonString) return null;
  
  // Skip obviously corrupted data patterns to reduce log noise
  if (typeof jsonString === 'string') {
    if (jsonString.includes('[object Object]') || 
        jsonString.includes('function ') ||
        jsonString.includes('undefined')) {
      logger.warn(`Skipping corrupted JSON data for ${fieldName}: ${jsonString.substring(0, 100)}`, 'database');
      return null;
    }
  }
  
  try {
    const parsed = JSON.parse(jsonString);
    return parsed;
  } catch (error) {
    logger.error(`Failed to parse JSON for ${fieldName}: ${jsonString?.substring(0, 200)} - ${error instanceof Error ? error.message : String(error)}`, 'database');
    return null;
  }
};

/**
 * Processes and validates hints array from user input
 */
export const processHints = (rawHints: any): string[] => {
  // Ensure hints is always an array of strings
  return Array.isArray(rawHints) 
    ? rawHints.filter(hint => typeof hint === 'string')
    : typeof rawHints === 'string' 
      ? [rawHints] 
      : [];
};

/**
 * Safely handles multiplePredictedOutputs field which can be boolean or array
 */
export const processMultiplePredictedOutputs = (multiplePredictedOutputs: any) => {
  // Handle both boolean flag and array data for JSONB storage
  return (typeof multiplePredictedOutputs === 'boolean') ? null : (multiplePredictedOutputs ?? null);
};