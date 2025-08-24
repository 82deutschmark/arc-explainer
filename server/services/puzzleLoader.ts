/**
 * PuzzleLoader.ts - Service to load ARC puzzle data from local directories
 * 
 * This module handles loading puzzle data from multiple sources with priority:
 * ARC1-Eval (evaluation) -> ARC1 (training) -> ARC2-Eval (evaluation2) -> ARC2 (training2)
 * 
 * Puzzles are labeled by their first appearance - ARC1 datasets take precedence over ARC2.
 * 
 * @author Cascade
 */

import fs from 'fs';
import path from 'path';
import type { ARCTask, PuzzleMetadata } from '@shared/types';

interface PuzzleInfo {
  id: string;
  gridSizeConsistent: boolean;
  patternType: string;
  maxGridSize: number;
  inputSize: [number, number];
  outputSize: [number, number];
  hasExplanation: boolean;
  source: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval';
}

interface DataSource {
  name: string;
  directory: string;
  source: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval';
  priority: number;
}

export class PuzzleLoader {
  private puzzleCache: Map<string, ARCTask> = new Map();
  private puzzleMetadata: Map<string, PuzzleInfo> = new Map();
  private explainedDir = path.join(process.cwd(), 'data', 'explained');
  private initialized = false;

  // Centralized data source configuration with explicit priority
  // Priority order: ARC1 datasets take precedence over ARC2 for duplicate puzzles
  private readonly dataSources: DataSource[] = [
    {
      name: 'ARC1-Eval',
      directory: path.join(process.cwd(), 'data', 'evaluation'),
      source: 'ARC1-Eval',
      priority: 1
    },
    {
      name: 'ARC1',
      directory: path.join(process.cwd(), 'data', 'training'),
      source: 'ARC1',
      priority: 2
    },
    {
      name: 'ARC2-Eval',
      directory: path.join(process.cwd(), 'data', 'evaluation2'),
      source: 'ARC2-Eval',
      priority: 3
    },
    {
      name: 'ARC2',
      directory: path.join(process.cwd(), 'data', 'training2'),
      source: 'ARC2',
      priority: 4
    }
  ];

  constructor() {
    this.initializeData();
  }

  // Force reinitialization - useful for development and testing
  public forceReinitialize() {
    this.initialized = false;
    this.puzzleCache.clear();
    this.puzzleMetadata.clear();
    this.initializeData();
  }

  private async initializeData() {
    if (this.initialized) {
      console.log('PuzzleLoader already initialized, skipping initialization');
      return;
    }
    
    console.log('Loading local puzzles...');
    this.loadPuzzleMetadata();
    console.log(`Initialization complete. Loaded metadata for ${this.puzzleMetadata.size} puzzles.`);
    this.initialized = true;
  }

  private loadPuzzleMetadata() {
    try {
      // Ensure all directories exist
      this.ensureDirectoriesExist();

      let totalPuzzles = 0;
      
      // Load puzzles in priority order
      for (const dataSource of this.dataSources.sort((a, b) => a.priority - b.priority)) {
        const loadedCount = this.loadFromDirectory(dataSource);
        totalPuzzles += loadedCount;
      }

      console.log(`Total puzzles loaded: ${totalPuzzles}`);
    } catch (error) {
      console.error('Error loading puzzle metadata:', error);
    }
  }

  private ensureDirectoriesExist() {
    for (const dataSource of this.dataSources) {
      if (!fs.existsSync(dataSource.directory)) {
        console.log(`${dataSource.name} data directory not found, creating...`);
        fs.mkdirSync(dataSource.directory, { recursive: true });
      }
    }
    
    // Ensure explained directory exists
    if (!fs.existsSync(this.explainedDir)) {
      fs.mkdirSync(this.explainedDir, { recursive: true });
    }
  }

  private loadFromDirectory(dataSource: DataSource): number {
    if (!fs.existsSync(dataSource.directory)) {
      return 0;
    }

    const files = fs.readdirSync(dataSource.directory).filter(file => file.endsWith('.json'));
    console.log(`Found ${files.length} puzzle files in ${dataSource.name} directory`);

    let loadedCount = 0;
    for (const file of files) {
      try {
        const taskId = file.replace('.json', '');
        
        // Skip if this puzzle is already loaded
        if (this.puzzleMetadata.has(taskId)) {
          continue;
        }
        
        const filePath = path.join(dataSource.directory, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ARCTask;
        
        // Analyze the puzzle to get metadata
        const metadata = this.analyzePuzzleMetadata(taskId, data, dataSource.source);
        this.puzzleMetadata.set(taskId, metadata);
        loadedCount++;
      } catch (error) {
        console.error(`Error loading puzzle ${file} from ${dataSource.name}:`, error);
      }
    }
    
    return files.length;
  }

  private analyzePuzzleMetadata(taskId: string, task: ARCTask, source: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval'): PuzzleInfo {
    const { maxGridSize, gridSizeConsistent, inputSize, outputSize } = this.getGridDimensions(task);
    const hasExplanation = this.checkHasExplanation(taskId);

    // Fix for ARC1-Eval categorization issue
    if (source === 'ARC1-Eval') {
      // Ensure directory and source are correctly mapped
      source = 'ARC1-Eval';
    } else if (source === 'ARC1') {
      source = 'ARC1';
    } // Add similar checks for other sources if needed

    return {
      id: taskId,
      gridSizeConsistent,
      patternType: 'unknown', // This would require more analysis
      maxGridSize,
      inputSize,
      outputSize,
      hasExplanation,
      source
    };
  }

  private getGridDimensions(task: ARCTask) {
    let maxGridSize = 0;
    let gridSizeConsistent = true;
    let inputSize: [number, number] = [0, 0];
    let outputSize: [number, number] = [0, 0];

    if (task.train && task.train.length > 0) {
      const firstExample = task.train[0];
      inputSize = [firstExample.input.length, firstExample.input[0]?.length || 0];
      outputSize = [firstExample.output.length, firstExample.output[0]?.length || 0];
    }

    // Check all examples for consistency and max size
    const allExamples = [...(task.train || []), ...(task.test || [])];
    for (const example of allExamples) {
      if (!example.input || !example.output) continue;
      
      const inputRows = example.input.length;
      const inputCols = example.input[0]?.length || 0;
      const outputRows = example.output.length;
      const outputCols = example.output[0]?.length || 0;
      
      maxGridSize = Math.max(maxGridSize, inputRows, inputCols, outputRows, outputCols);
      
      // Check if grid sizes are consistent
      if (inputRows !== inputSize[0] || inputCols !== inputSize[1] ||
          outputRows !== outputSize[0] || outputCols !== outputSize[1]) {
        gridSizeConsistent = false;
      }
    }

    return { maxGridSize, gridSizeConsistent, inputSize, outputSize };
  }

  private checkHasExplanation(taskId: string): boolean {
    try {
      const explainedFile = path.join(this.explainedDir, `${taskId}-EXPLAINED.json`);
      return fs.existsSync(explainedFile);
    } catch (error) {
      return false;
    }
  }

  async loadPuzzle(taskId: string): Promise<ARCTask | null> {
    try {
      // Return from cache if available
      if (this.puzzleCache.has(taskId)) {
        return this.puzzleCache.get(taskId) || null;
      }

      // Try to load from directories in priority order
      for (const dataSource of this.dataSources.sort((a, b) => a.priority - b.priority)) {
        const filePath = path.join(dataSource.directory, `${taskId}.json`);
        if (fs.existsSync(filePath)) {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          this.puzzleCache.set(taskId, data);
          return data;
        }
      }

      // Not found in any directory
      return null;
    } catch (error) {
      console.error(`Error loading puzzle ${taskId}:`, error);
      return null;
    }
  }

  getPuzzleList(filters?: {
    maxGridSize?: number;
    minGridSize?: number;
    gridSizeConsistent?: boolean;
    prioritizeUnexplained?: boolean;
    prioritizeExplained?: boolean;
    source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval';
  }): PuzzleInfo[] {
    let puzzles = Array.from(this.puzzleMetadata.values());
    
    if (filters) {
      puzzles = this.applyFilters(puzzles, filters);
    }

    // Simple sort by ID (frontend handles more complex sorting)
    return puzzles.sort((a, b) => a.id.localeCompare(b.id));
  }

  private applyFilters(puzzles: PuzzleInfo[], filters: {
    maxGridSize?: number;
    minGridSize?: number;
    gridSizeConsistent?: boolean;
    prioritizeUnexplained?: boolean;
    prioritizeExplained?: boolean;
    source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval';
  }): PuzzleInfo[] {
    if (filters.maxGridSize !== undefined) {
      puzzles = puzzles.filter(p => p.maxGridSize <= filters.maxGridSize!);
    }
    if (filters.minGridSize !== undefined) {
      puzzles = puzzles.filter(p => p.maxGridSize >= filters.minGridSize!);
    }
    if (filters.gridSizeConsistent !== undefined) {
      puzzles = puzzles.filter(p => p.gridSizeConsistent === filters.gridSizeConsistent);
    }

    if (filters.source) {
      puzzles = puzzles.filter(p => p.source === filters.source);
    }
    
    return puzzles;
  }

  getPuzzleMetadata(taskId: string): PuzzleInfo | null {
    return this.puzzleMetadata.get(taskId) || null;
  }

  async downloadPuzzle(taskId: string): Promise<boolean> {
    // No-op for local puzzles
    return true;
  }

  getAvailablePuzzleIds(): string[] {
    return Array.from(this.puzzleMetadata.keys()).sort();
  }
}

export const puzzleLoader = new PuzzleLoader();