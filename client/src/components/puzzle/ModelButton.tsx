/**
 * ModelButton Component
 * Button for selecting an AI model for puzzle analysis
 * Author: Cascade
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { ModelButtonProps } from '@/types/puzzle';
import { Loader2 } from 'lucide-react';

export function ModelButton({ model, isAnalyzing, hasResult, onAnalyze, disabled }: ModelButtonProps) {
  return (
    <Button
      variant="outline"
      className={`h-auto p-3 flex flex-col items-center gap-2 relative text-left ${
        hasResult ? 'ring-2 ring-green-500' : ''
      } ${model.premium ? 'border-amber-300 bg-amber-50' : ''}`}
      onClick={() => onAnalyze(model.key)}
      disabled={disabled}
    >
      {model.premium && (
        <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs px-1 rounded-full">
          💰
        </div>
      )}
      
      <div className="flex items-center gap-2 w-full">
        {isAnalyzing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
            hasResult ? 'bg-green-500' : model.color
          }`} />
        )}
        <span className="text-sm font-medium">{model.name}</span>
      </div>
      
      <div className="text-xs text-gray-600 w-full">
        <div>In: {model.cost.input}/M tokens</div>
        <div>Out: {model.cost.output}/M tokens</div>
        {!model.supportsTemperature && (
          <div className="text-amber-600 font-medium">⚙️ No temperature control</div>
        )}
      </div>
    </Button>
  );
}
