/**
 * Author: Codex / GPT-5
 * Date: 2025-11-29
 * PURPOSE: Provide the Poetiq solver configuration surface (model picker,
 *          BYO key input, reasoning sliders) using shadcn/ui primitives so
 *          the solver matches the shared design system.
 * SRP/DRY check: Pass - Encapsulates Poetiq control state without touching
 *                the solver orchestration logic.
 */

import React, { useMemo, useEffect } from 'react';
import { Key, Loader2, Brain } from 'lucide-react';
import type { PoetiqProgressState } from '@/hooks/usePoetiqProgress';
import { usePoetiqModels } from '@/hooks/usePoetiqModels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const KEY_PLACEHOLDERS: Record<string, string> = {
  OpenAI: 'sk-...',
  Google: 'AIza...',
  Anthropic: 'sk-ant-...',
  xAI: 'xai-...',
  OpenRouter: 'sk-or-...',
};

interface PoetiqControlPanelProps {
  state: PoetiqProgressState;
  isRunning: boolean;
  apiKey: string;
  setApiKey: (key: string) => void;
  provider: 'gemini' | 'openrouter' | 'openai';
  setProvider: (provider: 'gemini' | 'openrouter' | 'openai') => void;
  model: string;
  setModel: (model: string) => void;
  numExperts: number;
  setNumExperts: (num: number) => void;
  maxIterations: number;
  setMaxIterations: (iterations: number) => void;
  temperature: number;
  setTemperature: (temp: number) => void;
  reasoningEffort: 'low' | 'medium' | 'high';
  setReasoningEffort: (effort: 'low' | 'medium' | 'high') => void;
  promptStyle: 'classic' | 'arc' | 'arc_de' | 'arc_ru' | 'arc_fr' | 'arc_tr';
  setPromptStyle: (style: 'classic' | 'arc' | 'arc_de' | 'arc_ru' | 'arc_fr' | 'arc_tr') => void;
  onStart: () => void;
  onCancel: () => void;
  useAgents: boolean;
  setUseAgents: (value: boolean) => void;
}

export default function PoetiqControlPanel({
  state,
  isRunning,
  apiKey,
  setApiKey,
  provider,
  setProvider,
  model,
  setModel,
  numExperts,
  setNumExperts,
  maxIterations,
  setMaxIterations,
  temperature,
  setTemperature,
  reasoningEffort,
  setReasoningEffort,
  promptStyle,
  setPromptStyle,
  onStart,
  onCancel,
  useAgents,
  setUseAgents,
}: PoetiqControlPanelProps) {
  const { data: poetiqModels, isLoading: modelsLoading } = usePoetiqModels();

  const groupedModels = useMemo(() => {
    if (!poetiqModels) return {};
    const groups: Record<string, typeof poetiqModels> = {
      'Recommended': [],
      'Gemini': [],
      'GPT': [],
      'Grok': [],
      'Claude': [],
      'Other': [],
    };
    poetiqModels.forEach(m => {
      if (m.recommended) groups['Recommended'].push(m);
      const name = m.name.toLowerCase();
      if (name.includes('gemini')) groups['Gemini'].push(m);
      else if (name.includes('gpt')) groups['GPT'].push(m);
      else if (name.includes('grok')) groups['Grok'].push(m);
      else if (name.includes('claude')) groups['Claude'].push(m);
      else groups['Other'].push(m);
    });
    return groups;
  }, [poetiqModels]);

  const selectedModelObj = useMemo(
    () => poetiqModels?.find(m => m.id === model),
    [poetiqModels, model],
  );
  const requiresApiKey = !!(selectedModelObj as any)?.requiresBYO;
  const canUseAgents =
    !!selectedModelObj &&
    selectedModelObj.provider === 'OpenAI' &&
    (selectedModelObj as any)?.routing === 'direct';

  useEffect(() => {
    if (selectedModelObj) {
      let next: 'gemini' | 'openrouter' | 'openai' = 'openrouter';
      if (selectedModelObj.provider === 'Google') next = 'gemini';
      if (selectedModelObj.provider === 'OpenAI') next = 'openai';
      if (provider !== next) setProvider(next);
    }
  }, [selectedModelObj, provider, setProvider]);

  const keyPlaceholder = selectedModelObj
    ? KEY_PLACEHOLDERS[selectedModelObj.provider] || 'API key...'
    : 'API key...';
  const hasApiKey = apiKey.trim().length > 0;
  const canStart = !isRunning && !modelsLoading && (hasApiKey || !requiresApiKey);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      {/* Model Selector */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold text-slate-500">Model:</span>
        {modelsLoading ? (
          <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
        ) : (
          <Select value={model} onValueChange={setModel} disabled={isRunning}>
            <SelectTrigger className="h-7 w-44 text-xs">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {Object.entries(groupedModels).map(([group, list]) =>
                list.length ? (
                  <SelectGroup key={group}>
                    <SelectLabel className="text-[10px]">{group}</SelectLabel>
                    {list.map(entry => (
                      <SelectItem key={entry.id} value={entry.id} className="text-xs">
                        {entry.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null,
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* API Key */}
      <div className="flex items-center gap-1">
        <Key className={cn('h-3 w-3', hasApiKey ? 'text-green-600' : requiresApiKey ? 'text-amber-500' : 'text-slate-400')} />
        <Input
          type="text"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          disabled={isRunning}
          placeholder={keyPlaceholder}
          className={cn('h-7 w-28 font-mono text-[10px]', requiresApiKey && !hasApiKey && 'border-amber-400')}
        />
      </div>

      {/* Experts */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold text-slate-500">Exp:</span>
        <Select value={String(numExperts)} onValueChange={v => setNumExperts(Number(v))} disabled={isRunning}>
          <SelectTrigger className="h-7 w-14 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="8">8</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Iterations */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold text-slate-500">Iter:</span>
        <Input
          type="number"
          min={1}
          max={20}
          value={maxIterations}
          onChange={e => setMaxIterations(parseInt(e.target.value, 10) || 10)}
          disabled={isRunning}
          className="h-7 w-12 text-xs"
        />
      </div>

      {/* Temperature */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold text-slate-500">Temp:</span>
        <Input
          type="number"
          min={0.1}
          max={2}
          step={0.1}
          value={temperature}
          onChange={e => setTemperature(parseFloat(e.target.value) || 1.0)}
          disabled={isRunning}
          className="h-7 w-14 text-xs"
        />
      </div>

      {/* Reasoning Effort */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold text-slate-500">Think:</span>
        <Select value={reasoningEffort} onValueChange={v => setReasoningEffort(v as any)} disabled={isRunning}>
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Med</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Prompt Style */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold text-slate-500">Prompt:</span>
        <Select value={promptStyle} onValueChange={v => setPromptStyle(v as any)} disabled={isRunning}>
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="classic">Classic</SelectItem>
            <SelectItem value="arc">ARC EN</SelectItem>
            <SelectItem value="arc_de">ARC DE</SelectItem>
            <SelectItem value="arc_fr">ARC FR</SelectItem>
            <SelectItem value="arc_tr">ARC TR</SelectItem>
            <SelectItem value="arc_ru">ARC RU</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Agents Toggle */}
      {canUseAgents && (
        <div className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5">
          <Brain className="h-3 w-3 text-emerald-600" />
          <span className="text-[10px] font-medium text-emerald-700">Agents</span>
          <Switch checked={useAgents} onCheckedChange={setUseAgents} disabled={isRunning} className="h-4 w-7" />
        </div>
      )}

      {/* Start Button */}
      <Button size="sm" onClick={onStart} disabled={!canStart} className="ml-auto h-7 px-4 text-xs">
        Start
      </Button>
    </div>
  );
}
