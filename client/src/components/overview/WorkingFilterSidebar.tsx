/**
 * WorkingFilterSidebar Component  
 * Simplified sidebar that only uses backend-supported filters
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { 
  Search,
  Filter,
  RotateCcw,
  MessageSquare,
  Brain,
  BarChart3,
  Clock
} from 'lucide-react';
import { MODELS } from '@/constants/models';

interface WorkingFilterSidebarProps {
  // Only the filters that actually work with the backend
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  selectedModels: string[];
  setSelectedModels: (models: string[]) => void;
  
  confidenceRange: [number, number];
  setConfidenceRange: (range: [number, number]) => void;
  
  hasExplanationFilter: string;
  setHasExplanationFilter: (filter: string) => void;
  hasFeedbackFilter: string;
  setHasFeedbackFilter: (filter: string) => void;
  
  sortBy: string;
  setSortBy: (sort: string) => void;
  sortOrder: string;
  setSortOrder: (order: string) => void;
  
  onSearch: () => void;
  onClearAll: () => void;
  
  resultCount?: number;
  isLoading?: boolean;
}

export function WorkingFilterSidebar(props: WorkingFilterSidebarProps) {
  const getActiveFilterCount = () => {
    let count = 0;
    if (props.searchQuery) count++;
    if (props.selectedModels.length > 0) count++;
    if (props.confidenceRange[0] > 0 || props.confidenceRange[1] < 100) count++;
    if (props.hasExplanationFilter !== 'all') count++;
    if (props.hasFeedbackFilter !== 'all') count++;
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

      <div className="p-4 space-y-6">
        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <Label className="flex items-center gap-2 font-medium mb-3">
              <Search className="h-4 w-4" />
              Search Puzzle ID
            </Label>
            
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter puzzle ID (e.g. 0520fde7)..."
                  value={props.searchQuery}
                  onChange={(e) => props.setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && props.onSearch()}
                  className="flex-1"
                />
                <Button onClick={props.onSearch} size="sm">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                ⚠️ Search only works for puzzle IDs currently
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Model Filter */}
        <Card>
          <CardContent className="p-4">
            <Label className="flex items-center gap-2 font-medium mb-3">
              <Brain className="h-4 w-4" />
              AI Model Filter
            </Label>
            
            <div className="space-y-3">
              <Select 
                value={props.selectedModels.length === 1 ? props.selectedModels[0] : ''} 
                onValueChange={(value) => {
                  if (value === '') {
                    props.setSelectedModels([]);
                  } else {
                    props.setSelectedModels([value]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Models" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {MODELS.map((model) => (
                    <SelectItem key={model.key} value={model.key}>
                      {model.name} ({model.provider})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                ⚠️ Only single model filtering is supported
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Confidence Range */}
        <Card>
          <CardContent className="p-4">
            <Label className="flex items-center gap-2 font-medium mb-3">
              <BarChart3 className="h-4 w-4" />
              Confidence Range
            </Label>
            
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600 mb-2">
                  {props.confidenceRange[0]}% - {props.confidenceRange[1]}%
                </div>
                <Slider
                  value={props.confidenceRange}
                  onValueChange={props.setConfidenceRange}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Engagement Filters */}
        <Card>
          <CardContent className="p-4">
            <Label className="flex items-center gap-2 font-medium mb-3">
              <MessageSquare className="h-4 w-4" />
              Analysis & Feedback
            </Label>
            
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-2 block">
                  Explanation Status
                </Label>
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
                <Label className="text-xs font-medium text-gray-600 mb-2 block">
                  Feedback Status
                </Label>
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
          </CardContent>
        </Card>

        {/* Sorting */}
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

        {/* Disabled Features Notice */}
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="text-sm">
              <div className="font-medium text-orange-800 mb-2">
                ⚠️ Limited Filtering
              </div>
              <div className="text-orange-700 text-xs space-y-1">
                <div>• ARC dataset filtering: Not yet implemented</div>
                <div>• Grid size filtering: Not yet implemented</div>
                <div>• Provider grouping: Not yet implemented</div>
                <div>• Date range filtering: Not yet implemented</div>
                <div>• Saturn solver filtering: Not yet implemented</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}