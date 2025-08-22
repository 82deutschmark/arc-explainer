/**
 * Anthropic Claude service for analyzing ARC puzzles using Claude models
 * Simplified to focus on clean, direct responses without complex reasoning capture
 * 
 * Supports dynamic prompt template selection via promptId parameter.
 * Uses PROMPT_TEMPLATES from shared/types to allow different explanation approaches:
 * - alienCommunication: Frames puzzles as alien communication (includes emoji map)
 * - standardExplanation: Direct puzzle explanations without thematic framing
 * - educationalApproach: Teaching-focused explanations for learning
 * 
 * The emoji map and JSON response format adapt automatically based on template selection.
 * 
 * @author Cascade / Gemini Pro 2.5
 */

import Anthropic from "@anthropic-ai/sdk";
import { ARCTask } from "../../shared/types";
import { buildAnalysisPrompt, getDefaultPromptId } from "./promptBuilder";
import type { PromptOptions } from "./promptBuilder"; // Cascade: modular prompt options

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

// JSON-structure-enforcing system prompts (same as OpenAI)
const SOLVER_SYSTEM_PROMPT = `You are a puzzle solver. Respond with ONLY valid JSON in this exact format:

{
  "predictedOutput": [[0,1,2],[3,4,5],[6,7,8]],
  "patternDescription": "Clear description of what you learned from the training examples",
  "solvingStrategy": "Step-by-step reasoning used to predict the answer, including the predicted output grid as a 2D array",
  "hints": ["Key reasoning insight 1", "Key reasoning insight 2", "Key reasoning insight 3"],
  "confidence": 85
}

CRITICAL: The "predictedOutput" field MUST be first and contain a 2D array of integers matching the expected output grid dimensions. No other format accepted.`;

const MULTI_SOLVER_SYSTEM_PROMPT = `You are a puzzle solver. Respond with ONLY valid JSON in this exact format:

{
  "predictedOutputs": [[[0,1],[2,3]], [[4,5],[6,7]]],
  "patternDescription": "Clear description of what you learned from the training examples", 
  "solvingStrategy": "Step-by-step reasoning used to predict the answer, including the predicted output grids as 2D arrays",
  "hints": ["Key reasoning insight 1", "Key reasoning insight 2", "Key reasoning insight 3"],
  "confidence": 85
}

CRITICAL: The "predictedOutputs" field MUST be first and contain an array of 2D integer arrays, one for each test case in order. No other format accepted.`;

const EXPLANATION_SYSTEM_PROMPT = `You are a puzzle analysis expert. Respond with ONLY valid JSON in this exact format:

{
  "patternDescription": "Clear description of the rules learned from the training examples",
  "solvingStrategy": "Explain the thinking and reasoning required to solve this puzzle, not specific steps", 
  "hints": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "confidence": 85
}

CRITICAL: Return ONLY valid JSON with these exact field names and types. No additional text.`;

const ALIEN_EXPLANATION_SYSTEM_PROMPT = `You are a puzzle analysis expert. Respond with ONLY valid JSON in this exact format:

{
  "patternDescription": "What the aliens are trying to communicate to us through this puzzle, based on the ARC-AGI transformation types",
  "solvingStrategy": "Step-by-step explain the thinking and reasoning required to solve this puzzle, for novices. If they need to switch to thinking of the puzzle as numbers and not emojis, then mention that!",
  "hints": ["Key insight 1", "Key insight 2", "Key insight 3"], 
  "confidence": 85,
  "alienMeaning": "The aliens' message",
  "alienMeaningConfidence": 85
}

CRITICAL: Return ONLY valid JSON with these exact field names and types. No additional text.`;

export class AnthropicService {
  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: keyof typeof MODELS,
    temperature: number = 0.2,
    captureReasoning: boolean = true,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts?: {
      systemPromptMode?: 'ARC' | 'None';
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
      reasoningVerbosity?: 'low' | 'medium' | 'high';
      reasoningSummaryType?: 'auto' | 'detailed';
    }
  ) {
    const modelName = MODELS[modelKey];

    // Determine system prompt mode (default to ARC for better results)
    const systemPromptMode = serviceOpts?.systemPromptMode || 'ARC';
    
    // Build prompt using shared prompt builder - keep it simple
    const { prompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);
    
    // Prepare system and user messages based on mode
    let systemMessage: string | undefined;
    let userMessage: string;
    
    if (systemPromptMode === 'ARC') {
      // ARC Mode: Select appropriate system prompt based on context
      const isSolverMode = promptId === "solver";
      const isAlienMode = selectedTemplate?.emojiMapIncluded || false;
      const hasMultipleTests = task.test.length > 1;
      
      if (isSolverMode && hasMultipleTests) {
        systemMessage = MULTI_SOLVER_SYSTEM_PROMPT;
        console.log(`[Anthropic] Using multi-test solver system prompt (${task.test.length} tests)`);
      } else if (isSolverMode) {
        systemMessage = SOLVER_SYSTEM_PROMPT;
        console.log(`[Anthropic] Using single-test solver system prompt`);
      } else if (isAlienMode) {
        systemMessage = ALIEN_EXPLANATION_SYSTEM_PROMPT;
        console.log(`[Anthropic] Using alien explanation system prompt`);
      } else {
        systemMessage = EXPLANATION_SYSTEM_PROMPT;
        console.log(`[Anthropic] Using standard explanation system prompt`);
      }
      
      userMessage = prompt;
    } else {
      // None Mode: Current behavior - everything as user message
      systemMessage = undefined;
      userMessage = prompt;
      console.log(`[Anthropic] Using None mode (current behavior) with model ${modelKey}`);
    }

    try {
      // Build request options with proper Anthropic system parameter
      const requestOptions: any = {
        model: modelName,
        max_tokens: 20000, // Increased from 4000 based on models.yml capabilities
        messages: [{ role: "user", content: userMessage }],
      };
      
      // Add system prompt if in ARC mode (Anthropic supports dedicated system parameter)
      if (systemMessage) {
        requestOptions.system = systemMessage;
      }

      // Only add temperature for models that support it
      if (!MODELS_WITHOUT_TEMPERATURE.has(modelName)) {
        requestOptions.temperature = temperature;
      }

      const response = await anthropic.messages.create(requestOptions);
      
      // Simple response parsing
      const content = response.content[0];
      const textContent = content.type === 'text' ? content.text : '';
      
      // Simple JSON extraction - try direct parse first, then look for JSON in text
      let result;
      try {
        result = JSON.parse(textContent);
      } catch (parseError) {
        // Look for JSON anywhere in the text
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch (secondError) {
            // If no JSON found, treat as natural language response
            result = {
              patternDescription: textContent.length > 0 ? textContent : "No response received",
              solvingStrategy: "",
              hints: [],
              confidence: 50
            };
          }
        } else {
          // If no JSON found, treat as natural language response
          result = {
            patternDescription: textContent.length > 0 ? textContent : "No response received",
            solvingStrategy: "",
            hints: [],
            confidence: 50
          };
        }
      }
      
      return {
        model: modelKey,
        reasoningLog: null,
        hasReasoningLog: false,
        // Include analysis parameters for database storage
        temperature,
        reasoningEffort: serviceOpts?.reasoningEffort || null,
        reasoningVerbosity: serviceOpts?.reasoningVerbosity || null,
        reasoningSummaryType: serviceOpts?.reasoningSummaryType || null,
        ...result,
      };
    } catch (error) {
      console.error(`Error with model ${modelKey}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Model ${modelKey} failed: ${errorMessage}`);
    }
  }

  /**
   * Generate a preview of the exact prompt that will be sent to Anthropic
   * Shows the provider-specific message format and structure
   */
  async generatePromptPreview(
    task: ARCTask,
    modelKey: keyof typeof MODELS,
    temperature: number = 0.2,
    captureReasoning: boolean = true,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
  ) {
    const modelName = MODELS[modelKey];

    // Build prompt using shared prompt builder - keep it simple  
    const { prompt, selectedTemplate } = buildAnalysisPrompt(task, promptId, customPrompt, options);

    // Anthropic uses messages array format
    const messageFormat = {
      model: modelName,
      max_tokens: 20000, // Updated from 4000 based on models.yml
      messages: [{ role: "user", content: prompt }],
      temperature: temperature
    };

    const providerSpecificNotes = [
      "Uses Anthropic Messages API",
      "Temperature parameter supported",
      "Max tokens set to 20000"
    ];

    return {
      provider: "Anthropic",
      modelName,
      promptText: prompt,
      messageFormat,
      templateInfo: {
        id: selectedTemplate?.id || "custom",
        name: selectedTemplate?.name || "Custom Prompt",
        usesEmojis: selectedTemplate?.emojiMapIncluded || false
      },
      promptStats: {
        characterCount: prompt.length,
        wordCount: prompt.split(/\s+/).length,
        lineCount: prompt.split('\n').length
      },
      providerSpecificNotes,
      captureReasoning,
      temperature
    };
  }
}

export const anthropicService = new AnthropicService(); 