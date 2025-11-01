/**
 * client/src/components/grover/GroverModelSelect.tsx
 * 
 * Author: Sonnet 4.5
 * Date: 2025-10-09
 * PURPOSE: Model selector for Grover iterative solver.
 * Shows only RESPONSES API compatible models (grok-4-fast, gpt-5-nano, gpt-5-mini).
 * 
 * SRP/DRY check: Pass - Single responsibility (model selection UI)
 * shadcn/ui: Pass - Uses shadcn Select component
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type GroverModelKey = 'grover-gpt-5-nano' | 'grover-gpt-5-mini';

interface GroverModelSelectProps {
  value: GroverModelKey;
  onChange: (value: GroverModelKey) => void;
  disabled?: boolean;
}

export default function GroverModelSelect({ value, onChange, disabled }: GroverModelSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as GroverModelKey)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[180px] h-9 text-sm">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="grover-gpt-5-nano">
          Grover (GPT-5 Nano) 💰
        </SelectItem>
        <SelectItem value="grover-gpt-5-mini">
          Grover (GPT-5 Mini) ⚖️
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
