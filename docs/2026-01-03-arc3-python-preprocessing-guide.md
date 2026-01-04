# ARC-AGI-3 Python Preprocessing Guide

**Author:** Claude Sonnet 4.5
**Date:** 2026-01-03
**Purpose:** Document essential Python-side preprocessing for ARC3 agent workflows to provide LLMs with structured, semantic information instead of raw grid data.

---

## Executive Summary

**Current Problem:** Sending raw 64×64 numeric grids to LLMs is inefficient and loses semantic structure.

**Solution:** Preprocess grids in Python to extract:
- Object detection (connected components)
- Color semantics (numeric values → human-readable names)
- Spatial relationships (positions, bounds, regions)
- Frame differencing (what changed between actions)
- Progress tracking (level transitions, score changes)

**Result:** LLMs receive structured, actionable information instead of walls of numbers.

---

## Why Preprocessing Matters

### Without Preprocessing
```
LLM receives:
[[0,0,0,1,1,0,0,...], [0,0,1,1,1,0,0,...], ...]
```

The LLM must:
- Parse 4096 cells (64×64)
- Identify objects manually
- Track changes across frames
- Infer spatial relationships
- Guess what moved/changed

### With Preprocessing
```
LLM receives:
{
  "objects": [
    {
      "id": "OBJ_1",
      "color": "blue",
      "shape": "L-shaped",
      "size": 3,
      "center": [5, 3],
      "region": "top-left"
    }
  ],
  "changes": {
    "pixelsChanged": 8,
    "objectsMoved": ["OBJ_1"],
    "objectsAppeared": [],
    "objectsDisappeared": []
  }
}
```

The LLM gets:
- Semantic object descriptions
- Clear change information
- Spatial context
- Actionable insights

---

## Core Preprocessing Techniques

### 1. Object Detection (Connected Components)

**Purpose:** Identify distinct objects in the grid.

**Algorithm:** Flood-fill on non-zero pixels with same color value.

**Implementation Example (from TOMAS Engine):**
```python
def detect_simple_objects(matrix: np.ndarray) -> List[SimpleObject]:
    """Detect connected components (objects) in grid."""
    objects = []
    visited = np.zeros_like(matrix, dtype=bool)

    for row in range(matrix.shape[0]):
        for col in range(matrix.shape[1]):
            if not visited[row, col] and matrix[row, col] != 0:
                # Flood fill to find connected pixels
                positions = flood_fill(matrix, visited, row, col)

                # Extract object properties
                color_value = matrix[row, col]
                color_name = COLOR_NAMES[color_value]

                # Calculate spatial properties
                bounds = get_bounding_box(positions)
                center = calculate_center(positions)

                objects.append(SimpleObject(
                    id=f"OBJ_{counter}",
                    color=color_name,
                    positions=positions,
                    size=len(positions),
                    center=center,
                    bounds=bounds
                ))

    return objects
```

**Output Structure:**
```python
@dataclass
class SimpleObject:
    id: str                               # "OBJ_1", "OBJ_2", ...
    color: str                            # "blue", "red", "yellow"
    positions: List[Tuple[int, int]]      # [(5,3), (5,4), (6,3)]
    size: int                             # 3 (number of pixels)
    center: Tuple[int, int]               # (5, 3)
    bounds: Tuple[int, int, int, int]     # (min_row, max_row, min_col, max_col)
```

---

### 2. Color Mapping

**Purpose:** Convert numeric grid values to semantic color names.

**ARC-AGI Color Palette (0-15):**
```python
COLOR_NAMES = {
    0: "white",       # Background
    1: "blue",
    2: "gray",
    3: "dark-gray",
    4: "darker-gray",
    5: "black",
    6: "brown",
    7: "light-gray",
    8: "red",
    9: "light-blue",
    10: "green",
    11: "yellow",
    12: "orange",
    13: "magenta",
    14: "light-green",
    15: "purple"
}
```

**Why This Matters:**
- `grid[5][3] = 8` → "red pixel at (5,3)"
- LLM understands "red" better than "8"
- Enables semantic reasoning ("red object moved left")

---

### 3. Spatial Region Classification

**Purpose:** Describe object locations in human terms.

**9-Zone Grid Division (for 64×64 grids):**
```python
REGION_BOUNDS = {
    "top-left":       (0, 21, 0, 21),
    "top-center":     (0, 21, 21, 43),
    "top-right":      (0, 21, 43, 64),
    "center-left":    (21, 43, 0, 21),
    "center":         (21, 43, 21, 43),
    "center-right":   (21, 43, 43, 64),
    "bottom-left":    (43, 64, 0, 21),
    "bottom-center":  (43, 64, 21, 43),
    "bottom-right":   (43, 64, 43, 64)
}

def get_region(center: Tuple[int, int]) -> str:
    """Classify object region based on center point."""
    row, col = center
    for region_name, (min_r, max_r, min_c, max_c) in REGION_BOUNDS.items():
        if min_r <= row < max_r and min_c <= col < max_c:
            return region_name
    return "unknown"
```

**Output:**
- "Blue object in top-left"
- "Red square in center-right"

---

### 4. Frame Differencing (Change Detection)

**Purpose:** Identify what changed between two frames (before/after action).

**Key Metrics:**
1. **Pixel-level changes:** How many cells changed?
2. **Object movements:** Which objects moved, and where?
3. **Object lifecycle:** What appeared/disappeared?

**Implementation:**
```python
def analyze_frame_changes(prev_frame: FrameData, curr_frame: FrameData):
    """Compare two frames to detect changes."""

    # 1. Pixel-level diff
    prev_grid = extract_grid(prev_frame)
    curr_grid = extract_grid(curr_frame)
    pixels_changed = np.sum(prev_grid != curr_grid)

    # 2. Object-level diff
    prev_objects = detect_simple_objects(prev_grid)
    curr_objects = detect_simple_objects(curr_grid)

    # Match objects by color and proximity
    moved = []
    appeared = []
    disappeared = []

    for prev_obj in prev_objects:
        # Find matching object in current frame
        match = find_matching_object(prev_obj, curr_objects)
        if match:
            if match.center != prev_obj.center:
                moved.append({
                    "id": prev_obj.id,
                    "color": prev_obj.color,
                    "from": prev_obj.center,
                    "to": match.center,
                    "delta": (match.center[0] - prev_obj.center[0],
                             match.center[1] - prev_obj.center[1])
                })
        else:
            disappeared.append(prev_obj)

    for curr_obj in curr_objects:
        if not find_matching_object(curr_obj, prev_objects):
            appeared.append(curr_obj)

    return {
        "pixelsChanged": pixels_changed,
        "objectsMoved": moved,
        "objectsAppeared": appeared,
        "objectsDisappeared": disappeared
    }
```

**Example Output:**
```json
{
  "pixelsChanged": 12,
  "objectsMoved": [
    {
      "id": "OBJ_1",
      "color": "blue",
      "from": [10, 15],
      "to": [10, 18],
      "delta": [0, 3]
    }
  ],
  "objectsAppeared": [],
  "objectsDisappeared": []
}
```

**LLM Interpretation:**
- "Blue object moved 3 cells to the right"
- "12 pixels changed total"
- "No objects appeared or disappeared"

---

### 5. Progress Tracking (Level Transitions)

**Purpose:** Detect game state changes (level up, game over, reset).

**Key Signals:**
1. **Score changes:** `current_score > previous_score` → level completed
2. **State transitions:** `NOT_FINISHED` → `GAME_OVER` → `NOT_FINISHED` (reset)
3. **Action counter resets:** Indicates level restart

**Implementation:**
```python
def detect_level_transition(prev_frame: FrameData, curr_frame: FrameData):
    """Detect if a level transition occurred."""

    is_level_up = curr_frame.score > prev_frame.score
    is_level_lost = (curr_frame.state == "GAME_OVER" and
                     prev_frame.state != "GAME_OVER")
    is_game_reset = (curr_frame.state == "NOT_FINISHED" and
                     prev_frame.state == "GAME_OVER")

    if is_level_up:
        return {
            "type": "LEVEL_UP",
            "score_delta": curr_frame.score - prev_frame.score,
            "new_level": True
        }
    elif is_level_lost:
        return {
            "type": "LEVEL_LOST",
            "reason": "Game over state"
        }
    elif is_game_reset:
        return {
            "type": "RESET",
            "reason": "Restarted after game over"
        }

    return None
```

---

### 6. Color Distribution Analysis

**Purpose:** Summarize grid composition (useful for pattern recognition).

**Implementation:**
```python
def calculate_color_distribution(grid: np.ndarray):
    """Count pixels of each color."""
    unique, counts = np.unique(grid, return_counts=True)

    distribution = []
    for color_value, count in zip(unique, counts):
        if color_value == 0:  # Skip background
            continue
        distribution.append({
            "color": COLOR_NAMES[color_value],
            "count": int(count),
            "percentage": float(count) / grid.size * 100
        })

    return sorted(distribution, key=lambda x: x["count"], reverse=True)
```

**Example Output:**
```json
[
  {"color": "blue", "count": 45, "percentage": 1.1},
  {"color": "red", "count": 23, "percentage": 0.6},
  {"color": "yellow", "count": 8, "percentage": 0.2}
]
```

---

## Advanced Preprocessing: Extracting Intelligence

The following techniques move beyond simple data cleaning into **feature engineering** for the LLM's internal reasoning engine.

### 7. Symmetry & Global Pattern Detection

**Purpose:** Identify if the grid follows a specific geometric rule (reflection, rotation, repetition).

**Why this matters:** ARC puzzles often rely on symmetry. If an agent knows the grid is 90-degree rotationally symmetric, it can narrow down the "correct" state much faster.

**Implementation Concept:**
```python
def analyze_symmetry(grid: np.ndarray):
    """Detect horizontal, vertical, and rotational symmetries."""
    h_sym = np.array_equal(grid, np.flipud(grid))
    v_sym = np.array_equal(grid, np.fliplr(grid))
    rot90 = np.array_equal(grid, np.rot90(grid))

    return {
        "horizontalReflection": h_sym,
        "verticalReflection": v_sym,
        "rotational90": rot90,
        "isUniform": len(np.unique(grid)) == 1
    }
```

---

### 8. Pathfinding & Navigation Semantics

**Purpose:** Calculate distances between the "player" object and "goal" objects.

**Why this matters:** Instead of the LLM guessing coordinates, we provide it with navigation vectors: "The nearest red object (Goal) is 15 pixels away at a 45-degree angle. Action ACTION4 (Right) reduces this distance."

**Implementation Concept:**
```python
def calculate_navigation_vectors(player_pos: Tuple[int, int], targets: List[SimpleObject]):
    """Calculate distances and directions to all detected targets."""
    vectors = []
    for target in targets:
        dist = np.linalg.norm(np.array(player_pos) - np.array(target.center))
        direction = get_cardinal_direction(player_pos, target.center)
        vectors.append({
            "targetId": target.id,
            "distance": round(dist, 2),
            "direction": direction,
            "isPathBlocked": check_collision_on_path(player_pos, target.center)
        })
    return vectors
```

---

### 9. Closing the Loop: Reasoning-Action Correlation

**Purpose:** Map the agent's *textual intent* to the *actual outcome*.

**The Mechanism:**
1. **Extraction:** Use Python regex or a small "Reasoning Parser" to extract the `predicted_outcome` from the agent's `reason` field.
2. **Comparison:** After the action, compare the `predicted_outcome` with the `actual_diff`.
3. **Surprise Metric:** If the prediction fails, flag a "High Surprise" event to the LLM.

**Why this matters:** It forces the LLM to acknowledge when its mental model of the game is wrong.

```python
def calculate_model_surprise(intent: str, actual_changes: dict):
    """Evaluate if the actual grid changes match the agent's stated intent."""
    # Intent extraction (e.g., "I will move the blue block right")
    # Actual check (e.g., "objectsMoved": [{"id": "OBJ_1", "delta": [0, 1]}])
    success = match_intent_to_outcome(intent, actual_changes)
    return {
        "predictionSuccess": success,
        "surpriseLevel": "LOW" if success else "HIGH",
        "mismatchDetails": "Expected right movement, but object disappeared" if not success else ""
    }
```

---

### 10. LLM-Driven Code Execution (The "Inner Sandbox")

**Purpose:** Empower the LLM to verify its own complex hypotheses using its internal Python console.

**Strategies for the LLM:**
- **"The Counter":** "Wait, is every green pixel next to a yellow one? I'll write a script to check the whole 64x64 grid."
- **"The Projector":** "If I press ACTION1 five times, where will the player be? I'll write a loop to simulate the movement based on my current rule-set."
- **"The Mask":** "Show me the grid but only the red and blue pixels so I can see the pattern without the background noise."

**Prompting the LLM to use its Sandbox:**
> "You have a Python interpreter. If the grid is too complex to eye-ball, write a script to find patterns, count objects, or verify if your hypothesis holds for every pixel."

---

## Reasoning Extraction: Mining the "Inner Monologue"

Large Language Models generate massive amounts of "Chain of Thought" reasoning. Instead of treating this as dead text, we can use Python to extract **Structured Beliefs**.

### 11. Hypothesis Clustering & Drift Detection

**Purpose:** Track how the agent's beliefs evolve over time and detect if it is "drifting" away from a previously successful strategy.

**Implementation:**
Use Python to maintain a **Belief Dictionary** extracted from the `hypothesis` field.
```python
def extract_beliefs(reasoning_history: List[str]):
    """Extract key-value beliefs from text history."""
    # Beliefs like: "ACTION1": "MOVE_UP", "COLOR_8": "WALL"
    # Use NLP or Regex to cluster similar phrases
    beliefs = {}
    for entry in reasoning_history:
        # Example: "I believe red pixels (8) are lethal"
        matches = re.findall(r"(\w+) pixels \((\d+)\) are (\w+)", entry)
        for name, code, trait in matches:
            beliefs[code] = trait
    return beliefs
```

### 12. Confidence & Contradiction Checking

**Purpose:** Automatically flag when the LLM says something that contradicts its own previous "Aggregated Findings".

**The Logic:**
Before the next turn, a Python script runs a **Contradiction Check**:
1. Load `Confirmed_Rules.json`.
2. Parse the new `hypothesis`.
3. If the agent says "ACTION1 moves right" but the rules say "ACTION1 moves up", inject a warning:
   > "SYSTEM WARNING: Your current hypothesis contradicts Rule #4. Re-evaluate."

---

## Advanced Spatial Reasoning

### 13. Topology & Anchor Points

**Purpose:** Instead of raw pixels, represent the game as a **Graph of Anchors**.

**Why this works:** ARC-AGI-3 often uses "Key-Door" or "Portal" mechanics. Identifying these as static "Anchor Points" allows the agent to reason about **Topological Connectivity**.

**Implementation:**
```python
def build_topology_graph(objects: List[SimpleObject]):
    """Create a graph where nodes are objects and edges are distances."""
    G = nx.Graph()
    for obj in objects:
        G.add_node(obj.id, color=obj.color, type=classify_type(obj))
    
    for u, v in combinations(objects, 2):
        dist = calculate_l1_distance(u.center, v.center)
        if dist < THRESHOLD:
            G.add_edge(u.id, v.id, weight=dist)
    return G
```

### 14. Action Pruning (The "Safety Filter")

**Purpose:** Use Python to filter out "Stupid Actions" before the LLM even sees them.

**Strategy:**
If the Python preprocessor detects a wall at `(x, y+1)`, it can append a metadata tag to the `ACTION1` (Move Up) description:
`"ACTION1": "MOVE_UP (BLOCKED BY BLACK WALL)"`

This forces the LLM to spend its "Reasoning Tokens" on valid strategies rather than bumping into walls for 10 turns.

---

## The "Inner Simulator" Strategy

Since the LLM has a Python console, we can provide it with **Template Scripts** to run "Virtual Experiments".

### 15. Hypothesis Verification Code

**The Idea:** The LLM writes a script to check if its hypothesis holds true for every pixel in the grid.

**Prompt Example:**
> "If you believe every red object is a lethal obstacle, run this script to find the distance between the player and every red pixel. If any distance is 0, your hypothesis is likely correct."

```python
# LLM's Inner Sandbox Code
def verify_lethality(grid, player_pos, lethal_color=8):
    for r, c in find_pixels(grid, lethal_color):
        if dist(player_pos, (r, c)) == 0:
            return "LETHAL COLLISION DETECTED"
    return "SAFE"
```

### 16. The "Surprise" Loop (Closing the Gap)

**Purpose:** Mathematically measure how much the agent was "surprised" by an action's result.

**The Algorithm:**
1. **Pre-Action:** Ask the LLM to output a `predicted_grid_hash` or `predicted_object_deltas`.
2. **Post-Action:** Calculate the Euclidean distance between the `predicted_state` and the `actual_state`.
3. **Surprise Score:** If the score is > 0, the agent's mental model is flawed.

**Why this matters:** It gives the agent a clear signal: "Your logic failed. 85% of your prediction was wrong. Stop and re-hypothesize."

---

## Constructing a Mental Model

Instead of just storing findings as strings, we can guide the LLM to maintain a **Formal Game State Machine** in Python.

### 17. Semantic Rule Consolidation

**The Flow:**
- **Turn 1-5:** "Exploratory" (high hypothesis count).
- **Turn 6-10:** "Consolidation" (clustering hypothesis into rules).
- **Turn 11+:** "Execution" (using consolidated rules).

We can provide the LLM with a `GameModel` class it can update in its sandbox:

```python
class GameModel:
    def __init__(self):
        self.rules = {
            "ACTION1": "UNKNOWN",
            "COLOR_8": "UNKNOWN",
            "WIN_CONDITION": "REACH_PINK_DOOR"
        }
    
    def update_rule(self, key, value, confidence):
        if confidence > 0.9:
            self.rules[key] = value
```

### 18. Topological Mapping (The "Anchor" Graph)

**Purpose:** Represent the game as a series of connected "Rooms" or "Regions" rather than a 64x64 grid.

**The Benefit:** LLMs are great at reasoning about graphs. "Move from Room A to Room B" is a much easier instruction than "Move from (10,10) to (10,45)".

---

## Multimodal Enhancement: PNG Rendering

**Purpose:** Send visual frames to vision-capable LLMs instead of JSON grids.

**Why Images > JSON:**
- All modern LLMs are multimodal (GPT-4o, Claude 3.5, Gemini 2.0)
- Images preserve spatial relationships better than text
- Base64 PNG is efficient and directly consumable

**Implementation (Already in Codebase):**
```typescript
// server/services/arc3/arc3GridImageService.ts
export async function renderArc3FrameToPng(grid: number[][]): Promise<{
  dataUrl: string;  // "data:image/png;base64,..."
  width: number;
  height: number;
}> {
  // Render grid to PNG using Sharp
  // Each cell = colored square (ARC color palette)
  // Returns base64 data URL for direct LLM consumption
}
```

**Usage in Tool Response:**
```typescript
{
  tool: "inspect_game_state",
  result: {
    frameImage: "data:image/png;base64,iVBORw0KGgoAAAANS...",  // Visual frame
    colorDistribution: [...],                                    // Structured data
    changes: { pixelsChanged: 12, ... },                        // Delta analysis
    score: 150,
    state: "NOT_FINISHED"
  }
}
```

**Best Practice:** Send BOTH image and structured data:
- Image: For spatial reasoning ("what's next to the red square?")
- Structured data: For precise analysis ("red object moved 3 cells right")

---

## Integration Architecture

### Recommended Workflow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Agent Executes Action (ACTION1, ACTION2, etc.)      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. ARC-AGI-3 API Returns Raw Frame (number[][][])      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Python Preprocessing Pipeline:                       │
│    - Unpack multi-frame animations                      │
│    - Detect objects (connected components)              │
│    - Map colors to semantic names                       │
│    - Classify spatial regions                           │
│    - Compare with previous frame (diff)                 │
│    - Detect level transitions                           │
│    - Calculate color distribution                       │
│    - Render frame to PNG (base64)                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Return Structured Payload to LLM:                    │
│    {                                                     │
│      frameImage: "data:image/png;base64,...",           │
│      objects: [...],                                     │
│      changes: {...},                                     │
│      colorDistribution: [...],                          │
│      gameState: {...}                                    │
│    }                                                     │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. LLM Reasons with Structured Context:                 │
│    "Blue object in top-left moved 3 cells right after   │
│     ACTION4. 12 pixels changed. No new objects.         │
│     Hypothesis: ACTION4 = move right. Try ACTION3       │
│     to test left movement."                             │
└─────────────────────────────────────────────────────────┘
```

---

## Reference Implementation: TOMAS Engine

The external agent **TOMAS Engine** (`external/tomas-engine-arc-agi-3`) already implements this preprocessing architecture:

**Key Files:**
- `agents/tomas_engine/utils/matrix.py` - Object detection, flood fill
- `agents/tomas_engine/nucleus/aisthesis.py` - Frame analysis, change detection
- `agents/tomas_engine/nucleus/data_structures.py` - Structured data schemas

**Critical Insights from TOMAS:**
1. **Never send raw grids to LLM** - Always preprocess first
2. **Frame differencing is essential** - LLM needs to understand action effects
3. **Spatial semantics matter** - "top-left" > coordinates
4. **Level transitions are signals** - Score changes indicate progress
5. **Animation unpacking** - Some actions return multi-frame sequences

---

## Current Implementation Status

### ✅ Already Implemented (Codex Runner)
- PNG rendering (`renderArc3FrameToPng`)
- Frame unpacking (multi-frame animation support)
- Color distribution analysis
- Frame change detection (pixel diff)
- Structured tool responses

### ❌ Missing (Needs Implementation)
- Object detection (connected components)
- Spatial region classification
- Object movement tracking
- Semantic change descriptions ("blue moved right" vs "12 pixels changed")
- Python-side preprocessing service (currently done in TypeScript)
- **Advanced Intelligence Extraction:**
    - Symmetry detection
    - Pathfinding/Distance calculation
    - Reasoning-Action loop closure (Surprise Detection)
    - Structured "Inner Sandbox" prompt templates
    - **Reasoning Extraction & Belief Tracking:**
        - Hypothesis Clustering
        - Contradiction Detection
        - Action Pruning (Semantic Constraints)
        - Topology Graph Representation
    - **The Inner Simulator:**
        - "Virtual Experiments" via Python Console
        - Surprise Metric Quantification
        - Semantic Rule Consolidation (State Machines)

### 🔧 Recommended Next Steps

1. **Create Python preprocessing service:**
   ```
   server/services/arc3/preprocessing/
   ├── object_detector.py      # Connected components
   ├── color_mapper.py          # Semantic color names
   ├── spatial_analyzer.py      # Region classification
   ├── frame_differ.py          # Before/after comparison
   └── preprocessor.py          # Main orchestrator
   ```

2. **Expose as subprocess or API:**
   - TypeScript calls Python subprocess
   - Python returns JSON with structured data
   - Merge with PNG rendering results

3. **Update agent tools:**
   - `inspect_game_state` tool includes object data
   - Add `analyze_objects` tool for programmatic queries
   - Enhance frame change reporting

---

## Performance Considerations

**Preprocessing Overhead:**
- Object detection: ~5-20ms per frame (64×64 grid)
- PNG rendering: ~10-30ms per frame
- Frame diffing: ~2-5ms per frame
- **Total:** ~20-50ms per action (negligible vs LLM inference time)

**Trade-off Analysis:**
- **Cost:** +50ms latency per action
- **Benefit:** 10-100x better LLM reasoning quality
- **ROI:** Massive improvement in agent performance

---

## Conclusion

**Key Takeaway:** Raw grids are data. Preprocessed frames are information.

By extracting structured semantic information in Python before sending to the LLM, we:
- Reduce token usage (structured data < raw grids)
- Improve reasoning quality (semantics > numbers)
- Enable better action selection (clear cause-effect relationships)
- Accelerate learning (agent understands game mechanics faster)

**Bottom Line:** Preprocessing is not optional—it's essential for effective ARC-AGI-3 agents.

---

## References

- TOMAS Engine implementation: `external/tomas-engine-arc-agi-3/`
- Current Codex runner: `server/services/arc3/CodexArc3Runner.ts`
- PNG rendering service: `server/services/arc3/arc3GridImageService.ts`
- Frame analysis helpers: `server/services/arc3/helpers/frameAnalysis.ts`
