/**
 * ExaminerConfigPanel.tsx
 *
 * @description Component for configuring model, dataset, and other parameters for batch analysis.
 * @author Cascade
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Settings, Brain } from 'lucide-react';
import type { ModelConfig } from '@shared/types';

// Props Interface
interface ExaminerConfigPanelProps {
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  dataset: string;
  setDataset: (value: string) => void;
  batchSize: number;
  setBatchSize: (value: number) => void;
  showAdvancedSettings: boolean;
  setShowAdvancedSettings: (value: boolean) => void;
  models: ModelConfig[] | null;
  modelsLoading: boolean;
  currentModel: ModelConfig | null | undefined;
  temperature: number;
  setTemperature: (value: number) => void;
  promptId: string;
  setPromptId: (value: string) => void;
  customPrompt: string;
  setCustomPrompt: (value: string) => void;
  isGPT5ReasoningModel: (modelKey: string) => boolean;
  reasoningEffort: string;
  setReasoningEffort: (value: string) => void;
  reasoningVerbosity: string;
  setReasoningVerbosity: (value: string) => void;
  reasoningSummaryType: string;
  setReasoningSummaryType: (value: string) => void;
}

const ExaminerConfigPanel: React.FC<ExaminerConfigPanelProps> = ({
  selectedModel,
  setSelectedModel,
  dataset,
  setDataset,
  batchSize,
  setBatchSize,
  showAdvancedSettings,
  setShowAdvancedSettings,
  models,
  modelsLoading,
  currentModel,
  temperature,
  setTemperature,
  promptId,
  setPromptId,
  customPrompt,
  setCustomPrompt,
  isGPT5ReasoningModel,
  reasoningEffort,
  setReasoningEffort,
  reasoningVerbosity,
  setReasoningVerbosity,
  reasoningSummaryType,
  setReasoningSummaryType,
}) => {
  // Configuration options for UI dropdowns
  const datasetOptions = [
    { value: 'ARC2-Eval', label: 'ARC2 Evaluation Set', count: '~400 puzzles' },
    { value: 'ARC2', label: 'ARC2 Training Set', count: '~800 puzzles' },
    { value: 'ARC1-Eval', label: 'ARC1 Evaluation Set', count: '~400 puzzles' },
    { value: 'ARC1', label: 'ARC1 Training Set', count: '~400 puzzles' }
  ];

  const promptOptions = [
    { value: 'solver', label: 'Solver Mode', description: 'Solve puzzles and predict outputs' },
    { value: 'explainer', label: 'Explainer Mode', description: 'Explain puzzle patterns and solutions' },
    { value: 'researcher', label: 'Researcher Mode', description: 'Deep analysis with reasoning' },
    { value: 'custom', label: 'Custom Prompt', description: 'Use your own prompt template' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Analysis Configuration
        </CardTitle>
        <p className="text-sm text-gray-600">
          Configure model settings and dataset selection for batch analysis
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="model-select">AI Model</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select a model to test" />
              </SelectTrigger>
              <SelectContent>
                {modelsLoading ? (
                  <div className="p-4 text-center text-sm text-gray-500">Loading models...</div>
                ) : (
                  <div className="p-2">
                    <div className="text-xs text-gray-500 mb-2">OpenAI Models</div>
                    {models?.filter((m: ModelConfig) => m.provider === 'OpenAI').map((model: ModelConfig) => (
                      <SelectItem key={model.key} value={model.key}>
                        <div className="flex items-center gap-2 w-full">
                          <div className={`w-3 h-3 rounded-full ${model.color}`} />
                          <span>{model.name}</span>
                          {model.premium && <Badge variant="outline" className="text-xs">Premium</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                    
                    <div className="text-xs text-gray-500 mb-2 mt-3">Anthropic Models</div>
                    {models?.filter((m: ModelConfig) => m.provider === 'Anthropic').map((model: ModelConfig) => (
                      <SelectItem key={model.key} value={model.key}>
                        <div className="flex items-center gap-2 w-full">
                          <div className={`w-3 h-3 rounded-full ${model.color}`} />
                          <span>{model.name}</span>
                          {model.premium && <Badge variant="outline" className="text-xs">Premium</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                    
                    <div className="text-xs text-gray-500 mb-2 mt-3">Other Providers</div>
                    {models?.filter((m: ModelConfig) => !['OpenAI', 'Anthropic'].includes(m.provider)).map((model: ModelConfig) => (
                      <SelectItem key={model.key} value={model.key}>
                        <div className="flex items-center gap-2 w-full">
                          <div className={`w-3 h-3 rounded-full ${model.color}`} />
                          <span>{model.name}</span>
                          <span className="text-xs text-gray-500">({model.provider})</span>
                          {model.premium && <Badge variant="outline" className="text-xs">Premium</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                )}
              </SelectContent>
            </Select>
            {currentModel && (
              <div className="text-xs text-gray-600 space-y-1">
                <div>Cost: {currentModel.cost.input} in / {currentModel.cost.output} out per M tokens</div>
                <div>Response Time: {currentModel.responseTime?.estimate || 'Unknown'}</div>
                {!currentModel.supportsTemperature && (
                  <div className="text-amber-600">⚠️ No temperature control available</div>
                )}
              </div>
            )}
          </div>

          {/* Dataset Selection */}
          <div className="space-y-2">
            <Label htmlFor="dataset-select">Dataset</Label>
            <Select value={dataset} onValueChange={setDataset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {datasetOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      <span className="text-xs text-gray-500">{option.count}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-600">
              Evaluation sets are best for performance benchmarking
            </div>
          </div>

          {/* Prompt Selection */}
          <div className="space-y-2">
            <Label htmlFor="prompt-select">Prompt Template</Label>
            <Select value={promptId} onValueChange={setPromptId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {promptOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      <span className="text-xs text-gray-500">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Batch Size */}
          <div className="space-y-2">
            <Label htmlFor="batch-size">Batch Size</Label>
            <Input
              id="batch-size"
              type="number"
              min="1"
              max="50"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value) || 10)}
              className="w-full"
            />
            <div className="text-xs text-gray-600 space-y-1">
              <div className="font-medium">Concurrent puzzles processed simultaneously</div>
              <div>• Higher values = faster completion but more API load</div>
              <div>• Lower values = slower but more stable for rate limits</div>
              <div>• Recommended: 5-15 for premium models, 3-8 for free tiers</div>
            </div>
          </div>
        </div>

        {/* Custom Prompt */}
        {promptId === 'custom' && (
          <div className="space-y-2">
            <Label htmlFor="custom-prompt">Custom Prompt</Label>
            <Textarea
              id="custom-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Enter your custom prompt template here..."
              rows={4}
              className="w-full"
            />
          </div>
        )}

        {/* Advanced Settings Toggle */}
        <div className="flex items-center space-x-2">
          <Switch
            id="advanced-settings"
            checked={showAdvancedSettings}
            onCheckedChange={setShowAdvancedSettings}
          />
          <Label htmlFor="advanced-settings">Show Advanced Settings</Label>
        </div>

        {/* Advanced Settings */}
        {showAdvancedSettings && (
          <div className="border-t pt-4 space-y-4">
            {/* Temperature Control */}
            {currentModel?.supportsTemperature && (
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature: {temperature}</Label>
                <Slider
                  id="temperature"
                  min={0.1}
                  max={2.0}
                  step={0.05}
                  value={[temperature]}
                  onValueChange={(value) => setTemperature(value[0])}
                  className="w-full"
                />
                <div className="text-xs text-gray-600">
                  Controls creativity and randomness in responses
                </div>
              </div>
            )}

            {/* GPT-5 Reasoning Parameters */}
            {isGPT5ReasoningModel(selectedModel) && (
              <div className="space-y-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h5 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  GPT-5 Reasoning Parameters
                </h5>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Effort Control */}
                  <div className="space-y-1">
                    <Label className="text-sm text-blue-700">Effort Level</Label>
                    <Select value={reasoningEffort} onValueChange={(value: any) => setReasoningEffort(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minimal">Minimal</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Verbosity Control */}
                  <div className="space-y-1">
                    <Label className="text-sm text-blue-700">Verbosity</Label>
                    <Select value={reasoningVerbosity} onValueChange={(value: any) => setReasoningVerbosity(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Summary Control */}
                  <div className="space-y-1">
                    <Label className="text-sm text-blue-700">Summary</Label>
                    <Select value={reasoningSummaryType} onValueChange={(value: any) => setReasoningSummaryType(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="detailed">Detailed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExaminerConfigPanel;
