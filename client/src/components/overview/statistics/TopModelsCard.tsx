/**
 * TopModelsCard.tsx
 * Displays the top models based on accuracy, cost, and speed.
 */

import React from 'react';
import { BarChart, DollarSign, Zap, Trophy, HelpCircle } from 'lucide-react';
import ModelLeaderboard from './ModelLeaderboard';
import type { AccuracyStats, ModelConfig } from '@shared/types';

interface TopModelsCardProps {
  accuracyStats?: AccuracyStats;
  models?: ModelConfig[];
  onModelClick: (modelName: string) => void;
}

const TopModelsCard: React.FC<TopModelsCardProps> = ({ accuracyStats, models, onModelClick }) => {
  const topModelsByAccuracy = accuracyStats?.topModelsByAccuracy?.map(m => ({
    ...m,
    displayValue: `${m.value}%`,
    secondaryText: `${m.totalCorrect} / ${m.totalAttempts} correct`
  })) || [];

  const topModelsByCost = accuracyStats?.topModelsByAverageCost?.map(m => ({
    ...m,
    displayValue: `$${m.value.toFixed(4)}`,
    secondaryText: `Avg. cost over ${m.totalAttempts} runs`
  })) || [];

  const topModelsBySpeed = accuracyStats?.topModelsByAverageSpeed?.map(m => ({
    ...m,
    displayValue: `${m.value.toFixed(2)}s`,
    secondaryText: `Avg. speed over ${m.totalAttempts} runs`
  })) || [];

  return (
    <div className="card bg-base-100 shadow lg:col-span-2">
      <div className="card-body">
        <h2 className="card-title flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-500" />
          Top Model Leaderboards
        </h2>
        <div role="tablist" className="tabs tabs-lifted">
          <input type="radio" name="model_tabs" role="tab" className="tab" aria-label="Accuracy" defaultChecked />
          <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
            <ModelLeaderboard
              title="Top Models by Accuracy"
              icon={<BarChart className="h-4 w-4" />}
              items={topModelsByAccuracy}
              models={models}
              onModelClick={onModelClick}
              colorClass="green"
              emptyState={{
                icon: <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />,
                title: 'No Accuracy Data',
                message: 'Run analyses to rank models by accuracy.',
              }}
            />
          </div>
          
          <input type="radio" name="model_tabs" role="tab" className="tab" aria-label="Cost" />
          <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
            <ModelLeaderboard
              title="Top Models by Avg. Cost"
              icon={<DollarSign className="h-4 w-4" />}
              items={topModelsByCost}
              models={models}
              onModelClick={onModelClick}
              colorClass="blue"
              emptyState={{
                icon: <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />,
                title: 'No Cost Data',
                message: 'Run analyses to rank models by cost.',
              }}
            />
          </div>
          
          <input type="radio" name="model_tabs" role="tab" className="tab" aria-label="Speed" />
          <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
            <ModelLeaderboard
              title="Top Models by Avg. Speed"
              icon={<Zap className="h-4 w-4" />}
              items={topModelsBySpeed}
              models={models}
              onModelClick={onModelClick}
              colorClass="purple"
              emptyState={{
                icon: <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />,
                title: 'No Speed Data',
                message: 'Run analyses to rank models by speed.',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopModelsCard;
