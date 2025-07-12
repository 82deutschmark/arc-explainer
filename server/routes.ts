import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { puzzleLoader } from "./services/puzzleLoader";
import { dbService } from "./services/dbService";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database connection if DATABASE_URL is available
  const dbInitialized = await dbService.init();
  console.log(`Database ${dbInitialized ? 'initialized successfully' : 'not available - running in memory mode'}`);
  
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

      let result;
      
      // Determine which service to use based on model name
      if (model.startsWith('claude-')) {
        // Use Anthropic service for Claude models
        const { anthropicService } = await import('./services/anthropic');
        result = await anthropicService.analyzePuzzleWithModel(task, model as any, temperature);
      } else {
        // Use OpenAI service for all other models
        const { openaiService } = await import('./services/openai');
        result = await openaiService.analyzePuzzleWithModel(task, model as any, temperature);
      }
      
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

      // Save to file system for backward compatibility
      const { puzzleExporter } = await import('./services/puzzleExporter');
      const filepath = await puzzleExporter.saveExplainedPuzzle(taskId, task, explanations);
      
      // Save to database if available (most recent explanation model only)
      let explanationId = null;
      const latestModelName = Object.keys(explanations).pop();
      if (latestModelName) {
        explanationId = await dbService.saveExplanation(taskId, {
          ...explanations[latestModelName],
          modelUsed: latestModelName
        });
      }
      
      res.json({ 
        success: true, 
        message: `Explained puzzle saved as ${taskId}-EXPLAINED.json`,
        filepath,
        explanationId
      });
    } catch (error) {
      console.error(`Error saving explained puzzle ${req.params.taskId}:`, error);
      res.status(500).json({ 
        message: 'Failed to save explained puzzle',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Check if a puzzle has an explanation
  app.get("/api/puzzle/:puzzleId/has-explanation", async (req, res) => {
    try {
      const { puzzleId } = req.params;
      const hasExplanation = await dbService.hasExplanation(puzzleId);
      res.json({ hasExplanation });
    } catch (error) {
      console.error(`Error checking explanation for ${req.params.puzzleId}:`, error);
      res.status(500).json({ 
        message: 'Failed to check for explanation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get explanation with feedback stats
  app.get("/api/puzzle/:puzzleId/explanation", async (req, res) => {
    try {
      const { puzzleId } = req.params;
      const explanation = await dbService.getExplanationForPuzzle(puzzleId);
      
      if (!explanation) {
        return res.status(404).json({ message: 'No explanation found for this puzzle' });
      }
      
      res.json(explanation);
    } catch (error) {
      console.error(`Error getting explanation for ${req.params.puzzleId}:`, error);
      res.status(500).json({ 
        message: 'Failed to get explanation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get all explanations for a puzzle  Gemini 2.5 Pro 
  app.get("/api/puzzle/:puzzleId/explanations", async (req, res) => {
    try {
      const { puzzleId } = req.params;
      const explanations = await dbService.getExplanationsForPuzzle(puzzleId);
      
      if (!explanations) {
        // dbService returns null on connection error, empty array if none found
        return res.status(500).json({ message: 'Could not retrieve explanations due to a server error.' });
      }
      
      res.json(explanations);
    } catch (error) {
      console.error(`Error getting explanations for ${req.params.puzzleId}:`, error);
      res.status(500).json({ 
        message: 'Failed to get explanations',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Submit feedback for an explanation
  app.post("/api/feedback", async (req, res) => {
    try {
      const { explanationId, voteType, comment } = req.body;
      
      if (!explanationId || !voteType) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      if (voteType !== 'helpful' && voteType !== 'not_helpful') {
        return res.status(400).json({ message: 'Invalid vote type' });
      }

      // Add backend validation for comment length
      const MINIMUM_COMMENT_LENGTH = 20;
      if (!comment || comment.trim().length < MINIMUM_COMMENT_LENGTH) {
        return res.status(400).json({ 
          message: `A meaningful comment of at least ${MINIMUM_COMMENT_LENGTH} characters is required.` 
        });
      }
      
      const feedbackId = await dbService.addFeedback(
        parseInt(explanationId), 
        voteType, 
        comment
      );
      
      res.json({ 
        success: true, 
        message: 'Feedback recorded successfully',
        feedbackId
      });
    } catch (error) {
      console.error('Error adding feedback:', error);
      res.status(500).json({ 
        message: 'Failed to add feedback',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
