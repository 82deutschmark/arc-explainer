# Systematic OpenRouter Truncation Fix Plan

**Status: Research Complete - Ready for Implementation**

## Root Cause Analysis

### Issue 1: OpenRouter Continuation API Format (CONFIRMED)

**Root Cause:** Current implementation sends both `messages` AND `continue` parameters
**API Error:** "400 Input required: specify prompt or messages"
**Solution:** Use EITHER messages OR continue, not both
**Evidence:** Original plan in 8SeptTruncation.md shows correct format

### Issue 2: Provider-Level Failures (MONITORING NEEDED)

**Pattern:** Empty responses (HTTP 200 + finish_reason: stop + 0 chars)
**Models:** openai/gpt-oss-120b, z-ai/glm-4.5  
**Strategy:** Accept as provider failures, log for monitoring

### Issue 3: File System Issues (PARTIALLY FIXED)

**Status:** Model names with slashes partially fixed
**Remaining:** In-flight requests may still fail
**Strategy:** Complete sanitization implementation

## Systematic Implementation Plan

### Phase 1: Core Truncation Fix (Immediate)

**1A. Fix OpenRouter Continuation API Format**
```javascript
// CORRECT: Either messages OR continue
if (previousGenerationId) {
  payload = {
    model: modelName,
    continue: { generation_id: previousGenerationId, step },
    response_format: { type: "json_object" },
    temperature
  };
} else {
  payload = {
    model: modelName, 
    messages: [...],
    response_format: { type: "json_object" },
    temperature
  };
}
```

**1B. Complete File System Sanitization**
- Ensure all model names are properly sanitized
- Handle edge cases (colons, special chars)
- Test with problematic model names

**1C. Validation Testing**
- Test with known truncating models
- Verify continuation works end-to-end
- Monitor success rates

### Phase 2: Enhanced Monitoring (Follow-up)

**2A. Simple Error Classification**
- Log error patterns for analysis
- Identify consistently failing models
- Track success rates per model

**2B. Basic Provider Health**
- Monitor empty response patterns
- Flag models with high failure rates
- Simple alerting for user awareness

**Note:** This is a hobby project - avoid over-engineering complex systems like circuit breakers, queues, etc.

## Implementation Steps

### Step 1: Fix Continuation API
1. Update payload format to use EITHER messages OR continue
2. Test with a simple truncating model
3. Verify JSON parsing works after continuation

### Step 2: Complete File System Fix
1. Ensure all model name sanitization is complete
2. Test with models containing special characters
3. Verify no ENOENT errors on Windows

### Step 3: Validation
1. Test with known problematic models
2. Monitor logs for success/failure patterns
3. User testing of truncation recovery

## Risk Management

### Approach
- **Test in isolation:** Each fix tested independently  
- **Simple rollback:** Git-based reversion strategy
- **User testing:** Primary user will validate changes
- **Incremental:** Fix one issue at a time

### Success Metrics

**Immediate Goals:**
- Continuation API 400 errors: 0%
- File save errors: 0% 
- Truncated models successfully continue: >90%

**Medium-term:**
- Overall model success rate: >80%
- Consistent behavior across continuation steps
- Clear error logging for remaining issues

## Implementation Timeline

**Today:** Fix continuation API format
**Next:** Complete file system sanitization 
**Follow-up:** Monitor and improve based on real usage

This systematic but lightweight approach focuses on core fixes without over-engineering.
