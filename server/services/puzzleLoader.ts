/**
 * PuzzleLoader.ts - Service to load ARC puzzle data from local directories
 * 
 * This module handles loading puzzle data from multiple sources with priority:
 * ARC2-Eval (evaluation2) -> ARC2 (training2) -> ARC1-Eval (evaluation) -> ARC1 (training)
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
  source: 'ARC1' | 'ARC2' | 'ARC2-Eval';
}

export class PuzzleLoader {
  private puzzleCache: Map<string, ARCTask> = new Map();
  private puzzleMetadata: Map<string, PuzzleInfo> = new Map();
  private dataDir1 = path.join(process.cwd(), 'data', 'training');
  private dataDir2 = path.join(process.cwd(), 'data', 'evaluation');
  private dataDir3 = path.join(process.cwd(), 'data', 'training2');
  private dataDir4 = path.join(process.cwd(), 'data', 'evaluation2');
  private initialized = false;

  constructor() {
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
      // Create directories if they don't exist
      if (!fs.existsSync(this.dataDir1)) {
        console.log('Training data directory not found, creating...');
        fs.mkdirSync(this.dataDir1, { recursive: true });
      }
      if (!fs.existsSync(this.dataDir2)) {
        console.log('Evaluation data directory not found, creating...');
        fs.mkdirSync(this.dataDir2, { recursive: true });
      }
      if (!fs.existsSync(this.dataDir3)) {
        console.log('Training2 data directory not found, creating...');
        fs.mkdirSync(this.dataDir3, { recursive: true });
      }
      if (!fs.existsSync(this.dataDir4)) {
        console.log('Evaluation2 data directory not found, creating...');
        fs.mkdirSync(this.dataDir4, { recursive: true });
      }

      // Load puzzles from evaluation2 directory first (ARC2-Eval) - highest priority
      let totalPuzzles = 0;
      if (fs.existsSync(this.dataDir4)) {
        const files = fs.readdirSync(this.dataDir4).filter(file => file.endsWith('.json'));
        console.log(`Found ${files.length} puzzle files in ARC2-Eval directory`);
        totalPuzzles += files.length;

        for (const file of files) {
          try {
            const taskId = file.replace('.json', '');
            const filePath = path.join(this.dataDir4, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ARCTask;
            
            // Analyze the puzzle to get metadata
            const metadata = this.analyzePuzzleMetadata(taskId, data, 'ARC2-Eval');
            this.puzzleMetadata.set(taskId, metadata);
          } catch (error) {
            console.error(`Error loading puzzle ${file} from ARC2-Eval:`, error);
          }
        }
      }
      
      // Load puzzles from training2 directory (ARC2) - second priority
      if (fs.existsSync(this.dataDir3)) {
        const files = fs.readdirSync(this.dataDir3).filter(file => file.endsWith('.json'));
        console.log(`Found ${files.length} puzzle files in ARC2 directory`);
        totalPuzzles += files.length;

        for (const file of files) {
          try {
            const taskId = file.replace('.json', '');
            const filePath = path.join(this.dataDir3, file);
            
            // Skip if already loaded from ARC2-Eval
            if (this.puzzleMetadata.has(taskId)) {
              continue;
            }
            
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ARCTask;
            
            // Analyze the puzzle to get metadata
            const metadata = this.analyzePuzzleMetadata(taskId, data, 'ARC2');
            this.puzzleMetadata.set(taskId, metadata);
          } catch (error) {
            console.error(`Error loading puzzle ${file} from ARC2:`, error);
          }
        }
      }
      
      // Load puzzles from evaluation directory (ARC1-Eval) - third priority
      if (fs.existsSync(this.dataDir2)) {
        const files = fs.readdirSync(this.dataDir2).filter(file => file.endsWith('.json'));
        console.log(`Found ${files.length} puzzle files in ARC1-Eval directory`);
        totalPuzzles += files.length;

        for (const file of files) {
          try {
            const taskId = file.replace('.json', '');
            const filePath = path.join(this.dataDir2, file);
            
            // Skip if already loaded from higher priority directories
            if (this.puzzleMetadata.has(taskId)) {
              continue;
            }
            
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ARCTask;
            
            // Analyze the puzzle to get metadata
            const metadata = this.analyzePuzzleMetadata(taskId, data, 'ARC1');
            this.puzzleMetadata.set(taskId, metadata);
          } catch (error) {
            console.error(`Error loading puzzle ${file} from ARC1-Eval:`, error);
          }
        }
      }

      // Load puzzles from first training directory (ARC1) - lowest priority
      if (fs.existsSync(this.dataDir1)) {
        const files = fs.readdirSync(this.dataDir1).filter(file => file.endsWith('.json'));
        console.log(`Found ${files.length} puzzle files in ARC1 directory`);
        totalPuzzles += files.length;

        for (const file of files) {
          try {
            const taskId = file.replace('.json', '');
            
            // Skip if already loaded from ARC2-Eval or ARC2
            if (this.puzzleMetadata.has(taskId)) {
              continue;
            }
            
            const filePath = path.join(this.dataDir1, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ARCTask;
            
            // Analyze the puzzle to get metadata
            const metadata = this.analyzePuzzleMetadata(taskId, data, 'ARC1');
            this.puzzleMetadata.set(taskId, metadata);
          } catch (error) {
            console.error(`Error loading puzzle ${file} from ARC1:`, error);
          }
        }
      }
      
      console.log(`Total puzzles loaded: ${totalPuzzles}`);
    } catch (error) {
      console.error('Error loading puzzle metadata:', error);
    }
  }

  private analyzePuzzleMetadata(taskId: string, task: ARCTask, source: 'ARC1' | 'ARC2' | 'ARC2-Eval'): PuzzleInfo {
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
      patternType: 'unknown', // This would require more analysis
      maxGridSize,
      inputSize,
      outputSize,
      hasExplanation,
      source
    };
  }

  async loadPuzzle(taskId: string): Promise<ARCTask | null> {
    try {
      // Return from cache if available
      if (this.puzzleCache.has(taskId)) {
        return this.puzzleCache.get(taskId) || null;
      }

      // Try to load from ARC2-Eval directory first (highest priority)
      let filePath = path.join(this.dataDir4, `${taskId}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.puzzleCache.set(taskId, data);
        return data;
      }

      // If not found in ARC2-Eval, try ARC2 directory
      filePath = path.join(this.dataDir3, `${taskId}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.puzzleCache.set(taskId, data);
        return data;
      }
      
      // If not found in ARC2, try ARC1-Eval directory
      filePath = path.join(this.dataDir2, `${taskId}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.puzzleCache.set(taskId, data);
        return data;
      }
      
      // If not found in ARC1-Eval, try ARC1 directory
      filePath = path.join(this.dataDir1, `${taskId}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.puzzleCache.set(taskId, data);
        return data;
      }

      // Not found in either directory
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
    source?: 'ARC1' | 'ARC2' | 'ARC2-Eval';
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
      if (filters.prioritizeExplained) {
        puzzles = puzzles.filter(p => p.hasExplanation);
      }
      if (filters.source) {
        puzzles = puzzles.filter(p => p.source === filters.source);
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