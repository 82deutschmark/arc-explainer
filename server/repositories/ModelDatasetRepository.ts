/**
 * 
 * Author: Cascade (FIXED THE CRITICAL LOGIC ERROR + ARCHITECTURE FIX 2025-10-10)
 * Date: 2025-09-26T20:43:42-04:00 (updated 2025-10-10)
 * PURPOSE: CANONICAL SOURCE for all dataset operations including:
 * - Model performance queries on ANY ARC dataset
 * - Dataset discovery (filesystem-based)
 * - Puzzle ID retrieval from datasets (single source of truth)
 * 
 * ARCHITECTURE FIX (2025-10-10): 
 * - getPuzzleIdsFromDataset() now PUBLIC (was private)
 * - Used by MetricsRepository for model comparisons (SRP delegation pattern)
 * - Eliminates DRY violation where MetricsRepository duplicated dataset logic
 * 
 * Dynamic dataset selection like retry-failed-puzzles.ts - no hardcoded puzzle IDs!
 * FIXED: Correct three-way classification using explicit boolean checks (not just NULL fallback)
 * - CORRECT: is_prediction_correct = true OR multi_test_all_correct = true
 * - INCORRECT: is_prediction_correct = false OR multi_test_all_correct = false  
 * - NOT ATTEMPTED: No entry OR indeterminate (NULL correctness values)
 * 
 * SRP and DRY check: Pass - Single responsibility for all dataset operations
 */

import { BaseRepository } from './base/BaseRepository.ts';
import { logger } from '../utils/logger.ts';
import fs from 'fs';
import path from 'path';
import { MODELS } from '../config/models.ts';

interface ModelDatasetPerformance {
  modelName: string;
  dataset: string;
  correct: string[];
  incorrect: string[];
  notAttempted: string[];
  summary: {
    correct: number;
    incorrect: number;
    notAttempted: number;
    totalPuzzles: number;
  };
}

interface DatasetInfo {
  name: string;
  puzzleCount: number;
  path: string;
}

export interface ModelDatasetMetrics {
  modelName: string;
  dataset: string;
  overall: {
    count: number;
    avgCost: number;
    totalCost: number;
    avgTime: number;
    totalTime: number;
    avgTokens: number;
    totalTokens: number;
  };
  correct: {
    count: number;
    avgCost: number;
    totalCost: number;
    avgTime: number;
    avgTokens: number;
  };
  incorrect: {
    count: number;
    avgCost: number;
    totalCost: number;
    avgTime: number;
    avgTokens: number;
  };
}

export class ModelDatasetRepository extends BaseRepository {
  
  /**
   * Get all available datasets (like retry-failed-puzzles.ts getPuzzleIdsFromDirectory)
   * Dynamic discovery - no hardcoding!
   */
  async getAvailableDatasets(): Promise<DatasetInfo[]> {
    const datasets: DatasetInfo[] = [];
    const dataDir = path.join(process.cwd(), 'data');
    
    try {
      if (!fs.existsSync(dataDir)) {
        logger.warn('Data directory not found - no datasets available', 'dataset');
        return [];
      }

      const directories = fs.readdirSync(dataDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const dirName of directories) {
        const dirPath = path.join(dataDir, dirName);
        const jsonFiles = fs.readdirSync(dirPath)
          .filter(file => file.endsWith('.json'))
          .length;

        if (jsonFiles > 0) {
          datasets.push({
            name: dirName,
            puzzleCount: jsonFiles,
            path: dirPath
          });
        }
      }

      logger.info(`Found ${datasets.length} datasets: ${datasets.map(d => d.name).join(', ')}`, 'dataset');
      return datasets.sort((a, b) => a.name.localeCompare(b.name));
      
    } catch (error) {
      logger.error(`Error getting available datasets: ${error instanceof Error ? error.message : String(error)}`, 'dataset');
      return [];
    }
  }

  /**
   * Get puzzle IDs from a specific dataset directory (exactly like retry-failed-puzzles.ts)
   * PUBLIC: Now the canonical source for mapping dataset names to puzzle IDs
   * Used by MetricsRepository for model comparisons (SRP delegation pattern)
   */
  public getPuzzleIdsFromDataset(datasetName: string): string[] {
    try {
      const directory = path.join(process.cwd(), 'data', datasetName);
      
      if (!fs.existsSync(directory)) {
        logger.warn(`Dataset directory not found: ${directory}`, 'dataset');
        return [];
      }

      // Read all JSON files in the directory (exactly like retry-failed-puzzles.ts line 42-44)
      const files = fs.readdirSync(directory)
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));

      if (files.length === 0) {
        logger.warn(`No JSON files found in dataset: ${datasetName}`, 'dataset');
        return [];
      }

      logger.info(`Found ${files.length} puzzle files in dataset: ${datasetName}`, 'dataset');
      return files.sort();
      
    } catch (error) {
      logger.error(`Error reading puzzle files from dataset ${datasetName}: ${error instanceof Error ? error.message : String(error)}`, 'dataset');
      return [];
    }
  }
  /**
   * Get model performance on ANY dataset - completely dynamic!
   * Uses exact same query logic as puzzle-analysis.ts (lines 48-54)
   */
  async getModelDatasetPerformance(modelName: string, datasetName: string): Promise<ModelDatasetPerformance> {
    if (!this.isConnected()) {
      return {
        modelName,
        dataset: datasetName,
        correct: [],
        incorrect: [],
        notAttempted: [],
        summary: { correct: 0, incorrect: 0, notAttempted: 0, totalPuzzles: 0 }
      };
    }

    try {
      // Get puzzle IDs from the specified dataset directory (dynamic!)
      const datasetPuzzles = this.getPuzzleIdsFromDataset(datasetName);
      if (datasetPuzzles.length === 0) {
        return {
          modelName,
          dataset: datasetName,
          correct: [],
          incorrect: [],
          notAttempted: [],
          summary: { correct: 0, incorrect: 0, notAttempted: 0, totalPuzzles: 0 }
        };
      }
      // SIMPLIFIED: Just two categories for attempts - correct or incorrect
      const attemptedQuery = `
        SELECT DISTINCT
          puzzle_id,
          CASE
            -- CORRECT: Either field is explicitly true
            WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 'correct'
            
            -- INCORRECT: Everything else (false OR null) - all count as failures
            ELSE 'incorrect'
          END as result,
          created_at
        FROM explanations
        WHERE model_name ILIKE $1
        AND puzzle_id = ANY($2)
        AND (predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL)
        ORDER BY puzzle_id, created_at DESC
      `;

      const result = await this.query(attemptedQuery, [modelName, datasetPuzzles]);
      
      // Process results to get unique puzzles (most recent attempt for each)
      const attemptedPuzzles = new Map<string, 'correct' | 'incorrect'>();
      
      for (const row of result.rows) {
        if (!attemptedPuzzles.has(row.puzzle_id)) {
          attemptedPuzzles.set(row.puzzle_id, row.result);
        }
      }

      // Categorize based on database results
      const correct: string[] = [];
      const incorrect: string[] = [];
      const notAttempted: string[] = [];

      for (const puzzleId of datasetPuzzles) {
        const result = attemptedPuzzles.get(puzzleId);
        
        if (result === 'correct') {
          correct.push(puzzleId);
        } else if (result === 'incorrect') {
          incorrect.push(puzzleId);
        } else {
          // No database entry at all - truly not attempted
          notAttempted.push(puzzleId);
        }
      }

      return {
        modelName,
        dataset: datasetName,
        correct: correct.sort(),
        incorrect: incorrect.sort(), 
        notAttempted: notAttempted.sort(),
        summary: {
          correct: correct.length,
          incorrect: incorrect.length,
          notAttempted: notAttempted.length,
          totalPuzzles: datasetPuzzles.length
        }
      };

    } catch (error) {
      logger.error(`Error getting model dataset performance for ${modelName} on ${datasetName}: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get list of all models that have attempted any puzzles in database
   */
  async getAvailableModels(): Promise<string[]> {
    if (!this.isConnected()) {
      return [];
    }

    try {
      const query = `
        SELECT DISTINCT model_name 
        FROM explanations 
        WHERE model_name IS NOT NULL 
        AND model_name != ''
        ORDER BY model_name ASC
      `;

      const result = await this.query(query);
      const models = result.rows.map(row => row.model_name as string);

      const releaseDateByModel = new Map<string, number>();
      for (const modelConfig of MODELS) {
        const date = modelConfig.releaseDate;
        if (!date) {
          continue;
        }

        const parsed = Date.parse(`${date}-01`);
        if (!Number.isNaN(parsed)) {
          releaseDateByModel.set(modelConfig.key, parsed);
        }
      }

      models.sort((a, b) => {
        const releaseA = releaseDateByModel.get(a) ?? 0;
        const releaseB = releaseDateByModel.get(b) ?? 0;

        if (releaseA !== releaseB) {
          return releaseB - releaseA; // most recent first
        }

        return a.localeCompare(b);
      });

      logger.info(`Found ${models.length} models with database entries`, 'dataset');
      return models;
      
    } catch (error) {
      logger.error(`Error getting available models: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get aggregate metrics (cost, time, tokens) for a model on a specific dataset
   * SRP: Handles ONLY model-dataset metric aggregation (single model on single dataset)
   * Returns metrics broken down by correct/incorrect categories
   */
  async getModelDatasetMetrics(modelName: string, datasetName: string): Promise<ModelDatasetMetrics> {
    if (!this.isConnected()) {
      logger.warn('Database not connected - returning empty metrics', 'database');
      return {
        modelName,
        dataset: datasetName,
        overall: { count: 0, avgCost: 0, totalCost: 0, avgTime: 0, totalTime: 0, avgTokens: 0, totalTokens: 0 },
        correct: { count: 0, avgCost: 0, totalCost: 0, avgTime: 0, avgTokens: 0 },
        incorrect: { count: 0, avgCost: 0, totalCost: 0, avgTime: 0, avgTokens: 0 }
      };
    }

    try {
      // DRY: Reuse existing getPuzzleIdsFromDataset method
      const datasetPuzzles = this.getPuzzleIdsFromDataset(datasetName);
      if (datasetPuzzles.length === 0) {
        logger.warn(`No puzzles found for dataset: ${datasetName}`, 'dataset');
        return {
          modelName,
          dataset: datasetName,
          overall: { count: 0, avgCost: 0, totalCost: 0, avgTime: 0, totalTime: 0, avgTokens: 0, totalTokens: 0 },
          correct: { count: 0, avgCost: 0, totalCost: 0, avgTime: 0, avgTokens: 0 },
          incorrect: { count: 0, avgCost: 0, totalCost: 0, avgTime: 0, avgTokens: 0 }
        };
      }

      // Single efficient query with FILTER clauses for performance
      // Uses PostgreSQL FILTER syntax to compute aggregates for subsets
      const query = `
        SELECT 
          COUNT(*) as total_count,
          COALESCE(AVG(estimated_cost), 0) as avg_cost_all,
          COALESCE(SUM(estimated_cost), 0) as total_cost_all,
          COALESCE(AVG(api_processing_time_ms), 0) as avg_time_all,
          COALESCE(SUM(api_processing_time_ms), 0) as total_time_all,
          COALESCE(AVG(total_tokens), 0) as avg_tokens_all,
          COALESCE(SUM(total_tokens), 0) as total_tokens_all,
          
          -- Correct subset (matches getModelDatasetPerformance logic)
          COUNT(*) FILTER (WHERE is_prediction_correct = true OR multi_test_all_correct = true) as count_correct,
          COALESCE(AVG(estimated_cost) FILTER (WHERE is_prediction_correct = true OR multi_test_all_correct = true), 0) as avg_cost_correct,
          COALESCE(SUM(estimated_cost) FILTER (WHERE is_prediction_correct = true OR multi_test_all_correct = true), 0) as total_cost_correct,
          COALESCE(AVG(api_processing_time_ms) FILTER (WHERE is_prediction_correct = true OR multi_test_all_correct = true), 0) as avg_time_correct,
          COALESCE(AVG(total_tokens) FILTER (WHERE is_prediction_correct = true OR multi_test_all_correct = true), 0) as avg_tokens_correct,
          
          -- Incorrect subset (everything else that was attempted)
          COUNT(*) FILTER (WHERE NOT (is_prediction_correct = true OR multi_test_all_correct = true)) as count_incorrect,
          COALESCE(AVG(estimated_cost) FILTER (WHERE NOT (is_prediction_correct = true OR multi_test_all_correct = true)), 0) as avg_cost_incorrect,
          COALESCE(SUM(estimated_cost) FILTER (WHERE NOT (is_prediction_correct = true OR multi_test_all_correct = true)), 0) as total_cost_incorrect,
          COALESCE(AVG(api_processing_time_ms) FILTER (WHERE NOT (is_prediction_correct = true OR multi_test_all_correct = true)), 0) as avg_time_incorrect,
          COALESCE(AVG(total_tokens) FILTER (WHERE NOT (is_prediction_correct = true OR multi_test_all_correct = true)), 0) as avg_tokens_incorrect
        FROM explanations
        WHERE model_name ILIKE $1
        AND puzzle_id = ANY($2)
        AND (predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL)
      `;

      const result = await this.query(query, [modelName, datasetPuzzles]);
      
      if (result.rows.length === 0) {
        logger.warn(`No metrics found for ${modelName} on ${datasetName}`, 'dataset');
        return {
          modelName,
          dataset: datasetName,
          overall: { count: 0, avgCost: 0, totalCost: 0, avgTime: 0, totalTime: 0, avgTokens: 0, totalTokens: 0 },
          correct: { count: 0, avgCost: 0, totalCost: 0, avgTime: 0, avgTokens: 0 },
          incorrect: { count: 0, avgCost: 0, totalCost: 0, avgTime: 0, avgTokens: 0 }
        };
      }

      const row = result.rows[0];

      logger.info(
        `Metrics for ${modelName} on ${datasetName}: ${row.total_count} total, ${row.count_correct} correct, ${row.count_incorrect} incorrect`,
        'dataset'
      );

      return {
        modelName,
        dataset: datasetName,
        overall: {
          count: parseInt(row.total_count) || 0,
          avgCost: parseFloat(row.avg_cost_all) || 0,
          totalCost: parseFloat(row.total_cost_all) || 0,
          avgTime: parseFloat(row.avg_time_all) || 0,
          totalTime: parseFloat(row.total_time_all) || 0,
          avgTokens: parseFloat(row.avg_tokens_all) || 0,
          totalTokens: parseFloat(row.total_tokens_all) || 0,
        },
        correct: {
          count: parseInt(row.count_correct) || 0,
          avgCost: parseFloat(row.avg_cost_correct) || 0,
          totalCost: parseFloat(row.total_cost_correct) || 0,
          avgTime: parseFloat(row.avg_time_correct) || 0,
          avgTokens: parseFloat(row.avg_tokens_correct) || 0,
        },
        incorrect: {
          count: parseInt(row.count_incorrect) || 0,
          avgCost: parseFloat(row.avg_cost_incorrect) || 0,
          totalCost: parseFloat(row.total_cost_incorrect) || 0,
          avgTime: parseFloat(row.avg_time_incorrect) || 0,
          avgTokens: parseFloat(row.avg_tokens_incorrect) || 0,
        }
      };

    } catch (error) {
      logger.error(`Error getting model dataset metrics for ${modelName} on ${datasetName}: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

}

export default new ModelDatasetRepository();
