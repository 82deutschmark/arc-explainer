import type { Express } from "express";
import { createServer, type Server } from "http";
import { puzzleLoader } from "./services/puzzleLoader";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get list of available puzzles with filtering
  app.get("/api/puzzle/list", async (req, res) => {
    try {
      const { maxGridSize, minGridSize, difficulty, gridSizeConsistent } = req.query;
      
      const filters: any = {};
      if (maxGridSize) filters.maxGridSize = parseInt(maxGridSize as string);
      if (minGridSize) filters.minGridSize = parseInt(minGridSize as string);
      if (difficulty) filters.difficulty = difficulty as string;
      if (gridSizeConsistent) filters.gridSizeConsistent = gridSizeConsistent === 'true';
      
      const puzzleList = puzzleLoader.getPuzzleList(filters);
      res.json(puzzleList);
    } catch (error) {
      console.error('Error fetching puzzle list:', error);
      res.status(500).json({ 
        message: 'Failed to fetch puzzle list',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get specific puzzle task
  app.get("/api/puzzle/task/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = await puzzleLoader.loadPuzzle(taskId);
      
      if (!task) {
        return res.status(404).json({ 
          message: `Puzzle with ID ${taskId} not found. The puzzles are stored locally, so no download is possible.`
        });
      }
      
      res.json(task);
    } catch (error) {
      console.error('Error fetching puzzle task:', error);
      res.status(500).json({ 
        message: 'Failed to fetch puzzle task',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Validate user solution
  app.post("/api/puzzle/validate", (req, res) => {
    // Validation functionality was removed - return 501 Not Implemented
    return res.status(501).json({ 
      success: false,
      message: 'Solution validation is not available in this version. Please update your client.'
    });
  });

  // Test specific model with puzzle analysis
  app.post("/api/puzzle/analyze/:taskId/:model", async (req, res) => {
    try {
      const { taskId, model } = req.params;
      const { temperature = 0.75 } = req.body;
      
      const task = await puzzleLoader.loadPuzzle(taskId);
      if (!task) {
        return res.status(404).json({ message: 'Puzzle not found' });
      }

      const { openaiService } = await import('./services/openai');
      const result = await openaiService.analyzePuzzleWithModel(task, model as any, temperature);
      
      res.json(result);
    } catch (error) {
      console.error(`Error analyzing puzzle with model ${req.params.model}:`, error);
      res.status(500).json({ 
        message: 'Failed to analyze puzzle',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Save explained puzzle
  app.post("/api/puzzle/save-explained/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const { explanations } = req.body;

      if (!explanations || Object.keys(explanations).length === 0) {
        return res.status(400).json({ message: 'No explanations provided' });
      }

      const task = await puzzleLoader.loadPuzzle(taskId);
      if (!task) {
        return res.status(404).json({ message: 'Puzzle not found' });
      }

      const { puzzleExporter } = await import('./services/puzzleExporter');
      const filepath = await puzzleExporter.saveExplainedPuzzle(taskId, task, explanations);
      
      res.json({ 
        success: true, 
        message: `Explained puzzle saved as ${taskId}-EXPLAINED.json`,
        filepath
      });
    } catch (error) {
      console.error(`Error saving explained puzzle ${req.params.taskId}:`, error);
      res.status(500).json({ 
        message: 'Failed to save explained puzzle',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
