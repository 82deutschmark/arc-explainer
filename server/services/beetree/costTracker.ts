/**
 * server/services/beetree/costTracker.ts
 * 
 * Cost tracking utilities for beetreeARC ensemble solver
 * Tracks per-model and per-stage costs with real-time updates
 * 
 * Author: Cascade (model: Cascade GPT-5 medium reasoning)
 * Date: 2025-12-01
 * PURPOSE: Calculate and track costs for multi-model ensemble execution
 * SRP/DRY check: Pass - Focused solely on cost calculations and tracking
 */

export interface ModelCostInfo {
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cost: number;
}

export interface StageCostInfo {
  stage: string;
  cost: number;
  duration_ms: number;
}

export interface TokenUsage {
  input: number;
  output: number;
  reasoning: number;
}

export interface CostBreakdown {
  total_cost: number;
  by_model: ModelCostInfo[];
  by_stage: StageCostInfo[];
  total_tokens: TokenUsage;
  estimated_cost: number;
  cost_variance: number;
}

// Provider pricing (USD per 1M tokens)
// Based on current market rates as of 2025-12-01
const PROVIDER_PRICING = {
  // OpenAI pricing
  'gpt-5.1-none': { input: 5.00, output: 15.00, reasoning: 0.00 },
  'gpt-5.1-high': { input: 10.00, output: 30.00, reasoning: 0.00 },
  
  // Anthropic pricing
  'claude-sonnet-4.5-no-thinking': { input: 3.00, output: 15.00, reasoning: 0.00 },
  'claude-sonnet-4.5-thinking-60000': { input: 3.00, output: 15.00, reasoning: 15.00 },
  'claude-opus-4.5-thinking-60000': { input: 15.00, output: 75.00, reasoning: 75.00 },
  
  // Google Gemini pricing
  'gemini-3-low': { input: 0.50, output: 1.50, reasoning: 0.00 },
  'gemini-3-high': { input: 2.00, output: 6.00, reasoning: 0.00 },
} as const;

export class CostTracker {
  private modelCosts: Map<string, ModelCostInfo> = new Map();
  private stageCosts: Map<string, StageCostInfo> = new Map();
  private totalTokens: TokenUsage = { input: 0, output: 0, reasoning: 0 };
  private estimatedCost: number = 0;
  private startTime: number = Date.now();

  /**
   * Track a single model API call
   */
  trackModelCall(
    model: string,
    inputTokens: number,
    outputTokens: number,
    reasoningTokens: number = 0
  ): void {
    const cost = this.calculateModelCost(model, inputTokens, outputTokens, reasoningTokens);
    
    // Update model costs
    const existing = this.modelCosts.get(model) || {
      model_name: model,
      input_tokens: 0,
      output_tokens: 0,
      reasoning_tokens: 0,
      cost: 0
    };
    
    this.modelCosts.set(model, {
      model_name: model,
      input_tokens: existing.input_tokens + inputTokens,
      output_tokens: existing.output_tokens + outputTokens,
      reasoning_tokens: existing.reasoning_tokens + reasoningTokens,
      cost: existing.cost + cost
    });
    
    // Update total tokens
    this.totalTokens.input += inputTokens;
    this.totalTokens.output += outputTokens;
    this.totalTokens.reasoning += reasoningTokens;
  }

  /**
   * Track cost for a specific stage
   */
  trackStageCost(stage: string, durationMs: number): void {
    const stageCost = this.calculateStageCost(stage);
    
    const existing = this.stageCosts.get(stage) || {
      stage,
      cost: 0,
      duration_ms: 0
    };
    
    this.stageCosts.set(stage, {
      stage,
      cost: existing.cost + stageCost,
      duration_ms: existing.duration_ms + durationMs
    });
  }

  /**
   * Calculate cost for a single model call
   */
  calculateModelCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    reasoningTokens: number = 0
  ): number {
    const pricing = PROVIDER_PRICING[model as keyof typeof PROVIDER_PRICING];
    
    if (!pricing) {
      console.warn(`No pricing found for model: ${model}, using default rates`);
      // Default pricing for unknown models
      return (inputTokens * 2.00 + outputTokens * 6.00 + reasoningTokens * 6.00) / 1_000_000;
    }
    
    const inputCost = (inputTokens * pricing.input) / 1_000_000;
    const outputCost = (outputTokens * pricing.output) / 1_000_000;
    const reasoningCost = (reasoningTokens * pricing.reasoning) / 1_000_000;
    
    return inputCost + outputCost + reasoningCost;
  }

  /**
   * Calculate estimated cost for a stage
   */
  private calculateStageCost(stage: string): number {
    // Stage costs are estimated based on typical token usage patterns
    const stageEstimates = {
      'Step 1 (Shallow search)': { avgTokens: 4000, models: 3 },
      'Step 2 (Evaluation)': { avgTokens: 0, models: 0 }, // No API calls
      'Step 3 (Extended search)': { avgTokens: 6000, models: 6 },
      'Step 4 (Evaluation)': { avgTokens: 0, models: 0 }, // No API calls
      'Step 5 (Full search)': { avgTokens: 8000, models: 8 }
    };
    
    const estimate = stageEstimates[stage as keyof typeof stageEstimates];
    if (!estimate) {
      return 0;
    }
    
    // Estimate using average model pricing (weighted towards production models)
    const avgInputCost = 8.00; // Average input cost per 1M tokens
    const avgOutputCost = 25.00; // Average output cost per 1M tokens
    
    return (estimate.avgTokens * (avgInputCost + avgOutputCost) * estimate.models) / 1_000_000;
  }

  /**
   * Set estimated cost before execution
   */
  setEstimatedCost(cost: number): void {
    this.estimatedCost = cost;
  }

  /**
   * Get current total cost
   */
  getTotalCost(): number {
    let total = 0;
    for (const modelCost of this.modelCosts.values()) {
      total += modelCost.cost;
    }
    return total;
  }

  /**
   * Get complete cost breakdown
   */
  getCostBreakdown(): CostBreakdown {
    const totalCost = this.getTotalCost();
    const costVariance = this.estimatedCost > 0 
      ? ((totalCost - this.estimatedCost) / this.estimatedCost) * 100
      : 0;
    
    return {
      total_cost: totalCost,
      by_model: Array.from(this.modelCosts.values()),
      by_stage: Array.from(this.stageCosts.values()),
      total_tokens: { ...this.totalTokens },
      estimated_cost: this.estimatedCost,
      cost_variance: costVariance
    };
  }

  /**
   * Get cost estimate for mode
   */
  static estimateCostForMode(mode: 'testing' | 'production'): {
    estimatedCost: number;
    estimatedDuration: number;
    modelCount: number;
    tokenEstimate: number;
  } {
    if (mode === 'testing') {
      return {
        estimatedCost: 1.25, // Midpoint of $0.50-$2.00 range
        estimatedDuration: 4 * 60, // 4 minutes
        modelCount: 3,
        tokenEstimate: 15000 // Total tokens across all models
      };
    } else {
      return {
        estimatedCost: 32.5, // Midpoint of $15-$50 range
        estimatedDuration: 32 * 60, // 32 minutes
        modelCount: 8,
        tokenEstimate: 200000 // Total tokens across all models
      };
    }
  }

  /**
   * Get pricing for all models
   */
  static getAllPricing(): typeof PROVIDER_PRICING {
    return { ...PROVIDER_PRICING };
  }

  /**
   * Reset tracker for new run
   */
  reset(): void {
    this.modelCosts.clear();
    this.stageCosts.clear();
    this.totalTokens = { input: 0, output: 0, reasoning: 0 };
    this.estimatedCost = 0;
    this.startTime = Date.now();
  }

  /**
   * Get execution time so far
   */
  getExecutionTimeMs(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get cost per minute (for cost rate monitoring)
   */
  getCostPerMinute(): number {
    const elapsedMinutes = this.getExecutionTimeMs() / (1000 * 60);
    if (elapsedMinutes === 0) return 0;
    return this.getTotalCost() / elapsedMinutes;
  }

  /**
   * Check if cost is approaching estimated limit
   */
  isApproachingCostLimit(thresholdPercent: number = 0.8): boolean {
    if (this.estimatedCost === 0) return false;
    return (this.getTotalCost() / this.estimatedCost) >= thresholdPercent;
  }

  /**
   * Get model cost breakdown for UI display
   */
  getModelCostSummary(): Array<{
    model: string;
    cost: number;
    tokens: number;
    percentage: number;
  }> {
    const total = this.getTotalCost();
    const summary = Array.from(this.modelCosts.values()).map(info => ({
      model: info.model_name,
      cost: info.cost,
      tokens: info.input_tokens + info.output_tokens + info.reasoning_tokens,
      percentage: total > 0 ? (info.cost / total) * 100 : 0
    }));
    
    return summary.sort((a, b) => b.cost - a.cost);
  }

  /**
   * Get stage cost breakdown for UI display
   */
  getStageCostSummary(): Array<{
    stage: string;
    cost: number;
    duration: number;
    percentage: number;
  }> {
    const total = this.getTotalCost();
    const summary = Array.from(this.stageCosts.values()).map(info => ({
      stage: info.stage,
      cost: info.cost,
      duration: info.duration_ms,
      percentage: total > 0 ? (info.cost / total) * 100 : 0
    }));
    
    return summary.sort((a, b) => b.cost - a.cost);
  }
}
