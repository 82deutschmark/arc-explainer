/**
 * Author: Claude Code using Haiku
 * Date: 2025-12-09
 * PURPOSE: Emoji-based Canvas renderer for Worm Arena game board.
 *          Uses emoji grid (🟨 soil, 🐛 worms, 🍎 apples) instead of ASCII.
 *          Pure HTML5 Canvas 2D, responsive, fun farm aesthetic.
 * SRP/DRY check: Pass — focused solely on game board rendering.
 */

import React, { useEffect, useRef } from 'react';

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Responsive sizing
    const containerWidth = canvas.parentElement?.clientWidth || 400;
    const maxHeight = 600;
    const cellSize = Math.min(
      Math.floor(containerWidth / (boardWidth + 2)) - 2,
      Math.floor(maxHeight / (boardHeight + 2)) - 2
    );
    const padding = 20;
    const width = boardWidth * cellSize + padding * 2;
    const height = boardHeight * cellSize + padding * 2;

    canvas.width = width;
    canvas.height = height;

    // Clear background - earthy soil gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#6b5344');
    gradient.addColorStop(1, '#5a4535');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

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
  }, [frame, boardWidth, boardHeight]);

  return (
    <div className="flex flex-col items-center justify-center bg-[#6b5344] rounded-xl border-8 border-[#4a3728] p-4">
      <canvas
        ref={canvasRef}
        className="max-w-full h-auto"
        style={{ imageRendering: 'crisp-edges' }}
      />
    </div>
  );
};

export default WormArenaGameBoard;
