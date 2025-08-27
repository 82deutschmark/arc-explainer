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
import { logger } from './logger';

/**
 * Simple JSON stringification for database storage.
 * Works for both JSONB and TEXT columns that store JSON data.
 * Replaces the over-engineered toTextJSON/toJsonbParam functions.
 */
export function safeJsonStringify(value: any): string | null {
  if (value === undefined || value === null) return null;
  
  try {
    const stringified = JSON.stringify(value);
    // Validate the stringified result is valid JSON
    JSON.parse(stringified);
    return stringified;
  } catch (e) {
    console.error(`[safeJsonStringify] CRITICAL: Failed to stringify value for database save:`, {
      valueType: typeof value,
      valueConstructor: value?.constructor?.name,
      error: e instanceof Error ? e.message : String(e),
      valueSample: String(value).substring(0, 200)
    });
    
    // Try to salvage the data by converting to safe format
    try {
      const safeFallback = typeof value === 'object' ? '{}' : '""';
      console.warn(`[safeJsonStringify] Using fallback value: ${safeFallback}`);
      return safeFallback;
    } catch {
      return null;
    }
  }
}

/**
 * A strict wrapper around pool.query that provides:
 * 1.  Strict undefined parameter checking to prevent DB errors.
 * 2.  Enhanced debugging logs with parameter type mapping.
 * 3.  A centralized chokepoint for all database queries.
 *
 * @author Cascade, guided by senior dev feedback
 */
export async function q(
  pool: Pool | PoolClient, 
  text: string, 
  values: any[], 
  ctx: string = 'unknown',
  paramMap: { [key: number]: string } = {}
) {
  // 1) Assert no undefined values.
  values.forEach((v, i) => {
    if (v === undefined) {
      throw new Error(`Query parameter $${i + 1} is undefined in context: ${ctx}`);
    }
  });

  // 2) Log mapping
  try {
    const paramDetails = values.map((v, i) => {
      const paramNum = i + 1;
      const colName = paramMap[paramNum] || 'unknown';
      return {
        p: `$${paramNum}`,
        col: colName,
        type: typeof v,
        valuePreview: JSON.stringify(v)?.substring(0, 70) || 'null'
      };
    });
    logger.debug(`[SQL Map] Context: ${ctx} ${JSON.stringify(paramDetails, null, 2)}`, 'database');
  } catch (e) {
    logger.warn(`[SQL] Could not parse parameters for logging in context: ${ctx}`, 'database');
  }

  return pool.query(text, values);
}
