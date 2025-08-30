# OpenAI JSON Schema for ARC-AGI Project

## Problem Analysis

The provided OpenAI JSON schema is missing critical fields that our ARC-AGI project actually uses and stores. After analyzing our codebase (`shared/types.ts`, `client/src/types/puzzle.ts`, and server implementations), here are the issues:

### ❌ Current Schema Problems

1. **Missing `alienMeaning`** - Core field for alien communication interpretation
2. **Missing `alienMeaningConfidence`** - Confidence score for alien interpretation
3. **Missing `reasoningLog`** - Step-by-step AI reasoning capture
4. **Wrong `predictedOutput` type** - Should be `number[][]`, not `string`
5. **Missing multi-test support** - No `multiplePredictedOutputs` for multiple test cases
6. **Missing validation fields** - No accuracy/correctness tracking
7. **Missing token/cost tracking** - No budget management fields
8. **Wrong `keySteps` type** - Should be `string[]`, not `string`

## ✅ Corrected Complete JSON Schema

```json
{
  "name": "arc_agi_puzzle_analysis_response",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "predictedOutput": {
        "type": "array",
        "description": "The final grid solution as a 2D array of numbers (0-9)",
        "items": {
          "type": "array",
          "items": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9
          }
        }
      },
      "multiplePredictedOutputs": {
        "type": "array",
        "description": "Array of predicted output grids for multi-test puzzles",
        "items": {
          "type": "array",
          "items": {
            "type": "array",
            "items": {
              "type": "integer",
              "minimum": 0,
              "maximum": 9
            }
          }
        }
      },
      "patternDescription": {
        "type": "string",
        "description": "Clear description of the transformation rule in natural language"
      },
      "solvingStrategy": {
        "type": "string",
        "description": "Summary of the strategy used to solve the puzzle"
      },
      "keySteps": {
        "type": "array",
        "description": "Array of key analytical steps taken to solve the puzzle",
        "items": {
          "type": "string"
        }
      },
      "hints": {
        "type": "array",
        "description": "Numbered list of hints and pseudo-code for algorithms",
        "items": {
          "type": "string"
        }
      },
      "alienMeaning": {
        "type": "string",
        "description": "Interpretation of the puzzle in terms of alien communication system"
      },
      "alienMeaningConfidence": {
        "type": "number",
        "description": "Confidence level (0-100) in the alien communication interpretation",
        "minimum": 0,
        "maximum": 100
      },
      "confidence": {
        "type": "number",
        "description": "Overall confidence level (0-100) in the solution correctness",
        "minimum": 0,
        "maximum": 100
      },
      "reasoningLog": {
        "type": "string",
        "description": "Step-by-step reasoning process used to arrive at the solution"
      },
      "isPredictionCorrect": {
        "type": "boolean",
        "description": "Whether the prediction matches the expected answer (if known)"
      },
      "predictionAccuracyScore": {
        "type": "number",
        "description": "Accuracy/trustworthiness score (0-1) based on confidence and correctness",
        "minimum": 0,
        "maximum": 1
      },
      "extractionMethod": {
        "type": "string",
        "description": "Method used to extract the grid from the reasoning (regex, structured, etc.)"
      },
      "inputTokens": {
        "type": "integer",
        "description": "Number of input tokens used in the API call",
        "minimum": 0
      },
      "outputTokens": {
        "type": "integer",
        "description": "Number of output tokens generated in the response",
        "minimum": 0
      },
      "reasoningTokens": {
        "type": "integer",
        "description": "Number of reasoning tokens used (for reasoning models)",
        "minimum": 0
      },
      "totalTokens": {
        "type": "integer",
        "description": "Total tokens used (input + output + reasoning)",
        "minimum": 0
      },
      "estimatedCost": {
        "type": "number",
        "description": "Estimated cost of the API call in USD",
        "minimum": 0
      }
    },
    "required": [
      "patternDescription",
      "solvingStrategy", 
      "hints",
      "alienMeaning",
      "confidence",
      "alienMeaningConfidence"
    ],
    "additionalProperties": false
  }
}
```

## Field Mapping to Our Database

| Schema Field | Database Column | Type | Description |
|-------------|-----------------|------|-------------|
| `predictedOutput` | `predicted_output_grid` | `JSONB` | Single test prediction |
| `multiplePredictedOutputs` | `multiple_predicted_outputs` | `JSONB` | Multi-test predictions |
| `patternDescription` | `pattern_description` | `TEXT` | Core pattern explanation |
| `solvingStrategy` | `solving_strategy` | `TEXT` | Solution approach |
| `keySteps` | `key_steps` | `JSONB` | Analytical steps array |
| `hints` | `hints` | `JSONB` | Hints array |
| `alienMeaning` | `alien_meaning` | `TEXT` | Alien communication |
| `alienMeaningConfidence` | `alien_meaning_confidence` | `INTEGER` | Alien confidence |
| `confidence` | `confidence` | `INTEGER` | Overall confidence |
| `reasoningLog` | `reasoning_log` | `TEXT` | AI reasoning trace |
| `isPredictionCorrect` | `is_prediction_correct` | `BOOLEAN` | Validation result |
| `predictionAccuracyScore` | `prediction_accuracy_score` | `DECIMAL` | Trustworthiness |
| `extractionMethod` | `extraction_method` | `TEXT` | Grid extraction method |
| `inputTokens` | `input_tokens` | `INTEGER` | Token usage |
| `outputTokens` | `output_tokens` | `INTEGER` | Token usage |
| `reasoningTokens` | `reasoning_tokens` | `INTEGER` | Token usage |
| `totalTokens` | `total_tokens` | `INTEGER` | Token usage |
| `estimatedCost` | `estimated_cost` | `DECIMAL` | Cost tracking |

## Usage Examples

### Single Test Puzzle Response
```json
{
  "predictedOutput": [[1,0,1],[0,1,0],[1,0,1]],
  "patternDescription": "The pattern creates a checkerboard by alternating 0s and 1s",
  "solvingStrategy": "Pattern recognition and geometric transformation",
  "keySteps": ["Identify alternating pattern", "Apply to grid", "Verify symmetry"],
  "hints": ["Look for alternating values", "Check diagonal symmetry"],
  "alienMeaning": "This represents a binary communication protocol",
  "alienMeaningConfidence": 85,
  "confidence": 92,
  "reasoningLog": "First, I noticed the alternating pattern...",
  "isPredictionCorrect": true,
  "predictionAccuracyScore": 0.92,
  "extractionMethod": "structured_grid_parsing",
  "inputTokens": 1250,
  "outputTokens": 850,
  "reasoningTokens": 2100,
  "totalTokens": 4200,
  "estimatedCost": 0.063
}
```

### Multi-Test Puzzle Response
```json
{
  "multiplePredictedOutputs": [
    [[1,0],[0,1]], 
    [[2,1],[1,2]]
  ],
  "patternDescription": "Increment each cell value by 1, wrapping at 3",
  "solvingStrategy": "Mathematical transformation with modular arithmetic",
  "keySteps": ["Identify increment pattern", "Apply modular math", "Handle wraparound"],
  "hints": ["Each number increases by 1", "Values wrap at 3"],
  "alienMeaning": "Counting system with base-3 arithmetic",
  "alienMeaningConfidence": 78,
  "confidence": 88
}
```

## Implementation in OpenAI Dashboard

1. **Navigate to** OpenAI Platform → Playground → Assistants
2. **Create/Edit Assistant** and go to "Tools" section
3. **Add Function** with the name `arc_agi_puzzle_analysis_response`
4. **Paste the complete JSON schema** from above
5. **Test with sample puzzle** to verify all fields are captured
6. **Update system prompt** to reference the function name

## Key Benefits

✅ **Complete field coverage** - All database fields supported  
✅ **Proper typing** - 2D arrays for grids, not strings  
✅ **Multi-test support** - Handles complex puzzles  
✅ **Cost tracking** - Budget management built-in  
✅ **Validation ready** - Accuracy scoring included  
✅ **Reasoning capture** - Full AI reasoning preserved  

## Validation Notes

- The schema enforces grid values 0-9 (standard ARC range)
- Required fields ensure core analysis is always present
- Optional fields support advanced features (multi-test, tokens, etc.)
- Field names match our existing database schema for seamless integration

---

**Generated for ARC-AGI Puzzle Explainer Project**  
**Last Updated**: January 2025