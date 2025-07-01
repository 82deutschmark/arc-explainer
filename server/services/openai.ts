import OpenAI from "openai";
import { ARCTask } from "../../shared/types";

// the deprecated OpenAI model is "gpt-4o" which was released May 13, 2024.  USER EXPLICITLY DEMANDS ONLY THE MODELS THEY APPROVE.  
const MODELS = {
  "gpt-4.1-nano-2025-04-14": "gpt-4.1-nano-2025-04-14",
  "gpt-4.1-mini-2025-04-14": "gpt-4.1-mini-2025-04-14", 
  "gpt-4o-mini-2024-07-18": "gpt-4o-mini-2024-07-18",
  "o3-mini-2025-01-31": "o3-mini-2025-01-31",
  "o4-mini-2025-04-16": "o4-mini-2025-04-16",
  "o1-mini-2025-04-16": "o1-mini-2025-04-16",
  "gpt-4.1-2025-04-14": "gpt-4.1-2025-04-14"
} as const;

// Models that do NOT support temperature parameter
const MODELS_WITHOUT_TEMPERATURE = new Set([
  "o3-mini-2025-01-31",
  "o4-mini-2025-04-16", 
  "o1-mini-2025-04-16"
]);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class OpenAIService {
  async analyzePuzzleWithModel(task: ARCTask, modelKey: keyof typeof MODELS, temperature: number = 0.75) {
    const modelName = MODELS[modelKey];

    const trainingExamples = task.train
      .map(
        (example, i) =>
          `Example ${i + 1}:\nInput: ${JSON.stringify(example.input)}\nOutput: ${JSON.stringify(example.output)}`,
      )
      .join("\n\n");

    const prompt = `You are helping idiot humans understand alien communication patterns. Look at this puzzle where we already know the correct answer.

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

BE VERY CAUTIOUS AND CONSERVATIVE in your analysis. The patterns may have exceptions or alternative valid interpretations. Hedge your explanations appropriately and mention possible limitations.

Respond in this JSON format:
{
  "patternDescription": "Simple explanation of what pattern you found - BE CAUTIOUS, mention if this might not work for all cases",
  "solvingStrategy": "Step-by-step how to solve it, for dummies. If they need to switch to thinking of the puzzle as numbers and not emojis, then mention that! INCLUDE WARNINGS about potential exceptions",
  "hints": ["Key insight 1 (mention limitations)", "Key insight 2 (be cautious)", "Key insight 3 (hedge appropriately)"],
  "alienMeaning": "What the aliens might be trying to communicate, based on the logic used and the symbols - express uncertainty where appropriate",
  "patternConfidence": 0.75,
  "strategyConfidence": 0.80,
  "hintsConfidence": 0.70,
  "alienMeaningConfidence": 0.60
}

IMPORTANT: All confidence values must be numbers between 0.0 and 1.0 (not percentages, not strings). Be conservative - most patterns should have confidence below 0.8 unless extremely obvious.`;

    try {
      const requestOptions: any = {
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      };

      // Only add temperature for models that support it
      if (!MODELS_WITHOUT_TEMPERATURE.has(modelKey)) {
        requestOptions.temperature = temperature;
      }

      const response = await openai.chat.completions.create(requestOptions);

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        model: modelKey,
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
