import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { puzzleAnalyzer } from "./services/puzzleAnalyzer";
import { puzzleLoader } from "./services/puzzleLoader";
import { githubService } from "./services/githubService";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get available puzzles from GitHub repository
  app.get("/api/puzzle/github/available", async (req, res) => {
    try {
      const availablePuzzles = await githubService.fetchAvailablePuzzles();
      res.json({ 
        count: availablePuzzles.length,
        puzzles: availablePuzzles.slice(0, 100) // First 100 for performance
      });
    } catch (error) {
      console.error('Error fetching GitHub puzzles:', error);
      res.status(500).json({ 
        message: 'Failed to fetch puzzles from GitHub',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Download puzzles from GitHub
  app.post("/api/puzzle/github/download", async (req, res) => {
    try {
      const { count = 30 } = req.body;
      const downloaded = await githubService.downloadSmallPuzzles(count);
      res.json({ 
        success: true,
        downloaded,
        message: `Downloaded ${downloaded} puzzles from GitHub`
      });
    } catch (error) {
      console.error('Error downloading puzzles:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to download puzzles',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
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
        // Try to download the puzzle if it doesn't exist locally
        const downloaded = await puzzleLoader.downloadPuzzle(taskId);
        if (downloaded) {
          const newTask = await puzzleLoader.loadPuzzle(taskId);
          if (newTask) {
            return res.json(newTask);
          }
        }
        
        return res.status(404).json({ 
          message: `Puzzle with ID ${taskId} not found. Try one of the available puzzles or check if the ID is correct.`
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
      const task = await puzzleLoader.loadPuzzle(taskId);
      
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

  // Download a puzzle from the ARC-AGI repository
  app.post("/api/puzzle/download/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const success = await puzzleLoader.downloadPuzzle(taskId);
      
      if (success) {
        const metadata = puzzleLoader.getPuzzleMetadata(taskId);
        res.json({ 
          success: true, 
          message: `Successfully downloaded puzzle ${taskId}`,
          metadata 
        });
      } else {
        res.status(404).json({ 
          success: false,
          message: `Puzzle ${taskId} not found in the ARC-AGI repository`
        });
      }
    } catch (error) {
      console.error('Error downloading puzzle:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to download puzzle',
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
