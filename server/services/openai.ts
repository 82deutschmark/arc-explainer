import OpenAI from "openai";
import { ARCTask } from "../../shared/types";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODELS = {
  'gpt-4.1-nano-2025-04-14': 'gpt-4.1-nano-2025-04-14',
  'o1-mini-2025-04-16': 'o1-mini-2025-04-16', 
  'gpt-4.1-mini-2025-04-14': 'gpt-4.1-mini-2025-04-14',
  'gpt-4o-mini-2024-07-18': 'gpt-4o-mini-2024-07-18'
} as const;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class OpenAIService {
  async analyzePuzzleWithModel(task: ARCTask, modelKey: keyof typeof MODELS) {
    const modelName = MODELS[modelKey];
    
    const trainingExamples = task.train.map((example, i) => 
      `Example ${i + 1}:\nInput: ${JSON.stringify(example.input)}\nOutput: ${JSON.stringify(example.output)}`
    ).join('\n\n');

    const prompt = `You are helping children understand alien communication patterns. Look at this puzzle where we already know the correct answer.

TRAINING EXAMPLES (what the aliens taught us):
${trainingExamples}

TEST CASE (the aliens' question and our correct answer):
Input: ${JSON.stringify(task.test[0].input)}
Correct Answer: ${JSON.stringify(task.test[0].output)}

Your job:
1. Figure out WHY this solution is correct by studying the pattern
2. Explain it in simple terms a child could understand  
3. Guess what the aliens might be trying to communicate

Respond in this JSON format:
{
  "patternDescription": "Simple explanation of what pattern you found",
  "solvingStrategy": "Step-by-step how to solve it, for kids",
  "hints": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "alienMeaning": "What the aliens might be trying to communicate",
  "confidence": 0.85
}`;

    try {
      const response = await openai.chat.completions.create({
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return {
        model: modelKey,
        ...result
      };
    } catch (error) {
      console.error(`Error with model ${modelKey}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Model ${modelKey} failed: ${errorMessage}`);
    }
  }
}

export const openaiService = new OpenAIService();