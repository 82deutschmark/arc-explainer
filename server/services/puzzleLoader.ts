import fs from 'fs';
import path from 'path';
import type { ARCTask, PuzzleMetadata } from '@shared/types';
import { githubService } from './githubService';

interface PuzzleInfo extends PuzzleMetadata {
  maxGridSize: number;
  inputSize: [number, number];
  outputSize: [number, number];
  gridSizeConsistent: boolean;
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
    
    // Download puzzles if we don't have many locally
    const localPuzzles = githubService.getLocalPuzzles();
    console.log(`Found ${localPuzzles.length} local puzzles`);
    
    if (localPuzzles.length < 10) {
      console.log('Downloading puzzles from GitHub...');
      const downloaded = await githubService.downloadSmallPuzzles(30);
      console.log(`Downloaded ${downloaded} puzzles`);
    }
    
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

    // Determine difficulty based on grid size and complexity
    let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
    if (maxGridSize <= 5) {
      difficulty = 'easy';
    } else if (maxGridSize >= 15) {
      difficulty = 'hard';
    }

    return {
      id: taskId,
      difficulty,
      gridSizeConsistent,
      patternType: 'transformation', // Could be enhanced with pattern detection
      maxGridSize,
      inputSize,
      outputSize,
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
    difficulty?: 'easy' | 'medium' | 'hard';
    gridSizeConsistent?: boolean;
  }): PuzzleInfo[] {
    let puzzles = Array.from(this.puzzleMetadata.values());

    if (filters) {
      if (filters.maxGridSize !== undefined) {
        puzzles = puzzles.filter(p => p.maxGridSize <= filters.maxGridSize!);
      }
      if (filters.minGridSize !== undefined) {
        puzzles = puzzles.filter(p => p.maxGridSize >= filters.minGridSize!);
      }
      if (filters.difficulty) {
        puzzles = puzzles.filter(p => p.difficulty === filters.difficulty);
      }
      if (filters.gridSizeConsistent !== undefined) {
        puzzles = puzzles.filter(p => p.gridSizeConsistent === filters.gridSizeConsistent);
      }
    }

    // Sort by grid size (smaller first) and then by ID
    return puzzles.sort((a, b) => {
      if (a.maxGridSize !== b.maxGridSize) {
        return a.maxGridSize - b.maxGridSize;
      }
      return a.id.localeCompare(b.id);
    });
  }

  getPuzzleMetadata(taskId: string): PuzzleInfo | null {
    return this.puzzleMetadata.get(taskId) || null;
  }

  async downloadPuzzle(taskId: string): Promise<boolean> {
    const success = await githubService.downloadPuzzle(taskId);
    if (success) {
      // Reload metadata after download
      this.loadPuzzleMetadata();
    }
    return success;
  }

  getAvailablePuzzleIds(): string[] {
    return Array.from(this.puzzleMetadata.keys()).sort();
  }
}

export const puzzleLoader = new PuzzleLoader();