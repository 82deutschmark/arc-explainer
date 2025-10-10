/**
 * client/src/components/saturn/SaturnModelSelect.tsx
 *
 * Dynamic model selector for the Saturn Visual Solver page.
 * - Fetches all available models from the API
 * - Supports all models with reasoning capabilities
 * - Controlled component: parent provides `value` and `onChange`.
 * - Uses the shared UI Select primitives for consistent styling.
 *
 * How the project uses this:
 * - Consumed by `client/src/pages/SaturnVisualSolver.tsx` to choose the model
 *   passed into the `/api/saturn/analyze/:taskId` POST.
 *
 * Author: Cascade using Sonnet 4.5
 * Date: 2025-10-10
 * PURPOSE: Provide full model selection for Saturn solver instead of hardcoded list
 * SRP/DRY check: Pass - Single responsibility of model selection UI
 * shadcn/ui: Pass - Uses shadcn/ui Select component
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useModels } from '@/hooks/useModels';
import { Loader2 } from 'lucide-react';
import type { ModelConfig } from '@shared/types';

export function SaturnModelSelect({ value, onChange, disabled }: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const { data: models, isLoading } = useModels();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Label htmlFor="saturn-model" className="text-sm">Model</Label>
        <div className="flex items-center gap-2 px-3 py-2 border rounded">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading models...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="saturn-model" className="text-sm">Model</Label>
      <Select value={value} onValueChange={onChange} disabled={!!disabled}>
        <SelectTrigger id="saturn-model" className="w-[240px]">
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {models?.map((model: ModelConfig) => (
              <SelectItem key={model.key} value={model.key}>
                {model.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export default SaturnModelSelect;
