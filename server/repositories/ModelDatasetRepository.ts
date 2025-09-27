/**
 * 
 * Author: Claude 4 Sonnet
 * Date: 2025-09-26T16:03:24-04:00
 * PURPOSE: REAL database queries for model performance on ANY ARC dataset.
 * Dynamic dataset selection like retry-failed-puzzles.ts - no hardcoded puzzle IDs!
 * Shows which puzzles each model solved correctly (is_prediction_correct OR multi_test_all_correct), 
 * failed, or hasn't attempted. Based on puzzle-analysis.ts exact query logic.
 * SRP and DRY check: Pass - Single responsibility for model dataset performance, reuses database connection patterns
 */

import { BaseRepository } from './base/BaseRepository.ts';
import { logger } from '../utils/logger.ts';
import fs from 'fs';
import path from 'path';

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
   */
  private getPuzzleIdsFromDataset(datasetName: string): string[] {
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
      // Use EXACT same logic as AccuracyRepository.getPureAccuracyStats()
      const attemptedQuery = `
        SELECT DISTINCT
          puzzle_id,
          CASE
            -- CORRECT: Either single-test OR multi-test correct
            WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 'correct'
            
            -- INCORRECT: Everything else that was attempted (has prediction grids)
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
          // Actually not attempted - no database entry at all
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
      const models = result.rows.map(row => row.model_name);

      logger.info(`Found ${models.length} models with database entries`, 'dataset');
      return models;
      
    } catch (error) {
      logger.error(`Error getting available models: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

}

export default new ModelDatasetRepository();
