# Modern ARC-AGI Puzzle Solver API

This document explains the modern approach to solving ARC-AGI puzzles using API-based LLM interaction, based on the architecture patterns from the ARC Explainer project.

## Overview

The `arc_solver_api.py` script implements a modern approach to solving ARC puzzles by:

1. Using structured API calls to LLMs (OpenAI Responses API and OpenRouter Chat Completions)
2. Properly formatted prompts following the project's modular architecture
3. Structured JSON output with validation
4. Error handling and continuation support

## Key Improvements Over Original Approach

### 1. Modern API Integration

- **OpenAI Responses API**: Uses the newer structured output capabilities with JSON schema validation
- **OpenRouter Chat Completions**: Supports a wide variety of models with proper continuation handling
- **Unified Interface**: Single API for multiple provider types

### 2. Structured Output Enforcement

- Enforces JSON schema compliance at the API level
- Provides detailed error handling for parsing failures
- Preserves raw responses for debugging

### 3. Continuation Support

- Automatically handles truncated responses
- Implements retry logic for incomplete outputs
- Maintains context across continuation calls

### 4. Mathematical and Logical Rigor

The updated solver instructions in `basePrompts.ts` now specify a more rigorous approach:

1. **SYSTEMATIC PATTERN ANALYSIS**:
   - Geometric transformations (rotation, reflection, translation, scaling)
   - Pattern operations (completion, extension, repetition, sequences)
   - Logical operations (AND/OR/XOR/NOT, conditionals)
   - Grid operations (splitting, merging, overlay, subtraction)
   - Object classification (sorting, filtering, grouping)
   - Color mapping (replacement, mapping, counting, patterns)
   - Shape operations (detection, transformation, completion, generation)
   - Spatial relationships (adjacency, containment, alignment, distances)

2. **MATHEMATICAL TRANSFORMATION MODELING**:
   - Express patterns as deterministic functions: input_grid → output_grid
   - Model transformations as composable operations: T(input) = output
   - Represent grid states as matrices with defined algebraic properties
   - Apply constraint satisfaction for multi-rule puzzles

3. **PREDICTION GENERATION**:
   - Apply discovered transformation function to test input
   - Validate prediction against training pattern consistency
   - Generate structured JSON output with confidence metrics
   - Provide traceable reasoning steps for debugging

## Supported Models

### OpenAI Models (Responses API)
- `gpt-4.1-nano-2025-04-14`
- `gpt-4o-mini-2024-07-18`
- `o3-2025-04-16`

### OpenRouter Models (Chat Completions)
- `meta-llama/llama-3.3-70b-instruct`
- `qwen/qwen-2.5-coder-32b-instruct`
- `x-ai/grok-3`

## Usage

1. Set your API keys in environment variables:
   ```bash
   export OPENAI_API_KEY="your-openai-key"
   export OPENROUTER_API_KEY="your-openrouter-key"
   ```

2. Use the solver in your Python code:
   ```python
   from arc_solver_api import ARCSolverAPI
   
   solver = ARCSolverAPI()
   
   # Load your ARC task
   task = {
       "train": [
           {"input": [[0, 0, 0], [0, 1, 0], [0, 0, 0]], 
            "output": [[1, 1, 1], [1, 1, 1], [1, 1, 1]]}
       ],
       "test": [
           {"input": [[0, 1, 0], [1, 0, 1], [0, 1, 0]]}
       ]
   }
   
   # Solve with a specific model
   result = solver.solve_puzzle(task, 'gpt-4.1-nano-2025-04-14')
   print(result['content'])
   ```

## Output Format

The solver returns structured JSON output with the following fields:

- `multiplePredictedOutputs`: Boolean indicating if multiple test cases
- `predictedOutput`: Solution grid for single test case
- `predictedOutput1-3`: Solution grids for multiple test cases
- `solvingStrategy`: Domain-specific language for the solving approach
- `patternDescription`: Clear description of identified transformations
- `hints`: Three algorithmic approaches considered
- `confidence`: Confidence level (1-100)

## Error Handling

The solver includes robust error handling for:
- API call failures
- Response parsing errors
- Truncated responses with automatic continuation
- Model-specific configuration issues

## Integration with Original Notebook

The mathematical and logical concepts from the original `eval.ipynb` have been preserved and enhanced:
- Grid transformation logic
- Pattern recognition approaches
- Numerical array processing
- Evaluation metrics

However, the implementation now uses modern API interactions instead of deprecated model interfaces.
