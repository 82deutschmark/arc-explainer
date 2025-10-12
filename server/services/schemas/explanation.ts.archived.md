/**OLD AND RARELY USED!!!  DO NOT REFERENCE!
 * server/services/schemas/explanation.ts
 * 
 * JSON schema for explanation mode responses where AI explains why answers are correct.
 * Supports both standard explanations and alien communication mode.
 * 
 * Key Features:
 * - Standard explanation structure
 * - Alien communication extensions
 * - Reasoning capture in structured format  
 * - Template-specific field validation
 * 
 * @author Claude Code
 * @date August 22, 2025
 */

import { 
  COMMON_PROPERTIES,
  ALIEN_PROPERTIES,
  createSchema
} from './common.ts';
import { normalizeConfidence as normalizeConfidenceUtil } from '../../utils/CommonUtilities.ts';

/**
 * JSON schema for standard explanation responses
 */
export const STANDARD_EXPLANATION_SCHEMA = createSchema(
  {
    ...COMMON_PROPERTIES
  },
  [], // No additional required fields beyond base
  "arc_explanation_standard"
);

/**
 * JSON schema for alien communication explanation responses
 */
export const ALIEN_EXPLANATION_SCHEMA = createSchema(
  {
    ...COMMON_PROPERTIES,
    ...ALIEN_PROPERTIES
  },
  ["alienMeaning", "alienMeaningConfidence"], // Additional required fields
  "arc_explanation_alien"
);

/**
 * Select appropriate explanation schema based on template type
 */
export function getExplanationSchema(isAlienMode: boolean = false) {
  return isAlienMode ? ALIEN_EXPLANATION_SCHEMA : STANDARD_EXPLANATION_SCHEMA;
}

/**
 * Validate explanation response structure
 */
export function validateExplanationResponse(response: any, isAlienMode: boolean = false): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!response || typeof response !== 'object') {
    errors.push('Response must be a JSON object');
    return { isValid: false, errors };
  }
  
  // Check required base fields
  const requiredFields = ['solvingStrategy', 'confidence', 'patternDescription', 'hints'];
  const missingBase = requiredFields.filter(field => !(field in response));
  if (missingBase.length > 0) {
    errors.push(`Missing required fields: ${missingBase.join(', ')}`);
  }
  
  // Check alien mode specific fields
  if (isAlienMode) {
    if (!response.alienMeaning) {
      errors.push('Missing alienMeaning field for alien communication mode');
    }
    if (typeof response.alienMeaningConfidence !== 'number' || 
        response.alienMeaningConfidence < 0 || 
        response.alienMeaningConfidence > 100) {
      errors.push('alienMeaningConfidence must be a number between 0 and 100');
    }
  }
  
  // Validate confidence
  if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 100) {
    errors.push('confidence must be a number between 0 and 100');
  }
  
  // Validate hints array
  if (!Array.isArray(response.hints)) {
    errors.push('hints must be an array of strings');
  } else if (response.hints.some((hint: any) => typeof hint !== 'string')) {
    errors.push('all hints must be strings');
  }
  
  // Validate reasoningItems if present
  if (response.reasoningItems && !Array.isArray(response.reasoningItems)) {
    errors.push('reasoningItems must be an array of strings');
  } else if (response.reasoningItems && response.reasoningItems.some((step: any) => typeof step !== 'string')) {
    errors.push('all reasoningItems must be strings');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Extract explanation data from validated response
 */
export function extractExplanationData(response: any): {
  patternDescription: string;
  solvingStrategy: string;
  hints: string[];
  confidence: number;
  reasoningItems?: string[];
  alienMeaning?: string;
  alienMeaningConfidence?: number;
} {
  const base = {
    patternDescription: response.patternDescription || '',
    solvingStrategy: response.solvingStrategy || '',
    hints: response.hints || [],
    confidence: response.confidence || 0
  };
  
  // Add optional fields if present
  const optional: any = {};
  if (response.reasoningItems) optional.reasoningItems = response.reasoningItems;
  if (response.alienMeaning) optional.alienMeaning = response.alienMeaning;
  if (response.alienMeaningConfidence !== undefined) {
    optional.alienMeaningConfidence = response.alienMeaningConfidence;
  }
  
  return { ...base, ...optional };
}

/**
 * Create a sample explanation response for documentation/testing
 */
export function createSampleExplanationResponse(isAlienMode: boolean = false) {
  const base = {
    solvingStrategy: "The transformation rule applies a 90-degree clockwise rotation to all objects in the grid. This pattern is consistent across all training examples...",
    reasoningItems: [
      "Analyzed geometric relationships in training examples",
      "Identified consistent rotation transformation",
      "Verified pattern applies to test case"
    ],
    confidence: 90,
    patternDescription: "Objects in the input grid are rotated 90 degrees clockwise to produce the output",
    hints: [
      "Look for geometric transformations",
      "Rotation preserves object shapes and colors",
      "Pattern is consistent across all examples"
    ]
  };
  
  if (isAlienMode) {
    return {
      ...base,
      alienMeaning: "The aliens are teaching us about spatial relationships and geometric transformations in their world",
      alienMeaningConfidence: 75
    };
  }
  
  return base;
}

/**
 * Check if response contains alien communication fields
 */
export function hasAlienFields(response: any): boolean {
  return response.alienMeaning !== undefined || response.alienMeaningConfidence !== undefined;
}

/**
 * Normalize confidence values to integers 0-100
 * Uses CommonUtilities for consistent behavior across the codebase
 */
export function normalizeConfidence(confidence: any): number {
  return normalizeConfidenceUtil(confidence);
}