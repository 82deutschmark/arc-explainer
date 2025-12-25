# RE-ARC Eval Frontend Design

**Author:** Claude Code using Sonnet 4.5
**Date:** 2025-12-25
**Purpose:** Self-service page for generating and verifying cryptographic ARC datasets

## Page: `/rearc-eval`

### Single-page design with 3 sections:
1. Header
2. Generate Dataset
3. Verify Solution

---

## Section 1: Header

**Title:** RE-ARC Eval

**Subtitle:** Generate and verify ARC puzzle datasets

---

## Section 2: Generate Dataset

**Card with:**
- Title: "Generate Challenge Dataset"
- Description: "Creates unique ARC puzzles"
- Warning: "Each generation is unique. The file will download automatically."
- Button: "Generate Dataset"

**Generation states:**
1. **Idle**: Show generate button
2. **Generating**:
   - Hide button
   - Show progress bar with current progress
3. **Complete**:
   - Auto-download triggers
   - Return to idle state

---

## Section 3: Verify Solution

**Card with:**
- Title: "Verify Your Submission"
- Description: "Upload your submission to check your score"

**Submission format guide (collapsible):**
Show expected JSON structure

**Upload interface:**
- Drag-and-drop zone
- "Drop submission.json here" text
- File picker button as fallback

**Verification states:**
1. **Idle**: Show drop zone
2. **Verifying**:
   - Hide upload interface
   - Show progress bar with current progress
3. **Complete**:
   - Display score (percentage)
   - Display time elapsed (e.g., "Completed in 1 hour 4 minutes")
   - Return to idle (allow retry)

---

## Progress Bars

**Both generation and verification:**
- Show current percentage (X% or X/total format)
- No task details
- No time estimates

---

## Error Handling

**Generation errors:**
- Display error message inline
- Show "Try Again" button

**Verification errors:**

**Client-side validation (fast, before upload):**
- Invalid JSON format
- Missing required fields
- Wrong structure
- Grid format validation:
  - Dimensions must be 1x1 to 30x30
  - All cells must be integers

**Server-side errors:**
- Seed recovery failure: "Could not verify submission. Task IDs don't match or file is corrupted."
- Other failures: "Verification failed. Please check your submission and try again."

All errors display inline, keep interface visible for retry.

---

## Layout Structure

```
Header
  ↓
Generate Dataset
  - Generate button (or progress bar)
  ↓
Verify Solution
  - Upload interface (or progress bar)
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

---

## User Experience Flow

**Happy path:**
1. User clicks "Generate Dataset"
2. Watches progress bar
3. File auto-downloads when complete
4. (Solves puzzles offline)
5. Returns to page
6. Drags submission.json onto upload zone
7. Watches progress bar
8. Sees final score

**Error path:**
1. User uploads invalid submission
2. Sees specific error
3. Fixes and uploads again
4. Success


