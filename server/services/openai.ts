import OpenAI from "openai";
import { ARCTask } from "../../shared/types";

// the deprecated OpenAI model is "gpt-4o" which was released May 13, 2024.  USER EXPLICITLY DEMANDS ONLY THE MODELS THEY APPROVE.  
const MODELS = {
  "gpt-4.1-nano-2025-04-14": "gpt-4.1-nano-2025-04-14",
  "gpt-4.1-mini-2025-04-14": "gpt-4.1-mini-2025-04-14", 
  "gpt-4o-mini-2024-07-18": "gpt-4o-mini-2024-07-18",
  "o3-mini-2025-01-31": "o3-mini-2025-01-31",
  "o1-mini-2025-04-16": "o1-mini-2025-04-16",
  "gpt-4.1-2025-04-14": "gpt-4.1-2025-04-14"
} as const;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class OpenAIService {
  async analyzePuzzleWithModel(task: ARCTask, modelKey: keyof typeof MODELS) {
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

TEST CASE (the aliens' question and our correct answer):
Input: ${JSON.stringify(task.test[0].input)}
Correct Answer: ${JSON.stringify(task.test[0].output)}

Your job:
1. Figure out WHY this solution is correct by studying the pattern
2. Explain it in simple terms an idiot could understand.  The user sees the puzzle as emojis, NOT AS NUMBERS.  
3. Guess what the aliens might be trying to communicate.  The aliens gave us this an emoji map of the numbers 0-9.
4. Recognize that the numbers 0-9 map to emojis like this:

0: ⬛ (no/nothing/negative)
1: ✅ (yes/positive/agreement)
2: 👽 (alien/them)
3: 👤 (human/us)
4: 🪐 (their planet/home)
5: 🌍 (our planet/Earth)
6: 🛸 (their ships/travel)
7: ☄️ (danger/bad/problem)
8: ♥ (peace/friendship/good)
9: ⚠️ (warning/attention/important)

Respond in this JSON format:
{
  "patternDescription": "Simple explanation of what pattern you found",
  "solvingStrategy": "Step-by-step how to solve it, for dummies.  If they need to switch to thinking of the puzzle as numbers and not emojis, then mention that!",
  "hints": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "alienMeaning": "What the aliens might be trying to communicate, based on the logic used and the symbols",
  "confidence": "A confidence score between 0 and 100%, how sure you are about your answer and your explanation"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

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
