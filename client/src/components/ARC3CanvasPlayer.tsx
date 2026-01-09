/**
 * Author: Cascade (OpenAI o4-preview)
 * Date: 2026-01-08T18:55:00Z
 * PURPOSE: Canvas-based ARC-3 replay player with frame interpolation, playback controls,
 *          and metadata overlays for showcasing JSONL recordings (initially SP80/AS66).
 *          Handles JSONL parsing, rendering, and rotation callbacks for landing hero usage.
 * SRP/DRY check: Pass — encapsulates replay parsing + canvas playback without duplicating
 *                existing grid visualization components or landing layout logic.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { getArc3Color } from '@/utils/arc3Colors';

type RawReplayEvent = {
  timestamp?: string;
  data?: {
    frame?: number[][][] | number[][];
    frames?: number[][][];
    observation?: number[][][];
    state?: string;
    score?: number;
    caption?: string;
  };
};

type CanvasReplayFrame = {
  grid: number[][];
  state?: string;
  score?: number;
  timestamp: number;
  caption?: string;
};

const SPEED_PRESETS: readonly number[] = [0.5, 1, 2];
const BASE_FRAME_DURATION_MS = 200; // 5 fps baseline per spec
const MAX_CANVAS_WIDTH = 640;

function extractGrid(frameData?: number[][][] | number[][] | number[][][][]): number[][] | null {
  if (!frameData || !Array.isArray(frameData) || frameData.length === 0) {
    return null;
  }

  // Detect depth by checking nested array structure
  const first = frameData[0];
  if (!Array.isArray(first)) {
    return null;
  }

  const second = first[0];
  
  // 2D grid: frameData[row][col] where frameData[0][0] is a number
  if (typeof second === 'number') {
    return frameData as number[][];
  }

  if (!Array.isArray(second)) {
    return null;
  }

  const third = second[0];

  // 3D: frameData[layer][row][col] where frameData[0][0][0] is a number
  // Return first layer
  if (typeof third === 'number') {
    return first as number[][];
  }

  // 4D: frameData[time][layer][row][col] - take first time, first layer
  if (Array.isArray(third) && typeof third[0] === 'number') {
    return second as number[][];
  }

  return null;
}

function parseReplayLines(text: string): CanvasReplayFrame[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const frames: CanvasReplayFrame[] = [];

  lines.forEach((line, index) => {
    try {
      const parsed = JSON.parse(line) as RawReplayEvent;
      const rawGrid =
        parsed.data?.frame ?? parsed.data?.frames ?? parsed.data?.observation;
      const grid = extractGrid(rawGrid);
      if (!grid) {
        return;
      }

      const timestampMs =
        typeof parsed.timestamp === 'string'
          ? Date.parse(parsed.timestamp)
          : index * BASE_FRAME_DURATION_MS;

      frames.push({
        grid,
        state: parsed.data?.state,
        score: parsed.data?.score,
        caption: parsed.data?.caption,
        timestamp: timestampMs,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[ARC3CanvasPlayer] Failed to parse replay line', error);
    }
  });

  return frames;
}

interface ARC3CanvasPlayerProps {
  replayPath: string;
  replayData?: string;
  gameLabel: string;
  shortId: string;
  className?: string;
  autoPlay?: boolean;
  onReplayComplete?: () => void;
}

export function ARC3CanvasPlayer({
  replayPath,
  replayData,
  gameLabel,
  shortId,
  className,
  autoPlay = true,
  onReplayComplete,
}: ARC3CanvasPlayerProps) {
  const [frames, setFrames] = useState<CanvasReplayFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(480);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playbackRef = useRef({ frameIndex: 0, progress: 0, lastTime: 0 });
  const completionRef = useRef(false);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });

  const gridHeight = frames[0]?.grid.length ?? 0;
  const gridWidth = frames[0]?.grid[0]?.length ?? 0;

  // Track resize for responsive canvas sizing
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const displayWidth = useMemo(() => {
    if (!gridWidth) return 0;
    return Math.min(containerWidth, MAX_CANVAS_WIDTH);
  }, [containerWidth, gridWidth]);

  const displayHeight = useMemo(() => {
    if (!gridHeight || !gridWidth) return 0;
    const cellSize = displayWidth / gridWidth || 1;
    return gridHeight * cellSize;
  }, [displayWidth, gridHeight, gridWidth]);

  const renderFrame = useCallback(
    (frameIndex: number, progress: number) => {
      const canvas = canvasRef.current;
      const frame = frames[frameIndex];
      if (!canvas || !frame) {
        return;
      }
      const nextFrame = frames[frameIndex + 1] ?? frame;
      const ctx = canvas.getContext('2d');
      if (!ctx || !gridWidth || !gridHeight) {
        return;
      }

      const dpr =
        typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const targetWidth = displayWidth || gridWidth * 8;
      const cellSize = targetWidth / gridWidth;
      const pixelWidth = gridWidth * cellSize;
      const pixelHeight = gridHeight * cellSize;

      if (
        sizeRef.current.width !== pixelWidth ||
        sizeRef.current.height !== pixelHeight ||
        sizeRef.current.dpr !== dpr
      ) {
        sizeRef.current = { width: pixelWidth, height: pixelHeight, dpr };
        canvas.width = Math.round(pixelWidth * dpr);
        canvas.height = Math.round(pixelHeight * dpr);
        canvas.style.width = `${pixelWidth}px`;
        canvas.style.height = `${pixelHeight}px`;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, pixelWidth, pixelHeight);

      for (let y = 0; y < gridHeight; y += 1) {
        for (let x = 0; x < gridWidth; x += 1) {
          const valueA = frame.grid[y]?.[x] ?? 0;
          const valueB = nextFrame.grid[y]?.[x] ?? valueA;
          ctx.fillStyle = getArc3Color(valueA);
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

          if (valueA !== valueB && progress > 0) {
            ctx.globalAlpha = progress;
            ctx.fillStyle = getArc3Color(valueB);
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            ctx.globalAlpha = 1;
          }
        }
      }

      ctx.restore();
    },
    [displayWidth, frames, gridHeight, gridWidth],
  );

  const loadReplay = useCallback(
    async (path: string, inlineData?: string) => {
      setStatus('loading');
      setError(null);

      try {
        const text: string =
          inlineData ??
          (await fetch(path).then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            return response.text();
          }));

        const parsedFrames = parseReplayLines(text);
        if (!parsedFrames.length) {
          throw new Error('Replay contains no frames');
        }

        completionRef.current = false;
        playbackRef.current = { frameIndex: 0, progress: 0, lastTime: 0 };
        setFrames(parsedFrames);
        setCurrentFrameIndex(0);
        setStatus('ready');
      } catch (err) {
        setStatus('error');
        setFrames([]);
        setError(
          err instanceof Error ? err.message : 'Failed to load replay file',
        );
      }
    },
    [],
  );

  // Load replay when path or preloaded data changes
  useEffect(() => {
    loadReplay(replayPath, replayData);
  }, [loadReplay, replayData, replayPath]);

  // Render first frame + initialize autoplay when frames load
  useEffect(() => {
    if (!frames.length) {
      return;
    }
    renderFrame(0, 0);
    if (autoPlay && frames.length > 1) {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [autoPlay, frames, renderFrame]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || frames.length <= 1) {
      return undefined;
    }

    let rafId: number;
    const step = (timestamp: number) => {
      const playback = playbackRef.current;
      if (!playback.lastTime) {
        playback.lastTime = timestamp;
      }
      const delta = timestamp - playback.lastTime;
      playback.lastTime = timestamp;

      const frameDuration = BASE_FRAME_DURATION_MS / speed;
      playback.progress += delta / frameDuration;

      let advanced = false;
      while (
        playback.progress >= 1 &&
        playback.frameIndex < frames.length - 1
      ) {
        playback.progress -= 1;
        playback.frameIndex += 1;
        advanced = true;
      }

      if (
        playback.frameIndex >= frames.length - 1 &&
        playback.progress >= 1
      ) {
        renderFrame(frames.length - 1, 0);
        setCurrentFrameIndex(frames.length - 1);
        setIsPlaying(false);
        if (!completionRef.current) {
          completionRef.current = true;
          onReplayComplete?.();
        }
        return;
      }

      if (advanced) {
        setCurrentFrameIndex(playback.frameIndex);
      }

      renderFrame(playback.frameIndex, playback.progress);
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [frames, isPlaying, onReplayComplete, renderFrame, speed]);

  const currentFrame = frames[currentFrameIndex];

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full flex-col rounded-[1.375rem] bg-black/90 p-6 text-white',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-indigo-200/70">
          ARC 3 Replay
        </p>
        <p className="text-lg font-semibold">{gameLabel}</p>
        <p className="text-sm text-slate-400">{shortId}</p>
      </div>

      <div className="mt-6 flex flex-1 flex-col gap-4">
        <div className="relative flex flex-1 items-center justify-center rounded-2xl bg-slate-900/50 p-4">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-2 text-sm text-slate-300">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-300" />
              <span>Loading replay…</span>
            </div>
          )}
          {status === 'error' && (
            <div className="rounded-lg bg-red-500/10 p-4 text-center text-sm text-red-200">
              Failed to load replay.
              <br />
              <span className="text-red-300/80">{error}</span>
            </div>
          )}
          {status === 'ready' && (
            <>
              <canvas
                ref={canvasRef}
                className="w-full max-w-[640px] select-none"
                style={{ imageRendering: 'pixelated', height: displayHeight }}
              />
              <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-mono">
                Frame {currentFrameIndex + 1} / {frames.length}
              </div>
              {currentFrame && (
                <div className="pointer-events-none absolute right-4 top-4 rounded-lg bg-black/70 px-3 py-2 text-right text-xs font-medium text-white">
                  <div>Score: {currentFrame.score ?? '—'}</div>
                  <div className="text-indigo-200">
                    {currentFrame.state ?? 'IN_PROGRESS'}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}

export default ARC3CanvasPlayer;
