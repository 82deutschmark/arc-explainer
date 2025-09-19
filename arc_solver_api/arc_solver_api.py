"""
Modern ARC-AGI Puzzle Solver using API-based LLM Interaction
Based on the architecture patterns from the ARC Explainer project

This script implements a modern approach to solving ARC puzzles by:
1. Using structured API calls to LLMs (OpenAI Responses API and OpenRouter Chat Completions)
2. Properly formatted prompts following the project's modular architecture
3. Structured JSON output with validation
4. Error handling and continuation support

Author: Based on arc-explainer project patterns
Date: September 19, 2025
"""

import openai
import requests
import json
import os
import numpy as np
from typing import Dict, Any, Optional, List, Tuple
from enum import Enum

class ProviderType(Enum):
    OPENAI = "openai"
    OPENROUTER = "openrouter"

class ModelConfig:
    """Centralized model configuration matching arc-explainer patterns"""
    
    # OpenAI Models with Responses API support
    OPENAI_MODELS = {
        'gpt-4.1-nano-2025-04-14': {
            'api_model_name': 'gpt-4.1-nano-2025-04-14',
            'is_reasoning': False,
            'supports_temperature': True,
            'context_window': 1000000,
            'api_endpoint': 'https://api.openai.com/v1/responses',
            'api_type': 'responses'
        },
        'gpt-4o-mini-2024-07-18': {
            'api_model_name': 'gpt-4o-mini-2024-07-18',
            'is_reasoning': False,
            'supports_temperature': True,
            'context_window': 128000,
            'api_endpoint': 'https://api.openai.com/v1/responses',
            'api_type': 'responses'
        },
        'o3-2025-04-16': {
            'api_model_name': 'o3-2025-04-16',
            'is_reasoning': True,
            'supports_temperature': False,
            'context_window': 400000,
            'api_endpoint': 'https://api.openai.com/v1/responses',
            'api_type': 'responses'
        }
    }
    
    # OpenRouter Models with Chat Completions support
    OPENROUTER_MODELS = {
        'meta-llama/llama-3.3-70b-instruct': {
            'api_model_name': 'meta-llama/llama-3.3-70b-instruct',
            'is_reasoning': False,
            'supports_temperature': True,
            'context_window': 128000,
            'max_output_tokens': 32000,
            'supports_structured_output': True,
            'api_endpoint': 'https://openrouter.ai/api/v1/chat/completions',
            'api_type': 'chat'
        },
        'qwen/qwen-2.5-coder-32b-instruct': {
            'api_model_name': 'qwen/qwen-2.5-coder-32b-instruct',
            'is_reasoning': False,
            'supports_temperature': True,
            'context_window': 128000,
            'max_output_tokens': 32000,
            'supports_structured_output': True,
            'api_endpoint': 'https://openrouter.ai/api/v1/chat/completions',
            'api_type': 'chat'
        },
        'x-ai/grok-3': {
            'api_model_name': 'x-ai/grok-3',
            'is_reasoning': True,
            'supports_temperature': True,
            'context_window': 256000,
            'max_output_tokens': 31000,
            'supports_structured_output': False,
            'requires_prompt_format': True,
            'api_endpoint': 'https://openrouter.ai/api/v1/chat/completions',
            'api_type': 'chat'
        }
    }
    
    @classmethod
    def get_model_config(cls, model_key: str) -> Optional[Dict[str, Any]]:
        """Get configuration for a model"""
        if model_key in cls.OPENAI_MODELS:
            return cls.OPENAI_MODELS[model_key]
        elif model_key in cls.OPENROUTER_MODELS:
            return cls.OPENROUTER_MODELS[model_key]
        return None
    
    @classmethod
    def get_provider_type(cls, model_key: str) -> Optional[ProviderType]:
        """Get provider type for a model"""
        if model_key in cls.OPENAI_MODELS:
            return ProviderType.OPENAI
        elif model_key in cls.OPENROUTER_MODELS:
            return ProviderType.OPENROUTER
        return None


class ARCSolverAPI:
    """Modern ARC puzzle solver using API-based LLM interaction"""
    
    def __init__(self, openai_api_key: Optional[str] = None, openrouter_api_key: Optional[str] = None):
        """Initialize with API keys"""
        self.openai_api_key = openai_api_key or os.getenv('OPENAI_API_KEY')
        self.openrouter_api_key = openrouter_api_key or os.getenv('OPENROUTER_API_KEY')
        
    def solve_puzzle(self, task: Dict[str, Any], model_key: str, temperature: float = 0.2) -> Dict[str, Any]:
        """Solve an ARC puzzle using the specified model"""
        # Format the prompt following the project's modular architecture
        prompt = self._format_prompt(task)
        
        # Get model configuration
        model_config = ModelConfig.get_model_config(model_key)
        if not model_config:
            raise ValueError(f"Unsupported model: {model_key}")
            
        provider_type = ModelConfig.get_provider_type(model_key)
        
        # Call the appropriate API
        if provider_type == ProviderType.OPENAI:
            return self._call_openai_api(prompt, model_key, temperature)
        elif provider_type == ProviderType.OPENROUTER:
            return self._call_openrouter_api(prompt, model_key, temperature)
        else:
            raise ValueError(f"Unsupported provider for model: {model_key}")
    
    def _format_prompt(self, task: Dict[str, Any]) -> str:
        """Format prompt following the arc-explainer project's modular architecture"""
        # Format training examples
        training_examples = self._format_training_examples(task['train'])
        
        # Format test case (solver mode - no answer provided)
        test_case = self._format_test_case(task['test'][0], include_answer=False)
        
        # Create the prompt following the project's structure
        prompt = f"""You are an expert at analyzing ARC-AGI puzzles. 
Your job is to understand transformation patterns and provide clear, structured analysis.

ARC-AGI puzzles consist of:
- Training examples showing input→output transformations  
- Test cases where you predict the transformation based on what you learned from the training examples

Key transformation types include:
- Geometric: rotation, reflection, translation, scaling
- Pattern: completion, extension, repetition, sequences
- Logical: AND/OR/XOR/NOT operations, conditionals
- Grid: splitting, merging, overlay, subtraction
- Object: counting, sorting, filtering, grouping
- Color: replacement, mapping, counting, patterns
- Shape: detection, transformation, completion, generation
- Spatial: adjacency, containment, alignment, distances

JSON STRUCTURE REQUIREMENT: The predictedOutput or multiplePredictedOutputs field must be THE FIRST field in your JSON response.

Put all your analysis and insights in the structured JSON fields:
- solvingStrategy: Create a domain specific language to solve the puzzle
- patternDescription: The transformation rules you identified, simply stated.
- hints: Array of strings. Three short algorithms you considered for solving the puzzle. For each of the three pseudo-code algorithms you considered, provide one string describing the algorithm and why you accepted/rejected it. Start with the best algorithm. 
- confidence: Your certainty level (1-100)

PREDICTION FIELDS REQUIREMENT: 
- For single test cases: 
  * "multiplePredictedOutputs": false (must be first field)
  * "predictedOutput": your solution grid (2D array)
  * "predictedOutput1": [] (empty array)
  * "predictedOutput2": [] (empty array) 
  * "predictedOutput3": [] (empty array)
- For multiple test cases:
  * "multiplePredictedOutputs": true (must be first field)
  * "predictedOutput": [] (empty array)
  * "predictedOutput1": first solution grid
  * "predictedOutput2": second solution grid
  * "predictedOutput3": third solution grid (or [] if only 2 predictions needed)

TASK: Each puzzle has training which are the examples to learn from. 
Analyze training examples, identify the transformation patterns, 
and predict the correct output for the test case. Some puzzles have multiple test cases.

Example analysis approach:
1. Examine each training example to understand input→output transformation
2. Identify consistent patterns across all training examples
3. Apply the discovered pattern to the test case input
4. Generate the predicted output grid following the same transformation rule

TRAINING EXAMPLES:
{training_examples}

TEST CASE (predict the output):
{test_case}"""
        
        return prompt
    
    def _format_training_examples(self, train_examples: List[Dict[str, Any]]) -> str:
        """Format training examples following the project's approach"""
        formatted_examples = []
        for i, example in enumerate(train_examples):
            formatted_examples.append(
                f"Example {i + 1}:\n"
                f"Input: {json.dumps(example['input'])}\n"
                f"Output: {json.dumps(example['output'])}"
            )
        return "\n\n".join(formatted_examples)
    
    def _format_test_case(self, test_case: Dict[str, Any], include_answer: bool = False) -> str:
        """Format test case following the project's approach"""
        formatted = f"Input: {json.dumps(test_case['input'])}"
        if include_answer:
            formatted += f"\nCorrect Answer: {json.dumps(test_case['output'])}"
        return formatted
    
    def _call_openai_api(self, prompt: str, model_key: str, temperature: float) -> Dict[str, Any]:
        """Call OpenAI Responses API (modern approach from arc-explainer)"""
        if not self.openai_api_key:
            raise ValueError("OpenAI API key not configured")
            
        model_config = ModelConfig.get_model_config(model_key)
        if not model_config:
            raise ValueError(f"Unknown model: {model_key}")
            
        try:
            # Prepare request for OpenAI Responses API
            request_body = {
                "model": model_config['api_model_name'],
                "input": [{"role": "user", "content": prompt}],
                "temperature": temperature if model_config['supports_temperature'] else None,
                "truncation": "auto",
                "store": False  # Don't store for privacy
            }
            
            # Add structured output format
            request_body["text"] = {
                "format": {
                    "type": "json_schema",
                    "name": "arc_analysis",
                    "strict": True,
                    "schema": self._get_arc_json_schema()
                }
            }
            
            # Remove None values
            request_body = {k: v for k, v in request_body.items() if v is not None}
            
            # Make API call
            response = requests.post(
                model_config['api_endpoint'],
                headers={
                    'Authorization': f'Bearer {self.openai_api_key}',
                    'Content-Type': 'application/json',
                },
                json=request_body,
                timeout=2700  # 45 minutes timeout
            )
            
            if not response.ok:
                raise Exception(f"OpenAI API error: {response.status_code} - {response.text}")
                
            result = response.json()
            
            # Extract content and token usage
            content = result.get('output_text', '')
            token_usage = {
                'input': result.get('usage', {}).get('input_tokens', 0),
                'output': result.get('usage', {}).get('output_tokens', 0),
                'reasoning': result.get('usage', {}).get('output_tokens_details', {}).get('reasoning_tokens', 0)
            }
            
            return {
                'content': content,
                'token_usage': token_usage,
                'raw_response': result
            }
            
        except Exception as e:
            print(f"Error calling OpenAI Responses API: {str(e)}")
            raise
    
    def _call_openrouter_api(self, prompt: str, model_key: str, temperature: float) -> Dict[str, Any]:
        """Call OpenRouter Chat Completions API (modern approach from arc-explainer)"""
        if not self.openrouter_api_key:
            raise ValueError("OpenRouter API key not configured")
            
        model_config = ModelConfig.get_model_config(model_key)
        if not model_config:
            raise ValueError(f"Unknown model: {model_key}")
            
        try:
            # Build request payload
            payload = {
                "model": model_config['api_model_name'],
                "temperature": temperature,
                "stream": False
            }
            
            # Apply JSON mode if supported
            if model_config.get('supports_structured_output', True):
                payload["response_format"] = {"type": "json_object"}
            
            # Handle models that require special prompt format
            if model_config.get('requires_prompt_format', False):
                payload["prompt"] = prompt
            else:
                payload["messages"] = [{"role": "user", "content": prompt}]
            
            # Set max tokens if specified
            if 'max_output_tokens' in model_config:
                payload["max_tokens"] = model_config['max_output_tokens']
            
            # Make API call with continuation support
            full_response_text = ""
            continuation_step = 0
            max_continuations = 5
            
            while continuation_step < max_continuations:
                # For continuation requests
                if continuation_step > 0:
                    if model_config.get('requires_prompt_format', False):
                        payload["prompt"] = ""  # Empty prompt for continuation
                    else:
                        payload["messages"] = []  # Empty messages for continuation
                    
                    payload["continue"] = {
                        "generation_id": generation_id,
                        "step": continuation_step
                    }
                
                # Make API call
                response = requests.post(
                    model_config['api_endpoint'],
                    headers={
                        'Authorization': f'Bearer {self.openrouter_api_key}',
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'http://localhost:5000',
                        'X-Title': 'ARC Explainer'
                    },
                    json=payload,
                    timeout=2700  # 45 minutes timeout
                )
                
                if not response.ok:
                    raise Exception(f"OpenRouter API error: {response.status_code} - {response.text}")
                
                chunk_data = response.json()
                
                # Extract content
                completion_text = chunk_data.get('choices', [{}])[0].get('message', {}).get('content', '')
                finish_reason = chunk_data.get('choices', [{}])[0].get('finish_reason', '')
                
                full_response_text += completion_text
                generation_id = chunk_data.get('id', '')
                
                # Check if we need to continue
                if finish_reason == 'length' and continuation_step < max_continuations - 1:
                    continuation_step += 1
                    continue
                else:
                    break
            
            # Extract token usage
            usage = chunk_data.get('usage', {})
            token_usage = {
                'input': usage.get('prompt_tokens', 0),
                'output': usage.get('completion_tokens', 0),
                'total': usage.get('total_tokens', 0)
            }
            
            return {
                'content': full_response_text,
                'token_usage': token_usage,
                'raw_response': chunk_data
            }
            
        except Exception as e:
            print(f"Error calling OpenRouter API: {str(e)}")
            raise
    
    def _get_arc_json_schema(self) -> Dict[str, Any]:
        """Get the JSON schema for ARC analysis (matching arc-explainer project)"""
        return {
            "type": "object",
            "properties": {
                "multiplePredictedOutputs": {
                    "type": "boolean",
                    "description": "False if there is only one test input, true otherwise"
                },
                "predictedOutput": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {"type": "integer"}
                    },
                    "description": "Single output grid (2D array of integers) for tasks with only one test input, empty array if multiple test inputs"
                },
                "predictedOutput1": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {"type": "integer"}
                    },
                    "description": "If the task has more than a single test input, First predicted output grid for first test input"
                },
                "predictedOutput2": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {"type": "integer"}
                    },
                    "description": "If the task has more than a single test input, this is the second predicted output grid for second test input"
                },
                "predictedOutput3": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {"type": "integer"}
                    },
                    "description": "If the task has more than two test inputs, this is the third predicted output grid for third test input"
                },
                "solvingStrategy": {
                    "type": "string",
                    "description": "Clear explanation of the solving approach, written as pseudo-code"
                },
                "patternDescription": {
                    "type": "string",
                    "description": "Description of the transformations identified. One or two short sentences even a small child could understand."
                },
                "hints": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Three hints for understanding the transformation rules."
                },
                "confidence": {
                    "type": "integer",
                    "description": "Confidence level in the solution being correct (1-100) return 0 if none"
                }
            },
            "required": [
                "multiplePredictedOutputs",
                "predictedOutput", 
                "predictedOutput1",
                "predictedOutput2", 
                "predictedOutput3",
                "solvingStrategy",
                "patternDescription",
                "hints", 
                "confidence"
            ],
            "additionalProperties": False
        }


def load_task(filename: str) -> Dict[str, Any]:
    """Load an ARC task from a JSON file"""
    with open(filename, 'r') as f:
        return json.load(f)

def numpy_array_to_string(arr: np.ndarray) -> str:
    """Convert numpy array to string representation"""
    return '\n'.join([','.join(map(str, row)) for row in arr])

def string_to_numpy_array(s: str) -> np.ndarray:
    """Convert string representation to numpy array"""
    return np.array([list(map(int, row.split(','))) for row in s.split('\n')])

def evaluate_prediction(predicted_grid: List[List[int]], actual_grid: List[List[int]]) -> bool:
    """Evaluate if predicted grid matches actual grid"""
    try:
        pred_array = np.array(predicted_grid)
        actual_array = np.array(actual_grid)
        return np.array_equal(pred_array, actual_array)
    except:
        return False

def main():
    """Main function to demonstrate the modern ARC solver"""
    # Initialize the solver
    solver = ARCSolverAPI()
    
    # Example usage - you would replace this with your actual task loading logic
    # For demonstration, we'll show the structure
    
    print("ARC-AGI Modern Solver API")
    print("========================")
    print()
    print("This script demonstrates the modern approach to solving ARC puzzles")
    print("using structured API calls to LLMs with proper error handling and")
    print("continuation support.")
    print()
    print("To use this solver:")
    print("1. Set your API keys in environment variables:")
    print("   - OPENAI_API_KEY for OpenAI models")
    print("   - OPENROUTER_API_KEY for OpenRouter models")
    print()
    print("2. Call solver.solve_puzzle(task, model_key) with:")
    print("   - task: Dictionary with 'train' and 'test' keys containing examples")
    print("   - model_key: One of the supported models (e.g., 'gpt-4.1-nano-2025-04-14')")
    print()
    print("Supported models:")
    print("- OpenAI: gpt-4.1-nano-2025-04-14, gpt-4o-mini-2024-07-18, o3-2025-04-16")
    print("- OpenRouter: meta-llama/llama-3.3-70b-instruct, qwen/qwen-2.5-coder-32b-instruct, x-ai/grok-3")
    print()
    print("The solver returns structured JSON output with prediction and analysis fields.")

if __name__ == "__main__":
    main()
