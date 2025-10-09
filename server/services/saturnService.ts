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
import { BaseAIService, ServiceOptions, TokenUsage, AIResponse, PromptPreview, ModelInfo } from "./base/BaseAIService.js";
import { getDefaultPromptId, PromptOptions, PromptPackage } from "./promptBuilder.js";
import { aiServiceFactory } from "./aiServiceFactory.js";
import { pythonBridge } from "./pythonBridge.js";
import { broadcast } from './wsService.js';
import { logger } from "../utils/logger.js";
import { getApiModelName, getModelConfig } from "../config/models/index.js";
import { randomUUID } from 'crypto';

export class SaturnService extends BaseAIService {
  protected provider = "Saturn";
  
  // Map Saturn model keys to underlying provider models (RESPONSES API compatible only)
  protected models: Record<string, string> = {
    "saturn-grok-4-fast-reasoning": "grok-4-fast-reasoning",
    "saturn-gpt-5-nano": "gpt-5-nano-2025-08-07",
    "saturn-gpt-5-mini": "gpt-5-mini-2025-08-07"
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
    const underlyingModel = this.models[modelKey];
    if (!underlyingModel) {
      throw new Error(`Unknown Saturn model key: ${modelKey}`);
    }

    const underlyingService = aiServiceFactory.getService(underlyingModel);
    
    logger.service(this.provider, `Starting Saturn analysis with ${underlyingModel} for puzzle ${taskId}`);
    
    // Generate or use provided session ID for WebSocket broadcasting
    const sessionId = (serviceOpts as any).sessionId || randomUUID();
    
    let previousResponseId: string | undefined = undefined;
    const phases: any[] = [];
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalReasoningTokens = 0;
    
    try {
      // Phase 1: Analyze first training example
      logger.service(this.provider, `Phase 1: Analyzing first training example`);
      broadcast(sessionId, { 
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
      
      const phase1Response = await underlyingService.analyzePuzzleWithModel(
        task,
        underlyingModel,
        taskId,
        temperature,
        promptId,
        phase1Prompt,
        { ...options, includeImages: true, imagePaths: phase1Images },
        { ...serviceOpts, previousResponseId }
      );
      
      previousResponseId = phase1Response.providerResponseId;
      phases.push({ 
        phase: 1, 
        name: 'First Training Example Analysis',
        response: phase1Response,
        images: phase1Images
      });
      
      totalCost += phase1Response.estimatedCost || 0;
      totalInputTokens += phase1Response.inputTokens || 0;
      totalOutputTokens += phase1Response.outputTokens || 0;
      totalReasoningTokens += phase1Response.reasoningTokens || 0;
      
      // Phase 2: Predict second training output (if exists)
      if (task.train.length > 1) {
        logger.service(this.provider, `Phase 2: Predicting second training output`);
        broadcast(sessionId, { 
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
          'phase2'
        );
        
        const phase2Response = await underlyingService.analyzePuzzleWithModel(
          task,
          underlyingModel,
          taskId,
          temperature,
          promptId,
          phase2Prompt,
          { ...options, includeImages: true, imagePaths: phase2Images },
          { ...serviceOpts, previousResponseId }
        );
        
        previousResponseId = phase2Response.providerResponseId;
        phases.push({ 
          phase: 2, 
          name: 'Second Training Prediction',
          response: phase2Response,
          images: phase2Images,
          expectedOutput: task.train[1].output
        });
        
        totalCost += phase2Response.estimatedCost || 0;
        totalInputTokens += phase2Response.inputTokens || 0;
        totalOutputTokens += phase2Response.outputTokens || 0;
        totalReasoningTokens += phase2Response.reasoningTokens || 0;
        
        // Phase 2.5: Show actual second output for correction
        logger.service(this.provider, `Phase 2.5: Showing actual second training output`);
        broadcast(sessionId, { 
          status: 'running', 
          phase: 'saturn_phase2_correction',
          step: 2.5,
          totalSteps: 3,
          message: 'Refining pattern understanding with actual output...' 
        });
        
        const phase25Prompt = this.buildPhase25Prompt(task, phase2Response);
        const phase25Images = await this.generateGridImages(
          [task.train[1].output],
          taskId,
          'phase2_actual'
        );
        
        const phase25Response = await underlyingService.analyzePuzzleWithModel(
          task,
          underlyingModel,
          taskId,
          temperature,
          promptId,
          phase25Prompt,
          { ...options, includeImages: true, imagePaths: phase25Images },
          { ...serviceOpts, previousResponseId }
        );
        
        previousResponseId = phase25Response.providerResponseId;
        phases.push({ 
          phase: 2.5, 
          name: 'Pattern Refinement',
          response: phase25Response,
          images: phase25Images
        });
        
        totalCost += phase25Response.estimatedCost || 0;
        totalInputTokens += phase25Response.inputTokens || 0;
        totalOutputTokens += phase25Response.outputTokens || 0;
        totalReasoningTokens += phase25Response.reasoningTokens || 0;
      }
      
      // Show any additional training examples
      for (let i = 2; i < task.train.length; i++) {
        logger.service(this.provider, `Additional training example ${i + 1}`);
        broadcast(sessionId, { 
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
        
        const additionalResponse = await underlyingService.analyzePuzzleWithModel(
          task,
          underlyingModel,
          taskId,
          temperature,
          promptId,
          additionalPrompt,
          { ...options, includeImages: true, imagePaths: additionalImages },
          { ...serviceOpts, previousResponseId }
        );
        
        previousResponseId = additionalResponse.providerResponseId;
        phases.push({ 
          phase: 2 + i * 0.1, 
          name: `Training Example ${i + 1}`,
          response: additionalResponse,
          images: additionalImages
        });
        
        totalCost += additionalResponse.estimatedCost || 0;
        totalInputTokens += additionalResponse.inputTokens || 0;
        totalOutputTokens += additionalResponse.outputTokens || 0;
        totalReasoningTokens += additionalResponse.reasoningTokens || 0;
      }
      
      // Phase 3: Solve test input
      logger.service(this.provider, `Phase 3: Solving test input`);
      broadcast(sessionId, { 
        status: 'running', 
        phase: 'saturn_phase3',
        step: 3,
        totalSteps: 3,
        message: 'Applying learned pattern to test input...' 
      });
      
      const phase3Prompt = this.buildPhase3Prompt(task);
      const phase3Images = await this.generateGridImages(
        [task.test[0].input],
        taskId,
        'test'
      );
      
      const phase3Response = await underlyingService.analyzePuzzleWithModel(
        task,
        underlyingModel,
        taskId,
        temperature,
        promptId,
        phase3Prompt,
        { ...options, includeImages: true, imagePaths: phase3Images },
        { ...serviceOpts, previousResponseId }
      );
      
      phases.push({ 
        phase: 3, 
        name: 'Test Solution',
        response: phase3Response,
        images: phase3Images
      });
      
      totalCost += phase3Response.estimatedCost || 0;
      totalInputTokens += phase3Response.inputTokens || 0;
      totalOutputTokens += phase3Response.outputTokens || 0;
      totalReasoningTokens += phase3Response.reasoningTokens || 0;
      
      // Aggregate all reasoning logs
      const allReasoningLogs = phases
        .map(p => p.response.reasoningLog)
        .filter(Boolean);
      
      const allReasoningItems = phases
        .flatMap(p => p.response.reasoningItems || [])
        .filter(Boolean);
      
      // Build final response
      const finalResponse: AIResponse = {
        model: modelKey,
        temperature,
        
        // Saturn-specific fields
        saturnPhases: phases.map(p => ({
          phase: p.phase,
          name: p.name,
          images: p.images,
          patternDescription: p.response.patternDescription,
          solvingStrategy: p.response.solvingStrategy,
          confidence: p.response.confidence,
          tokenUsage: {
            input: p.response.inputTokens,
            output: p.response.outputTokens,
            reasoning: p.response.reasoningTokens
          },
          cost: p.response.estimatedCost
        })),
        phaseCount: phases.length,
        
        // Final prediction from last phase
        predictedOutput: phase3Response.predictedOutput,
        patternDescription: `Saturn Visual Solver (${phases.length} phases via ${underlyingModel})`,
        solvingStrategy: phase3Response.solvingStrategy || 'Multi-phase visual analysis',
        hints: phase3Response.hints || [],
        confidence: phase3Response.confidence || 0,
        
        // Conversation chaining
        providerResponseId: previousResponseId,
        
        // Aggregated token usage
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        reasoningTokens: totalReasoningTokens,
        totalTokens: totalInputTokens + totalOutputTokens + totalReasoningTokens,
        estimatedCost: totalCost,
        
        // Reasoning aggregation
        reasoningLog: allReasoningLogs.length > 0 ? allReasoningLogs : null,
        hasReasoningLog: allReasoningLogs.length > 0,
        reasoningItems: allReasoningItems.length > 0 ? allReasoningItems : undefined,
        
        // Prompt tracking
        systemPromptUsed: null,
        userPromptUsed: null,
        promptTemplateId: promptId,
        customPromptText: customPrompt || null,
        
        // Model info
        reasoningEffort: serviceOpts.reasoningEffort || null,
        reasoningVerbosity: serviceOpts.reasoningVerbosity || null,
        reasoningSummaryType: serviceOpts.reasoningSummaryType || null
      };
      
      broadcast(sessionId, { 
        status: 'completed', 
        phase: 'done',
        message: 'Saturn visual analysis completed successfully',
        result: finalResponse
      });
      
      logger.service(this.provider, `Completed Saturn analysis. Total cost: $${totalCost.toFixed(4)}, Phases: ${phases.length}`);
      
      return finalResponse;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.provider}] Analysis failed for ${modelKey}:`, errorMsg);
      broadcast(sessionId, { 
        status: 'error', 
        phase: 'error',
        message: errorMsg
      });
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
      const result = await pythonBridge.runGridVisualization(grids, taskId, 30);
      logger.service(this.provider, `Generated ${result.imagePaths.length} images for ${label}`);
      return result.imagePaths;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[${this.provider}] Failed to generate grid images:`, errorMsg);
      return [];
    }
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
  private buildPhase3Prompt(task: ARCTask): string {
    return `Now apply the pattern you've learned to solve the test input:

Test Input:
${JSON.stringify(task.test[0].input)}

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
  
  protected async callProviderAPI(): Promise<any> {
    throw new Error("Saturn uses underlying services - this should not be called directly");
  }
  
  protected parseProviderResponse(): any {
    throw new Error("Saturn uses underlying services - this should not be called directly");
  }
}

export const saturnService = new SaturnService();
