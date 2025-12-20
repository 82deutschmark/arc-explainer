/**
 * Author: Cascade
 * Date: 2025-12-18
 * PURPOSE: Emoji-based Canvas renderer for Worm Arena game board.
 *          Uses emoji grid (soil, worms, apples) instead of ASCII.
 *          Pure HTML5 Canvas 2D, responsive, fun farm aesthetic.
 *          Reduced padding/borders to maximize visible board area.
 * SRP/DRY check: Pass - focused solely on game board rendering.
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

const USE_VARIANT_FOOD_EMOJIS = false;

const WormArenaGameBoard: React.FC<WormArenaGameBoardProps> = ({
  frame,
  boardWidth,
  boardHeight,
  playerLabels = {},
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appleEmojiMapRef = useRef<Map<string, string>>(new Map());
  const prevSnakeHeadsRef = useRef<Map<string, [number, number]>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(480);

  const getHeadEmoji = (hasBody: boolean, sid?: string) => {
    // If snake has a body, use worm emoji
    if (hasBody) {
      return '🐛';
    }
    // Only head (no body yet): use color-coded circles
    return sid === '0' ? '🟢' : sid === '1' ? '🔵' : '⭕';
  };

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
    // Increased limits to allow larger board rendering
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const maxBoardHeight = Math.max(280, Math.min(viewportHeight * 0.55, 600));

    const usableWidth = Math.max(280, Math.min(containerWidth, 950));
    // Reduced padding from 16 to 8 for tighter layout
    const padding = 8;

    const cellSize = Math.max(
      18,
      Math.min(
        Math.floor((usableWidth - padding * 2) / boardWidth),
        Math.floor((maxBoardHeight - padding * 2) / boardHeight),
        64,
      ),
    );

    // Reduced label margin for more board space
    const labelMargin = Math.max(14, Math.round(cellSize * 0.5));
    const width = boardWidth * cellSize + padding * 2 + labelMargin * 2;
    const height = boardHeight * cellSize + padding * 2 + labelMargin * 2;

    return { cellSize, padding, width, height, labelMargin };
  }, [boardHeight, boardWidth, containerWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) return;

    // Responsive sizing tuned for mobile
    const { cellSize, padding, width, height, labelMargin } = sizing;

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
    const boardRectWidth = boardWidth * cellSize;
    const boardRectHeight = boardHeight * cellSize;
    const boardRectX = padding + labelMargin;
    const boardRectY = padding + labelMargin;

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
      ctx.moveTo(boardRectX + i * cellSize, boardRectY);
      ctx.lineTo(boardRectX + i * cellSize, boardRectY + boardRectHeight);
      ctx.stroke();
    }
    for (let i = 0; i <= boardHeight; i++) {
      ctx.beginPath();
      ctx.moveTo(boardRectX, boardRectY + i * cellSize);
      ctx.lineTo(boardRectX + boardRectWidth, boardRectY + i * cellSize);
      ctx.stroke();
    }

    // Coordinate labels outside the grid (blue padding bands)
    const axisFontSize = Math.max(Math.round(cellSize * 0.45), 14);
    const labelBandColor = '#d7eaff';
    ctx.fillStyle = labelBandColor;
    ctx.fillRect(boardRectX, padding, boardRectWidth, labelMargin);
    ctx.fillRect(boardRectX, boardRectY + boardRectHeight, boardRectWidth, labelMargin);
    ctx.fillRect(padding, boardRectY, labelMargin, boardRectHeight);
    ctx.fillRect(boardRectX + boardRectWidth, boardRectY, labelMargin, boardRectHeight);
    ctx.fillStyle = '#000';
    ctx.font = `bold ${axisFontSize}px monospace`;
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'middle';

    const topLabelY = padding + labelMargin / 2;
    const bottomLabelY = boardRectY + boardRectHeight + labelMargin / 2;
    ctx.textAlign = 'center';
    for (let x = 0; x < boardWidth; x++) {
      const labelX = boardRectX + (x + 0.5) * cellSize;
      ctx.fillText(x.toString(), labelX, topLabelY);
      ctx.fillText(x.toString(), labelX, bottomLabelY);
    }

    const rowOffsetX = padding + labelMargin / 2;
    ctx.textAlign = 'right';
    for (let row = 0; row < boardHeight; row++) {
      const labelY = boardRectY + (row + 0.5) * cellSize;
      const engineY = boardHeight - 1 - row;
      ctx.fillText(engineY.toString(), rowOffsetX, labelY);
    }

    const rightLabelX = boardRectX + boardRectWidth + labelMargin / 2;
    ctx.textAlign = 'left';
    for (let row = 0; row < boardHeight; row++) {
      const labelY = boardRectY + (row + 0.5) * cellSize;
      const engineY = boardHeight - 1 - row;
      ctx.fillText(engineY.toString(), rightLabelX, labelY);
    }

    // Cell coordinates inside the board
    const cellCoordFontSize = Math.max(Math.round(cellSize * 0.25), 10);
    ctx.font = `${cellCoordFontSize}px monospace`;
    ctx.fillStyle = '#CFCFCF';
    ctx.textAlign = 'center';
    for (let x = 0; x < boardWidth; x++) {
      for (let y = 0; y < boardHeight; y++) {
        const cx = boardRectX + (x + 0.5) * cellSize;
        const cy = boardRectY + (y + 0.5) * cellSize;
        const engineY = boardHeight - 1 - y;
        ctx.fillText(`${x},${engineY}`, cx, cy);
      }
    }

    // Extract game state
    const apples: Array<[number, number]> = frame?.state?.apples ?? [];
    const snakes: Record<string, Array<[number, number]>> = frame?.state?.snakes ?? {};

    // Draw apples first (🍎 variants from FOOD_EMOJIS)
    ctx.font = `${Math.floor(cellSize * 0.8)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';

    apples.forEach(([x, y]) => {
      if (x >= 0 && x < boardWidth && y >= 0 && y < boardHeight) {
        const cx = boardRectX + (x + 0.5) * cellSize;
        const renderY = boardHeight - 1 - y;
        const cy = boardRectY + (renderY + 0.5) * cellSize;
        let emoji: string;

        if (USE_VARIANT_FOOD_EMOJIS) {
          const key = `${x},${y}`;
          const existing = appleEmojiMapRef.current.get(key);
          if (existing) {
            emoji = existing;
          } else {
            const idx = Math.floor(Math.random() * FOOD_EMOJIS.length);
            emoji = FOOD_EMOJIS[idx];
            appleEmojiMapRef.current.set(key, emoji);
          }
        } else {
          emoji = '🍎';
        }

        ctx.fillText(emoji, cx, cy);
      }
    });

    // Draw snakes (directional heads, 🟢🔵⏹🔳🔲/🟧 for bodies)
    const snakeEmojis: Record<string, { body: string }> = {
      '0': { body: '🟩' }, // Worm A - green body
      '1': { body: '🟦' }, // Worm B - blue body
    };

    Object.entries(snakes).forEach(([sid, positions]) => {
      const emojis = snakeEmojis[sid] || { body: '0️⃣' };

      const head = positions?.[0] as [number, number] | undefined;
      if (head) {
        const prevHead = prevSnakeHeadsRef.current.get(sid);

        let dx = 0;
        let dy = 0;
        if (prevHead) {
          dx = head[0] - prevHead[0];
          dy = head[1] - prevHead[1];
        } else if (positions.length > 1) {
          const neck = positions[1] as [number, number];
          dx = head[0] - neck[0];
          dy = head[1] - neck[1];
        }

        prevSnakeHeadsRef.current.set(sid, head);

        const headEmoji = getHeadEmoji(positions.length > 1, sid);
        positions.forEach((pos, idx) => {
          const [x, y] = pos as [number, number];
          if (x >= 0 && x < boardWidth && y >= 0 && y < boardHeight) {
            const cx = boardRectX + (x + 0.5) * cellSize;
            const renderY = boardHeight - 1 - y;
            const cy = boardRectY + (renderY + 0.5) * cellSize;
            const emoji = idx === 0 ? headEmoji : emojis.body;
            ctx.fillText(emoji, cx, cy);
          }
        });

        return;
      }

      positions.forEach((pos, idx) => {
        const [x, y] = pos as [number, number];
        if (x >= 0 && x < boardWidth && y >= 0 && y < boardHeight) {
          const cx = boardRectX + (x + 0.5) * cellSize;
          const renderY = boardHeight - 1 - y;
          const cy = boardRectY + (renderY + 0.5) * cellSize;
          const emoji = idx === 0 ? getHeadEmoji(positions.length > 1, sid) : emojis.body;
          ctx.fillText(emoji, cx, cy);
        }
      });
    });
  }, [boardWidth, boardHeight, frame, sizing]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center rounded-lg border-4 p-1 bg-worm-board-bg border-worm-board-frame"
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
