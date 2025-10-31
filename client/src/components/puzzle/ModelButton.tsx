/**
 * Author: Cascade
 * Date: 2025-10-31T00:00:00Z
 * PURPOSE: Presents a compact model selection card with status indicators, pricing, and metadata.
 *          Updated to tighten spacing and typography so the grid consumes roughly half the vertical space
 *          without sacrificing key signals like streaming readiness or error states.
 * SRP/DRY check: Pass — focused solely on rendering individual model cards; verified adjacent components unchanged.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { ModelButtonProps } from '@/types/puzzle';
import { Loader2, AlertTriangle } from 'lucide-react';
import { ModelProgressIndicator } from './ModelProgressIndicator';

export function ModelButton({ model, isAnalyzing, isStreaming, streamingSupported, explanationCount, onAnalyze, disabled, error }: ModelButtonProps) {
  return (
    <Button
      variant="outline"
      className={`h-auto p-2 flex flex-col items-start gap-1.5 relative text-left text-xs leading-tight transition-all ${
        error 
          ? 'ring-2 ring-red-500 bg-red-50 border-red-300'
          : explanationCount > 0 
          ? 'ring-2 ring-green-500' 
          : ''
      } ${model.premium && !error ? 'border-amber-300 bg-amber-50' : ''}`}
      onClick={() => onAnalyze(model.key)}
      disabled={disabled}
    >
      {model.premium && (
        <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] px-1 rounded-full">
          💰
        </div>
      )}
      
            {error ? (
        <div className="flex flex-col items-center justify-center w-full text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-bold">{model.name} Failed</span>
          </div>
          <p className="text-[11px] text-center mt-2 break-words" title={error.message}>
            {error.message.length > 90 ? `${error.message.substring(0, 90)}...` : error.message}
          </p>
          <p className="text-[11px] text-center mt-1 font-semibold">(Click to retry)</p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 w-full">
            {isAnalyzing ? (
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                <span className="text-[11px] font-semibold text-blue-600">
                  {isStreaming ? 'Streaming…' : 'Running…'}
                </span>
              </div>
            ) : (
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${model.color}`} />
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold leading-tight">{model.name}</span>
              {explanationCount > 0 && (
                <div 
                  className="text-[10px] px-1 py-0.5 bg-green-500 text-white rounded-full font-semibold"
                  title={`${explanationCount} ${explanationCount === 1 ? 'analysis' : 'analyses'} available in database`}
                >
                  {explanationCount}
                </div>
              )}
            </div>
            {streamingSupported && (
              <span className={`ml-auto whitespace-nowrap font-semibold ${isStreaming ? 'text-blue-600' : 'text-blue-500'}`}>
                {isStreaming ? 'Streaming live' : 'Stream ready'}
              </span>
            )}
          </div>
          
          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600">
            <span className="whitespace-nowrap">In: {model.cost.input}/M</span>
            <span className="whitespace-nowrap">Out: {model.cost.output}/M</span>
            {model.responseTime?.estimate && (
              <span className={`flex items-center gap-1 whitespace-nowrap ${model.responseTime.speed === 'fast' ? 'text-green-600' : model.responseTime.speed === 'moderate' ? 'text-amber-600' : 'text-red-600'}`}>
                ⏱️ {model.responseTime.estimate}
              </span>
            )}
            {model.releaseDate && (
              <span className="text-blue-600 font-medium whitespace-nowrap">📅 {model.releaseDate}</span>
            )}
            {!model.supportsTemperature && (
              <span className="text-amber-600 font-semibold">⚙️ Fixed temp</span>
            )}
          </div>
        </>
      )}
      
      <ModelProgressIndicator 
        model={model} 
        isAnalyzing={isAnalyzing} 
      />
    </Button>
  );
}
