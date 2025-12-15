/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-15
 * PURPOSE: Worm Arena run controls panel - simplified to two model dropdowns,
 *          a prominent Start button, and collapsible advanced settings.
 *          Removed curated matchup selector for cleaner, faster UX.
 * SRP/DRY check: Pass - Single responsibility: render setup controls.
 */

import React from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type StreamState = 'idle' | 'connecting' | 'starting' | 'in_progress' | 'completed' | 'failed';

type ByoProvider = 'openrouter' | 'openai' | 'anthropic' | 'xai' | 'gemini';

type ViewMode = 'setup' | 'live';
type RenderMode = 'panel' | 'inline';

export interface WormArenaRunControlsProps {
  viewMode: ViewMode;
  renderMode?: RenderMode;
  status: StreamState;
  isStarting: boolean;

  loadingModels: boolean;
  matchupAvailable: boolean;
  availableModels: Set<string>;

  modelA: string;
  modelB: string;
  onModelAChange: (model: string) => void;
  onModelBChange: (model: string) => void;

  width: number;
  height: number;
  maxRounds: number;
  numApples: number;
  onWidthChange: (v: number) => void;
  onHeightChange: (v: number) => void;
  onMaxRoundsChange: (v: number) => void;
  onNumApplesChange: (v: number) => void;

  byoApiKey: string;
  byoProvider: ByoProvider;
  onByoApiKeyChange: (v: string) => void;
  onByoProviderChange: (v: ByoProvider) => void;

  onStart: () => void;
  launchNotice?: string | null;
}

export default function WormArenaRunControls({
  viewMode,
  renderMode = 'panel',
  status,
  isStarting,
  loadingModels,
  matchupAvailable,
  availableModels,
  modelA,
  modelB,
  onModelAChange,
  onModelBChange,
  width,
  height,
  maxRounds,
  numApples,
  onWidthChange,
  onHeightChange,
  onMaxRoundsChange,
  onNumApplesChange,
  byoApiKey,
  byoProvider,
  onByoApiKeyChange,
  onByoProviderChange,
  onStart,
  launchNotice,
}: WormArenaRunControlsProps) {
  const isLiveLocked = status === 'connecting' || status === 'starting' || status === 'in_progress' || isStarting;

  const [controlsOpen, setControlsOpen] = React.useState(viewMode === 'setup');
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [byoOpen, setByoOpen] = React.useState(false);

  // Sort models alphabetically
  const sortedModels = React.useMemo(
    () => Array.from(availableModels).sort((a, b) => a.localeCompare(b)),
    [availableModels],
  );

  const body = (
    <div className="space-y-4">
      <div className="text-xs font-bold uppercase tracking-wide text-worm-ink mb-3">
        Start Live Match
      </div>

      {loadingModels ? (
        <div className="text-xs text-worm-muted p-3 text-center">Loading models...</div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-worm-ink mb-1 block">Model A</label>
            <Select value={modelA} onValueChange={onModelAChange} disabled={isLiveLocked}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Model A" />
              </SelectTrigger>
              <SelectContent>
                {sortedModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-worm-ink mb-1 block">Model B</label>
            <Select value={modelB} onValueChange={onModelBChange} disabled={isLiveLocked}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Model B" />
              </SelectTrigger>
              <SelectContent>
                {sortedModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <button
        onClick={onStart}
        disabled={isLiveLocked || loadingModels || !matchupAvailable}
        className="w-full px-6 py-4 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-worm-green hover:bg-worm-green-hover shadow-md hover:shadow-lg text-center"
      >
        {isLiveLocked ? 'Match running...' : 'Start Match'}
      </button>

      {launchNotice && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3">{launchNotice}</div>
      )}

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            disabled={isLiveLocked}
            className="w-full flex items-center justify-between px-3 py-2 rounded border bg-white/80 text-xs font-semibold worm-border text-worm-ink hover:bg-white transition-colors disabled:opacity-50"
          >
            <span>Advanced board settings</span>
            <span>{advancedOpen ? '▲' : '▼'}</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3 bg-white/50 rounded p-3 border worm-border">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-worm-ink">
              Width
              <input
                type="number"
                min={5}
                max={30}
                value={width}
                onChange={(e) => onWidthChange(Number(e.target.value))}
                className="mt-1 w-full h-8 rounded border px-2 text-xs bg-white"
                disabled={isLiveLocked}
              />
            </label>
            <label className="text-xs font-semibold text-worm-ink">
              Height
              <input
                type="number"
                min={5}
                max={30}
                value={height}
                onChange={(e) => onHeightChange(Number(e.target.value))}
                className="mt-1 w-full h-8 rounded border px-2 text-xs bg-white"
                disabled={isLiveLocked}
              />
            </label>
            <label className="text-xs font-semibold text-worm-ink">
              Max rounds
              <input
                type="number"
                min={10}
                max={500}
                value={maxRounds}
                onChange={(e) => onMaxRoundsChange(Number(e.target.value))}
                className="mt-1 w-full h-8 rounded border px-2 text-xs bg-white"
                disabled={isLiveLocked}
              />
            </label>
            <label className="text-xs font-semibold text-worm-ink">
              Apples
              <input
                type="number"
                min={1}
                max={15}
                value={numApples}
                onChange={(e) => onNumApplesChange(Number(e.target.value))}
                className="mt-1 w-full h-8 rounded border px-2 text-xs bg-white"
                disabled={isLiveLocked}
              />
            </label>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={byoOpen} onOpenChange={setByoOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            disabled={isLiveLocked}
            className="w-full flex items-center justify-between px-3 py-2 rounded border bg-white/80 text-xs font-semibold worm-border text-worm-ink hover:bg-white transition-colors disabled:opacity-50"
          >
            <span>Advanced: use your own API key</span>
            <span>{byoOpen ? '▲' : '▼'}</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3 bg-white/50 rounded p-3 border worm-border">
          <div className="text-[11px] text-worm-ink">
            Key is used only for this request from your browser; it is not stored server-side.
          </div>

          <input
            type="password"
            value={byoApiKey}
            onChange={(e) => onByoApiKeyChange(e.target.value)}
            placeholder="Paste your API key"
            disabled={isLiveLocked}
            className="w-full h-10 rounded border px-3 text-xs bg-white/80 placeholder-gray-400"
          />

          <select
            value={byoProvider}
            onChange={(e) => onByoProviderChange(e.target.value as ByoProvider)}
            disabled={isLiveLocked}
            className="w-full h-10 rounded border px-3 text-xs bg-white/80"
          >
            <option value="openrouter">OpenRouter</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="xai">xAI</option>
            <option value="gemini">Gemini</option>
          </select>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  if (renderMode === 'inline') {
    return body;
  }

  if (viewMode === 'setup') {
    return <div className="rounded-lg border bg-white/90 shadow-sm px-4 py-4 worm-border">{body}</div>;
  }

  return (
    <Collapsible open={controlsOpen} onOpenChange={setControlsOpen}>
      <div className="rounded-lg border bg-white/90 shadow-sm px-4 py-3 worm-border">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wide text-worm-ink">Controls</div>
          <CollapsibleTrigger asChild>
            <button type="button" className="text-xs font-semibold text-worm-ink">
              {controlsOpen ? 'Hide' : 'Show'}
            </button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent className="pt-3">{body}</CollapsibleContent>
    </Collapsible>
  );
}
