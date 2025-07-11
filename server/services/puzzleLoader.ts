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
}

export class PuzzleLoader {
  private puzzleCache: Map<string, ARCTask> = new Map();
  private puzzleMetadata: Map<string, PuzzleInfo> = new Map();
  private dataDir = path.join(process.cwd(), 'data', 'training');
  private initialized = false;

  constructor() {
    this.initializeData();
  }

  private async initializeData() {
    if (this.initialized) return;
    
    console.log('Loading local puzzles...');
    this.loadPuzzleMetadata();
    this.initialized = true;
  }

  private loadPuzzleMetadata() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        console.log('Training data directory not found, creating...');
        fs.mkdirSync(this.dataDir, { recursive: true });
        return;
      }

      const files = fs.readdirSync(this.dataDir).filter(file => file.endsWith('.json'));
      console.log(`Found ${files.length} puzzle files`);

      for (const file of files) {
        try {
          const taskId = file.replace('.json', '');
          const filePath = path.join(this.dataDir, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ARCTask;
          
          // Analyze the puzzle to get metadata
          const metadata = this.analyzePuzzleMetadata(taskId, data);
          this.puzzleMetadata.set(taskId, metadata);
          
        } catch (error) {
          console.error(`Error loading puzzle ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Error loading puzzle metadata:', error);
    }
  }

  private analyzePuzzleMetadata(taskId: string, task: ARCTask): PuzzleInfo {
    let maxGridSize = 0;
    let inputSize: [number, number] = [0, 0];
    let outputSize: [number, number] = [0, 0];
    let gridSizeConsistent = true;

    if (task.train.length > 0) {
      const firstExample = task.train[0];
      inputSize = [firstExample.input.length, firstExample.input[0]?.length || 0];
      outputSize = [firstExample.output.length, firstExample.output[0]?.length || 0];
      
      // Check all examples for consistency and find max grid size
      for (const example of [...task.train, ...task.test]) {
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
    }

    // Check if this puzzle has been explained already
    const explainedDir = path.join(process.cwd(), 'data', 'explained');
    let hasExplanation = false;
    try {
      if (fs.existsSync(explainedDir)) {
        const explainedFile = path.join(explainedDir, `${taskId}-EXPLAINED.json`);
        hasExplanation = fs.existsSync(explainedFile);
      }
    } catch (error) {
      // Ignore errors checking explanation files
    }

    return {
      id: taskId,
      gridSizeConsistent,
      patternType: 'transformation',
      maxGridSize,
      inputSize,
      outputSize,
      hasExplanation,
    };
  }

  async loadPuzzle(taskId: string): Promise<ARCTask | null> {
    // Check cache first
    if (this.puzzleCache.has(taskId)) {
      return this.puzzleCache.get(taskId)!;
    }

    try {
      const filePath = path.join(this.dataDir, `${taskId}.json`);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ARCTask;
      this.puzzleCache.set(taskId, data);
      return data;
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
  }): PuzzleInfo[] {
    let puzzles = Array.from(this.puzzleMetadata.values());

    if (filters) {
      if (filters.maxGridSize !== undefined) {
        puzzles = puzzles.filter(p => p.maxGridSize <= filters.maxGridSize!);
      }
      if (filters.minGridSize !== undefined) {
        puzzles = puzzles.filter(p => p.maxGridSize >= filters.minGridSize!);
      }
      if (filters.gridSizeConsistent !== undefined) {
        puzzles = puzzles.filter(p => p.gridSizeConsistent === filters.gridSizeConsistent);
      }
      if (filters.prioritizeUnexplained) {
        puzzles = puzzles.filter(p => !p.hasExplanation);
      }
    }

    // Simple sort by ID (frontend handles more complex sorting)
    return puzzles.sort((a, b) => a.id.localeCompare(b.id));
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