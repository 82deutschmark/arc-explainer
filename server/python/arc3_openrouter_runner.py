#!/usr/bin/env python3
"""
Author: Cascade
Date: 2026-01-02
PURPOSE: ARC3 OpenRouter Runner using LangGraph thinking agent pattern.
         Reads JSON config from stdin, emits NDJSON events to stdout.
         Model: xiaomi/mimo-v2-flash:free (configurable)
SRP/DRY check: Pass - isolated agent runner, emits events for TypeScript to consume.

Usage:
    echo '{"game_id":"ls20","model":"xiaomi/mimo-v2-flash:free","api_key":"sk-or-..."}' | python arc3_openrouter_runner.py
"""

import json
import os
import sys
import time
import base64
from io import BytesIO
from typing import Any, Optional, TypedDict
from enum import Enum

import requests
from PIL import Image

# LangChain imports for OpenRouter integration
try:
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage, SystemMessage
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False


# ============================================================================
# Event Emission (NDJSON protocol for TypeScript)
# ============================================================================

def emit_event(event_type: str, data: dict = None):
    """Emit NDJSON event to stdout for TypeScript to parse and forward to SSE."""
    event = {"type": event_type}
    if data:
        event.update(data)
    print(json.dumps(event), flush=True)


def emit_error(message: str, code: str = "RUNNER_ERROR"):
    """Emit error event and exit."""
    emit_event("stream.error", {"code": code, "message": message})
    sys.exit(1)


# ============================================================================
# Game State Enums (matching ARC-AGI-3-Agents2 pattern)
# ============================================================================

class GameState(str, Enum):
    NOT_PLAYED = "NOT_PLAYED"
    IN_PROGRESS = "IN_PROGRESS"
    WIN = "WIN"
    GAME_OVER = "GAME_OVER"


class GameAction(str, Enum):
    RESET = "RESET"
    ACTION1 = "ACTION1"
    ACTION2 = "ACTION2"
    ACTION3 = "ACTION3"
    ACTION4 = "ACTION4"
    ACTION5 = "ACTION5"
    ACTION6 = "ACTION6"


# ============================================================================
# ARC3 API Client (Python version of Arc3ApiClient.ts)
# ============================================================================

class Arc3ApiClient:
    """HTTP client for ARC-AGI-3 API at three.arcprize.org."""
    
    BASE_URL = "https://three.arcprize.org"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.card_id: Optional[str] = None
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "X-API-Key": api_key,
        })
    
    def open_scorecard(self, tags: list[str] = None, source_url: str = None) -> str:
        """Open a new scorecard. MUST be called before starting any games."""
        body = {}
        if tags:
            body["tags"] = tags
        if source_url:
            body["source_url"] = source_url
        
        response = self.session.post(f"{self.BASE_URL}/api/scorecard/open", json=body)
        response.raise_for_status()
        data = response.json()
        self.card_id = data["card_id"]
        return self.card_id
    
    def start_game(self, game_id: str) -> dict:
        """Start a new game session using RESET command."""
        if not self.card_id:
            raise ValueError("Must open scorecard before starting game")
        
        body = {
            "game_id": game_id,
            "card_id": self.card_id,
        }
        response = self.session.post(f"{self.BASE_URL}/api/cmd/RESET", json=body)
        response.raise_for_status()
        return response.json()
    
    def execute_action(self, game_id: str, guid: str, action: str, 
                       coordinates: tuple[int, int] = None, reasoning: Any = None) -> dict:
        """Execute an action in a game session."""
        body = {
            "game_id": game_id,
            "guid": guid,
        }
        
        if action == "ACTION6" and coordinates:
            body["x"] = coordinates[0]
            body["y"] = coordinates[1]
        
        if action == "RESET":
            body["card_id"] = self.card_id
        elif reasoning:
            body["reasoning"] = reasoning
        
        response = self.session.post(f"{self.BASE_URL}/api/cmd/{action}", json=body)
        response.raise_for_status()
        return response.json()


# ============================================================================
# Frame Rendering (for multimodal LLM input)
# ============================================================================

# ARC color palette (standard 16 colors)
ARC_COLORS = [
    (0, 0, 0),       # 0: black
    (0, 116, 217),   # 1: blue
    (255, 65, 54),   # 2: red
    (46, 204, 64),   # 3: green
    (255, 220, 0),   # 4: yellow
    (170, 170, 170), # 5: gray
    (240, 18, 190),  # 6: magenta
    (255, 133, 27),  # 7: orange
    (127, 219, 255), # 8: cyan
    (135, 12, 37),   # 9: maroon
    (0, 0, 0),       # 10: black (alt)
    (0, 0, 0),       # 11: black (alt)
    (0, 0, 0),       # 12: black (alt)
    (0, 0, 0),       # 13: black (alt)
    (0, 0, 0),       # 14: black (alt)
    (255, 255, 255), # 15: white
]


def render_frame_to_base64(frame: list, scale: int = 8) -> str:
    """Render a frame grid to base64 PNG image for multimodal LLM."""
    # Handle 3D frame: [layer][height][width]
    # We typically want layer 0 (main game layer)
    if len(frame) > 0 and isinstance(frame[0], list):
        if len(frame[0]) > 0 and isinstance(frame[0][0], list):
            # 3D array - take first layer
            grid = frame[0]
        else:
            # 2D array already
            grid = frame
    else:
        grid = frame
    
    height = len(grid)
    width = len(grid[0]) if height > 0 else 0
    
    img = Image.new('RGB', (width * scale, height * scale))
    pixels = img.load()
    
    for y in range(height):
        for x in range(width):
            color_idx = grid[y][x] if grid[y][x] < len(ARC_COLORS) else 0
            color = ARC_COLORS[color_idx]
            for dy in range(scale):
                for dx in range(scale):
                    pixels[x * scale + dx, y * scale + dy] = color
    
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


# ============================================================================
# LangGraph-style Agent (simplified for OpenRouter)
# ============================================================================

class Arc3OpenRouterAgent:
    """
    LangGraph-style agent for ARC3 games using OpenRouter.
    Pattern: external/ARC-AGI-3-Agents2/agents/templates/langgraph_thinking/
    """
    
    SYSTEM_PROMPT = """You are an expert ARC-AGI-3 game player. Your goal is to explore and discover the rules of the game.

The game has the following actions:
- ACTION1: Move/interact up
- ACTION2: Move/interact down  
- ACTION3: Move/interact left
- ACTION4: Move/interact right
- ACTION5: Special action (rotate, transform, etc.)
- ACTION6: Click at specific coordinates (requires x, y)
- RESET: Start over (only use if stuck)

Analyze the game frame carefully. Look for:
1. Patterns and shapes
2. Color relationships
3. Possible objectives (doors, keys, targets)
4. Changes from previous actions

Think step by step about what action to take next. Your response must be a JSON object:
{"action": "ACTION1|ACTION2|ACTION3|ACTION4|ACTION5|ACTION6|RESET", "reasoning": "your explanation", "coordinates": [x, y] (only for ACTION6)}
"""
    
    def __init__(self, model: str, api_key: str, instructions: str = None):
        self.model = model
        self.api_key = api_key
        self.instructions = instructions or ""
        
        if not LANGCHAIN_AVAILABLE:
            emit_error("LangChain not installed. Run: pip install langchain-openai", "DEPENDENCY_ERROR")
        
        # Initialize LangChain ChatOpenAI with OpenRouter
        self.llm = ChatOpenAI(
            model=model,
            openai_api_base="https://openrouter.ai/api/v1",
            openai_api_key=api_key,
            default_headers={
                "HTTP-Referer": "https://arc-explainer.com",
                "X-Title": "ARC Explainer - OpenRouter Agent",
            },
            temperature=0.7,
            max_tokens=1024,
        )
        
        self.previous_frame = None
        self.action_history = []
    
    def analyze_frame(self, frame_data: dict) -> dict:
        """Analyze frame and choose next action using LLM."""
        frame = frame_data.get("frame", [])
        state = frame_data.get("state", "IN_PROGRESS")
        score = frame_data.get("score", 0)
        
        # Build context message
        context_parts = []
        
        # Add game state info
        context_parts.append(f"Game State: {state}")
        context_parts.append(f"Current Score: {score}")
        
        if self.action_history:
            recent = self.action_history[-5:]  # Last 5 actions
            context_parts.append(f"Recent Actions: {', '.join(recent)}")
        
        if self.instructions:
            context_parts.append(f"User Instructions: {self.instructions}")
        
        context_text = "\n".join(context_parts)
        
        # Render frame to image
        try:
            frame_image_b64 = render_frame_to_base64(frame)
            
            # Create multimodal message
            messages = [
                SystemMessage(content=self.SYSTEM_PROMPT),
                HumanMessage(content=[
                    {"type": "text", "text": f"{context_text}\n\nAnalyze the current game frame and decide your next action:"},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{frame_image_b64}"}},
                ]),
            ]
        except Exception as e:
            # Fallback to text-only if image rendering fails
            emit_event("agent.reasoning", {"content": f"Image rendering failed: {e}, using text mode"})
            messages = [
                SystemMessage(content=self.SYSTEM_PROMPT),
                HumanMessage(content=f"{context_text}\n\nThe game frame is a grid. Choose an action to explore."),
            ]
        
        # Get LLM response
        emit_event("agent.reasoning", {"content": "Analyzing frame with LLM..."})
        
        try:
            response = self.llm.invoke(messages)
            response_text = response.content
            
            emit_event("agent.reasoning", {"content": f"LLM response: {response_text[:500]}"})
            
            # Parse JSON response
            # Try to extract JSON from response
            try:
                # Look for JSON in response
                import re
                json_match = re.search(r'\{[^}]+\}', response_text)
                if json_match:
                    action_data = json.loads(json_match.group())
                else:
                    # Default to random exploration
                    action_data = {"action": "ACTION1", "reasoning": "Exploring"}
            except json.JSONDecodeError:
                action_data = {"action": "ACTION1", "reasoning": response_text[:200]}
            
            return action_data
            
        except Exception as e:
            emit_event("agent.reasoning", {"content": f"LLM error: {e}"})
            return {"action": "ACTION1", "reasoning": f"LLM error, defaulting: {e}"}
    
    def choose_action(self, frame_data: dict) -> tuple[str, str, Optional[tuple[int, int]]]:
        """Choose action based on frame analysis. Returns (action, reasoning, coordinates)."""
        state = frame_data.get("state", "IN_PROGRESS")
        
        # Handle game states
        if state in [GameState.NOT_PLAYED.value, GameState.GAME_OVER.value]:
            return "RESET", "Game not started or over - resetting", None
        
        if state == GameState.WIN.value:
            return None, "Game won!", None
        
        # Analyze and choose action
        result = self.analyze_frame(frame_data)
        
        action = result.get("action", "ACTION1").upper()
        reasoning = result.get("reasoning", "Exploring")
        coordinates = result.get("coordinates")
        
        # Validate action
        valid_actions = ["RESET", "ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION5", "ACTION6"]
        if action not in valid_actions:
            action = "ACTION1"
        
        # Track action history
        self.action_history.append(action)
        self.previous_frame = frame_data
        
        return action, reasoning, tuple(coordinates) if coordinates else None


# ============================================================================
# Main Runner
# ============================================================================

def run_agent(config: dict):
    """Main agent loop - plays the game and emits events."""
    
    game_id = config.get("game_id", "ls20")
    model = config.get("model", "xiaomi/mimo-v2-flash:free")
    instructions = config.get("instructions", "")
    max_turns = config.get("max_turns", 50)
    
    # API keys
    arc3_api_key = config.get("arc3_api_key") or os.getenv("ARC3_API_KEY", "")
    openrouter_api_key = config.get("api_key") or os.getenv("OPENROUTER_API_KEY", "")
    
    if not openrouter_api_key:
        emit_error("OpenRouter API key required", "AUTH_ERROR")
    
    if not arc3_api_key:
        emit_error("ARC3 API key required", "AUTH_ERROR")
    
    emit_event("agent.starting", {"message": "Initializing OpenRouter agent...", "model": model})
    
    # Initialize clients
    try:
        arc3_client = Arc3ApiClient(arc3_api_key)
        agent = Arc3OpenRouterAgent(model, openrouter_api_key, instructions)
    except Exception as e:
        emit_error(f"Failed to initialize: {e}", "INIT_ERROR")
    
    emit_event("agent.ready", {"model": model, "game_id": game_id})
    
    # Open scorecard
    try:
        emit_event("stream.status", {"state": "running", "message": "Opening scorecard..."})
        card_id = arc3_client.open_scorecard(
            tags=["openrouter", model.replace("/", "-")],
            source_url="https://arc-explainer.com"
        )
        emit_event("stream.status", {"state": "running", "message": f"Scorecard opened: {card_id}"})
    except Exception as e:
        emit_error(f"Failed to open scorecard: {e}", "API_ERROR")
    
    # Start game
    try:
        emit_event("stream.status", {"state": "running", "message": f"Starting game: {game_id}"})
        frame_data = arc3_client.start_game(game_id)
        emit_event("game.frame_update", {"frame": frame_data, "turn": 0})
    except Exception as e:
        emit_error(f"Failed to start game: {e}", "API_ERROR")
    
    # Game loop
    turn = 0
    final_state = "IN_PROGRESS"
    
    while turn < max_turns:
        turn += 1
        
        state = frame_data.get("state", "IN_PROGRESS")
        if state == GameState.WIN.value:
            final_state = "WIN"
            emit_event("stream.status", {"state": "completed", "message": "Game won!"})
            break
        
        # Choose action
        emit_event("agent.tool_call", {"tool": "analyze_frame", "turn": turn})
        action, reasoning, coordinates = agent.choose_action(frame_data)
        
        if action is None:
            break
        
        emit_event("agent.tool_call", {"tool": action, "reasoning": reasoning, "turn": turn})
        
        # Execute action
        try:
            guid = frame_data.get("guid", "")
            frame_data = arc3_client.execute_action(
                game_id, guid, action, 
                coordinates=coordinates,
                reasoning={"agent": "openrouter", "model": model, "thought": reasoning}
            )
            emit_event("agent.tool_result", {"tool": action, "result": "executed", "turn": turn})
            emit_event("game.frame_update", {"frame": frame_data, "turn": turn})
        except Exception as e:
            emit_event("agent.tool_result", {"tool": action, "result": f"error: {e}", "turn": turn})
            # Continue anyway
        
        # Small delay to avoid rate limiting
        time.sleep(0.5)
    
    # Emit completion
    emit_event("agent.completed", {
        "finalState": final_state,
        "totalTurns": turn,
        "game_id": game_id,
        "model": model,
    })


def main():
    """Entry point - read config from stdin, run agent."""
    try:
        # Read JSON config from stdin
        input_data = sys.stdin.read()
        if not input_data.strip():
            emit_error("No input provided. Send JSON config via stdin.", "INPUT_ERROR")
        
        config = json.loads(input_data)
        run_agent(config)
        
    except json.JSONDecodeError as e:
        emit_error(f"Invalid JSON input: {e}", "INPUT_ERROR")
    except KeyboardInterrupt:
        emit_event("stream.status", {"state": "cancelled", "message": "Interrupted by user"})
        sys.exit(0)
    except Exception as e:
        emit_error(f"Unexpected error: {e}", "RUNNER_ERROR")


if __name__ == "__main__":
    main()
