/*
 * Author: Claude (Windsurf Cascade)
 * Date: 2025-12-26
 * PURPOSE: Controller for ARC-AGI-3 game metadata with auto-discovered level screenshots.
 *          Provides endpoints that enrich game data with dynamically discovered screenshots.
 * SRP/DRY check: Pass - Single responsibility for ARC3 API endpoints.
 */

import { Request, Response } from 'express';
import { ARC3_GAMES } from '../../shared/arc3Games';
import { discoverLevelScreenshots, enrichGameWithScreenshots } from '../services/arc3ScreenshotService';

/**
 * Get all games with auto-discovered level screenshots
 */
export function getArc3Games(req: Request, res: Response) {
  try {
    const gamesWithScreenshots = Object.entries(ARC3_GAMES).map(([gameId, game]) => {
      return enrichGameWithScreenshots(game);
    });

    res.json(gamesWithScreenshots);
  } catch (error) {
    console.error('Error getting ARC3 games:', error);
    res.status(500).json({ error: 'Failed to get games' });
  }
}

/**
 * Get a specific game with auto-discovered level screenshots
 */
export function getArc3Game(req: Request, res: Response) {
  try {
    const { gameId } = req.params;
    const game = ARC3_GAMES[gameId];
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const gameWithScreenshots = enrichGameWithScreenshots(game);
    res.json(gameWithScreenshots);
  } catch (error) {
    console.error('Error getting ARC3 game:', error);
    res.status(500).json({ error: 'Failed to get game' });
  }
}

/**
 * Get level screenshots for a specific game
 */
export function getGameScreenshots(req: Request, res: Response) {
  try {
    const { gameId } = req.params;
    const screenshots = discoverLevelScreenshots(gameId);
    
    res.json({
      gameId,
      screenshots,
      count: screenshots.length
    });
  } catch (error) {
    console.error('Error getting game screenshots:', error);
    res.status(500).json({ error: 'Failed to get screenshots' });
  }
}
