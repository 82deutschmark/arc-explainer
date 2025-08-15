/**
 * client/src/components/saturn/SaturnModelSelect.tsx
 *
 * Lightweight model selector for the Saturn Visual Solver page.
 * - Presents the latest vision-capable models (GPT-5, Claude 4, Grok 4).
 * - Controlled component: parent provides `value` and `onChange`.
 * - Uses the shared UI Select primitives for consistent styling.
 *
 * How the project uses this:
 * - Consumed by `client/src/pages/SaturnVisualSolver.tsx` to choose the model
 *   passed into the `/api/saturn/analyze/:taskId` POST.
 *
 * Author: Cascade (model: Cascade)
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type SaturnModelKey = 'GPT-5' | 'Claude 4' | 'Grok 4';

export function SaturnModelSelect({ value, onChange, disabled }: {
  value: SaturnModelKey;
  onChange: (val: SaturnModelKey) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="saturn-model" className="text-sm">Model</Label>
      <Select value={value} onValueChange={(v) => onChange(v as SaturnModelKey)} disabled={!!disabled}>
        <SelectTrigger id="saturn-model" className="w-[200px]">
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="GPT-5">GPT-5</SelectItem>
            <SelectItem value="Claude 4">Claude 4</SelectItem>
            <SelectItem value="Grok 4">Grok 4</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export default SaturnModelSelect;
