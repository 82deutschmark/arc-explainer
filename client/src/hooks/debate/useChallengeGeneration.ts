/**
 * useChallengeGeneration.ts
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-29
 * PURPOSE: Custom hook for generating AI challenges in debates.
 * Single responsibility: Challenge generation logic only.
 * SRP/DRY check: Pass - Focused only on challenge generation concerns
 */

import type { ExplanationData } from '@/types/puzzle';

export const useChallengeGeneration = () => {
  const generateChallengePrompt = (
    originalExplanation: ExplanationData,
    customChallenge?: string
  ): string => {
    // Determine if the explanation was incorrect
    const wasIncorrect = originalExplanation.isPredictionCorrect === false ||
      (originalExplanation.hasMultiplePredictions && originalExplanation.multiTestAllCorrect === false);

    return `You are participating in an AI model debate about an ARC-AGI puzzle solution. Another AI model provided ${wasIncorrect ? 'an INCORRECT' : 'this'} explanation, and your job is to challenge their reasoning and provide a better solution.

🧠 **Original AI's ${wasIncorrect ? 'INCORRECT ' : ''}Explanation:**
• Model: ${originalExplanation.modelName}
• Pattern: ${originalExplanation.patternDescription}
• Strategy: ${originalExplanation.solvingStrategy}
• Hints: ${originalExplanation.hints.join(', ')}
• Confidence: ${originalExplanation.confidence}%
${wasIncorrect ? '• ❌ Result: INCORRECT prediction' : ''}

${customChallenge ? `🎯 **Human Focus Area:** ${customChallenge}\n\n` : ''}**Your Challenge Task:**
1. ${wasIncorrect ? 'Explain why their prediction was wrong' : 'Identify potential flaws in their reasoning'}
2. Provide your own analysis of the correct pattern/transformation
3. Give a better solving strategy with clear steps
4. ${wasIncorrect ? 'Show the correct solution' : 'Question their confidence level'}
5. Be specific, constructive, and demonstrate superior reasoning

🔍 **Focus on:** Clear logical reasoning, pattern recognition accuracy, and providing the correct solution.`;
  };

  return {
    generateChallengePrompt
  };
};