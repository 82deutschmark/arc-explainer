# Model Management Guide

**Author:** Cascade using Deep Research Model  
**Date:** 2025-09-30  
**Purpose:** Guide for managing AI model configurations efficiently

## Overview

The `manage-models.ts` script provides a standardized way to add, remove, and list AI models in the configuration without manual surgical edits to `server/config/models.ts`.

## Quick Start

### List All Models
```bash
npm run models list
```

### Remove a Model
```bash
npm run models remove "model-key-here"
```

Example:
```bash
npm run models remove "gpt-4o-mini-2024-07-18"
```

## Programmatic Usage

For adding models, create a temporary script or use Node REPL:

```typescript
import { addModel } from './scripts/manage-models.ts';

// Example: Adding a new OpenRouter model
addModel({
  key: 'google/gemini-2.5-flash-preview-09-2025',
  name: 'Gemini 2.5 Flash Preview (Sep 2025)',
  provider: 'OpenRouter',
  color: 'bg-teal-300',
  premium: false,
  inputPrice: '$0.30',
  outputPrice: '$2.50',
  contextWindow: 1050000,
  maxOutputTokens: 65500,
  supportsTemperature: true,
  isReasoning: true,
  responseSpeed: 'fast',
  responseEstimate: '<30 sec',
  releaseDate: '2025-09'
});
```

## Model Configuration Fields

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `key` | string | Unique identifier for the model | `'google/gemini-2.5-flash'` |
| `name` | string | Display name in UI | `'Gemini 2.5 Flash'` |
| `provider` | string | Provider name | `'OpenRouter'`, `'OpenAI'`, `'Anthropic'`, `'Gemini'`, `'DeepSeek'` |
| `color` | string | Tailwind color class | `'bg-teal-500'` |
| `premium` | boolean | Premium tier flag | `true` or `false` |
| `inputPrice` | string | Input token price | `'$0.30'` |
| `outputPrice` | string | Output token price | `'$2.50'` |
| `supportsTemperature` | boolean | Temperature support | `true` or `false` |
| `isReasoning` | boolean | Reasoning model flag | `true` or `false` |
| `responseSpeed` | string | Speed category | `'fast'`, `'moderate'`, `'slow'` |
| `responseEstimate` | string | Human-readable estimate | `'<30 sec'`, `'1-2 min'`, `'3-5+ min'` |

### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `contextWindow` | number | Token context window | `200000` |
| `maxOutputTokens` | number | Max output tokens | `128000` |
| `releaseDate` | string | Release date (YYYY-MM) | `"2025-09"` |
| `apiModelName` | string | API-specific name (defaults to key) | `'google/gemini-2.5-flash-preview-09-2025'` |
| `supportsStructuredOutput` | boolean | JSON mode support | `true` or `false` |
| `requiresPromptFormat` | boolean | Special formatting required | `true` or `false` |

## Provider-Specific Guidelines

### OpenAI Models
- Provider: `'OpenAI'`
- ModelType: Auto-set to `'gpt5_chat'`, `'gpt5'`, or `'o3_o4'`
- Use official API model names

### Anthropic Models
- Provider: `'Anthropic'`
- ModelType: Auto-set to `'claude'`
- Include `maxOutputTokens` field

### Google Gemini Models
- Provider: `'Gemini'`
- ModelType: Auto-set to `'gemini'`
- Include `contextWindow` field
- Use `models/` prefix in apiModelName

### OpenRouter Models
- Provider: `'OpenRouter'`
- ModelType: Auto-set to `'openrouter'`
- Use provider/model-name format for key
- Include both `contextWindow` and `maxOutputTokens`

### DeepSeek Models
- Provider: `'DeepSeek'`
- ModelType: Auto-set to `'deepseek'`

## Weekly Maintenance Workflow

1. **Check for new models** from providers
2. **Gather specifications:**
   - Context window size
   - Max output tokens
   - Input/output pricing
   - Release date
   - Special features (reasoning, structured output)

3. **Add new models** using the script
4. **Remove deprecated models** using `npm run models remove <key>`
5. **Test the configuration:**
   ```bash
   npm run check  # TypeScript validation
   npm run test   # Build and start dev server
   ```

6. **Commit changes:**
   ```bash
   git add server/config/models.ts
   git commit -m "feat: Add [Model Name] and remove deprecated models
   
   - Added: [list models added]
   - Removed: [list models removed]
   - Updated: [list any pricing/spec updates]"
   ```

## Recent Additions (September 2025)

### 1. GLM 4.6 (z-ai)
```typescript
{
  key: 'z-ai/glm-4.6',
  name: 'GLM 4.6',
  provider: 'OpenRouter',
  contextWindow: 200000,
  maxOutputTokens: 128000,
  inputPrice: '$0.60',
  outputPrice: '$2.20',
  releaseDate: '2025-09'
}
```

### 2. Gemini 2.5 Flash Preview (Sep 2025)
```typescript
{
  key: 'google/gemini-2.5-flash-preview-09-2025',
  name: 'Gemini 2.5 Flash Preview (Sep 2025)',
  provider: 'OpenRouter',
  contextWindow: 1050000,
  maxOutputTokens: 65500,
  inputPrice: '$0.30',
  outputPrice: '$2.50',
  releaseDate: '2025-09'
}
```

## Troubleshooting

### Model Not Appearing in UI
1. Verify the model was added to `models.ts`
2. Check TypeScript compilation: `npm run check`
3. Restart the dev server
4. Clear browser cache

### Invalid Configuration Error
1. Ensure all required fields are present
2. Check color class is valid Tailwind class
3. Verify provider name matches exactly
4. Confirm pricing format uses `$` prefix

### Duplicate Model Key
- Each `key` must be unique
- Check existing models with `npm run models list`
- Remove old version before adding new one

## Best Practices

1. **Consistent Naming:** Use provider/model-name format for OpenRouter models
2. **Color Coding:** Use consistent colors for model families (e.g., all Gemini models use teal variants)
3. **Release Dates:** Always include release date for new models
4. **Documentation:** Update CHANGELOG.md when adding/removing models
5. **Testing:** Test new models with a puzzle before committing
6. **Pricing:** Verify pricing from official documentation
7. **Context Windows:** Use actual limits, not marketing numbers

## SRP/DRY Compliance

✅ **Pass**
- Script handles only model configuration management
- No duplication with provider services
- Reusable functions for common operations
- Centralized model metadata

## Future Enhancements

- [ ] Batch add models from JSON file
- [ ] Automatic pricing updates via API
- [ ] Model deprecation warnings
- [ ] Version diff viewer
- [ ] Model performance tracking integration
