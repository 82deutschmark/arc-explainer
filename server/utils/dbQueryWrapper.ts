/**
 * Database Query Wrapper - Centralized Parameter Validation
 * 
 * Prevents PostgreSQL JSON parameter mismatches by:
 * 1. Blocking undefined values from reaching the database
 * 2. Providing parameter mapping diagnostics  
 * 3. Standardizing JSON handling across all queries
 * 
 * @author Cascade
 */

import { Pool, PoolClient } from 'pg';
import { logger } from './logger.js';

/**
 * Safe parameter transformer for database queries
 */
function safeParam(value: any, paramIndex: number, context: string): any {
  if (value === undefined) {
    throw new Error(`Undefined parameter at $${paramIndex} (${context})`);
  }
  
  // Convert undefined to null, keep everything else as-is for JSONB columns
  return value === null ? null : value;
}

/**
 * Extract parameter placeholders from SQL text for debugging
 */
function extractParams(sqlText: string, values: any[]): Array<{ n: number; type: string; value: any }> {
  return [...sqlText.matchAll(/\$(\d+)/g)].map(match => {
    const paramNum = Number(match[1]);
    const value = values[paramNum - 1];
    return {
      n: paramNum,
      type: typeof value,
      value: value === null ? 'null' : (typeof value === 'object' ? `${Array.isArray(value) ? 'array' : 'object'}(${JSON.stringify(value).length} chars)` : String(value).substring(0, 50))
    };
  });
}

/**
 * Enhanced query wrapper with parameter validation and logging
 */
export async function safeQuery(
  client: Pool | PoolClient, 
  sqlText: string, 
  values: any[] = [], 
  context: string = 'unknown'
): Promise<any> {
  // Pre-flight validation: reject any undefined parameters
  const safeValues = values.map((value, index) => 
    safeParam(value, index + 1, context)
  );
  
  // Debug logging for parameter analysis
  if (process.env.NODE_ENV !== 'production') {
    const paramMapping = extractParams(sqlText, safeValues);
    logger.debug(`[SQL] ${context} - ${safeValues.length} params: ${paramMapping.map(p => `$${p.n}:${p.type}`).join(', ')}`, 'database');
  }
  
  try {
    return await client.query(sqlText, safeValues);
  } catch (error) {
    logger.error(`Query failed (${context}): ${error instanceof Error ? error.message : String(error)}`, 'database');
    
    // Enhanced error reporting for JSON syntax issues
    if (error instanceof Error && error.message.includes('invalid input syntax for type json')) {
      logger.error(`JSON parameter analysis for ${context}:`, 'database');
      const paramMapping = extractParams(sqlText, safeValues);
      paramMapping.forEach(param => {
        logger.error(`  $${param.n}: ${param.type} = ${param.value}`, 'database');
      });
    }
    
    throw error;
  }
}

/**
 * Specialized function for JSONB parameter preparation
 * Ensures consistent handling of objects vs strings for JSONB columns
 */
export function prepareJsonbParam(value: any): any {
  if (value === undefined) return null;
  if (value === null) return null;
  
  // For JSONB columns, pass objects/arrays directly
  // Let PostgreSQL's JSONB input function handle the conversion
  return value;
}

/**
 * Extra-safe handler for Saturn images (edge case)
 * These are rarely used but shouldn't break normal DB operations
 */
export function prepareSaturnImagesParam(saturnImages: any): any {
  // Saturn images are a total edge case - be extremely conservative
  if (!saturnImages || saturnImages === undefined) return null;
  
  try {
    // Only allow proper arrays or objects
    if (Array.isArray(saturnImages) || (typeof saturnImages === 'object')) {
      return saturnImages;
    }
    return null; // Reject anything else
  } catch {
    return null; // Any error = null (don't break normal flow)
  }
}
