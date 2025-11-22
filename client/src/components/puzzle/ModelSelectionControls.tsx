/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-22
 * PURPOSE: Control panel for model selection with filters and expand/collapse buttons.
 *          Provides UI for filtering by premium, reasoning, and fast models.
 * SRP/DRY check: Pass - Single responsibility: model selection controls rendering.
 */

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FilterState {
  premium: boolean;
  reasoning: boolean;
  fast: boolean;
}

interface ModelSelectionControlsProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  hasActiveFilters: boolean;
}

export function ModelSelectionControls({
  filters,
  onFilterChange,
  onExpandAll,
  onCollapseAll,
  hasActiveFilters
}: ModelSelectionControlsProps) {
  return (
    <div className="mb-4 p-3 bg-base-200 rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-base-content/70">Quick Actions:</span>
          <button
            onClick={onExpandAll}
            className="btn btn-xs btn-outline gap-1"
            title="Expand all provider sections"
          >
            <ChevronDown className="h-3 w-3" />
            Expand All
          </button>
          <button
            onClick={onCollapseAll}
            className="btn btn-xs btn-outline gap-1"
            title="Collapse all provider sections"
          >
            <ChevronUp className="h-3 w-3" />
            Collapse All
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-base-content/70">Filter:</span>

          <label className="label cursor-pointer gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={filters.premium}
              onChange={(e) => onFilterChange({ ...filters, premium: e.target.checked })}
            />
            <span className="label-text text-sm flex items-center gap-1">
              💰 Premium
            </span>
          </label>

          <label className="label cursor-pointer gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={filters.reasoning}
              onChange={(e) => onFilterChange({ ...filters, reasoning: e.target.checked })}
            />
            <span className="label-text text-sm flex items-center gap-1">
              🧠 Reasoning
            </span>
          </label>

          <label className="label cursor-pointer gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={filters.fast}
              onChange={(e) => onFilterChange({ ...filters, fast: e.target.checked })}
            />
            <span className="label-text text-sm flex items-center gap-1">
              ⚡ Fast
            </span>
          </label>

          {hasActiveFilters && (
            <button
              onClick={() => onFilterChange({ premium: false, reasoning: false, fast: false })}
              className="btn btn-xs btn-ghost"
              title="Clear all filters"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
