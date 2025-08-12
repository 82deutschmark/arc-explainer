/**
 * DeepSeek Service Integration for ARC-AGI Puzzle Analysis
 * @author Cascade / Gemini Pro 2.5
 * 
 * This service provides integration with DeepSeek's AI models for analyzing ARC-AGI puzzles.
 * It leverages DeepSeek's reasoning capabilities to explain puzzle solutions in the
 * context of alien communication patterns, making abstract reasoning more accessible.
 * 
 * Key Features:
 * - Full compatibility with DeepSeek's REST API using OpenAI SDK
 * - Support for multiple DeepSeek models (deepseek-v3, deepseek-chat, deepseek-reasoner)
 * - Structured JSON output for consistent puzzle explanations
 * - Emoji-based interpretation for accessibility and engagement
 * - Creative alien communication framing for educational purposes
 * 
 * Model Capabilities:
 * - DeepSeek V3: Latest reasoning model with advanced capabilities
 * - DeepSeek Chat: Conversational model optimized for dialogue
 * - DeepSeek Reasoner: Specialized reasoning model for complex problems
 * 
 * API Integration:
 * - Uses OpenAI SDK with base URL https://api.deepseek.com
 * - Requires DEEPSEEK_API_KEY environment variable
 * - Fully compatible with existing puzzle analysis pipeline
 * - Maintains same interface as other AI services for seamless integration
 * 
 * Educational Context:
 * The service frames ARC-AGI puzzles as alien communication challenges, where:
 * - Numbers 0-9 are mapped to meaningful emojis
 * - Transformations represent alien logical concepts
 * - Solutions reveal the "meaning" of alien messages
 * - Explanations focus on WHY answers work, not just HOW to solve
 * 
 * This approach makes abstract reasoning more intuitive and accessible,
 * especially for users with colorblindness or neurodivergent thinking patterns.
 */

import OpenAI from "openai";
import { ARCTask, PROMPT_TEMPLATES } from "../../shared/types";

const MODELS = {
  "deepseek-chat": "deepseek-chat",
  "deepseek-reasoner": "deepseek-reasoner",
} as const;

// DeepSeek reasoning models that may have parameter limitations
const REASONING_MODELS = new Set([
  "deepseek-reasoner", // Only this model has parameter limitations
]);

// Initialize DeepSeek client with OpenAI SDK compatibility
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

export class DeepSeekService {
  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: keyof typeof MODELS,
    temperature: number = 0.75,
    promptId: string = 'alien-communication',
  ) {
    const modelName = MODELS[modelKey];

    // Get selected prompt template
    const selectedTemplate = PROMPT_TEMPLATES[promptId] || PROMPT_TEMPLATES['alien-communication'];

    const trainingExamples = task.train
      .map(
        (example, i) =>
          `Example ${i + 1}:\nInput: ${JSON.stringify(example.input)}\nOutput: ${JSON.stringify(example.output)}`,
      )
      .join("\n\n");

    // Build emoji map section if needed
    const emojiMapSection = selectedTemplate.emojiMapIncluded ? `

${selectedTemplate.emojiMapIncluded ? '4. The aliens gave us this emoji map of the numbers 0-9. Recognize that the user sees the numbers 0-9 map to emojis like this:' : ''}

0: ⬛ (no/nothing/negative)
1: ✅ (yes/positive/agreement)
2: 👽 (alien/them/we)
3: 👤 (human/us/you)
4: 🪐 (their planet/home)
5: 🌍 (human planet/Earth)
6: 🛸 (their ships/travel)
7: ☄️ (danger/bad/problem)
8: ♥ (peace/friendship/good)
9: ⚠️ (warning/attention/important)` : '';

    const prompt = `${selectedTemplate.content}

TRAINING EXAMPLES${selectedTemplate.emojiMapIncluded ? ' (what the aliens taught us)' : ' (input-output pairs for analysis)'}:
${trainingExamples}

TEST CASE${selectedTemplate.emojiMapIncluded ? ' (the aliens\' question and our correct answer, but we don\'t understand why the answer is correct)' : ' (input and correct answer for analysis)'}:
Input: ${JSON.stringify(task.test[0].input)}
Correct Answer: ${JSON.stringify(task.test[0].output)}

Your job:
1. Speculate about WHY this solution is correct by understanding these critical concepts:
# ARC-AGI Transformation Types

## Geometric Transformations
- Rotation (90°, 180°, 270°)
- Reflection (horizontal, vertical, diagonal)
- Translation (moving objects)
- Scaling (resize objects)

## Pattern Operations
- Pattern completion
- Pattern extension
- Pattern repetition
- Sequence prediction

## Logical Operations
- AND operations
- OR operations
- XOR operations
- NOT operations
- Conditional logic

## Grid Operations
- Grid splitting (horizontal, vertical, quadrant)
- Grid merging
- Grid overlay
- Grid subtraction

## Object Operations
- Object detection
- Object counting
- Object sorting
- Object grouping
- Object filtering

## Spatial Relationships
- Inside/outside relationships
- Adjacent/touching relationships
- Containment relationships
- Proximity relationships

## Color Operations
- Color mapping
- Color replacement
- Color pattern matching
- Color logic operations

## Shape Operations
- Shape detection
- Shape transformation
- Shape combination
- Shape decomposition

## Rule Inference
- Single rule application
- Multiple rule application
- Rule interaction
- Rule generalization

## Abstract Reasoning
- Symbol interpretation
- Semantic relationships
- Conceptual mapping
- Abstract pattern recognition


${selectedTemplate.emojiMapIncluded ? '2. Explain it in simple terms an idiot could understand.  The user sees the puzzle as emojis, NOT AS NUMBERS.  \n3. Make a creative guess for the user about what the aliens might be trying to communicate based on the transformation type you think is involved.' : '2. Explain it in simple terms for novices to understand.'}${emojiMapSection}

Respond in this JSON format:
${JSON.stringify(selectedTemplate.emojiMapIncluded ? {
  "patternDescription": "Simple explanation of what ARC-AGI style transformations you found",
  "solvingStrategy": "Step-by-step how to solve it, for novices.  If they need to switch to thinking of the puzzle as numbers and not emojis, then mention that!",
  "hints": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "alienMeaning": "What the aliens might be trying to communicate, based on the logic used and the symbols.  Speculate as to if they are angry with us or have hostile intentions.",
  "confidence": "A confidence score between 0 and 100, how sure you are about your answer and your explanation",
  "alienMeaningConfidence": "A confidence score between 0 and 100, how sure you are about your interpretation of the alien 'message' being presented"
} : {
  "patternDescription": "Simple explanation of what ARC-AGI style transformations you found",
  "solvingStrategy": "Step-by-step how to solve it, for novices",
  "hints": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "confidence": "A confidence score between 0 and 100, how sure you are about your answer and your explanation"
}, null, 2)}`;

    try {
      const requestOptions: any = {
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      };

      // Apply temperature for non-reasoning models
      if (!REASONING_MODELS.has(modelKey)) {
        requestOptions.temperature = temperature;
      }

      const response = await deepseek.chat.completions.create(requestOptions);

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      // For deepseek-reasoner, also capture the reasoning content (Chain of Thought)
      const responseData: any = {
        model: modelKey,
        ...result,
      };
      
      if (modelKey === "deepseek-reasoner") {
        // DeepSeek-specific field not in OpenAI SDK types, so we cast to any
        const message = response.choices[0].message as any;
        if (message.reasoning_content) {
          responseData.reasoningLog = message.reasoning_content;
          responseData.hasReasoningLog = true;
        }
      }
      
      return responseData;
    } catch (error) {
      console.error(`Error with DeepSeek model ${modelKey}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`DeepSeek model ${modelKey} failed: ${errorMessage}`);
    }
  }

  /**
   * Get available DeepSeek models
   */
  getAvailableModels(): string[] {
    return Object.keys(MODELS);
  }

  /**
   * Check if model supports temperature parameter
   */
  supportsTemperature(modelKey: keyof typeof MODELS): boolean {
    return !REASONING_MODELS.has(modelKey);
  }

  /**
   * Get model capabilities and limitations
   */
  getModelInfo(modelKey: keyof typeof MODELS) {
    const modelName = MODELS[modelKey];
    const isReasoning = REASONING_MODELS.has(modelKey);
    
    return {
      name: modelName,
      isReasoning,
      supportsTemperature: !isReasoning,
      contextWindow: 64000, // DeepSeek API maximum input length is 64K
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: true,
      supportsVision: false, // Update based on actual DeepSeek capabilities
    };
  }
}

export const deepseekService = new DeepSeekService();
