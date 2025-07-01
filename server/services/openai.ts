import OpenAI from "openai";

// OpenAI Model Configuration
// the newest OpenAI model is NOT "gpt-4o" which was released May 13, 2024. explicitly requested by the user to use other models by default.
const OPENAI_MODELS = {
  // Reasoning models
  "o1-mini": "o1-mini-2024-09-12",
  "o1-preview": "o1-preview-2024-09-12",

  // GPT-4 models
  "gpt-4o": "gpt-4o",
  "gpt-4o-mini": "gpt-4o-mini-2024-07-18",
  "gpt-4-turbo": "gpt-4-turbo-2024-04-09",
  "gpt-4": "gpt-4-0613",

  // Newer models (as specified by user)
  "gpt-4o-nano": "gpt-4.1-nano-2025-04-14",
  "o1-mini-2025": "o1-mini-2025-04-16",
  "gpt-4o-mini-2025": "gpt-4.1-mini-2025-04-14",
  "gpt-4o-mini-legacy": "gpt-4o-mini-2024-07-18",
} as const;

type ModelName = keyof typeof OPENAI_MODELS;

interface OpenAIConfig {
  model?: ModelName;
  temperature?: number;
  maxTokens?: number;
  useJsonMode?: boolean;
}

interface AnalysisResult {
  patternDescription: string;
  solvingStrategy: string;
  hints: string[];
  confidence: number;
  error?: string;
}

interface ValidationResult {
  isCorrect: boolean;
  accuracy: number;
  feedback: string;
  error?: string;
}

class OpenAIService {
  private client: OpenAI;
  private defaultModel: ModelName = "gpt-4o";
  private fallbackModels: ModelName[] = ["gpt-4o-mini", "gpt-4-turbo", "gpt-4"];

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }

    this.client = new OpenAI({ apiKey });
  }

  /**
   * Set the default model to use for analysis
   */
  setDefaultModel(model: ModelName): void {
    if (!OPENAI_MODELS[model]) {
      throw new Error(
        `Unsupported model: ${model}. Supported models: ${Object.keys(OPENAI_MODELS).join(", ")}`,
      );
    }
    this.defaultModel = model;
  }

  /**
   * Get the full model string for OpenAI API
   */
  private getModelString(model: ModelName): string {
    return OPENAI_MODELS[model];
  }

  /**
   * Make a completion request with automatic fallback
   */
  private async makeCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    config: OpenAIConfig = {},
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const modelsToTry = [
      config.model || this.defaultModel,
      ...this.fallbackModels,
    ];
    const uniqueModels = Array.from(new Set(modelsToTry));

    for (const model of uniqueModels) {
      try {
        console.log(
          `Attempting OpenAI request with model: ${this.getModelString(model)}`,
        );

        const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParams =
          {
            model: this.getModelString(model),
            messages,
            temperature: config.temperature ?? 0.3,
            max_tokens: config.maxTokens,
          };

        // Add JSON mode if requested and model supports it
        if (config.useJsonMode && !model.startsWith("o1")) {
          requestParams.response_format = { type: "json_object" };
        }

        const response =
          await this.client.chat.completions.create(requestParams);
        console.log(
          `OpenAI request successful with model: ${this.getModelString(model)}`,
        );
        return response;
      } catch (error: any) {
        console.warn(
          `Model ${this.getModelString(model)} failed:`,
          error.message,
        );

        // If this is the last model to try, throw the error
        if (model === uniqueModels[uniqueModels.length - 1]) {
          throw error;
        }

        // Continue to next model
        continue;
      }
    }

    throw new Error("All OpenAI models failed");
  }

  /**
   * Analyze ARC-AGI puzzle patterns using AI
   */
  async analyzePuzzlePattern(
    trainExamples: Array<{ input: number[][]; output: number[][] }>,
    preferredModel?: ModelName,
  ): Promise<AnalysisResult> {
    try {
      const spaceEmojiMapping = `
      0: ⬛ (void/empty/nothing)
      1: ✅ (positive/yes/activated)
      2: 👽 (alien entity/them)
      3: 👤 (human entity/us)
      4: 🪐 (their world/home)
      5: 🌍 (our world/Earth)
      6: 🛸 (movement/travel/ships)
      7: ☄️ (danger/conflict/problem)
      8: ♥️ (harmony/peace/connection)
      9: ⚠️ (alert/warning/important)`;

      const prompt = `
      You are analyzing alien communication patterns from the ARC-AGI corpus. Each grid represents a message in their symbolic language.
      
      SYMBOLIC MEANING:${spaceEmojiMapping}
      
      TRAINING EXAMPLES:
      ${trainExamples
        .map(
          (example, i) =>
            `Message ${i + 1}:
        Input Signal: ${JSON.stringify(example.input)}
        Decoded Output: ${JSON.stringify(example.output)}`,
        )
        .join("\n\n")}

      Your task is to decode the transformation rules the aliens use. Analyze as both:
      1. A pattern recognition expert identifying mathematical/logical transformations
      2. A xenolinguist studying alien communication protocols

      Respond in JSON format with:
      {
        "patternDescription": "Clear explanation of the transformation pattern",
        "solvingStrategy": "Step-by-step method to apply this pattern",
        "hints": ["3-5 specific insights to help humans understand the logic"],
        "confidence": 0.85
      }
      
      Focus on spatial relationships, symmetries, growth patterns, and logical rules that could be consistently applied.
      `;

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content:
            "You are an expert xenolinguist and pattern analyst specializing in abstract reasoning puzzles. Provide clear, educational explanations that help humans understand alien logic patterns.",
        },
        {
          role: "user",
          content: prompt,
        },
      ];

      const response = await this.makeCompletion(messages, {
        model: preferredModel || this.defaultModel,
        temperature: 0.3,
        useJsonMode: true,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      const analysis = JSON.parse(content);

      return {
        patternDescription:
          analysis.patternDescription || "Pattern analysis unavailable",
        solvingStrategy:
          analysis.solvingStrategy ||
          "Examine input-output relationships systematically",
        hints: Array.isArray(analysis.hints)
          ? analysis.hints
          : [
              "Look for repeating elements or structures",
              "Check for spatial transformations (rotation, reflection, scaling)",
              "Identify which elements change and which stay constant",
            ],
        confidence: Math.max(
          0,
          Math.min(1, Number(analysis.confidence) || 0.5),
        ),
      };
    } catch (error: any) {
      console.error("Error analyzing puzzle pattern:", error);
      return {
        patternDescription:
          "Analysis temporarily unavailable due to AI service issues",
        solvingStrategy:
          "Manually examine the training examples to identify transformation patterns",
        hints: [
          "Compare input and output grids systematically",
          "Look for mathematical relationships (doubling, mirroring, etc.)",
          "Check if the pattern involves spatial manipulation",
          "Consider if colors/symbols follow specific rules",
        ],
        confidence: 0,
        error: error.message,
      };
    }
  }

  /**
   * Validate a user's solution attempt (for future use)
   */
  async validateSolution(
    input: number[][],
    userOutput: number[][],
    correctOutput: number[][],
    preferredModel?: ModelName,
  ): Promise<ValidationResult> {
    try {
      // Calculate accuracy
      if (
        !userOutput ||
        !correctOutput ||
        userOutput.length !== correctOutput.length ||
        userOutput[0]?.length !== correctOutput[0]?.length
      ) {
        return {
          isCorrect: false,
          accuracy: 0,
          feedback: "Grid dimensions don't match the expected output size.",
          error: "Invalid grid dimensions",
        };
      }

      const totalCells = correctOutput.length * correctOutput[0].length;
      let correctCells = 0;

      for (let i = 0; i < correctOutput.length; i++) {
        for (let j = 0; j < correctOutput[i].length; j++) {
          if (userOutput[i] && userOutput[i][j] === correctOutput[i][j]) {
            correctCells++;
          }
        }
      }

      const accuracy = correctCells / totalCells;
      const isCorrect = accuracy === 1.0;

      const prompt = `
      Analyze this ARC-AGI puzzle attempt and provide educational feedback.
      
      Original Input: ${JSON.stringify(input)}
      User's Attempt: ${JSON.stringify(userOutput)}  
      Correct Answer: ${JSON.stringify(correctOutput)}
      Accuracy: ${(accuracy * 100).toFixed(1)}%
      
      Provide constructive feedback in JSON format:
      {
        "feedback": "Encouraging message with specific guidance for improvement"
      }
      
      Be supportive and educational, focusing on what they got right and specific areas for improvement.
      `;

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content:
            "You are a patient teacher helping someone learn pattern recognition. Provide encouraging, specific feedback.",
        },
        {
          role: "user",
          content: prompt,
        },
      ];

      const response = await this.makeCompletion(messages, {
        model: preferredModel || this.defaultModel,
        temperature: 0.7,
        useJsonMode: true,
      });

      const content = response.choices[0].message.content;
      const result = content ? JSON.parse(content) : {};

      return {
        isCorrect,
        accuracy,
        feedback:
          result.feedback ||
          (isCorrect
            ? "Perfect! You correctly decoded the alien communication pattern!"
            : "Good effort! Pattern recognition takes practice - keep studying the examples."),
      };
    } catch (error: any) {
      console.error("Error validating solution:", error);
      return {
        isCorrect: false,
        accuracy: 0,
        feedback:
          "Unable to validate your solution due to a technical issue. Please try again.",
        error: error.message,
      };
    }
  }

  /**
   * Get available models
   */
  getAvailableModels(): Record<string, string> {
    return { ...OPENAI_MODELS };
  }

  /**
   * Test connection to OpenAI
   */
  async testConnection(): Promise<{
    success: boolean;
    model: string;
    error?: string;
  }> {
    try {
      const response = await this.makeCompletion(
        [{ role: "user", content: "Respond with just 'OK'" }],
        { temperature: 0 },
      );

      return {
        success: true,
        model: this.getModelString(this.defaultModel),
      };
    } catch (error: any) {
      return {
        success: false,
        model: this.getModelString(this.defaultModel),
        error: error.message,
      };
    }
  }
}

// Export service instance and functions
export const openaiService = new OpenAIService();

export async function analyzePuzzlePattern(
  trainExamples: Array<{ input: number[][]; output: number[][] }>,
): Promise<AnalysisResult> {
  return openaiService.analyzePuzzlePattern(trainExamples);
}

export async function validateSolution(
  input: number[][],
  userOutput: number[][],
  correctOutput: number[][],
): Promise<ValidationResult> {
  return openaiService.validateSolution(input, userOutput, correctOutput);
}

// Export types for external use
export type { ModelName, AnalysisResult, ValidationResult };
