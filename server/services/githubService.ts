/**
 * DEPRECATED: This file can be safely deleted
 * 
 * Analysis Results (2025-08-20):
 * - ✅ No imports: No files import from githubService.ts  
 * - ✅ No usage: No references to the GitHub service in the codebase
 * - ✅ Local data complete: All ARC-AGI puzzle data is stored locally in /data/
 * - ✅ Stub implementation: puzzleLoader.ts already has a no-op downloadPuzzle() method
 * 
 * Local Data Present:
 * - 4,000+ puzzles across ARC1 & ARC2 datasets
 * - training/ (ARC1 training)
 * - evaluation/ (ARC1 evaluation) 
 * - training2/ (ARC2 training)
 * - evaluation2/ (ARC2 evaluation)
 * - explained/ (pre-analyzed puzzles)
 * 
 * This is legacy code from when puzzles needed to be downloaded from GitHub.
 * Since all puzzle data is now stored locally and the service has zero usage,
 * it can be safely deleted to clean up ~104 lines of unused code.
 * 
 * To remove: rm D:\1Projects\arc-explainer\server\services\githubService.ts
 */

import fs from 'fs';
import path from 'path';

interface GitHubFile {
  name: string;
  download_url: string;
  size: number;
}

export class GitHubService {
  private readonly repoUrl = 'https://api.github.com/repos/fchollet/ARC-AGI/contents/data/training';
  private readonly dataDir = path.join(process.cwd(), 'data', 'training');

  constructor() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  async fetchAvailablePuzzles(): Promise<string[]> {
    try {
      const response = await fetch(this.repoUrl);
      if (!response.ok) {
        throw new Error(`GitHub API responded with ${response.status}`);
      }
      
      const files: GitHubFile[] = await response.json();
      return files
        .filter(file => file.name.endsWith('.json'))
        .map(file => file.name.replace('.json', ''));
    } catch (error) {
      console.error('Error fetching puzzle list from GitHub:', error);
      return [];
    }
  }

  async downloadPuzzle(puzzleId: string): Promise<boolean> {
    try {
      const url = `https://raw.githubusercontent.com/fchollet/ARC-AGI/master/data/training/${puzzleId}.json`;
      const response = await fetch(url);
      
      if (!response.ok) {
        return false;
      }

      const data = await response.text();
      const filePath = path.join(this.dataDir, `${puzzleId}.json`);
      
      fs.writeFileSync(filePath, data);
      console.log(`Downloaded puzzle ${puzzleId} (${data.length} bytes)`);
      return true;
    } catch (error) {
      console.error(`Error downloading puzzle ${puzzleId}:`, error);
      return false;
    }
  }

  async downloadMultiplePuzzles(puzzleIds: string[]): Promise<number> {
    let successCount = 0;
    for (const puzzleId of puzzleIds) {
      if (await this.downloadPuzzle(puzzleId)) {
        successCount++;
      }
      // Add small delay to be respectful to GitHub API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return successCount;
  }

  async downloadSmallPuzzles(maxCount?: number): Promise<number> {
    console.log('Fetching available puzzles from GitHub...');
    const availablePuzzles = await this.fetchAvailablePuzzles();
    
    if (availablePuzzles.length === 0) {
      console.log('No puzzles found in GitHub repository');
      return 0;
    }

    console.log(`Found ${availablePuzzles.length} puzzles in repository`);
    
    // Download all puzzles or limited batch
    const puzzlesToDownload = maxCount ? availablePuzzles.slice(0, maxCount) : availablePuzzles;
    console.log(`Downloading ${puzzlesToDownload.length} puzzles...`);
    
    return await this.downloadMultiplePuzzles(puzzlesToDownload);
  }

  async downloadAllPuzzles(): Promise<number> {
    return await this.downloadSmallPuzzles(); // No limit
  }

  getLocalPuzzles(): string[] {
    try {
      const files = fs.readdirSync(this.dataDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      return [];
    }
  }
}

export const githubService = new GitHubService();