/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-09
 * PURPOSE: Display worm reasoning/thoughts in a readable format inspired by Greg's approach.
 *          Shows thoughts as structured lines rather than one big block.
 *          Supports toggling between current and next move reasoning.
 * SRP/DRY check: Pass — single responsibility for reasoning display.
 */

import React from 'react';

interface WormArenaReasoningProps {
  playerName: string;
  color: 'red' | 'gold';
  reasoning: string;
  currentRound: number;
  totalRounds: number;
  showNextMove?: boolean;
}

export default function WormArenaReasoning({
  playerName,
  color,
  reasoning,
  currentRound,
  totalRounds,
  showNextMove = false,
}: WormArenaReasoningProps) {
  // Parse reasoning into lines
  const reasoningLines = React.useMemo(() => {
    if (!reasoning) return [];
    return reasoning
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [reasoning]);

  const accentColor = color === 'red' ? '#d84949' : '#e8a11a';
  const backgroundColor = color === 'red' ? '#fde7e7' : '#fef3e5';

  return (
    <div
      className="rounded-lg border p-6 overflow-auto flex flex-col"
      style={{
        backgroundColor,
        borderColor: accentColor,
        minHeight: '500px',
        maxHeight: '500px',
      }}
    >
      {/* Header with player name and move label */}
      <div className="mb-4 pb-4 border-b" style={{ borderColor: accentColor }}>
        <h3 className="text-lg font-bold flex items-center gap-2 mb-2" style={{ color: accentColor }}>
          🪱 {playerName}
        </h3>
        <div className="text-xs font-medium" style={{ color: accentColor, opacity: 0.8 }}>
          {showNextMove ? 'Next Move Strategy' : 'Current Move'}
        </div>
      </div>

      {/* Reasoning Content */}
      <div className="flex-1 overflow-auto">
        {reasoningLines.length === 0 ? (
          <div className="text-sm italic" style={{ color: accentColor, opacity: 0.6 }}>
            No reasoning available for this round.
          </div>
        ) : (
          <div className="space-y-3">
            {reasoningLines.map((line, idx) => (
              <div
                key={idx}
                className="text-sm leading-relaxed"
                style={{
                  color: '#2d2416',
                  fontSize: '15px',
                  lineHeight: '1.7',
                }}
              >
                {/* Add bullet point for visual separation */}
                <span style={{ color: accentColor, fontWeight: 'bold', marginRight: '8px' }}>•</span>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with round info */}
      <div className="mt-4 pt-4 border-t text-xs text-right" style={{ borderColor: accentColor, color: accentColor }}>
        Round {currentRound} / {totalRounds}
      </div>
    </div>
  );
}
