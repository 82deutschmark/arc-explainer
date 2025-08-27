/**
 * Data Transformation Utilities
 * 
 * Centralized location for data parsing, validation, and transformation logic.
 * Extracted from dbService.ts to maintain separation of concerns.
 * 
 * @author Cascade
 */

import { logger } from './logger.ts';
import { safeJsonStringify, safeJsonParse, normalizeConfidence, processHints } from './CommonUtilities.ts';

// Re-export utility functions from CommonUtilities for backward compatibility
export { normalizeConfidence, safeJsonStringify, safeJsonParse, processHints } from './CommonUtilities.ts';
