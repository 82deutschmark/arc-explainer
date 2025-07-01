import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { puzzleAnalyzer } from "./services/puzzleAnalyzer";
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
      const task = sampleTasks[taskId as keyof typeof sampleTasks];
      
      if (!task) {
        return res.status(404).json({ 
          message: `Puzzle with ID ${taskId} not found. Available puzzles: ${Object.keys(sampleTasks).join(', ')}`
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

  // Get AI analysis of a puzzle
  app.get("/api/puzzle/analyze/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = sampleTasks[taskId as keyof typeof sampleTasks];
      
      if (!task) {
        return res.status(404).json({ 
          message: `Puzzle with ID ${taskId} not found`
        });
      }

      const analysis = await puzzleAnalyzer.analyzePuzzle(task);
      
      if (analysis.error) {
        return res.status(400).json({ message: analysis.error });
      }
      
      res.json(analysis);
    } catch (error) {
      console.error('Error analyzing puzzle:', error);
      res.status(500).json({ 
        message: 'Failed to analyze puzzle',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Validate user solution
  app.post("/api/puzzle/validate", async (req, res) => {
    try {
      const { input, userOutput, correctOutput } = req.body;
      
      if (!input || !userOutput || !correctOutput) {
        return res.status(400).json({ 
          message: 'Missing required fields: input, userOutput, and correctOutput are required'
        });
      }

      const validation = await puzzleAnalyzer.validateUserSolution(
        input,
        userOutput,
        correctOutput
      );
      
      res.json(validation);
    } catch (error) {
      console.error('Error validating solution:', error);
      res.status(500).json({ 
        message: 'Failed to validate solution',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
