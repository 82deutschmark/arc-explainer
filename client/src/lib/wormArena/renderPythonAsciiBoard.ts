/**
 * Author: Claude Sonnet 4
 * Date: 2025-12-18
 * PURPOSE: Render game state as ASCII board matching Python's GameState.print_board() format exactly.
 *          This enables the "Console Mirror" view to show users what the Python engine outputs.
 * SRP/DRY check: Pass - single responsibility ASCII rendering utility.
 */

/**
 * Frame state shape from SSE events or replay data.
 */
export interface AsciiFrameState {
  /** Snake positions keyed by snake ID, each is array of [x, y] tuples (head first) */
  snakes?: Record<string, Array<[number, number]>>;
  /** Apple positions as array of [x, y] tuples */
  apples?: Array<[number, number]>;
  /** Alive status keyed by snake ID */
  alive?: Record<string, boolean>;
  /** Scores keyed by snake ID */
  scores?: Record<string, number>;
  /** Board width */
  width?: number;
  /** Board height */
  height?: number;
}

/**
 * Render a frame state as ASCII board matching Python's GameState.print_board() format.
 *
 * Python format:
 * ```
 *  9 . . . A . . . . . .
 *  8 . . . . . . . . . .
 *  7 . . . . . T T T . .
 *  6 . . . . . . . . 1 .
 *  5 . . . 0 T . . . . .
 *  4 . . . . . . . A . .
 *  3 . . . . . . . . . .
 *  2 . A . . . . . . . .
 *  1 . . . . . . . . . .
 *  0 . . . . A . . . . .
 *    0 1 2 3 4 5 6 7 8 9
 * ```
 *
 * Key:
 * - `.` = empty cell
 * - `A` = apple
 * - `0`, `1`, etc. = snake head (player slot number)
 * - `T` = snake body/tail
 *
 * @param state - Frame state containing snakes, apples, alive status
 * @param width - Board width (defaults to state.width or 10)
 * @param height - Board height (defaults to state.height or 10)
 * @returns ASCII string matching Python output format
 */
export function renderPythonAsciiBoard(
  state: AsciiFrameState | null | undefined,
  width?: number,
  height?: number,
): string {
  // Determine board dimensions
  const w = width ?? state?.width ?? 10;
  const h = height ?? state?.height ?? 10;

  if (w <= 0 || h <= 0) {
    return '(invalid board dimensions)';
  }

  // Initialize empty board grid
  const grid: string[][] = Array.from({ length: h }, () =>
    Array.from({ length: w }, () => '.'),
  );

  // Place apples (A)
  const apples = state?.apples ?? [];
  for (const apple of apples) {
    const [x, y] = apple;
    if (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= 0 &&
      x < w &&
      y >= 0 &&
      y < h
    ) {
      grid[y][x] = 'A';
    }
  }

  // Place snakes
  // Snake IDs are typically "0", "1", etc. - use the ID as the head character
  const snakes = state?.snakes ?? {};
  const alive = state?.alive ?? {};

  // Sort snake IDs to ensure consistent ordering (0, 1, 2, ...)
  const snakeIds = Object.keys(snakes).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (Number.isFinite(numA) && Number.isFinite(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });

  for (const snakeId of snakeIds) {
    // Skip dead snakes (Python's print_board skips dead snakes)
    if (alive[snakeId] === false) {
      continue;
    }

    const positions = snakes[snakeId];
    if (!Array.isArray(positions) || positions.length === 0) {
      continue;
    }

    // Determine head character - use snake ID if it's a single digit, otherwise use index
    const numericId = parseInt(snakeId, 10);
    const headChar =
      Number.isFinite(numericId) && numericId >= 0 && numericId <= 9
        ? String(numericId)
        : snakeId.charAt(0);

    for (let i = 0; i < positions.length; i++) {
      const [x, y] = positions[i];
      if (
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        x >= 0 &&
        x < w &&
        y >= 0 &&
        y < h
      ) {
        if (i === 0) {
          // Head
          grid[y][x] = headChar;
        } else {
          // Body/tail
          grid[y][x] = 'T';
        }
      }
    }
  }

  // Build output string matching Python format
  const lines: string[] = [];

  // Calculate y-label width (accommodate largest row number)
  const yLabelWidth = String(h - 1).length;

  // Rows printed top-to-bottom (y = height-1 down to 0)
  for (let y = h - 1; y >= 0; y--) {
    const rowLabel = String(y).padStart(yLabelWidth, ' ');
    const rowCells = grid[y].join(' ');
    lines.push(`${rowLabel} ${rowCells}`);
  }

  // X-axis labels at bottom
  // Indent to align with first cell: yLabelWidth + 1 space
  const xIndent = ' '.repeat(yLabelWidth + 1);
  const xLabels = Array.from({ length: w }, (_, i) => String(i)).join(' ');
  lines.push(`${xIndent}${xLabels}`);

  return lines.join('\n');
}

/**
 * Render a frame from replay data or SSE event.
 * Handles both formats:
 * - Direct state: { snakes, apples, alive, scores, width, height }
 * - Wrapped frame: { frame: { state: { ... } } }
 *
 * @param frame - Frame data (may be wrapped or direct)
 * @param width - Board width override
 * @param height - Board height override
 * @returns ASCII string
 */
export function renderFrameAsAscii(
  frame: any,
  width?: number,
  height?: number,
): string {
  if (!frame) {
    return '(no frame data)';
  }

  // Handle wrapped frame format from SSE: { frame: { state: { ... } } }
  const state: AsciiFrameState =
    frame?.frame?.state ?? frame?.state ?? frame;

  return renderPythonAsciiBoard(state, width, height);
}

export default renderPythonAsciiBoard;
