import fs from 'fs/promises';
import path from 'path';
import { ARCTask } from '../../shared/types';

export class PuzzleExporter {
  private exportDir = path.join(process.cwd(), 'data', 'explained');

  constructor() {
    this.ensureExportDirectory();
  }

  private async ensureExportDirectory() {
    try {
      await fs.mkdir(this.exportDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create export directory:', error);
    }
  }

  async saveExplainedPuzzle(
    taskId: string, 
    originalTask: ARCTask, 
    explanations: Record<string, any>
  ) {
    try {
      const explainedPuzzle = {
        taskId,
        originalTask,
        explanations,
        exportedAt: new Date().toISOString(),
        models: Object.keys(explanations)
      };

      const filename = `${taskId}-EXPLAINED.json`;
      const filepath = path.join(this.exportDir, filename);

      await fs.writeFile(filepath, JSON.stringify(explainedPuzzle, null, 2));
      
      console.log(`Saved explained puzzle: ${filename}`);
      return filepath;
    } catch (error) {
      console.error(`Failed to save explained puzzle ${taskId}:`, error);
      throw error;
    }
  }

  async getExplainedPuzzles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.exportDir);
      return files.filter(file => file.endsWith('-EXPLAINED.json'));
    } catch (error) {
      console.error('Failed to list explained puzzles:', error);
      return [];
    }
  }

  async loadExplainedPuzzle(taskId: string) {
    try {
      const filename = `${taskId}-EXPLAINED.json`;
      const filepath = path.join(this.exportDir, filename);
      const content = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load explained puzzle ${taskId}:`, error);
      return null;
    }
  }
}

export const puzzleExporter = new PuzzleExporter();