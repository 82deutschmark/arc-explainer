#!/usr/bin/env python3
"""
Author: Claude Sonnet 4
Date: 2026-01-03
PURPOSE: Haiku 4.5 Agent for ARC-AGI-3 - Vision-first, child-like learning.
         Reads JSON config from stdin, emits NDJSON events to stdout.
         Uses Anthropic API with claude-3-5-haiku-20241022 model.
         
         Core philosophy:
         - SEES: Describe the image in detail
         - THINKS: Form simple hypotheses
         - ACTS: Choose an action
         - OBSERVES: Note what changed
         - LEARNS: Update memory for next turn
         
SRP/DRY check: Pass - isolated agent runner, emits events for TypeScript to consume.

Usage:
    echo '{"game_id":"ls20","anthropic_api_key":"sk-..."}' | python arc3_haiku_agent.py
"""

import json
import os
import re
import sys
import time
import base64
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field

import requests

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

from arc3_haiku_preprocessor import (
    preprocess_frame,
    describe_objects_for_haiku,
    extract_objects,
    detect_changes,
)


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
# Haiku System Prompt
# ============================================================================

HAIKU_SYSTEM_PROMPT = """You are learning a new game by playing it and observing what happens.

You have human-like curiosity but also human limitations - you don't do math, you just observe and remember patterns.

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
   - ACTION6: Click on something specific (requires coordinates)
   - RESET: Start over if stuck

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

RESPONSE FORMAT:
Always respond with your observation, hypothesis, and chosen action in this format:

DESCRIPTION: [What you see in the image]

THINKING: [Your hypothesis about what will happen]

ACTION: [One of: ACTION1, ACTION2, ACTION3, ACTION4, ACTION5, ACTION6, RESET]
COORDINATES: [Only if ACTION6, format: x,y]

Let's play this game and see what happens!"""


# ============================================================================
# Game State (Haiku's Memory)
# ============================================================================

@dataclass
class HaikuGameState:
    """Haiku's memory across turns - observations and action history."""
    
    observations: List[str] = field(default_factory=list)
    action_history: List[str] = field(default_factory=list)
    descriptions: List[str] = field(default_factory=list)
    hypotheses: List[str] = field(default_factory=list)
    frame_sequence: List[Dict] = field(default_factory=list)
    
    max_observations: int = 10
    max_descriptions: int = 3
    
    def add_observation(self, obs: str):
        """Add a learned observation."""
        if obs and obs not in self.observations:
            self.observations.append(obs)
            if len(self.observations) > self.max_observations:
                self.observations = self.observations[-self.max_observations:]
    
    def add_description(self, desc: str):
        """Add Haiku's description of what it saw."""
        self.descriptions.append(desc)
        if len(self.descriptions) > self.max_descriptions:
            self.descriptions = self.descriptions[-self.max_descriptions:]
    
    def add_hypothesis(self, hyp: str):
        """Add Haiku's hypothesis."""
        self.hypotheses.append(hyp)
        if len(self.hypotheses) > self.max_descriptions:
            self.hypotheses = self.hypotheses[-self.max_descriptions:]
    
    def add_action(self, action: str):
        """Record an action taken."""
        self.action_history.append(action)
    
    def add_frame(self, frame_data: Dict):
        """Store frame for context (keep last 5)."""
        self.frame_sequence.append(frame_data)
        if len(self.frame_sequence) > 5:
            self.frame_sequence = self.frame_sequence[-5:]
    
    def get_last_action(self) -> Optional[str]:
        """Get the most recent action."""
        return self.action_history[-1] if self.action_history else None
    
    def is_stuck(self) -> bool:
        """Check if Haiku is doing the same thing repeatedly with no progress."""
        if len(self.action_history) < 5:
            return False
        last_5 = self.action_history[-5:]
        return len(set(last_5)) == 1


# ============================================================================
# ARC3 API Client (simplified)
# ============================================================================

class Arc3ApiClient:
    """Simple client for ARC-AGI-3 API."""
    
    BASE_URL = "https://three.arcprize.org"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "x-api-key": api_key,
        })
    
    def open_scorecard(self, tags: List[str] = None, opaque_metadata: Dict = None) -> str:
        """Open a scorecard for tracking the game session."""
        payload = {
            "tags": tags or ["haiku-4-5"],
            "opaque_metadata": opaque_metadata or {"agent": "haiku-4-5"},
        }
        resp = self.session.post(f"{self.BASE_URL}/api/cmd/OPEN_SCORECARD", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("card_id", "")
    
    def close_scorecard(self):
        """Close the current scorecard."""
        try:
            self.session.post(f"{self.BASE_URL}/api/cmd/CLOSE_SCORECARD", json={})
        except Exception:
            pass  # Best effort
    
    def start_game(self, game_id: str) -> Dict:
        """Start a new game and get the initial frame."""
        payload = {"game_id": game_id}
        resp = self.session.post(f"{self.BASE_URL}/api/cmd/START_GAME", json=payload)
        resp.raise_for_status()
        return resp.json()
    
    def execute_action(
        self,
        game_id: str,
        guid: str,
        action: str,
        coordinates: Optional[Tuple[int, int]] = None,
        reasoning: Optional[str] = None
    ) -> Dict:
        """Execute an action and get the resulting frame."""
        payload = {
            "guid": guid,
            "opaque_metadata": {
                "agent": "haiku-4-5",
                "reasoning": reasoning[:500] if reasoning else None,
            },
        }
        
        if action == "ACTION6" and coordinates:
            payload["x"] = coordinates[0]
            payload["y"] = coordinates[1]
        
        resp = self.session.post(f"{self.BASE_URL}/api/cmd/{action}", json=payload)
        resp.raise_for_status()
        return resp.json()


# ============================================================================
# Frame Rendering
# ============================================================================

ARC_PALETTE = [
    (0, 0, 0),        # 0: black
    (0, 116, 217),    # 1: blue
    (255, 65, 54),    # 2: red
    (46, 204, 64),    # 3: green
    (255, 220, 0),    # 4: yellow
    (170, 170, 170),  # 5: gray
    (240, 18, 190),   # 6: pink
    (255, 133, 27),   # 7: orange
    (127, 219, 255),  # 8: cyan
    (135, 86, 47),    # 9: brown
]


def render_frame_to_base64(frame: List, scale: int = 8) -> str:
    """
    Render a frame grid to a base64-encoded PNG image.
    
    Args:
        frame: 2D or 3D grid of color values
        scale: Pixels per cell (default 8 for reasonable size)
    
    Returns:
        Base64-encoded PNG string
    """
    if not PIL_AVAILABLE:
        emit_error("PIL not available for image rendering", "MISSING_DEPENDENCY")
    
    # Handle 3D frames (take first layer)
    if frame and isinstance(frame[0], list) and frame[0] and isinstance(frame[0][0], list):
        grid = frame[0]
    else:
        grid = frame
    
    if not grid or not grid[0]:
        # Empty grid - return small placeholder
        img = Image.new("RGB", (64, 64), (50, 50, 50))
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
    
    height = len(grid)
    width = len(grid[0])
    
    img = Image.new("RGB", (width * scale, height * scale))
    pixels = img.load()
    
    for y in range(height):
        for x in range(width):
            color_idx = grid[y][x] if 0 <= grid[y][x] < len(ARC_PALETTE) else 0
            color = ARC_PALETTE[color_idx]
            for dy in range(scale):
                for dx in range(scale):
                    pixels[x * scale + dx, y * scale + dy] = color
    
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


# ============================================================================
# Response Parsing
# ============================================================================

def parse_haiku_response(response_text: str) -> Dict:
    """
    Parse Haiku's response to extract action, reasoning, and coordinates.
    
    Expected format:
        DESCRIPTION: ...
        THINKING: ...
        ACTION: ACTION1
        COORDINATES: x,y (optional)
    """
    result = {
        "action": "ACTION1",
        "description": "",
        "thinking": "",
        "coordinates": None,
        "raw": response_text,
    }
    
    # Extract description
    desc_match = re.search(r"DESCRIPTION:\s*(.+?)(?=THINKING:|ACTION:|$)", response_text, re.DOTALL | re.IGNORECASE)
    if desc_match:
        result["description"] = desc_match.group(1).strip()
    
    # Extract thinking/hypothesis
    think_match = re.search(r"THINKING:\s*(.+?)(?=ACTION:|COORDINATES:|$)", response_text, re.DOTALL | re.IGNORECASE)
    if think_match:
        result["thinking"] = think_match.group(1).strip()
    
    # Extract action
    action_match = re.search(r"ACTION:\s*(ACTION[1-6]|RESET)", response_text, re.IGNORECASE)
    if action_match:
        result["action"] = action_match.group(1).upper()
    else:
        # Fallback: look for any action mention
        fallback_match = re.search(r"\b(ACTION[1-6]|RESET)\b", response_text, re.IGNORECASE)
        if fallback_match:
            result["action"] = fallback_match.group(1).upper()
    
    # Extract coordinates for ACTION6
    if result["action"] == "ACTION6":
        coord_match = re.search(r"COORDINATES:\s*(\d+)\s*[,\s]\s*(\d+)", response_text, re.IGNORECASE)
        if coord_match:
            result["coordinates"] = (int(coord_match.group(1)), int(coord_match.group(2)))
        else:
            # Try other coordinate patterns
            coord_alt = re.search(r"\((\d+)\s*,\s*(\d+)\)", response_text)
            if coord_alt:
                result["coordinates"] = (int(coord_alt.group(1)), int(coord_alt.group(2)))
    
    return result


# ============================================================================
# Haiku Agent
# ============================================================================

class Arc3HaikuAgent:
    """
    Haiku 4.5 Agent - Vision-first, child-like learning.
    """
    
    def __init__(self, arc3_api_key: str, anthropic_api_key: str, model: str = "claude-3-5-haiku-20241022"):
        if not ANTHROPIC_AVAILABLE:
            emit_error("anthropic package not installed", "MISSING_DEPENDENCY")
        
        self.arc3_client = Arc3ApiClient(arc3_api_key)
        self.anthropic_client = anthropic.Anthropic(api_key=anthropic_api_key)
        self.model = model
        self.game_state = HaikuGameState()
    
    def build_message_content(
        self,
        turn: int,
        frame_image_b64: str,
        context: Dict,
        previous_action: Optional[str] = None
    ) -> List[Dict]:
        """Build the multimodal message content for Haiku."""
        
        # Build context text
        text_parts = [f"Turn {turn}"]
        text_parts.append(f"Score: {context.get('score', 0)}")
        text_parts.append(f"Game state: {context.get('state', 'NOT_FINISHED')}")
        
        # Objects I can see (from preprocessing)
        if context.get("objects"):
            text_parts.append("\nObjects detected:")
            text_parts.append(describe_objects_for_haiku(context["objects"]))
        
        # What just changed
        if context.get("changes_from_previous"):
            changes = context["changes_from_previous"]
            if changes.get("summary"):
                text_parts.append(f"\nWhat just changed: {changes['summary']}")
        
        # What I've learned so far
        if self.game_state.observations:
            text_parts.append("\nWhat I've learned so far:")
            for obs in self.game_state.observations[-5:]:
                text_parts.append(f"- {obs}")
        
        # Previous action context
        if previous_action:
            text_parts.append(f"\nLast action: {previous_action}")
        
        # Prompt
        text_parts.append("\nLook at the picture above. Describe everything you see in detail.")
        text_parts.append("Form a hypothesis about what might happen if you try different actions.")
        text_parts.append("Then choose an action and explain your guess.")
        
        context_text = "\n".join(text_parts)
        
        return [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": frame_image_b64,
                },
            },
            {
                "type": "text",
                "text": context_text,
            },
        ]
    
    def call_haiku(self, content: List[Dict]) -> str:
        """Call Haiku with the multimodal content."""
        try:
            response = self.anthropic_client.messages.create(
                model=self.model,
                max_tokens=800,
                system=HAIKU_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": content}],
            )
            return response.content[0].text
        except Exception as e:
            emit_event("agent.error", {"message": f"Haiku API error: {e}"})
            return "ACTION: ACTION1\nDESCRIPTION: Error calling API\nTHINKING: Will try a random action"
    
    def extract_observation(self, action: str, prev_context: Dict, curr_context: Dict) -> str:
        """Extract a learning observation from the action result."""
        changes = curr_context.get("changes_from_previous", {})
        summary = changes.get("summary", "unknown effect")
        
        score_delta = curr_context.get("score", 0) - prev_context.get("score", 0)
        
        if score_delta > 0:
            return f"{action} caused: {summary} (score +{score_delta})"
        elif score_delta < 0:
            return f"{action} caused: {summary} (score {score_delta})"
        else:
            return f"{action} caused: {summary}"
    
    def play_game(self, game_id: str, max_turns: int = 80):
        """Main game loop."""
        
        emit_event("agent.starting", {
            "game_id": game_id,
            "model": self.model,
            "max_turns": max_turns,
        })
        
        # Open scorecard
        try:
            card_id = self.arc3_client.open_scorecard(
                tags=["haiku-4-5", "vision-first"],
                opaque_metadata={"agent": "haiku-4-5", "model": self.model}
            )
            emit_event("agent.scorecard", {"card_id": card_id})
        except Exception as e:
            emit_event("agent.warning", {"message": f"Could not open scorecard: {e}"})
        
        # Start game
        try:
            frame_data = self.arc3_client.start_game(game_id)
            emit_event("game.started", {"game_id": game_id})
            emit_event("game.frame_update", {"frame": frame_data, "turn": 0})
        except Exception as e:
            emit_error(f"Failed to start game: {e}", "GAME_START_ERROR")
        
        prev_context = None
        
        for turn in range(1, max_turns + 1):
            emit_event("agent.turn_start", {"turn": turn})
            
            # Step 1: Render frame to image
            frame_image_b64 = render_frame_to_base64(frame_data.get("frame", []))
            
            # Step 2: Preprocess for context
            prev_frame = self.game_state.frame_sequence[-1] if self.game_state.frame_sequence else None
            context = preprocess_frame(frame_data, prev_frame)
            
            emit_event("agent.context", {
                "turn": turn,
                "objects_count": len(context.get("objects", [])),
                "score": context.get("score", 0),
                "state": context.get("state", "NOT_FINISHED"),
            })
            
            # Step 3: Build message for Haiku
            content = self.build_message_content(
                turn=turn,
                frame_image_b64=frame_image_b64,
                context=context,
                previous_action=self.game_state.get_last_action(),
            )
            
            # Step 4: Call Haiku
            emit_event("agent.thinking", {"message": "Haiku is observing and thinking..."})
            response_text = self.call_haiku(content)
            
            # Step 5: Parse response
            parsed = parse_haiku_response(response_text)
            action = parsed["action"]
            
            # Emit Haiku's thoughts
            if parsed["description"]:
                emit_event("agent.description", {"content": parsed["description"]})
                self.game_state.add_description(parsed["description"])
            
            if parsed["thinking"]:
                emit_event("agent.hypothesis", {"content": parsed["thinking"]})
                self.game_state.add_hypothesis(parsed["thinking"])
            
            emit_event("agent.tool_call", {
                "action": action,
                "coordinates": parsed["coordinates"],
                "turn": turn,
            })
            
            # Step 6: Execute action
            try:
                prev_context = context
                guid = frame_data.get("guid", "")
                frame_data = self.arc3_client.execute_action(
                    game_id=game_id,
                    guid=guid,
                    action=action,
                    coordinates=parsed["coordinates"],
                    reasoning=parsed["thinking"] or parsed["description"],
                )
                
                self.game_state.add_action(action)
                self.game_state.add_frame(frame_data)
                
                emit_event("agent.tool_result", {"action": action, "result": "executed"})
                emit_event("game.frame_update", {"frame": frame_data, "turn": turn})
                
            except Exception as e:
                emit_event("agent.tool_result", {"action": action, "result": f"error: {e}"})
                emit_event("agent.warning", {"message": f"Action failed: {e}"})
                continue
            
            # Step 7: Learn from result
            new_context = preprocess_frame(frame_data, {"frame": prev_context.get("objects", [])})
            observation = self.extract_observation(action, prev_context, new_context)
            self.game_state.add_observation(observation)
            
            emit_event("agent.observation", {"content": observation, "turn": turn})
            
            # Step 8: Check game state
            game_state = frame_data.get("state", "NOT_FINISHED")
            
            if game_state == "WIN":
                emit_event("game.won", {
                    "turn": turn,
                    "score": frame_data.get("score", 0),
                    "observations": self.game_state.observations,
                })
                break
            elif game_state == "GAME_OVER":
                emit_event("game.over", {
                    "turn": turn,
                    "score": frame_data.get("score", 0),
                    "observations": self.game_state.observations,
                })
                break
            
            # Check if stuck
            if self.game_state.is_stuck():
                emit_event("agent.warning", {"message": "Haiku appears stuck, trying RESET"})
                try:
                    frame_data = self.arc3_client.execute_action(game_id, frame_data.get("guid", ""), "RESET")
                    self.game_state.add_action("RESET")
                    emit_event("game.frame_update", {"frame": frame_data, "turn": turn})
                except Exception:
                    pass
            
            # Small delay to avoid rate limiting
            time.sleep(0.3)
        
        # Game loop ended
        emit_event("agent.completed", {
            "final_score": frame_data.get("score", 0),
            "turns": turn,
            "observations": self.game_state.observations,
            "actions_taken": len(self.game_state.action_history),
        })
        
        # Close scorecard
        try:
            self.arc3_client.close_scorecard()
        except Exception:
            pass


# ============================================================================
# Main Entry Point
# ============================================================================

def main():
    """Read config from stdin and run the agent."""
    
    emit_event("stream.init", {"state": "starting", "agent": "haiku-4-5"})
    
    # Read config from stdin
    try:
        input_data = sys.stdin.read()
        if not input_data.strip():
            emit_error("No input provided. Send JSON config via stdin.", "INPUT_ERROR")
        
        config = json.loads(input_data)
    except json.JSONDecodeError as e:
        emit_error(f"Invalid JSON input: {e}", "JSON_ERROR")
    
    # Extract config
    game_id = config.get("game_id", "ls20")
    anthropic_api_key = config.get("anthropic_api_key") or config.get("anthropic_key") or os.environ.get("ANTHROPIC_API_KEY")
    arc3_api_key = config.get("arc3_api_key") or os.environ.get("ARC3_API_KEY")
    max_turns = config.get("max_turns", 80)
    model = config.get("model", "claude-3-5-haiku-20241022")
    
    if not anthropic_api_key:
        emit_error("Anthropic API key required (anthropic_api_key or ANTHROPIC_API_KEY env)", "API_KEY_MISSING")
    
    if not arc3_api_key:
        emit_error("ARC3 API key required (arc3_api_key or ARC3_API_KEY env)", "API_KEY_MISSING")
    
    emit_event("stream.status", {
        "state": "running",
        "message": f"Starting Haiku agent for game {game_id}",
        "game_id": game_id,
        "model": model,
    })
    
    # Create and run agent
    try:
        agent = Arc3HaikuAgent(
            arc3_api_key=arc3_api_key,
            anthropic_api_key=anthropic_api_key,
            model=model,
        )
        agent.play_game(game_id, max_turns)
    except Exception as e:
        emit_error(f"Agent error: {e}", "AGENT_ERROR")


if __name__ == "__main__":
    main()
