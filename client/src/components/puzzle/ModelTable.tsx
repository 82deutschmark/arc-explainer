/**
 * ModelTable.tsx
 *
 * Author: Cascade (DeepSeek R1)
 * Date: 2025-10-12
 * PURPOSE: Data-dense table view for AI model selection
 * Replaces ModelSelection card grid with compact table format
 * Preserves ALL information from original cards: color, name, premium badge, 
 * explanation count, streaming status, costs, speed, release date, temperature support
 * 
 * SRP/DRY check: Pass - Single responsibility (dense model table display)
 * DaisyUI: Pass - Uses DaisyUI table component
 */

import React, { useState } from 'react';
import { Loader2, AlertTriangle, Zap, Clock, DollarSign, Calendar } from 'lucide-react';
import type { ExplanationData } from '@/types/puzzle';
import type { ModelConfig } from '@shared/types';
import type { ARCTask } from '@shared/types';
import { PromptPreviewModal } from '@/components/PromptPreviewModal';

interface ModelTableProps {
  models: ModelConfig[] | undefined;
  processingModels: Set<string>;
  streamingModelKey: string | null;
  streamingEnabled: boolean;
  canStreamModel: (modelKey: string) => boolean;
  explanations: ExplanationData[];
  onAnalyze: (modelKey: string) => void;
  analyzerErrors: Map<string, Error>;
  // Props for prompt preview modal
  task: ARCTask;
  taskId: string;
  promptId: string;
  customPrompt: string;
  promptOptions: {
    emojiSetKey?: string;
    omitAnswer?: boolean;
    sendAsEmojis?: boolean;
  };
}

/**
 * Displays models in a compact table format with all card information preserved
 */
export function ModelTable({
  models,
  processingModels,
  streamingModelKey,
  streamingEnabled,
  canStreamModel,
  explanations,
  onAnalyze,
  analyzerErrors,
  task,
  taskId,
  promptId,
  customPrompt,
  promptOptions
}: ModelTableProps) {
  const isStreamingActive = streamingModelKey !== null;
  const [previewingModelKey, setPreviewingModelKey] = useState<string | null>(null);

  const handleModelRun = (modelKey: string) => {
    setPreviewingModelKey(modelKey);
  };

  const handleCloseModal = () => {
    setPreviewingModelKey(null);
  };

  const handleConfirmRun = React.useCallback(async () => {
    if (!previewingModelKey) {
      return;
    }

    await Promise.resolve(onAnalyze(previewingModelKey));
    setPreviewingModelKey(null);
  }, [onAnalyze, previewingModelKey]);

  if (!models) {
    return null;
  }

  // Sort models by release date (newest first), then by name
  const sortedModels = [...models].sort((a, b) => {
    // Models without release dates go to bottom
    if (!a.releaseDate && !b.releaseDate) return a.name.localeCompare(b.name);
    if (!a.releaseDate) return 1;
    if (!b.releaseDate) return -1;
    
    // Parse release dates (format: "YYYY-MM" or similar)
    const dateA = new Date(a.releaseDate + '-01').getTime();
    const dateB = new Date(b.releaseDate + '-01').getTime();
    
    // Newest first (descending)
    if (dateB !== dateA) return dateB - dateA;
    
    // If same date, sort by name
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="overflow-x-auto max-h-[600px] relative">
      <table className="table table-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-base-300 shadow-sm">
            <th className="w-8 bg-base-300"></th>
            <th className="min-w-[160px] bg-base-300">Model Name</th>
            <th className="min-w-[60px] text-center bg-base-300">Runs</th>
            <th className="min-w-[100px] bg-base-300">Stream</th>
            <th className="min-w-[100px] bg-base-300">Cost</th>
            <th className="min-w-[80px] bg-base-300">Speed</th>
            <th className="min-w-[100px] bg-base-300">Released</th>
            <th className="min-w-[80px] text-center bg-base-300">Action</th>
          </tr>
        </thead>
        <tbody>
          {sortedModels.map((model) => {
            const isProcessing = processingModels.has(model.key);
            const isStreamingThisModel = streamingModelKey === model.key;
            const disableDueToStreaming = isStreamingActive && !isStreamingThisModel;
            const error = analyzerErrors.get(model.key);
            const explanationCount = explanations.filter(e => e.modelName === model.key).length;
            const canStream = streamingEnabled && canStreamModel(model.key);

            return (
              <tr 
                key={model.key}
                className={`hover:bg-base-200 transition-colors ${
                  error ? 'bg-red-50' : 
                  explanationCount > 0 ? 'bg-green-50' : ''
                } ${model.premium ? 'bg-amber-50' : ''}`}
              >
                {/* Color indicator */}
                <td>
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <div className={`w-3 h-3 rounded-full ${model.color}`} />
                  )}
                </td>

                {/* Model Name */}
                <td>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm">
                      {model.name}
                    </span>
                    {model.premium && (
                      <span className="text-xs">💰</span>
                    )}
                    {!model.supportsTemperature && (
                      <span 
                        className="text-xs opacity-60"
                        title="No temperature control"
                      >
                        ⚙️
                      </span>
                    )}
                  </div>
                  {error && (
                    <div className="flex items-center gap-1 text-xs text-red-600">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="truncate max-w-[120px]" title={error.message}>
                        {error.message}
                      </span>
                    </div>
                  )}
                </td>

                {/* Explanation Count */}
                <td className="text-center">
                  {explanationCount > 0 ? (
                    <div className="flex items-center justify-center gap-1">
                      <div 
                        className="badge badge-success badge-sm font-semibold"
                        title={`${explanationCount} ${explanationCount === 1 ? 'run' : 'runs'} completed`}
                      >
                        {explanationCount}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs opacity-40">0</span>
                  )}
                </td>

                {/* Streaming Status */}
                <td>
                  {canStream ? (
                    <div className="badge badge-sm gap-1 border-blue-400 bg-blue-50 text-blue-700">
                      <Zap className="h-3 w-3" />
                      {isStreamingThisModel ? 'LIVE' : 'Yes'}
                    </div>
                  ) : (
                    <span className="text-xs opacity-40">No</span>
                  )}
                </td>

                {/* Cost */}
                <td>
                  <div 
                    className="text-xs"
                    title={`In: ${model.cost.input}/M tokens\nOut: ${model.cost.output}/M tokens`}
                  >
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 opacity-60" />
                      <span>{model.cost.input}</span>
                    </div>
                    <div className="opacity-60 text-[10px]">
                      Out: {model.cost.output}
                    </div>
                  </div>
                </td>

                {/* Speed */}
                <td>
                  {model.responseTime?.estimate ? (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 opacity-60" />
                      <span 
                        className={`text-xs ${
                          model.responseTime.speed === 'fast' ? 'text-green-600' : 
                          model.responseTime.speed === 'moderate' ? 'text-amber-600' : 
                          'text-red-600'
                        }`}
                      >
                        {model.responseTime.estimate}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs opacity-40">-</span>
                  )}
                </td>

                {/* Release Date */}
                <td>
                  {model.releaseDate ? (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 opacity-60" />
                      <span className="text-xs text-blue-600">
                        {model.releaseDate}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs opacity-40">-</span>
                  )}
                </td>

                {/* Action Button */}
                <td className="text-center">
                  <button
                    className={`btn btn-xs ${error ? 'btn-error' : 'btn-primary'}`}
                    onClick={() => handleModelRun(model.key)}
                    disabled={isProcessing || disableDueToStreaming}
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {isStreamingThisModel ? 'Streaming' : 'Running'}
                      </span>
                    ) : error ? (
                      'Retry'
                    ) : (
                      'Preview & Run'
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Prompt Preview Modal with Confirmation */}
      {previewingModelKey && (
        <PromptPreviewModal
          isOpen={true}
          onClose={handleCloseModal}
          task={task}
          taskId={taskId}
          promptId={promptId}
          customPrompt={customPrompt}
          options={{
            emojiSetKey: promptOptions.sendAsEmojis ? promptOptions.emojiSetKey : undefined,
            omitAnswer: promptOptions.omitAnswer,
            sendAsEmojis: promptOptions.sendAsEmojis
          }}
          confirmMode={true}
          onConfirm={handleConfirmRun}
          confirmButtonText="Send Analysis Request"
        />
      )}
    </div>
  );
}
