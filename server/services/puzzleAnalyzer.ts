import type { ARCTask } from "@shared/types";
import { openaiService } from "./openai";

export class PuzzleAnalyzer {
  async analyzePuzzle(task: ARCTask) {
    // Filter for puzzles with consistent grid sizes
    const hasConsistentGridSize = this.checkGridSizeConsistency(task);
    
    if (!hasConsistentGridSize) {
      return {
        error: "This puzzle changes grid sizes, which is not supported in the current version"
      };
    }

    // Use the first available model for basic analysis
    const analysis = await openaiService.analyzePuzzleWithModel(task, 'o1-mini-2024-09-12');
    
    return {
      ...analysis,
      gridSizeConsistent: hasConsistentGridSize,
      inputSize: task.train[0].input.length > 0 ? 
        [task.train[0].input.length, task.train[0].input[0].length] : [0, 0],
      outputSize: task.train[0].output.length > 0 ? 
        [task.train[0].output.length, task.train[0].output[0].length] : [0, 0]
    };
  }

  private checkGridSizeConsistency(task: ARCTask): boolean {
    if (task.train.length === 0) return false;

    const firstExample = task.train[0];
    const inputRows = firstExample.input.length;
    const inputCols = firstExample.input[0]?.length || 0;
    const outputRows = firstExample.output.length;
    const outputCols = firstExample.output[0]?.length || 0;

    // Check if all examples have the same input and output dimensions
    for (const example of [...task.train, ...task.test]) {
      if (example.input.length !== inputRows ||
          example.input[0]?.length !== inputCols ||
          example.output.length !== outputRows ||
          example.output[0]?.length !== outputCols) {
        return false;
      }
    }

    return true;
  }

  // Validation functionality removed - focusing on analysis only
}

export const puzzleAnalyzer = new PuzzleAnalyzer();
