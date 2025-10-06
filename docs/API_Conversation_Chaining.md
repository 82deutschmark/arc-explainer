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

### Cross-Provider Chains
Response IDs are provider-specific. Only chain within same provider.

### Model Switching
Best practice: Use same model for entire conversation chain.

---

## Best Practices

1. Always check if providerResponseId exists before chaining
2. Store response IDs for conversation management
3. Use same model throughout a conversation chain
4. Handle expired IDs gracefully by starting new chains
5. Consider conversation length limits

---

## Implementation Status

- Backend: Fully implemented
- Database: provider_response_id column ready
- API: previousResponseId parameter supported
- Frontend: UI implementation pending

---

## Related Documentation

- `docs/Responses_API_Chain_Storage_Analysis.md` - Technical analysis
- `CHANGELOG.md` v3.6.2 - Implementation details
- OpenAI Docs: https://platform.openai.com/docs/guides/conversation-state
