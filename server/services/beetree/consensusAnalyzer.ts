/**
 * server/services/beetree/consensusAnalyzer.ts
 * 
 * Consensus analysis utilities for beetreeARC ensemble solver
 * Analyzes multi-model results to identify consensus solutions
 * 
 * Author: Cascade (model: Cascade GPT-5 medium reasoning)
 * Date: 2025-12-01
 * PURPOSE: Analyze ensemble results to determine consensus and confidence scores
 * SRP/DRY check: Pass - Focused solely on consensus analysis and aggregation
 */

export interface ModelPrediction {
  model_name: string;
  prediction: number[][];
  confidence?: number;
  reasoning?: string;
  stage: string;
}

export interface ConsensusResult {
  consensus_grid: number[][];
  consensus_strength: number; // 0-1, higher = stronger consensus
  model_agreement: number; // 0-1, percentage of models agreeing
  top_solutions: Array<{
    grid: number[][];
    support_count: number;
    supporting_models: string[];
    confidence: number;
  }>;
  diversity_score: number; // 0-1, higher = more diverse solutions
  stage_distribution: Record<string, number>; // Which stages produced which solutions
}

export interface GridComparisonResult {
  is_identical: boolean;
  similarity_score: number; // 0-1
  cell_differences: number;
  total_cells: number;
}

export class ConsensusAnalyzer {
  /**
   * Analyze model predictions to find consensus
   */
  analyzeConsensus(predictions: ModelPrediction[]): ConsensusResult {
    if (predictions.length === 0) {
      throw new Error('No predictions to analyze');
    }

    // Group identical predictions
    const solutionGroups = this.groupIdenticalPredictions(predictions);
    
    // Calculate consensus strength
    const consensusStrength = this.calculateConsensusStrength(solutionGroups, predictions.length);
    
    // Get top solutions
    const topSolutions = this.getTopSolutions(solutionGroups);
    
    // Calculate diversity score
    const diversityScore = this.calculateDiversityScore(solutionGroups);
    
    // Analyze stage distribution
    const stageDistribution = this.analyzeStageDistribution(predictions);
    
    // Determine consensus grid
    const consensusGrid = consensusStrength > 0.5 ? topSolutions[0].grid : this.createConsensusGrid(topSolutions);

    return {
      consensus_grid: consensusGrid,
      consensus_strength: consensusStrength,
      model_agreement: topSolutions[0]?.support_count / predictions.length || 0,
      top_solutions: topSolutions,
      diversity_score: diversityScore,
      stage_distribution: stageDistribution
    };
  }

  /**
   * Group identical predictions together
   */
  private groupIdenticalPredictions(predictions: ModelPrediction[]): Map<string, ModelPrediction[]> {
    const groups = new Map<string, ModelPrediction[]>();
    
    for (const prediction of predictions) {
      const gridKey = this.gridToString(prediction.prediction);
      
      if (!groups.has(gridKey)) {
        groups.set(gridKey, []);
      }
      
      groups.get(gridKey)!.push(prediction);
    }
    
    return groups;
  }

  /**
   * Convert grid to string key for comparison
   */
  private gridToString(grid: number[][]): string {
    return grid.map(row => row.join(',')).join('|');
  }

  /**
   * Calculate consensus strength based on solution distribution
   */
  private calculateConsensusStrength(
    solutionGroups: Map<string, ModelPrediction[]>,
    totalPredictions: number
  ): number {
    if (solutionGroups.size === 0) return 0;
    
    // Find the largest group
    const largestGroupSize = Math.max(...Array.from(solutionGroups.values()).map(group => group.length));
    
    // Consensus strength is the proportion of models in the largest group
    return largestGroupSize / totalPredictions;
  }

  /**
   * Get top solutions sorted by support
   */
  private getTopSolutions(solutionGroups: Map<string, ModelPrediction[]>): Array<{
    grid: number[][];
    support_count: number;
    supporting_models: string[];
    confidence: number;
  }> {
    const solutions = Array.from(solutionGroups.entries()).map(([gridKey, group]) => {
      const grid = this.stringToGrid(gridKey);
      const supportingModels = group.map(p => p.model_name);
      const avgConfidence = group.reduce((sum, p) => sum + (p.confidence || 0.5), 0) / group.length;
      
      return {
        grid,
        support_count: group.length,
        supporting_models: supportingModels,
        confidence: avgConfidence
      };
    });
    
    return solutions.sort((a, b) => b.support_count - a.support_count);
  }

  /**
   * Convert string key back to grid
   */
  private stringToGrid(gridKey: string): number[][] {
    return gridKey.split('|').map(row => row.split(',').map(cell => parseInt(cell, 10)));
  }

  /**
   * Calculate diversity score of solutions
   */
  private calculateDiversityScore(solutionGroups: Map<string, ModelPrediction[]>): number {
    if (solutionGroups.size <= 1) return 0;
    
    // Diversity is based on number of distinct solutions and their distribution
    const totalSolutions = Array.from(solutionGroups.values()).reduce((sum, group) => sum + group.length, 0);
    const distinctSolutions = solutionGroups.size;
    
    // Normalize by maximum possible diversity (all models produce different solutions)
    return Math.min(distinctSolutions / totalSolutions, 1);
  }

  /**
   * Analyze which stages produced which solutions
   */
  private analyzeStageDistribution(predictions: ModelPrediction[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const prediction of predictions) {
      const stage = prediction.stage || 'Unknown';
      distribution[stage] = (distribution[stage] || 0) + 1;
    }
    
    return distribution;
  }

  /**
   * Create consensus grid by taking most common value for each cell
   */
  private createConsensusGrid(topSolutions: Array<{
    grid: number[][];
    support_count: number;
    supporting_models: string[];
    confidence: number;
  }>): number[][] {
    if (topSolutions.length === 0) return [];
    
    const firstGrid = topSolutions[0].grid;
    const rows = firstGrid.length;
    const cols = firstGrid[0]?.length || 0;
    
    // Create weighted consensus by cell
    const consensusGrid: number[][] = [];
    
    for (let r = 0; r < rows; r++) {
      const consensusRow: number[] = [];
      for (let c = 0; c < cols; c++) {
        const cellVotes = new Map<number, number>();
        
        // Count votes for each cell value, weighted by solution support
        for (const solution of topSolutions) {
          const cellValue = solution.grid[r]?.[c] ?? 0;
          cellVotes.set(cellValue, (cellVotes.get(cellValue) || 0) + solution.support_count);
        }
        
        // Choose value with highest weighted votes
        let bestValue = 0;
        let maxVotes = 0;
        
        for (const [value, votes] of cellVotes) {
          if (votes > maxVotes) {
            maxVotes = votes;
            bestValue = value;
          }
        }
        
        consensusRow.push(bestValue);
      }
      consensusGrid.push(consensusRow);
    }
    
    return consensusGrid;
  }

  /**
   * Compare two grids for similarity
   */
  compareGrids(grid1: number[][], grid2: number[][]): GridComparisonResult {
    if (grid1.length !== grid2.length || grid1[0]?.length !== grid2[0]?.length) {
      return {
        is_identical: false,
        similarity_score: 0,
        cell_differences: -1,
        total_cells: -1
      };
    }
    
    const rows = grid1.length;
    const cols = grid1[0].length;
    const totalCells = rows * cols;
    let identicalCells = 0;
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid1[r][c] === grid2[r][c]) {
          identicalCells++;
        }
      }
    }
    
    const cellDifferences = totalCells - identicalCells;
    const similarityScore = identicalCells / totalCells;
    
    return {
      is_identical: cellDifferences === 0,
      similarity_score: similarityScore,
      cell_differences: cellDifferences,
      total_cells: totalCells
    };
  }

  /**
   * Find the most similar grid to a target from a list
   */
  findMostSimilar(targetGrid: number[][], candidateGrids: number[][][]): {
    grid: number[][];
    similarity: number;
  } {
    let bestMatch = { grid: candidateGrids[0] || [], similarity: 0 };
    
    for (const candidate of candidateGrids) {
      const comparison = this.compareGrids(targetGrid, candidate);
      if (comparison.similarity_score > bestMatch.similarity) {
        bestMatch = { grid: candidate, similarity: comparison.similarity_score };
      }
    }
    
    return bestMatch;
  }

  /**
   * Calculate confidence score for a prediction based on ensemble support
   */
  calculateEnsembleConfidence(
    targetGrid: number[][],
    allPredictions: ModelPrediction[]
  ): number {
    const similarPredictions = allPredictions.filter(p => {
      const comparison = this.compareGrids(targetGrid, p.prediction);
      return comparison.similarity_score >= 0.8; // 80% similarity threshold
    });
    
    // Confidence based on proportion of similar predictions
    return similarPredictions.length / allPredictions.length;
  }

  /**
   * Detect outlier predictions (those that don't match any consensus)
   */
  detectOutliers(predictions: ModelPrediction[]): ModelPrediction[] {
    if (predictions.length <= 2) return [];
    
    const consensus = this.analyzeConsensus(predictions);
    const consensusGrid = consensus.consensus_grid;
    
    return predictions.filter(p => {
      const comparison = this.compareGrids(p.prediction, consensusGrid);
      return comparison.similarity_score < 0.6; // Less than 60% similar to consensus
    });
  }

  /**
   * Get summary statistics for ensemble results
   */
  getEnsembleStats(predictions: ModelPrediction[]): {
    total_predictions: number;
    unique_solutions: number;
    consensus_strength: number;
    diversity_score: number;
    outlier_count: number;
    avg_similarity: number;
  } {
    const consensus = this.analyzeConsensus(predictions);
    const outliers = this.detectOutliers(predictions);
    
    // Calculate average pairwise similarity
    let totalSimilarity = 0;
    let comparisonCount = 0;
    
    for (let i = 0; i < predictions.length; i++) {
      for (let j = i + 1; j < predictions.length; j++) {
        const comparison = this.compareGrids(predictions[i].prediction, predictions[j].prediction);
        totalSimilarity += comparison.similarity_score;
        comparisonCount++;
      }
    }
    
    const avgSimilarity = comparisonCount > 0 ? totalSimilarity / comparisonCount : 0;
    
    return {
      total_predictions: predictions.length,
      unique_solutions: consensus.top_solutions.length,
      consensus_strength: consensus.consensus_strength,
      diversity_score: consensus.diversity_score,
      outlier_count: outliers.length,
      avg_similarity: avgSimilarity
    };
  }
}
