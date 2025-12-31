# RE-ARC Frontend Design

**Author:** Claude Code using Sonnet 4.5
**Date:** 2025-12-25
**Purpose:** Self-service page for generating RE-ARC datasets and evaluating solutions to them

## Context

The people who will find themselves at this page are those who created an ARC solver and want to see if it works and how well it does. They will probably have been directed here by the ARC community to prove their solver works or to demo how well it does, with proof. The ARC community can know for sure how well the solver works if the user shares their solution file with the community, as anyone can upload and evaluate, and it's tied directly to the same dataset, and there's an upper bound on how long it took for the solver to solve since it also encodes the generation timestamp.

Though creating a solver is technical work, the user may not have a rigorous background in programming, and the ARC challenge is quite confusing, so we want the UX to be smooth and the copy to be well written, e.g. error messages should provide guidance and be helpful and actionable, and instructions should be clear.

## Page: `/re-arc`

### Single-page design with 3 sections:
1. Header
2. Generate Dataset
3. Evaluate Submission

---

## Section 1: Header

**Title:** RE-ARC

**Subtitle:** Generate RE-ARC datasets and evaluate your solutions

**How it works (expandable):**

> Click "Generate" to create a brand-new set of ARC puzzles. Difficulty is tuned to roughly match the ARC-AGI-2 evaluation set. After your solver processes them, upload the results to calculate your score. Share the solution file with others to let them evaluate your score independently—no trust required.


---

## Section 2: Generate Dataset

**Card with:**
- Title: "Generate Challenge Dataset"
- Description: "Creates unique ARC puzzles"
- Button: "Generate Dataset"

**Generation states:**
1. **Idle**: Show generate button
2. **Downloading**:
   - Browser save dialog appears immediately
   - Browser's native download progress indicator shows streaming progress

---

## Section 3: Evaluate Submission

**Card with:**
- Title: "Evaluate Your Submission"
- Description: "Upload your submission to check your score"

**Submission format guide:**
Expandable section explaining:
- **How it works:** ARC tasks contain test inputs (input grids). Each task has 1 or more test inputs. For each test input, your solver makes 2 prediction attempts to generate the correct output.
- **Format:** An object where each key is a task ID, and the value is an array of predictions (one per test input).
- **Example:** A task with 2 test inputs would have 2 elements in the array, each with `attempt_1` and `attempt_2` grids.

```typescript
type Submission = {
  [taskId: string]: {
    attempt_1: number[][];  // First prediction attempt
    attempt_2: number[][];  // Second prediction attempt
  }[];  // Array of predictions (one per test input)
};
```

Most tasks have only 1 test input, so the array usually has 1 element.

**Upload interface:**
- Drag-and-drop zone
- "Drop submission.json here" text
- File picker button as fallback

**Evaluation states:**
1. **Idle**: Show drop zone
2. **Evaluating**:
   - Hide upload interface
   - Show progress bar with current progress
3. **Complete**:
   - Display score (percentage)
   - Display generation timestamp
   - Display time elapsed since generation (e.g., "Evaluated 2 hours after generation")
   - **If mismatches exist:** Show collapsible "View Details" section with:
     - List of task IDs with prediction count mismatches
     - For each: expected prediction count vs submitted prediction count
   - "Evaluate Another Submission" button

---

## Progress Bars

**Evaluation only:**
- Show current percentage (X% or X/total format)
- No task details
- No time estimates

**Generation:**
- No in-page progress bar
- Browser's native download UI shows progress

---

## Error Handling

**Generation errors:**
- Display error message inline
- Show "Try Again" button

**Evaluation errors:**

All errors display inline, keep interface visible for retry.

**Client-side validation error messages:**

Format validation errors (shown immediately on file drop):

- **Missing array wrapper:**
  ```
  Task "abc12345" has wrong structure.

  Found: { "attempt_1": [[grid]], "attempt_2": [[grid]] }
  Expected: [{ "attempt_1": [[grid]], "attempt_2": [[grid]] }]

  Each task has one or more test inputs. Even if this task has only 1 test input,
  it must be wrapped in an array: one prediction per test input.
  ```

- **Wrong top-level value:**
  ```
  Task "abc12345" must contain prediction attempts, not raw grids.

  Found: [[0,1,2], [3,4,5], ...]
  Expected: [{ "attempt_1": [[grid]], "attempt_2": [[grid]] }]

  For each test input, your solver submits 2 prediction attempts.
  ```

- **Incomplete submission:**
  ```
  This submission is missing tasks.
  Found 127 tasks, expected 128.
  ```

- **Grid size violation:**
  ```
  Task "abc12345", attempt_1: Grid is 31×31 (maximum allowed: 30×30)
  ```

- **Invalid grid values:**
  ```
  Task "abc12345", attempt_2: Grid contains value 10 (valid values: 0-9)
  ```

**Client-side validation (instant, before upload):**

Must follow this format:

```typescript
type Submission = {
  [taskId: string]: {
    attempt_1: number[][];
    attempt_2: number[][];
  }[];
};
```

- There should be 128 tasks
- taskId is 8 char hex string
- Grid format validation:
  - Dimensions must be 1x1 to 30x30
  - Grid cells are integers 0-9

**Server-side validation error (during evaluation):**

If the backend cannot evaluate the submission:
```
Unable to evaluate this submission.

The task IDs don't match a valid RE-ARC dataset. This can happen if:
- Task IDs were manually edited
- You're submitting answers for a dataset not generated from this site

Make sure your submission has the same task IDs as the dataset you downloaded.
```

*Implementation note: Backend returns `event: complete` with `data: {"type": "malformed"}` when XOR timestamp recovery fails*

---

## Layout Structure

```
Header
  ↓
Generate Dataset
  - Generate button
  ↓
Evaluate Submission
  - Upload interface (or progress bar when evaluating)
  - Results (when complete)
```

---

## Component Breakdown

**Needed components:**
- Card containers (shadcn/ui)
- Collapsible sections (shadcn/ui)
- Progress bars (shadcn/ui)
- File upload with drag-and-drop
- Alert/error display (shadcn/ui)

**Utility functions needed:**
- XOR task IDs to recover timestamp
- Format timestamp as human-readable date
- Calculate time elapsed since generation

---

## API Integration

**Generation endpoint:** `POST /api/rearc/generate`
- No request body
- Response: Streaming download (chunked HTTP)
  - Headers:
    - `Content-Type: application/json`
    - `Content-Disposition: attachment; filename="arc-verifier_test_challenges-{timestamp}.json"`
    - `Transfer-Encoding: chunked`
    - `Content-Encoding: gzip`
  - Body: JSON object streamed incrementally
  - Format: `{ "taskId1": {...}, "taskId2": {...}, ... }`

**Evaluation endpoint:** `POST /api/rearc/evaluate`
- Request body: Submission JSON (multipart/form-data or application/json)
- Response: Server-Sent Events (SSE)
  - Progress events:
    ```
    event: progress
    data: {"current": 47, "total": 128}
    ```
  - Completion events (one or more):
    ```
    event: complete
    data: {"type": "score", "score": 0.875}

    event: complete
    data: {"type": "mismatches", "mismatches": [{taskId, expectedPredictions, submittedPredictions}, ...]}

    event: complete
    data: {"type": "malformed"}
    ```
  - Error events:
    ```
    event: error
    data: {"message": "Error description"}
    ```

---

## User Experience Flow

**Happy path:**
1. User clicks "Generate Dataset"
2. Browser save dialog appears immediately
3. User chooses save location
4. File downloads with browser's progress indicator (~10 seconds)
5. (Solves puzzles offline)
6. Returns to page
7. Drags submission.json onto upload zone
8. Watches in-page progress bar
9. Sees final score

**Error path:**
1. User uploads invalid submission
2. Sees specific error
3. Fixes and uploads again
4. Success


