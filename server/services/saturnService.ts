/**
 * 
 * Author: Sonnet 4.5 using Sonnet 4.5
 * Date: 2025-10-09T00:06:00-04:00
 * PURPOSE: Saturn Visual Solver with TypeScript API Integration.
 * Delegates LLM calls to openai.ts/grok.ts while maintaining Saturn's phased
 * prompting approach. Python becomes VISUALIZATION ONLY (no API calls).
 * Fixes architectural isolation by routing through BaseAIService infrastructure.
 * SRP/DRY check: Pass - Extends BaseAIService, reuses provider services for API calls
 * shadcn/ui: Pass - Backend service, no UI components
 */

import { ARCTask } from "../../shared/types.js";
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo, StreamingHarness } from "./base/BaseAIService.js";
import { getDefaultPromptId, PromptOptions, PromptPackage } from "./promptBuilder.js";
import { aiServiceFactory } from "./aiServiceFactory.js";
import { pythonBridge } from "./pythonBridge.js";
import { broadcast } from './wsService.js';
import { logger } from "../utils/logger.js";
import { getApiModelName, getModelConfig } from "../config/models/index.js";
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';

export class SaturnService extends BaseAIService {
  protected provider = "Saturn";

  // Map Saturn model keys to underlying provider models (RESPONSES API compatible only)
  // Now supports BOTH old format (saturn-*) and new format (direct model keys)
  protected models: Record<string, string> = {
    // Old format (legacy)
    "saturn-grok-4-fast-reasoning": "grok-4-fast-reasoning",
    "saturn-gpt-5-nano": "gpt-5-nano-2025-08-07",
    "saturn-gpt-5-mini": "gpt-5-mini-2025-08-07",
    // New format (direct model keys) - passthrough
    "grok-4-fast-reasoning": "grok-4-fast-reasoning",
    "gpt-5-nano-2025-08-07": "gpt-5-nano-2025-08-07",
    "gpt-5-mini-2025-08-07": "gpt-5-mini-2025-08-07",
    "gpt-5-2025-08-07": "gpt-5-2025-08-07",
    "grok-4": "grok-4"
  };

  /**
   * Get Saturn-specific system prompt for multi-phase visual analysis
   * This prompt is used ONCE for all phases to ensure proper conversation chaining
   */
  private getSaturnSystemPrompt(): string {
    return `You are analyzing ARC-AGI puzzles using a multi-phase visual approach with image inputs.

Your analysis will proceed in phases:
- Phase 1: Analyze the first training example to identify the core transformation pattern
- Phase 2: Predict the output for a second training input based on your pattern
- Phase 2.5: Refine your understanding when shown the actual output
- Phase 3: Apply your refined pattern to solve the test case

Each message will indicate which phase you're in. Visual representations of grids are provided as images.

Always look for:
- Spatial, color, size, and structural transformations
- Properties with semantic significance
- Compositional rules that must be applied in sequence
- Consistent patterns across all training examples`;
  }

  /**
   * Determine whether a requested model key should be processed by the Saturn pipeline.
   */
  isSaturnModelKey(modelKey: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.models, modelKey);
  }

  supportsStreaming(modelKey: string): boolean {
    if (!this.isSaturnModelKey(modelKey)) {
      return false;
    }

    const underlyingModel = this.models[modelKey];
    const underlyingService = aiServiceFactory.getService(underlyingModel);

    if (underlyingService?.supportsStreaming) {
      try {
        return underlyingService.supportsStreaming(underlyingModel);
      } catch (error) {
        logger.logError(
          `Saturn failed to inspect streaming support for ${underlyingModel}`,
          { error, context: this.provider }
        );
        return true;
      }
    }

    // Default to true when the underlying provider does not expose capability metadata.
    return true;
  }

  /**
   * Override streaming method to route to analyzePuzzleWithModel which already handles streaming harness
   */
  async analyzePuzzleWithStreaming(
    task: ARCTask,
    modelKey: string,
    taskId: string,
    temperature: number = 0.2,
    promptId?: string,
    customPrompt?: string,
    options?: PromptOptions,
    serviceOpts: ServiceOptions = {}
  ): Promise<AIResponse> {
    // analyzePuzzleWithModel already handles streaming via serviceOpts.stream
    return this.analyzePuzzleWithModel(
      task,
      modelKey,
      taskId,
      temperature,
      promptId || getDefaultPromptId(),
      customPrompt,
      options,
      serviceOpts
    );
  }

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
    const underlyingModel = this.models[modelKey];
    if (!underlyingModel) {
      throw new Error(`Unknown Saturn model key: ${modelKey}`);
    }

    const underlyingService = aiServiceFactory.getService(underlyingModel);
    
    logger.service(this.provider, `Starting Saturn analysis with ${underlyingModel} for puzzle ${taskId}`);
    
    // Generate or use provided session ID for WebSocket broadcasting
    const sessionId = (serviceOpts as any).sessionId || randomUUID();
    const harness = serviceOpts.stream;
    const controller = this.registerStream(harness);
    
    // Helper to send progress to both WebSocket and SSE
    const sendProgress = (payload: Record<string, any>) => {
      // WebSocket broadcast
      if (sessionId) {
        broadcast(sessionId, { ...payload });
      }
      
      // SSE emission
      if (harness) {
        // Include images, step, totalSteps, and progress in SSE status events
        const statusPayload: Record<string, any> = {
          state: "in_progress",
          phase: payload.phase,
          message: payload.message,
        };
        
        if (payload.images) statusPayload.images = payload.images;
        if (payload.step !== undefined) statusPayload.step = payload.step;
        if (payload.totalSteps !== undefined) statusPayload.totalSteps = payload.totalSteps;
        if (payload.progress !== undefined) statusPayload.progress = payload.progress;

        this.emitStreamEvent(harness, "stream.status", statusPayload);

        // Note: Message is already included in statusPayload above.
        // emitStreamChunk is for content deltas only (like OpenAI text streaming),
        // NOT for progress messages. Removed redundant chunk emission.
      }
    };
    
    let previousResponseId: string | undefined = undefined;
    const phases: any[] = [];
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalReasoningTokens = 0;

    // Calculate total phases upfront for multi-phase streaming coordination
    const totalPhaseCount = 1 + // Phase 1
      (task.train.length > 1 ? 2 : 0) + // Phase 2 + 2.5
      Math.max(0, task.train.length - 2) + // Additional training examples
      task.test.length; // Phase 3 (one per test case)
    let currentPhaseNum = 0;

    // Helper to emit phase completion WITHOUT closing the stream
    const emitPhaseComplete = (phaseName: string) => {
      currentPhaseNum++;
      if (harness?.emitEvent) {
        harness.emitEvent('stream.phase_complete', {
          phase: currentPhaseNum,
          totalPhases: totalPhaseCount,
          phaseName,
          message: `${phaseName} complete (${currentPhaseNum}/${totalPhaseCount})`
        });
      }
    };

    // Create a wrapped harness that intercepts end() calls
    // This prevents underlying services from closing the stream after each phase
    const wrappedHarness: StreamingHarness | undefined = harness ? {
      ...harness,
      end: async (summary) => {
        // Don't call the real harness.end() here - just emit phase complete
        // The real end() will be called only after ALL phases complete
        logger.debug(`[Saturn] Phase ${currentPhaseNum + 1} completed, continuing to next phase...`, 'Saturn');
      }
    } : undefined;

    // Saturn system prompt - ONLY used for Phase 1 (initial call)
    // For continuation calls (Phase 2+), we send ONLY the customUserPrompt
    const saturnSystemPrompt = this.getSaturnSystemPrompt();
    
    try {
      // Phase 1: Analyze first training example
      logger.service(this.provider, `Phase 1: Analyzing first training example`);
      sendProgress({ 
        status: 'running', 
        phase: 'saturn_phase1', 
        step: 1,
        totalSteps: 3,
        message: 'Analyzing first training example with visual analysis...' 
      });
      
      const phase1Prompt = this.buildPhase1Prompt(task);
      const phase1Images = await this.generateGridImages(
        [task.train[0].input, task.train[0].output],
        taskId,
        'phase1'
      );
      
      // Phase 1: Initial call - use systemPromptOverride to set Saturn's system prompt
      const phase1ServiceOpts: ServiceOptions = {
        ...serviceOpts,
        stream: wrappedHarness, // Use wrapped harness to prevent premature stream closure
        systemPromptOverride: saturnSystemPrompt,
        suppressInstructionsOnContinuation: true,
        previousResponseId: undefined, // First phase has no previous response
        customUserPrompt: phase1Prompt,
      };
      
      logger.service(this.provider, `Phase 1: systemPromptOverride length=${saturnSystemPrompt.length}, customUserPrompt length=${phase1Prompt.length}`);

      const phase1Response = wrappedHarness
        ? await underlyingService.analyzePuzzleWithStreaming!(
            task,
            underlyingModel,
            taskId,
            temperature,
            promptId,
            undefined,
            { ...options, includeImages: true, imagePaths: phase1Images },
            phase1ServiceOpts
          )
        : await underlyingService.analyzePuzzleWithModel(
            task,
            underlyingModel,
            taskId,
            temperature,
            promptId,
            undefined,
            { ...options, includeImages: true, imagePaths: phase1Images },
            phase1ServiceOpts
          );
      
      previousResponseId = phase1Response.providerResponseId;
      logger.service(this.provider, `Phase 1 complete - providerResponseId: ${previousResponseId || 'MISSING!'}`);
      if (!previousResponseId) {
        logger.error(this.provider, 'Phase 1 did not return providerResponseId - continuation will fail!');
      }
      phases.push({
        phase: 1,
        name: 'First Training Example Analysis',
        response: phase1Response,
        images: phase1Images
      });

      // Emit phase completion event (NOT stream.complete)
      emitPhaseComplete('Phase 1: First Training Example Analysis');

      // Broadcast completion with images (converted to base64 for frontend)
      const phase1ImagesBase64 = await this.convertImagesToBase64(phase1Images);
      sendProgress({
        status: 'running',
        phase: 'saturn_phase1_complete',
        message: 'Phase 1 complete',
        images: phase1ImagesBase64
      });
      
      totalCost += phase1Response.estimatedCost || 0;
      totalInputTokens += phase1Response.inputTokens || 0;
      totalOutputTokens += phase1Response.outputTokens || 0;
      totalReasoningTokens += phase1Response.reasoningTokens || 0;
      
      // Phase 2: Predict second training output (if exists)
      if (task.train.length > 1) {
        logger.service(this.provider, `Phase 2: Predicting second training output`);
        sendProgress({ 
          status: 'running', 
          phase: 'saturn_phase2',
          step: 2,
          totalSteps: 3,
          message: 'Predicting second training output based on pattern...' 
        });
        
        const phase2Prompt = this.buildPhase2Prompt(task);
        const phase2Images = await this.generateGridImages(
          [task.train[1].input],
          taskId,
          'phase2_input'
        );
        
        // Phase 2: Continuation call - NO systemPromptOverride, ONLY customUserPrompt
        logger.service(this.provider, `Phase 2 starting with previousResponseId: ${previousResponseId || 'NONE'}`);
        logger.service(this.provider, `Phase 2 customUserPrompt length: ${phase2Prompt.length}`);
        logger.service(this.provider, `Phase 2 suppressInstructionsOnContinuation: true`);

        const phase2ServiceOpts: ServiceOptions = {
          ...serviceOpts,
          stream: wrappedHarness, // Use wrapped harness
          suppressInstructionsOnContinuation: true,
          previousResponseId,
          customUserPrompt: phase2Prompt,
          // NO systemPromptOverride for continuation!
        };

        const phase2Response = wrappedHarness
          ? await underlyingService.analyzePuzzleWithStreaming!(
              task,
              underlyingModel,
              taskId,
              temperature,
              promptId,
              undefined,
              { ...options, includeImages: true, imagePaths: phase2Images },
              phase2ServiceOpts
            )
          : await underlyingService.analyzePuzzleWithModel(
              task,
              underlyingModel,
              taskId,
              temperature,
              promptId,
              undefined,
              { ...options, includeImages: true, imagePaths: phase2Images },
              phase2ServiceOpts
            );
        
        previousResponseId = phase2Response.providerResponseId;
        phases.push({
          phase: 2,
          name: 'Second Training Prediction',
          response: phase2Response,
          images: phase2Images,
          expectedOutput: task.train[1].output
        });

        // Emit phase completion
        emitPhaseComplete('Phase 2: Second Training Prediction');

        const phase2ImagesBase64 = await this.convertImagesToBase64(phase2Images);
        sendProgress({
          status: 'running',
          phase: 'saturn_phase2_complete',
          message: 'Phase 2 complete',
          images: phase2ImagesBase64
        });
        
        totalCost += phase2Response.estimatedCost || 0;
        totalInputTokens += phase2Response.inputTokens || 0;
        totalOutputTokens += phase2Response.outputTokens || 0;
        totalReasoningTokens += phase2Response.reasoningTokens || 0;
        
        // Phase 2.5: Show actual second output for refinement
        logger.service(this.provider, `Phase 2.5: Showing actual second output for refinement`);
        sendProgress({ 
          status: 'running', 
          phase: 'saturn_phase2_correction',
          step: 2,
          totalSteps: 3,
          message: 'Refining pattern understanding with actual output...' 
        });
        
        const phase25Prompt = this.buildPhase25Prompt(task, phase2Response);
        const phase25Images = await this.generateGridImages(
          [task.train[1].output],
          taskId,
          'phase2_output'
        );
        
        // Phase 2.5: Continuation call - NO systemPromptOverride, ONLY customUserPrompt
        const phase25ServiceOpts: ServiceOptions = {
          ...serviceOpts,
          stream: wrappedHarness, // Use wrapped harness
          suppressInstructionsOnContinuation: true,
          previousResponseId,
          customUserPrompt: phase25Prompt,
        };

        const phase25Response = wrappedHarness
          ? await underlyingService.analyzePuzzleWithStreaming!(
              task,
              underlyingModel,
              taskId,
              temperature,
              promptId,
              undefined,
              { ...options, includeImages: true, imagePaths: phase25Images },
              phase25ServiceOpts
            )
          : await underlyingService.analyzePuzzleWithModel(
              task,
              underlyingModel,
              taskId,
              temperature,
              promptId,
              undefined,
              { ...options, includeImages: true, imagePaths: phase25Images },
              phase25ServiceOpts
            );
        
        previousResponseId = phase25Response.providerResponseId;
        phases.push({
          phase: 2.5,
          name: 'Pattern Refinement',
          response: phase25Response,
          images: phase25Images
        });

        // Emit phase completion
        emitPhaseComplete('Phase 2.5: Pattern Refinement');

        const phase25ImagesBase64 = await this.convertImagesToBase64(phase25Images);
        sendProgress({
          status: 'running',
          phase: 'saturn_phase2_correction_complete',
          message: 'Pattern refinement complete',
          images: phase25ImagesBase64
        });
        
        totalCost += phase25Response.estimatedCost || 0;
        totalInputTokens += phase25Response.inputTokens || 0;
        totalOutputTokens += phase25Response.outputTokens || 0;
        totalReasoningTokens += phase25Response.reasoningTokens || 0;
      }
      
      // Show any additional training examples
      for (let i = 2; i < task.train.length; i++) {
        logger.service(this.provider, `Additional training example ${i + 1}`);
        sendProgress({ 
          status: 'running', 
          phase: `saturn_phase_train${i}`,
          message: `Analyzing training example ${i + 1}...` 
        });
        
        const additionalPrompt = this.buildAdditionalTrainingPrompt(task, i);
        const additionalImages = await this.generateGridImages(
          [task.train[i].input, task.train[i].output],
          taskId,
          `train${i}`
        );
        
        // Additional training: Continuation call - NO systemPromptOverride, ONLY customUserPrompt
        const additionalServiceOpts: ServiceOptions = {
          ...serviceOpts,
          stream: wrappedHarness, // Use wrapped harness
          suppressInstructionsOnContinuation: true,
          previousResponseId,
          customUserPrompt: additionalPrompt,
        };

        const additionalResponse = wrappedHarness
          ? await underlyingService.analyzePuzzleWithStreaming!(
              task,
              underlyingModel,
              taskId,
              temperature,
              promptId,
              undefined,
              { ...options, includeImages: true, imagePaths: additionalImages },
              additionalServiceOpts
            )
          : await underlyingService.analyzePuzzleWithModel(
              task,
              underlyingModel,
              taskId,
              temperature,
              promptId,
              undefined,
              { ...options, includeImages: true, imagePaths: additionalImages },
              additionalServiceOpts
            );
        
        previousResponseId = additionalResponse.providerResponseId;
        phases.push({
          phase: 2 + i * 0.1,
          name: `Training Example ${i + 1}`,
          response: additionalResponse,
          images: additionalImages
        });

        const additionalImagesBase64 = await this.convertImagesToBase64(additionalImages);
        if (additionalImagesBase64.length > 0) {
          sendProgress({
            status: 'running',
            phase: `saturn_phase_train${i}_complete`,
            message: `Training example ${i + 1} visual pair ready`,
            images: additionalImagesBase64,
          });
        }

        // Emit phase completion
        emitPhaseComplete(`Additional Training: Example ${i + 1}`);

        totalCost += additionalResponse.estimatedCost || 0;
        totalInputTokens += additionalResponse.inputTokens || 0;
        totalOutputTokens += additionalResponse.outputTokens || 0;
        totalReasoningTokens += additionalResponse.reasoningTokens || 0;
      }
      
      // Phase 3: Apply to test (loop through all test cases for multi-test support)
      const testPredictions: Array<{
        testIndex: number;
        response: AIResponse;
        images: string[];
      }> = [];

      for (let testIdx = 0; testIdx < task.test.length; testIdx++) {
        logger.service(this.provider, `Phase 3.${testIdx + 1}: Applying pattern to test ${testIdx + 1}/${task.test.length}`);
        sendProgress({
          status: 'running',
          phase: `saturn_phase3_test${testIdx + 1}`,
          step: 3,
          totalSteps: 3,
          message: `Applying pattern to test ${testIdx + 1}/${task.test.length}...`
        });

        const phase3Prompt = this.buildPhase3Prompt(task, testIdx);
        const phase3Images = await this.generateGridImages(
          [task.test[testIdx].input],
          taskId,
          `test${testIdx}_input`
        );

        // Phase 3: Continuation call - NO systemPromptOverride, ONLY customUserPrompt
        const phase3ServiceOpts: ServiceOptions = {
          ...serviceOpts,
          stream: wrappedHarness, // Use wrapped harness
          suppressInstructionsOnContinuation: true,
          previousResponseId,
          customUserPrompt: phase3Prompt,
        };

        const phase3Response = wrappedHarness
          ? await underlyingService.analyzePuzzleWithStreaming!(
              task,
              underlyingModel,
              taskId,
              temperature,
              promptId,
              undefined,
              { ...options, includeImages: true, imagePaths: phase3Images },
              phase3ServiceOpts
            )
          : await underlyingService.analyzePuzzleWithModel(
              task,
              underlyingModel,
              taskId,
              temperature,
              promptId,
              undefined,
              { ...options, includeImages: true, imagePaths: phase3Images },
              phase3ServiceOpts
            );

        // Update previousResponseId for next test case continuation
        previousResponseId = phase3Response.providerResponseId;

        testPredictions.push({
          testIndex: testIdx,
          response: phase3Response,
          images: phase3Images
        });

        phases.push({
          phase: 3 + testIdx * 0.1,
          name: `Test ${testIdx + 1} Prediction`,
          response: phase3Response,
          images: phase3Images
        });

        // Emit phase completion
        emitPhaseComplete(`Phase 3.${testIdx + 1}: Test ${testIdx + 1} Prediction`);

        const phase3ImagesBase64 = await this.convertImagesToBase64(phase3Images);
        sendProgress({
          status: 'running',
          phase: `saturn_phase3_test${testIdx + 1}_complete`,
          message: `Test ${testIdx + 1} prediction complete`,
          images: phase3ImagesBase64
        });

        totalCost += phase3Response.estimatedCost || 0;
        totalInputTokens += phase3Response.inputTokens || 0;
        totalOutputTokens += phase3Response.outputTokens || 0;
        totalReasoningTokens += phase3Response.reasoningTokens || 0;
      }
      
      // Aggregate all reasoning logs
      const allReasoningLogs = phases
        .map(p => p.response.reasoningLog)
        .filter(Boolean);
      
      const allReasoningItems = phases
        .flatMap(p => p.response.reasoningItems || [])
        .filter(Boolean);
      
      // Build final response (supporting multi-test predictions)
      const hasMultipleTests = task.test.length > 1;
      const finalPhase = phases[phases.length - 1].response;

      const finalResponse: AIResponse = {
        model: modelKey,
        temperature,
        reasoningLog: allReasoningLogs.join('\n\n---\n\n'),
        hasReasoningLog: allReasoningLogs.length > 0,
        reasoningItems: allReasoningItems,

        // Token usage (aggregated across all phases)
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        reasoningTokens: totalReasoningTokens,
        totalTokens: totalInputTokens + totalOutputTokens + totalReasoningTokens,
        estimatedCost: totalCost,

        // Predicted output (backward compatible - uses first test)
        predictedOutput: testPredictions[0].response.predictedOutput,
        solvingStrategy: testPredictions[0].response.solvingStrategy,
        patternDescription: testPredictions[0].response.patternDescription,
        hints: testPredictions[0].response.hints,
        confidence: testPredictions[0].response.confidence,

        // Multi-test support
        multiplePredictedOutputs: hasMultipleTests,
        ...(hasMultipleTests && {
          multiTestResults: testPredictions.map(pred => ({
            testIndex: pred.testIndex,
            predictedOutput: pred.response.predictedOutput,
            solvingStrategy: pred.response.solvingStrategy,
            confidence: pred.response.confidence,
            images: pred.images
          }))
        }),

        // Saturn-specific metadata
        saturnPhases: phases.map(p => ({
          phase: p.phase,
          name: p.name,
          images: p.images,
          response: {
            predictedOutput: p.response.predictedOutput,
            confidence: p.response.confidence,
            reasoningLog: p.response.reasoningLog
          }
        })),

        // Provider metadata
        providerResponseId: finalPhase.providerResponseId,
        systemPromptUsed: saturnSystemPrompt,
        promptTemplateId: 'saturn-multi-phase',
      };
      
      sendProgress({ 
        status: 'complete', 
        phase: 'complete',
        message: 'Saturn analysis complete',
        result: {
          confidence: finalResponse.confidence,
          totalCost: totalCost,
          totalPhases: phases.length
        }
      });
      
      if (harness) {
        this.finalizeStream(harness, {
          status: 'success',
          responseSummary: {
            analysis: finalResponse  // Wrap in analysis field for frontend compatibility
          },
          metadata: {
            tokenUsage: {
              input: totalInputTokens,
              output: totalOutputTokens,
              reasoning: totalReasoningTokens
            }
          }
        });
      }
      
      return finalResponse;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.provider}] Saturn analysis failed:`, errorMsg);
      
      sendProgress({ 
        status: 'error', 
        phase: 'error',
        message: `Saturn analysis failed: ${errorMsg}`
      });
      
      if (harness) {
        this.emitStreamEvent(harness, 'stream.error', {
          code: 'SATURN_ANALYSIS_ERROR',
          message: errorMsg
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Generate grid images via Python visualization subprocess
   */
  private async generateGridImages(
    grids: number[][][],
    taskId: string,
    label: string
  ): Promise<string[]> {
    try {
      const result = await pythonBridge.runGridVisualization(grids, taskId, 30, label);
      logger.service(this.provider, `Generated ${result.imagePaths.length} images for ${label}`);
      return result.imagePaths;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.provider}] Failed to generate grid images:`, errorMsg);
      return [];
    }
  }
  
  /**
   * Convert image file paths to base64 for streaming to frontend
   */
  private async convertImagesToBase64(imagePaths: string[]): Promise<{ path: string; base64: string }[]> {
    const results: { path: string; base64: string }[] = [];
    
    for (const path of imagePaths) {
      try {
        const buffer = await readFile(path);
        const base64 = buffer.toString('base64');
        results.push({ path, base64 });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`[${this.provider}] Failed to read image ${path}:`, errorMsg);
        // Skip this image but continue with others
      }
    }
    
    return results;
  }
  
  /**
   * Phase 1: Analyze first training example
   */
  private buildPhase1Prompt(task: ARCTask): string {
    return `You are analyzing a visual puzzle from the ARC-AGI dataset. I'll show you the first training example.

Training Example 1:
Input grid:
${JSON.stringify(task.train[0].input)}

Output grid:
${JSON.stringify(task.train[0].output)}

Visual representations of these grids have been generated and attached to this message.

**Your task:**
1. Analyze the transformation from input to output
2. Identify the core pattern or rule
3. Look for spatial, color, size, or structural changes
4. Consider compositional reasoning - some rules may need to be applied in sequence
5. Note which properties have semantic significance

Provide a detailed analysis of what pattern you observe.`;
  }
  
  /**
   * Phase 2: Predict second training output
   */
  private buildPhase2Prompt(task: ARCTask): string {
    return `Now I'll show you the second training input. Based on the pattern you identified in the first example, predict what the output should be.

Training Example 2 Input:
${JSON.stringify(task.train[1].input)}

A visual representation of this grid is attached.

**Your task:**
Apply the pattern you identified to predict the output grid. Provide your prediction in the exact grid format: [[row1], [row2], ...]`;
  }
  
  /**
   * Phase 2.5: Show actual second output for refinement
   */
  private buildPhase25Prompt(task: ARCTask, phase2Response: AIResponse): string {
    return `Here's the actual output for the second training example:

Actual Output:
${JSON.stringify(task.train[1].output)}

A visual representation is attached.

${phase2Response.predictedOutput ? 
  `Compare this with your prediction. If they differ, refine your understanding of the pattern.` :
  `Study this output carefully and refine your understanding of the transformation pattern.`
}

**Your task:**
Refine your pattern understanding based on this information. What consistent rules apply across both training examples?`;
  }
  
  /**
   * Additional training examples (if more than 2)
   */
  private buildAdditionalTrainingPrompt(task: ARCTask, index: number): string {
    return `Here's training example ${index + 1}:

Input:
${JSON.stringify(task.train[index].input)}

Output:
${JSON.stringify(task.train[index].output)}

Visual representations are attached.

**Your task:**
Verify that this example follows the same pattern you've identified. Note any new insights.`;
  }
  
  /**
   * Phase 3: Solve test input
   */
  private buildPhase3Prompt(task: ARCTask, testIndex: number = 0): string {
    const testNum = testIndex + 1;
    const testLabel = task.test.length > 1 ? ` (test ${testNum} of ${task.test.length})` : '';

    return `Now apply the pattern you've learned to solve the test input${testLabel}:

Test Input:
${JSON.stringify(task.test[testIndex].input)}

A visual representation is attached.

**Your task:**
Generate the output grid by applying the consistent pattern you identified from all the training examples.

IMPORTANT: Provide your answer as a grid in the exact format with proper JSON structure:
{
  "predictedOutput": [[row1], [row2], ...],
  "solvingStrategy": "Explanation of how you applied the pattern",
  "confidence": 0-100
}`;
  }
  
  getModelInfo(modelKey: string): ModelInfo {
    const underlyingModel = this.models[modelKey];
    if (!underlyingModel) {
      throw new Error(`Unknown Saturn model key: ${modelKey}`);
    }
    
    const underlyingService = aiServiceFactory.getService(underlyingModel);
    const underlyingInfo = underlyingService.getModelInfo(underlyingModel);
    
    return {
      ...underlyingInfo,
      name: `Saturn (${underlyingInfo.name})`,
      supportsVision: true, // Saturn adds visual analysis
      supportsFunctionCalling: false // Saturn doesn't use function calling in this implementation
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
    const underlyingModel = this.models[modelKey];
    const phase1Prompt = this.buildPhase1Prompt(task);
    
    return {
      provider: this.provider,
      modelName: `Saturn (${getApiModelName(underlyingModel)})`,
      promptText: phase1Prompt,
      messageFormat: {
        phase1: this.buildPhase1Prompt(task),
        phase2: task.train.length > 1 ? this.buildPhase2Prompt(task) : null,
        phase3: this.buildPhase3Prompt(task)
      },
      systemPromptMode: serviceOpts.systemPromptMode || 'ARC',
      templateInfo: {
        id: 'saturn-multi-phase',
        name: 'Saturn Multi-Phase Visual Analysis',
        usesEmojis: false
      },
      promptStats: {
        characterCount: phase1Prompt.length,
        wordCount: phase1Prompt.split(/\s+/).filter(Boolean).length,
        lineCount: phase1Prompt.split('\n').length
      },
      providerSpecificNotes: `Saturn uses multi-phase visual analysis with conversation chaining. Total phases: ${task.train.length + 1}`
    };
  }
  
  protected async callProviderAPI(
    _prompt: any,
    _modelKey: string,
    _temperature: number,
    _serviceOpts: any,
    _testCount: number,
    _taskId?: string
  ): Promise<any> {
    throw new Error("Saturn uses underlying services - this should not be called directly");
  }
  
  protected parseProviderResponse(): any {
    throw new Error("Saturn uses underlying services - this should not be called directly");
  }
}

export const saturnService = new SaturnService();





