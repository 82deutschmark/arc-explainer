Author: Claude Haiku 4.5
Date: 2026-01-03
PURPOSE: Complete plan for Haiku 4.5 Agent Harness (Python + TypeScript) for ARC-AGI-3.
         Ready for handoff to another developer for implementation.

**This is NOT a specification to follow blindly.**
**This is an architectural pattern + detailed implementation guidance.**

---

## Executive Summary for Next Developer

### What This Plan Covers

1. **Python Backend** (~500 lines)
   - Arc3HaikuAgent: Main game loop using Haiku vision + hypothesis-action-observation
   - arc3_haiku_preprocessor.py: Clean object/change extraction (no math)
   - Event emission: NDJSON over stdout for TypeScript

2. **TypeScript Backend** (~400 lines)
   - Express routes: /api/arc3-haiku/* endpoints
   - HaikuArc3StreamService: Subprocess spawn + event relay
   - SSE streaming: Connect frontend to Python agent

3. **Frontend** (~300 lines)
   - Arc3HaikuPlayground.tsx: Main UI (mirrors Arc3CodexPlayground)
   - Reuses: ConfigPanel, GamePanel, Timeline, ReasoningViewer
   - New: ObservationsList component

**Total Implementation Time**: ~20-30 hours for an experienced developer

### How to Use This Plan

1. **Read the "Core Philosophy" section** - Understand what makes Haiku different
2. **Read "The Core Loop"** - Understand the vision → think → act → observe → learn pattern
3. **Read "Python Preprocessing"** - Understand what data Haiku receives (NO math)
4. **Read "Haiku's System Prompt"** - Understand what we're asking Haiku to do
5. **Scan "UI & Integration Architecture"** - Understand how everything wires together
6. **Check "Files to Create"** - List of all new files needed

### What NOT to Do

- ❌ Don't add entropy, symmetry, or mathematical analysis
- ❌ Don't overthink the UI - mirror existing playgrounds
- ❌ Don't optimize prematurely - get it working first
- ❌ Don't change the philosophy to be more "intelligent" - child-like thinking IS the innovation

### Key Success Metrics

✅ Agent runs autonomously (no human intervention)
✅ Haiku forms hypotheses ("I think ACTION2 will...")
✅ Haiku learns patterns ("ACTION1 moves blue left")
✅ Observations persist across turns
✅ No mathematical complexity metrics anywhere
✅ Can complete 20+ games, win 20%+ of attempts

---

## Core Philosophy

**Haiku is not a mathematician. Haiku is a child learning a new game.**

A child doesn't calculate entropy. A child:
1. **Looks** - "I see a blue square in the corner and a red line"
2. **Thinks** - "If I press this button, maybe the blue square will move"
3. **Acts** - Presses the button
4. **Observes** - "The blue square moved right! The red line is still there"
5. **Learns** - "Pressing that button makes blue things move right"
6. **Repeats** - Goes back to step 1 with new knowledge

**This harness is designed for that exact loop.**

---

## The Haiku 4.5 Advantage

| Aspect | Haiku's Strength |
|--------|-----------------|
| **Vision** | Excellent at describing images in natural language |
| **Speed** | Fast inference → quick iteration loops |
| **Simplicity** | Works best with clear, direct prompts |
| **Child-like** | Great at pattern matching without overthinking |
| **Cost** | Efficient → can run many games |

---

## The Core Loop (Hypothesis-Action-Observation)

```
┌────────────────────────────────────────────────────────┐
│ Step 1: Haiku SEES (Vision Processing)                │
│                                                        │
│ Input: Base64 PNG of game frame                       │
│                                                        │
│ Haiku's Task: Describe EVERYTHING you see             │
│   - "I see a blue square (3x3) in top-left"          │
│   - "There's a red line running horizontally"        │
│   - "The background is white"                         │
│   - "There are yellow pixels in the bottom-right"    │
│   - "Nothing is moving right now"                     │
│                                                        │
│ Output: Elaborate, detailed description (not summary) │
└────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────┐
│ Step 2: Haiku THINKS (Hypothesis Formation)           │
│                                                        │
│ Input:                                                │
│   - Haiku's own description of what it sees          │
│   - What it did last turn (if any)                   │
│   - What happened after last action                  │
│   - What it has learned so far                       │
│                                                        │
│ Haiku's Task: Form a simple hypothesis                │
│   - "I haven't tried moving left yet"                │
│   - "The red line looks like it might be a wall"     │
│   - "I should try ACTION3 and see if blue moves"    │
│   - "My guess: if I press left, the blue might      │
│      move into where the red line is"                │
│                                                        │
│ Output: One simple guess about what will happen      │
└────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────┐
│ Step 3: Haiku ACTS (Action Selection)                 │
│                                                        │
│ Input: Haiku's hypothesis (ACTION 1-6 choice)        │
│                                                        │
│ Output: Execute the action on ARC-AGI-3 API          │
│                                                        │
│ Result: New game frame returned                      │
└────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────┐
│ Step 4: Haiku OBSERVES (Change Detection)             │
│                                                        │
│ Input:                                                │
│   - New game frame (base64 PNG)                      │
│   - Previous frame (for comparison)                  │
│   - What Haiku predicted would happen                │
│                                                        │
│ Haiku's Task: Describe what CHANGED                   │
│   - "The blue square moved 2 cells to the left"     │
│   - "The red line is still exactly where it was"    │
│   - "My prediction was WRONG - I thought red was   │
│      a wall but blue went through it"               │
│   - "Or maybe blue doesn't interact with red"       │
│                                                        │
│ Output: Detailed comparison of old vs new            │
└────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────┐
│ Step 5: Haiku LEARNS (Update Memory)                  │
│                                                        │
│ Input: What Haiku just observed                      │
│                                                        │
│ Haiku's Task: Update what it thinks it knows         │
│   - Observation: "ACTION3 makes blue move left"     │
│   - Observation: "Red objects don't seem to block"  │
│   - Observation: "Score went from 10 to 12"         │
│                                                        │
│ Output: Store learning for next turn                 │
└────────────────────────────────────────────────────────┘
                         ↓
         Loop back to Step 1 with new knowledge
```

---

## Python Preprocessing (Support, Not Analysis)

The Python layer provides **clean, descriptive data** - not mathematical properties.

### What Preprocessing Provides

```python
def preprocess_frame(frame: List[List[int]], prev_frame=None) -> FrameContext:
    """
    Extract STRUCTURAL information to help Haiku understand the grid.

    NO: entropy, symmetry, components, topological analysis
    YES: objects, colors, positions, changes
    """

    return {
        "objects": [
            {
                "shape": "square",
                "color": "blue",
                "position": "top-left",
                "bounds": {"min_row": 5, "max_row": 8, "min_col": 3, "max_col": 6},
                "size_cells": 9
            },
            {
                "shape": "line",
                "color": "red",
                "position": "center-horizontal",
                "bounds": {"min_row": 30, "max_row": 32, "min_col": 0, "max_col": 64},
                "length_cells": 64
            }
        ],
        "grid_state": {
            "width": 64,
            "height": 64,
            "background_color": "white",
            "non_background_pixels": 127
        },
        "changes_from_previous": {
            "pixels_changed": 9,
            "objects_that_moved": [
                {
                    "color": "blue",
                    "from": {"row": 5, "col": 35},
                    "to": {"row": 5, "col": 33},
                    "delta": {"row": 0, "col": -2},
                    "distance": 2
                }
            ],
            "new_objects": [],
            "disappeared_objects": [],
            "summary": "Blue square moved 2 cells left. Red line unchanged."
        },
        "score": {
            "current": 12,
            "previous": 10,
            "delta": 2
        },
        "state": "NOT_FINISHED"
    }
```

### Why This Format

✅ **Haiku can understand it**: "The blue object moved 2 cells left"
✅ **Structured for parsing**: No ambiguity about what changed
✅ **Descriptive, not mathematical**: Human-readable positions and movements
✅ **Minimal**: Only what matters for decision-making
✅ **Comparative**: Shows before/after

---

## Haiku's System Prompt

```
You are learning a new game by playing it and observing what happens.

You have human-like curiosity but also human limitations - you don't do math,
you just observe and remember patterns.

WHAT YOU DO:
1. LOOK at the game picture and describe EVERYTHING you see
   - Describe shapes, colors, positions
   - Don't count pixels or calculate - just describe what you see
   - Be detailed and specific: "blue square in top-left corner" not "blue object"

2. THINK about what might happen
   - Remember what you did before and what happened
   - Form a simple guess: "I think if I press left, the blue will move left too"
   - Be a child: make guesses, don't overthink

3. ACT by choosing an action
   - ACTION1-5: Try different things
   - ACTION6: Click on something specific

4. OBSERVE what actually happened
   - Look at the new picture
   - Describe what changed: "The blue moved 2 cells left, the red stayed"
   - Compare to what you predicted: "I was right!" or "That's weird, I didn't expect that"

5. LEARN
   - Update what you think you know
   - Remember observations for next turn: "ACTION1 makes blue move left"

IMPORTANT:
- Don't try to be perfect - you're learning, so mistakes are okay
- Don't calculate or analyze - just observe
- Don't overthink - make simple hypotheses
- Do describe everything - every color, every shape, every detail
- Do remember patterns - "this is like before"
- Do stay curious - keep trying different things

Let's play this game and see what happens!
```

---

## Information Flow to Haiku

### Input Structure

```
System Message:
"You are learning a new game. Look at the picture and describe everything..."

User Message:
{
  "turn": 5,
  "game_state": "NOT_FINISHED",
  "score": {"current": 12, "previous": 10, "changed": true},

  "what_you_know": [
    "ACTION1 makes the blue square move left",
    "The red line doesn't move when I press buttons",
    "When score changes, something good happened"
  ],

  "what_just_happened": "You pressed ACTION3. The blue square moved 2 cells down. The score didn't change. The red line is still in the same place.",

  "your_previous_guess": "I thought ACTION3 might move things down, and I was RIGHT!",

  "prompt": "Now look at the new picture above. Describe everything you see. What do you think will happen if you try a new action? Pick an action (ACTION1-6) and explain your guess."
}

Message Content:
[
  {"type": "image_url", "image_url": {"url": "data:image/png;base64,iVBORw0KGg..."}},
  {"type": "text", "text": <see above>}
]
```

### Output Structure (Action Response)

```python
{
    "action": "ACTION2",  # Or ACTION1-6
    "reasoning": "I want to move the blue square to the right. I've tried left (ACTION1) and down (ACTION3). Right might be ACTION4. Let me try it.",
    "description": "I see the blue square is now in the center of the grid. The red line is above it. If I press right, maybe the blue will move closer to the red line. I'm curious to see what happens."
}
```

---

## What Haiku Actually Does (Per Turn)

### Turn 1 (No History)
```
Haiku sees: Base64 PNG image
Haiku describes: "I see a grid with white background. There's a blue square (about 3x3) in the top-left area. There's a red horizontal line going across the middle. There are some yellow pixels scattered in the bottom-right corner."

Haiku thinks: "I have no idea what this game is about. Let me try something simple. I'll press left (ACTION1) and see if anything moves."

Haiku acts: ACTION1

Result: Blue square moved left by 2 cells, score increased by 1

Haiku learns: "ACTION1 made something move! The blue square went left and the score increased. Maybe ACTION1 = move left and the game rewards me for moving blue."
```

### Turn 2 (With History)
```
Haiku sees: New game picture with blue square now 2 cells to the left

Haiku describes: "The blue square is now further left than before. It's still a 3x3 blue square. The red line is still there. The yellow pixels are still scattered. But wait... the score shows 11 now instead of 10, so I earned a point."

Haiku thinks: "Last time I pressed ACTION1 and the blue moved left. I'm learning! If ACTION1 = move left, maybe ACTION4 = move right? Or maybe there are other rules. Let me think about the red line - could it be important? Maybe I should try ACTION2 (moving right?)."

Haiku acts: ACTION2

Result: Nothing changed. Score stayed at 11.

Haiku learns: "ACTION2 didn't do anything visible. Or maybe I need to be more specific. ACTION1 definitely moves things left though. Let me remember that."
```

### Turn N (With Rich Memory)
```
Haiku sees: [image]

Haiku describes: [Elaborate description of current state]

Haiku thinks: "I know that:
- ACTION1 moves blue left (+1 score)
- ACTION2 doesn't seem to do anything
- ACTION3 moves blue down (+1 score)
- ACTION5 makes yellow flash briefly

I haven't tried ACTION6 yet. And I haven't figured out what the red line does. The score is at 25. Maybe I need to get blue to touch the red line? Let me try moving the blue to the right edge - that's a direction I haven't explored."

Haiku acts: ACTION4 (hypothesizing it moves right)

Haiku observes: Blue moved right by 1 cell. Score increased by 1. Still hasn't touched red line.

Haiku learns: "ACTION4 works! It moves blue right. But slowly - 1 cell at a time while ACTION1 moves 2. Interesting."
```

---

## Python Layer: Clean Data Extraction

### File: `server/python/arc3_haiku_preprocessor.py`

```python
"""
Haiku 4.5 Preprocessing - Extract clean, descriptive data.
NOT mathematical analysis.
"""

def extract_objects(grid: List[List[int]]) -> List[Dict]:
    """
    Find discrete objects (connected components) with descriptions.

    Returns:
    [
        {
            "color": "blue",
            "shape": "square",  # heuristic: mostly square, line, scattered, etc
            "position": "top-left",  # 9-zone grid
            "bounds": {...},
            "size": 9,
            "center": (10, 5)
        },
        ...
    ]
    """

def detect_changes(prev_grid, curr_grid) -> Dict:
    """
    Find what changed between frames.

    Returns:
    {
        "pixels_changed": 9,
        "objects_moved": [
            {
                "color": "blue",
                "from_center": (12, 5),
                "to_center": (12, 7),
                "delta": (0, 2),
                "description": "Blue square moved 2 cells right"
            }
        ],
        "new_objects": [],
        "disappeared_objects": [],
        "summary": "Blue square moved 2 cells right"
    }
```

### What's NOT in the Preprocessor

❌ Entropy calculations
❌ Symmetry analysis
❌ Topological graphs
❌ Color histograms (counts)
❌ Mathematical properties
❌ Surprise metrics
❌ Frustration scores

**Why?** Haiku doesn't need these. They add complexity and don't help a child-like learner.

---

## Haiku's Memory (Game State)

```python
class HaikuGameState:
    def __init__(self):
        # What Haiku has directly observed
        self.observations = []
        # Examples:
        #  - "ACTION1 moves blue left"
        #  - "Red line never moves"
        #  - "Score increases when blue moves"

        self.action_history = []
        # [ACTION1, ACTION3, ACTION1, ACTION4, ...]

        self.frame_sequence = []
        # Keep last 5 frames for context

        self.descriptions = []
        # Last 3 descriptions Haiku gave
        # Helps maintain continuity

    def add_observation(self, obs: str):
        """Add something Haiku learned."""
        self.observations.append(obs)
        # Keep last 10
        if len(self.observations) > 10:
            self.observations = self.observations[-10:]

    def is_exploring_new_direction(self) -> bool:
        """Is Haiku trying something it hasn't tried before?"""
        # If last 3 actions are all different, exploring
        return len(set(self.action_history[-3:])) == 3

    def is_stuck(self) -> bool:
        """Did Haiku do the same thing 5 times with no change?"""
        if len(self.action_history) < 5:
            return False
        last_5 = self.action_history[-5:]
        return len(set(last_5)) == 1
```

---

## Complete Agent Flow

### File: `server/python/arc3_haiku_agent.py`

```python
#!/usr/bin/env python3
"""
Haiku 4.5 Agent for ARC-AGI-3
Vision-first, child-like learning, hypothesis-driven
"""

class Arc3HaikuAgent:
    def __init__(self, api_key: str, anthropic_key: str):
        self.game_state = HaikuGameState()
        self.arc3_client = Arc3ApiClient(api_key)
        self.anthropic_client = Anthropic(api_key=anthropic_key)

    async def play_game(self, game_id: str, max_turns: int = 80):
        """Main game loop."""

        # Open scorecard and start game
        card_id = self.arc3_client.open_scorecard(
            tags=["haiku-4-5", "vision-first"],
            opaque_metadata={"agent": "haiku-4-5", "model": "claude-haiku-4-5"}
        )
        frame_data = self.arc3_client.start_game(game_id)

        for turn in range(1, max_turns + 1):
            # Step 1: Render frame to PNG
            frame_image_b64 = render_frame_to_base64(frame_data["frame"])

            # Step 2: Preprocess for context
            context = self.preprocess_for_haiku(
                current_frame=frame_data["frame"],
                previous_frame=self.game_state.frame_sequence[-1] if self.game_state.frame_sequence else None
            )

            # Step 3: Build message for Haiku
            message = self.build_haiku_message(
                turn=turn,
                frame_image=frame_image_b64,
                context=context,
                observations=self.game_state.observations,
                previous_action=self.game_state.action_history[-1] if self.game_state.action_history else None
            )

            # Step 4: Call Haiku with vision
            response = self.anthropic_client.messages.create(
                model="claude-haiku-4-5-20241022",
                max_tokens=500,
                system=HAIKU_SYSTEM_PROMPT,
                messages=[message]
            )

            # Step 5: Parse Haiku's response
            action_choice = self.parse_action_response(response.content[0].text)

            # Step 6: Execute action
            frame_data = self.arc3_client.execute_action(
                game_id=game_id,
                guid=frame_data["guid"],
                action=action_choice["action"],
                coordinates=action_choice.get("coordinates"),
                reasoning=action_choice.get("reasoning")
            )

            # Step 7: Record observation
            self.game_state.add_observation(
                self.extract_observation(action_choice, frame_data)
            )
            self.game_state.action_history.append(action_choice["action"])
            self.game_state.frame_sequence.append(frame_data["frame"])

            # Step 8: Check game state
            if frame_data["state"] == "WIN":
                emit_event("game.won", {"turn": turn, "score": frame_data["score"]})
                break
            elif frame_data["state"] == "GAME_OVER":
                emit_event("game.over", {"turn": turn, "score": frame_data["score"]})
                break

            # Small delay to avoid rate limiting
            await asyncio.sleep(0.2)

        # Close scorecard
        self.arc3_client.close_scorecard()

    def preprocess_for_haiku(self, current_frame, previous_frame):
        """Extract clean, descriptive context."""
        return {
            "objects": extract_objects(current_frame),
            "changes": detect_changes(previous_frame, current_frame) if previous_frame else None,
            "score": current_frame.get("score", 0),
            "state": current_frame.get("state", "NOT_FINISHED")
        }

    def build_haiku_message(self, turn, frame_image, context, observations, previous_action):
        """Build the message that goes to Haiku."""

        context_text = f"""Turn {turn}:
Current score: {context['score']}
Game state: {context['state']}

Objects I can see:
"""
        for obj in context['objects']:
            context_text += f"- {obj['color'].title()} {obj['shape']} at {obj['position']}\n"

        if context['changes']:
            context_text += f"\nWhat just changed:\n"
            context_text += f"{context['changes']['summary']}\n"

        if observations:
            context_text += f"\nWhat I've learned so far:\n"
            for obs in observations[-3:]:  # Last 3 observations
                context_text += f"- {obs}\n"

        context_text += f"\nLook at the picture above. Describe everything you see. What do you think will happen next? Pick an action and explain your guess."

        return {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{frame_image}"}},
                {"type": "text", "text": context_text}
            ]
        }

    def parse_action_response(self, response_text: str) -> Dict:
        """Extract action choice from Haiku's response."""
        # Haiku will say something like "I'll try ACTION2 because..."
        # Parse to extract the action

        action_match = re.search(r'ACTION([1-6])', response_text, re.IGNORECASE)
        if action_match:
            action = f"ACTION{action_match.group(1)}"
        else:
            action = "ACTION1"  # Default

        # Extract coordinates for ACTION6 if present
        coord_match = re.search(r'coordinates?\s*\(?\s*(\d+)\s*[,\s]\s*(\d+)\s*\)?', response_text)
        coordinates = None
        if action == "ACTION6" and coord_match:
            coordinates = (int(coord_match.group(1)), int(coord_match.group(2)))

        return {
            "action": action,
            "reasoning": response_text,
            "coordinates": coordinates
        }

    def extract_observation(self, action_choice: Dict, frame_data: Dict) -> str:
        """Extract learning from what happened."""
        action = action_choice["action"]
        # This will be filled in by looking at frame changes
        # Example: "ACTION2 moved the blue square to the right and increased the score"
        return f"Tried {action} and observed: {action_choice['reasoning'][:100]}"
```

---

## Key Design Principles

### 1. Vision First
- Always render to PNG
- Let Haiku describe the image
- Trust its visual understanding

### 2. Child-Like Thinking
- Simple hypotheses ("I think X will happen")
- Direct observation ("X did happen")
- Learning by doing, not by calculating

### 3. Elaborate Description
- "Blue 3x3 square" not "1 object"
- "Red line running horizontally" not "16 pixels"
- Every detail matters for understanding

### 4. Minimal Context
- No mathematical properties
- No complexity metrics
- Only: objects, positions, changes, score

### 5. Iterative Learning
- Each turn Haiku learns something
- Observations persist to next turn
- Patterns emerge naturally

---

## Why This Works for Haiku

| Strength | How Harness Uses It |
|----------|-------------------|
| **Vision** | Describe elaborate image details |
| **Speed** | Quick turn cycles, fast learning |
| **Simplicity** | Child-like reasoning, no math |
| **Language** | Describe everything in words |
| **Pattern matching** | Learn from observation, not calculation |

---

## Implementation Checklist

### Phase 1: Core Preprocessing (~2 hours)
- [ ] `arc3_haiku_preprocessor.py` - clean object/change extraction
- [ ] `render_frame_to_base64()` - PNG rendering
- [ ] No entropy, symmetry, or mathematical analysis
- [ ] Focus on object positions and changes

### Phase 2: Agent Loop (~3 hours)
- [ ] `arc3_haiku_agent.py` - main game loop
- [ ] `HaikuGameState` - observation memory
- [ ] `build_haiku_message()` - context building
- [ ] `parse_action_response()` - action extraction

### Phase 3: System Prompt (~1 hour)
- [ ] Write HAIKU_SYSTEM_PROMPT
- [ ] Emphasize vision, description, child-like thinking
- [ ] Include learning loop explanation

### Phase 4: Integration (~2 hours)
- [ ] Connect to ARC-AGI-3 API
- [ ] Connect to Anthropic API
- [ ] Test with 1 game
- [ ] Verify base64 images rendering

### Phase 5: Polish (~2 hours)
- [ ] Test on 10+ games
- [ ] Refine system prompt based on behavior
- [ ] Add better change detection if needed
- [ ] Document results

---

## Success Criteria

1. **Haiku plays autonomously** - No human intervention needed
2. **Describes images elaborately** - "I see a blue square" not "1 object"
3. **Forms hypotheses** - "I think ACTION2 will make it move left"
4. **Learns patterns** - "ACTION1 moves things left" appears in observations
5. **No mathematical gunk** - Zero entropy, symmetry, components
6. **Fast iteration** - Completes 20-30 turns in <2 minutes
7. **Reasonable performance** - Can win at least 20% of games attempted

---

## UI & Integration Architecture

### Complete Playg round (Frontend + Backend + Python)

The Haiku agent needs a full playground UI that mirrors the existing Codex and OpenRouter playgrounds:

```
Frontend (React/TypeScript)
    ↓ POST /api/arc3-haiku/stream/prepare
API Routes (/api/arc3-haiku-*)
    ↓ GET /api/stream/arc3-haiku?sessionId=X
Stream Service (SSE management)
    ↓ spawn subprocess
Agent Service (Routes → Python)
    ↓ python subprocess
Python Backend (arc3_haiku_agent.py)
    ↓ HTTP calls
ARC-AGI-3 API + Anthropic API
```

---

### Frontend: Arc3HaikuPlayground.tsx

**File**: `client/src/pages/Arc3HaikuPlayground.tsx`

**Pattern**: Mirror `Arc3CodexPlayground.tsx` exactly

Core features:
- Configuration panel (game selector, max turns, agent name)
- Game display panel (current frame rendering, score, state)
- Agent vision panel (what Haiku sees, current hypothesis)
- Observations list (learned patterns)
- Timeline (action history, reasoning per turn)

Reuse components:
- `Arc3ConfigurationPanel` - game, turns, agent name
- `Arc3GamePanel` - frame rendering + metadata
- `Arc3ToolTimeline` - action history
- `Arc3ReasoningViewer` - Haiku's thoughts

New components:
- `Arc3ObservationsList` - display learned observations

Event flow:
```typescript
// Click "Start Agent"
→ POST /api/arc3-haiku/stream/prepare (get sessionId)
→ Subscribe to GET /api/stream/arc3-haiku?sessionId=X (SSE)
→ Parse events: agent.description, agent.hypothesis, game.frame_update, agent.observation, etc.
→ Update UI components
→ Display: "Turn 5: [Image] Haiku says: 'I see...' → ACTION2 → [New image] 'Blue moved left'"
```

---

### Backend: Express Routes

**File**: `server/routes/arc3Haiku.ts`

**Pattern**: Mirror `server/routes/arc3Codex.ts`

Endpoints:

```typescript
// 1. Prepare streaming session
POST /api/arc3-haiku/stream/prepare
Body: {
  game_id?: string;
  agentName?: string;
  maxTurns?: number;
  temperature?: number;
}
Response: { sessionId: string }

// 2. Subscribe to SSE stream
GET /api/stream/arc3-haiku?sessionId=X
Response: Server-Sent Events
Event types: agent.starting, agent.description, agent.hypothesis,
             agent.tool_call, game.frame_update, agent.observation, agent.completed

// 3. Manual action (for debugging)
POST /api/arc3-haiku/manual-action
Body: { game_id, guid, action, coordinates? }
Response: { frame, score, state }

// 4. Cancel session
POST /api/arc3-haiku/stream/cancel
Body: { sessionId: string }
Response: { cancelled: true }
```

Validation:

```typescript
const runSchema = z.object({
  game_id: z.string().trim().max(120).optional(),
  agentName: z.string().trim().max(60).optional(),
  maxTurns: z.coerce.number().int().min(2).max(200).optional(),
  temperature: z.coerce.number().min(0).max(1).optional(),
});
```

---

### Stream Service: HaikuArc3StreamService

**File**: `server/services/arc3/HaikuArc3StreamService.ts`

**Pattern**: Mirror existing CodexArc3StreamService

Responsibilities:
- Save pending config from /prepare endpoint
- Spawn Python subprocess: `python3 server/python/arc3_haiku_agent.py --game-id X --api-key Y`
- Parse NDJSON events from subprocess stdout
- Emit events to SSE stream via `SSEStreamManager`
- Handle subprocess cleanup on error/completion

Communication protocol (NDJSON over subprocess stdout):

```python
# From Python agent
print(json.dumps({"type": "agent.starting", "data": {...}}), flush=True)
print(json.dumps({"type": "agent.description", "data": {"content": "I see..."}}), flush=True)
print(json.dumps({"type": "agent.hypothesis", "data": {"content": "I think..."}}), flush=True)
print(json.dumps({"type": "agent.tool_call", "data": {"action": "ACTION1"}}), flush=True)
print(json.dumps({"type": "game.frame_update", "data": {"frame": [...], "score": 42}}), flush=True)
print(json.dumps({"type": "agent.observation", "data": {"content": "ACTION1 moves blue left"}}), flush=True)
print(json.dumps({"type": "agent.completed", "data": {"final_score": 100, "turns": 25}}), flush=True)
```

Implementation sketch:

```typescript
class HaikuArc3StreamService {
  async startAgent(sessionId: string) {
    const config = this.pendingPayloads.get(sessionId);
    const pythonProcess = spawn('python3', [
      'server/python/arc3_haiku_agent.py',
      '--game-id', config.game_id,
      '--api-key', process.env.ARC3_API_KEY,
      '--anthropic-key', process.env.ANTHROPIC_API_KEY,
      '--max-turns', config.maxTurns || '80',
    ]);

    pythonProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(line => {
        const event = JSON.parse(line);
        sseStreamManager.emit(sessionId, event.type, event.data);
      });
    });

    pythonProcess.on('close', (code) => {
      sseStreamManager.emit(sessionId, 'stream.closed', { code });
    });
  }
}
```

---

### Python: Arc3HaikuAgent Main Entry Point

**File**: `server/python/arc3_haiku_agent.py`

Entry point that handles command-line arguments:

```python
#!/usr/bin/env python3
import argparse
import asyncio
import sys

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--game-id', required=True)
    parser.add_argument('--api-key', required=True)
    parser.add_argument('--anthropic-key', required=True)
    parser.add_argument('--max-turns', type=int, default=80)

    args = parser.parse_args()

    agent = Arc3HaikuAgent(
        arc3_api_key=args.api_key,
        anthropic_api_key=args.anthropic_key
    )

    try:
        asyncio.run(agent.play_game(args.game_id, args.max_turns))
    except Exception as e:
        emit_event("stream.error", {"message": str(e)})
        sys.exit(1)

if __name__ == "__main__":
    main()
```

---

### Integration Checklist

**Routes Registration** (in `server/routes.ts`):
- [ ] Import arc3HaikuRouter: `import arc3HaikuRouter from "./routes/arc3Haiku"`
- [ ] Register route: `app.use("/api/arc3-haiku", arc3HaikuRouter)`

**Frontend Route** (in `client/src/App.tsx`):
- [ ] Import Arc3HaikuPlayground: `import Arc3HaikuPlayground from './pages/Arc3HaikuPlayground'`
- [ ] Add route: `<Route path="/arc3/haiku-playground" component={Arc3HaikuPlayground} />`

**Navigation** (Update navigation menus):
- [ ] Add link to `/arc3/haiku-playground`
- [ ] Label: "Haiku Agent Playground" or "Haiku 4.5 Explorer"

---

## Files to Create

```
server/python/
├── arc3_haiku_preprocessor.py     [NEW] Clean data extraction (objects, changes)
├── arc3_haiku_agent.py             [NEW] Main game loop + entry point
├── arc3_haiku_utils.py             [NEW] Helpers (render_to_base64, parse_action)
└── arc3_haiku_main.py              [NEW] Entry point for subprocess

server/services/arc3/
└── HaikuArc3StreamService.ts       [NEW] Subprocess spawn + event relay

server/routes/
└── arc3Haiku.ts                    [NEW] Express routes (/stream/prepare, /stream, etc)

client/src/pages/
└── Arc3HaikuPlayground.tsx         [NEW] Main UI (mirrors Arc3CodexPlayground)

client/src/components/arc3/
└── Arc3ObservationsList.tsx        [NEW] Display Haiku's learned observations

shared/types.ts
├── Add HaikuConfig interface
├── Add HaikuFrameContext interface
└── Add HaikuAgentEvent union type

docs/
├── arc3-haiku-agent-guide.md       [NEW] User documentation
└── arc3-haiku-integration-guide.md [NEW] Developer integration guide
```

---

## This Is the Right Approach Because

1. **Matches Haiku's abilities** - Vision, speed, simplicity
2. **Actually teaches the model** - Through observation, not math
3. **Minimal complexity** - <500 lines of core agent code
4. **Extensible** - Easy to improve observations, prompt, action parsing
5. **Different from other approaches** - Uses Anthropic's actual strength (vision + simplicity)

---

## Quick Example: What Haiku Actually Says

```
Turn 1:

[Image shown]

"I see a 64x64 grid with white background. In the top-left corner (roughly around coordinates 5-15, 3-13) there's a blue square that's about 3 cells wide and 3 cells tall. Below that are some red pixels arranged in a horizontal line across the middle of the grid. On the right side are scattered yellow pixels. I haven't seen anything move yet. Let me try pressing something to see what happens. I'll try ACTION1 first and see if it makes the blue square move. My guess is that ACTION1 might move things to the left since that's the first action."

ACTION1 chosen → Blue moves left, score increases to 1

Turn 2:

[New image shown]

"The blue square has moved to the left by about 2 cells from where it was before. The red line is still in the same place. The yellow pixels haven't moved. The score increased from 0 to 1, which suggests that moving the blue square was good. I'm starting to think ACTION1 = move left. But I should test other actions to see what they do. Let me try ACTION3 next. I'm guessing ACTION3 might move things down, since the layout is kind of: 1=left, 2=right, 3=down, 4=up? Let me try it."

ACTION3 chosen → Blue moves down, score increases to 2

Turn 3:

"Yes! The blue moved down again. So my hypothesis was right: ACTION3 = move down. The red line is now above and to the right of the blue square. I wonder if there's something special about the red line - maybe I need to reach it? Or maybe red objects are obstacles I should avoid? The yellow pixels on the right are interesting - I haven't interacted with them yet. Maybe I should move the blue toward them to see what happens."

ACTION4 chosen → ...
```

That's the whole thing. Simple, descriptive, learning from observation.
