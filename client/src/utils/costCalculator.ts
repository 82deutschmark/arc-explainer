/**
 * Cost Calculator Utility
 * Estimates API costs based on model pricing and prompt characteristics
 * 
 * Note: These are rough estimates since we don't track exact token usage yet.
 * Based on typical ARC puzzle prompts (~2000-4000 tokens input, ~500-2000 tokens output)
 */

import { MODELS } from '@/constants/models';

// Rough token estimates for ARC puzzle analysis
const TYPICAL_INPUT_TOKENS = 3000; // Average prompt size for ARC puzzles
const TYPICAL_OUTPUT_TOKENS = 1000; // Average response size

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: 'USD';
  isEstimate: true;
}

/**
 * Parse cost string like "$0.40" to number
 */
function parseCostString(costStr: string): number {
  return parseFloat(costStr.replace('$', ''));
}

/**
 * Calculate estimated cost for an analysis
 */
export function calculateEstimatedCost(
  modelKey: string,
  inputTokens: number = TYPICAL_INPUT_TOKENS,
  outputTokens: number = TYPICAL_OUTPUT_TOKENS
): CostEstimate | null {
  const model = MODELS.find(m => m.key === modelKey);
  if (!model) return null;

  // Parse per-million-token costs
  const inputCostPerMillion = parseCostString(model.cost.input);
  const outputCostPerMillion = parseCostString(model.cost.output);

  // Calculate costs (divide by 1,000,000 since pricing is per million tokens)
  const inputCost = (inputTokens / 1_000_000) * inputCostPerMillion;
  const outputCost = (outputTokens / 1_000_000) * outputCostPerMillion;
  const totalCost = inputCost + outputCost;

  return {
    inputCost,
    outputCost,
    totalCost,
    currency: 'USD' as const,
    isEstimate: true as const
  };
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.001) {
    return `$${(cost * 1000).toFixed(2)}¢`; // Show as cents for very small amounts
  } else if (cost < 0.01) {
    return `$${cost.toFixed(4)}`; // 4 decimal places for small amounts
  } else {
    return `$${cost.toFixed(3)}`; // 3 decimal places for larger amounts
  }
}

/**
 * Get cost estimate with formatted display
 */
export function getCostDisplay(modelKey: string): string | null {
  const estimate = calculateEstimatedCost(modelKey);
  if (!estimate) return null;

  return `~${formatCost(estimate.totalCost)}`;
}