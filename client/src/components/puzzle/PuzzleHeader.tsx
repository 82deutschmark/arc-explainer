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
import { Hash, Eye, Rocket, RefreshCw, ExternalLink, Palette, Users, Brain } from 'lucide-react';
import { getPuzzleName } from '@shared/utils/puzzleNames';
import { getSynapsomorphyArcUrl } from '@shared/utils/synapsomorphy';
import { EMOJI_SET_INFO, type EmojiSet } from '@/lib/spaceEmojis';

interface PuzzleHeaderProps {
  taskId: string;
  source?: string;
  isRetryMode: boolean;
  showEmojis: boolean;
  onToggleEmojis: () => void;
  showColorOnly: boolean;
  onToggleColorOnly: () => void;
  isColorOnlyDisabled?: boolean;
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
  showColorOnly,
  onToggleColorOnly,
  isColorOnlyDisabled = false,
  emojiSet,
  onEmojiSetChange,
  isAnalyzing
}: PuzzleHeaderProps) {
  const puzzleName = getPuzzleName(taskId);
  const synapsomorphyUrl = getSynapsomorphyArcUrl(
    taskId,
    source && ['ARC1', 'ARC1-Eval', 'ARC2', 'ARC2-Eval'].includes(source as string)
      ? (source as 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval')
      : undefined
  );

  return (
    <div className="flex items-center justify-between mb-3 px-4 py-3 border-b border-base-300 bg-base-100">
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
      <div className="flex items-center gap-3 flex-wrap">
        {/* Emoji Toggle Button */}
        <button
          className={`btn btn-md transition-all duration-300 ${
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

        {/* Color-only toggle */}
        <button
          className={`btn btn-md transition-all duration-300 border-2 ${
            showColorOnly
              ? 'border-emerald-400/60 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
              : 'btn-outline border-slate-300 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50'
          } ${isColorOnlyDisabled ? 'btn-disabled opacity-60 cursor-not-allowed' : ''}`}
          onClick={onToggleColorOnly}
          disabled={isColorOnlyDisabled}
          title={isColorOnlyDisabled ? 'Color-only view is unavailable while emojis are enabled.' : undefined}
        >
          <Palette className={`h-4 w-4 mr-2 ${showColorOnly ? 'text-white' : 'text-emerald-600'}`} />
          <span className="font-semibold">
            {showColorOnly ? 'Show Numbers' : 'Show Colors Only'}
          </span>
        </button>

        {/* Emoji Palette Selector */}
        {showEmojis && (
          <select
            className="select select-bordered select-md w-48"
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
          <button className="btn btn-md transition-all duration-300 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 border-2 border-indigo-400/50 text-white font-semibold rounded-lg">
            <Rocket className="h-4 w-4 mr-2" />
            🪐 Saturn Solver
          </button>
        </Link>

        {/* Grover Iterative Solver Button */}
        <Link href={`/puzzle/grover/${taskId}`}>
          <button className="btn btn-md transition-all duration-300 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 shadow-lg shadow-green-500/25 border-2 border-green-400/50 text-white font-semibold rounded-lg">
            <Rocket className="h-4 w-4 mr-2" />
            🔄 Grover Solver
          </button>
        </Link>

        {/* Poetiq Code-Gen Solver Button */}
        <Link href={`/puzzle/poetiq/${taskId}`}>
          <button className="btn btn-md transition-all duration-300 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/25 border-2 border-purple-400/50 text-white font-semibold rounded-lg">
            <Rocket className="h-4 w-4 mr-2" />
            🧬 Poetiq Solver
          </button>
        </Link>

        {/* Beetree Ensemble Solver Button */}
        <Link href={`/puzzle/beetree/${taskId}`}>
          <button className="btn btn-md transition-all duration-300 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/25 border-2 border-emerald-400/50 text-white font-semibold rounded-lg">
            <Users className="h-4 w-4 mr-2" />
            🌳 Beetree Solver
          </button>
        </Link>

        {/* Human Insights Button */}
        <a
          href={`https://arc-visualizations.github.io/${taskId}.html`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-md btn-outline border-2 border-amber-400/60 hover:border-amber-500 hover:bg-amber-50 text-amber-700 font-semibold rounded-lg flex items-center"
          title="View human test participant explanations and error examples for this puzzle"
        >
          <Brain className="h-4 w-4 mr-2" />
          💡 Human Insights
        </a>

        {synapsomorphyUrl && (
          <a
            href={synapsomorphyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-md btn-outline border-2 border-sky-400/60 hover:border-sky-500 hover:bg-sky-50 text-sky-700 font-semibold rounded-lg flex items-center"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            🌐 Explore on Synapsomorphy
          </a>
        )}
      </div>
    </div>
  );
}
