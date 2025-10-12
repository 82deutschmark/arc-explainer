/**
 * PuzzleHeader.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12
 * PURPOSE: Displays puzzle title, source badges, and action buttons (emoji toggle, solver links).
 * Extracted from PuzzleExaminer lines 238-324 to follow SRP.
 * 
 * SRP/DRY check: Pass - Single responsibility (header display and controls)
 * DaisyUI: Pass - Uses DaisyUI badge, btn, and select components
 */

import React from 'react';
import { Link } from 'wouter';
import { Hash, Eye, Rocket, RefreshCw } from 'lucide-react';
import { getPuzzleName } from '@shared/utils/puzzleNames';
import { EMOJI_SET_INFO, type EmojiSet } from '@/lib/spaceEmojis';

interface PuzzleHeaderProps {
  taskId: string;
  source?: string;
  isRetryMode: boolean;
  showEmojis: boolean;
  onToggleEmojis: () => void;
  emojiSet: EmojiSet;
  onEmojiSetChange: (set: EmojiSet) => void;
  isAnalyzing: boolean;
}

/**
 * Renders the puzzle page header with title, badges, and controls
 */
export function PuzzleHeader({
  taskId,
  source,
  isRetryMode,
  showEmojis,
  onToggleEmojis,
  emojiSet,
  onEmojiSetChange,
  isAnalyzing
}: PuzzleHeaderProps) {
  const puzzleName = getPuzzleName(taskId);

  return (
    <div className="flex items-center justify-between mb-1">
      {/* Title and Badges */}
      <div>
        <h1 className="text-xl font-bold">
          Puzzle {puzzleName ? `${taskId} - ${puzzleName}` : taskId}
          {source && (
            <div
              className={`badge badge-lg ml-2 ${
                source === 'ARC1'
                  ? 'bg-blue-50 text-blue-700'
                  : source === 'ARC1-Eval'
                    ? 'bg-cyan-50 text-cyan-700 font-semibold'
                    : source === 'ARC2'
                      ? 'bg-purple-50 text-purple-700'
                      : source === 'ARC2-Eval'
                        ? 'bg-green-50 text-green-700 font-bold'
                        : 'bg-gray-50 text-gray-700'
              }`}
            >
              {source}
            </div>
          )}
          {isRetryMode && (
            <div className="badge badge-lg ml-2 bg-orange-50 text-orange-700 border-orange-200">
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry Mode
            </div>
          )}
        </h1>
        <p className="text-sm opacity-60">
          {isRetryMode ? 'Enhanced Analysis - Previous attempt was incorrect' : 'ARC Task Examiner'}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Emoji Toggle Button */}
        <button
          className={`btn btn-sm transition-all duration-300 ${
            showEmojis
              ? 'animate-slow-pulse bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/25 border-2 border-purple-400/50 text-white'
              : 'btn-outline animate-slow-pulse border-2 border-amber-400/50 hover:border-amber-500 hover:bg-amber-50 hover:text-amber-800 shadow-lg shadow-amber-500/25'
          }`}
          onClick={onToggleEmojis}
        >
          {showEmojis ? (
            <Hash className="h-4 w-4 mr-2 animate-slow-bounce text-white" />
          ) : (
            <Eye className="h-4 w-4 mr-2 animate-slow-bounce text-amber-600" />
          )}
          <span className={showEmojis ? 'text-white font-semibold' : 'text-amber-700 font-semibold'}>
            {showEmojis ? '🔢 Show Numbers' : '🛸 Show Emojis'}
          </span>
        </button>

        {/* Emoji Palette Selector */}
        {showEmojis && (
          <select
            className="select select-bordered select-sm w-40"
            value={emojiSet}
            onChange={(e) => onEmojiSetChange(e.target.value as EmojiSet)}
            disabled={isAnalyzing}
            title={EMOJI_SET_INFO[emojiSet]?.description}
          >
            <optgroup label="Emoji Palettes">
              {Object.entries(EMOJI_SET_INFO).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.name}
                </option>
              ))}
            </optgroup>
          </select>
        )}

        {/* Saturn Visual Solver Button */}
        <Link href={`/puzzle/saturn/${taskId}`}>
          <button className="btn btn-sm transition-all duration-300 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 border-2 border-indigo-400/50 text-white font-semibold">
            <Rocket className="h-4 w-4 mr-2" />
            🪐 Saturn Solver
          </button>
        </Link>

        {/* Grover Iterative Solver Button */}
        <Link href={`/puzzle/grover/${taskId}`}>
          <button className="btn btn-sm transition-all duration-300 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 shadow-lg shadow-green-500/25 border-2 border-green-400/50 text-white font-semibold">
            <Rocket className="h-4 w-4 mr-2" />
            🔄 Grover Solver
          </button>
        </Link>
      </div>
    </div>
  );
}
