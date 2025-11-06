/*
Author: Claude (Windsurf Cascade)
Date: 2025-11-06
PURPOSE: Legend component showing all ARC-AGI-3 colors and their meanings.
SRP/DRY check: Pass — isolates color legend display from grid rendering logic.
*/

import React from 'react';
import { ARC3_COLORS, ARC3_COLOR_NAMES, getContrastColor } from '../../utils/arc3Colors';

interface Arc3GridLegendProps {
  title?: string;
  showValues?: boolean;
  showNames?: boolean;
  compact?: boolean;
  className?: string;
}

export const Arc3GridLegend: React.FC<Arc3GridLegendProps> = ({
  title = 'ARC-AGI-3 Color Palette',
  showValues = true,
  showNames = true,
  compact = false,
  className = '',
}) => {
  const colorEntries = Object.entries(ARC3_COLORS).map(([value, color]) => ({
    value: parseInt(value),
    color,
    name: ARC3_COLOR_NAMES[parseInt(value)],
  }));

  const gridCols = compact ? 4 : 8;
  
  return (
    <div className={`arc3-grid-legend ${className}`}>
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <div 
        className={`grid gap-2 ${compact ? 'grid-cols-4' : 'grid-cols-8'}`}
        style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
      >
        {colorEntries.map(({ value, color, name }) => (
          <div
            key={value}
            className="flex items-center gap-2 p-2 border rounded bg-white hover:bg-gray-50 transition-colors"
            title={`${name} (${value})`}
          >
            <div
              className="w-6 h-6 border border-gray-300 rounded flex items-center justify-center text-xs font-mono"
              style={{ 
                backgroundColor: color,
                color: getContrastColor(color),
              }}
            >
              {compact ? '' : value}
            </div>
            <div className="text-xs">
              {showValues && (
                <span className="font-mono font-semibold">{value}</span>
              )}
              {showValues && showNames && <br />}
              {showNames && (
                <span className="text-gray-600">{name}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-3 text-xs text-gray-500">
        <p>Colors represent different elements in ARC-AGI-3 games:</p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>0-5: Grayscale (white to black)</li>
          <li>6-15: Colors for game objects, players, walls, etc.</li>
          <li>Meaning varies by game - experiment to learn!</li>
        </ul>
      </div>
    </div>
  );
};

export default Arc3GridLegend;
