#!/usr/bin/env python3
"""
ARC-AGI-3 "Gold Study-Guide" Agent.
Uses pre-studied mechanics to solve games perfectly.
Powered by GPT-5-Nano with Arc3Harness semantic insights.
"""

import os
import json
import base64
import time
import requests
import re
from io import BytesIO
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from dotenv import load_dotenv
from PIL import Image

# Import local components
from arc3_harness import Arc3Harness, GridAnalysis, FrameDelta, Insight
from gold_prompts import get_study_guide

# Load environment variables (API Keys)
load_dotenv()

# Constants
ARC3_API_BASE = "https://three.arcprize.org"
ARC_PALETTE = [
    (255, 255, 255),  # 0: White
    (204, 204, 204),  # 1: Light Gray
    (153, 153, 153),  # 2: Gray
    (102, 102, 102),  # 3: Dark Gray
    (51, 51, 51),     # 4: Darker Gray
    (0, 0, 0),        # 5: Black
    (229, 58, 163),   # 6: Pink
    (255, 123, 204),  # 7: Light Pink
    (249, 60, 49),    # 8: Red
    (30, 147, 255),   # 9: Blue
    (136, 216, 241),  # 10: Light Blue
    (255, 220, 0),    # 11: Yellow
    (255, 133, 27),   # 12: Orange
    (146, 18, 49),    # 13: Dark Red
    (79, 204, 48),    # 14: Green
    (163, 86, 208),   # 15: Purple
]

@dataclass
class AgentState:
    game_id: str
    card_id: str = ""
    guid: str = ""
    last_response_id: str = ""
    turn: int = 0
    level: int = 1
    score: int = 0
    frames: List[List[List[int]]] = field(default_factory=list)
    actions: List[str] = field(default_factory=list)
    observations: List[str] = field(default_factory=list)

class GoldAgent:
    def __init__(self):
        self.arc3_api_key = os.getenv("ARC3_API_KEY")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.openai_model = "gpt-5-nano"
        
        if not self.arc3_api_key or not self.openai_api_key:
            raise ValueError("Missing API keys in .env file.")
            
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "X-API-Key": self.arc3_api_key
        })
        
        self.harness = Arc3Harness()
        self.state = None

    def log(self, msg: str):
        print(f"[{time.strftime('%H:%M:%S')}] {msg}")

    # --- API Wrappers ---
    def call_api(self, path: str, payload: Dict = None) -> Dict:
        url = f"{ARC3_API_BASE}{path}"
        resp = self.session.post(url, json=payload or {})
        if not resp.ok:
            self.log(f"API Error {resp.status_code}: {resp.text}")
        resp.raise_for_status()
        return resp.json()

    def open_scorecard(self, game_id: str):
        self.log(f"Opening scorecard for {game_id}...")
        payload = {
            "tags": [game_id, "gold-agent", "gpt-5-nano"],
            "opaque": {"agent": "gold-study-guide"}
        }
        data = self.call_api("/api/scorecard/open", payload)
        card_id = data.get("card_id")
        self.state = AgentState(game_id=game_id, card_id=card_id)
        return card_id

    def close_scorecard(self):
        if not self.state or not self.state.card_id:
            return
        self.log(f"Closing scorecard {self.state.card_id}...")
        try:
            self.call_api("/api/scorecard/close", {"card_id": self.state.card_id})
        except:
            pass

    def start_game(self, game_id: str) -> Dict:
        self.log(f"Starting game (RESET): {game_id}")
        # According to Arc3ApiClient.ts, starting a game is a RESET command with card_id
        payload = {
            "game_id": game_id,
            "card_id": self.state.card_id
        }
        data = self.call_api("/api/cmd/RESET", payload)
        self.state.guid = data["guid"]
        self.state.score = data.get("score", 0)
        self.state.level = data.get("level", 1)
        self.state.frames.append(data["frame"])
        return data

    def submit_action(self, action: str, x: int = None, y: int = None, reasoning: str = "") -> Dict:
        payload = {
            "game_id": self.state.game_id,
            "guid": self.state.guid,
            "opaque_metadata": {"reasoning": reasoning}
        }
        
        if action == "ACTION6" and x is not None and y is not None:
            payload["x"] = x
            payload["y"] = y
        
        if action == "RESET":
            payload["card_id"] = self.state.card_id
            
        self.log(f"Executing: {action} {' at '+str(x)+','+str(y) if x is not None else ''}")
        data = self.call_api(f"/api/cmd/{action}", payload)
        
        self.state.guid = data["guid"]
        self.state.turn += 1
        self.state.score = data.get("score", 0)
        self.state.level = data.get("level", self.state.level)
        self.state.frames.append(data["frame"])
        self.state.actions.append(action)
        return data

    # --- Visualization ---
    def render_png_b64(self, grid: List[List[int]], scale: int = 20) -> str:
        # Handle 3D frames
        if grid and isinstance(grid[0], list) and grid[0] and isinstance(grid[0][0], list):
            actual_grid = grid[0]
        else:
            actual_grid = grid
            
        height = len(actual_grid)
        width = len(actual_grid[0])
        img = Image.new("RGB", (width * scale, height * scale))
        pix = img.load()
        for y in range(height):
            for x in range(width):
                c_idx = actual_grid[y][x] if 0 <= actual_grid[y][x] < 16 else 0
                color = ARC_PALETTE[c_idx]
                for dy in range(scale):
                    for dx in range(scale):
                        pix[x * scale + dx, y * scale + dy] = color
        
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    # --- Intelligence ---
    def get_llm_decision(self, game_id: str, frame: List[List[int]], harness_data: str, score: int, turn: int, level: int) -> Tuple[str, Optional[int], Optional[int], str]:
        """Ask OpenAI Responses API for the next move."""
        image_b64 = self.render_png_b64(frame)
        system_prompt = get_study_guide(game_id)
        
        user_content = f"CURRENT STATUS: Level={level}, Score={score}, Turn={turn}\n\nHARNESS ANALYSIS:\n{harness_data}\n\nDECIDE YOUR ACTION. If this is Level 1, stick to the GOLD SOLUTION if provided."
        
        url = "https://api.openai.com/v1/responses"
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json"
        }
        
        # Following user request: effort=high, verbosity=high
        payload = {
            "model": "gpt-5-nano-2025-08-07",
            "input": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": user_content
                        },
                        {
                            "type": "input_image",
                            "image_url": f"data:image/png;base64,{image_b64}"
                        }
                    ]
                }
            ],
            "reasoning": { "summary": "auto", "effort": "high" },
            "text": { "verbosity": "high" },
            "store": True,
            "temperature": 1.0,
            "metadata": {
                "game_id": str(game_id),
                "level": str(level),
                "turn": str(turn),
                "agent": "GoldAgentV2"
            }
        }
        
        # Add instructions ONLY if not a continuation
        if not self.state.last_response_id:
            payload["instructions"] = system_prompt
        else:
            payload["previous_response_id"] = self.state.last_response_id
            payload["instructions"] = system_prompt
        
        try:
            resp = requests.post(url, headers=headers, json=payload)
            if not resp.ok:
                self.log(f"OpenAI API Error {resp.status_code}: {resp.text}")
                resp.raise_for_status()
            
            data = resp.json()
            # Store ID for next turn
            if "id" in data:
                self.state.last_response_id = data["id"]
            
            # Parsing according to observed structure
            prediction_text = ""
            reasoning_text = ""
            
            if "output" in data:
                for item in data["output"]:
                    # Reasoning summary is in 'summary' field
                    if "summary" in item:
                        for content in item["summary"]:
                            if content.get("type") == "summary_text":
                                reasoning_text += content.get("text", "")
                    
                    # Message content is in 'content' field
                    if "content" in item:
                        for content in item["content"]:
                            c_type = content.get("type")
                            if c_type == "output_text":
                                prediction_text += content.get("text", "")
            
            # Fallbacks
            if not reasoning_text:
                reasoning_text = data.get("output_reasoning", {}).get("summary", "")
            if not reasoning_text:
                reasoning_text = data.get("reasoning", {}).get("summary", "")
            if not prediction_text:
                prediction_text = data.get("output_text", "")

            self.log(f"LLM Reasoning: {reasoning_text}")
            self.log(f"LLM Reply: {prediction_text}")
            
            text = prediction_text
            action = "ACTION1"
            x, y = None, None
            reasoning = f"Thought: {reasoning_text}\nReply: {text}"
            
            text = prediction_text
            action = "ACTION1"
            x, y = None, None
            reasoning = f"Thought: {reasoning_text}\nReply: {text}"
            
            # Extract action - look for standalone ACTIONx words
            # We want the LAST valid action mentioned in case the model discusses options
            act_matches = re.findall(r"(ACTION[1-6]|RESET)\b", text, re.I)
            if act_matches:
                action = act_matches[-1].upper()
            
            # Extract coordinates ONLY if the game uses ACTION6 and it was selected
            base_id = game_id.split("-")[0]
            if base_id in ["ft09", "vc33", "sp80", "lp85"] and action == "ACTION6":
                # Matches: "COORDINATES: 12,34" or "12, 34" or "(12, 34)"
                # We look at the text AFTER the last action mention to ensure it belongs to it
                last_act_idx = text.upper().rfind(action)
                post_action_text = text[last_act_idx:]
                
                # Check specifics first
                coord_matches = re.findall(r"COORDINATES:?\s*\(?(\d+)\s*[,\s]\s*(\d+)\)?", post_action_text, re.I)
                if coord_matches:
                    x, y = int(coord_matches[-1][0]), int(coord_matches[-1][1])
                else:
                    # Fallback to just pair of numbers
                    coord_alt = re.findall(r"(\d+)\s*,\s*(\d+)", post_action_text)
                    if coord_alt:
                        x, y = int(coord_alt[-1][0]), int(coord_alt[-1][1])
            
            return action, x, y, reasoning
            
        except Exception as e:
            self.log(f"Responses API Call failed: {e}")
            return "RESET", None, None, f"Fallback due to Error: {e}"

    def resolve_game_id(self, base_id: str) -> str:
        """Resolve base game ID (e.g. 'as66') to full API ID."""
        self.log(f"Resolving game ID for {base_id}...")
        try:
            url = f"{ARC3_API_BASE}/api/games"
            resp = self.session.get(url)
            resp.raise_for_status()
            games = resp.json()
            for g in games:
                if g['game_id'].startswith(base_id):
                    self.log(f"Resolved {base_id} -> {g['game_id']}")
                    return g['game_id']
        except Exception as e:
            self.log(f"Resolution failed: {e}")
        return base_id

    def run(self, game_id: str, max_turns: int = 10000):
        try:
            # Resolve ID before anything else
            resolved_id = self.resolve_game_id(game_id)
            
            card_id = self.open_scorecard(resolved_id)
            self.log(f"Active Scorecard: {card_id}")
            
            data = self.start_game(resolved_id)
            
            while self.state.turn < max_turns:
                grid = data["frame"]
                game_state = data.get("state", "IN_PROGRESS")
                
                if game_state == "GAME_OVER":
                    self.log(f"Final Outcome: GAME_OVER, Total Score: {self.state.score}")
                    break
                
                if game_state == "WIN":
                    self.log(f"--- Level {self.state.level} WIN! Current Score: {self.state.score} ---")
                    # We continue to the next level automatically if the API allows, 
                    # or the LLM will see the new grid and act.
                
                # Harness Analysis
                analysis = self.harness.analyze_grid(grid)
                harness_text = f"Entropy: {analysis.entropy:.2f}, Components: {len(analysis.components)}\n"
                
                if analysis.insights:
                    harness_text += "Visual Detections:\n" + "\n".join([f"- {i.description}" for i in analysis.insights])
                
                if len(self.state.frames) >= 2:
                    delta = self.harness.analyze_delta(self.state.frames[-2], grid)
                    delta_insights = self.harness.generate_delta_insights(delta)
                    if delta_insights:
                        harness_text += "\nRecent Changes:\n" + "\n".join([f"- {i.description}" for i in delta_insights])

                # Get decision
                action, x, y, reasoning = self.get_llm_decision(
                    game_id, grid, harness_text, self.state.score, self.state.turn, self.state.level
                )
                
                # Execute
                data = self.submit_action(action, x, y, reasoning)
                
                # Rate limit safety
                time.sleep(0.5)
                
            self.log(f"Session Terminated. Final Score: {self.state.score}")
        finally:
            self.close_scorecard()

if __name__ == "__main__":
    import sys
    target_game = sys.argv[1] if len(sys.argv) > 1 else "as66"
    agent = GoldAgent()
    agent.run(target_game)
