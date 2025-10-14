/**
 * Author: code-supernova using DeepSeek V3.2 Exp
 * Date: 2025-10-13
 * PURPOSE: Radar canvas for Saturn solver - information-dense image gallery display.
 * Shows all generated images in a grid layout with controls.
 * SRP: Single responsibility - image display and controls
 * DRY: Pass - reusable component
 */

import React from 'react';
import { Rocket, Square, Image as ImageIcon } from 'lucide-react';
import type { SaturnProgressState } from '@/hooks/useSaturnProgress';
import { getSaturnCompatibleModels, getDefaultSaturnModel, getModelDisplayName, modelSupportsTemperature, modelSupportsReasoningEffort } from '@/lib/saturnModels';

interface Props {
  state: SaturnProgressState;
  isRunning: boolean;
  compact?: boolean;
  model: string;
  setModel: (model: string) => void;
  temperature: number;
  setTemperature: (temp: number) => void;
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  setReasoningEffort: (effort: 'minimal' | 'low' | 'medium' | 'high') => void;
  onStart: () => void;
  onCancel: () => void;
}

export default function SaturnRadarCanvas({
  state,
  isRunning,
  compact,
  model,
  setModel,
  temperature,
  setTemperature,
  reasoningEffort,
  setReasoningEffort,
  onStart,
  onCancel
}: Props) {

  const images = state.galleryImages || [];
  const saturnModels = getSaturnCompatibleModels();
  const currentModel = saturnModels.find(m => m.key === model);
  const supportsTemperature = currentModel ? modelSupportsTemperature(model) : false;
  const supportsReasoningEffort = currentModel ? modelSupportsReasoningEffort(model) : false;

  // Update model if current selection is not compatible
  React.useEffect(() => {
    if (saturnModels.length > 0 && !saturnModels.find(m => m.key === model)) {
      const defaultModel = getDefaultSaturnModel();
      if (defaultModel) {
        setModel(defaultModel.key);
      }
    }
  }, [model, saturnModels, setModel]);

  return (
    <div className="min-h-0 overflow-hidden flex flex-col">
      {/* Header with Controls */}
      <div className="bg-amber-50 border-b border-amber-200">
        <h2 className="bg-amber-400 px-2 py-1 font-bold text-black text-sm inline-block">
          COMPLETION RATE
        </h2>
      </div>

      {/* Split: Controls (left) + Images (right) */}
      <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-[180px_1fr] border border-gray-300">
        {/* LEFT: Master Control Panel */}
        <div className="border-r border-gray-300 bg-gray-50 p-3 space-y-3 overflow-y-auto">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Project</label>
            <select className="w-full px-2 py-1 border border-gray-300 text-xs font-mono bg-white">
              <option>Saturn Visual Solver</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isRunning}
              className="w-full px-2 py-1 border border-gray-300 text-xs font-mono bg-white"
            >
              {saturnModels.map(saturnModel => (
                <option key={saturnModel.key} value={saturnModel.key}>
                  {getModelDisplayName(saturnModel.key)}
                </option>
              ))}
            </select>
          </div>

          {supportsTemperature && (
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Temp</label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                disabled={isRunning}
                className="w-full"
              />
              <div className="text-xs text-gray-600 text-center">{temperature}</div>
            </div>
          )}

          {supportsReasoningEffort && (
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Effort</label>
              <select
                value={reasoningEffort}
                onChange={(e) => setReasoningEffort(e.target.value as 'minimal' | 'low' | 'medium' | 'high')}
                disabled={isRunning}
                className="w-full px-2 py-1 border border-gray-300 text-xs font-mono bg-white"
              >
                <option value="minimal">Min</option>
                <option value="low">Low</option>
                <option value="medium">Med</option>
                <option value="high">High</option>
              </select>
            </div>
          )}

          <button
            onClick={isRunning ? onCancel : onStart}
            className={`w-full px-3 py-2 text-xs font-bold flex items-center justify-center gap-2 ${
              isRunning
                ? 'bg-red-600 text-white hover:bg-red-700 cursor-pointer'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isRunning ? (
              <>
                <Square className="h-3 w-3" />
                STOP
              </>
            ) : (
              <>
                <Rocket className="h-3 w-3" />
                Execute
              </>
            )}
          </button>
        </div>

        {/* RIGHT: Image Gallery */}
        <div className="bg-white p-3 overflow-y-auto">
          {images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ImageIcon className="h-12 w-12 mb-2" />
              <div className="text-sm font-bold">NO IMAGES YET</div>
              <div className="text-xs">Generated images will appear here</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="border border-gray-300 bg-gray-50 p-2">
                  <div className="aspect-square bg-white mb-2 flex items-center justify-center">
                    {img.base64 ? (
                      <img
                        src={`data:image/png;base64,${img.base64}`}
                        alt={`Step ${idx + 1}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-gray-300" />
                    )}
                  </div>
                  <div className="text-xs font-mono text-gray-600">
                    {img.path || `Image ${idx + 1}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
