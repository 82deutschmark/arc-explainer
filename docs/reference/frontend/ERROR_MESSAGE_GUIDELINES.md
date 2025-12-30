# Error Message Guidelines

**Author:** Claude Code using Sonnet 4.5
**Date:** 2025-12-28
**Purpose:** Guidelines and templates for writing clear, consistent, and actionable error messages in the RE-ARC evaluation system.
**Context:** See client/src/pages/ReArc.tsx

## Overview

Error messages should be:
- **Clear**: Use plain language, avoid technical jargon
- **Consistent**: Follow established patterns for structure and tone
- **Actionable**: Always include concrete next steps for the user

## Message Patterns

We use two distinct patterns based on error category:

### Pattern 1: Submission Format Errors

Used for validation errors where the user's file has a structural problem.

```
Title: What's wrong (specific and descriptive)

Problem description:
  • Found: X
  • Expected: Y

[Code Example] ← Only for complex structural issues

Next Steps: [prose OR bullets, whatever is clearer]
```

**Example:**
```tsx
case "invalid_task_id":
  return (
    <>
      <AlertTitle>Unrecognized task ID: "{error.taskId}"</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          Task IDs must be 8-character hexadecimal codes like "1a2b3c4d"
          (using only 0-9 and a-f).
        </p>
        <p className="mt-2">
          <strong>Next Steps:</strong> This error usually means the task ID
          was modified after the dataset was generated. Make sure you're
          using the original task IDs from your downloaded dataset.
        </p>
      </AlertDescription>
    </>
  );
```

### Pattern 2: System/Server Errors

Used for network, server, or infrastructure problems (not the user's fault).

```
Title: What happened (user-friendly)

Brief explanation (reassure user it's not their file)

[Technical details in code block]

Next Steps: [prose OR bullets]
```

**Example:**
```tsx
case "network_error":
  return (
    <>
      <AlertTitle>Connection problem</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>We couldn't complete the evaluation due to a network error.</p>
        <div className="bg-muted p-2 rounded mt-2 font-mono text-sm">
          {error.details}
        </div>
        <div className="mt-2">
          <strong>Next Steps:</strong>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>Check your internet connection</li>
            <li>Try uploading again in a few moments</li>
            <li>If the problem persists, the server may be experiencing issues</li>
          </ul>
        </div>
      </AlertDescription>
    </>
  );
```

## Code Examples: When to Show Them

### ✅ Show code examples for:
- `invalid_task_structure` - Shows wrapping requirement
- `invalid_prediction_object` - Shows attempt structure
- `invalid_attempt_structure` - Shows attempt structure

**Why:** These are complex structural requirements that benefit from visual examples.

### ❌ Don't show code examples for:
- `invalid_json` - Can't teach what JSON is in an error message
- `task_count_mismatch` - Count issue, not structure
- `invalid_task_id` - Format issue (regex), not structure
- `invalid_grid` - Dimension/value issue, not structure
- `prediction_count_mismatch` - Count issue
- `malformed_task_ids` - Dataset mismatch
- `empty_submission` / `empty_predictions` - Absence issue

**Why:** These errors are about counts, values, or formats where code examples don't clarify the issue.

## Next Steps: Prose vs Bullets

### Use bulleted lists when:
- Multiple distinct actions required
- Troubleshooting steps (try A, then B, then C)
- Diagnostic steps (check X, verify Y)

**Example:** `network_error` has bullets because user needs to check connection, retry, then escalate.

### Use prose when:
- Single clear action
- Simple directive
- Combined instruction

**Example:** `invalid_json` uses prose: "Refer to the Submission Format Guide..."

## Style Guidelines

### Tone
- **Neutral and helpful**, not accusatory
- Assume good faith - the user is trying to do the right thing
- For system errors, reassure them it's not their fault

### Language
- **"Found" vs "Expected"** format for mismatches
- **"Next Steps:"** (not "Solution:" or "Try:" - be consistent)
- **Specific over vague**: "8-character hexadecimal code" not "valid format"
- **User-friendly technical terms**: "Empty array `[]`" not "zero-length vector"

### Structure
- Always include `className="space-y-2"` on `AlertDescription` for consistent spacing
- Use `<strong>Next Steps:</strong>` consistently
- Use `<br />` for inline "Found/Expected" pairs
- Wrap technical values in `<code>` tags: `<code>[]</code>`
- Use `bg-muted p-2 rounded font-mono text-sm` for code block styling

### Formatting Example
```tsx
<AlertDescription className="space-y-2">
  <p>
    <strong>Found:</strong> {error.found} tasks
    <br />
    <strong>Expected:</strong> {error.expected} tasks
  </p>
  <p className="mt-2">
    Explanation of what this means...
  </p>
  <p className="mt-2">
    <strong>Next Steps:</strong> What the user should do.
  </p>
</AlertDescription>
```

## Error Categories

### Format Errors (Pattern 1)
- `invalid_json`
- `invalid_submission_format`
- `empty_submission`
- `task_count_mismatch`
- `invalid_task_id`
- `invalid_task_structure`
- `empty_predictions`
- `invalid_prediction_object`
- `invalid_attempt_structure`
- `invalid_grid`
- `prediction_count_mismatch`

### System Errors (Pattern 2)
- `server_error`
- `network_error`
- `incomplete_response`
- `sse_parse_error`

### Hybrid (uses format pattern, but mentions dataset)
- `malformed_task_ids` - Uses Pattern 1 but includes system context

## Writing New Error Messages

1. **Identify the category**: Format error or system error?
2. **Choose the pattern**: Pattern 1 or Pattern 2
3. **Draft the title**: Specific and descriptive (what went wrong?)
4. **Write the explanation**:
   - Format errors: Found vs Expected
   - System errors: What happened + reassurance
5. **Decide on code example**: Is this a complex structural issue?
6. **Write Next Steps**:
   - Single action → prose
   - Multiple actions → bullets
7. **Review for consistency**: Check spacing, formatting, tone

## Common Mistakes to Avoid

❌ **Too technical**: "Malformed AST node in prediction schema"
✅ **User-friendly**: "Each prediction must be an object containing two attempts"

❌ **Vague**: "Something is wrong with your submission"
✅ **Specific**: "Task '1a2b3c4d' has no predictions"

❌ **No action**: "The grid is too large"
✅ **Actionable**: "Grid is 35 rows (maximum: 30). Check your solver's grid generation logic."

❌ **Inconsistent structure**: Sometimes "Solution:", sometimes "Next Steps:", sometimes nothing
✅ **Consistent**: Always use "Next Steps:"

❌ **Blaming tone**: "You submitted an invalid file"
✅ **Neutral**: "The submission file structure is unrecognizable"

## Implementation Reference

See [`client/src/components/rearc/ErrorDisplay.tsx`](../../client/src/components/rearc/ErrorDisplay.tsx) for complete implementations of all error messages following these guidelines.

## Testing

To ensure error messages are clear and helpful:

1. **Read aloud**: Does it make sense to someone unfamiliar with the codebase?
2. **Check actionability**: Can the user fix the problem based on the message?
3. **Verify consistency**: Does it follow the established pattern?
4. **Test formatting**: Does the spacing and structure render correctly?

---

**Note:** When adding new error types, update this document with examples and add them to the appropriate category list.
