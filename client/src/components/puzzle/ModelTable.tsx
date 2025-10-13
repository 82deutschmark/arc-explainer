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

import React from 'react';
import { Loader2, AlertTriangle, Zap, Clock, DollarSign, Calendar } from 'lucide-react';
import type { ExplanationData } from '@/types/puzzle';
import type { ModelConfig } from '@shared/types';

interface ModelTableProps {
  models: ModelConfig[] | undefined;
  processingModels: Set<string>;
  streamingModelKey: string | null;
  streamingEnabled: boolean;
  canStreamModel: (modelKey: string) => boolean;
  explanations: ExplanationData[];
  onAnalyze: (modelKey: string) => void;
  analyzerErrors: Map<string, Error>;
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
  analyzerErrors
}: ModelTableProps) {
  const isStreamingActive = streamingModelKey !== null;

  if (!models) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-xs table-pin-rows">
        <thead>
          <tr className="bg-base-200">
            <th className="w-8"></th>
            <th className="min-w-[160px]">Model Name</th>
            <th className="min-w-[60px] text-center">Runs</th>
            <th className="min-w-[100px]">Streaming</th>
            <th className="min-w-[100px]">Cost</th>
            <th className="min-w-[80px]">Speed</th>
            <th className="min-w-[100px]">Released</th>
            <th className="min-w-[80px] text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {models.map((model) => {
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
                    <div 
                      className="badge badge-success badge-sm"
                      title={`${explanationCount} ${explanationCount === 1 ? 'analysis' : 'analyses'} available`}
                    >
                      {explanationCount}
                    </div>
                  ) : (
                    <span className="text-xs opacity-40">-</span>
                  )}
                </td>

                {/* Streaming Status */}
                <td>
                  {canStream ? (
                    <div className="flex items-center gap-1">
                      <Zap className={`h-3 w-3 ${isStreamingThisModel ? 'text-blue-600' : 'text-blue-400'}`} />
                      <span className={`text-xs ${isStreamingThisModel ? 'text-blue-600 font-medium' : 'text-blue-400'}`}>
                        {isStreamingThisModel ? 'Live' : 'Ready'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs opacity-40">-</span>
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
                    onClick={() => onAnalyze(model.key)}
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
                      'Run'
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
