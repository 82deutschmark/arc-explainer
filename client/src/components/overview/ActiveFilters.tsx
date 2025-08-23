/**
 * ActiveFilters Component
 * Displays active filters as removable chips for better UX
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { MODELS } from '@/constants/models';

interface ActiveFilter {
  id: string;
  label: string;
  value: any;
  onRemove: () => void;
}

interface ActiveFiltersProps {
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // ARC Sources
  selectedSources: string[];
  setSelectedSources: (sources: string[]) => void;
  
  // Grid filters
  gridSizeRange: [number, number];
  setGridSizeRange: (range: [number, number]) => void;
  gridConsistency: string;
  setGridConsistency: (consistency: string) => void;
  
  // AI filters
  selectedProviders: string[];
  setSelectedProviders: (providers: string[]) => void;
  selectedModels: string[];
  setSelectedModels: (models: string[]) => void;
  
  // Performance
  confidenceRange: [number, number];
  setConfidenceRange: (range: [number, number]) => void;
  processingTimeRange: [number, number];
  setProcessingTimeRange: (range: [number, number]) => void;
  
  // Date
  dateFrom: string;
  setDateFrom: (date: string) => void;
  dateTo: string;
  setDateTo: (date: string) => void;
  
  // Engagement
  hasExplanationFilter: string;
  setHasExplanationFilter: (filter: string) => void;
  hasFeedbackFilter: string;
  setHasFeedbackFilter: (filter: string) => void;
  saturnFilter: string;
  setSaturnFilter: (filter: string) => void;
  
  // Sorting (display only)
  sortBy: string;
  sortOrder: string;
}

const ARC_SOURCE_LABELS: Record<string, string> = {
  'ARC1': 'ARC1 Training',
  'ARC1-Eval': 'ARC1 Eval',
  'ARC2': 'ARC2 Training',
  'ARC2-Eval': 'ARC2 Eval',
};

const PROVIDER_LABELS: Record<string, string> = {
  'OpenAI': 'OpenAI',
  'Anthropic': 'Anthropic', 
  'xAI': 'xAI (Grok)',
  'Gemini': 'Google Gemini',
  'DeepSeek': 'DeepSeek',
};

export function ActiveFilters(props: ActiveFiltersProps) {
  const activeFilters: ActiveFilter[] = [];

  // Search filter
  if (props.searchQuery.trim()) {
    activeFilters.push({
      id: 'search',
      label: `Search: "${props.searchQuery}"`,
      value: props.searchQuery,
      onRemove: () => props.setSearchQuery(''),
    });
  }

  // ARC Source filters
  props.selectedSources.forEach((source) => {
    activeFilters.push({
      id: `source-${source}`,
      label: ARC_SOURCE_LABELS[source] || source,
      value: source,
      onRemove: () => props.setSelectedSources(props.selectedSources.filter(s => s !== source)),
    });
  });

  // Grid size filter
  if (props.gridSizeRange[0] > 1 || props.gridSizeRange[1] < 30) {
    activeFilters.push({
      id: 'grid-size',
      label: `Grid Size: ${props.gridSizeRange[0]}×${props.gridSizeRange[0]} to ${props.gridSizeRange[1]}×${props.gridSizeRange[1]}`,
      value: props.gridSizeRange,
      onRemove: () => props.setGridSizeRange([1, 30]),
    });
  }

  // Grid consistency filter
  if (props.gridConsistency !== 'all') {
    activeFilters.push({
      id: 'grid-consistency',
      label: `Grid: ${props.gridConsistency === 'true' ? 'Consistent' : 'Variable'}`,
      value: props.gridConsistency,
      onRemove: () => props.setGridConsistency('all'),
    });
  }

  // AI Provider filters
  props.selectedProviders.forEach((provider) => {
    activeFilters.push({
      id: `provider-${provider}`,
      label: PROVIDER_LABELS[provider] || provider,
      value: provider,
      onRemove: () => props.setSelectedProviders(props.selectedProviders.filter(p => p !== provider)),
    });
  });

  // AI Model filters
  props.selectedModels.forEach((modelKey) => {
    const model = MODELS.find(m => m.key === modelKey);
    activeFilters.push({
      id: `model-${modelKey}`,
      label: model ? `${model.name} (${model.provider})` : modelKey,
      value: modelKey,
      onRemove: () => props.setSelectedModels(props.selectedModels.filter(m => m !== modelKey)),
    });
  });

  // Confidence range filter
  if (props.confidenceRange[0] > 0 || props.confidenceRange[1] < 100) {
    activeFilters.push({
      id: 'confidence',
      label: `Confidence: ${props.confidenceRange[0]}%-${props.confidenceRange[1]}%`,
      value: props.confidenceRange,
      onRemove: () => props.setConfidenceRange([0, 100]),
    });
  }

  // Processing time filter
  if (props.processingTimeRange[0] > 0 || props.processingTimeRange[1] < 300000) {
    activeFilters.push({
      id: 'processing-time',
      label: `Processing Time: ${props.processingTimeRange[0]}ms-${props.processingTimeRange[1] >= 300000 ? '∞' : props.processingTimeRange[1] + 'ms'}`,
      value: props.processingTimeRange,
      onRemove: () => props.setProcessingTimeRange([0, 300000]),
    });
  }

  // Date filters
  if (props.dateFrom) {
    activeFilters.push({
      id: 'date-from',
      label: `From: ${new Date(props.dateFrom).toLocaleDateString()}`,
      value: props.dateFrom,
      onRemove: () => props.setDateFrom(''),
    });
  }

  if (props.dateTo) {
    activeFilters.push({
      id: 'date-to', 
      label: `To: ${new Date(props.dateTo).toLocaleDateString()}`,
      value: props.dateTo,
      onRemove: () => props.setDateTo(''),
    });
  }

  // Explanation filter
  if (props.hasExplanationFilter !== 'all') {
    activeFilters.push({
      id: 'has-explanation',
      label: props.hasExplanationFilter === 'true' ? 'Has Explanations' : 'No Explanations',
      value: props.hasExplanationFilter,
      onRemove: () => props.setHasExplanationFilter('all'),
    });
  }

  // Feedback filter
  if (props.hasFeedbackFilter !== 'all') {
    activeFilters.push({
      id: 'has-feedback',
      label: props.hasFeedbackFilter === 'true' ? 'Has Feedback' : 'No Feedback',
      value: props.hasFeedbackFilter,
      onRemove: () => props.setHasFeedbackFilter('all'),
    });
  }

  // Saturn filter
  if (props.saturnFilter !== 'all') {
    const saturnLabels: Record<string, string> = {
      'solved': '🪐 Saturn Solved',
      'failed': '🪐 Saturn Failed',
      'attempted': '🪐 Saturn Attempted',
    };
    
    activeFilters.push({
      id: 'saturn',
      label: saturnLabels[props.saturnFilter] || props.saturnFilter,
      value: props.saturnFilter,
      onRemove: () => props.setSaturnFilter('all'),
    });
  }

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-600">Active filters:</span>
        {activeFilters.map((filter) => (
          <Badge
            key={filter.id}
            variant="secondary"
            className="flex items-center gap-1 bg-blue-100 text-blue-800 hover:bg-blue-200 pr-1"
          >
            <span className="text-xs">{filter.label}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={filter.onRemove}
              className="h-4 w-4 p-0 hover:bg-blue-300 rounded-full"
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        
        {/* Sort indicator */}
        {props.sortBy !== 'createdAt' || props.sortOrder !== 'desc' ? (
          <Badge variant="outline" className="text-xs">
            Sort: {props.sortBy === 'createdAt' ? 'Latest' : 
                   props.sortBy === 'puzzleId' ? 'Puzzle ID' :
                   props.sortBy === 'explanationCount' ? '# Explanations' :
                   props.sortBy === 'latestConfidence' ? 'Confidence' :
                   props.sortBy === 'feedbackCount' ? 'Feedback' : props.sortBy} 
            {props.sortOrder === 'desc' ? ' ↓' : ' ↑'}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}