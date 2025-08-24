/**
 * SearchFilters Component
 * Handles search and filtering controls for the puzzle overview
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Filter, 
  Search, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MessageSquare
} from 'lucide-react';
import { MODELS } from '@/constants/models';

interface SearchFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  hasExplanationFilter: string;
  setHasExplanationFilter: (filter: string) => void;
  hasFeedbackFilter: string;
  setHasFeedbackFilter: (filter: string) => void;
  modelFilter: string;
  setModelFilter: (filter: string) => void;
  saturnFilter: string;
  setSaturnFilter: (filter: string) => void;
  sourceFilter: string;
  setSourceFilter: (filter: string) => void;
  confidenceMin: string;
  setConfidenceMin: (min: string) => void;
  confidenceMax: string;
  setConfidenceMax: (max: string) => void;
  sortBy: string;
  sortOrder: string;
  onSearch: () => void;
  onSortChange: (sortBy: string) => void;
  getSortIcon: (field: string) => JSX.Element;
}

export function SearchFilters({
  searchQuery,
  setSearchQuery,
  hasExplanationFilter,
  setHasExplanationFilter,
  hasFeedbackFilter,
  setHasFeedbackFilter,
  modelFilter,
  setModelFilter,
  saturnFilter,
  setSaturnFilter,
  sourceFilter,
  setSourceFilter,
  confidenceMin,
  setConfidenceMin,
  confidenceMax,
  setConfidenceMax,
  sortBy,
  sortOrder,
  onSearch,
  onSortChange,
  getSortIcon
}: SearchFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Search & Filter
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search">Search Puzzle ID</Label>
            <div className="flex gap-2">
              <Input
                id="search"
                placeholder="Enter puzzle ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              />
              <Button onClick={onSearch} size="sm">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Explanation Filter */}
          <div className="space-y-2">
            <Label htmlFor="hasExplanation">Explanation Status</Label>
            <Select value={hasExplanationFilter} onValueChange={setHasExplanationFilter}>
              <SelectTrigger id="hasExplanation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Puzzles</SelectItem>
                <SelectItem value="true">Has Explanations</SelectItem>
                <SelectItem value="false">No Explanations</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Feedback Filter */}
          <div className="space-y-2">
            <Label htmlFor="hasFeedback">Feedback Status</Label>
            <Select value={hasFeedbackFilter} onValueChange={setHasFeedbackFilter}>
              <SelectTrigger id="hasFeedback">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Puzzles</SelectItem>
                <SelectItem value="true">Has Feedback</SelectItem>
                <SelectItem value="false">No Feedback</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ARC Source Filter */}
          <div className="space-y-2">
            <Label htmlFor="sourceFilter">ARC Dataset</Label>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger id="sourceFilter">
                <SelectValue placeholder="All datasets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Datasets</SelectItem>
                <SelectItem value="ARC1">ARC1 Training</SelectItem>
                <SelectItem value="ARC1-Eval">ARC1 Evaluation</SelectItem>
                <SelectItem value="ARC2">ARC2 Training</SelectItem>
                <SelectItem value="ARC2-Eval">ARC2 Evaluation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Analysis Type Filter - Mutually Exclusive */}
          <div className="space-y-2">
            <Label htmlFor="analysisType">Analysis Type</Label>
            <Select 
              value={saturnFilter !== 'all' ? saturnFilter : (modelFilter !== 'all' ? modelFilter : 'all')} 
              onValueChange={(value) => {
                if (['solved', 'failed', 'attempted'].includes(value)) {
                  setSaturnFilter(value);
                  setModelFilter('all');
                } else if (value === 'all') {
                  setSaturnFilter('all');
                  setModelFilter('all');
                } else {
                  setModelFilter(value);
                  setSaturnFilter('all');
                }
              }}
            >
              <SelectTrigger id="analysisType">
                <SelectValue placeholder="All analysis types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                
                {/* Saturn Options */}
                <div className="px-2 py-1 text-xs font-semibold text-purple-600 bg-purple-50 border-b">
                  🪐 Saturn Solver
                </div>
                <SelectItem value="solved">✅ Saturn Solved</SelectItem>
                <SelectItem value="failed">❌ Saturn Failed</SelectItem>
                <SelectItem value="attempted">🪐 Any Saturn Results</SelectItem>
                
                {/* AI Model Options */}
                <div className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 border-b border-t">
                  🧠 AI Models
                </div>
                {MODELS.map((model) => (
                  <SelectItem key={model.key} value={model.key}>
                    {model.name} ({model.provider})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Confidence Range */}
          <div className="space-y-2">
            <Label htmlFor="confidenceMin">Confidence Range</Label>
            <div className="flex gap-2">
              <Input
                id="confidenceMin"
                placeholder="Min"
                type="number"
                min="0"
                max="100"
                value={confidenceMin}
                onChange={(e) => setConfidenceMin(e.target.value)}
              />
              <Input
                id="confidenceMax"
                placeholder="Max"
                type="number"
                min="0"
                max="100"
                value={confidenceMax}
                onChange={(e) => setConfidenceMax(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <Label className="self-center">Sort by:</Label>
          <Button
            variant={sortBy === 'puzzleId' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSortChange('puzzleId')}
            className="flex items-center gap-1"
          >
            Puzzle ID {getSortIcon('puzzleId')}
          </Button>
          <Button
            variant={sortBy === 'createdAt' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSortChange('createdAt')}
            className="flex items-center gap-1"
          >
            Latest Analysis {getSortIcon('createdAt')}
          </Button>
          <Button
            variant={sortBy === 'explanationCount' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSortChange('explanationCount')}
            className="flex items-center gap-1"
          >
            # Explanations {getSortIcon('explanationCount')}
          </Button>
          <Button
            variant={sortBy === 'latestConfidence' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSortChange('latestConfidence')}
            className="flex items-center gap-1"
          >
            Confidence {getSortIcon('latestConfidence')}
          </Button>
          <Button
            variant={sortBy === 'feedbackCount' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSortChange('feedbackCount')}
            className="flex items-center gap-1"
          >
            <MessageSquare className="h-3 w-3" />
            Most Feedback {getSortIcon('feedbackCount')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}