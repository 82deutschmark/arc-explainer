import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { puzzleAnalyzer } from "./services/puzzleAnalyzer";

// Sample ARC task data - in a real application, this would be loaded from the ARC dataset
const sampleTasks = {
  "3af2c5a8": {
    train: [
      {
        input: [[0, 1, 0], [1, 2, 1], [0, 1, 0]],
        output: [[0, 0, 0], [0, 2, 0], [0, 0, 0]]
      },
      {
        input: [[1, 0, 1], [0, 3, 0], [1, 0, 1]],
        output: [[0, 0, 0], [0, 3, 0], [0, 0, 0]]
      }
    ],
    test: [
      {
        input: [[0, 2, 0], [2, 1, 2], [0, 2, 0]],
        output: [[0, 0, 0], [0, 1, 0], [0, 0, 0]]
      }
    ]
  },
  "3ac3eb23": {
    train: [
      {
        input: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
        output: [[7, 4, 1], [8, 5, 2], [9, 6, 3]]
      },
      {
        input: [[0, 1, 2], [3, 4, 5], [6, 7, 8]],
        output: [[6, 3, 0], [7, 4, 1], [8, 5, 2]]
      }
    ],
    test: [
      {
        input: [[2, 3, 4], [5, 6, 7], [8, 9, 1]],
        output: [[8, 5, 2], [9, 6, 3], [1, 7, 4]]
      }
    ]
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get list of available puzzles
  app.get("/api/puzzle/list", async (req, res) => {
    try {
      const puzzleList = Object.keys(sampleTasks).map(id => ({
        id,
        difficulty: 'medium', // This would be determined by analysis in a real app
        gridSizeConsistent: true, // Pre-filtered for consistent grid sizes
        patternType: 'transformation'
      }));
      
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
