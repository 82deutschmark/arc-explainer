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
  selectableModels: string[];
  selectedOpponents: string[];
  isRunning: boolean;
  loadingModels: boolean;
  modelsError?: string | null;
  onModelAChange: (model: string) => void;
  onOpponentsChange: (opponents: string[]) => void;
  byoApiKey: string;
  byoProvider: 'openrouter' | 'openai' | 'anthropic' | 'xai' | 'gemini' | 'server-default';
  onApiKeyChange: (key: string) => void;
  onProviderChange: (provider: WormArenaSetupProps['byoProvider']) => void;
  onRunMatch: () => void;
}

const WormArenaSetup: React.FC<WormArenaSetupProps> = ({
  modelA,
  selectableModels,
  selectedOpponents,
  isRunning,
  loadingModels,
  modelsError,
  onModelAChange,
  onOpponentsChange,
  byoApiKey,
  byoProvider,
  onApiKeyChange,
  onProviderChange,
  onRunMatch,
}) => {
  const disabled = loadingModels || selectableModels.length < 1 || isRunning;
  const hasValidModels = selectableModels.length >= 1;
  const availableOpponents = selectableModels.filter(m => m !== modelA);

  return (
    <div className="border rounded-lg p-6 space-y-4 worm-border font-worm bg-worm-card">
      <div>
        <h2 className="text-xl font-bold text-worm-ink">🐛 Start a Match 🍎</h2>
        <p className="text-sm worm-muted">Pick models and kick off a Worm Arena battle.</p>
      </div>

      {modelsError ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          <strong>Error:</strong> {modelsError}
        </div>
      ) : (
        <></>
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
          <div className="space-y-2">
            <label className="text-base font-semibold text-worm-ink">Model A 🐛</label>
            <Select value={modelA || ''} onValueChange={onModelAChange} disabled={disabled}>
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder={hasValidModels ? 'Choose model A' : 'Loading models...'} />
              </SelectTrigger>
              {hasValidModels && (
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-base font-semibold text-worm-ink">
                  Opponents 🐛 ({selectedOpponents.length})
                </label>
                <button
                  onClick={() => onOpponentsChange(availableOpponents.slice(0, 9))}
                  className="text-xs text-blue-600 underline hover:text-blue-800 disabled:text-gray-400"
                  disabled={isRunning}
                >
                  Reset to Top 9
                </button>
              </div>

              <div className="border rounded p-3 max-h-48 overflow-y-auto bg-white/50 worm-border">
                {availableOpponents.length === 0 ? (
                  <div className="text-xs worm-muted">
                    {modelA ? 'No other models available' : 'Select Model A first'}
                  </div>
                ) : (
                  availableOpponents.map((model) => (
                    <label
                      key={model}
                      className="flex items-center gap-2 py-2 cursor-pointer hover:bg-black/5 px-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedOpponents.includes(model)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (selectedOpponents.length < 10) {
                              onOpponentsChange([...selectedOpponents, model]);
                            }
                          } else {
                            onOpponentsChange(selectedOpponents.filter(op => op !== model));
                          }
                        }}
                        disabled={isRunning || (!selectedOpponents.includes(model) && selectedOpponents.length >= 10)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-mono text-worm-ink">{model}</span>
                    </label>
                  ))
                )}
              </div>

              <p className="text-xs worm-muted">
                Select up to 10 opponents. 9 recommended for TrueSkill placement. Sequential execution respects rate limits.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-base font-semibold text-worm-ink">BYO API Key (optional) 🐛</label>
              <input
                type="password"
                value={byoApiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                className="w-full h-11 rounded border px-3 text-base"
                placeholder="Paste your API key"
                disabled={isRunning}
              />
              <p className="text-xs worm-muted">
                Key is sent only for this match; leave blank to use server keys.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-base font-semibold text-worm-ink">Provider 🐛</label>
              <Select value={byoProvider} onValueChange={(v) => onProviderChange(v as WormArenaSetupProps['byoProvider'])} disabled={isRunning}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Select provider (optional)" />
                </SelectTrigger>
                <SelectContent className="text-sm">
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="xai">xAI</SelectItem>
                  <SelectItem value="gemini">Gemini</SelectItem>
                  <SelectItem value="server-default">Use server default</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={onRunMatch}
            disabled={disabled || !modelA || selectedOpponents.length === 0}
            className="w-full h-12 text-base font-bold bg-worm-green hover:bg-worm-green-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? `Running ${selectedOpponents.length} match${selectedOpponents.length !== 1 ? 'es' : ''}...` : `▶ Run ${selectedOpponents.length} Match${selectedOpponents.length !== 1 ? 'es' : ''}`}
          </Button>
        </>
      )}
    </div>
  );
};

export default WormArenaSetup;
