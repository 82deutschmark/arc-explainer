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
  if (value === null || value === undefined) {
    return null;
  }

  // For non-string types, simply stringify them.
  if (typeof value !== 'string') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      logger.warn(`Failed to stringify non-string value: ${error instanceof Error ? error.message : 'Unknown error'}`, 'utilities');
      return null;
    }
  }

  // For strings, we need to determine if it's already a valid JSON string or a plain string.
  // An empty string is a special case; we should return it as a valid JSON empty string: ""
  if (value.trim() === '') {
      return '""';
  }

  try {
    // Attempt to parse the string. If it succeeds, the string is already valid JSON.
    JSON.parse(value);
    return value; // It's valid JSON, return as-is.
  } catch (e) {
    // If parsing fails, it's a plain string that needs to be encoded into a JSON string.
    try {
      return JSON.stringify(value);
    } catch (error) {
      logger.warn(`Failed to stringify plain string: ${error instanceof Error ? error.message : 'Unknown error'}`, 'utilities');
      return null;
    }
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

  let numericValue: number | null = null;
  let originalHadPercentToken = false;
  let originalWasStringFraction = false;

  // Handle numeric values first
  if (typeof confidence === 'number' && !Number.isNaN(confidence)) {
    numericValue = confidence;
  } else if (typeof confidence === 'string') {
    const trimmed = confidence.trim();
    if (trimmed.length === 0) {
      return 50;
    }

    originalHadPercentToken = /%|percent/i.test(trimmed);

    // Remove textual percent markers and normalize decimal separators
    const cleaned = trimmed
      .replace(/percent(age)?/gi, '')
      .replace(/%/g, '')
      .replace(',', '.')
      .trim();

    const match = cleaned.match(/-?\d+(\.\d+)?/);
    if (match) {
      numericValue = parseFloat(match[0]);
      if (!Number.isNaN(numericValue)) {
        originalWasStringFraction = cleaned.includes('.') || cleaned.startsWith('0');
      }
    }
  } else if (typeof confidence === 'boolean') {
    return confidence ? 100 : 0;
  } else if (typeof confidence === 'object') {
    // Handle structures like { confidence: 0.85 } or { value: 0.92 }
    const candidate =
      (confidence && typeof confidence.confidence === 'number' && !Number.isNaN(confidence.confidence))
        ? confidence.confidence
        : (confidence && typeof confidence.value === 'number' && !Number.isNaN(confidence.value))
          ? confidence.value
          : null;
    if (candidate !== null) {
      numericValue = candidate;
    }
  }

  if (numericValue === null || Number.isNaN(numericValue)) {
    return 50;
  }

  let normalized = numericValue;

  if (normalized < 0) {
    normalized = 0;
  }

  // Scale fractional inputs (0 < x <= 1) that are intended to represent percentages.
  // Providers like Grok often send 0.85 to mean 85%; they also send 1 to mean 100.
  const shouldScaleFraction =
    normalized > 0 &&
    normalized <= 1 &&
    !originalHadPercentToken &&
    (originalWasStringFraction || normalized !== Math.trunc(normalized));

  if (shouldScaleFraction) {
    normalized = normalized * 100;
  } else if (
    normalized === 1 &&
    !originalHadPercentToken &&
    !originalWasStringFraction
  ) {
    // Heuristic: bare value `1` from providers like Grok should be treated as 100%.
    normalized = 100;
  }

  if (normalized > 100) {
    normalized = 100;
  }

  // Round to nearest integer for storage consistency (DB expects 0-100 integer)
  return Math.round(normalized);
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
 * Sanitize grid data to ensure all values are numeric integers (0-9)
 * ARC puzzle grids should only contain integer values from 0-9
 * This prevents AI models from introducing invalid characters like Chinese text
 */
export function sanitizeGridData(gridData: any): number[][] | null {
  if (!gridData) {
    return null;
  }
  
  try {
    // If it's a string, try to parse it first
    let parsedGrid = gridData;
    if (typeof gridData === 'string') {
      const parseResult = jsonParser.parse(gridData, {
        logErrors: false,
        fieldName: 'gridData'
      });
      if (!parseResult.success) {
        logger.warn(`Failed to parse grid JSON: ${parseResult.error}`, 'utilities');
        return null;
      }
      parsedGrid = parseResult.data;
    }
    
    // Ensure it's a 2D array
    if (!Array.isArray(parsedGrid)) {
      logger.warn('Grid data is not an array', 'utilities');
      return null;
    }
    
    const sanitizedGrid: number[][] = [];
    
    for (let rowIndex = 0; rowIndex < parsedGrid.length; rowIndex++) {
      const row = parsedGrid[rowIndex];
      
      // CRITICAL FIX: Skip null/undefined rows instead of failing entire grid
      // This handles legacy data with corrupt rows while preserving valid data
      if (row === null || row === undefined) {
        logger.warn(`Grid row ${rowIndex} is null/undefined - skipping`, 'utilities');
        continue;
      }
      
      if (!Array.isArray(row)) {
        logger.warn(`Grid row ${rowIndex} is not an array - skipping`, 'utilities');
        continue;
      }
      
      const sanitizedRow: number[] = [];
      
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const cell = row[colIndex];
        
        // Convert to number and validate
        let numericValue: number;
        
        if (typeof cell === 'number' && Number.isInteger(cell)) {
          numericValue = cell;
        } else if (typeof cell === 'string') {
          const parsed = parseInt(cell, 10);
          if (isNaN(parsed)) {
            logger.warn(`Invalid grid cell at [${rowIndex}][${colIndex}]: "${cell}" - setting to 0`, 'utilities');
            numericValue = 0;
          } else {
            numericValue = parsed;
          }
        } else if (typeof cell === 'object' && cell !== null) {
          // CRITICAL FIX: Extract numeric value from nested objects
          // Author: Gemini 2.5 Pro
          // Date: 2025-09-17
          // PURPOSE: Handle cases where grid cells are wrapped in objects instead of being raw numbers
          
          let extractedValue = null;
          
          // Try common object patterns that might contain the actual number
          if (typeof cell.value === 'number') {
            extractedValue = cell.value;
          } else if (typeof cell.number === 'number') {
            extractedValue = cell.number;
          } else if (typeof cell.data === 'number') {
            extractedValue = cell.data;
          } else if (typeof cell.cell === 'number') {
            extractedValue = cell.cell;
          } else if (Array.isArray(cell)) {
            // Handle arrays as cells - this is a CRITICAL MALFORMATION from AI models
            if (cell.length === 1 && typeof cell[0] === 'number') {
              extractedValue = cell[0]; // Single-element array
            } else if (cell.length > 1) {
              // Multi-element array - CRITICAL ERROR from model misunderstanding grid structure
              logger.error(`Grid cell at [${rowIndex}][${colIndex}] is array with ${cell.length} elements - this indicates model output malformation`, 'utilities');
              logger.error(`Array content: ${JSON.stringify(cell).slice(0, 200)}`, 'utilities');
              // Attempt recovery: find first valid integer in range 0-9
              const firstValidInt = cell.find(v => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 9);
              if (firstValidInt !== undefined) {
                extractedValue = firstValidInt;
                logger.warn(`Recovered value ${firstValidInt} from malformed array at [${rowIndex}][${colIndex}]`, 'utilities');
              }
            }
          }
          
          if (extractedValue !== null && Number.isInteger(extractedValue)) {
            numericValue = extractedValue;
            logger.warn(`Extracted number ${extractedValue} from object at [${rowIndex}][${colIndex}]`, 'utilities');
          } else {
            // CRITICAL DEBUG: Log what the object actually contains
            logger.warn(`Invalid grid cell type at [${rowIndex}][${colIndex}]: ${typeof cell} - setting to 0`, 'utilities');
            logger.warn(`Cell object content: ${JSON.stringify(cell)}`, 'utilities');
            numericValue = 0;
          }
        } else {
          logger.warn(`Invalid grid cell type at [${rowIndex}][${colIndex}]: ${typeof cell} - setting to 0`, 'utilities');
          numericValue = 0;
        }
        
        // Ensure value is in valid ARC range (0-9)
        if (numericValue < 0 || numericValue > 9) {
          logger.warn(`Grid cell value ${numericValue} at [${rowIndex}][${colIndex}] outside valid range (0-9) - clamping`, 'utilities');
          numericValue = Math.max(0, Math.min(9, Math.round(numericValue)));
        }
        
        sanitizedRow.push(numericValue);
      }
      
      sanitizedGrid.push(sanitizedRow);
    }
    
    // Validate that we have at least some valid rows
    if (sanitizedGrid.length === 0) {
      logger.warn('Grid sanitization resulted in empty grid - all rows were invalid', 'utilities');
      return null;
    }
    
    return sanitizedGrid;
  } catch (error) {
    logger.error(`Error sanitizing grid data: ${error instanceof Error ? error.message : 'Unknown error'}`, 'utilities');
    return null;
  }
}

/**
 * Sanitize multiple grid predictions data
 * Used for multi-test predictions that contain arrays of grids
 */
export function sanitizeMultipleGrids(multiGridData: any): number[][][] | null {
  if (!multiGridData) {
    return null;
  }
  
  try {
    // If it's a string, try to parse it first
    let parsedData = multiGridData;
    if (typeof multiGridData === 'string') {
      const parseResult = jsonParser.parse(multiGridData, {
        logErrors: false,
        fieldName: 'multiGridData'
      });
      if (!parseResult.success) {
        logger.warn(`Failed to parse multi-grid JSON: ${parseResult.error}`, 'utilities');
        return null;
      }
      parsedData = parseResult.data;
    }
    
    // Ensure it's an array of grids
    if (!Array.isArray(parsedData)) {
      logger.warn('Multi-grid data is not an array', 'utilities');
      return null;
    }
    
    const sanitizedGrids: number[][][] = [];
    
    for (let gridIndex = 0; gridIndex < parsedData.length; gridIndex++) {
      const grid = parsedData[gridIndex];
      const sanitizedGrid = sanitizeGridData(grid);
      
      if (sanitizedGrid !== null) {
        sanitizedGrids.push(sanitizedGrid);
      } else {
        logger.warn(`Failed to sanitize grid at index ${gridIndex} in multi-grid data`, 'utilities');
      }
    }
    
    return sanitizedGrids.length > 0 ? sanitizedGrids : null;
  } catch (error) {
    logger.error(`Error sanitizing multi-grid data: ${error instanceof Error ? error.message : 'Unknown error'}`, 'utilities');
    return null;
  }
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
