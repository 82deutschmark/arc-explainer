/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Dataset + attempt-pair selection controls for the Hugging Face union-accuracy page.
 *          Contains no fetching logic (auto-fetch is handled by useAttemptUnionComparison).
 * SRP/DRY check: Pass - Presentational controls only.
 * shadcn/ui: Pass - Uses Card, Select, and Button styling patterns.
 */

import React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDatasetDisplayName } from '@/constants/datasets';

export interface AttemptPairOption {
  label: string;
  value: string;
  baseModelName: string;
  modelNames: string[];
}

export interface UnionAccuracyControlsProps {
  selectedDataset: string;
  onDatasetChange: (value: string) => void;
  selectedAttemptPair: string | null;
  onAttemptPairChange: (value: string) => void;
  attemptPairOptions: AttemptPairOption[];
  loadingModels: boolean;
  disabled: boolean;
}

export const UnionAccuracyControls: React.FC<UnionAccuracyControlsProps> = ({
  selectedDataset,
  onDatasetChange,
  selectedAttemptPair,
  onAttemptPairChange,
  attemptPairOptions,
  loadingModels,
  disabled,
}) => {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className="text-base font-semibold mb-1 block text-gray-700">Dataset:</label>
            <Select value={selectedDataset} onValueChange={onDatasetChange} disabled={disabled}>
              <SelectTrigger className="h-8 text-base">
                <SelectValue placeholder="Choose..." />
              </SelectTrigger>
              <SelectContent>
                {['evaluation2', 'evaluation', 'training2', 'training'].map((key) => (
                  <SelectItem key={key} value={key} className="text-base">
                    {getDatasetDisplayName(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <label className="text-base font-semibold mb-1 block text-gray-700">Model (Attempt 1 + 2):</label>
            <Select value={selectedAttemptPair || ''} onValueChange={onAttemptPairChange} disabled={disabled}>
              <SelectTrigger className="h-8 text-base">
                <SelectValue placeholder={loadingModels ? 'Loading...' : 'Choose...'} />
              </SelectTrigger>
              <SelectContent>
                {attemptPairOptions.length === 0 ? (
                  <SelectItem value="no-models" disabled className="text-base">
                    No models with 2+ attempts
                  </SelectItem>
                ) : (
                  attemptPairOptions.map((pair) => (
                    <SelectItem key={pair.value} value={pair.value} className="text-base">
                      {pair.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
