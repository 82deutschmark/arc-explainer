/**
 * Models configuration constants for the ARC Explainer
 * Contains all available AI models and their properties
 * Author: Cascade
 * 
 * Includes support for OpenAI, Anthropic, xAI Grok, Google Gemini, DeepSeek, and OpenRouter models
 */

import { ARC_COLORS } from './colors';

/**
 * Colors for grid cells representing different values (single source of truth)
 */
export const CELL_COLORS = ARC_COLORS as readonly string[];

/**
 * Helper function to format confidence scores
 * @param confidence - Confidence value as number or string
 * @returns Formatted confidence string as percentage
 */
export function formatConfidence(confidence: number | string): string {
  if (typeof confidence === 'string') {
    return confidence;
  }
  // Always treat numeric values as percentages (don't multiply by 100)
  return `${Math.round(confidence)}%`;
}
