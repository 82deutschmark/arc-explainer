/**
 * ProgressDisplay.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-27
 * PURPOSE: Reusable progress bar component for RE-ARC operations.
 *          Displays current/total counts and a visual progress bar.
 * SRP/DRY check: Pass - Single responsibility: display progress UI
 *
 * Guidelines for writing copy in client/src/pages/ReArc.tsx
 */

import { Progress } from '@/components/ui/progress';

interface ProgressDisplayProps {
  label: string;
  current: number;
  total: number;
  formatValue?: (value: number) => string;
}

export function ProgressDisplay({ label, current, total, formatValue }: ProgressDisplayProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const displayCurrent = formatValue ? formatValue(current) : current;
  const displayTotal = formatValue ? formatValue(total) : total;

  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span>{label}</span>
        <span>
          {displayCurrent} / {displayTotal}
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}
