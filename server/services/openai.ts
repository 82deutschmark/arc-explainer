import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export async function analyzePuzzlePattern(
  trainExamples: Array<{ input: number[][], output: number[][] }>
): Promise<{
  patternDescription: string;
  solvingStrategy: string;
  hints: string[];
  confidence: number;
}> {
  try {
    const prompt = `
    Analyze these ARC-AGI puzzle training examples and identify the pattern. 
    Each cell contains a number from 0-9 representing different elements in an alien communication system:
    0: ⬛ (no/nothing/negative)
    1: ✅ (yes/positive/agreement)
    2: 👽 (alien/them)
    3: 👤 (human/us)
    4: 🪐 (their planet/home)
    5: 🌍 (our planet/Earth)
    6: 🛸 (their ships/travel)
    7: ☄️ (danger/bad/problem)
    8: ♥️ (peace/friendship/good)
    9: ⚠️ (warning/attention/important)

    Training examples:
    ${trainExamples.map((example, i) => 
      `Example ${i + 1}:
      Input: ${JSON.stringify(example.input)}
      Output: ${JSON.stringify(example.output)}`
    ).join('\n\n')}

    Provide your analysis in JSON format with:
    - patternDescription: Clear explanation of what transformation occurs
    - solvingStrategy: Step-by-step approach to solve similar puzzles
    - hints: Array of 3-5 helpful hints for humans
    - confidence: Number between 0-1 indicating certainty of analysis
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing abstract reasoning puzzles. Focus on clear, human-understandable explanations that help people learn logical patterns."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      patternDescription: analysis.patternDescription || "Unable to identify pattern",
      solvingStrategy: analysis.solvingStrategy || "Try looking for repeating elements or transformations",
      hints: analysis.hints || ["Look for patterns in how elements change", "Compare input and output carefully"],
      confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5))
    };
  } catch (error) {
    console.error('Error analyzing puzzle pattern:', error);
    return {
      patternDescription: "Analysis failed - please try again",
      solvingStrategy: "Manually compare input and output grids to find the transformation rule",
      hints: ["Look for shape changes", "Check for color/symbol patterns", "Consider position relationships"],
      confidence: 0
    };
  }
}

export async function validateSolution(
  input: number[][],
  userOutput: number[][],
  correctOutput: number[][]
): Promise<{
  isCorrect: boolean;
  accuracy: number;
  feedback: string;
}> {
  try {
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
    A user attempted to solve an ARC-AGI puzzle. Provide encouraging feedback.
    
    Input grid: ${JSON.stringify(input)}
    User's solution: ${JSON.stringify(userOutput)}
    Correct solution: ${JSON.stringify(correctOutput)}
    Accuracy: ${(accuracy * 100).toFixed(1)}%
    
    Provide constructive feedback in JSON format:
    - feedback: Encouraging message with specific guidance for improvement
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a supportive tutor helping humans learn abstract reasoning. Be encouraging and specific in your feedback."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return {
      isCorrect,
      accuracy,
      feedback: result.feedback || (isCorrect ? "Perfect! You solved it correctly!" : "Good attempt! Keep practicing to improve your pattern recognition.")
    };
  } catch (error) {
    console.error('Error validating solution:', error);
    return {
      isCorrect: false,
      accuracy: 0,
      feedback: "Unable to validate solution. Please try again."
    };
  }
}
