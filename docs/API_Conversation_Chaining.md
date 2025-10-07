# API Conversation Chaining Documentation

**Author:** Claude Code using Sonnet 4.5  
**Date:** 2025-10-06  
**PURPOSE:** Complete API documentation for Responses API conversation chaining features in arc-explainer. Enables multi-turn puzzle analysis workflows with full context retention.

---

## Overview

The Responses API conversation chaining feature allows AI models to maintain context across multiple analysis requests. This enables iterative puzzle refinement, debate mode enhancements, and multi-step reasoning workflows.

### Key Benefits

- **Context Retention:** Models automatically access previous analysis and reasoning
- **Iterative Refinement:** Progressively improve puzzle solutions across multiple attempts
- **Debate Enhancement:** Enable multi-turn debates with full conversation history
- **Encrypted Storage:** Server-side state maintained for 30 days (OpenAI/xAI)

---

## API Endpoint

### Analyze Puzzle with Conversation Context

**Endpoint:** `POST /api/puzzle/analyze/:taskId/:model`

**Path Parameters:**
- `taskId` (string, required): The puzzle ID to analyze
- `model` (string, required): The AI model to use (URL-encoded)

**New Parameter:**
- `previousResponseId` (string, optional): Response ID from previous analysis to maintain conversation context

**Request Body Example:**
```json
{
  "temperature": 0.2,
  "captureReasoning": true,
  "promptId": "solver",
  "previousResponseId": "resp_abc123xyz456"
}
```

**Response includes:**
```json
{
  "success": true,
  "data": {
    "providerResponseId": "resp_def789ghi012",
    "patternDescription": "...",
    "isPredictionCorrect": true
  }
}
```

---

## Usage Examples

### Example 1: Basic Two-Turn Conversation

Request 1: Initial analysis (no previousResponseId)
Response 1: Save the providerResponseId value

Request 2: Follow-up analysis with previousResponseId from Response 1
Response 2: Model has full context from Request 1

### Example 2: Iterative Refinement

Continue requesting analyses with previousResponseId to build conversation history.
Each request includes the full context of all previous turns.

---

## Provider Support

### OpenAI (o-series models)
- Full support for previous_response_id
- 30-day state retention
- Documented officially

### xAI (Grok-4 models)
- Full support for previous_response_id
- 30-day state retention (inferred)
- Compatible with OpenAI structure

### Other Providers
- Not supported: Anthropic, Google Gemini, OpenRouter, DeepSeek

---

## Database Storage

Response IDs are automatically saved to: `explanations.provider_response_id`

Query the most recent analysis to get the response ID for continuation.

---
## Error Handling

### Expired Response ID
After 30 days, response IDs become invalid. Start a new conversation chain.

### Cross-Provider Chains ⚠️ CRITICAL

Response IDs are **provider-specific** and cannot be used across different providers:

```json
{
  "success": false,
  "error": "Invalid previous_response_id",
  "message": "Response ID does not belong to this model/provider"
}
```

**Why This Matters:**
- OpenAI response IDs only work with OpenAI models
- xAI (Grok) response IDs only work with xAI models
- Passing an OpenAI ID to Grok will fail (and vice versa)

**Model Debate Behavior:**
The debate system automatically detects provider mismatches:
- ✅ GPT-4 → GPT-5: Conversation continues (same provider)
- ✅ Grok-4 → Grok-3: Conversation continues (same provider)
- ⚠️ GPT-4 → Grok-4: New conversation starts (different providers)
- ⚠️ Grok-4 → GPT-5: New conversation starts (different providers)

**Implementation:**
```typescript
// useDebateState.ts
const extractProvider = (modelKey: string): string => {
  if (modelKey.includes('/')) return modelKey.split('/')[0];
  // Legacy model detection for GPT/Grok
  if (modelKey.includes('gpt') || modelKey.includes('o1')) return 'openai';
  if (modelKey.includes('grok')) return 'xai';
  return 'unknown';
};

const getLastResponseId = (challengerModelKey?: string) => {
  const lastProvider = extractProvider(lastMessage.modelName);
  const challengerProvider = extractProvider(challengerModelKey);
  
  // Only return ID if providers match
  if (lastProvider === challengerProvider) {
    return lastMessage.providerResponseId;
  }
  return undefined; // Cross-provider not supported
};
```

**Solution:** Only chain requests within the same provider (OpenAI → OpenAI, xAI → xAI).

### Model Switching

Best practice: Use same model for entire conversation chain.

---

## Best Practices

1. Always check if providerResponseId exists before chaining
2. Store response IDs for conversation management
3. **Verify provider compatibility** before passing previousResponseId
4. Use same model throughout a conversation chain for best results
5. Handle expired IDs gracefully by starting new chains
6. Consider conversation length limits

---

## Debate Mode Integration

Model Debate now uses conversation chaining for true multi-turn debates:

### How It Works

1. **Original Explanation**: First model analyzes puzzle (saves providerResponseId)
2. **Challenge 1**: Second model challenges with previousResponseId from original
3. **Challenge 2**: Next challenge includes previousResponseId from Challenge 1
4. **Result**: Each model has full context from all previous turns

### Code Flow

```typescript
// useDebateState tracks the conversation chain
const getLastResponseId = () => {
  const lastMessage = debateMessages[debateMessages.length - 1];
  return lastMessage.content.providerResponseId;
};

// ModelDebate passes it to analysis hook
const { ... } = useAnalysisResults({
  previousResponseId: debateState.getLastResponseId()
});

// Each challenge includes the chain
const payload = {
  modelKey: challengerModel,
  temperature,
  // previousResponseId automatically included via hook
};
```

### Benefits for Debates

- **Coherent Arguments**: Models remember what was already said
- **Direct Rebuttals**: Can reference specific points from previous turns
- **No Repetition**: Models don't re-explain the same concepts
- **Progressive Depth**: Each turn builds on accumulated understanding

---

## Implementation Status

- ✅ Backend: Fully implemented
- ✅ Database: provider_response_id column ready and saving
- ✅ API: previousResponseId parameter supported
- ✅ Frontend: Implemented in Model Debate system
- ✅ Debate Mode: Full conversation chaining active

---

## Related Documentation

- `docs/Responses_API_Chain_Storage_Analysis.md` - Technical analysis
- `docs/Debate_Conversation_Chaining_Plan.md` - Debate implementation plan
- `CHANGELOG.md` v3.6.2 - Implementation details
- OpenAI Docs: https://platform.openai.com/docs/guides/conversation-state
