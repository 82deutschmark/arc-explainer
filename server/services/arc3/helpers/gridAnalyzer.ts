/**
 * Author: Claude Code using Opus 4.5
 * Date: 2025-12-08
 * PURPOSE: Executes Python code for grid analysis in ARC3 agent workflows.
 *          Provides a sandboxed environment where the agent can run programmatic
 *          analysis on the current game grid (find patterns, connected components,
 *          symmetry, etc.) without flooding the context with raw numbers.
 * SRP/DRY check: Pass — isolates Python code execution for grid analysis.
 */

import { spawn } from 'node:child_process';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { logger } from '../../../utils/logger.ts';

export interface GridAnalysisResult {
  success: boolean;
  output: string;
  error?: string;
  executionTimeMs: number;
}

const EXECUTION_TIMEOUT_MS = 10000; // 10 second timeout
const MAX_OUTPUT_LENGTH = 8000; // Limit output to avoid flooding context

/**
 * Execute Python code with the grid data available as a numpy array.
 *
 * The code has access to:
 * - `grid`: numpy array of shape (layers, height, width) with values 0-15
 * - `current_layer`: the most recent 2D layer as numpy array
 * - `numpy` (as `np`): for array operations
 * - `scipy.ndimage`: for connected components, labeling, etc.
 *
 * The agent should print() their results - stdout is captured and returned.
 */
export async function executeGridAnalysis(
  grid: number[][][],
  pythonCode: string
): Promise<GridAnalysisResult> {
  const startTime = Date.now();
  const runId = randomUUID().slice(0, 8);

  // Create temp directory for this execution
  const tempDir = join(tmpdir(), 'arc3-analysis');
  await mkdir(tempDir, { recursive: true });

  const scriptPath = join(tempDir, `analysis_${runId}.py`);
  const dataPath = join(tempDir, `grid_${runId}.json`);

  try {
    // Write grid data as JSON
    await writeFile(dataPath, JSON.stringify(grid));

    // Create Python script with grid loaded
    const fullScript = `
import json
import sys

# Load grid data
with open(r'${dataPath.replace(/\\/g, '\\\\')}', 'r') as f:
    _raw_grid = json.load(f)

try:
    import numpy as np
    grid = np.array(_raw_grid, dtype=np.int8)
    current_layer = grid[-1] if grid.ndim == 3 else grid

    # Try to import scipy for advanced analysis
    try:
        from scipy import ndimage
        HAS_SCIPY = True
    except ImportError:
        HAS_SCIPY = False

except ImportError:
    # Fallback if numpy not available
    grid = _raw_grid
    current_layer = _raw_grid[-1] if isinstance(_raw_grid[0][0], list) else _raw_grid
    HAS_SCIPY = False

# Helper functions available to the agent
def find_connected_components(layer, color=None):
    """Find connected components in a 2D grid layer.
    If color is specified, only find components of that color.
    Returns list of (color, size, bounding_box) tuples."""
    if not HAS_SCIPY:
        return "scipy not available - install scipy for connected components"

    if color is not None:
        mask = (layer == color).astype(int)
        labeled, num_features = ndimage.label(mask)
        components = []
        for i in range(1, num_features + 1):
            coords = np.argwhere(labeled == i)
            size = len(coords)
            min_r, min_c = coords.min(axis=0)
            max_r, max_c = coords.max(axis=0)
            components.append((color, size, (min_r, min_c, max_r, max_c)))
        return components
    else:
        # Find components for each non-background color
        all_components = []
        for c in range(1, 16):  # Skip 0 (background)
            if np.any(layer == c):
                all_components.extend(find_connected_components(layer, c))
        return all_components

def detect_symmetry(layer):
    """Check for horizontal, vertical, and rotational symmetry."""
    results = {}
    results['horizontal'] = np.allclose(layer, np.flipud(layer))
    results['vertical'] = np.allclose(layer, np.fliplr(layer))
    results['rotation_180'] = np.allclose(layer, np.rot90(layer, 2))
    results['rotation_90'] = np.allclose(layer, np.rot90(layer, 1))
    return results

def get_bounding_box(layer, exclude_color=0):
    """Get the bounding box of all non-background pixels."""
    mask = layer != exclude_color
    if not np.any(mask):
        return None
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    return (int(rmin), int(cmin), int(rmax), int(cmax))

def color_counts(layer):
    """Count occurrences of each color."""
    unique, counts = np.unique(layer, return_counts=True)
    return dict(zip(unique.tolist(), counts.tolist()))

# Agent's analysis code starts here
${pythonCode}
`;

    await writeFile(scriptPath, fullScript);

    // Execute Python script
    const result = await new Promise<GridAnalysisResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;

      const proc = spawn('python', [scriptPath], {
        timeout: EXECUTION_TIMEOUT_MS,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const timeoutId = setTimeout(() => {
        killed = true;
        proc.kill('SIGTERM');
      }, EXECUTION_TIMEOUT_MS);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        if (stdout.length > MAX_OUTPUT_LENGTH * 2) {
          killed = true;
          proc.kill('SIGTERM');
        }
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        const executionTimeMs = Date.now() - startTime;

        if (killed) {
          resolve({
            success: false,
            output: stdout.slice(0, MAX_OUTPUT_LENGTH),
            error: stdout.length > MAX_OUTPUT_LENGTH
              ? 'Output exceeded maximum length and was truncated'
              : 'Execution timed out after 10 seconds',
            executionTimeMs,
          });
        } else if (code !== 0) {
          resolve({
            success: false,
            output: stdout.slice(0, MAX_OUTPUT_LENGTH),
            error: stderr.slice(0, 2000) || `Process exited with code ${code}`,
            executionTimeMs,
          });
        } else {
          resolve({
            success: true,
            output: stdout.slice(0, MAX_OUTPUT_LENGTH),
            executionTimeMs,
          });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          output: '',
          error: `Failed to execute Python: ${err.message}. Is Python installed?`,
          executionTimeMs: Date.now() - startTime,
        });
      });
    });

    logger.info(
      `[GridAnalyzer] Execution completed in ${result.executionTimeMs}ms, success=${result.success}`,
      'arc3'
    );

    return result;

  } finally {
    // Cleanup temp files
    try {
      await unlink(scriptPath).catch(() => {});
      await unlink(dataPath).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  }
}
