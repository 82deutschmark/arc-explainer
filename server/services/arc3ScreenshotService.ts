/*
 * Author: Claude (Windsurf Cascade)
 * Date: 2025-12-26
 * PURPOSE: Auto-discovery service for ARC-AGI-3 game level screenshots.
 *          Scans the public folder for PNG files matching the pattern {gameId}-lvl{number}.png
 *          and generates level screenshot metadata dynamically.
 * SRP/DRY check: Pass - Single responsibility for screenshot discovery and metadata generation.
 */

import { readdirSync } from 'fs';
import { join } from 'path';
import { LevelScreenshot } from '../../shared/arc3Games';

/**
 * Automatically discovers level screenshots for a game based on PNG files in the public folder
 * Files should follow the pattern: {gameId}-lvl{levelNumber}.png or {gameId}-lvl{levelNumber}{suffix}.png
 */
export function discoverLevelScreenshots(gameId: string): LevelScreenshot[] {
  try {
    const publicDir = join(process.cwd(), 'client', 'public');
    const files = readdirSync(publicDir);
    
    const levelScreenshotPattern = new RegExp(`^${gameId}-lvl(\\d+)([a-z]*)\\.png$`, 'i');
    
    const screenshots: LevelScreenshot[] = [];
    
    files.forEach(file => {
      const match = file.match(levelScreenshotPattern);
      if (match) {
        const levelNumber = parseInt(match[1], 10);
        const suffix = match[2]; // e.g., 'a' from 'lvl6a'
        
        screenshots.push({
          level: levelNumber,
          imageUrl: `/${file}`,
          caption: suffix ? `Variant ${suffix.toUpperCase()}` : undefined,
          notes: suffix ? `Alternative version of level ${levelNumber}` : undefined
        });
      }
    });
    
    // Sort by level number, then by suffix (main level first, then variants)
    screenshots.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      const aSuffix = a.caption ? 1 : 0;
      const bSuffix = b.caption ? 1 : 0;
      return aSuffix - bSuffix;
    });
    
    return screenshots;
  } catch (error) {
    console.warn(`Could not discover level screenshots for game ${gameId}:`, error);
    return [];
  }
}

/**
 * Updates game metadata with discovered level screenshots
 */
export function enrichGameWithScreenshots(gameMetadata: any): any {
  if (!gameMetadata.gameId) {
    return gameMetadata;
  }
  
  const discoveredScreenshots = discoverLevelScreenshots(gameMetadata.gameId);
  
  // Only override if we discovered screenshots and there aren't already custom ones
  if (discoveredScreenshots.length > 0 && (!gameMetadata.levelScreenshots || gameMetadata.levelScreenshots.length === 0)) {
    return {
      ...gameMetadata,
      levelScreenshots: discoveredScreenshots
    };
  }
  
  return gameMetadata;
}
