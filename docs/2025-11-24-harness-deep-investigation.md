# Deep Investigation: ArcAGI-Benchmarking Official Harness Architecture

**Date:** 2025-11-24
**Investigator:** Claude Code (Haiku 4.5)
**Status:** Complete investigation of puzzle delivery, API call structure, and prompt composition

---

## Executive Summary

After examining the official ArcAGI-Benchmarking harness source code (`arc-agi-benchmarking/` submodule), I can definitively answer the key questions:

1. **When are puzzles sent?** Puzzles are embedded as **raw JSON string data** within the system prompt text.
2. **As user prompt?** Yes - they're part of the user message string sent to the model.
3. **One API call?** Yes - everything (system prompt instructions, training examples, test input) is packaged into **a single user message in ONE API call**.

---

## The Complete Flow: Code Trace

### 1. Entry Point: `generate_task_solution()` (main.py:119-215)

```python
def generate_task_solution(self, data_dir, task_id):
    # Load training pairs and test input from task JSON files
    train_pairs = utils.get_train_pairs_from_task(data_dir, task_id)
    test_input_pairs = utils.get_test_input_from_task(data_dir, task_id)
    test_pairs = utils.get_test_pairs_from_task(data_dir, task_id)  # Ground truth

    # For each test pair
    for t, pair_input_obj in enumerate(test_input_pairs):
        # For each attempt
        for attempt_num in range(1, self.num_attempts + 1):
            # Make the prediction
            attempt_obj = self.get_task_prediction(
                training_pairs=train_pairs,
                test_input=pair_input_obj,
                task_id=task_id,
                test_id=test_id,
                pair_index=pair_index
            )
```

**Data loaded:**
- `train_pairs`: List of `ARCPair` objects (each has `input: List[List[int]]` and `output: List[List[int]]`)
- `test_input_pairs`: List of `ARCPair` objects with only `input` field
- `test_pairs`: Ground truth outputs for evaluation

---

### 2. Prediction Method: `get_task_prediction()` → `predict_task_output()` (main.py:85-110)

```python
def predict_task_output(self, training_pairs, test_input, task_id, test_id, pair_index):
    # THIS IS THE KEY STEP
    prompt = convert_task_pairs_to_prompt(training_pairs, test_input)

    logger.info(f"Making prediction for task {task_id}, test {test_id}, pair_index {pair_index}")
    logger.debug(f"Prompt length: {len(prompt)} characters")

    # ONE API CALL HAPPENS HERE
    response: Attempt = self.provider.make_prediction(
        prompt,
        task_id=task_id,
        test_id=test_id,
        pair_index=pair_index
    )
    return response
```

**Critical observation:** The prompt is constructed ONCE and passed as a single string to the provider.

---

### 3. Prompt Construction: `convert_task_pairs_to_prompt()` (prompts/prompt_manager.py)

```python
def convert_task_pairs_to_prompt(training_pairs: List[ARCPair], test_input: ARCPair) -> str:
    # Load the system prompt template
    prompt_template = _load_prompt("system_prompt")

    # Build training examples as JSON strings
    training_examples = ""
    for i, pair in enumerate(training_pairs):
        training_examples += f"--Example {i}-- \n\n INPUT: \n\n"
        training_examples += json.dumps(pair.input) + "\n\n"  # ← RAW JSON ARRAY
        training_examples += f"OUTPUT: \n\n"
        training_examples += json.dumps(pair.output) + "\n\n"  # ← RAW JSON ARRAY

    # Build test input as JSON string
    test_input_str = json.dumps(test_input.input)  # ← RAW JSON ARRAY

    # Substitute into template
    return prompt_template.format(
        training_examples=training_examples,
        test_input=test_input_str
    )
```

**Key insight:**
- Training examples and test input are formatted as **raw JSON arrays** using `json.dumps()`
- These JSON strings are embedded directly into the prompt text
- They are NOT sent as separate data structures or attachments

---

### 4. System Prompt Template (prompts/system_prompt.txt)

```
You are participating in a puzzle solving competition. You are an expert at solving puzzles.

Below is a list of input and output pairs with a pattern. Your goal is to identify the
pattern or transformation in the training examples that maps the input to the output, then
apply that pattern to the test input to give a final output.

Respond in the format of the training output examples

--Training Examples--
{training_examples}
--End of Training Examples--

--Test Input--
{test_input}
--End of Test Input--

Your response:
```

**What gets substituted:**
- `{training_examples}`: All training pairs formatted as JSON strings
- `{test_input}`: Test input grid as a JSON array

---

### 5. The Complete Prompt Example

Here's what a typical prompt looks like **after substitution** (from `prompt_example_v2.md`):

```
You are participating in a puzzle solving competition. You are an expert at solving puzzles.

Below is a list of input and output pairs with a pattern. Your goal is to identify the
pattern or transformation in the training examples that maps the input to the output, then
apply that pattern to the test input to give a final output.

Respond in the format of the training output examples

--Training Examples--
--Example 0--

 INPUT:

[[0, 2, 0, 0, 0, 2, 5, 2, 2, 0, 5, 2, 5, 5, 0, 2, 2, 5, 2, 2, 5, 5, 0, 2, 0, 0, 2, 0, 0, 0],
 [5, 0, 0, 5, 2, 2, 5, 2, 5, 0, 0, 2, 2, 5, 5, 2, 2, 5, 0, 5, 2, 0, 0, 0, 5, 0, 5, 5, 0, 2],
 ...30 more rows...]

OUTPUT:

[[8, 4, 3],
 [1, 3, 7],
 [8, 4, 1]]

--Example 1--

 INPUT:

[[0, 2, 0, 0, 0, 2, 0, 8, 0, 0, 0, 2, 0, 2, 0, 2, 0, 0, 2, 8, 0, 0, 2, 0, 8, 0, 0, 0, 0, 0],
 ...29 more rows...]

OUTPUT:

[[3, 1, 9],
 [6, 4, 1]]

--End of Training Examples--

--Test Input--
[[5, 5, 0, 0, 0, 8, 5, 0, 0, 8, 8, 8, 0, 8, 0, 0, 5, 5, 0, 5, 0, 5, 8, 0, 0, 0, 0, 0, 0, 8],
 [8, 8, 5, 5, 0, 8, 0, 0, 5, 8, 0, 0, 5, 8, 0, 8, 0, 8, 0, 8, 0, 0, 5, 0, 8, 8, 0, 0, 0, 0],
 ...28 more rows...]
--End of Test Input--

Your response:
```

**Crucial observations:**
- This is all **ONE TEXT STRING** (not structured data)
- Grids are rendered as **JSON arrays** (e.g., `[[1,2,3],[4,5,6]]`)
- Numbers are integers, not colors or visual elements
- The entire content fits in a single user message

---

### 6. API Call Structure: `make_prediction()` (adapters/open_ai.py)

```python
def make_prediction(self, prompt: str, task_id: Optional[str] = None, ...) -> Attempt:
    start_time = datetime.now(timezone.utc)

    # SINGLE API CALL
    response = self._call_ai_model(prompt)

    end_time = datetime.now(timezone.utc)

    # Extract and structure the response
    usage = self._get_usage(response)
    cost = self._calculate_cost(response)

    # Create Choice objects with the input message and response
    input_choices = [
        Choice(
            index=0,
            message=Message(
                role="user",
                content=prompt  # ← THE ENTIRE PROMPT IS CAPTURED
            )
        )
    ]

    response_choices = [
        Choice(
            index=1,
            message=Message(
                role="assistant",
                content=self._get_content(response)  # ← THE MODEL'S RESPONSE
            )
        )
    ]

    # Return as Attempt object
    return Attempt(
        metadata=metadata,
        answer=self._get_content(response)
    )
```

---

### 7. API Call Details: `_call_ai_model()` (adapters/openai_base.py:69)

```python
def _call_ai_model(self, prompt: str) -> Any:
    messages = [{"role": "user", "content": prompt}]

    if self.model_config.api_type == APIType.CHAT_COMPLETIONS:
        return self._chat_completion(messages)
    else:  # APIType.RESPONSES
        return self._responses(messages)

def _chat_completion(self, messages: List[Dict[str, str]]) -> Any:
    return self.client.chat.completions.create(
        model=self.model_config.model_name,
        messages=messages,
        **self.model_config.kwargs
    )
```

**The actual API call looks like:**

```python
OpenAI.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "user",
            "content": "[entire prompt string with all training examples and test input as JSON]"
        }
    ],
    temperature=1.0,  # or other kwargs from config
    # ... other parameters
)
```

---

## Key Findings

### 1. **When are puzzles sent?**

**Answer:** Puzzles are embedded as raw JSON array strings within the system prompt text, constructed before the API call.

- Training examples: Converted to JSON via `json.dumps(pair.input)` and `json.dumps(pair.output)`
- Test input: Converted to JSON via `json.dumps(test_input.input)`
- These JSON strings are substituted into the prompt template
- The complete prompt (including all puzzle data) is built **before** the API call

**Timeline:**
1. Load puzzle data from task JSON file (in-memory `ARCPair` objects)
2. Format each training pair as JSON strings and embed in prompt template
3. Format test input as JSON string and embed in prompt template
4. Complete prompt is ready
5. Send complete prompt as ONE API call

---

### 2. **Are puzzles sent as the user prompt?**

**Answer:** Yes, they are embedded within the user prompt text itself.

The puzzles are NOT:
- ❌ Sent as binary image data
- ❌ Sent as base64-encoded images
- ❌ Sent as vision API attachment
- ❌ Sent as separate API parameters

The puzzles ARE:
- ✅ Converted to JSON text representations
- ✅ Embedded in the user message string
- ✅ Part of the natural language prompt

**Example of what the model actually receives:**

```
[Plain text instruction]
--Training Examples--
--Example 0--
INPUT: [[0, 2, 0, 0, ...], [5, 0, 0, 5, ...], ...]
OUTPUT: [[8, 4, 3], [1, 3, 7], ...]
--End of Training Examples--
--Test Input--
[[5, 5, 0, 0, ...], [8, 8, 5, 5, ...], ...]
--End of Test Input--
```

All as **plain text**, not images, not binary data.

---

### 3. **Is this all one API call?**

**Answer:** Yes, absolutely.

**Evidence:**
1. `convert_task_pairs_to_prompt()` returns a **single string** (the complete prompt)
2. This string is passed to `self.provider.make_prediction(prompt)`
3. The provider calls `self._call_ai_model(prompt)` **once**
4. This calls `OpenAI.chat.completions.create(model=..., messages=[{"role": "user", "content": prompt}])`
5. One response comes back
6. The response is parsed and returned as a single `Attempt` object

**There is NO:**
- ❌ Multi-turn conversation
- ❌ Multiple API calls per puzzle
- ❌ Streaming of puzzles separately
- ❌ Separate calls for different examples

**The flow is:**
```
[Build complete prompt] → [One API call with complete prompt] → [Get one response] → [Parse response and extract answer]
```

---

## Potential Issues with Current HuggingFaceUnionAccuracy.tsx Explanation

After reviewing the explanation in `HuggingFaceUnionAccuracy.tsx` (lines 1072-1155), here are areas where the explanation could be more precise:

### Issues Found:

1. **Missing precision about puzzle format:**
   - Current: "Both are formatted as raw JSON arrays (structured data)."
   - Could be clearer: "Both are formatted as raw JSON arrays **within the prompt text** (not as separate data attachments)."

2. **Incomplete description of "how the message is sent":**
   - Current: "Everything... is packaged into one single message sent to the model."
   - Missing detail: The prompt is constructed **first**, then sent. It's not streamed or built dynamically during the API call.

3. **Ambiguity about "grid format":**
   - The explanation shows: `[[0, 1, 2], [3, 4, 5], [6, 7, 8]]`
   - Should clarify: These are **text representations** of arrays in the prompt, not rendered grids. The model sees pure numbers, not visualizations.

4. **Missing detail about extraction:**
   - Current: "The harness then extracts this grid answer from the model's response"
   - Missing: The extraction process uses a JSON parser (`parse_and_validate_json()`) to find the array structure in the model's text response.

5. **Silent assumption about number of examples:**
   - The explanation doesn't mention that the number of training examples varies per puzzle (typically 3-5, though can vary).
   - This should be clarified because it affects prompt length and context usage.

6. **No mention of attempt independence:**
   - The explanation says "fresh, independent runs" for attempt 2
   - Could add: This means the model receives the **exact same prompt** both times, with no knowledge of attempt 1's response.

---

## Corrected Explanation (Recommended Updates)

### Updated Section 4: "How the Message is Sent"

**Current:**
> "Everything — the initial prompt, all training examples, and the test input — is packaged into one single message sent to the model."

**Improved:**
> "Everything — the initial prompt, all training examples, and the test input — is packaged into **one single prompt string**, formatted as plain text. Training examples and the test input are represented as raw JSON arrays embedded within this text (e.g., `[[1, 2], [3, 4]]`). The complete prompt is constructed **before** the API call, then sent as a single user message to the model. The model receives all this context at once and produces one response per puzzle attempt."

### Updated Section 3: "The Test Input"

**Current:**
> "After showing the training examples, the harness presents a test input — a single grid (also in JSON format)"

**Improved:**
> "After showing the training examples, the harness presents a test input — a single grid represented as a JSON array in the prompt text (e.g., `[[5, 5, 0], [8, 8, 5]]`). The model must look at the training examples and predict what the output grid should be, also in JSON array format."

### Add New Section: "Why JSON Format?"

> "**Why JSON arrays instead of visual grids?** The official harness uses JSON array format because:
> 1. It's language-neutral and unambiguous
> 2. It avoids any visual representation bias
> 3. It's easier for models to parse consistently
> 4. The integers in the arrays (0-9) represent different 'colors' or 'object types' in the abstract puzzle
> 5. This format ensures all models interpret the puzzle identically
>
> For example, a 3×3 grid with colors might be represented as: `[[1, 2, 1], [2, 3, 2], [1, 2, 1]]` where each number represents a different color or category."

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ generate_task_solution(task_id)                                 │
│ Load from task.json: train_pairs, test_input, ground_truth      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ get_task_prediction(train_pairs, test_input)                    │
│ → calls predict_task_output()                                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ convert_task_pairs_to_prompt(train_pairs, test_input)           │
│                                                                 │
│ 1. Load system_prompt.txt template                              │
│ 2. For each train_pair:                                         │
│    - json.dumps(pair.input) → "[[0,1,...],[2,3,...]]"           │
│    - json.dumps(pair.output) → "[[4,5],[6,7]]"                  │
│    - Embed in template with formatting                          │
│ 3. json.dumps(test_input.input) → "[[8,9,...],...]"             │
│ 4. Format: template.format(training_examples=..., test_input=..)│
│                                                                 │
│ RETURNS: One complete prompt string (2KB - 10KB typically)      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ provider.make_prediction(prompt)                                │
│ → calls _call_ai_model(prompt)                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ OpenAI API Call (SINGLE REQUEST)                                │
│                                                                 │
│ POST https://api.openai.com/v1/chat/completions                 │
│ {                                                               │
│   "model": "gpt-4o",                                            │
│   "messages": [                                                 │
│     {                                                           │
│       "role": "user",                                           │
│       "content": "[entire prompt with training+test as JSON]"   │
│     }                                                           │
│   ],                                                            │
│   "temperature": 1.0,                                           │
│   ...other kwargs...                                            │
│ }                                                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Response: OpenAI returns completion                             │
│ {                                                               │
│   "choices": [                                                  │
│     {                                                           │
│       "message": {                                              │
│         "role": "assistant",                                    │
│         "content": "[[1,2,3],[4,5,6]]"  ← Model's answer        │
│       }                                                         │
│     }                                                           │
│   ],                                                            │
│   "usage": {...tokens...},                                      │
│   ...                                                           │
│ }                                                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Parse response:                                                 │
│ - Extract model's text content                                  │
│ - Use parse_and_validate_json() to extract JSON array           │
│ - Compare to ground_truth[pair_index].output                    │
│ - Mark as correct/incorrect                                     │
│ - Return Attempt object with metadata                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Conclusion

The official ArcAGI-Benchmarking harness is straightforward in its architecture:

1. **Puzzle delivery:** Embedded as JSON text in the prompt
2. **User prompt:** Yes, all data is part of the single prompt text
3. **API calls:** Exactly one call per puzzle per attempt
4. **Message structure:** One user message containing all training examples and test input
5. **Response handling:** Model responds with a JSON array, which is extracted and compared to ground truth

The harness design is clean, reproducible, and language-model-agnostic. Any model can handle JSON array data in text form, making this approach model-independent and fair across different providers.
