/*
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-07
 * PURPOSE: Game panel for ARC3 Agent Playground that tightly couples grid visualization,
 *          action buttons, and frame navigation in a single render cycle to fix
 *          double-click issues caused by parent-child state update lag.
 * SRP/DRY check: Pass — isolates game state visualization and manual action controls
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Gamepad2 } from 'lucide-react';
import { Arc3GridVisualization } from './Arc3GridVisualization';
import { ARC3_COLORS_HEX, ARC3_COLOR_NAMES } from '@shared/config/arc3Colors';

interface FrameData {
  frame: number[][][];
  action?: string;
  state?: string;
  score?: number;
  available_actions?: (string | number)[];
}

interface ToolEntry {
  label: string;
  content: string;
}

interface Arc3GamePanelProps {
  currentFrame: FrameData | null;
  frames: FrameData[];
  currentFrameIndex: number;
  executeManualAction: (action: string, coords?: [number, number]) => Promise<void>;
  isPendingManualAction: boolean;
  isPlaying: boolean;
  streamingMessage: string | null;
  toolEntries: ToolEntry[];
  gameGuid: string | null;
  gameId: string | null;
  error: string | null;
  setCurrentFrame: (index: number) => void;
  normalizedAvailableActions: Set<string> | null;
}

// Normalize available_actions tokens from the API
const normalizeAvailableActionName = (token: string | number | null | undefined): string | null => {
  if (token === null || token === undefined) {
    return null;
  }

  if (typeof token === 'number' && Number.isFinite(token)) {
    if (token === 0) return 'RESET';
    if (token >= 1 && token <= 7) return `ACTION${token}`;
    return null;
  }

  if (typeof token === 'string') {
    const trimmed = token.trim();
    if (!trimmed) return null;
    const upper = trimmed.toUpperCase();
    const canonical = upper.replace(/[\s_-]+/g, '');
    if (canonical === 'RESET') return 'RESET';
    if (canonical.startsWith('ACTION')) {
      const suffix = canonical.slice(6);
      if (!suffix) return null;
      const parsed = parseInt(suffix, 10);
      if (Number.isNaN(parsed)) return null;
      if (parsed === 0) return 'RESET';
      if (parsed >= 1 && parsed <= 7) return `ACTION${parsed}`;
    }
    if (/^\d+$/.test(canonical)) {
      const parsed = parseInt(canonical, 10);
      if (parsed === 0) return 'RESET';
      if (parsed >= 1 && parsed <= 7) return `ACTION${parsed}`;
    }
  }

  return null;
};

export const Arc3GamePanel: React.FC<Arc3GamePanelProps> = ({
  currentFrame,
  frames,
  currentFrameIndex,
  executeManualAction,
  isPendingManualAction,
  isPlaying,
  streamingMessage,
  toolEntries,
  gameGuid,
  gameId,
  error,
  setCurrentFrame,
  normalizedAvailableActions,
}) => {
  const [showCoordinatePicker, setShowCoordinatePicker] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [manualLayerIndex, setManualLayerIndex] = useState<number | null>(null);
  const [animatingLayerIndex, setAnimatingLayerIndex] = useState<number | null>(null);
  const animationTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const resolveFrameLayers = (frameData: FrameData | null) => {
    if (!frameData) return null;
    return frameData.frame as number[][][];
  };

  const resolvedCurrentFrame = resolveFrameLayers(currentFrame);

  // Auto-animate through layers when new frame arrives
  React.useEffect(() => {
    if (animationTimerRef.current) {
      clearInterval(animationTimerRef.current);
      animationTimerRef.current = null;
    }

    setManualLayerIndex(null);

    if (resolvedCurrentFrame && resolvedCurrentFrame.length > 1) {
      let currentLayer = 0;
      setAnimatingLayerIndex(0);

      animationTimerRef.current = setInterval(() => {
        currentLayer += 1;
        if (currentLayer >= resolvedCurrentFrame.length) {
          if (animationTimerRef.current) {
            clearInterval(animationTimerRef.current);
            animationTimerRef.current = null;
          }
          setAnimatingLayerIndex(null);
        } else {
          setAnimatingLayerIndex(currentLayer);
        }
      }, 120);
    } else {
      setAnimatingLayerIndex(null);
    }

    return () => {
      if (animationTimerRef.current) {
        clearInterval(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    };
  }, [currentFrameIndex, resolvedCurrentFrame?.length]);

  const currentLayerIndex = React.useMemo(() => {
    if (manualLayerIndex !== null && resolvedCurrentFrame && manualLayerIndex < resolvedCurrentFrame.length) {
      if (animationTimerRef.current) {
        clearInterval(animationTimerRef.current);
        animationTimerRef.current = null;
      }
      return manualLayerIndex;
    }
    if (animatingLayerIndex !== null && resolvedCurrentFrame && animatingLayerIndex < resolvedCurrentFrame.length) {
      return animatingLayerIndex;
    }
    if (resolvedCurrentFrame && resolvedCurrentFrame.length > 0) {
      return resolvedCurrentFrame.length - 1;
    }
    return 0;
  }, [manualLayerIndex, animatingLayerIndex, resolvedCurrentFrame, resolvedCurrentFrame?.length]);

  const handleActionClick = async (actionName: string) => {
    if (actionName === 'ACTION6') {
      setShowCoordinatePicker(true);
    } else {
      try {
        setActionError(null);
        await executeManualAction(actionName);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to execute action';
        setActionError(msg);
        console.error(`Failed to execute ${actionName}:`, error);
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Action Error Display */}
      {actionError && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <p className="font-semibold">Action Error:</p>
          <p className="text-[10px] mt-1">{actionError}</p>
        </div>
      )}

      {/* Action Buttons */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {['RESET', 'ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6', 'ACTION7'].map((actionName) => {
              const usedCount = toolEntries.filter(e => e.label.includes(actionName)).length;
              const isActive = isPlaying && streamingMessage?.includes(actionName);
              const displayName = actionName === 'RESET' ? 'Reset' : actionName.replace('ACTION', 'Action ');
              const isAvailable = !normalizedAvailableActions || normalizedAvailableActions.has(actionName);
              const isDisabled = !gameGuid || !gameId || !isAvailable || isPendingManualAction;

              return (
                <button
                  key={actionName}
                  onClick={() => handleActionClick(actionName)}
                  disabled={isDisabled}
                  title={
                    isPendingManualAction
                      ? 'Another action is in progress. Please wait...'
                      : !isAvailable
                      ? `${actionName} is not available in this game state`
                      : `Execute ${actionName}`
                  }
                  className={`px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold transition-all shadow-sm ${
                    isActive
                      ? 'bg-green-500 text-white animate-pulse shadow-lg'
                      : !isAvailable
                      ? 'bg-red-50 text-red-400 border border-red-200 opacity-60 cursor-not-allowed'
                      : usedCount > 0
                      ? 'bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200 cursor-pointer'
                      : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200 cursor-pointer'
                  } ${isDisabled && isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {displayName}
                  {usedCount > 0 && <span className="ml-1 text-[10px] sm:text-[11px]">×{usedCount}</span>}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Gamepad2 className="h-3.5 w-3.5" />
              Game Grid
            </CardTitle>
            {currentFrame && (
              <Badge variant={currentFrame.state === 'WIN' ? 'default' : 'outline'} className="text-[10px]">
                {currentFrame.state}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <p className="font-semibold">Error:</p>
              <pre className="text-[10px] whitespace-pre-wrap mt-1">{error}</pre>
            </div>
          )}

          {resolvedCurrentFrame ? (
            <div className="space-y-2">
              <div className="flex justify-center">
                <Arc3GridVisualization
                  key={`frame-${currentFrameIndex}-${currentLayerIndex}-${currentFrame?.score}`}
                  grid={resolvedCurrentFrame}
                  frameIndex={currentLayerIndex}
                  cellSize={20}
                  showGrid={true}
                  lastAction={currentFrame?.action}
                />
              </div>

              {/* Layer/Timestep Navigation */}
              {resolvedCurrentFrame.length > 1 && (
                <div className="space-y-0.5 p-2 bg-amber-50 border border-amber-200 rounded">
                  <label className="text-[10px] font-medium text-amber-800">
                    Timestep: {currentLayerIndex + 1} / {resolvedCurrentFrame.length}
                    <span className="ml-2 text-[9px] font-normal text-amber-600">
                      (Action created {resolvedCurrentFrame.length} intermediate states)
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={resolvedCurrentFrame.length - 1}
                    value={currentLayerIndex}
                    onChange={(e) => setManualLayerIndex(Number(e.target.value))}
                    className="w-full h-1 bg-amber-300 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}

              {/* Frame Navigation */}
              {frames.length > 1 && (
                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium">
                    Frame: {currentFrameIndex + 1} / {frames.length}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={frames.length - 1}
                    value={currentFrameIndex}
                    onChange={(e) => setCurrentFrame(Number(e.target.value))}
                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}

              {/* Color Legend - using shared arc3Colors SOT (16 colors, 0-15) */}
              <div className="grid grid-cols-4 gap-1 text-[9px] mt-2 p-2 bg-muted/30 rounded">
                {Object.entries(ARC3_COLORS_HEX).map(([value, hex]) => (
                  <div key={value} className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-sm border border-gray-300"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="text-[8px] text-muted-foreground truncate">
                      {value}: {ARC3_COLOR_NAMES[Number(value)]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-10">
              <Gamepad2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No grid loaded</p>
              <p className="text-[10px]">Select a game to start</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ACTION6 Coordinate Picker Dialog */}
      <Dialog open={showCoordinatePicker} onOpenChange={setShowCoordinatePicker}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Action 6: Select Coordinates</DialogTitle>
            <DialogDescription>
              Click on any cell in the grid to execute ACTION6 at that position
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center py-4">
            {resolvedCurrentFrame && (
              <Arc3GridVisualization
                key={`picker-frame-${currentFrameIndex}`}
                grid={resolvedCurrentFrame}
                frameIndex={Math.max(0, resolvedCurrentFrame.length - 1)}
                cellSize={20}
                showGrid={true}
                lastAction={currentFrame?.action}
                onCellClick={async (x, y) => {
                  try {
                    setActionError(null);
                    await executeManualAction('ACTION6', [x, y]);
                    setShowCoordinatePicker(false);
                  } catch (error) {
                    const msg = error instanceof Error ? error.message : 'Failed to execute ACTION6';
                    setActionError(msg);
                    console.error('Failed to execute ACTION6:', error);
                  }
                }}
              />
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCoordinatePicker(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Arc3GamePanel;
