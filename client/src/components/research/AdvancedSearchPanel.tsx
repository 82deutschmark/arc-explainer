/**
 * AdvancedSearchPanel Component
 * Advanced search and filtering for researchers to find specific puzzle patterns and model behaviors
 * Includes filters for model discrepancies, Saturn results, dataset sources, and performance metrics
 * 
 * @author Cascade
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  RefreshCw,
  Target,
  AlertTriangle,
  TrendingUp,
  Database
} from 'lucide-react';
import { MODELS } from '@/constants/models';

interface SearchCriteria {
  // Basic filters
  puzzleId: string;
  source: string[];
  hasExplanations: boolean | null;
  hasSaturnResults: boolean | null;
  
  // Model performance filters
  modelName: string[];
  confidenceRange: [number, number];
  accuracyRange: [number, number];
  
  // Research-specific filters
  modelDiscrepancy: 'high' | 'medium' | 'low' | 'any';
  overconfidentFailures: boolean;
  highAgreementPuzzles: boolean;
  saturnSuccessOnly: boolean;
  saturnFailureOnly: boolean;
  
  // Grid properties
  maxGridSize: number | null;
  gridSizeConsistent: boolean | null;
}

interface AdvancedSearchPanelProps {
  onSearch: (criteria: SearchCriteria) => void;
  onReset: () => void;
  isLoading: boolean;
}

export function AdvancedSearchPanel({ onSearch, onReset, isLoading }: AdvancedSearchPanelProps) {
  const [criteria, setCriteria] = useState<SearchCriteria>({
    puzzleId: '',
    source: [],
    hasExplanations: null,
    hasSaturnResults: null,
    modelName: [],
    confidenceRange: [0, 100],
    accuracyRange: [0, 100],
    modelDiscrepancy: 'any',
    overconfidentFailures: false,
    highAgreementPuzzles: false,
    saturnSuccessOnly: false,
    saturnFailureOnly: false,
    maxGridSize: null,
    gridSizeConsistent: null
  });

  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    models: false,
    research: false,
    grid: false
  });

  const handleSourceChange = (source: string, checked: boolean) => {
    setCriteria(prev => ({
      ...prev,
      source: checked 
        ? [...prev.source, source]
        : prev.source.filter(s => s !== source)
    }));
  };

  const handleModelChange = (modelKey: string, checked: boolean) => {
    setCriteria(prev => ({
      ...prev,
      modelName: checked 
        ? [...prev.modelName, modelKey]
        : prev.modelName.filter(m => m !== modelKey)
    }));
  };

  const handleSearch = () => {
    onSearch(criteria);
  };

  const handleReset = () => {
    setCriteria({
      puzzleId: '',
      source: [],
      hasExplanations: null,
      hasSaturnResults: null,
      modelName: [],
      confidenceRange: [0, 100],
      accuracyRange: [0, 100],
      modelDiscrepancy: 'any',
      overconfidentFailures: false,
      highAgreementPuzzles: false,
      saturnSuccessOnly: false,
      saturnFailureOnly: false,
      maxGridSize: null,
      gridSizeConsistent: null
    });
    onReset();
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (criteria.puzzleId) count++;
    if (criteria.source.length > 0) count++;
    if (criteria.hasExplanations !== null) count++;
    if (criteria.hasSaturnResults !== null) count++;
    if (criteria.modelName.length > 0) count++;
    if (criteria.confidenceRange[0] > 0 || criteria.confidenceRange[1] < 100) count++;
    if (criteria.accuracyRange[0] > 0 || criteria.accuracyRange[1] < 100) count++;
    if (criteria.modelDiscrepancy !== 'any') count++;
    if (criteria.overconfidentFailures) count++;
    if (criteria.highAgreementPuzzles) count++;
    if (criteria.saturnSuccessOnly || criteria.saturnFailureOnly) count++;
    if (criteria.maxGridSize !== null) count++;
    if (criteria.gridSizeConsistent !== null) count++;
    return count;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Research Search
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary">{getActiveFiltersCount()} filters</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleReset} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button onClick={handleSearch} size="sm" disabled={isLoading}>
              <Search className="h-4 w-4 mr-1" />
              Search
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Filters */}
        <div>
          <Button
            variant="ghost"
            onClick={() => toggleSection('basic')}
            className="flex items-center gap-2 p-0 h-auto font-semibold text-sm"
          >
            <Database className="h-4 w-4" />
            Basic Filters
          </Button>
          
          {expandedSections.basic && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="puzzleId">Puzzle ID</Label>
                <Input
                  id="puzzleId"
                  placeholder="e.g., 007bbfb7"
                  value={criteria.puzzleId}
                  onChange={(e) => setCriteria(prev => ({ ...prev, puzzleId: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Dataset Source</Label>
                <div className="grid grid-cols-2 gap-2">
                  {['ARC1', 'ARC1-Eval', 'ARC2', 'ARC2-Eval'].map(source => (
                    <div key={source} className="flex items-center space-x-2">
                      <Checkbox
                        id={source}
                        checked={criteria.source.includes(source)}
                        onCheckedChange={(checked) => handleSourceChange(source, !!checked)}
                      />
                      <Label htmlFor={source} className="text-sm">{source}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Analysis Status</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasExplanations"
                      checked={criteria.hasExplanations === true}
                      onCheckedChange={(checked) => 
                        setCriteria(prev => ({ ...prev, hasExplanations: checked ? true : null }))
                      }
                    />
                    <Label htmlFor="hasExplanations" className="text-sm">Has AI Analysis</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasSaturnResults"
                      checked={criteria.hasSaturnResults === true}
                      onCheckedChange={(checked) => 
                        setCriteria(prev => ({ ...prev, hasSaturnResults: checked ? true : null }))
                      }
                    />
                    <Label htmlFor="hasSaturnResults" className="text-sm">🪐 Has Saturn Results</Label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Model Performance Filters */}
        <div>
          <Button
            variant="ghost"
            onClick={() => toggleSection('models')}
            className="flex items-center gap-2 p-0 h-auto font-semibold text-sm"
          >
            <TrendingUp className="h-4 w-4" />
            Model Performance
          </Button>
          
          {expandedSections.models && (
            <div className="mt-3 space-y-4">
              <div className="space-y-2">
                <Label>Specific Models</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                  {MODELS.map(model => (
                    <div key={model.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={model.key}
                        checked={criteria.modelName.includes(model.key)}
                        onCheckedChange={(checked) => handleModelChange(model.key, !!checked)}
                      />
                      <Label htmlFor={model.key} className="text-sm">
                        {model.name} ({model.provider})
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Confidence Range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      min="0"
                      max="100"
                      value={criteria.confidenceRange[0]}
                      onChange={(e) => setCriteria(prev => ({
                        ...prev,
                        confidenceRange: [parseInt(e.target.value) || 0, prev.confidenceRange[1]]
                      }))}
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      min="0"
                      max="100"
                      value={criteria.confidenceRange[1]}
                      onChange={(e) => setCriteria(prev => ({
                        ...prev,
                        confidenceRange: [prev.confidenceRange[0], parseInt(e.target.value) || 100]
                      }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Accuracy Range (%)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      min="0"
                      max="100"
                      value={criteria.accuracyRange[0]}
                      onChange={(e) => setCriteria(prev => ({
                        ...prev,
                        accuracyRange: [parseInt(e.target.value) || 0, prev.accuracyRange[1]]
                      }))}
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      min="0"
                      max="100"
                      value={criteria.accuracyRange[1]}
                      onChange={(e) => setCriteria(prev => ({
                        ...prev,
                        accuracyRange: [prev.accuracyRange[0], parseInt(e.target.value) || 100]
                      }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Research-Specific Filters */}
        <div>
          <Button
            variant="ghost"
            onClick={() => toggleSection('research')}
            className="flex items-center gap-2 p-0 h-auto font-semibold text-sm"
          >
            <AlertTriangle className="h-4 w-4" />
            Research Insights
          </Button>
          
          {expandedSections.research && (
            <div className="mt-3 space-y-4">
              <div className="space-y-2">
                <Label>Model Discrepancy Level</Label>
                <Select 
                  value={criteria.modelDiscrepancy} 
                  onValueChange={(value: any) => setCriteria(prev => ({ ...prev, modelDiscrepancy: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Level</SelectItem>
                    <SelectItem value="high">High Discrepancy (&lt;50% agreement)</SelectItem>
                    <SelectItem value="medium">Medium Discrepancy (50-80% agreement)</SelectItem>
                    <SelectItem value="low">Low Discrepancy (&gt;80% agreement)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="overconfidentFailures"
                      checked={criteria.overconfidentFailures}
                      onCheckedChange={(checked) => 
                        setCriteria(prev => ({ ...prev, overconfidentFailures: !!checked }))
                      }
                    />
                    <Label htmlFor="overconfidentFailures" className="text-sm">
                      Overconfident Failures (&gt;80% confidence, wrong)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="highAgreementPuzzles"
                      checked={criteria.highAgreementPuzzles}
                      onCheckedChange={(checked) => 
                        setCriteria(prev => ({ ...prev, highAgreementPuzzles: !!checked }))
                      }
                    />
                    <Label htmlFor="highAgreementPuzzles" className="text-sm">
                      High Model Agreement (&gt;90% agreement)
                    </Label>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="saturnSuccessOnly"
                      checked={criteria.saturnSuccessOnly}
                      onCheckedChange={(checked) => 
                        setCriteria(prev => ({ 
                          ...prev, 
                          saturnSuccessOnly: !!checked,
                          saturnFailureOnly: checked ? false : prev.saturnFailureOnly
                        }))
                      }
                    />
                    <Label htmlFor="saturnSuccessOnly" className="text-sm">🪐 Saturn Solved Only</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="saturnFailureOnly"
                      checked={criteria.saturnFailureOnly}
                      onCheckedChange={(checked) => 
                        setCriteria(prev => ({ 
                          ...prev, 
                          saturnFailureOnly: !!checked,
                          saturnSuccessOnly: checked ? false : prev.saturnSuccessOnly
                        }))
                      }
                    />
                    <Label htmlFor="saturnFailureOnly" className="text-sm">🪐 Saturn Failed Only</Label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Grid Properties */}
        <div>
          <Button
            variant="ghost"
            onClick={() => toggleSection('grid')}
            className="flex items-center gap-2 p-0 h-auto font-semibold text-sm"
          >
            <Target className="h-4 w-4" />
            Grid Properties
          </Button>
          
          {expandedSections.grid && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxGridSize">Max Grid Size</Label>
                <Input
                  id="maxGridSize"
                  type="number"
                  placeholder="e.g., 30"
                  min="1"
                  max="50"
                  value={criteria.maxGridSize || ''}
                  onChange={(e) => setCriteria(prev => ({ 
                    ...prev, 
                    maxGridSize: e.target.value ? parseInt(e.target.value) : null 
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Grid Size Consistency</Label>
                <Select 
                  value={criteria.gridSizeConsistent === null ? 'any' : criteria.gridSizeConsistent.toString()}
                  onValueChange={(value) => setCriteria(prev => ({ 
                    ...prev, 
                    gridSizeConsistent: value === 'any' ? null : value === 'true'
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="true">Consistent Sizes</SelectItem>
                    <SelectItem value="false">Variable Sizes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
