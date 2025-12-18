/**
 * Author: Cascade
 * Date: 2025-12-18
 * PURPOSE: Worm Arena run controls panel with searchable model inputs and match queue.
 *          Model selection is restricted to configured OpenRouter model slugs fetched from /api/models.
 *          Combobox shows the full configured model list (scrollable) and supports searching.
 *          Champion vs Challengers mode: set one champion, add multiple challengers,
 *          then "Run All" opens each match in a new tab.
 * SRP/DRY check: Pass - Single responsibility: render setup controls.
 */

import React from 'react';
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type StreamState = 'idle' | 'connecting' | 'starting' | 'in_progress' | 'completed' | 'failed';

type ByoProvider = 'openrouter' | 'openai' | 'anthropic' | 'xai' | 'gemini';

type ViewMode = 'setup' | 'live';
type RenderMode = 'panel' | 'inline';

// Represents a single matchup in the queue
export interface QueuedMatchup {
  id: string;
  modelA: string;
  modelB: string;
}

export interface WormArenaRunControlsProps {
  viewMode: ViewMode;
  renderMode?: RenderMode;
  status: StreamState;
  isStarting: boolean;

  loadingModels: boolean;
  matchupAvailable: boolean;
  availableModels: Set<string>;
  modelOptions?: string[];

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
  // New: support for running multiple queued matchups
  onStartQueue?: (queue: QueuedMatchup[]) => void;
  launchNotice?: string | null;
}

/**
 * Searchable model combobox - type to filter models instead of scrolling.
 */
function ModelCombobox({
  value,
  onChange,
  models,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (model: string) => void;
  models: string[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Filter models based on search input
  const filteredModels = React.useMemo(() => {
    // IMPORTANT: Do not cap the list here; users rely on being able to scroll through
    // the full configured model catalog.
    if (!search.trim()) return models;
    const term = search.toLowerCase();
    return models.filter((m) => m.toLowerCase().includes(term));
  }, [models, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between text-xs font-mono h-10 px-3"
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to search OpenRouter model slugs..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-80 overflow-y-auto">
            <CommandEmpty>
              No models found.
            </CommandEmpty>
            <CommandGroup>
              {filteredModels.map((model) => (
                <CommandItem
                  key={model}
                  value={model}
                  onSelect={() => {
                    onChange(model);
                    setSearch('');
                    setOpen(false);
                  }}
                  className="font-mono text-xs"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === model ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {model}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function WormArenaRunControls({
  viewMode,
  renderMode = 'panel',
  status,
  isStarting,
  loadingModels,
  matchupAvailable,
  availableModels,
  modelOptions,
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
  onStartQueue,
  launchNotice,
}: WormArenaRunControlsProps) {
  const isLiveLocked = status === 'connecting' || status === 'starting' || status === 'in_progress' || isStarting;

  const [controlsOpen, setControlsOpen] = React.useState(viewMode === 'setup');
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [byoOpen, setByoOpen] = React.useState(false);
  
  // Champion vs Challengers mode
  const [challengers, setChallengers] = React.useState<string[]>([]);
  const [showChallengers, setShowChallengers] = React.useState(false);

  const resolvedModels = React.useMemo(() => {
    if (Array.isArray(modelOptions) && modelOptions.length > 0) return modelOptions;
    return Array.from(availableModels).sort((a, b) => a.localeCompare(b));
  }, [availableModels, modelOptions]);

  // Add current Model B as a challenger
  const handleAddChallenger = () => {
    if (!modelB || challengers.includes(modelB)) return;
    setChallengers((prev) => [...prev, modelB]);
    setShowChallengers(true);
    // Clear modelB so user can add another
    onModelBChange('');
  };

  // Remove a challenger from the list
  const handleRemoveChallenger = (model: string) => {
    setChallengers((prev) => prev.filter((m) => m !== model));
  };

  // Build queue from champion + challengers and run all in new tabs
  const handleRunAllChallengers = async () => {
    if (!modelA || challengers.length === 0) return;
    
    // Build the queue
    const queue: QueuedMatchup[] = challengers.map((challenger) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      modelA: modelA,
      modelB: challenger,
    }));

    // If onStartQueue is provided, use it (for future backend queue support)
    if (onStartQueue) {
      onStartQueue(queue);
      return;
    }

    // Otherwise, start each match in a new tab via the prep endpoint
    for (const matchup of queue) {
      try {
        const payload = {
          modelA: matchup.modelA,
          modelB: matchup.modelB,
          width,
          height,
          maxRounds,
          numApples,
          ...(byoApiKey ? { apiKey: byoApiKey, provider: byoProvider } : {}),
        };
        
        const response = await fetch('/api/snakebench/stream/prepare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.sessionId) {
            // Open in new tab
            window.open(`/worm-arena/live/${data.sessionId}`, '_blank');
          }
        }
      } catch (err) {
        console.error('[WormArenaRunControls] Failed to start match', matchup, err);
      }
      
      // Small delay between requests to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    
    // Clear challengers after starting all
    setChallengers([]);
  };

  const body = (
    <div className="space-y-4">
      <div className="text-xs font-bold uppercase tracking-wide text-worm-ink mb-3">
        Start Live Match
      </div>

      <div className="text-[11px] text-worm-muted">
        OpenRouter models only. This list comes from the app&apos;s configured model catalog.
      </div>

      {loadingModels ? (
        <div className="text-xs text-worm-muted p-3 text-center">Loading models...</div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-worm-ink mb-1 block">Model A</label>
            <ModelCombobox
              value={modelA}
              onChange={onModelAChange}
              models={resolvedModels}
              placeholder="Type or select Model A"
              disabled={isLiveLocked}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-worm-ink mb-1 block">Model B</label>
            <ModelCombobox
              value={modelB}
              onChange={onModelBChange}
              models={resolvedModels}
              placeholder="Type or select Model B"
              disabled={isLiveLocked}
            />
          </div>
        </div>
      )}

      {/* Primary actions: Start single match or add challenger */}
      <div className="flex gap-2">
        <button
          onClick={onStart}
          disabled={isLiveLocked || loadingModels || !matchupAvailable}
          className="flex-1 px-4 py-3 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-worm-green hover:bg-worm-green-hover shadow-md hover:shadow-lg text-center"
        >
          {isLiveLocked ? 'Running...' : 'Start Match'}
        </button>
        <button
          onClick={handleAddChallenger}
          disabled={isLiveLocked || loadingModels || !modelA || !modelB}
          title="Add Model B as challenger (for batch runs)"
          className="px-3 py-3 rounded-lg text-sm font-bold border-2 border-blue-600 text-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Champion vs Challengers Queue */}
      {challengers.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowChallengers(!showChallengers)}
            className="w-full flex items-center justify-between px-3 py-2 rounded border bg-blue-50 text-xs font-semibold border-blue-200 text-blue-800 hover:bg-blue-100 transition-colors"
          >
            <span>Champion vs {challengers.length} Challenger{challengers.length !== 1 ? 's' : ''}</span>
            <span>{showChallengers ? '^' : 'v'}</span>
          </button>
          
          {showChallengers && (
            <div className="space-y-2 p-3 bg-white/80 rounded border worm-border">
              <div className="text-xs font-semibold text-worm-ink mb-2">
                Champion: <span className="font-mono text-blue-700">{modelA || '(select above)'}</span>
              </div>
              
              <div className="text-xs font-semibold text-worm-muted mb-1">Challengers:</div>
              {challengers.map((challenger, idx) => (
                <div
                  key={challenger}
                  className="flex items-center gap-2 text-xs font-mono bg-worm-card rounded px-2 py-1.5"
                >
                  <span className="text-worm-muted font-bold">#{idx + 1}</span>
                  <span className="flex-1 truncate">{challenger}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChallenger(challenger)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Remove challenger"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              
              <div className="text-[11px] text-worm-muted mt-2">
                Each match opens in a new tab.
              </div>
              
              <button
                onClick={handleRunAllChallengers}
                disabled={isLiveLocked || !modelA || challengers.length === 0}
                className="w-full px-4 py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700"
              >
                Run All ({challengers.length} match{challengers.length !== 1 ? 'es' : ''} in new tabs)
              </button>
            </div>
          )}
        </div>
      )}

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
