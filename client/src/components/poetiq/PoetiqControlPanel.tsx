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
import { Key, Users, AlertTriangle, Loader2, Cpu, Cloud, Server } from 'lucide-react';
import type { PoetiqProgressState } from '@/hooks/usePoetiqProgress';
import { usePoetiqModels } from '@/hooks/usePoetiqModels';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

const EXPERT_OPTIONS = [
  { value: 1, label: '1 Expert (Config A)', description: 'Fastest, ~5-15 min' },
  { value: 2, label: '2 Experts (Config B)', description: 'Default, ~10-20 min' },
  { value: 8, label: '8 Experts (Config C)', description: 'Best accuracy, ~25-45+ min' },
] as const;

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
}: PoetiqControlPanelProps) {
  const { data: poetiqModels, isLoading: modelsLoading } = usePoetiqModels();

  const groupedModels = useMemo(() => {
    if (!poetiqModels) return {};
    const groups: Record<string, typeof poetiqModels> = {
      'Recommended (SOTA)': [],
      'Gemini Family': [],
      'GPT Family': [],
      'Grok Family': [],
      'Claude Family': [],
      'Open Source & Other': [],
    };
    poetiqModels.forEach(model => {
      if (model.recommended) groups['Recommended (SOTA)'].push(model);
      const name = model.name.toLowerCase();
      if (name.includes('gemini')) groups['Gemini Family'].push(model);
      else if (name.includes('gpt')) groups['GPT Family'].push(model);
      else if (name.includes('grok')) groups['Grok Family'].push(model);
      else if (name.includes('claude')) groups['Claude Family'].push(model);
      else groups['Open Source & Other'].push(model);
    });
    return groups;
  }, [poetiqModels]);

  const selectedModelObj = useMemo(
    () => poetiqModels?.find(m => m.id === model),
    [poetiqModels, model],
  );
  const requiresApiKey = !!(selectedModelObj as any)?.requiresBYO;

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
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-indigo-900">
            <Cpu className="h-4 w-4" />
            Select Large Language Model
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600">
              Choose the AI model that will generate code
            </label>
            {modelsLoading ? (
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                Loading compatible models...
              </div>
            ) : (
              <Select value={model} onValueChange={value => setModel(value)} disabled={isRunning}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {Object.entries(groupedModels).map(([group, list]) =>
                    list.length ? (
                      <SelectGroup key={group}>
                        <SelectLabel className="text-xs text-muted-foreground">{group}</SelectLabel>
                        {list.map(entry => (
                          <SelectItem key={entry.id} value={entry.id}>
                            {entry.name} {(entry as any).requiresBYO ? '(BYO key)' : ''}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null,
                  )}
                </SelectContent>
              </Select>
            )}
            {selectedModelObj && (
              <div
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs font-medium',
                  (selectedModelObj as any)?.routing === 'direct'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-blue-200 bg-blue-50 text-blue-800',
                )}
              >
                {(selectedModelObj as any)?.routing === 'direct' ? (
                  <>
                    <Server className="h-3.5 w-3.5" />
                    Direct API: {selectedModelObj.provider}
                  </>
                ) : (
                  <>
                    <Cloud className="h-3.5 w-3.5" />
                    Routed via OpenRouter
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">
              Temperature: {temperature.toFixed(1)}
            </label>
            <Slider
              value={[temperature]}
              onValueChange={value => setTemperature(value[0])}
              min={0.1}
              max={2}
              step={0.1}
              disabled={isRunning}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Reasoning Effort</label>
            <Select
              value={reasoningEffort}
              onValueChange={value => setReasoningEffort(value as 'low' | 'medium' | 'high')}
              disabled={isRunning}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select reasoning effort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (faster)</SelectItem>
                <SelectItem value="medium">Medium (balanced)</SelectItem>
                <SelectItem value="high">High (deep thinking)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Adjusts the thinking budget for GPT-5.1 / Grok reasoning calls.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Prompt Template</label>
            <Select
              value={promptStyle}
              onValueChange={value =>
                setPromptStyle(
                  value as 'classic' | 'arc' | 'arc_de' | 'arc_ru' | 'arc_fr' | 'arc_tr',
                )
              }
              disabled={isRunning}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select prompt template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic Poetiq (original prompt)</SelectItem>
                <SelectItem value="arc">ARC Explainer (English)</SelectItem>
                <SelectItem value="arc_de">ARC Explainer (Deutsch)</SelectItem>
                <SelectItem value="arc_fr">ARC Explainer (Français)</SelectItem>
                <SelectItem value="arc_tr">ARC Explainer (Türkçe)</SelectItem>
                <SelectItem value="arc_ru">ARC Explainer (Русский)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Choose between the original Poetiq prompt and ARC-optimized prompts in English, German, French, Turkish, or Russian.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(
          requiresApiKey
            ? hasApiKey
              ? 'border-green-300'
              : 'border-amber-400'
            : hasApiKey
              ? 'border-green-300'
              : 'border-gray-200',
        )}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Key
              className={cn(
                'h-4 w-4',
                requiresApiKey
                  ? hasApiKey
                    ? 'text-green-600'
                    : 'text-amber-600'
                  : hasApiKey
                    ? 'text-green-600'
                    : 'text-gray-500',
              )}
            />
            Bring Your Own Key
            <Badge variant="secondary" className="text-[10px]">
              {requiresApiKey ? 'Required' : 'Optional'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Alert
            className={cn(
              requiresApiKey
                ? hasApiKey
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
                : hasApiKey
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-gray-50 text-gray-700',
            )}
          >
            <AlertDescription className="text-xs">
              {requiresApiKey
                ? hasApiKey
                  ? `Your ${selectedModelObj?.provider ?? 'provider'} key is set. It is used only for this run.`
                  : `Provide your ${selectedModelObj?.provider ?? 'provider'} API key to run Poetiq. It is never stored.`
                : hasApiKey
                  ? `Your ${selectedModelObj?.provider ?? 'provider'} key overrides the shared credentials for this session.`
                  : `Optional: supply your ${selectedModelObj?.provider ?? 'provider'} key. Otherwise we use the configured project key.`}
            </AlertDescription>
          </Alert>
          <Input
            type="text"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            disabled={isRunning}
            placeholder={keyPlaceholder}
            className={cn('font-mono text-xs', requiresApiKey && !hasApiKey && 'border-amber-400')}
          />
          {requiresApiKey && !hasApiKey && (
            <p className="text-[10px] text-amber-700">
              Generate a key at{' '}
              <a className="underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                Google AI Studio
              </a>
              ,{' '}
              <a className="underline" href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                OpenAI
              </a>
              , or{' '}
              <a className="underline" href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
                OpenRouter
              </a>
              .
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            Solver Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Parallel Experts</label>
            <Select value={String(numExperts)} onValueChange={value => setNumExperts(Number(value))} disabled={isRunning}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select expert profile" />
              </SelectTrigger>
              <SelectContent>
                {EXPERT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label} - {opt.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Self-Audit Limit (Iterations)</label>
            <Input
              type="number"
              min={1}
              max={20}
              value={maxIterations}
              onChange={e => setMaxIterations(parseInt(e.target.value, 10) || 10)}
              disabled={isRunning}
              className="h-9"
            />
            <p className="text-[10px] text-muted-foreground">Maximum refinement cycles before Poetiq stops.</p>
          </div>
        </CardContent>
      </Card>

      {numExperts === 8 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs">
              <strong>Config C (8 experts)</strong> issues eight concurrent API calls. Expect 25-45+ minute runtimes and higher API usage.
            </AlertDescription>
          </div>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onStart} disabled={!canStart} className="flex-1 min-w-[150px]">
          Start Poetiq Solver
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={!isRunning} className="flex-1 min-w-[150px]">
          Cancel Run
        </Button>
      </div>

      {state.status === 'running' && (
        <p className="text-center text-xs text-muted-foreground">
          Run in progress&mdash;watch the progress dashboard for live events.
        </p>
      )}
    </div>
  );
}

