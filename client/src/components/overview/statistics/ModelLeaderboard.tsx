/**
 * ModelLeaderboard.tsx
 * A reusable component to display a ranked list of models.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Award } from 'lucide-react';
import type { ModelConfig } from '@shared/types';

interface LeaderboardItem {
  modelName: string;
  value: number;
  displayValue: string;
  secondaryText: string;
}

interface ModelLeaderboardProps {
  title: string;
  icon: React.ReactNode;
  items: LeaderboardItem[];
  models?: ModelConfig[];
  onModelClick?: (modelName: string) => void;
  colorClass: string;
  emptyState: {
    icon: React.ReactNode;
    title: string;
    message: string;
  };
}

const ModelLeaderboard: React.FC<ModelLeaderboardProps> = ({ 
  title, 
  icon, 
  items, 
  models, 
  onModelClick, 
  colorClass, 
  emptyState 
}) => {
  const getDisplayName = (modelName: string) => {
    const modelInfo = models?.find((m: ModelConfig) => m.key === modelName);
    return modelInfo ? modelInfo.name : modelName;
  };

  return (
    <div className="flex flex-col h-full">
      <h4 className={`text-sm font-semibold text-${colorClass}-700 mb-3 flex items-center gap-2`}>
        {icon}
        {title}
      </h4>
      <div className={`h-80 space-y-2 overflow-y-auto pr-1 border-r border-${colorClass}-100`}>
        {items.length > 0 ? (
          items.map((item, index) => (
            <div 
              key={item.modelName} 
              className={`p-2 rounded-lg bg-${colorClass}-50 border border-${colorClass}-100 hover:bg-${colorClass}-200 hover:shadow-md transition-all duration-200 cursor-pointer group`}
              onClick={() => onModelClick?.(item.modelName)}
              title={`Click to view detailed debug info for ${getDisplayName(item.modelName)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {index === 0 && <Award className="h-3 w-3 text-yellow-500 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium text-${colorClass}-700 truncate group-hover:text-${colorClass}-800`}>
                      {getDisplayName(item.modelName)}
                    </div>
                    <div className={`text-xs text-${colorClass}-600 group-hover:text-${colorClass}-700`}>
                      {item.secondaryText}
                    </div>
                  </div>
                </div>
                <Badge className={`text-xs bg-${colorClass}-100 text-${colorClass}-800 ml-2 flex-shrink-0`}>
                  {item.displayValue}
                </Badge>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-gray-500">
            {emptyState.icon}
            <p className="text-sm">{emptyState.title}</p>
            <p className="text-xs">{emptyState.message}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelLeaderboard;
