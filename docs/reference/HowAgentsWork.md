# How Agents Work

> Understanding agent perception, decision-making, and orchestration in ARC-AGI-3

This guide explains the core concepts of how agents perceive game state, make decisions, and are orchestrated to play ARC-AGI-3 games.

## The Agent Loop

Every agent follows a fundamental cycle:

```
1. Receive game state (FrameData)
2. Process/understand the state
3. Choose an action
4. Execute action via API
5. Receive new state
6. Repeat until WIN or GAME_OVER
```

This loop is implemented in `agents/agent.py` (lines 78-88):

```python
while not self.is_done(self.frames, self.frames[-1]) and self.action_counter <= self.MAX_ACTIONS:
    action = self.choose_action(self.frames, self.frames[-1])
    if frame := self.take_action(action):
        self.append_frame(frame)
    self.action_counter += 1
```

Every agent must implement two methods:
- `is_done()`: Determines if the game is finished
- `choose_action()`: Decides what action to take next

## How Agents "See" the Game

The game communicates through **FrameData** objects (defined in `agents/structs.py`):

```python
class FrameData:
    game_id: str                              # Which game is being played
    frame: list[list[list[int]]]              # 3D array of integers
    state: GameState                          # WIN, GAME_OVER, or NOT_FINISHED
    score: int                                # Current score (0-254)
    action_input: ActionInput                 # What action was just taken
    guid: str                                 # Session identifier
    available_actions: list[GameAction]       # Which actions are currently valid
```

### The Frame Structure

The `frame` field is a 3D array: `[Grid1, Grid2, ...]`

- **Multiple grids per frame**: One action can produce multiple sequential grid states
- **Grid dimensions**: Each grid can be up to 64x64
- **Cell values**: Integers 0-15 representing different states/colors
- **Coordinate system**: (0,0) is top-left

Example:
```python
frame = [
    [[1, 2, 3], [4, 5, 6]],    # Grid 0: 2x3 grid
    [[7, 8, 9], [10, 11, 12]]   # Grid 1: 2x3 grid
]
```

### Different Agent Perception Modes

Agents transform raw frame data differently depending on their architecture:

**Text-Based Agents** (LLM, FastLLM, SmolCodingAgent):
```
Grid 0:
  [1, 2, 3]
  [4, 5, 6]

Grid 1:
  [7, 8, 9]
  [10, 11, 12]
```

**Vision-Based Agents** (SmolVisionAgent):
- Convert integers to RGB colors using a 16-color palette
- Each grid becomes an actual PIL Image
- Agent sees colored pixels instead of numbers
- Can detect visual patterns, rotations, symmetries

See `grid_to_image()` in `agents/templates/smolagents.py:408-454`

## Agent Architectures

### 1. Basic LLM Agent (`llm_agents.py:22-556`)

**How it works:**
- Uses OpenAI function calling
- Sends text representation of grid to LLM
- LLM must call a function/tool representing an action
- Each decision is one API call

**Decision flow:**
```
1. Build text prompt with current grid state
2. Send to OpenAI API
3. LLM returns function call (ACTION1-ACTION7)
4. Execute that action
5. Repeat
```

**Optional observation mode** (`DO_OBSERVATION=True`):
- Makes TWO API calls per turn
- First call: "What do you observe about this state?"
- Second call: "What action should you take?"
- Allows model to think before acting
- More tokens but potentially better decisions

**Key code** (`llm_agents.py:62-212`):
```python
def choose_action(self, frames, latest_frame):
    # Build prompt from frame
    user_prompt = self.build_user_prompt(latest_frame)

    # Optional: Let model observe first
    if self.DO_OBSERVATION:
        # Call 1: Observation
        # Call 2: Action choice

    # Call API with tools/functions
    parsed = self._call_responses(client, messages=self.messages, tools=tools)

    # Extract action from tool call
    action = GameAction.from_name(tool_call['function']['name'])
    return action
```

### 2. SmolCodingAgent (`smolagents.py:24-242`)

**Key difference:** The agent writes and executes Python code to reason about the game.

**How it works:**
- Converts game actions into Python tools using `@tool` decorator
- Agent receives prompt and ALL available tools
- Agent can write code using algorithms: BFS, DFS, A*, pattern detection, loops
- ONE `agent.run()` call that executes autonomously until done

**Example decision process:**
```python
# Agent might write code like:
def analyze_pattern(grid):
    # Detect if grid has symmetry
    for i in range(len(grid)):
        for j in range(len(grid[0])):
            if grid[i][j] != grid[-(i+1)][-(j+1)]:
                return False
    return True

# Then decide: "Pattern is symmetric, ACTION5 should mirror it"
```

**Architecture:**
```python
def main(self):
    model = OpenAIServerModel(self.MODEL)

    # CodeAgent can manipulate tools as Python functions
    agent = CodeAgent(
        model=model,
        planning_interval=10,
        tools=self.build_tools(),  # All game actions as Python functions
    )

    # Single autonomous run
    prompt = self.build_initial_prompt(self.frames[-1])
    response = agent.run(prompt, max_steps=self.MAX_ACTIONS)
```

**Tool creation** (`smolagents.py:110-189`):
- Each GameAction becomes a Python function
- Simple actions: `def action1() -> str:`
- Complex actions: `def action6(x: int, y: int) -> str:`
- Tools execute the action and return new game state as text

### 3. SmolVisionAgent (`smolagents.py:244-477`)

**Key difference:** Sees images instead of text.

**How it works:**
- Same tool-based architecture as SmolCodingAgent
- But: Converts grids to RGB images using 16-color palette
- Uses ToolCallingAgent (not CodeAgent) with multimodal model
- Tools return `AgentImage` objects instead of strings
- Agent can detect visual patterns, color changes, spatial relationships

**Color mapping** (`smolagents.py:410-427`):
```python
color_map = [
    (0, 0, 0),       # 0: Black
    (0, 0, 170),     # 1: Dark Blue
    (0, 170, 0),     # 2: Dark Green
    # ... 13 more colors
    (255, 255, 255), # 15: White
]
```

**Architecture:**
```python
def main(self):
    agent = ToolCallingAgent(
        model=model,
        tools=self.build_tools(),
        planning_interval=10,
    )

    # Start with initial image
    initial_image = self.grid_to_image(self.frames[-1].frame)
    agent.run(prompt, max_steps=self.MAX_ACTIONS, images=[initial_image])
```

### 4. ReasoningAgent & Responses API

**Key difference:** Uses OpenAI's new Responses API which preserves reasoning state between turns.

**Why this matters:**
- Old Chat Completions API: Reasoning tokens are discarded after each response
- New Responses API: Reasoning state persists via `previous_response_id`
- Like "keeping a detective's notebook open" across the entire game
- The model can build on its previous reasoning instead of starting fresh each turn

**Key features** (from `docs/ResponsesAPI.md`):
1. **Stateful reasoning chains**: Pass `previous_response_id` to maintain thought process
2. **Extended thinking**: Model can spend more tokens on internal reasoning
3. **Reasoning tokens preserved**: Critical for multi-turn puzzle solving
4. **Better tool chaining**: Reasoning survives between tool calls

**Implementation details:**
```python
def _call_responses(self, client, messages, tools=None):
    payload = {
        "model": self.MODEL,
        "messages": messages,
    }

    # Key: Pass previous response ID to maintain reasoning state
    if self._last_response_id:
        payload["previous_response_id"] = self._last_response_id

    # Enable extended reasoning
    if self.REASONING_EFFORT:
        payload["reasoning_effort"] = self.REASONING_EFFORT
        payload["max_output_tokens"] = 16920   ## USE HIGH LIMITS!!!

    response = responses_create(client, **payload)

    # Save response ID for next turn
    self._last_response_id = response.id
```

## Agent Variants by Model

### LLM (`--agent=llm`)
- Model: `gpt-5-nano`
- Full observation mode  WILL BE COSTLY!
- Standard function calling
- 10-message history limit

### FastLLM (`--agent=fastllm`)
- Model: `gpt-5-nano`
- `DO_OBSERVATION=False` - skips observation step
- Faster but potentially less informed decisions
- Good for: Simple games, rapid iteration

### ReasoningLLM (`--agent=reasoningllm`)  `This is the one we want to use!`
- Model: `gpt-5-nano`
- Captures detailed reasoning metadata
- Stores reasoning in `action.reasoning` field  (make sure this is properly using the new Responses API)
- Good for: Understanding model's thought process

### GuidedLLM (`--agent=guidedllm`)
- Model: `gpt-5-mini`
- High reasoning effort
- Includes explicit game-specific rules in prompt
- Educational purposes only (doesn't generalize)

## Swarm Orchestration is not relevant to our use case

Multiple agents can play multiple games simultaneously using the **Swarm** (`agents/swarm.py`).  THIS IS NOT SOMETHING WE ARE INTERESTED IN DOING FOR OUR PURPOSES HERE.


## Action Selection

Agents choose from 8 possible actions (defined in `agents/structs.py:122-182`):

```python
class GameAction(Enum):
    RESET = (0, SimpleAction)      # Initialize/restart game
    ACTION1 = (1, SimpleAction)    # Simple action (often: up)
    ACTION2 = (2, SimpleAction)    # Simple action (often: down)
    ACTION3 = (3, SimpleAction)    # Simple action (often: left)
    ACTION4 = (4, SimpleAction)    # Simple action (often: right)
    ACTION5 = (5, SimpleAction)    # Simple action (often: interact/select)
    ACTION6 = (6, ComplexAction)   # Complex action with x,y coordinates (0-63)
    ACTION7 = (7, SimpleAction)    # Simple action (often: undo)
```

**SimpleAction:** No parameters needed
**ComplexAction:** Requires x and y coordinates (0-63 range)

Each turn, `available_actions` tells the agent which actions are currently valid for that specific game.

## Comparing Architectures

| Feature | Basic LLM | SmolCoding | SmolVision | Responses API |
|---------|-----------|------------|------------|---------------|
| **Perception** | Text grids | Text grids | RGB images | Text grids |
| **Reasoning** | Function calling | Code generation | Tool calling + vision | Stateful reasoning |
| **API Calls** | One per action | One per game | One per game | One per action |
| **Algorithmic** | No | Yes (BFS, DFS, etc.) | No | No |
| **State Preservation** | Message history | Agent memory | Agent memory | Reasoning chains |
| **Best For** | General purpose | Logic puzzles | Visual patterns | Multi-turn reasoning |

## Advanced Topics

### Recording & Playback

Every agent session is automatically recorded to a `.jsonl` file containing:
- All frames received
- All actions taken
- Reasoning metadata
- Final scorecard

Playback: `uv run main.py --agent=game_id.agent_name.guid.recording.jsonl`

### Custom Prompts

Override these methods to customize agent behavior:
- `build_user_prompt()`: Initial prompt with game context
- `build_func_resp_prompt()`: Response after each action
- `build_functions()`: Tool/function definitions for LLM

### Tracing with AgentOps

The `@trace_agent_session` decorator (from `agents/tracing.py`) automatically logs:
- Agent execution flow
- Tool calls
- Reasoning steps
- Performance metrics

Session URLs are logged for debugging.

## Key Takeaways

1. **All agents follow the same core loop**: receive state → choose action → execute → repeat
2. **Different architectures transform perception differently**: text vs. images vs. code
3. **SmolAgents are autonomous**: One call that runs until completion
4. **LLM agents are iterative**: One API call per action decision
5. **Responses API preserves reasoning**: Critical for multi-turn puzzle solving
6. **Swarms enable parallelism**: Multiple games, multiple agents, simultaneously
7. **Every session is recorded**: Full replay capability for analysis

## Next Steps

- Read about [Actions](./actions.md) for detailed action specifications
- Learn about [Swarms](./swarms.md) for orchestration
- Check [Recordings](./recordings.md) for playback and analysis
- See [Agent templates](../../agents/templates/) for implementation examples
