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
import { safeJsonStringify } from './CommonUtilities.js';

// Re-export safeJsonStringify from CommonUtilities for consistency
export { safeJsonStringify } from './CommonUtilities.js';

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
