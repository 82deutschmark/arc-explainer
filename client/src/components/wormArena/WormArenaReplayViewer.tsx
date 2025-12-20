/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-12-19
 * PURPOSE: Consolidated replay viewer component for Worm Arena.
 *          Handles both cartoon and console view modes with shared control bar.
 *          Eliminates duplicate WormArenaControlBar usage in parent.
 * SRP/DRY check: Pass - replay visualization only.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import WormArenaGameBoard from '@/components/WormArenaGameBoard';
import WormArenaGameBoardSVG from '@/components/WormArenaGameBoardSVG';
import WormArenaReasoning from '@/components/WormArenaReasoning';
import WormArenaConsoleMirror from '@/components/WormArenaConsoleMirror';
import { WormArenaControlBar } from '@/components/WormArenaControlBar';

export type RenderMode = 'cartoon' | 'console';

export interface WormArenaReplayViewerProps {
  /** Current frame data */
  currentFrame: any | null;
  /** Board width in cells */
  boardWidth: number;
  /** Board height in cells */
  boardHeight: number;
  /** Map of snake ID to display name */
  playerLabels: Record<string, string>;
  /** Array of frames for navigation */
  frames: any[];
  /** Current frame index */
  frameIndex: number;
  /** Set frame index callback */
  setFrameIndex: React.Dispatch<React.SetStateAction<number>>;
  /** Whether autoplay is active */
  isPlaying: boolean;
  /** Set playing state callback */
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether to show next move reasoning */
  showNextMove: boolean;
  /** Set show next move callback */
  setShowNextMove: React.Dispatch<React.SetStateAction<boolean>>;
  /** Current render mode */
  renderMode: RenderMode;
  /** Set render mode callback */
  setRenderMode: React.Dispatch<React.SetStateAction<RenderMode>>;
  /** Whether on mobile device */
  isMobile: boolean;
  /** Player A display name */
  playerAName: string;
  /** Player B display name */
  playerBName: string;
  /** Player A current score */
  playerAScore: number;
  /** Player B current score */
  playerBScore: number;
  /** Player A reasoning text for panel */
  playerAReasoningForPanel: string;
  /** Player B reasoning text for panel */
  playerBReasoningForPanel: string;
  /** Current scores by snake ID */
  currentScores: Record<string, number>;
  /** Selected match ID */
  selectedMatchId: string;
  /** Copy match ID callback */
  onCopyMatchId: () => void;
  /** Array of model slugs for stats links */
  models: string[];
}

/**
 * Consolidated replay viewer with cartoon/console toggle and playback controls.
 */
export function WormArenaReplayViewer({
  currentFrame,
  boardWidth,
  boardHeight,
  playerLabels,
  frames,
  frameIndex,
  setFrameIndex,
  isPlaying,
  setIsPlaying,
  showNextMove,
  setShowNextMove,
  renderMode,
  setRenderMode,
  isMobile,
  playerAName,
  playerBName,
  playerAScore,
  playerBScore,
  playerAReasoningForPanel,
  playerBReasoningForPanel,
  currentScores,
  selectedMatchId,
  onCopyMatchId,
  models,
}: WormArenaReplayViewerProps): React.ReactElement {
  // Shared control bar props
  const controlBarProps = {
    onFirst: () => setFrameIndex(0),
    onPrev: () => setFrameIndex((idx) => Math.max(0, idx - 1)),
    onPlayPause: () => setIsPlaying((v) => !v),
    onNext: () => setFrameIndex((idx) => Math.min(frames.length - 1, idx + 1)),
    onLast: () => setFrameIndex(Math.max(0, frames.length - 1)),
    isPlaying,
    currentRound: frames.length === 0 ? 0 : frameIndex + 1,
    totalRounds: frames.length,
    showNextMove,
    onToggleThought: setShowNextMove,
    playerALabel: playerAName,
    playerBLabel: playerBName,
    playerAScore,
    playerBScore,
    matchId: selectedMatchId,
    onCopyMatchId,
    statsModels: Array.isArray(models) ? models.slice(0, 2) : [],
  };

  return (
    <>
      {/* View mode toggle */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1 shadow-sm">
          <Button
            variant={renderMode === 'cartoon' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setRenderMode('cartoon')}
            className="text-xs px-3"
          >
            Cartoon View
          </Button>
          <Button
            variant={renderMode === 'console' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setRenderMode('console')}
            className="text-xs px-3"
          >
            Console View
          </Button>
        </div>
      </div>

      {/* Cartoon view (default) - 3 column layout with reasoning panels */}
      {renderMode === 'cartoon' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 items-stretch">
          <WormArenaReasoning
            playerName={playerAName}
            color="green"
            reasoning={playerAReasoningForPanel}
            score={playerAScore}
          />

          <div className="flex flex-col gap-4">
            {isMobile ? (
              <WormArenaGameBoardSVG
                frame={currentFrame}
                boardWidth={boardWidth}
                boardHeight={boardHeight}
              />
            ) : (
              <WormArenaGameBoard
                frame={currentFrame}
                boardWidth={boardWidth}
                boardHeight={boardHeight}
                playerLabels={playerLabels}
              />
            )}

            <WormArenaControlBar {...controlBarProps} />
          </div>

          <WormArenaReasoning
            playerName={playerBName}
            color="blue"
            reasoning={playerBReasoningForPanel}
            score={playerBScore}
          />
        </div>
      )}

      {/* Console view - raw Python terminal experience */}
      {renderMode === 'console' && (
        <div className="max-w-4xl mx-auto mb-6">
          <WormArenaConsoleMirror
            frame={currentFrame}
            boardWidth={boardWidth}
            boardHeight={boardHeight}
            currentRound={frameIndex + 1}
            maxRounds={frames.length}
            scores={currentScores}
            playerNames={playerLabels}
            isLive={false}
          />

          <div className="mt-4">
            <WormArenaControlBar {...controlBarProps} />
          </div>
        </div>
      )}
    </>
  );
}

export default WormArenaReplayViewer;
