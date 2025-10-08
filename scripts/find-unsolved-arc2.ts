/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-07
 * PURPOSE: Find ARC2 eval puzzles that grok-4-fast-reasoning hasn't solved yet
 * SRP and DRY check: Pass - Single purpose: find unsolved puzzles
 */

import { repositoryService } from '../server/repositories/RepositoryService.ts';
import fs from 'fs';
import path from 'path';

const MODEL_NAME = 'grok-4-fast-reasoning';

async function main() {
  try {
    // Get all ARC2 eval puzzle IDs from filesystem
    const arc2EvalDir = path.join(process.cwd(), 'data', 'evaluation2');
    const allPuzzleFiles = fs.readdirSync(arc2EvalDir);
    const allPuzzleIds = allPuzzleFiles
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));

    console.log(`📊 Total ARC2 Eval puzzles: ${allPuzzleIds.length}`);

    // Query database for already analyzed puzzles
    const analyzedPuzzleIds: string[] = [];

    for (const puzzleId of allPuzzleIds) {
      const explanations = await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
      const hasGrokAnalysis = explanations.some((exp: any) => exp.modelName === MODEL_NAME);

      if (hasGrokAnalysis) {
        analyzedPuzzleIds.push(puzzleId);
      }
    }

    console.log(`✅ Already analyzed by ${MODEL_NAME}: ${analyzedPuzzleIds.length}`);

    // Calculate unsolved puzzles
    const unsolvedPuzzleIds = allPuzzleIds.filter(id => !analyzedPuzzleIds.includes(id));

    console.log(`🎯 Unsolved puzzles: ${unsolvedPuzzleIds.length}`);
    console.log('\nUnsolved puzzle IDs:');
    console.log(unsolvedPuzzleIds.join(' '));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
