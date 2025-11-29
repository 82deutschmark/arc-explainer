/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-22
 * PURPOSE: Control panel for model selection with expand/collapse buttons.
 *          Provides clean UI without filtering for professional research platform.
 * SRP/DRY check: Pass - Single responsibility: model selection controls rendering.
 */

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
      <button
        onClick={onExpandAll}
        className="btn btn-sm btn-ghost border border-base-300 hover:bg-base-200 gap-1"
        title="Expand all provider sections"
      >
        <ChevronDown className="h-4 w-4" />
        Expand All
      </button>
      <button
        onClick={onCollapseAll}
        className="btn btn-sm btn-ghost border border-base-300 hover:bg-base-200 gap-1"
        title="Collapse all provider sections"
      >
        <ChevronUp className="h-4 w-4" />
        Collapse All
      </button>
    </div>
  );
}
