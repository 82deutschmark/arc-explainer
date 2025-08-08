/**
 * OpenAI service for analyzing ARC puzzles using OpenAI models
 * Supports reasoning log capture for OpenAI reasoning models (o3-mini, o4-mini, o3-2025-04-16)
 * These models automatically provide reasoning logs in response.choices[0].message.reasoning
 * 
 * @author Cascade
 */

import OpenAI from "openai";
import { ARCTask, PROMPT_TEMPLATES } from "../../shared/types";

const MODELS = {
  "gpt-4.1-nano-2025-04-14": "gpt-4.1-nano-2025-04-14",
  "gpt-4.1-mini-2025-04-14": "gpt-4.1-mini-2025-04-14",
  "gpt-4o-mini-2024-07-18": "gpt-4o-mini-2024-07-18",
  "o3-mini-2025-01-31": "o3-mini-2025-01-31",
  "o4-mini-2025-04-16": "o4-mini-2025-04-16",
  "o3-2025-04-16": "o3-2025-04-16",
  "gpt-4.1-2025-04-14": "gpt-4.1-2025-04-14",
} as const;

// Models that do NOT support temperature parameter
const MODELS_WITHOUT_TEMPERATURE = new Set([
  "o3-mini-2025-01-31",
  "o4-mini-2025-04-16",
  "o3-2025-04-16",
]);

// Models that support reasoning logs (OpenAI reasoning models)
const MODELS_WITH_REASONING = new Set([
  "o3-mini-2025-01-31",
  "o4-mini-2025-04-16", 
  "o3-2025-04-16",
]);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class OpenAIService {
  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: keyof typeof MODELS,
    temperature: number = 0.75,
    captureReasoning: boolean = true,
    promptId: string = "alienCommunication",
  ) {
    const modelName = MODELS[modelKey];

    const trainingExamples = task.train
      .map(
        (example, i) =>
          `Example ${i + 1}:\nInput: ${JSON.stringify(example.input)}\nOutput: ${JSON.stringify(example.output)}`,
      )
      .join("\n\n");

    // Get the selected prompt template or default to alienCommunication
    const selectedTemplate = PROMPT_TEMPLATES[promptId] || PROMPT_TEMPLATES.alienCommunication;
    console.log(`[OpenAI] Using prompt template: ${selectedTemplate.name} (${promptId})`);
    
    // Build emoji map section conditionally
    const emojiMapSection = selectedTemplate.emojiMapIncluded ? `

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
9: ⚠️ (warning/attention/important)` : '';
    
    const prompt = `${selectedTemplate.content}

TRAINING EXAMPLES${selectedTemplate.emojiMapIncluded ? ' (what the aliens taught us)' : ''}:
${trainingExamples}

TEST CASE${selectedTemplate.emojiMapIncluded ? " (the aliens' question and our correct answer, but we don't understand why the answer is correct)" : ' (input and correct answer for analysis)'}:
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

${selectedTemplate.emojiMapIncluded ? 'Respond' : 'Please respond'} in this JSON format:
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
      let response: any;
      let reasoningLog = null;
      let hasReasoningLog = false;
      let result: any;

      // Use Responses API for reasoning models, ChatCompletions for others
      if (MODELS_WITH_REASONING.has(modelKey)) {
        console.log(`[OpenAI] Using Responses API for reasoning model ${modelKey}`);
        
        const responsesOptions: any = {
          model: modelName,
          input: [{ role: "user", content: prompt }],
          reasoning: {
            effort: "medium",
            summary: "detailed"
          }
        };

        // Note: Responses API doesn't support temperature or text.format
        // JSON output is requested via prompt instructions instead

        response = await openai.responses.create(responsesOptions);

        // Extract JSON result from Responses API output_text
        const rawJson = (response as any).output_text || "";
        
        try {
          result = rawJson ? JSON.parse(rawJson) : {};
        } catch (e) {
          console.warn("[OpenAI] Failed to parse JSON output:", rawJson.substring(0, 200), e);
          result = {};
        }

        // Extract reasoning logs from Responses API output array
        if (captureReasoning) {
          const reasoningParts: string[] = [];
          
          // The Responses API returns reasoning in the output array with type: "reasoning"
          for (const outputItem of (response as any).output ?? []) {
            if (outputItem.type === "reasoning") {
              // Handle both summary array and direct text formats
              if (Array.isArray(outputItem.summary)) {
                reasoningParts.push(outputItem.summary.map((s: any) => s.text).join("\n"));
              } else if (typeof outputItem.summary === 'string') {
                reasoningParts.push(outputItem.summary);
              } else if (outputItem.reasoning) {
                // Some formats might have direct reasoning text
                reasoningParts.push(outputItem.reasoning);
              }
            }
          }

          if (reasoningParts.length) {
            reasoningLog = reasoningParts.join("\n\n");
            hasReasoningLog = true;
            console.log(`[OpenAI] Successfully captured reasoning log for model ${modelKey} (${reasoningLog.length} characters)`);
          } else {
            console.log(`[OpenAI] No reasoning log found in Responses API output for model ${modelKey}`);
            
            // Debug: log the full response structure for troubleshooting
            console.log(`[OpenAI] Debug - Response structure:`, JSON.stringify((response as any).output?.slice(0, 3), null, 2));
          }
        }
      } else {
        console.log(`[OpenAI] Using ChatCompletions API for standard model ${modelKey}`);
        
        const chatOptions: any = {
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        };

        // Only add temperature for models that support it
        if (!MODELS_WITHOUT_TEMPERATURE.has(modelKey)) {
          chatOptions.temperature = temperature;
        }

        response = await openai.chat.completions.create(chatOptions);
        result = JSON.parse(response.choices[0].message.content || "{}");
        
        console.log(`[OpenAI] Standard model ${modelKey} - no reasoning logs available`);
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

export const openaiService = new OpenAIService();
