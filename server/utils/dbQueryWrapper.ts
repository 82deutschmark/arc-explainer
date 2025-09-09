/**
 * @file server/utils/dbQueryWrapper.ts
 * @description A strict database query wrapper for robust parameter validation.
 *
 * This module provides a wrapper function `q` for executing PostgreSQL queries.
 * Its primary purpose is to act as a centralized chokepoint for all database interactions,
 * enforcing strict checks to prevent common runtime errors. It is responsible for:
 *  - Asserting that no `undefined` values are passed as query parameters.
 *  - Logging detailed parameter maps for debugging purposes, showing the mapping from
 *    parameter index (`$1`, `$2`) to column name and data type.
 *  - Standardizing the interface for database calls across the application.
 *
 * @assessed_by Gemini 2.5 Pro
 * @assessed_on 2025-09-09
 */

import { Pool, PoolClient } from 'pg';
import { logger } from './logger';
import { safeJsonStringify } from './CommonUtilities.ts';

// Re-export safeJsonStringify from CommonUtilities for consistency
export { safeJsonStringify } from './CommonUtilities.ts';

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
