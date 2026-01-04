Author: Claude Haiku 4.5
Date: 2026-01-03
PURPOSE: Simple, effective agent harness for ARC-AGI-3 using Sonnet 4.5. Focus on visual learning, not mathematical analysis.

---

## The Problem with Current Approach

The existing `arc3_harness.py` and preprocessing guide are **overengineered**:
- Computing entropy, symmetry, rotational properties
- Detecting connected components and adjacency graphs
- Building semantic bridges and belief systems
- 40+ preprocessing techniques documented

But it misses the core insight: **Modern LLMs are multimodal. They can see. Let them learn visually.**

---

## The ClaudeCode SDK Pattern (What Works)

The existing ClaudeCode SDK succeeds because it's **simple**:
1. Each tool is a single CLI script (action.js, status.js, reset.js)
2. Tool output is minimal and actionable
3. Frame analysis is done on-demand (not pre-computed)
4. One instruction file (CLAUDE.md) guides the agent
5. **The agent learns from visual observation, not mathematical properties**

---

## Sonnet 4.5 Agent Harness Architecture

### Core Principle
**Vision + Minimal Context + State Machine = Effective Learning**

### 1. Frame Rendering (Already Exists)

```python
def render_frame_to_base64(frame: List[List[int]]) -> str:
    """Convert 64×64 grid to base64 PNG image.
    - Scale factor = 8 (each cell = 8×8 pixels)
    - Result ≈ 5-10KB, easily consumable by multimodal LLM
    """
```

**Status**: ✅ Implemented in `arc3_openrouter_runner.py:325-355`

---

### 2. Frame Context (Minimal, Actionable)

Send **only what the LLM needs to make the next decision**:

```python
def build_frame_context(current_frame, previous_frame, recent_actions):
    """Return only essential information for decision-making.

    Returns:
    {
        "game_state": "NOT_FINISHED" | "WIN" | "GAME_OVER",
        "score": 42,
        "turn": 5,
        "what_changed": {
            "pixels_changed": 12,
            "summary": "Blue object moved 3 cells right"  # Not entropy/symmetry!
        },
        "recent_actions": ["ACTION1", "ACTION4", "ACTION3"],  # Last 5 actions
        "stuck_detection": False  # Same action 3+ times?
    }
    """
```

**Why this works:**
- No mathematical properties (entropy, symmetry, components)
- Focus on **game state** and **action effects**
- Helps LLM understand cause-effect
- Minimal token usage

---

### 3. Change Detection (Simple)

```python
def detect_frame_changes(prev_frame, curr_frame):
    """Simple pixel-level change detection.

    Returns human-readable summary:
    - "12 pixels changed" (small)
    - "Blue object in top-left moved right" (semantic)
    - "No visible changes" (action failed)
    - "Massive change" (level transition)
    """
```

**NOT computing:**
- Entropy, symmetry, rotational properties
- Connected components and adjacency graphs
- Topological analysis

---

### 4. Action Selection (The Core Loop)

```python
async def choose_action(frame_data):
    """Simple loop: See → Reason → Act → Learn

    1. Render current frame to base64 PNG
    2. Build minimal context (score, what changed, recent actions)
    3. Call Sonnet 4.5 with vision:
       - System prompt: "You're learning a new game"
       - Frame image: base64 PNG
       - Context: game state, changes, action history
    4. Parse action response (ACTION1-6)
    5. Execute and loop
    """
```

---

### 5. State Machine (Persistent Memory)

The agent maintains a simple state machine:

```python
class GameState:
    def __init__(self):
        self.action_history = []  # [ACTION1, ACTION4, ACTION2, ...]
        self.observations = []    # ["ACTION1 = move up", "Red = obstacle", ...]
        self.frame_sequence = []  # Recent frames for pattern detection

    def add_observation(self, obs):
        """Track what the agent has learned.

        Example: "ACTION1 always moves the player up"
        This is used in the next prompt to guide reasoning.
        """
        self.observations.append(obs)

    def is_stuck(self):
        """Detect loops: same action 3+ times with no change?"""
        return len(set(self.action_history[-3:])) == 1
```

---

## The Complete Flow

```
┌─────────────────────────────┐
│ Frame from ARC-AGI-3 API    │
│ (64×64 grid as number[][])  │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────────────────────┐
│ Step 1: Render Frame to Base64 PNG          │
│ - Simple pixel-by-pixel coloring            │
│ - No analysis, just visualization           │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│ Step 2: Detect What Changed (vs prev frame) │
│ - Pixel diff count                          │
│ - Human-readable summary                    │
│ - No mathematical properties!               │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│ Step 3: Build Minimal Context               │
│ - Game state (NOT_FINISHED, WIN, GAME_OVER) │
│ - Score                                      │
│ - What changed ("12 pixels", "object moved")│
│ - Last 5 actions                            │
│ - Known observations ("ACTION1 = move up")  │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│ Step 4: Call Sonnet 4.5 with Vision         │
│                                              │
│ System: "You're learning a game. Reason     │
│          visually about what you see and    │
│          what might happen next."           │
│                                              │
│ Messages:                                    │
│  - Text: context (state, changes, history) │
│  - Image: base64 PNG of current frame      │
│                                              │
│ Response: "I'll try ACTION4 because..."    │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│ Step 5: Execute Action & Update State       │
│ - Log action to history                     │
│ - Extract learning if mentioned             │
│ - Loop back to Step 1                       │
└─────────────────────────────────────────────┘
```

---

## System Prompt (Not Math-Heavy)

```
You are learning a new game by exploration.

Your goal: Figure out what each action does and win.

Instructions:
1. Look at the current game frame (image above)
2. Reason visually about what you see
3. Consider what you learned from previous actions
4. Choose your next action (ACTION1-6)

What you know:
- ACTION1: [Unknown] (try it to learn)
- ACTION2: [Unknown]
- ACTION3: [Unknown]
- ACTION4: [Unknown]
- ACTION5: [Unknown]
- ACTION6: Click at coordinates (x, y)

Recent observations:
{insert observations from state}

What happened last turn:
{insert change summary}

Choose an action and explain your reasoning.
```

---

## What NOT to Send

❌ Entropy values
❌ Symmetry analysis (horizontal, vertical, rotational)
❌ Connected component counts
❌ Adjacency graphs
❌ Color histograms
❌ Topological analysis
❌ Pathfinding vectors
❌ Surprise metrics
❌ Frustration scores

**All of these constrain the LLM's reasoning and add token overhead.**

---

## What TO Send

✅ Base64 PNG image (visual)
✅ Game state (NOT_FINISHED, WIN, GAME_OVER)
✅ Score
✅ "What changed" in human terms ("moved 3 right", "disappeared")
✅ Recent action history (last 5)
✅ Known observations ("ACTION1 = move up")
✅ Is stuck detection ("Same action 3 times, no progress")

---

## Implementation Checklist

### Phase 1: Clean Up (Remove Over-Engineering)
- [ ] Strip mathematical analysis from context sent to LLM
- [ ] Keep only action execution, frame rendering, change detection
- [ ] Delete unused complexity (entropy, symmetry, components)

### Phase 2: Build Minimal Harness
- [ ] `render_frame_to_base64()` - simple pixel coloring
- [ ] `detect_frame_changes()` - pixel diff + human summary
- [ ] `build_frame_context()` - minimal essential info
- [ ] `Arc3SonnetAgent` - vision-based action selection
- [ ] `GameState` - persistent memory (actions, observations)

### Phase 3: System Prompt
- [ ] Create `SONNET_4_5_PROMPT.md`
- [ ] Focus on "learn by observation"
- [ ] Emphasize visual reasoning
- [ ] Include learning patterns (observations)

### Phase 4: Integration
- [ ] Connect to ARC-AGI-3 API
- [ ] Test with 1-2 games
- [ ] Verify base64 images are being consumed
- [ ] Check that observations are being learned

### Phase 5: Iteration
- [ ] Run on 10+ games
- [ ] Adjust prompt based on failure modes
- [ ] Improve change detection if needed
- [ ] Add stuck detection and recovery

---

## Success Criteria

1. **Agent runs autonomously** - No human intervention
2. **Learns from observation** - Can identify action patterns (ACTION1 = move up)
3. **Minimal overhead** - Each turn < 100ms preprocessing + LLM inference
4. **No mathematical gunk** - No entropy, symmetry, or complexity metrics
5. **Visual reasoning** - Uses base64 PNG images, not text grids

---

## Why This Will Work Better

| Aspect | Over-Engineered | Simple Harness |
|--------|-----------------|----------------|
| **Token Usage** | High (50+ properties) | Low (5-10 properties) |
| **Reasoning Type** | Mathematical | Visual |
| **Learning Speed** | Slow (must infer from math) | Fast (direct observation) |
| **Maintainability** | Complex (40+ techniques) | Simple (5 core functions) |
| **Generalization** | Poor (specific metrics) | Good (visual patterns) |

---

## Files to Create/Modify

```
server/python/
├── arc3_sonnet_agent.py          [NEW] Core agent harness
└── arc3_minimal_harness.py       [NEW] Simple rendering + change detection

shared/types.ts
├── Add SonnetFrameContext type
└── Add GameState interface

client/src/pages/
└── Arc3SonnetPlayground.tsx       [NEW] UI for running agent
```

---

## Quick Start

```bash
# Start a game with Sonnet 4.5
python server/python/arc3_sonnet_agent.py \
  --game-id ls20 \
  --api-key $ARC3_API_KEY \
  --anthropic-key $ANTHROPIC_API_KEY
```

---

## References

- ClaudeCode SDK pattern: `external/ARC-AGI-3-ClaudeCode-SDK/`
- Simple is better: Keep it to <500 lines per file
- Vision-first: Always render frames to PNG before reasoning
- **No math**: Delete the math, trust the vision

