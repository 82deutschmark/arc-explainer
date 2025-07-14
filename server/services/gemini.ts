/**
 * Google Gemini Service Integration for ARC-AGI Puzzle Analysis
 * @author Claude (Anthropic)
 * 
 * This service provides integration with Google's Gemini models for analyzing ARC-AGI puzzles.
 * It leverages Gemini's advanced reasoning capabilities to explain puzzle solutions in the
 * context of alien communication patterns, making abstract reasoning more accessible.
 * 
 * Key Features:
 * - Full compatibility with Google's GenAI SDK (@google/genai)
 * - Support for multiple Gemini models (2.5 Pro, 2.5 Flash, 2.0 Flash, etc.)
 * - Intelligent handling of thinking vs non-thinking model limitations
 * - Structured JSON output for consistent puzzle explanations
 * - Emoji-based interpretation for accessibility and engagement
 * - Creative alien communication framing for educational purposes
 * 
 * Model Capabilities:
 * - Gemini 2.5 Pro: State-of-the-art thinking model for complex reasoning
 * - Gemini 2.5 Flash: Best price-performance with thinking capabilities
 * - Gemini 2.5 Flash-Lite: Most cost-efficient model with high throughput
 * - Gemini 2.0 Flash: General purpose multimodal model with enhanced features
 * - Gemini 2.0 Flash-Lite: Optimized for cost efficiency and low latency
 * 
 * API Integration:
 * - Uses Google GenAI SDK (@google/genai) with automatic endpoint management
 * - Requires GEMINI_API_KEY environment variable
 * - Fully compatible with existing puzzle analysis pipeline
 * - Maintains same interface as OpenAI/Grok services for seamless integration
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

import { GoogleGenAI } from "@google/genai";
import { ARCTask } from "../../shared/types";

const MODELS = {
  "gemini-2.5-pro": "gemini-2.5-pro",
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini-2.5-flash-lite": "gemini-2.5-flash-lite", 
  "gemini-2.0-flash": "gemini-2.0-flash",
  "gemini-2.0-flash-lite": "gemini-2.0-flash-lite",
} as const;

// Thinking models that may have different parameter support or behavior
const THINKING_MODELS = new Set([
  "gemini-2.5-pro",
  "gemini-2.5-flash",
]);

// Initialize Google GenAI client
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// A mapping from the model keys in your app to the model names expected by the Gemini API
const MODEL_NAME_MAP: { [key: string]: string } = {
  "gemini-2.5-pro": "gemini-1.5-pro-latest",
  "gemini-2.5-flash": "gemini-1.5-flash-latest",
  // Add other mappings as needed, falling back to the key itself if not specified
};

export class GeminiService {
  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: keyof typeof MODELS,
    temperature: number = 0.75,
  ) {
    const modelName = MODELS[modelKey];

    const trainingExamples = task.train
      .map(
        (example, i) =>
          `Example ${i + 1}:\nInput: ${JSON.stringify(example.input)}\nOutput: ${JSON.stringify(example.output)}`,
      )
      .join("\n\n");

    const prompt = `You are the tutor for our app which frames the puzzles from the ARC-AGI prize
     as alien communication puzzles. Your job is to explain in very simple terms why the correct answer is correct.  
     Look at this puzzle where we already know the correct answer and determine the logic used to solve it.

TRAINING EXAMPLES (what the aliens taught us):
${trainingExamples}

TEST CASE (the aliens' question and our correct answer, but we don't understand why the answer is correct):
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


2. Explain it in simple terms an idiot could understand.  The user sees the puzzle as emojis, NOT AS NUMBERS.  
3. Make a creative guess for the user about what the aliens might be trying to communicate based on the transformation type you think is involved. 


4. The aliens gave us this emoji map of the numbers 0-9. Recognize that the user sees the numbers 0-9 map to emojis like this:

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

Respond in this JSON format:
{
  "patternDescription": "Simple explanation of what ARC-AGI style transformation you found",
  "solvingStrategy": "Step-by-step how to solve it, for novices.  If they need to switch to thinking of the puzzle as numbers and not emojis, then mention that!",
  "hints": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "alienMeaning": "What the aliens might be trying to communicate, based on the logic used and the symbols.  Speculate as to if they are angry with us or have hostile intentions.",
  "confidence": "A confidence score between 0 and 100, how sure you are about your answer and your explanation",
  "alienMeaningConfidence": "A confidence score between 0 and 100, how sure you are about your interpretation of the alien 'message' being presented"
}

IMPORTANT: Your response MUST be a single, valid JSON object. Do not include any other text, explanations, or markdown code fences. The entire response must start with '{' and end with '}'`

    try {
      const requestOptions: any = {
        model: modelName,
        contents: {
          role: "user", 
          parts: [{ text: prompt }]
        },
        generationConfig: {
          responseMimeType: "application/json",
        }
      };

      // Add temperature for models that support it
      // Most Gemini models support temperature, but thinking models may behave differently
      requestOptions.generationConfig.temperature = temperature;

      const result: any = await genAI.models.generateContent(requestOptions);

            // Gemini may wrap JSON in Markdown. Forcefully extract the JSON object.
      const rawText: string = result?.text ?? "";
      const firstBrace = rawText.indexOf('{');
      const lastBrace = rawText.lastIndexOf('}');
      
      let cleanText = "";
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanText = rawText.substring(firstBrace, lastBrace + 1);
      }

      let jsonResult: any;
      try {
        jsonResult = JSON.parse(cleanText);
      } catch (parseErr) {
        console.warn("[GeminiService] JSON parse failed, returning raw text", parseErr);
        jsonResult = { explanation: cleanText };
      }

      return {
        model: modelKey,
        ...jsonResult,
      };
    } catch (error) {
      console.error(`Error with Gemini model ${modelKey}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Gemini model ${modelKey} failed: ${errorMessage}`);
    }
  }

  /**
   * Get available Gemini models
   */
  getAvailableModels(): string[] {
    return Object.keys(MODELS);
  }

  /**
   * Check if model supports temperature parameter
   */
  supportsTemperature(modelKey: keyof typeof MODELS): boolean {
    // Most Gemini models support temperature, deprecated models may have limitations
    return true;
  }

  /**
   * Check if model uses thinking capabilities
   */
  isThinkingModel(modelKey: keyof typeof MODELS): boolean {
    return THINKING_MODELS.has(modelKey);
  }

  /**
   * Get model capabilities and limitations
   */
  getModelInfo(modelKey: keyof typeof MODELS) {
    const modelName = MODELS[modelKey];
    const isThinking = THINKING_MODELS.has(modelKey);
      
    return {
      name: modelName,
      isThinking,
      supportsTemperature: true,
      contextWindow: this.getContextWindow(modelKey),
      supportsFunctionCalling: true,
      supportsSystemPrompts: true,
      supportsStructuredOutput: true,
      supportsMultimodal: true,
      supportsAudio: modelKey.includes("2.5") || modelKey.includes("2.0"),
      supportsVideo: modelKey.includes("2.5") || modelKey.includes("2.0"),
    };
  }

  /**
   * Get context window size for different models
   */
  private getContextWindow(modelKey: keyof typeof MODELS): number {
    if (modelKey.includes("2.5")) {
      return 1000000; // 1M tokens for Gemini 2.5 models
    } else if (modelKey.includes("2.0")) {
      return 1000000; // 1M tokens for Gemini 2.0 models
    } else if (modelKey.includes("1.5")) {
      return 1000000; // 1M tokens for Gemini 1.5 models
    }
    return 128000; // Default fallback
  }

  /**
   * Get pricing tier information
   */
  getPricingTier(modelKey: keyof typeof MODELS): 'free' | 'paid' | 'premium' {
    if (modelKey.includes("lite")) {
      return 'free'; // Flash-Lite models are most cost-efficient
    } else if (modelKey.includes("flash")) {
      return 'paid'; // Flash models are mid-tier pricing
    } else if (modelKey.includes("pro")) {
      return 'premium'; // Pro models are highest tier
    }
    return 'paid'; // Default to paid tier
  }

  /**
   * Get model description for UI
   */
  getModelDescription(modelKey: keyof typeof MODELS): string {
    const descriptions = {
      "gemini-2.5-pro": "State-of-the-art thinking model for complex reasoning",
      "gemini-2.5-flash": "Best price-performance with thinking capabilities", 
      "gemini-2.5-flash-lite": "Most cost-efficient model with high throughput",
      "gemini-2.0-flash": "General purpose multimodal model with enhanced features",
      "gemini-2.0-flash-lite": "Optimized for cost efficiency and low latency",
      "gemini-1.5-pro": "Legacy multimodal model (deprecated)",
      "gemini-1.5-flash": "Legacy fast model (deprecated)",
    };
    return descriptions[modelKey] || "Google Gemini model";
  }
}

export const geminiService = new GeminiService();