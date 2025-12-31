/**
 * Author: Claude Haiku 4.5
 * Date: 2025-12-20
 * PURPOSE: Unpack multi-frame animation responses from ARC-AGI-3 API.
 * The ARC-3 API can return 1-N consecutive frames in a single response to represent
 * internal environment animations. This module detects 4D frame arrays [frameIdx][layerIdx][height][width]
 * and unpacks them into individual 3D frames [layerIdx][height][width].
 *
 * SRP/DRY check: PASS — Separated from game runner, reusable across both sync and streaming methods.
 * Handles complex array dimensionality detection without duplicating logic.
 */

import { FrameData } from '../Arc3ApiClient.ts';
import { logger } from '../../../utils/logger.ts';

/**
 * Detect whether a frame array is 3D (single frame) or 4D (animation sequence)
 *
 * 3D: [layerIdx][height][width] - single moment with multiple layers
 * 4D: [frameIdx][layerIdx][height][width] - multiple moments, each with multiple layers
 *
 * @param frameArray - The frame data structure from API
 * @returns true if 4D (animation), false if 3D (single frame)
 * @throws Error if structure is invalid
 */
export function isAnimationFrame(frameArray: number[][][] | number[][][][] | undefined): frameArray is number[][][][] {
  if (!frameArray || frameArray.length === 0) {
    return false;
  }

  // Check first element: should be array for both 3D and 4D
  const firstElement = frameArray[0];
  if (!Array.isArray(firstElement) || firstElement.length === 0) {
    return false;
  }

  // For 3D: firstElement[0] should be array (height row)
  // For 4D: firstElement[0] should be array of arrays (layer)
  const firstLayer = firstElement[0];
  if (!Array.isArray(firstLayer) || firstLayer.length === 0) {
    return false;
  }

  // For 3D: firstLayer[0] should be number (pixel)
  // For 4D: firstLayer[0] should be array (height row within layer)
  const firstPixel = firstLayer[0];

  // If it's an array, this is 4D (animation)
  // If it's a number, this is 3D (single frame)
  return Array.isArray(firstPixel);
}

/**
 * Unpack a single API response into individual frames.
 *
 * If the response contains animation (4D array):
 * - Extracts each frame [layerIdx][height][width]
 * - Creates separate FrameData objects for each
 * - Marks intermediate frames as 'IN_PROGRESS' (only final frame has actual state)
 * - Only final frame gets score, action_counter, etc.
 *
 * If single frame (3D array):
 * - Returns as-is in an array for consistent processing
 *
 * @param responseFrameData - API response with potentially 4D frame data
 * @returns Array of unpacked FrameData objects (1 for single frame, N for animation)
 */
export function unpackFrames(responseFrameData: FrameData): FrameData[] {
  const frameArray = responseFrameData.frame;

  // Empty frame array - return as-is
  if (!frameArray || frameArray.length === 0) {
    logger.warn('[Frame Unpacker] Empty frame array received', 'arc3');
    return [responseFrameData];
  }

  // Detect dimensionality
  try {
    if (isAnimationFrame(frameArray)) {
      // 4D array detected: [frameIdx][layerIdx][height][width]
      logger.info(
        `[Frame Unpacker] Animation detected: ${frameArray.length} frames, ` +
        `${(frameArray[0] as number[][][]).length} layers per frame`,
        'arc3'
      );

      const unpackedFrames: FrameData[] = [];
      const totalFrames = frameArray.length;

      for (let i = 0; i < totalFrames; i++) {
        const singleFrame = frameArray[i] as number[][][]; // Extract 3D frame

        // All frames except the last are marked as IN_PROGRESS
        const isLastFrame = i === totalFrames - 1;

        const unpackedFrame: FrameData = {
          ...responseFrameData,
          frame: singleFrame, // Now 3D: [layerIdx][height][width]

          // Only final frame has actual game state
          state: isLastFrame ? responseFrameData.state : 'IN_PROGRESS',
          score: isLastFrame ? responseFrameData.score : 0,
          action_counter: isLastFrame ? responseFrameData.action_counter : null,

          // Preserve final frame's win score and max actions
          win_score: responseFrameData.win_score,
          max_actions: responseFrameData.max_actions,
        };

        unpackedFrames.push(unpackedFrame);

        logger.debug(
          `[Frame Unpacker] Unpacked frame ${i + 1}/${totalFrames}: ` +
          `state=${unpackedFrame.state}, score=${unpackedFrame.score}`,
          'arc3'
        );
      }

      logger.info(
        `[Frame Unpacker] Unpacked animation into ${unpackedFrames.length} frames`,
        'arc3'
      );

      return unpackedFrames;
    } else {
      // 3D array detected: [layerIdx][height][width] - single frame, no unpacking needed
      logger.debug('[Frame Unpacker] Single frame (3D) detected, no unpacking needed', 'arc3');
      return [responseFrameData];
    }
  } catch (error) {
    logger.error(
      `[Frame Unpacker] Error detecting frame dimensionality: ` +
      `${error instanceof Error ? error.message : String(error)}`,
      'arc3'
    );
    // Fallback: treat as single frame
    return [responseFrameData];
  }
}

/**
 * Debug utility: Get readable summary of frame structure
 * @param frameData - Frame data to inspect
 * @returns Human-readable summary
 */
export function summarizeFrameStructure(frameData: FrameData): string {
  const frameArray = frameData.frame;
  if (!frameArray || frameArray.length === 0) {
    return 'Empty frame array';
  }

  const isAnimation = isAnimationFrame(frameArray);

  if (isAnimation) {
    const numFrames = frameArray.length;
    const numLayers = (frameArray[0] as number[][][]).length;
    const height = ((frameArray[0] as number[][][])[0] as number[][]).length;
    const width = ((frameArray[0] as number[][][])[0] as number[][])[0].length;

    return (
      `Animation: ${numFrames} frames × ${numLayers} layers × ` +
      `${height}×${width} grid [frameIdx][layerIdx][height][width]`
    );
  } else {
    const numLayers = (frameArray as number[][][]).length;
    const height = ((frameArray as number[][][])[0] as number[][]).length;
    const width = ((frameArray as number[][][])[0] as number[][])[0].length;

    return (
      `Single frame: ${numLayers} layers × ${height}×${width} grid [layerIdx][height][width]`
    );
  }
}
