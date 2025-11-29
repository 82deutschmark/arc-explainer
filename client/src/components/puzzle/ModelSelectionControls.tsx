/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-22
 * PURPOSE: Control panel for model selection with expand/collapse buttons.
 *          Provides clean UI without filtering for professional research platform.
 * SRP/DRY check: Pass - Single responsibility: model selection controls rendering.
 */

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModelSelectionControlsProps {
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function ModelSelectionControls({
  onExpandAll,
  onCollapseAll
}: ModelSelectionControlsProps) {
  return (
    <div className="mb-3 flex justify-end gap-2 px-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onExpandAll}
        title="Expand all provider sections"
        className="gap-1"
      >
        <ChevronDown className="h-4 w-4" />
        Expand All
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onCollapseAll}
        title="Collapse all provider sections"
        className="gap-1"
      >
        <ChevronUp className="h-4 w-4" />
        Collapse All
      </Button>
    </div>
  );
}
