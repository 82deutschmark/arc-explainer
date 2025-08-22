/**
 * Shared Cost Calculator Utility
 * Converts token usage into costs using per-million pricing from models configuration.
 * Based on the BaseProvider.calculateCost() pattern from the model compare project.
 * 
 * @author Cascade
 */

export interface TokenUsage {
  input: number;
  output: number;
  reasoning?: number;
}

export interface CostBreakdown {
  input: number;
  output: number;
  reasoning?: number;
  total: number;
}

export interface ModelPricing {
  input: string; // e.g. "$0.40" per million tokens
  output: string; // e.g. "$1.60" per million tokens
  reasoning?: string; // Optional reasoning pricing for models that support it
}

/**
 * Parse cost string like "$0.40" to number
 */
function parseCostString(costStr: string): number {
  return parseFloat(costStr.replace('$', ''));
}

/**
 * Calculate costs from token usage using model pricing
 * 
 * @param modelPricing - Pricing configuration from models.ts
 * @param tokenUsage - Token counts from API response
 * @returns Cost breakdown in USD
 */
export function calculateCost(modelPricing: ModelPricing, tokenUsage: TokenUsage): CostBreakdown {
  // Parse per-million-token costs
  const inputCostPerMillion = parseCostString(modelPricing.input);
  const outputCostPerMillion = parseCostString(modelPricing.output);
  
  // Calculate input and output costs
  const inputCost = (tokenUsage.input / 1_000_000) * inputCostPerMillion;
  const outputCost = (tokenUsage.output / 1_000_000) * outputCostPerMillion;

  // Calculate reasoning cost if available
  let reasoningCost = 0;
  if (tokenUsage.reasoning && modelPricing.reasoning) {
    const reasoningCostPerMillion = parseCostString(modelPricing.reasoning);
    reasoningCost = (tokenUsage.reasoning / 1_000_000) * reasoningCostPerMillion;
  }

  const total = inputCost + outputCost + reasoningCost;

  return {
    input: inputCost,
    output: outputCost,
    reasoning: tokenUsage.reasoning ? reasoningCost : undefined,
    total,
  };
}

/**
 * Format cost for display
 * 
 * @param cost - Cost in USD
 * @returns Formatted cost string
 */
export function formatCost(cost: number): string {
  if (cost < 0.001) {
    // Show as fractions of cents for very small amounts
    return `$${(cost * 1000).toFixed(3)}¢`;
  } else if (cost < 0.01) {
    // 4 decimal places for small amounts
    return `$${cost.toFixed(4)}`;
  } else if (cost < 1.0) {
    // 3 decimal places for amounts under $1
    return `$${cost.toFixed(3)}`;
  } else {
    // 2 decimal places for larger amounts
    return `$${cost.toFixed(2)}`;
  }
}

/**
 * Format token count for display
 * 
 * @param tokens - Token count
 * @returns Formatted token string with k/M abbreviation
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  } else if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  } else {
    return tokens.toString();
  }
}