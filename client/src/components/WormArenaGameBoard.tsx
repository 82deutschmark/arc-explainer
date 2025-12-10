/**
 * Author: Claude Code using Haiku
 * Date: 2025-12-09
 * PURPOSE: Emoji-based Canvas renderer for Worm Arena game board.
 *          Uses emoji grid (🟨 soil, 🐛 worms, 🍎 apples) instead of ASCII.
 *          Pure HTML5 Canvas 2D, responsive, fun farm aesthetic.
 * SRP/DRY check: Pass — focused solely on game board rendering.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface WormArenaGameBoardProps {
  frame?: any;
  boardWidth: number;
  boardHeight: number;
  playerLabels?: Record<string, string>;
}

const FOOD_EMOJIS: string[] = [
  '🥑',
  '🍊',
  '🍋',
  '🍐',
  '🍍',
  '🥭',
  '🥝',
  '🥥',
  '🍑',
  '🍈',
  '🍔',
  '🍟',
  '🌭',
  '🍗',
  '🍖',
  '🥓',
  '🍝',
  '🍛',
  '🍲',
];

const WormArenaGameBoard: React.FC<WormArenaGameBoardProps> = ({
  frame,
  boardWidth,
  boardHeight,
  playerLabels = {},
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appleEmojiMapRef = useRef<Map<string, string>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(480);

  // Observe parent width so we can render responsively on mobile
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const measure = () => setContainerWidth(node.clientWidth || 320);
    measure();

    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const sizing = useMemo(() => {
    // Cap the board height to avoid overflowing short mobile viewports
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const maxBoardHeight = Math.max(240, Math.min(viewportHeight * 0.45, 520));

    const usableWidth = Math.max(260, Math.min(containerWidth, 900));
    const padding = 16;

    const cellSize = Math.max(
      16,
      Math.min(
        Math.floor((usableWidth - padding * 2) / boardWidth),
        Math.floor((maxBoardHeight - padding * 2) / boardHeight),
        56,
      ),
    );

    const width = boardWidth * cellSize + padding * 2;
    const height = boardHeight * cellSize + padding * 2;

    return { cellSize, padding, width, height };
  }, [boardHeight, boardWidth, containerWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) return;

    // Responsive sizing tuned for mobile
    const { cellSize, padding, width, height } = sizing;

    // Account for device pixel ratio to keep emoji crisp
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Clear background - earthy soil gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#6b5344');
    gradient.addColorStop(1, '#5a4535');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Slightly lighter soil color for the playable board area
    const boardRectX = padding;
    const boardRectY = padding;
    const boardRectWidth = boardWidth * cellSize;
    const boardRectHeight = boardHeight * cellSize;

    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#7b5b46';
    ctx.fillRect(boardRectX, boardRectY, boardRectWidth, boardRectHeight);
    ctx.restore();

    // Draw grid with light tan lines
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 1;
    for (let i = 0; i <= boardWidth; i++) {
      ctx.beginPath();
      ctx.moveTo(padding + i * cellSize, padding);
      ctx.lineTo(padding + i * cellSize, padding + boardHeight * cellSize);
      ctx.stroke();
    }
    for (let i = 0; i <= boardHeight; i++) {
      ctx.beginPath();
      ctx.moveTo(padding, padding + i * cellSize);
      ctx.lineTo(padding + boardWidth * cellSize, padding + i * cellSize);
      ctx.stroke();
    }

    // Extract game state
    const apples: Array<[number, number]> = frame?.state?.apples ?? [];
    const snakes: Record<string, Array<[number, number]>> = frame?.state?.snakes ?? {};

    // Draw apples first (🍎 variants from FOOD_EMOJIS)
    ctx.font = `${Math.floor(cellSize * 0.8)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    apples.forEach(([x, y]) => {
      if (x >= 0 && x < boardWidth && y >= 0 && y < boardHeight) {
        const cx = padding + (x + 0.5) * cellSize;
        const cy = padding + (y + 0.5) * cellSize;

        const key = `${x},${y}`;
        let emoji = appleEmojiMapRef.current.get(key);
        if (!emoji) {
          const idx = Math.floor(Math.random() * FOOD_EMOJIS.length);
          emoji = FOOD_EMOJIS[idx];
          appleEmojiMapRef.current.set(key, emoji);
        }

        ctx.fillText(emoji, cx, cy);
      }
    });

    // Draw snakes (🐛 for heads, ⏹🔳🔲/🟧 for bodies)
    const snakeEmojis: Record<string, { head: string; body: string }> = {
      '0': { head: '🐛', body: '🟨' }, // Worm A - yellow body
      '1': { head: '🐛', body: '🟧' }, // Worm B - orange body
    };

    Object.entries(snakes).forEach(([sid, positions]) => {
      const emojis = snakeEmojis[sid] || { head: '🐛', body: '🟨' };
      positions.forEach((pos, idx) => {
        const [x, y] = pos as [number, number];
        if (x >= 0 && x < boardWidth && y >= 0 && y < boardHeight) {
          const cx = padding + (x + 0.5) * cellSize;
          const cy = padding + (y + 0.5) * cellSize;
          const emoji = idx === 0 ? emojis.head : emojis.body;
          ctx.fillText(emoji, cx, cy);
        }
      });
    });
  }, [boardWidth, boardHeight, frame, sizing]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center bg-[#6b5344] rounded-xl border-8 border-[#4a3728] p-4"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-auto"
        style={{ imageRendering: 'crisp-edges', maxWidth: '100%' }}
      />
    </div>
  );
};

export default WormArenaGameBoard;
