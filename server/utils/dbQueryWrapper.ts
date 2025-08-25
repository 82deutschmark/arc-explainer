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
 * Prepares a value for a TEXT column that is expected to hold a JSON string.
 * Throws an error if the value is undefined.
 * @param v The value to process.
 * @returns A JSON string or null.
 */
export function toTextJSON(v: any): string | null {
  if (v === undefined) throw new Error('undefined parameter cannot be sent to the database');
  if (v === null) return null;
  if (typeof v === 'string') {
    // It might already be a JSON string. If not, stringify it.
    try {
      JSON.parse(v);
      return v; // It's a valid JSON string
    } catch (e) {
      return JSON.stringify(v); // It's a plain string, so stringify it
    }
  }
  return JSON.stringify(v);
}

/**
 * Prepares a value for a JSONB column by JSON stringifying.
 * PostgreSQL JSONB columns may require JSON strings from the driver.
 * @param v The value to process.
 * @returns JSON string or null for JSONB column.
 */
export function toJsonbParam(v: any): string | null {
  if (v === undefined || v === null) return null;
  
  try {
    return JSON.stringify(v);
  } catch (e) {
    console.warn(`[toJsonbParam] Failed to stringify value, returning null:`, v);
    return null;
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
