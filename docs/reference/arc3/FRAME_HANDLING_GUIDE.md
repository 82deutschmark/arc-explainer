# ARC-3 Frame Handling Developer Guide

**Author:** Claude Haiku 4.5
**Date:** 2025-12-20
**Audience:** Developers modifying frame processing, streaming, or database logic

---

## Quick Reference: Frame Types (2026)

### 3D Array (Single Frame)
```
Structure: [layerIdx][height][width]
Example: frame[2][32][45] = color value 7 (pixel at layer 2, row 32, col 45)
Representation: One moment in time, multiple layers
Common case: Most actions return this
```

### 4D Array (Animation)
```
Structure: [frameIdx][layerIdx][height][width]
Example: frame[1][2][32][45] = color value 7 (animation frame 1, layer 2, row 32, col 45)
Representation: Multiple moments in time, each with multiple layers
When it happens: Internal environment animations (object movement, transitions, etc.)
```

---

## For Action Tool Developers (RESET + ACTION1–7, normalized)

- Available actions arrive as numeric or string tokens; the server normalizes to canonical `RESET` / `ACTION1-7` before emitting to the UI/stream. Do not infer availability client-side—trust normalized `available_actions`.

If you're adding a **new action** or **modifying existing action tools**, follow this pattern:

### Template

```typescript
const myNewTool = tool({
  name: 'MY_ACTION',
  description: 'My action description',
  parameters: z.object({
    param: z.string().describe('Parameter description')
  }),
  execute: async ({ param }) => {
    logger.info(`[ARC3 TOOL] MY_ACTION called with param="${param}"`, 'arc3');
    if (!gameGuid) throw new Error('Game session not initialized yet.');

    // 1. Store previous frame for comparison
    prevFrame = currentFrame;

    // 2. Execute action and get response
    const responseFrameData = await this.apiClient.executeAction(
      gameId,
      gameGuid,
      { action: 'MY_ACTION', param },  // ← Your action params
      undefined,  // ← reasoning payload (for streaming only)
      scorecardId
    );

    // 3. CRITICAL: Unpack animation frames
    const unpackedFrames = unpackFrames(responseFrameData);

    // 4. Log if animation detected
    if (unpackedFrames.length > 1) {
      logger.info(
        `[ARC3 TOOL] MY_ACTION returned ${unpackedFrames.length} animation frames`,
        'arc3'
      );
    }

    // 5. Update current frame (use final/settled frame)
    currentFrame = unpackedFrames[unpackedFrames.length - 1];

    // 6. Store all frames in history
    frames.push(...unpackedFrames);

    // 7. Log execution
    logger.info(
      `[ARC3 TOOL] MY_ACTION executed: state=${currentFrame.state}, score=${currentFrame.score} ` +
      `(${unpackedFrames.length} frame(s))`,
      'arc3'
    );

    // 8. Persist unpacked frames to database
    if (dbSessionId && prevFrame) {
      currentFrameNumber = await this.persistUnpackedFrames(
        dbSessionId,
        unpackedFrames,
        { action: 'MY_ACTION', param },  // ← Your action params
        prevFrame,
        currentFrameNumber
      );
    }

    // 9. (Streaming only) Emit each frame
    if (streamHarness) {
      for (let i = 0; i < unpackedFrames.length; i++) {
        const frame = unpackedFrames[i];
        const isLastFrame = i === unpackedFrames.length - 1;
        let caption = generateActionCaption(
          { action: 'MY_ACTION', param },
          prevFrame,
          frame
        );
        if (unpackedFrames.length > 1) {
          caption += ` (frame ${i + 1}/${unpackedFrames.length})`;
        }

        streamHarness.emitEvent("game.frame_update", {
          frameIndex: String(currentFrameNumber - unpackedFrames.length + i),
          frameData: frame,
          caption,
          action: { type: 'MY_ACTION', param },
          isAnimation: unpackedFrames.length > 1,
          animationFrame: i,
          animationTotalFrames: unpackedFrames.length,
          isLastAnimationFrame: isLastFrame,
          timestamp: Date.now()
        });
      }
    }

    // 10. Return final frame (agent sees this)
    return currentFrame;
  }
});
```

---

## For Database Query Developers

If you're querying `arc3_frames`, be aware of the new multi-frame pattern:

### Getting All Frames for a Session

```sql
-- Get all frames in order (includes animation frames)
SELECT frame_number, action_type, caption, state, score
FROM arc3_frames
WHERE session_id = ?
ORDER BY frame_number ASC;
```

### Getting Only "Final" Frames per Action

```sql
-- Get one frame per action (final frame only)
SELECT DISTINCT ON (action_counter)
  frame_number, action_type, caption, state, score
FROM arc3_frames
WHERE session_id = ?
ORDER BY action_counter DESC, frame_number DESC;
```

### Getting Frame Count (Total vs Actions)

```sql
-- Total frames (includes animations)
SELECT COUNT(*) as total_frames FROM arc3_frames WHERE session_id = ?;

-- Logical action count (from final game state)
SELECT action_counter FROM arc3_sessions WHERE id = ?;
```

### Animation Frame Queries

```sql
-- Find all animations (multi-frame actions)
SELECT action_type, COUNT(*) as frame_count
FROM arc3_frames
WHERE session_id = ?
GROUP BY action_type
HAVING COUNT(*) > 1;

-- Get specific animation sequence
SELECT * FROM arc3_frames
WHERE session_id = ? AND frame_number BETWEEN 10 AND 14;
```

---

## For Frontend Streaming Developers

If you're subscribing to SSE events, the `game.frame_update` event now includes animation metadata:

### Event Payload (NEW FORMAT)

```typescript
interface FrameUpdateEvent {
  frameIndex: string;           // "0", "1", "2", ... sequential
  frameData: FrameData;         // The frame itself
  caption: string;              // "Moved up (frame 1/3)"
  action: {
    type: string;               // "ACTION1", "ACTION6", "RESET"
    coordinates?: [number, number];  // For ACTION6
  };

  // NEW animation metadata:
  isAnimation: boolean;         // true if multi-frame action
  animationFrame: number;       // 0, 1, 2, ... within animation
  animationTotalFrames: number; // Total frames in this action
  isLastAnimationFrame: boolean;// true if final frame of animation

  timestamp: number;
}
```

### Handling Animation Sequences

```typescript
// Subscribe to events
eventSource.addEventListener('game.frame_update', (e) => {
  const update = JSON.parse(e.data);

  if (update.isAnimation && update.animationTotalFrames > 1) {
    // This is an animation sequence
    console.log(
      `Action ${update.action.type} ` +
      `animation frame ${update.animationFrame + 1}/${update.animationTotalFrames}`
    );

    if (update.isLastAnimationFrame) {
      console.log('Animation complete, final frame reached');
    }
  }
});
```

### Optional: Smooth Animation Playback

```typescript
const [frames, setFrames] = useState<FrameData[]>([]);
const [animationSequence, setAnimationSequence] = useState<FrameData[]>([]);

eventSource.addEventListener('game.frame_update', (e) => {
  const update = JSON.parse(e.data);

  // Store all frames
  setFrames(prev => [...prev, update.frameData]);

  // If animation, buffer for playback
  if (update.isAnimation) {
    if (update.animationFrame === 0) {
      // Start new animation sequence
      setAnimationSequence([update.frameData]);
    } else {
      // Add to current animation
      setAnimationSequence(prev => [...prev, update.frameData]);
    }
  } else {
    // Single frame (non-animation)
    setAnimationSequence([update.frameData]);
  }
});
```

---

## For Persistence Layer Developers

If you're modifying `framePersistence.ts` or `sessionManager.ts`:

### Key Invariants to Maintain

1. **Frame numbering is sequential across animations**
   ```typescript
   // ✅ Correct
   frame_number: 0 (RESET, frame 1/3)
   frame_number: 1 (RESET, frame 2/3)
   frame_number: 2 (RESET, frame 3/3)
   frame_number: 3 (ACTION1, single frame)

   // ❌ Wrong - resets per action
   frame_number: 0 (RESET, frame 1/3)
   frame_number: 1 (RESET, frame 2/3)
   frame_number: 2 (RESET, frame 3/3)
   frame_number: 0 (ACTION1)  // ← Should be 3!
   ```

2. **Only final frame has actual state/score**
   ```sql
   -- ✅ Correct animation sequence
   frame_number | state        | score | caption
   0            | IN_PROGRESS  | NULL  | (frame 1/3)
   1            | IN_PROGRESS  | NULL  | (frame 2/3)
   2            | WIN          | 100   | (frame 3/3)  ← Only final has state

   -- ❌ Wrong - intermediate frames have state
   0            | WIN          | 100   | (frame 1/3)
   1            | WIN          | 100   | (frame 2/3)
   2            | WIN          | 100   | (frame 3/3)  ← All have state!
   ```

3. **total_frames includes all animation frames**
   ```typescript
   // If 3 animation frames + 1 regular action:
   session.total_frames = 4  // ✅ Correct
   session.total_frames = 2  // ❌ Wrong (missing animation frames)
   ```

---

## Troubleshooting

### "Frame number out of sequence" errors

**Cause:** Not using `persistUnpackedFrames()` or manually managing `currentFrameNumber`

**Fix:**
```typescript
// ✅ Correct: Use the helper
currentFrameNumber = await this.persistUnpackedFrames(
  dbSessionId,
  unpackedFrames,
  action,
  prevFrame,
  currentFrameNumber  // ← Pass current, it returns updated
);

// ❌ Wrong: Manual management
await saveFrame(dbSessionId, frames.length - 1, frame, ...);  // Loses animation count
```

### "Missing frames in database"

**Cause:** Not unpacking before saving

**Fix:**
```typescript
// ✅ Correct: Unpack first
const unpackedFrames = unpackFrames(responseFrameData);
for (const frame of unpackedFrames) {
  // save each frame
}

// ❌ Wrong: Save raw response
await saveFrame(dbSessionId, frameNum, responseFrameData, ...);  // 4D in DB!
```

### "Agent making wrong decisions"

**Cause:** Using intermediate frame instead of final frame

**Fix:**
```typescript
// ✅ Correct: Agent always uses final frame
const unpackedFrames = unpackFrames(responseFrameData);
currentFrame = unpackedFrames[unpackedFrames.length - 1];
// Agent sees currentFrame (the final, settled state)

// ❌ Wrong: Using first frame
currentFrame = unpackedFrames[0];  // Intermediate state!
agent.run();  // Agent makes decisions on wrong frame
```

---

## Testing Frame Unpacking

### Unit Test Sketch

```typescript
import { unpackFrames, isAnimationFrame } from './frameUnpacker';

describe('Frame Unpacking', () => {
  it('should detect 3D array as single frame', () => {
    const frame3D = {
      frame: [[[1, 2], [3, 4]], [[5, 6], [7, 8]]],  // [layer][height][width]
      guid: 'test',
      state: 'WIN',
      score: 100
    };

    const unpacked = unpackFrames(frame3D);
    expect(unpacked).toHaveLength(1);
    expect(unpacked[0].state).toBe('WIN');
  });

  it('should unpack 4D array into multiple frames', () => {
    const frame4D = {
      frame: [
        [[[1, 2], [3, 4]], [[5, 6], [7, 8]]],  // Animation frame 0
        [[[1, 2], [3, 4]], [[5, 6], [7, 8]]],  // Animation frame 1
        [[[9, 10], [11, 12]], [[13, 14], [15, 0]]]  // Animation frame 2
      ],
      guid: 'test',
      state: 'WIN',
      score: 100
    };

    const unpacked = unpackFrames(frame4D);
    expect(unpacked).toHaveLength(3);

    // Intermediate frames marked IN_PROGRESS
    expect(unpacked[0].state).toBe('IN_PROGRESS');
    expect(unpacked[1].state).toBe('IN_PROGRESS');

    // Final frame has actual state
    expect(unpacked[2].state).toBe('WIN');
    expect(unpacked[2].score).toBe(100);
  });
});
```

---

## References

- **Frame Unpacker Implementation:** [frameUnpacker.ts](../../../server/services/arc3/helpers/frameUnpacker.ts)
- **Game Runner Integration:** [Arc3RealGameRunner.ts](../../../server/services/arc3/Arc3RealGameRunner.ts)
- **Complete Fix Documentation:** [FRAME_UNPACKING_FIX.md](./FRAME_UNPACKING_FIX.md)
- **Full Architecture Guide:** [CODE_MAP.md](./CODE_MAP.md)

---

**Last Updated:** 2025-12-20
**Status:** PRODUCTION GUIDE
