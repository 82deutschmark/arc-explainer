/**
 * xAI Grok Service Integration for ARC-AGI Puzzle Analysis
 * Supports reasoning log capture for Grok reasoning models (grok-4-0709)
 * These models provide reasoning logs similar to OpenAI reasoning models
 * @author Cascade / Gemini Pro 2.5
 * 
 * This service provides integration with xAI's Grok models for analyzing ARC-AGI puzzles.
 * It leverages Grok's advanced reasoning capabilities to explain puzzle solutions in the
 * context of alien communication patterns, making abstract reasoning more accessible.
 * 
 * Key Features:
 * - Full compatibility with xAI's REST API using OpenAI SDK
 * - Support for multiple Grok models (beta, 3, 3-mini, 4, 4-mini)
 * - Intelligent handling of reasoning vs non-reasoning model limitations
 * - Structured JSON output for consistent puzzle explanations
 * - Emoji-based interpretation for accessibility and engagement
 * - Creative alien communication framing for educational purposes
 * 
 * Model Capabilities:
 * - Grok Beta: Preview model with 128k context, vision support
 * - Grok 3/3-mini: Standard reasoning models with temperature control
 * - Grok 4/4-mini: Latest reasoning models (no temperature/penalty support)
 * 
 * API Integration:
 * - Uses OpenAI SDK with base URL https://api.x.ai/v1
 * - Requires GROK_API_KEY environment variable
 * - Fully compatible with existing puzzle analysis pipeline
 * - Maintains same interface as OpenAI service for seamless integration
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
  "grok-4-0709": "grok-4-0709",
  "grok-3": "grok-3", 
  "grok-3-mini": "grok-3-mini",
  "grok-3-fast": "grok-3-fast",
  "grok-3-mini-fast": "grok-3-mini-fast",
} as const;

// Grok 4 and other reasoning models don't support certain parameters
const REASONING_MODELS = new Set([
  "grok-4-0709",
]);

// Models that support reasoning logs (Grok reasoning models)
const MODELS_WITH_REASONING = new Set([
  "grok-4-0709",
]);

// Initialize xAI client with OpenAI SDK compatibility
const xai = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export class GrokService {
  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: keyof typeof MODELS,
    temperature: number = 0.75,
    captureReasoning: boolean = true,
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

## Object Manipulation
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
  "patternDescription": "Simple explanation of what ARC-AGI style transformation you found",
  "solvingStrategy": "Step-by-step how to solve it, for novices.  If they need to switch to thinking of the puzzle as numbers and not emojis, then mention that!",
  "hints": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "alienMeaning": "What the aliens might be trying to communicate, based on the logic used and the symbols.  Speculate as to if they are angry with us or have hostile intentions.",
  "confidence": "A confidence score between 0 and 100, how sure you are about your answer and your explanation",
  "alienMeaningConfidence": "A confidence score between 0 and 100, how sure you are about your interpretation of the alien 'message' being presented"
} : {
  "patternDescription": "Simple explanation of what ARC-AGI style transformation you found",
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

      // Grok 4 reasoning models don't support temperature, presence_penalty, frequency_penalty, or stop
      if (!REASONING_MODELS.has(modelKey)) {
        requestOptions.temperature = temperature;
      }

      const response = await xai.chat.completions.create(requestOptions);

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      // Extract reasoning log if available and requested
      let reasoningLog = null;
      let hasReasoningLog = false;
      
      if (captureReasoning && MODELS_WITH_REASONING.has(modelKey)) {
        // Type assertion for reasoning field that may not be in xAI types yet
        const message = response.choices[0].message as any;
        
        // Debug: Log all available fields in the message
        console.log(`[Grok] Debug - Available message fields for ${modelKey}:`, Object.keys(message));
        console.log(`[Grok] Debug - Full message object:`, JSON.stringify(message, null, 2));
        
        // Grok uses reasoning_content field for reasoning logs (not reasoning)
        const reasoning = message.reasoning_content;
        if (reasoning) {
          reasoningLog = reasoning;
          hasReasoningLog = true;
          console.log(`[Grok] Successfully captured reasoning log for model ${modelKey} (${reasoning.length} characters)`);
        } else {
          console.log(`[Grok] No reasoning_content field found for model ${modelKey}`);
          
          // Also check legacy reasoning field for backward compatibility
          if (message.reasoning) {
            reasoningLog = message.reasoning;
            hasReasoningLog = true;
            console.log(`[Grok] Found legacy reasoning field for model ${modelKey} (${message.reasoning.length} characters)`);
          } else {
            // Check for alternative reasoning field names
            const alternativeFields = ['thought_process', 'analysis', 'thinking', 'rationale', 'explanation'];
            for (const field of alternativeFields) {
              if (message[field]) {
                console.log(`[Grok] Found alternative reasoning field '${field}' with ${message[field].length} characters`);
                reasoningLog = message[field];
                hasReasoningLog = true;
                break;
              }
            }
          }
        }
      }
      
      return {
        model: modelKey,
        reasoningLog,
        hasReasoningLog,
        ...result,
      };
    } catch (error) {
      console.error(`Error with Grok model ${modelKey}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Grok model ${modelKey} failed: ${errorMessage}`);
    }
  }

  /**
   * Get available Grok models
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
      contextWindow: 128000, // All Grok models have 128k context
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: true,
      supportsVision: modelKey === "grok-4-0709", // Only the latest Grok 4 supports vision
    };
  }
}

export const grokService = new GrokService();