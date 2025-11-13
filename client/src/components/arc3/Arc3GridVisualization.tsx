/*
Author: Claude (Windsurf Cascade)
Date: 2025-11-06
PURPOSE: Canvas-based grid renderer for ARC-AGI-3 games, displaying 0-15 integer cells with proper colors.
SRP/DRY check: Pass — encapsulates grid rendering logic separate from game state management.
*/

import React, { useEffect, useRef, useState } from 'react';
import { getArc3Color, getContrastColor, getColorDistribution, type Arc3ColorEntry } from '../../utils/arc3Colors';

interface Arc3GridVisualizationProps {
  grid: number[][][]; // 3D array: [time][height][width]
  frameIndex?: number;
  cellSize?: number;
  showCoordinates?: boolean;
  showGrid?: boolean;
  className?: string;
  onCellClick?: (x: number, y: number, value: number) => void;
  lastAction?: {
    type: string;
    coordinates?: [number, number];
  };
}

interface FrameData {
  frame: number[][];
  score: number;
  state: string;
  action_counter: number;
  max_actions: number;
  full_reset: boolean;
}

export const Arc3GridVisualization: React.FC<Arc3GridVisualizationProps> = ({
  grid,
  frameIndex = 0,
  cellSize = 20,
  showCoordinates = false,
  showGrid = true,
  className = '',
  onCellClick,
  lastAction,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number; value: number } | null>(null);
  const [colorDistribution, setColorDistribution] = useState<Arc3ColorEntry[]>([]);
  const [canvasScale, setCanvasScale] = useState({ x: 1, y: 1 });

  // Get the current frame to display
  const currentFrame = grid[frameIndex] || grid[0] || [];
  const height = currentFrame.length;
  const width = height > 0 ? currentFrame[0].length : 0;

  // Create a stable signature for the grid data to track changes
  const gridSignature = React.useMemo(() => {
    return `${grid?.length || 0}-${frameIndex}-${height}-${width}-${currentFrame?.[0]?.[0]?.[0] || 0}`;
  }, [grid?.length, frameIndex, height, width, currentFrame]);

  // Debug logging for grid updates
  console.log('[Arc3GridVisualization] Render:', {
    gridLayers: grid?.length || 0,
    frameIndex,
    currentFrameSize: `${height}x${width}`,
    lastAction: lastAction?.type,
    gridSignature,
  });

  // Calculate canvas dimensions
  const canvasWidth = width * cellSize;
  const canvasHeight = height * cellSize;

  const scaledCellWidth = cellSize * canvasScale.x;
  const scaledCellHeight = cellSize * canvasScale.y;

  // Update color distribution when grid changes
  useEffect(() => {
    if (currentFrame.length > 0) {
      setColorDistribution(getColorDistribution(currentFrame));
    }
  }, [currentFrame]);

  useEffect(() => {
    const computeScale = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const clientWidth = canvas.clientWidth || canvasWidth || 1;
      const clientHeight = canvas.clientHeight || canvasHeight || 1;

      setCanvasScale({
        x: canvasWidth > 0 ? clientWidth / canvasWidth : 1,
        y: canvasHeight > 0 ? clientHeight / canvasHeight : 1,
      });
    };

    computeScale();

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => computeScale());
      observer.observe(canvas);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', computeScale);
    return () => window.removeEventListener('resize', computeScale);
  }, [canvasWidth, canvasHeight]);

  // Draw the grid on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw grid cells
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = currentFrame[y]?.[x] ?? 0;
        const color = getArc3Color(value);
        
        // Fill cell
        ctx.fillStyle = color;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        
        // Draw grid lines
        if (showGrid) {
          ctx.strokeStyle = '#cccccc';
          ctx.lineWidth = 1;
          ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
        
        // Draw coordinates
        if (showCoordinates && cellSize >= 30) {
          ctx.fillStyle = getContrastColor(color);
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${x},${y}`, x * cellSize + cellSize / 2, y * cellSize + cellSize / 2);
        }
      }
    }
  }, [gridSignature, currentFrame, cellSize, showGrid, showCoordinates, canvasWidth, canvasHeight, height, width]);

  // Handle mouse move for hover effects
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const displayCellWidth = width > 0 ? (canvas.clientWidth || canvasWidth || cellSize) / width : cellSize;
    const displayCellHeight = height > 0 ? (canvas.clientHeight || canvasHeight || cellSize) / height : cellSize;

    const x = Math.floor((e.clientX - rect.left) / displayCellWidth);
    const y = Math.floor((e.clientY - rect.top) / displayCellHeight);
    
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const value = currentFrame[y]?.[x] ?? 0;
      setHoveredCell({ x, y, value });
    } else {
      setHoveredCell(null);
    }
  };

  // Handle mouse click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onCellClick) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Use the same calculation as handleMouseMove for consistency
    const displayCellWidth = width > 0 ? (canvas.clientWidth || canvasWidth || cellSize) / width : cellSize;
    const displayCellHeight = height > 0 ? (canvas.clientHeight || canvasHeight || cellSize) / height : cellSize;

    const x = Math.floor((e.clientX - rect.left) / displayCellWidth);
    const y = Math.floor((e.clientY - rect.top) / displayCellHeight);

    if (x >= 0 && x < width && y >= 0 && y < height) {
      const value = currentFrame[y]?.[x] ?? 0;
      onCellClick(x, y, value);
    }
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
  };

  return (
    <div className={`arc3-grid-visualization ${className}`}>
      <div className="relative inline-block max-w-full">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="border border-gray-300 cursor-crosshair max-w-full h-auto"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleCanvasClick}
        />
        
        {/* Hover tooltip */}
        {hoveredCell && (
          <div
            className="absolute z-10 px-2 py-1 text-xs bg-black bg-opacity-75 text-white pointer-events-none rounded"
            style={{
              left: `${hoveredCell.x * scaledCellWidth + scaledCellWidth / 2}px`,
              top: `${hoveredCell.y * scaledCellHeight - 25}px`,
              transform: 'translateX(-50%)',
            }}
          >
            ({hoveredCell.x}, {hoveredCell.y}): {hoveredCell.value}
          </div>
        )}

        {/* Agent click indicator - PROMINENT cell highlight with glow */}
        {lastAction?.type === 'ACTION6' && lastAction.coordinates && (
          <div
            className="absolute z-5 border-4 border-orange-500 rounded-lg pointer-events-none"
            style={{
              left: `${lastAction.coordinates[0] * scaledCellWidth}px`,
              top: `${lastAction.coordinates[1] * scaledCellHeight}px`,
              width: `${scaledCellWidth}px`,
              height: `${scaledCellHeight}px`,
              boxShadow: '0 0 20px rgba(255, 133, 27, 0.9), 0 0 40px rgba(255, 133, 27, 0.6), inset 0 0 20px rgba(255, 133, 27, 0.3)',
              animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              backgroundColor: 'rgba(255, 133, 27, 0.15)',
            }}
          />
        )}

        {/* Agent click indicator - PROMINENT label badge with animation */}
        {lastAction?.type === 'ACTION6' && lastAction.coordinates && (
          <div
            className="absolute z-10 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-sm px-3 py-2 rounded-lg shadow-2xl pointer-events-none flex items-center gap-2 animate-bounce"
            style={{
              left: `${lastAction.coordinates[0] * scaledCellWidth + scaledCellWidth / 2}px`,
              top: `${lastAction.coordinates[1] * scaledCellHeight - 45}px`,
              transform: 'translateX(-50%)',
              border: '2px solid rgba(255, 255, 255, 0.5)',
            }}
          >
            <svg className="w-5 h-5 fill-white" viewBox="0 0 256 256">
              <path d="M162.35,138.35a8,8,0,0,1,2.46-13l46.41-17.82a8,8,0,0,0-.71-14.85L50.44,40.41a8,8,0,0,0-10,10L92.68,210.51a8,8,0,0,0,14.85.71l17.82-46.41a8,8,0,0,1,13-2.46l51.31,51.31a8,8,0,0,0,11.31,0L213.66,201a8,8,0,0,0,0-11.31Z"
                    strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"/>
            </svg>
            <span>AGENT CLICKED ({lastAction.coordinates[0]}, {lastAction.coordinates[1]})</span>
          </div>
        )}
      </div>
      
      {/* Color distribution legend */}
      {colorDistribution.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded border">
          <h4 className="text-sm font-semibold mb-2">Color Distribution</h4>
          <div className="flex flex-wrap gap-2">
            {colorDistribution.map(({ value, color, name, count }) => (
              <div key={value} className="flex items-center gap-1 text-xs">
                <div
                  className="w-4 h-4 border border-gray-300 rounded"
                  style={{ backgroundColor: color }}
                />
                <span>{value} ({name})</span>
                {count !== undefined && (
                  <span className="text-gray-500">({count})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Arc3GridVisualization;
