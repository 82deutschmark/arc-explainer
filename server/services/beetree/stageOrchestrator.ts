/**
 * server/services/beetree/stageOrchestrator.ts
 * 
 * Stage orchestration utilities for beetreeARC ensemble solver
 * Controls early termination logic and stage progression
 * 
 * Author: Cascade (model: Cascade GPT-5 medium reasoning)
 * Date: 2025-12-01
 * PURPOSE: Control beetree execution flow with early termination and consensus detection
 * SRP/DRY check: Pass - Focused solely on stage orchestration and flow control
 */

import { ConsensusAnalyzer, ModelPrediction, ConsensusResult } from './consensusAnalyzer.js';
import { CostTracker } from './costTracker.js';

export interface StageConfig {
  name: string;
  enabled: boolean;
  models: string[];
  max_tokens: number;
  temperature: number;
  early_termination_enabled: boolean;
  consensus_threshold: number;
}

export interface OrchestrationState {
  current_stage: number;
  total_stages: number;
  stage_results: Array<{
    stage_name: string;
    predictions: ModelPrediction[];
    consensus: ConsensusResult;
    cost: number;
    duration_ms: number;
    completed_at: number;
  }>;
  should_terminate: boolean;
  termination_reason?: string;
  final_consensus?: ConsensusResult;
}

export interface TerminationCriteria {
  consensus_threshold: number; // Minimum consensus strength to stop
  cost_limit: number; // Maximum cost in USD
  time_limit: number; // Maximum time in milliseconds
  min_solutions: number; // Minimum number of distinct solutions required
}

export class StageOrchestrator {
  private consensusAnalyzer: ConsensusAnalyzer;
  private costTracker: CostTracker;
  private startTime: number;
  private terminationCriteria: TerminationCriteria;

  constructor(terminationCriteria?: Partial<TerminationCriteria>) {
    this.consensusAnalyzer = new ConsensusAnalyzer();
    this.costTracker = new CostTracker();
    this.startTime = Date.now();
    
    this.terminationCriteria = {
      consensus_threshold: 0.8, // 80% consensus to stop early
      cost_limit: 50.0, // $50 max cost
      time_limit: 45 * 60 * 1000, // 45 minutes max
      min_solutions: 2, // Need at least 2 distinct solutions
      ...terminationCriteria
    };
  }

  /**
   * Get stage configuration based on mode
   */
  getStageConfig(mode: 'testing' | 'production'): StageConfig[] {
    if (mode === 'testing') {
      return [
        {
          name: 'Step 1 (Shallow search)',
          enabled: true,
          models: ['gpt-5.1-none', 'claude-sonnet-4.5-no-thinking', 'gemini-3-low'],
          max_tokens: 2000,
          temperature: 0.2,
          early_termination_enabled: true,
          consensus_threshold: 0.9 // Higher threshold for testing mode
        },
        {
          name: 'Step 2 (Evaluation)',
          enabled: true,
          models: [], // No API calls - just evaluation
          max_tokens: 0,
          temperature: 0,
          early_termination_enabled: false,
          consensus_threshold: 0
        },
        {
          name: 'Step 3 (Extended search)',
          enabled: false, // Disabled in testing mode
          models: [],
          max_tokens: 4000,
          temperature: 0.3,
          early_termination_enabled: true,
          consensus_threshold: 0.8
        },
        {
          name: 'Step 4 (Evaluation)',
          enabled: false,
          models: [],
          max_tokens: 0,
          temperature: 0,
          early_termination_enabled: false,
          consensus_threshold: 0
        },
        {
          name: 'Step 5 (Full search)',
          enabled: false,
          models: [],
          max_tokens: 6000,
          temperature: 0.4,
          early_termination_enabled: true,
          consensus_threshold: 0.7
        }
      ];
    } else {
      // Production mode - all stages enabled
      return [
        {
          name: 'Step 1 (Shallow search)',
          enabled: true,
          models: ['gpt-5.1-none', 'claude-sonnet-4.5-no-thinking', 'gemini-3-low'],
          max_tokens: 2000,
          temperature: 0.2,
          early_termination_enabled: true,
          consensus_threshold: 0.7
        },
        {
          name: 'Step 2 (Evaluation)',
          enabled: true,
          models: [], // Evaluation stage
          max_tokens: 0,
          temperature: 0,
          early_termination_enabled: false,
          consensus_threshold: 0
        },
        {
          name: 'Step 3 (Extended search)',
          enabled: true,
          models: ['gpt-5.1-high', 'claude-sonnet-4.5-thinking-60000', 'gemini-3-high'],
          max_tokens: 4000,
          temperature: 0.3,
          early_termination_enabled: true,
          consensus_threshold: 0.6
        },
        {
          name: 'Step 4 (Evaluation)',
          enabled: true,
          models: [], // Evaluation stage
          max_tokens: 0,
          temperature: 0,
          early_termination_enabled: false,
          consensus_threshold: 0
        },
        {
          name: 'Step 5 (Full search)',
          enabled: true,
          models: ['gpt-5.1-high', 'claude-opus-4.5-thinking-60000'],
          max_tokens: 6000,
          temperature: 0.4,
          early_termination_enabled: true,
          consensus_threshold: 0.5
        }
      ];
    }
  }

  /**
   * Check if execution should terminate after a stage
   */
  shouldTerminate(
    stageResult: {
      stage_name: string;
      predictions: ModelPrediction[];
      consensus: ConsensusResult;
      cost: number;
      duration_ms: number;
    },
    stageIndex: number,
    totalStages: number,
    allStageResults: any[]
  ): {
    should_terminate: boolean;
    reason?: string;
    confidence: number;
  } {
    const elapsedTime = Date.now() - this.startTime;
    const totalCost = this.costTracker.getTotalCost() + stageResult.cost;
    
    // Check consensus threshold
    if (stageResult.consensus.consensus_strength >= this.terminationCriteria.consensus_threshold) {
      return {
        should_terminate: true,
        reason: `Strong consensus (${(stageResult.consensus.consensus_strength * 100).toFixed(1)}%) reached`,
        confidence: stageResult.consensus.consensus_strength
      };
    }
    
    // Check cost limit
    if (totalCost >= this.terminationCriteria.cost_limit) {
      return {
        should_terminate: true,
        reason: `Cost limit exceeded ($${totalCost.toFixed(2)} >= $${this.terminationCriteria.cost_limit})`,
        confidence: 0.5
      };
    }
    
    // Check time limit
    if (elapsedTime >= this.terminationCriteria.time_limit) {
      return {
        should_terminate: true,
        reason: `Time limit exceeded (${(elapsedTime / 1000 / 60).toFixed(1)}min >= ${(this.terminationCriteria.time_limit / 1000 / 60).toFixed(1)}min)`,
        confidence: 0.5
      };
    }
    
    // Check if we have enough distinct solutions and are in later stages
    if (stageIndex >= 2 && stageResult.consensus.top_solutions.length >= this.terminationCriteria.min_solutions) {
      // Check if solutions are converging (diversity decreasing)
      const diversityTrend = this.calculateDiversityTrend(allStageResults);
      if (diversityTrend < -0.1) { // Diversity decreasing significantly
        return {
          should_terminate: true,
          reason: `Solutions converging (diversity trend: ${diversityTrend.toFixed(2)})`,
          confidence: 0.6
        };
      }
    }
    
    // Check if this is the last stage
    if (stageIndex === totalStages - 1) {
      return {
        should_terminate: true,
        reason: 'Final stage completed',
        confidence: 1.0
      };
    }
    
    return {
      should_terminate: false,
      confidence: 0
    };
  }

  /**
   * Calculate diversity trend across stages
   */
  private calculateDiversityTrend(stageResults: any[]): number {
    if (stageResults.length < 2) return 0;
    
    const recentResults = stageResults.slice(-3); // Look at last 3 stages
    const diversityScores = recentResults.map(r => r.consensus.diversity_score);
    
    if (diversityScores.length < 2) return 0;
    
    // Simple linear trend calculation
    const n = diversityScores.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = diversityScores.reduce((sum, score) => sum + score, 0);
    const sumXY = diversityScores.reduce((sum, score, index) => sum + (index * score), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    return slope;
  }

  /**
   * Get next stage to execute
   */
  getNextStage(
    mode: 'testing' | 'production',
    currentStageIndex: number,
    orchestrationState: OrchestrationState
  ): StageConfig | null {
    const stageConfigs = this.getStageConfig(mode);
    
    for (let i = currentStageIndex + 1; i < stageConfigs.length; i++) {
      const config = stageConfigs[i];
      
      // Skip disabled stages
      if (!config.enabled) {
        continue;
      }
      
      return config;
    }
    
    return null; // No more stages
  }

  /**
   * Create orchestration state for new run
   */
  createOrchestrationState(mode: 'testing' | 'production'): OrchestrationState {
    const stageConfigs = this.getStageConfig(mode);
    const enabledStages = stageConfigs.filter(s => s.enabled);
    
    return {
      current_stage: 0,
      total_stages: enabledStages.length,
      stage_results: [],
      should_terminate: false
    };
  }

  /**
   * Update orchestration state with stage results
   */
  updateOrchestrationState(
    state: OrchestrationState,
    stageResult: {
      stage_name: string;
      predictions: ModelPrediction[];
      consensus: ConsensusResult;
      cost: number;
      duration_ms: number;
    },
    terminationCheck?: {
      should_terminate: boolean;
      reason?: string;
      confidence: number;
    }
  ): OrchestrationState {
    const updatedState = {
      ...state,
      current_stage: state.current_stage + 1,
      stage_results: [
        ...state.stage_results,
        {
          ...stageResult,
          completed_at: Date.now()
        }
      ],
      should_terminate: terminationCheck?.should_terminate || false,
      termination_reason: terminationCheck?.reason,
      final_consensus: terminationCheck?.should_terminate ? stageResult.consensus : state.final_consensus
    };
    
    return updatedState;
  }

  /**
   * Get execution summary
   */
  getExecutionSummary(state: OrchestrationState): {
    stages_completed: number;
    total_stages: number;
    total_cost: number;
    total_duration: number;
    final_consensus_strength: number;
    termination_reason?: string;
    stage_breakdown: Array<{
      stage_name: string;
      predictions_count: number;
      consensus_strength: number;
      cost: number;
      duration_ms: number;
    }>;
  } {
    const totalCost = state.stage_results.reduce((sum, result) => sum + result.cost, 0);
    const totalDuration = state.stage_results.reduce((sum, result) => sum + result.duration_ms, 0);
    
    const stageBreakdown = state.stage_results.map(result => ({
      stage_name: result.stage_name,
      predictions_count: result.predictions.length,
      consensus_strength: result.consensus.consensus_strength,
      cost: result.cost,
      duration_ms: result.duration_ms
    }));
    
    return {
      stages_completed: state.current_stage,
      total_stages: state.total_stages,
      total_cost: totalCost,
      total_duration: totalDuration,
      final_consensus_strength: state.final_consensus?.consensus_strength || 0,
      termination_reason: state.termination_reason,
      stage_breakdown: stageBreakdown
    };
  }

  /**
   * Check if stage should be skipped based on previous results
   */
  shouldSkipStage(
    stageConfig: StageConfig,
    orchestrationState: OrchestrationState
  ): boolean {
    // Skip evaluation stages if no predictions from previous stage
    if (stageConfig.models.length === 0) {
      const lastResult = orchestrationState.stage_results[orchestrationState.stage_results.length - 1];
      return !lastResult || lastResult.predictions.length === 0;
    }
    
    return false;
  }

  /**
   * Get adaptive parameters for next stage based on previous results
   */
  getAdaptiveParameters(
    stageConfig: StageConfig,
    orchestrationState: OrchestrationState
  ): Partial<StageConfig> {
    const lastResult = orchestrationState.stage_results[orchestrationState.stage_results.length - 1];
    
    if (!lastResult) {
      return stageConfig;
    }
    
    // Adjust parameters based on previous consensus
    const adaptiveParams: Partial<StageConfig> = { ...stageConfig };
    
    // If consensus was very strong, we might reduce temperature for more focused search
    if (lastResult.consensus.consensus_strength > 0.9) {
      adaptiveParams.temperature = Math.max(0.1, stageConfig.temperature * 0.8);
    }
    
    // If diversity was very low, we might increase temperature to explore more
    if (lastResult.consensus.diversity_score < 0.2) {
      adaptiveParams.temperature = Math.min(0.8, stageConfig.temperature * 1.2);
    }
    
    return adaptiveParams;
  }
}
