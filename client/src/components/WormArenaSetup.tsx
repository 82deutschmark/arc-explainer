/**
 * Author: Claude Code using Haiku
 * Date: 2025-12-09
 * PURPOSE: Minimal match setup controls for Worm Arena.
 *          Handles: Model A/B selection, Run Match button.
 *          No game listing, no replays—just config.
 * SRP/DRY check: Pass — focused solely on match setup UI.
 */

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

export interface WormArenaSetupProps {
  modelA: string;
  modelB: string;
  selectableModels: string[];
  isRunning: boolean;
  loadingModels: boolean;
  modelsError?: string | null;
  onModelAChange: (model: string) => void;
  onModelBChange: (model: string) => void;
  onRunMatch: () => void;
}

const WormArenaSetup: React.FC<WormArenaSetupProps> = ({
  modelA,
  modelB,
  selectableModels,
  isRunning,
  loadingModels,
  modelsError,
  onModelAChange,
  onModelBChange,
  onRunMatch,
}) => {
  const disabled = loadingModels || selectableModels.length < 2 || isRunning;
  const hasValidModels = selectableModels.length >= 2;

  return (
    <div className="border rounded-lg p-6 bg-[#faf5f0] border-[#d4b5a0] space-y-4" style={{ fontFamily: 'Fredoka, sans-serif' }}>
      <div>
        <h2 className="text-lg font-bold text-[#3d2817]">🌱 Start a Match</h2>
        <p className="text-sm text-[#7a6b5f]">Select two models and run a Worm Arena battle.</p>
      </div>

      {modelsError && (
        <Alert variant="destructive">
          <AlertTitle>Model catalog error</AlertTitle>
          <AlertDescription className="text-sm">{modelsError}</AlertDescription>
        </Alert>
      )}

      {loadingModels && (
        <Alert className="border-blue-200 bg-blue-50">
          <AlertTitle>Loading models...</AlertTitle>
          <AlertDescription className="text-sm">Fetching available OpenRouter models.</AlertDescription>
        </Alert>
      )}

      {!loadingModels && !hasValidModels && !modelsError && (
        <Alert variant="destructive">
          <AlertTitle>No models available</AlertTitle>
          <AlertDescription className="text-sm">
            Could not load OpenRouter models. Please refresh and try again.
          </AlertDescription>
        </Alert>
      )}

      {hasValidModels && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#3d2817]">Model A</label>
              <Select value={modelA || ''} onValueChange={onModelAChange} disabled={disabled}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Select Model A" />
                </SelectTrigger>
                {selectableModels.length > 0 && (
                  <SelectContent className="text-sm">
                    {selectableModels.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                )}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#3d2817]">Model B</label>
              <Select value={modelB || ''} onValueChange={onModelBChange} disabled={disabled}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Select Model B" />
                </SelectTrigger>
                {selectableModels.length > 0 && (
                  <SelectContent className="text-sm">
                    {selectableModels.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                )}
              </Select>
            </div>
          </div>

          <Button
            onClick={onRunMatch}
            disabled={disabled || !modelA || !modelB}
            className="w-full h-12 text-base font-bold bg-[#6b9e3f] hover:bg-[#5a8836]"
            style={{ fontFamily: 'Fredoka, sans-serif' }}
          >
            {isRunning ? 'Running match...' : '▶ Run Match'}
          </Button>
        </>
      )}
    </div>
  );
};

export default WormArenaSetup;
