/**DEPRECATED!
 * ModelExaminer.tsx
 * 
 * @author Cascade
 * @description Clean implementation using existing batch analysis system to test AI models against puzzle datasets.
 * This component now orchestrates modular sub-components for configuration, progress, activity, and controls.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';
import { useModels } from '@/hooks/useModels';
import type { ModelConfig } from '@shared/types';
import { useBatchAnalysis } from '@/hooks/useBatchAnalysis';
import { useAnalysisResults } from '@/hooks/useAnalysisResults';

// Import modular components
import ExaminerConfigPanel from '@/components/model-examiner/ExaminerConfigPanel';
import ExaminerProgress from '@/components/model-examiner/ExaminerProgress';
import ExaminerActivity from '@/components/model-examiner/ExaminerActivity';
import ExaminerControls from '@/components/model-examiner/ExaminerControls';

export default function ModelExaminer() {
  // UI configuration state
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [dataset, setDataset] = useState<string>('ARC2-Eval');
  const [batchSize, setBatchSize] = useState<number>(10);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(true);

  // Set page title
  useEffect(() => {
    document.title = 'Model Examiner - Batch Analysis';
  }, []);

  const { data: models, isLoading: modelsLoading } = useModels();

  // Use batch analysis hook for main functionality
  const {
    sessionId,
    progress,
    isRunning,
    isLoading,
    error,
    results,
    startupStatus,
    startAnalysis,
    pauseAnalysis,
    resumeAnalysis,
    cancelAnalysis,
  } = useBatchAnalysis();

  // Use analysis results hook for settings management
  const { 
    temperature, 
    setTemperature,
    promptId, 
    setPromptId,
    customPrompt,
    setCustomPrompt,
    reasoningEffort,
    setReasoningEffort,
    reasoningVerbosity,
    setReasoningVerbosity,
    reasoningSummaryType,
    setReasoningSummaryType,
    isGPT5ReasoningModel
  } = useAnalysisResults({
    taskId: '', // No specific task for settings management
    refetchExplanations: () => {},
    emojiSetKey: undefined,
    omitAnswer: true
  });

  // Get current model configuration for UI display and validation
  const currentModel = selectedModel ? models?.find((m: ModelConfig) => m.key === selectedModel) : null;

  /**
   * Initiates batch analysis using the existing useBatchAnalysis hook
   */
  const handleStartAnalysis = async () => {
    if (!selectedModel) return;

    const config = {
      modelKey: selectedModel,
      dataset,
      promptId: promptId === 'custom' ? undefined : promptId,
      customPrompt: promptId === 'custom' ? customPrompt : undefined,
      temperature: currentModel?.supportsTemperature ? temperature : undefined,
      reasoningEffort: isGPT5ReasoningModel(selectedModel) ? reasoningEffort : undefined,
      reasoningVerbosity: isGPT5ReasoningModel(selectedModel) ? reasoningVerbosity : undefined,
      reasoningSummaryType: isGPT5ReasoningModel(selectedModel) ? reasoningSummaryType : undefined,
      batchSize
    };

    try {
      const result = await startAnalysis(config);
      if (!result.success) {
        alert(`Failed to start batch analysis: ${result.error}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`Exception starting batch analysis: ${errorMessage}`);
    }
  };
  
  return (
    <div className="container mx-auto p-3 max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Model Examiner</h1>
          <p className="text-gray-600">Batch test AI models against puzzle datasets</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/batch">
            <Button variant="outline" size="sm">
              <BarChart3 className="h-4 w-4 mr-2" />
              View Results Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Progress Display */}
      {progress && (
        <ExaminerProgress
          progress={progress}
          currentModel={currentModel}
          selectedModel={selectedModel}
          dataset={dataset}
        />
      )}

      {/* Live Activity */}
      {(sessionId || (results && results.length > 0)) && (
        <ExaminerActivity
          sessionId={sessionId}
          startupStatus={startupStatus}
          progress={progress}
          results={results}
          selectedModel={selectedModel}
        />
      )}

      {/* Configuration Panel - only show when not running */}
      {!isRunning && (
        <ExaminerConfigPanel
          models={models || null}
          modelsLoading={modelsLoading}
          currentModel={currentModel}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          dataset={dataset}
          setDataset={setDataset}
          batchSize={batchSize}
          setBatchSize={setBatchSize}
          promptId={promptId}
          setPromptId={setPromptId}
          customPrompt={customPrompt}
          setCustomPrompt={setCustomPrompt}
          showAdvancedSettings={showAdvancedSettings}
          setShowAdvancedSettings={setShowAdvancedSettings}
          temperature={temperature}
          setTemperature={setTemperature}
          isGPT5ReasoningModel={isGPT5ReasoningModel}
          reasoningEffort={reasoningEffort}
          setReasoningEffort={setReasoningEffort as (value: string) => void}
          reasoningVerbosity={reasoningVerbosity}
          setReasoningVerbosity={setReasoningVerbosity as (value: string) => void}
          reasoningSummaryType={reasoningSummaryType}
          setReasoningSummaryType={setReasoningSummaryType as (value: string) => void}
        />
      )}
      
      {/* Control Panel */}
      <ExaminerControls
        isPaused={progress?.status === 'paused'}
        isRunning={isRunning}
        isLoading={isLoading}
        progress={progress}
        handleStart={handleStartAnalysis}
        handlePause={pauseAnalysis}
        handleResume={resumeAnalysis}
        handleCancel={cancelAnalysis}
      />
    </div>
  );
}
