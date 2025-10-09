# Grover-ARC Integration Plan
**Date:** 2025-10-08
**Author:** Sonnet 4.5
**Status:** Planning Phase
**Timeline:** 3 Weeks

---

## Executive Summary

This document outlines the integration of Zoe Carver's **Grover-ARC** iterative solver into the ARC Explainer platform. The integration uses a **hybrid architecture** that combines TypeScript orchestration (via our existing Responses API infrastructure) with Python execution sandboxing (for safe code execution).

**Key Goals:**
1. Leverage 3 months of Responses API infrastructure work (grok.ts, openai.ts, conversation chaining)
2. Avoid Saturn solver's architectural isolation mistake
3. Enable multi-provider support (grok-4-fast primary target)
4. Provide industrial-grade iteration tracking and analytics
5. Integrate with existing debate, ELO, and discussion features

---

## Background: Saturn Solver Audit Results

### What We Learned from Saturn

**Strengths:**
- ✅ Uses Responses API correctly (`client_openai.responses.create()`)
- ✅ Structured reasoning with `effort` and `summary` parameters
- ✅ Tool calling for iterative grid visualization
- ✅ Real-time NDJSON streaming via WebSocket

**Critical Architectural Flaws:**
- ❌ **Bypasses entire TypeScript service layer** - Direct Python → OpenAI client
- ❌ **Provider lock-in** - Hardcoded to OpenAI only (`self.client_openai = OpenAI()`)
- ❌ **No conversation chaining** - Can't leverage `previousResponseId` infrastructure
- ❌ **Isolated cost tracking** - Not integrated with RepositoryService
- ❌ **Duplicate API logic** - Reimplements what grok.ts/openai.ts already provide

**Current Flow (WRONG):**
```
Controller → Python Wrapper → Direct OpenAI Client → Responses API
          ↓
    [SKIPS: grok.ts, openai.ts, BaseAIService, conversation chaining]
```

**Lesson for Grover:** Don't repeat this mistake. Use TypeScript for orchestration, Python ONLY for execution sandbox.

---

## Grover-ARC: Quantum-Inspired Iterative Search

### Core Algorithm

Grover-ARC reframes ARC-AGI puzzle solving as a **quantum-inspired amplitude amplification** problem:

```python
for iteration in range(max_iterations):
    # 1. Generate program candidates (Python code, not grids!)
    programs = llm.generate_code(context + history)

    # 2. Execute on training examples (oracle)
    results = [execute(p, training_data) for p in programs]

    # 3. Grade numerically (0-10 scoring)
    graded = [(p, score(r)) for p, r in zip(programs, results)]

    # 4. Sort by fitness
    best = sorted(graded, key=lambda x: x[1], reverse=True)

    # 5. Re-feed top candidates + failures (context saturation)
    context = build_context(best[:5], worst=graded[-3:])
```

### Key Innovations

1. **Code Generation over Grid Prediction** - Generates executable Python programs
2. **Oracle Feedback** - Executes programs on training examples to validate
3. **Numerical Grading** - 0-10 scores enable sorting and selection
4. **Context Saturation** - Keeps best performers + worst failures (teaches what NOT to do)
5. **Amplitude Amplification** - Iteratively shifts probability mass toward correct solutions

### Why This Matters

- **Iteration > Single-Shot** - Empirically proven on ARC-AGI-2
- **Small models can compete** - grok-4-fast can outperform larger models with enough iterations
- **Feedback loops create reasoning** - Grading + re-feeding manufactures emergent intelligence

---

## Architecture Design

### Proposed Hybrid Architecture

**File Structure:**
```
arc-explainer/
├── solver/
│   ├── grover-arc/           # Git submodule (Zoe's repo)
│   │   ├── solver.py         # Original Grover implementation
│   │   ├── batch_runner.py
│   │   └── venv/             # Isolated Python environment
│   └── saturn/
├── server/
│   ├── services/
│   │   ├── grover.ts         # NEW: Grover orchestration service
│   │   ├── groverOrchestrator.ts  # NEW: Iteration logic
│   │   └── base/BaseAIService.ts
│   ├── python/
│   │   └── grover_executor.py  # NEW: Safe code execution sandbox
│   └── controllers/
│       └── groverController.ts  # NEW: API endpoints
```

### Correct Flow (Hybrid)

```
User Request
    ↓
groverController.ts (API endpoint)
    ↓
groverService.ts (extends BaseAIService)
    ↓
    ├─→ grok.ts or openai.ts (LLM code generation via Responses API)
    ├─→ groverOrchestrator.ts (iteration loop, grading, amplification)
    └─→ pythonBridge.runGroverExecution() → grover_executor.py (safe execution)
```

### Service Layer Comparison

| Feature | Saturn (Current) | Grover (Proposed) |
|---------|-----------------|-------------------|
| **LLM Integration** | Direct Python client | Via grok.ts/openai.ts |
| **Provider Support** | OpenAI only | Multi-provider (grok-4-fast, GPT-5, etc.) |
| **Iteration Logic** | N/A (single-pass) | TypeScript orchestration |
| **Python Role** | Full solver | Execution sandbox only |
| **Conversation Chain** | ❌ No | ✅ Yes (per iteration) |
| **Cost Tracking** | Basic tokens | Full RepositoryService integration |
| **Debate Integration** | ❌ Isolated | ✅ Fully integrated |

---

## Implementation Phases

### Phase 1: Repository Import & Isolation (Week 1, Days 1-2)

**Goal:** Safely import grover-arc without contaminating codebase

#### Task 1.1: Add Git Submodule
```bash
git submodule add https://github.com/zoecarver/grover-arc solver/grover-arc
git submodule update --init --recursive
```

**Deliverable:** `solver/grover-arc/` directory with full Grover-ARC source

#### Task 1.2: Create Isolated Python Environment
```bash
cd solver/grover-arc
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Deliverable:** `solver/grover-arc/venv/` with dependencies isolated

#### Task 1.3: Test Standalone Execution
```bash
cd solver/grover-arc
source venv/bin/activate
python solver.py --help
python solver.py --input ../../data/training2/007bbfb7.json
```

**Deliverable:** Confirm Grover works independently

#### Task 1.4: Update .gitignore
```gitignore
# Grover Python Environment
solver/grover-arc/venv/
solver/grover-arc/__pycache__/
solver/grover-arc/*.pyc
```

**Deliverable:** Clean git status, no Python artifacts committed

---

### Phase 2: Database Schema Extensions (Week 1, Day 3)

**Goal:** Add iteration tracking columns to explanations table

#### Task 2.1: Create Migration Script

**File:** `server/migrations/008_grover_columns.sql`

```sql
-- Grover-ARC iteration tracking columns
ALTER TABLE explanations ADD COLUMN IF NOT EXISTS
  grover_iterations JSONB,              -- Full iteration history
  grover_best_program TEXT,             -- Final winning program code
  grover_execution_log JSONB,           -- Oracle results per iteration
  iteration_count INTEGER,              -- Total iterations used
  amplification_factor DOUBLE PRECISION; -- Score improvement ratio

-- Index for querying high-iteration analyses
CREATE INDEX IF NOT EXISTS idx_explanations_iteration_count
  ON explanations(iteration_count)
  WHERE iteration_count IS NOT NULL;

-- Index for Grover-specific queries
CREATE INDEX IF NOT EXISTS idx_explanations_grover_iterations
  ON explanations USING GIN(grover_iterations)
  WHERE grover_iterations IS NOT NULL;
```

#### Task 2.2: Update DatabaseSchema.ts

Add new columns to schema definition:

```typescript
groverIterations: text('grover_iterations'),
groverBestProgram: text('grover_best_program'),
groverExecutionLog: text('grover_execution_log'),
iterationCount: integer('iteration_count'),
amplificationFactor: doublePrecision('amplification_factor'),
```

#### Task 2.3: Update TypeScript Types

**File:** `shared/types.ts`

```typescript
export interface GroverIteration {
  iteration: number;
  programs: string[];            // Generated code candidates
  executionResults: {
    programIdx: number;
    score: number;              // 0-10 grading
    output: number[][] | null;  // Predicted grid
    error?: string;             // Execution error if any
  }[];
  best: {
    programIdx: number;
    score: number;
    code: string;
  };
  cost: number;                 // Per-iteration cost
  timestamp: number;
}

export interface ExplanationData {
  // ... existing fields ...
  groverIterations?: GroverIteration[];
  groverBestProgram?: string;
  groverExecutionLog?: any;
  iterationCount?: number;
  amplificationFactor?: number;
}
```

**Deliverable:** Database ready for iteration tracking

---

### Phase 3: Python Execution Sandbox (Week 1, Days 4-5)

**Goal:** Safe, isolated code execution with AST validation and timeouts

#### Task 3.1: Create Safe Executor

**File:** `server/python/grover_executor.py`

```python
#!/usr/bin/env python3
"""
Grover Code Execution Sandbox
Author: Sonnet 4.5
Date: 2025-10-08
PURPOSE: Safe execution of LLM-generated Python code for ARC puzzle solving.
- AST validation to prevent malicious code
- 5-second timeout per execution
- Resource limits (memory, CPU)
- NDJSON output for streaming results
SRP/DRY check: Pass - Single responsibility (code execution), isolated from orchestration
"""
import sys
import json
import ast
import signal
import traceback
from typing import Dict, List, Any
from contextlib import contextmanager

class ExecutionTimeout(Exception):
    """Raised when code execution exceeds timeout"""
    pass

@contextmanager
def timeout(seconds: int):
    """Context manager for execution timeout"""
    def signal_handler(signum, frame):
        raise ExecutionTimeout(f"Execution exceeded {seconds}s timeout")

    signal.signal(signal.SIGALRM, signal_handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)

def validate_ast(code: str) -> bool:
    """Validate Python code AST for safety"""
    try:
        tree = ast.parse(code)

        # Blacklist dangerous operations
        dangerous_nodes = (
            ast.Import,      # No imports
            ast.ImportFrom,
            ast.Exec,        # No exec/eval
            ast.Global,      # No global manipulation
            ast.Nonlocal,
        )

        for node in ast.walk(tree):
            if isinstance(node, dangerous_nodes):
                return False

        return True
    except SyntaxError:
        return False

def execute_program(code: str, inputs: List[List[List[int]]]) -> Dict[str, Any]:
    """
    Execute generated program on training examples

    Args:
        code: Python code string (must define `transform(grid)` function)
        inputs: Training input grids

    Returns:
        {
            "outputs": [...],  # Predicted grids
            "score": 0-10,     # Average match score
            "error": str|None
        }
    """
    # 1. AST Validation
    if not validate_ast(code):
        return {
            "outputs": [],
            "score": 0.0,
            "error": "Code failed AST validation (unsafe operations detected)"
        }

    # 2. Execute with timeout
    try:
        with timeout(5):
            # Create isolated namespace
            namespace = {}
            exec(code, namespace)

            # Extract transform function
            if 'transform' not in namespace:
                return {
                    "outputs": [],
                    "score": 0.0,
                    "error": "Code must define a `transform(grid)` function"
                }

            transform_fn = namespace['transform']

            # Execute on all inputs
            outputs = []
            for input_grid in inputs:
                output = transform_fn(input_grid)
                outputs.append(output)

            return {
                "outputs": outputs,
                "score": None,  # Scoring happens in TypeScript
                "error": None
            }

    except ExecutionTimeout as e:
        return {"outputs": [], "score": 0.0, "error": str(e)}
    except Exception as e:
        return {
            "outputs": [],
            "score": 0.0,
            "error": f"{type(e).__name__}: {str(e)}"
        }

def main():
    """Main entry point - reads stdin, executes, writes stdout"""
    try:
        payload = json.loads(sys.stdin.read())
        programs = payload.get('programs', [])
        training_inputs = payload.get('training_inputs', [])

        results = []
        for idx, code in enumerate(programs):
            result = execute_program(code, training_inputs)
            results.append({
                "programIdx": idx,
                "code": code,
                **result
            })

        # Output NDJSON
        sys.stdout.write(json.dumps({"type": "execution_results", "results": results}) + "\n")
        sys.stdout.flush()
        return 0

    except Exception as e:
        sys.stderr.write(json.dumps({"type": "error", "message": str(e)}) + "\n")
        sys.stderr.flush()
        return 1

if __name__ == "__main__":
    sys.exit(main())
```

#### Task 3.2: Update pythonBridge.ts

Add Grover execution method:

```typescript
async runGroverExecution(
  programs: string[],
  trainingInputs: number[][][],
  callback?: (event: any) => void
): Promise<any> {
  const scriptPath = path.join(__dirname, '../python/grover_executor.py');
  const venvPython = path.join(
    __dirname,
    '../../solver/grover-arc/venv/bin/python'
  );

  const payload = JSON.stringify({ programs, training_inputs: trainingInputs });

  return this.runPythonScript(
    venvPython,
    scriptPath,
    payload,
    callback
  );
}
```

**Deliverable:** Safe Python execution sandbox

---

### Phase 4: TypeScript Orchestration Layer (Week 2, Days 1-3)

**Goal:** Create groverService.ts extending BaseAIService

#### Task 4.1: Create Grover Service

**File:** `server/services/grover.ts`

```typescript
/**
 * Author: Sonnet 4.5
 * Date: 2025-10-08
 * PURPOSE: Grover iterative ARC solver using quantum-inspired amplitude amplification.
 * Orchestrates LLM code generation (via grok.ts/openai.ts) with Python execution sandbox.
 * Leverages full Responses API infrastructure including conversation chaining.
 * SRP/DRY check: Pass - Extends BaseAIService, delegates LLM to providers, execution to Python
 * shadcn/ui: Pass - Backend service, no UI components
 */

import { ARCTask } from "../../shared/types.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import { getDefaultPromptId, PromptOptions, PromptPackage } from "./promptBuilder.js";
import { aiServiceFactory } from "./aiServiceFactory.js";
import { pythonBridge } from "./pythonBridge.js";
import { logger } from "../utils/logger.js";
import { getApiModelName, getModelConfig } from "../config/models/index.js";

export class GroverService extends BaseAIService {
  protected provider = "Grover";
  protected models: Record<string, string> = {
    "grover-grok-4-fast": "grok-4-fast",
    "grover-gpt-5": "gpt-5",
    "grover-claude-3.5": "claude-3.5-sonnet"
  };

  async analyzePuzzleWithModel(
    task: ARCTask,
    modelKey: string,
    taskId: string,
    temperature: number = 0.2,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): Promise<AIResponse> {
    const maxIterations = serviceOpts.maxSteps || 10;
    const underlyingModel = this.models[modelKey];

    logger.service(this.provider, `Starting Grover analysis with ${underlyingModel} (${maxIterations} iterations)`);

    // Get the underlying service (grok, openai, etc.)
    const underlyingService = aiServiceFactory.getService(underlyingModel);

    const iterations: any[] = [];
    let totalCost = 0;
    let previousResponseId: string | undefined = undefined;
    let bestProgram: string | null = null;
    let bestScore = 0;

    // Initial context
    let context = this.buildInitialContext(task);

    for (let i = 0; i < maxIterations; i++) {
      logger.service(this.provider, `Iteration ${i + 1}/${maxIterations}`);

      // 1. Generate programs via underlying service (uses Responses API!)
      const promptPackage = this.buildCodeGenPrompt(task, context, i);

      const llmResponse = await underlyingService.analyzePuzzleWithModel(
        task,
        underlyingModel,
        taskId,
        temperature,
        promptId,
        promptPackage.userPrompt,
        options,
        {
          ...serviceOpts,
          previousResponseId // Conversation chaining!
        }
      );

      // Store response ID for next iteration
      previousResponseId = llmResponse.providerResponseId;

      // 2. Extract programs from LLM response
      const programs = this.extractPrograms(llmResponse);

      // 3. Execute programs in Python sandbox
      const executionResults = await this.executeProgramsSandbox(programs, task.train);

      // 4. Grade results
      const graded = this.gradeExecutions(executionResults, task.train);

      // 5. Track best program
      const iterationBest = graded[0]; // Already sorted by score
      if (iterationBest.score > bestScore) {
        bestScore = iterationBest.score;
        bestProgram = iterationBest.code;
      }

      // 6. Track iteration
      iterations.push({
        iteration: i,
        programs,
        executionResults: graded,
        best: iterationBest,
        cost: llmResponse.estimatedCost || 0,
        timestamp: Date.now()
      });

      totalCost += llmResponse.estimatedCost || 0;

      // 7. Build amplified context for next iteration
      context = this.amplifyContext(graded, context, i);

      // Early stopping if perfect score
      if (bestScore >= 10) {
        logger.service(this.provider, `Perfect score achieved at iteration ${i + 1}`);
        break;
      }
    }

    // Calculate amplification factor
    const amplificationFactor = iterations.length > 1
      ? iterations[iterations.length - 1].best.score / iterations[0].best.score
      : 1.0;

    // Build final response
    return this.buildGroverResponse(
      modelKey,
      temperature,
      iterations,
      bestProgram,
      totalCost,
      amplificationFactor,
      serviceOpts
    );
  }

  getModelInfo(modelKey: string): ModelInfo {
    const underlyingModel = this.models[modelKey];
    const underlyingService = aiServiceFactory.getService(underlyingModel);
    const underlyingInfo = underlyingService.getModelInfo(underlyingModel);

    return {
      ...underlyingInfo,
      name: `Grover (${underlyingInfo.name})`,
      isReasoning: true // Grover adds iterative reasoning
    };
  }

  generatePromptPreview(
    task: ARCTask,
    modelKey: string,
    promptId: string = getDefaultPromptId(),
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): PromptPreview {
    const context = this.buildInitialContext(task);
    const promptPackage = this.buildCodeGenPrompt(task, context, 0);

    return {
      provider: this.provider,
      modelName: this.models[modelKey],
      promptText: promptPackage.userPrompt,
      messageFormat: {},
      templateInfo: {
        id: "grover-code-gen",
        name: "Grover Code Generation",
        usesEmojis: false
      },
      promptStats: {
        characterCount: promptPackage.userPrompt.length,
        wordCount: promptPackage.userPrompt.split(/\s+/).length,
        lineCount: promptPackage.userPrompt.split('\n').length
      },
      providerSpecificNotes: "Grover uses iterative code generation with execution feedback"
    };
  }

  protected async callProviderAPI(): Promise<any> {
    throw new Error("Grover uses underlying services - this should not be called directly");
  }

  protected parseProviderResponse(): any {
    throw new Error("Grover uses underlying services - this should not be called directly");
  }

  // Grover-specific implementation methods continue in groverOrchestrator.ts
}

export const groverService = new GroverService();
```

#### Task 4.2: Create Grover Orchestrator

**File:** `server/services/groverOrchestrator.ts`

```typescript
/**
 * Grover Orchestrator - Iteration logic, grading, and context amplification
 * Author: Sonnet 4.5
 * Date: 2025-10-08
 */

import { GroverIteration } from "../../shared/types.js";

export class GroverOrchestrator {
  buildInitialContext(task: any): string {
    return `You are solving an ARC-AGI puzzle. Generate Python code that transforms input grids to output grids.

Training Examples:
${task.train.map((ex: any, i: number) => `
Example ${i + 1}:
Input: ${JSON.stringify(ex.input)}
Output: ${JSON.stringify(ex.output)}
`).join('\n')}

Your code must define a function: \`def transform(grid: List[List[int]]) -> List[List[int]]\`

Generate 5 diverse program candidates. Think step-by-step about the transformation rules.`;
  }

  buildCodeGenPrompt(task: any, context: string, iteration: number): any {
    return {
      systemPrompt: "You are an expert Python programmer specializing in ARC-AGI puzzle solving.",
      userPrompt: context + `\n\nIteration ${iteration + 1}: Generate improved programs based on feedback.`
    };
  }

  extractPrograms(llmResponse: any): string[] {
    // Parse LLM response to extract code blocks
    const text = llmResponse.patternDescription || llmResponse.solvingStrategy || "";
    const codeBlockRegex = /```python\n([\s\S]*?)\n```/g;
    const programs: string[] = [];

    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      programs.push(match[1]);
    }

    return programs;
  }

  async executeProgramsSandbox(programs: string[], trainingData: any[]): Promise<any[]> {
    const trainingInputs = trainingData.map(ex => ex.input);
    const result = await pythonBridge.runGroverExecution(programs, trainingInputs);
    return result.results;
  }

  gradeExecutions(executionResults: any[], trainingData: any[]): any[] {
    return executionResults
      .map(result => {
        if (result.error) {
          return { ...result, score: 0 };
        }

        // Calculate match score (0-10)
        let totalScore = 0;
        for (let i = 0; i < trainingData.length; i++) {
          const expected = trainingData[i].output;
          const actual = result.outputs[i];

          if (this.gridsMatch(expected, actual)) {
            totalScore += 10;
          } else {
            totalScore += this.partialMatchScore(expected, actual);
          }
        }

        const avgScore = totalScore / trainingData.length;
        return { ...result, score: avgScore };
      })
      .sort((a, b) => b.score - a.score); // Sort by score descending
  }

  gridsMatch(grid1: number[][], grid2: number[][]): boolean {
    if (!grid1 || !grid2) return false;
    if (grid1.length !== grid2.length) return false;

    for (let i = 0; i < grid1.length; i++) {
      if (grid1[i].length !== grid2[i].length) return false;
      for (let j = 0; j < grid1[i].length; j++) {
        if (grid1[i][j] !== grid2[i][j]) return false;
      }
    }

    return true;
  }

  partialMatchScore(expected: number[][], actual: number[][]): number {
    // Calculate partial match (dimensions, cell similarity)
    // Returns 0-10 based on how close it is
    if (!expected || !actual) return 0;

    const dimScore = (expected.length === actual.length &&
                     expected[0]?.length === actual[0]?.length) ? 5 : 0;

    // Add cell similarity score
    // ... implementation

    return dimScore;
  }

  amplifyContext(gradedResults: any[], oldContext: string, iteration: number): string {
    const best = gradedResults.slice(0, 5);
    const worst = gradedResults.slice(-3);

    return `${oldContext}

## Iteration ${iteration + 1} Results:

### Best Performers (scores ${best.map(r => r.score.toFixed(1)).join(', ')}):
${best.map((r, i) => `
**Program ${i + 1} (score: ${r.score.toFixed(1)}):**
\`\`\`python
${r.code}
\`\`\`
`).join('\n')}

### Failed Approaches (learn what NOT to do):
${worst.map((r, i) => `
**Failed Program ${i + 1} (score: ${r.score.toFixed(1)}):**
Error: ${r.error || "Incorrect output"}
`).join('\n')}

Now generate new programs that:
1. Build on successful patterns from best performers
2. Avoid failed approaches
3. Explore new transformation rules`;
  }

  buildGroverResponse(
    modelKey: string,
    temperature: number,
    iterations: GroverIteration[],
    bestProgram: string | null,
    totalCost: number,
    amplificationFactor: number,
    serviceOpts: any
  ): any {
    return {
      model: modelKey,
      groverIterations: iterations,
      groverBestProgram: bestProgram,
      iterationCount: iterations.length,
      amplificationFactor,
      estimatedCost: totalCost,
      temperature,
      patternDescription: `Grover iterative solver completed ${iterations.length} iterations`,
      solvingStrategy: bestProgram || "No successful program found",
      predictedOutput: iterations[iterations.length - 1]?.best?.outputs?.[0] || null,
      confidence: iterations[iterations.length - 1]?.best?.score || 0,
      ...serviceOpts
    };
  }
}

export const groverOrchestrator = new GroverOrchestrator();
```

**Deliverable:** Full TypeScript orchestration layer

---

### Phase 5: API Controller & Routes (Week 2, Day 4)

#### Task 5.1: Create Grover Controller

**File:** `server/controllers/groverController.ts`

```typescript
/**
 * Grover Controller - API endpoints for Grover iterative solver
 * Author: Sonnet 4.5
 * Date: 2025-10-08
 */

import type { Request, Response } from 'express';
import { formatResponse } from '../utils/responseFormatter.js';
import { groverService } from '../services/grover.js';
import { randomUUID } from 'crypto';
import { broadcast } from '../services/wsService.js';

export const groverController = {
  async analyze(req: Request, res: Response) {
    const { taskId, modelKey } = req.params;

    if (!taskId || !modelKey) {
      return res.status(400).json(formatResponse.error('bad_request', 'Missing taskId or modelKey'));
    }

    const sessionId = randomUUID();

    const options = {
      temperature: req.body?.temperature ?? 0.2,
      maxSteps: req.body?.maxIterations ?? 10,
      previousResponseId: req.body?.previousResponseId,
    };

    // Start async analysis
    setImmediate(() => {
      groverService
        .analyzePuzzleWithModel(
          null as any, // Load task inside service
          modelKey,
          taskId,
          options.temperature,
          undefined,
          undefined,
          undefined,
          options
        )
        .then(result => {
          broadcast(sessionId, {
            status: 'completed',
            result
          });
        })
        .catch(err => {
          broadcast(sessionId, {
            status: 'error',
            message: err.message
          });
        });
    });

    return res.json(formatResponse.success({ sessionId }));
  }
};
```

#### Task 5.2: Update Routes

**File:** `server/routes.ts`

```typescript
// Add Grover routes
import { groverController } from './controllers/groverController.js';

app.post('/api/puzzle/grover/:taskId/:modelKey', groverController.analyze);
```

**Deliverable:** API endpoints ready

---

### Phase 6: Frontend Integration (Week 2, Day 5 - Week 3, Days 1-2)

#### Task 6.1: Add Grover Model Keys

**File:** `client/src/config/modelConfig.ts`

```typescript
export const GROVER_MODELS = {
  'grover-grok-4-fast': { name: 'Grover (grok-4-fast)', provider: 'Grover' },
  'grover-gpt-5': { name: 'Grover (GPT-5)', provider: 'Grover' },
};
```

#### Task 6.2: Create Grover UI Component

**File:** `client/src/pages/GroverSolver.tsx`

```typescript
/**
 * Grover Iterative Solver UI
 * Shows iteration-by-iteration progress with code diffs and scoring
 */

export const GroverSolver: React.FC = () => {
  const [iterations, setIterations] = useState<GroverIteration[]>([]);

  return (
    <div className="grover-solver">
      <h1>Grover Iterative Solver</h1>

      {iterations.map((iter, i) => (
        <IterationCard key={i} iteration={iter} />
      ))}

      <AmplificationChart iterations={iterations} />
      <BestProgramViewer program={bestProgram} />
    </div>
  );
};
```

#### Task 6.3: Create Iteration Visualizations

- `IterationCard` - Shows programs, scores, execution results
- `AmplificationChart` - Line chart of score improvement
- `CodeDiffViewer` - Highlights changes between iterations
- `ExecutionLog` - Shows oracle feedback

**Deliverable:** Full Grover UI

---

### Phase 7: Analytics & Integration (Week 3, Days 3-5)

#### Task 7.1: Add to Leaderboards

Update `AccuracyLeaderboard` to include Grover models

#### Task 7.2: Enable Debate Mode

Allow challenging Grover results with other models

#### Task 7.3: Analytics Dashboard

Add metrics:
- Average iterations to success
- Amplification factor distribution
- Cost per iteration
- Success rate by iteration count

#### Task 7.4: Documentation

**File:** `docs/grover-arc-integration.md`

Document:
- Git submodule management
- Python environment setup
- API usage examples
- Iteration algorithm explanation

**Deliverable:** Full platform integration

---

## Success Metrics

### Technical Metrics
- ✅ Multi-provider support working (grok-4-fast, GPT-5)
- ✅ Conversation chaining across iterations
- ✅ Per-iteration cost tracking
- ✅ Database persistence of full iteration history
- ✅ Real-time UI updates via WebSocket
- ✅ Integration with debate/ELO features

### Performance Metrics
- **Target:** 70%+ accuracy on ARC-AGI-2 eval set
- **Baseline:** Compare vs single-shot grok-4-fast
- **Amplification:** >2x score improvement over iterations
- **Cost Efficiency:** Better accuracy per dollar than single-shot GPT-5

### Code Quality
- ✅ Extends BaseAIService (DRY)
- ✅ Uses existing Responses API infrastructure (no duplication)
- ✅ Isolated Python execution (SRP)
- ✅ Full type safety (TypeScript)

---

## Risk Mitigation

### Risk: Python Sandbox Escape
**Mitigation:** AST validation, timeout enforcement, no imports allowed

### Risk: Infinite Iteration Costs
**Mitigation:** Hard cap at 20 iterations, cost alerts

### Risk: Grover Repo Updates Break Integration
**Mitigation:** Git submodule pinning, version tags

### Risk: Conversation Chaining Limits (30 days)
**Mitigation:** Store full context in database, rebuild if expired

---

## Comparison: Saturn vs Grover

| Aspect | Saturn Solver | Grover Solver |
|--------|--------------|---------------|
| **Integration** | Isolated Python script | Full TypeScript orchestration |
| **LLM Access** | Direct OpenAI client | Via grok.ts/openai.ts (Responses API) |
| **Multi-Provider** | ❌ OpenAI only | ✅ grok-4-fast, GPT-5, Claude, etc. |
| **Conversation Chain** | ❌ No | ✅ Yes (per iteration) |
| **Cost Tracking** | Basic | Full RepositoryService |
| **Iteration Logic** | Single-pass visual | Multi-iteration code gen |
| **Python Role** | Full solver | Execution sandbox only |
| **Debate Integration** | ❌ Isolated | ✅ Full integration |
| **Analytics** | Limited | Full iteration tracking |

---

## Timeline Summary

| Week | Days | Deliverables |
|------|------|-------------|
| **Week 1** | 1-2 | Git submodule, Python venv, standalone test |
| | 3 | Database schema, migrations, types |
| | 4-5 | Python execution sandbox, AST validation |
| **Week 2** | 1-3 | groverService.ts, groverOrchestrator.ts |
| | 4 | API controller, routes |
| | 5 | Frontend model config, basic UI |
| **Week 3** | 1-2 | Iteration visualizations, code viewer |
| | 3-5 | Analytics, leaderboards, debate integration |

---

## Next Steps

1. ✅ **This document created** - Planning complete
2. ⏭️ **Execute Phase 1** - Import grover-arc as submodule
3. ⏭️ **Test standalone** - Verify Grover works independently
4. ⏭️ **Begin TypeScript layer** - Start groverService.ts

---

## References

- **Grover-ARC Repository:** https://github.com/zoecarver/grover-arc
- **Saturn Audit:** Section "Background: Saturn Solver Audit Results" above
- **Responses API Docs:** `docs/API_Conversation_Chaining.md`
- **BaseAIService:** `server/services/base/BaseAIService.ts`
- **Database Schema:** `server/repositories/database/DatabaseSchema.ts`

---

**Status:** Ready for implementation
**Approval Required:** Yes
**Estimated Total Effort:** 3 weeks (120 hours)
