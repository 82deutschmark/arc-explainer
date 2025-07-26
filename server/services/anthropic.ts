/**
 * Anthropic Claude service for analyzing ARC puzzles using Claude models
 * Supports reasoning log capture through structured prompting with <reasoning> tags
 * Since Anthropic doesn't provide built-in reasoning logs, we prompt Claude to show its reasoning
 * 
 * @author Cascade
 */

import Anthropic from '@anthropic-ai/sdk';
import { ARCTask } from "../../shared/types";

// Latest Anthropic models - updated with current model names from official documentation
const MODELS = {
  "claude-sonnet-4-20250514": "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-20250219": "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022": "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022": "claude-3-5-haiku-20241022",
  "claude-3-haiku-20240307": "claude-3-haiku-20240307",
} as const;

// Models that do NOT support temperature parameter (based on Anthropic documentation)
const MODELS_WITHOUT_TEMPERATURE = new Set<string>([
  // Most Anthropic models support temperature, but we'll keep this for potential future models
]);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export class AnthropicService {
  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: keyof typeof MODELS,
    temperature: number = 0.75,
    captureReasoning: boolean = true,
  ) {
    const modelName = MODELS[modelKey];

    const trainingExamples = task.train
      .map(
        (example, i) =>
          `Example ${i + 1}:\nInput: ${JSON.stringify(example.input)}\nOutput: ${JSON.stringify(example.output)}`,
      )
      .join("\n\n");

    // Modify prompt to include reasoning capture if requested
    const basePrompt = `You are the tutor for our app which frames the puzzles from the ARC-AGI prize
     as alien communication puzzles. Your job is to explain in very simple terms why the correct answer is correct.  
     Look at this puzzle where we already know the correct answer and determine the logic used to solve it.`;
    
    const reasoningPrompt = captureReasoning ? 
      `${basePrompt}

IMPORTANT: Before providing your final answer, please show your step-by-step reasoning process inside <reasoning> tags. Think through the puzzle systematically, analyzing patterns, transformations, and logical connections. This reasoning will help users understand your thought process.

<reasoning>
[Your detailed step-by-step analysis will go here]
</reasoning>

Then provide your final structured response.` : basePrompt;
    
    const prompt = `${reasoningPrompt}

TRAINING EXAMPLES (what the aliens taught us):
${trainingExamples}

TEST CASE (the aliens' question and our correct answer, but we don't understand why the answer is correct):
Input: ${JSON.stringify(task.test[0].input)}
Correct Answer: ${JSON.stringify(task.test[0].output)}

YOU MAY ONLY RESPOND IN THIS EXACT JSON FORMAT:
{
  "patternDescription": "Simple explanation of what ARC-AGI style transformation you found",
  "solvingStrategy": "Step-by-step how to solve it, for novices.  If they need to switch to thinking of the puzzle as numbers and not emojis, then mention that!",
  "hints": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "alienMeaning": "What the aliens might be trying to communicate, based on the logic used and the symbols.  Speculate as to if they are angry with us or have hostile intentions.",
  "confidence": "A confidence score between 0 and 100, how sure you are about your answer and your explanation",
  "alienMeaningConfidence": "A confidence score between 0 and 100, how sure you are about your interpretation of the alien 'message' being presented"
}

The aliens gave us this emoji map of the numbers 0-9. Recognize that the user sees the numbers 0-9 map to emojis like this:

0: ⬛ (no/nothing/negative)
1: ✅ (yes/positive/agreement)
2: 👽 (alien/them/we)
3: 👤 (human/us/you)
4: 🪐 (their planet/home)
5: 🌍 (human planet/Earth)
6: 🛸 (their ships/travel)
7: ☄️ (danger/bad/problem)
8: ♥ (peace/friendship/good)
9: ⚠️ (warning/attention/important)

${captureReasoning ? 'After your <reasoning> section, respond' : 'Respond'} in this JSON format:
{
  "patternDescription": "Simple explanation of what ARC-AGI style transformation you found",
  "solvingStrategy": "Step-by-step how to solve it, for novices.  If they need to switch to thinking of the puzzle as numbers and not emojis, then mention that!",
  "hints": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "alienMeaning": "What the aliens might be trying to communicate, based on the logic used and the symbols.  Speculate as to if they are angry with us or have hostile intentions.",
  "confidence": "A confidence score between 0 and 100, how sure you are about your answer and your explanation",
  "alienMeaningConfidence": "A confidence score between 0 and 100, how sure you are about your interpretation of the alien 'message' being presented"
}`;

    try {
      const requestOptions: any = {
        model: modelName,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      };

      // Only add temperature for models that support it
      if (!MODELS_WITHOUT_TEMPERATURE.has(modelName)) {
        requestOptions.temperature = temperature;
      }

      const response = await anthropic.messages.create(requestOptions);
      
      // Extract text content from Anthropic's response format
      const content = response.content[0];
      const textContent = content.type === 'text' ? content.text : '{}';
      
      // Extract reasoning log if requested and available
      let reasoningLog = null;
      let hasReasoningLog = false;
      let cleanedContent = textContent;
      
      if (captureReasoning) {
        const reasoningMatch = textContent.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
        if (reasoningMatch) {
          reasoningLog = reasoningMatch[1].trim();
          hasReasoningLog = true;
          // Remove reasoning tags from content for JSON parsing
          cleanedContent = textContent.replace(/<reasoning>[\s\S]*?<\/reasoning>/, '').trim();
          console.log(`[Anthropic] Captured reasoning log for model ${modelKey} (${reasoningLog.length} characters)`);
        } else {
          console.log(`[Anthropic] No reasoning log found for model ${modelKey}`);
        }
      }
      
      // Try to extract JSON from the response, even if there's extra text
      let result;
      try {
        // First try to parse as pure JSON
        result = JSON.parse(cleanedContent);
      } catch (parseError) {
        // If that fails, try to find JSON within the text
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            // If JSON extraction fails, create a fallback response
            result = {
              patternDescription: "Unable to parse model response",
              solvingStrategy: "The AI model returned an invalid response format.",
              hints: ["Try using a different model", "Check the model configuration", "The response was not in valid JSON format"],
              alienMeaning: "The aliens seem to be having communication difficulties.",
              confidence: 0,
              alienMeaningConfidence: 0,
              rawResponse: cleanedContent.substring(0, 500) + "..." // Include first 500 chars for debugging
            };
          }
        } else {
          // No JSON found at all
          result = {
            patternDescription: "No valid JSON response found",
            solvingStrategy: "The AI model did not return a structured response.",
            hints: ["The model may need different prompting", "Try adjusting the temperature", "Consider using a different model"],
            alienMeaning: "The aliens are speaking in an unknown format.",
            confidence: 0,
            alienMeaningConfidence: 0,
            rawResponse: textContent.substring(0, 500) + "..." // Include first 500 chars for debugging
          };
        }
      }
      
      return {
        model: modelKey,
        reasoningLog,
        hasReasoningLog,
        ...result,
      };
    } catch (error) {
      console.error(`Error with model ${modelKey}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Model ${modelKey} failed: ${errorMessage}`);
    }
  }
}

export const anthropicService = new AnthropicService(); 