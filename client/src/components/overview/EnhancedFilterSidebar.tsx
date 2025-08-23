/**
 * EnhancedFilterSidebar Component
 * Modern sidebar-based filtering system with collapsible sections and enhanced UX
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { 
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  Sparkles,
  Database,
  Brain,
  Grid3x3,
  Clock,
  Calendar,
  MessageSquare,
  Zap
} from 'lucide-react';
import { MODELS } from '@/constants/models';

interface FilterSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
}

interface EnhancedFilterSidebarProps {
  // Search & basic filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // New ARC dataset filters
  selectedSources: string[];
  setSelectedSources: (sources: string[]) => void;
  
  // Grid size filters
  gridSizeRange: [number, number];
  setGridSizeRange: (range: [number, number]) => void;
  gridConsistency: string;
  setGridConsistency: (consistency: string) => void;
  
  // AI Provider filters (grouped)
  selectedProviders: string[];
  setSelectedProviders: (providers: string[]) => void;
  selectedModels: string[];
  setSelectedModels: (models: string[]) => void;
  
  // Performance filters
  confidenceRange: [number, number];
  setConfidenceRange: (range: [number, number]) => void;
  processingTimeRange: [number, number];
  setProcessingTimeRange: (range: [number, number]) => void;
  
  // Date filters
  dateFrom: string;
  setDateFrom: (date: string) => void;
  dateTo: string;
  setDateTo: (date: string) => void;
  
  // Engagement filters
  hasExplanationFilter: string;
  setHasExplanationFilter: (filter: string) => void;
  hasFeedbackFilter: string;
  setHasFeedbackFilter: (filter: string) => void;
  saturnFilter: string;
  setSaturnFilter: (filter: string) => void;
  
  // Sorting
  sortBy: string;
  setSortBy: (sort: string) => void;
  sortOrder: string;
  setSortOrder: (order: string) => void;
  
  // Actions
  onSearch: () => void;
  onClearAll: () => void;
  
  // Results info
  resultCount?: number;
  isLoading?: boolean;
}

const FILTER_SECTIONS: FilterSection[] = [
  { id: 'search', title: 'Search & Quick Filters', icon: <Search className="h-4 w-4" />, isOpen: true },
  { id: 'dataset', title: 'ARC Dataset', icon: <Database className="h-4 w-4" />, isOpen: false },
  { id: 'ai', title: 'AI Analysis', icon: <Brain className="h-4 w-4" />, isOpen: false },
  { id: 'puzzle', title: 'Puzzle Properties', icon: <Grid3x3 className="h-4 w-4" />, isOpen: false },
  { id: 'performance', title: 'Performance', icon: <Zap className="h-4 w-4" />, isOpen: false },
  { id: 'date', title: 'Date Range', icon: <Calendar className="h-4 w-4" />, isOpen: false },
  { id: 'engagement', title: 'Engagement', icon: <MessageSquare className="h-4 w-4" />, isOpen: false },
];

const ARC_SOURCES = [
  { value: 'ARC1', label: 'ARC1 (Training)', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'ARC1-Eval', label: 'ARC1 Eval', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { value: 'ARC2', label: 'ARC2 (Training)', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'ARC2-Eval', label: 'ARC2 Eval', color: 'bg-green-50 text-green-700 border-green-200' },
];

const AI_PROVIDERS = [
  { value: 'OpenAI', label: 'OpenAI', models: MODELS.filter(m => m.provider === 'OpenAI') },
  { value: 'Anthropic', label: 'Anthropic', models: MODELS.filter(m => m.provider === 'Anthropic') },
  { value: 'xAI', label: 'xAI (Grok)', models: MODELS.filter(m => m.provider === 'xAI') },
  { value: 'Gemini', label: 'Google Gemini', models: MODELS.filter(m => m.provider === 'Gemini') },
  { value: 'DeepSeek', label: 'DeepSeek', models: MODELS.filter(m => m.provider === 'DeepSeek') },
];

const QUICK_PRESETS = [
  { 
    label: 'Has AI Analysis', 
    icon: <Brain className="h-3 w-3" />,
    filters: { hasExplanationFilter: 'true' }
  },
  { 
    label: 'Saturn Solved', 
    icon: <span className="text-xs">🪐</span>,
    filters: { saturnFilter: 'solved' }
  },
  { 
    label: 'High Confidence', 
    icon: <Sparkles className="h-3 w-3" />,
    filters: { confidenceRange: [80, 100] }
  },
  { 
    label: 'Recent Analysis', 
    icon: <Clock className="h-3 w-3" />,
    filters: { sortBy: 'createdAt', sortOrder: 'desc' }
  },
];

export function EnhancedFilterSidebar(props: EnhancedFilterSidebarProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    FILTER_SECTIONS.reduce((acc, section) => ({ ...acc, [section.id]: section.isOpen }), {})
  );

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const applyPreset = (preset: typeof QUICK_PRESETS[0]) => {
    // Apply preset filters based on the preset configuration
    Object.entries(preset.filters).forEach(([key, value]) => {
      switch (key) {
        case 'hasExplanationFilter':
          props.setHasExplanationFilter(value as string);
          break;
        case 'saturnFilter':
          props.setSaturnFilter(value as string);
          break;
        case 'confidenceRange':
          props.setConfidenceRange(value as [number, number]);
          break;
        case 'sortBy':
          props.setSortBy(value as string);
          break;
        case 'sortOrder':
          props.setSortOrder(value as string);
          break;
      }
    });
    props.onSearch();
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (props.searchQuery) count++;
    if (props.selectedSources.length > 0) count++;
    if (props.selectedProviders.length > 0 || props.selectedModels.length > 0) count++;
    if (props.gridSizeRange[0] > 1 || props.gridSizeRange[1] < 30) count++;
    if (props.gridConsistency !== 'all') count++;
    if (props.confidenceRange[0] > 0 || props.confidenceRange[1] < 100) count++;
    if (props.processingTimeRange[0] > 0 || props.processingTimeRange[1] < 300000) count++;
    if (props.dateFrom || props.dateTo) count++;
    if (props.hasExplanationFilter !== 'all') count++;
    if (props.hasFeedbackFilter !== 'all') count++;
    if (props.saturnFilter !== 'all') count++;
    return count;
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-600" />
            <span className="font-semibold text-gray-900">Filters</span>
            {getActiveFilterCount() > 0 && (
              <Badge variant="secondary" className="text-xs">
                {getActiveFilterCount()} active
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onClearAll}
            className="text-gray-500 hover:text-gray-700"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        </div>
        
        {props.resultCount !== undefined && (
          <div className="text-sm text-gray-600">
            {props.isLoading ? 'Searching...' : `${props.resultCount} puzzles found`}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Search & Quick Filters Section */}
        {openSections.search && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="flex items-center gap-2 font-medium">
                  <Search className="h-4 w-4" />
                  Search
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection('search')}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search puzzles, models, descriptions..."
                    value={props.searchQuery}
                    onChange={(e) => props.setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && props.onSearch()}
                    className="flex-1"
                  />
                  <Button onClick={props.onSearch} size="sm">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                
                <div>
                  <Label className="text-xs font-medium text-gray-600 mb-2 block">Quick Presets</Label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_PRESETS.map((preset) => (
                      <Button
                        key={preset.label}
                        variant="outline"
                        size="sm"
                        onClick={() => applyPreset(preset)}
                        className="text-xs"
                      >
                        {preset.icon}
                        <span className="ml-1">{preset.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Collapsible Sections */}
        {FILTER_SECTIONS.slice(1).map((section) => (
          <Card key={section.id} className={openSections[section.id] ? '' : 'border-gray-100'}>
            <CardContent className="p-4">
              <Button
                variant="ghost"
                onClick={() => toggleSection(section.id)}
                className="w-full justify-between p-0 h-auto font-medium text-gray-900"
              >
                <div className="flex items-center gap-2">
                  {section.icon}
                  {section.title}
                </div>
                {openSections[section.id] ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>

              {openSections[section.id] && (
                <div className="mt-4 space-y-4">
                  {section.id === 'dataset' && (
                    <div className="space-y-3">
                      <Label className="text-xs font-medium text-gray-600">ARC Dataset Source</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {ARC_SOURCES.map((source) => (
                          <div
                            key={source.value}
                            className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                              props.selectedSources.includes(source.value)
                                ? source.color
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                            onClick={() => {
                              const newSources = props.selectedSources.includes(source.value)
                                ? props.selectedSources.filter(s => s !== source.value)
                                : [...props.selectedSources, source.value];
                              props.setSelectedSources(newSources);
                            }}
                          >
                            <div className="text-xs font-medium">{source.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {section.id === 'ai' && (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs font-medium text-gray-600 mb-2 block">AI Providers</Label>
                        <div className="space-y-2">
                          {AI_PROVIDERS.map((provider) => (
                            <div key={provider.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={provider.value}
                                checked={props.selectedProviders.includes(provider.value)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    props.setSelectedProviders([...props.selectedProviders, provider.value]);
                                  } else {
                                    props.setSelectedProviders(props.selectedProviders.filter(p => p !== provider.value));
                                  }
                                }}
                              />
                              <label htmlFor={provider.value} className="text-sm cursor-pointer">
                                {provider.label} ({provider.models.length} models)
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs font-medium text-gray-600 mb-2 block">Saturn Solver</Label>
                        <Select value={props.saturnFilter} onValueChange={props.setSaturnFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Saturn results" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Results</SelectItem>
                            <SelectItem value="solved">✅ Saturn Solved</SelectItem>
                            <SelectItem value="failed">❌ Saturn Failed</SelectItem>
                            <SelectItem value="attempted">🪐 Any Saturn Results</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {section.id === 'puzzle' && (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs font-medium text-gray-600 mb-2 block">
                          Grid Size Range: {props.gridSizeRange[0]}×{props.gridSizeRange[0]} to {props.gridSizeRange[1]}×{props.gridSizeRange[1]}
                        </Label>
                        <Slider
                          value={props.gridSizeRange}
                          onValueChange={props.setGridSizeRange}
                          min={1}
                          max={30}
                          step={1}
                          className="w-full"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs font-medium text-gray-600 mb-2 block">Grid Consistency</Label>
                        <Select value={props.gridConsistency} onValueChange={props.setGridConsistency}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Puzzles</SelectItem>
                            <SelectItem value="true">Consistent Grid Size</SelectItem>
                            <SelectItem value="false">Variable Grid Size</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {section.id === 'performance' && (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs font-medium text-gray-600 mb-2 block">
                          Confidence: {props.confidenceRange[0]}% - {props.confidenceRange[1]}%
                        </Label>
                        <Slider
                          value={props.confidenceRange}
                          onValueChange={props.setConfidenceRange}
                          min={0}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs font-medium text-gray-600 mb-2 block">
                          Processing Time: {props.processingTimeRange[0]}ms - {props.processingTimeRange[1] >= 300000 ? '∞' : props.processingTimeRange[1] + 'ms'}
                        </Label>
                        <Slider
                          value={props.processingTimeRange}
                          onValueChange={props.setProcessingTimeRange}
                          min={0}
                          max={300000}
                          step={1000}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}

                  {section.id === 'date' && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-medium text-gray-600">From Date</Label>
                        <Input
                          type="date"
                          value={props.dateFrom}
                          onChange={(e) => props.setDateFrom(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-600">To Date</Label>
                        <Input
                          type="date"
                          value={props.dateTo}
                          onChange={(e) => props.setDateTo(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {section.id === 'engagement' && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-medium text-gray-600">Explanation Status</Label>
                        <Select value={props.hasExplanationFilter} onValueChange={props.setHasExplanationFilter}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Puzzles</SelectItem>
                            <SelectItem value="true">Has Explanations</SelectItem>
                            <SelectItem value="false">No Explanations</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label className="text-xs font-medium text-gray-600">Feedback Status</Label>
                        <Select value={props.hasFeedbackFilter} onValueChange={props.setHasFeedbackFilter}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Puzzles</SelectItem>
                            <SelectItem value="true">Has Feedback</SelectItem>
                            <SelectItem value="false">No Feedback</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Sorting Section */}
        <Card>
          <CardContent className="p-4">
            <Label className="flex items-center gap-2 font-medium mb-3">
              <Clock className="h-4 w-4" />
              Sorting
            </Label>
            <div className="flex gap-2">
              <Select value={props.sortBy} onValueChange={props.setSortBy}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Latest Analysis</SelectItem>
                  <SelectItem value="puzzleId">Puzzle ID</SelectItem>
                  <SelectItem value="explanationCount"># Explanations</SelectItem>
                  <SelectItem value="latestConfidence">Confidence</SelectItem>
                  <SelectItem value="feedbackCount">Most Feedback</SelectItem>
                </SelectContent>
              </Select>
              <Select value={props.sortOrder} onValueChange={props.setSortOrder}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">↓ Desc</SelectItem>
                  <SelectItem value="asc">↑ Asc</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}