/*
 * Author: Claude
 * Date: 2026-01-04
 * PURPOSE: Embedded replay viewer for ARC3 game recordings.
 *          Loads JSONL replay files and animates through frames with play/pause controls.
 * SRP/DRY check: Pass - Single responsibility for replay playback.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { getArc3Color } from '../../utils/arc3Colors';

interface ReplayFrame {
    observation: number[][][]; // 3D array: [1][height][width]
    state: string;
    score: number;
    win_score: number;
    action_input?: {
        id: number;
        data?: {
            game_id: string;
            x?: number;
            y?: number;
        };
    };
}

interface Arc3ReplayViewerProps {
    /** Path to the JSONL replay file (relative to public folder, e.g., "/replays/ft09.jsonl") */
    replayPath: string;
    /** Optional: Initial frame to start from */
    initialFrame?: number;
    /** Optional: Auto-play on load */
    autoPlay?: boolean;
    /** Optional: Playback speed in ms per frame (default: 100) */
    playbackSpeed?: number;
    /** Optional: Cell size in pixels (default: 8 for 64x64 grids) */
    cellSize?: number;
    /** Optional: Additional CSS classes */
    className?: string;
}

export const Arc3ReplayViewer: React.FC<Arc3ReplayViewerProps> = ({
    replayPath,
    initialFrame = 0,
    autoPlay = false,
    playbackSpeed = 100,
    cellSize = 8,
    className = '',
}) => {
    const [frames, setFrames] = useState<ReplayFrame[]>([]);
    const [currentFrameIndex, setCurrentFrameIndex] = useState(initialFrame);
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [speed, setSpeed] = useState(playbackSpeed);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef<number>(0);

    // Load the JSONL file
    useEffect(() => {
        const loadReplay = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(replayPath);
                if (!response.ok) {
                    throw new Error(`Failed to load replay: ${response.status}`);
                }
                const text = await response.text();
                const lines = text.trim().split('\n');
                const parsedFrames: ReplayFrame[] = lines.map(line => JSON.parse(line));
                setFrames(parsedFrames);
                setCurrentFrameIndex(0);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load replay');
            } finally {
                setIsLoading(false);
            }
        };
        loadReplay();
    }, [replayPath]);

    // Get current frame data
    const currentFrame = frames[currentFrameIndex];
    const grid = currentFrame?.observation?.[0] || [];
    const height = grid.length;
    const width = height > 0 ? grid[0].length : 0;

    // Render the grid to canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !grid.length) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas dimensions
        canvas.width = width * cellSize;
        canvas.height = height * cellSize;

        // Draw each cell
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const value = grid[y]?.[x] ?? 0;
                ctx.fillStyle = getArc3Color(value);
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }

        // Highlight click action if present
        const action = currentFrame?.action_input;
        if (action?.id === 6 && action.data?.x !== undefined && action.data?.y !== undefined) {
            const { x, y } = action.data;
            ctx.strokeStyle = '#ff8c00';
            ctx.lineWidth = 2;
            ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
    }, [currentFrameIndex, grid, cellSize, width, height, currentFrame]);

    // Animation loop
    const animate = useCallback((timestamp: number) => {
        if (!isPlaying || frames.length === 0) return;

        if (timestamp - lastFrameTimeRef.current >= speed) {
            lastFrameTimeRef.current = timestamp;
            setCurrentFrameIndex(prev => {
                if (prev >= frames.length - 1) {
                    setIsPlaying(false);
                    return prev;
                }
                return prev + 1;
            });
        }

        animationRef.current = requestAnimationFrame(animate);
    }, [isPlaying, frames.length, speed]);

    useEffect(() => {
        if (isPlaying) {
            lastFrameTimeRef.current = performance.now();
            animationRef.current = requestAnimationFrame(animate);
        } else if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying, animate]);

    // Controls
    const togglePlay = () => setIsPlaying(!isPlaying);
    const goToStart = () => { setCurrentFrameIndex(0); setIsPlaying(false); };
    const goToEnd = () => { setCurrentFrameIndex(frames.length - 1); setIsPlaying(false); };
    const stepBack = () => setCurrentFrameIndex(prev => Math.max(0, prev - 1));
    const stepForward = () => setCurrentFrameIndex(prev => Math.min(frames.length - 1, prev + 1));

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center p-8 bg-muted rounded-lg ${className}`}>
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                <span className="ml-3 text-muted-foreground">Loading replay...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`p-4 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg ${className}`}>
                <p className="font-semibold">Failed to load replay</p>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    return (
        <div className={`arc3-replay-viewer ${className}`}>
            {/* Canvas */}
            <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                <canvas
                    ref={canvasRef}
                    className="w-full h-auto"
                    style={{ imageRendering: 'pixelated' }}
                />

                {/* Score overlay */}
                {currentFrame && (
                    <div className="absolute top-2 right-2 bg-black/70 text-white px-3 py-1 rounded text-sm font-mono">
                        Score: {currentFrame.score}/{currentFrame.win_score}
                        {currentFrame.state === 'FINISHED' && ' ✓'}
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="space-y-3">
                {/* Playback buttons */}
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="icon" onClick={goToStart} title="Go to start">
                        <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={stepBack} title="Previous frame">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="default" size="icon" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={stepForward} title="Next frame">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={goToEnd} title="Go to end">
                        <SkipForward className="h-4 w-4" />
                    </Button>
                </div>

                {/* Timeline slider */}
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16 text-right">
                        {currentFrameIndex + 1} / {frames.length}
                    </span>
                    <Slider
                        value={[currentFrameIndex]}
                        onValueChange={([value]) => setCurrentFrameIndex(value)}
                        max={frames.length - 1}
                        step={1}
                        className="flex-1"
                    />
                </div>

                {/* Speed control */}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <span>Speed:</span>
                    {[50, 100, 200, 500].map(s => (
                        <Button
                            key={s}
                            variant={speed === s ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setSpeed(s)}
                            className="px-2 py-1 h-6 text-xs"
                        >
                            {s}ms
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Arc3ReplayViewer;
