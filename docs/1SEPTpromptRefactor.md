# Prompt Architecture Refactor Plan
**Date:** September 1, 2025  
**Status:** Planning Phase  
**Priority:** Critical - Fixes frontend display issues & eliminates tech debt

## Executive Summary

The current prompt system has critical architectural flaws causing frontend failures and massive code duplication. This refactor establishes the **database as source of truth**, implements **full prompt traceability**, and creates a **modular, maintainable architecture**.

### Key Problems Identified
1. **Schema-Database Mismatch:** JSON schema requests `keySteps` field that doesn't exist in database
2. **Massive DRY Violations:** 90%+ code duplication in `systemPrompts.ts`
3. **No System Prompt Logging:** Cannot trace which prompt was sent to which model
4. **Broken Custom Prompts:** Get blank system prompts, produce unparseable responses
5. **Frontend Display Failures:** Schema mismatches cause UI to fail displaying results

## Current State Analysis

### Database Schema (Source of Truth)
**EXPLANATIONS Table - Actual Fields:**
```sql
-- Core Analysis Fields
pattern_description         TEXT NOT NULL           -- ✅ Maps to JSON schema
solving_strategy           TEXT NOT NULL           -- ✅ Maps to JSON schema  
hints                      TEXT[]                  -- ✅ Maps to JSON schema
confidence                 INTEGER                 -- ✅ Maps to JSON schema
reasoning_items            JSONB                   -- ❌ JSON schema uses keySteps instead!

-- Prediction Fields
predicted_output_grid      JSONB                   -- ✅ Used for display
multiple_predicted_outputs JSONB                   -- ✅ Multi-test support
multi_test_results         JSONB                   -- ✅ Accuracy tracking

-- Model & Processing Metadata
model_name                 VARCHAR(100)            -- ✅ Model identification
api_processing_time_ms     INTEGER                 -- ✅ Performance tracking
temperature                FLOAT                   -- ✅ Model parameters
reasoning_effort           TEXT                    -- ✅ OpenAI reasoning params
reasoning_verbosity        TEXT                    -- ✅ OpenAI reasoning params

-- Raw Response Logging
provider_raw_response      JSONB                   -- ✅ Full API response
reasoning_log              TEXT                    -- ✅ Structured reasoning
has_reasoning_log          BOOLEAN                 -- ✅ Reasoning presence flag

-- MISSING: System prompt traceability
-- system_prompt_used      TEXT                    -- ❌ Need to add this!
```

### Current JSON Schema Issues
**File:** `server/services/schemas/arcJsonSchema.ts`
```typescript
// ❌ PROBLEMS:
"keySteps": {                    // Does NOT exist in database!
  type: "array",
  items: { type: "string" }
},

// ✅ SHOULD BE:  
"reasoningItems": {              // Maps to reasoning_items JSONB field
  type: "array", 
  items: { type: "string" }
}
```

### System Prompts DRY Violations
**File:** `server/services/prompts/systemPrompts.ts`

**Duplicated Code:**
- `PREDICTION FIELDS REQUIREMENT`: Copy-pasted identically 4+ times (lines 77-89, 108-120, etc.)
- `BASE_SYSTEM_PROMPT`: Repeated via template literals in every prompt
- `JSON_OUTPUT_INSTRUCTIONS`: Duplicated across all prompts
- Field descriptions: Same text repeated multiple times

**Impact:** 
- 250+ lines of duplicated code
- Maintenance nightmare - changes need 4+ locations
- Inconsistent behavior between prompts
- High bug risk from copy-paste errors

### Raw Logging Status
**Current Implementation:**
- ✅ **File System Logging:** `data/explained/{puzzle}-{model}-{timestamp}-raw.json`
- ✅ **Database Raw Response:** `provider_raw_response` JSONB field
- ❌ **Missing System Prompt Logging:** Cannot trace which prompt generated which response
- ❌ **No Full Request Logging:** Don't store complete request payload

## Proposed Architecture

### Phase 1: Database Schema Enhancement

#### Add System Prompt Tracking
```sql
ALTER TABLE explanations ADD COLUMN IF NOT EXISTS system_prompt_used TEXT;
ALTER TABLE explanations ADD COLUMN IF NOT EXISTS user_prompt_used TEXT;  
ALTER TABLE explanations ADD COLUMN IF NOT EXISTS prompt_template_id VARCHAR(50);
ALTER TABLE explanations ADD COLUMN IF NOT EXISTS custom_prompt_text TEXT;

-- Indexes for prompt analysis
CREATE INDEX IF NOT EXISTS idx_explanations_prompt_template 
ON explanations(prompt_template_id);

CREATE INDEX IF NOT EXISTS idx_explanations_custom_prompt_hash
ON explanations(MD5(custom_prompt_text)) WHERE custom_prompt_text IS NOT NULL;
```

**Benefits:**
- Full traceability: prompt → response → database entry
- Debug prompt effectiveness by template
- Identify custom prompts causing issues
- A/B test different system prompts

### Phase 2: Modular JSON Schema Architecture

#### Create Schema Component System
**New File Structure:**
```
server/services/schemas/
├── components/
│   ├── predictionFields.ts     # Output grid definitions
│   ├── analysisFields.ts       # Core analysis field definitions  
│   ├── metadataFields.ts       # Model/processing metadata
│   └── index.ts               # Export all components
├── templates/
│   ├── solverSchema.ts        # Solver mode schema composition
│   ├── explanationSchema.ts   # Explanation mode schema  
│   ├── customSchema.ts        # Minimal custom prompt schema
│   └── index.ts              # Export all templates
├── validators/
│   ├── fieldValidation.ts     # Individual field validators
│   ├── schemaValidation.ts    # Complete schema validators
│   └── index.ts              # Export validators
└── arcJsonSchema.ts          # Main schema (refactored)
```

#### Database-Driven Field Definitions
**File:** `server/services/schemas/components/analysisFields.ts`
```typescript
/**
 * Analysis field definitions - maps 1:1 to database schema
 * SINGLE SOURCE OF TRUTH for all analysis fields
 */
export const ANALYSIS_FIELD_COMPONENTS = {
  // Maps to pattern_description TEXT NOT NULL
  patternDescription: {
    type: "string" as const,
    description: "Description of transformations identified. One or two short sentences even a small child could understand.",
    databaseColumn: "pattern_description",
    required: true
  },

  // Maps to solving_strategy TEXT NOT NULL  
  solvingStrategy: {
    type: "string" as const,
    description: "Clear explanation of the solving approach, written as pseudo-code",
    databaseColumn: "solving_strategy", 
    required: true
  },

  // Maps to reasoning_items JSONB (replaces keySteps!)
  reasoningItems: {
    type: "array" as const,
    items: { type: "string" as const },
    description: "Structured step-by-step reasoning process and insights",
    databaseColumn: "reasoning_items",
    required: true,
    replaces: "keySteps"  // Documentation of what this replaces
  },

  // Maps to hints TEXT[]
  hints: {
    type: "array" as const,
    items: { type: "string" as const },
    description: "Three hints: one algorithm, one description, one as emojis",
    databaseColumn: "hints",
    required: true
  },

  // Maps to confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100)
  confidence: {
    type: "integer" as const,
    minimum: 0,
    maximum: 100,
    description: "Confidence level in the solution (0-100)",
    databaseColumn: "confidence",
    required: true
  }
} as const;
```

#### Composable Schema Templates
**File:** `server/services/schemas/templates/solverSchema.ts`
```typescript
import { ANALYSIS_FIELD_COMPONENTS } from '../components/analysisFields.js';
import { PREDICTION_FIELD_COMPONENTS } from '../components/predictionFields.js';

export function createSolverSchema() {
  return {
    name: "arc_solver_analysis",
    strict: true,
    schema: {
      type: "object",
      properties: {
        // Compose from reusable components
        ...PREDICTION_FIELD_COMPONENTS,
        ...ANALYSIS_FIELD_COMPONENTS,
        
        // Mode-specific additions
        algorithmSteps: {
          type: "array",
          items: { type: "string" },
          description: "Detailed algorithmic steps for solver mode"
        }
      },
      required: [
        ...Object.keys(PREDICTION_FIELD_COMPONENTS),
        ...Object.keys(ANALYSIS_FIELD_COMPONENTS).filter(key => 
          ANALYSIS_FIELD_COMPONENTS[key].required
        )
      ]
    }
  };
}
```

### Phase 3: DRY System Prompt Refactor

#### Extract Common Constants
**File:** `server/services/prompts/components/basePrompts.ts`
```typescript
/**
 * Base prompt components - SINGLE SOURCE OF TRUTH
 * All system prompts compose from these constants
 */

export const BASE_SYSTEM_PROMPT = `You are an expert at analyzing ARC-AGI puzzles. 
Your job is to understand transformation patterns and provide clear, structured analysis.

ARC-AGI puzzles consist of:
- Training examples showing input→output transformations  
- Test cases where you predict the transformation based on what you learned

Key transformation types include:
- Geometric: rotation, reflection, translation, scaling
- Pattern: completion, extension, repetition, sequences
- Logical: AND/OR/XOR/NOT operations, conditionals
- Grid: splitting, merging, overlay, subtraction
- Object: counting, sorting, filtering, grouping
- Color: replacement, mapping, counting, patterns
- Shape: detection, transformation, completion, generation
- Spatial: adjacency, containment, alignment, distances`;

export const JSON_OUTPUT_INSTRUCTIONS = `CRITICAL: Return only valid JSON. No markdown formatting. No code blocks. No extra text.

JSON STRUCTURE REQUIREMENT: The predictedOutput or multiplePredictedOutputs field must be THE FIRST field in your JSON response.

Put all your analysis and insights in the structured JSON fields:
- solvingStrategy: Your complete analysis process and approach
- reasoningItems: Step-by-step analysis progression and insights, including incorrect approaches
- patternDescription: The transformation rules you identified
- hints: Three different representations - algorithm, description, emojis
- confidence: Your certainty level (0-100)`;

export const PREDICTION_FIELD_INSTRUCTIONS = `PREDICTION FIELDS REQUIREMENT: 
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
  * "predictedOutput3": third solution grid (or [] if only 2 predictions needed)`;
```

#### Composable Prompt Builder
**File:** `server/services/prompts/components/promptBuilder.ts`
```typescript
import { 
  BASE_SYSTEM_PROMPT, 
  JSON_OUTPUT_INSTRUCTIONS, 
  PREDICTION_FIELD_INSTRUCTIONS 
} from './basePrompts.js';

/**
 * Compose system prompts from reusable components
 * ELIMINATES all duplication - single function builds all prompts
 */
export function buildSystemPrompt(config: {
  basePrompt?: string;
  taskDescription: string;
  jsonInstructions?: string;
  predictionInstructions?: string;
  additionalInstructions?: string;
}): string {
  const {
    basePrompt = BASE_SYSTEM_PROMPT,
    taskDescription,
    jsonInstructions = JSON_OUTPUT_INSTRUCTIONS,
    predictionInstructions = PREDICTION_FIELD_INSTRUCTIONS,
    additionalInstructions = ''
  } = config;

  return [
    basePrompt,
    taskDescription,
    jsonInstructions,
    predictionInstructions,
    additionalInstructions
  ].filter(Boolean).join('\n\n');
}
```

#### Refactored System Prompts
**File:** `server/services/prompts/systemPrompts.ts` (refactored)
```typescript
import { buildSystemPrompt } from './components/promptBuilder.js';

/**
 * System prompts - now DRY and maintainable!
 * Each prompt is a simple configuration of reusable components
 */

export const SOLVER_SYSTEM_PROMPT = buildSystemPrompt({
  taskDescription: `TASK: Each puzzle has training examples to learn from. 
Analyze training examples, identify the transformation patterns, 
and predict the correct output for the test case. Some puzzles have multiple test cases.`,
  
  additionalInstructions: `Example analysis approach:
1. Examine each training example to understand input→output transformation
2. Identify consistent patterns across all training examples
3. Apply the discovered pattern to the test case input
4. Generate the predicted output grid following the same transformation rule`
});

export const EXPLANATION_SYSTEM_PROMPT = buildSystemPrompt({
  taskDescription: `TASK: Each puzzle has training examples to learn from. 
Analyze training examples, identify the transformation patterns, 
and explain the correct output for the test case. Some puzzles have multiple test cases.`,
  
  additionalInstructions: `Focus on:
1. What transformation pattern is demonstrated in the training examples
2. How that same pattern applies to the test case to produce the correct answer
3. Clear explanations that help users understand the underlying logic
4. Key insights that make the solution obvious once understood`
});

export const ALIEN_COMMUNICATION_SYSTEM_PROMPT = buildSystemPrompt({
  taskDescription: `SPECIAL CONTEXT: This puzzle comes from alien visitors who communicate through spatial patterns. The user sees these puzzles as emoji symbols representing their communication attempt.

TASK: Explain the transformation pattern AND interpret what the aliens might be trying to communicate.`,
  
  additionalInstructions: `Additional required fields:
- alienMeaning: Creative interpretation of the aliens' message
- alienMeaningConfidence: Your certainty about the communication interpretation (0-100)

Remember: Users see emoji symbols, not numbers. Reference the visual patterns they observe.
Be creative but grounded in the actual transformation and abstract reasoning when interpreting alien meaning.`
});

export const EDUCATIONAL_SYSTEM_PROMPT = buildSystemPrompt({
  taskDescription: `TASK: Your goal is to solve the puzzle using a structured, algorithm-driven educational method. You must generate three distinct pseudo-code algorithms, evaluate them, select the best one, and use it to generate the final answer.`,
  
  additionalInstructions: `--- EDUCATIONAL CONTENT Specificalities ---

- **patternDescription**: A clear, natural language description of the transformation rule implemented by your final chosen algorithm.
- **solvingStrategy**: A high-level summary of your approach: generating three algorithms, analysis, evaluating them, and selecting the best one.
- **reasoningItems**: A short song that captures the essence of your approach.
- **hints**: Numbered list of complete pseudo-code for each of the three algorithms you considered, starting with the best algorithm. Explain why you rejected the other algorithms.
- **confidence**: Your confidence (0-100) in the chosen algorithm's correctness and your answer(s)`
});

// 90% reduction in code size!
// Single source of truth for all components
// Easy to maintain and modify
```

### Phase 4: Enhanced Request/Response Logging

#### Add Complete Request Logging
**File:** `server/services/base/BaseAIService.ts` (enhanced)
```typescript
protected async logCompleteRequest(
  promptPackage: PromptPackage,
  modelKey: string,
  serviceOpts: ServiceOptions,
  requestId: string
): Promise<void> {
  const requestLog = {
    requestId,
    timestamp: new Date().toISOString(),
    modelKey,
    
    // Complete prompt information
    systemPrompt: promptPackage.systemPrompt,
    userPrompt: promptPackage.userPrompt,
    templateName: promptPackage.templateName,
    promptTemplateId: promptPackage.selectedTemplate?.id,
    
    // Service configuration
    serviceOptions: serviceOpts,
    
    // Model parameters
    temperature: serviceOpts.temperature,
    maxOutputTokens: serviceOpts.maxOutputTokens,
    reasoningEffort: serviceOpts.reasoningEffort
  };

  // Save to file system for debugging
  const logFileName = `${requestId}-request.json`;
  const logFilePath = path.join('data', 'requests', logFileName);
  await fs.writeFile(logFilePath, JSON.stringify(requestLog, null, 2));
}
```

#### Database Storage Enhancement
**File:** `server/repositories/ExplanationRepository.ts` (enhanced)
```typescript
async createExplanation(data: ExplanationData): Promise<Explanation> {
  const result = await this.query(`
    INSERT INTO explanations (
      puzzle_id, pattern_description, solving_strategy, reasoning_items, hints, confidence,
      model_name, reasoning_log, has_reasoning_log, api_processing_time_ms, estimated_cost,
      temperature, reasoning_effort, reasoning_verbosity, reasoning_summary_type,
      input_tokens, output_tokens, reasoning_tokens, total_tokens,
      predicted_output_grid, multiple_predicted_outputs, multi_test_results,
      multi_test_all_correct, multi_test_average_accuracy, has_multiple_predictions,
      multi_test_prediction_grids, provider_raw_response,
      
      -- NEW: Complete prompt traceability
      system_prompt_used, user_prompt_used, prompt_template_id, custom_prompt_text,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
    RETURNING *
  `, [
    // ... existing parameters ...
    data.systemPromptUsed,    // NEW
    data.userPromptUsed,      // NEW  
    data.promptTemplateId,    // NEW
    data.customPromptText,    // NEW
    new Date()
  ]);
  
  return result.rows[0];
}
```

### Phase 5: Fix Custom Prompts

#### Custom Prompt Schema
**File:** `server/services/schemas/templates/customSchema.ts`
```typescript
/**
 * Minimal schema for custom prompts
 * Only enforces prediction fields + allows flexible analysis
 */
export function createCustomPromptSchema() {
  return {
    name: "arc_custom_analysis",
    strict: false,  // Allow additional properties for flexibility
    schema: {
      type: "object",
      properties: {
        // ALWAYS require prediction fields
        ...PREDICTION_FIELD_COMPONENTS,
        
        // Optional analysis fields - custom prompts can omit
        patternDescription: {
          type: "string",
          description: "Optional: Description of transformations identified"
        },
        solvingStrategy: {
          type: "string", 
          description: "Optional: Solving approach used"
        },
        confidence: {
          type: "integer",
          minimum: 0,
          maximum: 100,
          description: "Optional: Confidence in solution"
        }
      },
      required: [
        // Only prediction fields are required
        "multiplePredictedOutputs",
        "predictedOutput",
        "predictedOutput1", 
        "predictedOutput2",
        "predictedOutput3"
      ],
      additionalProperties: true  // Allow custom fields
    }
  };
}
```

#### Custom Prompt System Prompt
**File:** `server/services/prompts/systemPrompts.ts` (addition)
```typescript
export const CUSTOM_SYSTEM_PROMPT = buildSystemPrompt({
  basePrompt: `You are an expert at analyzing ARC-AGI puzzles.
The user will provide custom analysis instructions.`,
  
  taskDescription: `TASK: Follow the user's custom analysis instructions while ensuring structured output.`,
  
  // Only enforce prediction fields for custom prompts
  jsonInstructions: `CRITICAL: Return only valid JSON. No markdown formatting. No code blocks. No extra text.

JSON STRUCTURE REQUIREMENT: The predictedOutput or multiplePredictedOutputs field must be THE FIRST field in your JSON response.

Include any analysis in additional JSON fields as appropriate for the user's request.`,
  
  additionalInstructions: `You may include additional analysis fields beyond the required prediction fields, based on what the user's custom prompt requests.`
});
```

## Implementation Phases

### Phase 1: Database Schema (Week 1)
**Priority:** Critical - Unblocks everything else
1. Add system prompt tracking columns
2. Update ExplanationRepository to store prompt information
3. Test database migrations
4. Update indexes for prompt analysis

**Testing:**
- Verify schema changes don't break existing queries
- Test prompt storage and retrieval
- Validate performance with new indexes

### Phase 2: Fix Schema Mismatch (Week 1) 
**Priority:** Critical - Fixes frontend display
1. Replace `keySteps` with `reasoningItems` in JSON schema
2. Update all references to use `reasoningItems`
3. Test frontend displays correctly
4. Validate database storage works

**Testing:**
- Test all prompt templates generate valid JSON
- Verify frontend displays reasoningItems properly
- Check database stores reasoning_items correctly

### Phase 3: Modular Schema Architecture (Week 2)
**Priority:** High - Enables maintainable growth
1. Create schema components system
2. Build composable schema templates  
3. Implement field validation
4. Migrate existing schemas to new system

**Testing:**
- Unit tests for each schema component
- Integration tests for composed schemas
- Validate all existing functionality works
- Performance test schema composition

### Phase 4: DRY System Prompts Refactor (Week 2)
**Priority:** High - Eliminates tech debt  
1. Extract base prompt components
2. Build composable prompt system
3. Refactor all existing prompts
4. Remove duplicated code

**Testing:**
- Compare old vs new prompt outputs
- Verify prompt behavior unchanged
- Test all prompt templates work
- A/B test prompt effectiveness

### Phase 5: Enhanced Logging (Week 3)
**Priority:** Medium - Improves debugging
1. Add complete request logging
2. Enhance database prompt storage
3. Build prompt analysis tools
4. Add logging UI for debugging

**Testing:**
- Verify complete request/response logging
- Test prompt traceability works
- Validate logging performance impact
- Test analysis tools accuracy

### Phase 6: Fix Custom Prompts (Week 3)
**Priority:** Medium - Improves user experience
1. Create custom prompt schema
2. Add minimal JSON enforcement
3. Test custom prompt functionality
4. Update custom prompt UI

**Testing:**
- Test custom prompts generate valid JSON
- Verify frontend displays custom results
- Test various custom prompt scenarios
- Validate schema flexibility works

## Risk Mitigation

### Technical Risks
1. **Database Migration Issues**
   - Mitigation: Use `IF NOT EXISTS` and backwards-compatible changes
   - Rollback: Column additions are non-breaking

2. **JSON Schema Breaking Changes**
   - Mitigation: Maintain backwards compatibility during transition
   - Testing: Comprehensive schema validation before deployment

3. **Performance Impact**
   - Mitigation: Index new columns, test query performance
   - Monitoring: Track database performance metrics

### Business Risks  
1. **Prompt Effectiveness Changes**
   - Mitigation: A/B test new vs old prompts
   - Rollback: Keep old prompt system available

2. **Custom Prompt User Impact**
   - Mitigation: Gradual rollout, extensive testing
   - Support: Clear documentation and examples

## Success Metrics

### Technical Metrics
- ✅ **Code Reduction:** 90% reduction in systemPrompts.ts duplication
- ✅ **Schema Alignment:** 100% JSON schema fields map to database columns
- ✅ **Test Coverage:** >95% coverage for all new components
- ✅ **Performance:** <5% impact on response times

### Business Metrics
- ✅ **Frontend Fixes:** 0 display errors for reasoningItems
- ✅ **Custom Prompt Success:** >95% generate valid JSON
- ✅ **Prompt Traceability:** 100% requests logged with system prompts
- ✅ **Maintainability:** New prompts require <50 lines vs >200 previously

## Next Steps

1. **Approve this plan** and implementation phases
2. **Create feature branch** for systematic implementation  
3. **Database migration first** - unblocks everything else
4. **Schema alignment** - fixes immediate frontend issues
5. **Incremental implementation** following defined phases

This refactor transforms the prompt system from a maintenance nightmare into a robust, traceable, maintainable architecture that scales with the project's needs.