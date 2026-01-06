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

@dataclass
class AgentState:
    game_id: str
    guid: str = ""
    turn: int = 0
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
            "x-api-key": self.arc3_api_key
        })
        
        self.harness = Arc3Harness()
        self.state = None

    def log(self, msg: str):
        print(f"[{time.strftime('%H:%M:%S')}] {msg}")

    # --- API Wrappers ---
    def call_api(self, endpoint: str, payload: Dict = None) -> Dict:
        url = f"{ARC3_API_BASE}/api/cmd/{endpoint}"
        resp = self.session.post(url, json=payload or {})
        resp.raise_for_status()
        return resp.json()

    def open_scorecard(self, game_id: str):
        self.log(f"Opening scorecard for {game_id}...")
        resp = self.call_api("OPEN_SCORECARD", {
            "game_id": game_id,
            "tags": [game_id, "gold-agent", "gpt-5-nano"],
            "opaque_metadata": {"agent": "gold-study-guide"}
        })
        return resp.get("card_id")

    def close_scorecard(self):
        self.log("Closing scorecard.")
        try:
            self.call_api("CLOSE_SCORECARD")
        except:
            pass

    def start_game(self, game_id: str) -> Dict:
        self.log(f"Starting game: {game_id}")
        data = self.call_api("START_GAME", {"game_id": game_id})
        self.state = AgentState(game_id=game_id, guid=data["guid"], score=data.get("score", 0))
        self.state.frames.append(data["frame"])
        return data

    def submit_action(self, action: str, x: int = None, y: int = None, reasoning: str = "") -> Dict:
        payload = {
            "guid": self.state.guid,
            "opaque_metadata": {"reasoning": reasoning}
        }
        if action == "ACTION6" and x is not None and y is not None:
            payload["x"] = x
            payload["y"] = y
            
        self.log(f"Executing: {action} {' at '+str(x)+','+str(y) if x is not None else ''}")
        data = self.call_api(action, payload)
        
        self.state.guid = data["guid"]
        self.state.turn += 1
        self.state.score = data.get("score", 0)
        self.state.frames.append(data["frame"])
        self.state.actions.append(action)
        return data

    # --- Visualization ---
    def render_png_b64(self, grid: List[List[int]], scale: int = 20) -> str:
        height = len(grid)
        width = len(grid[0])
        img = Image.new("RGB", (width * scale, height * scale))
        pix = img.load()
        for y in range(height):
            for x in range(width):
                c_idx = grid[y][x] if 0 <= grid[y][x] < 10 else 0
                color = ARC_PALETTE[c_idx]
                for dy in range(scale):
                    for dx in range(scale):
                        pix[x * scale + dx, y * scale + dy] = color
        
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    # --- Intelligence ---
    def get_llm_decision(self, game_id: str, frame: List[List[int]], harness_data: str) -> Tuple[str, Optional[int], Optional[int], str]:
        """Ask GPT-5-Nano for the next move."""
        image_b64 = self.render_png_b64(frame)
        system_prompt = get_study_guide(game_id)
        
        user_content = f"HARNESS ANALYSIS:\n{harness_data}\n\nDECIDE YOUR ACTION."
        
        try:
            import openai
            client = openai.OpenAI(api_key=self.openai_api_key)
            
            response = client.chat.completions.create(
                model=self.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_content},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/png;base64,{image_b64}"}
                            }
                        ]
                    }
                ],
                max_tokens=300
            )
            
            text = response.choices[0].message.content
            action = "ACTION1"
            x, y = None, None
            reasoning = text
            
            import re
            # Extract action
            act_match = re.search(r"ACTION:\s*(ACTION[1-7]|RESET)", text, re.I)
            if act_match: 
                action = act_match.group(1).upper()
            
            # Extract coordinates ONLY if the game uses ACTION6
            # Games that use ACTION6: ft09, vc33, sp80, lp85
            base_id = game_id.split("-")[0]
            if base_id in ["ft09", "vc33", "sp80", "lp85"]:
                coord_match = re.search(r"COORDINATES:\s*(\d+)\s*[,\s]\s*(\d+)", text, re.I)
                if coord_match:
                    x, y = int(coord_match.group(1)), int(coord_match.group(2))
                else:
                    # Fallback to coordinate search in text
                    coord_alt = re.search(r"(\d+)\s*,\s*(\d+)", text)
                    if coord_alt:
                        x, y = int(coord_alt.group(1)), int(coord_alt.group(2))
            
            return action, x, y, reasoning
            
        except Exception as e:
            self.log(f"LLM Call failed: {e}")
            return "RESET", None, None, "API Error Fallback"

    def run(self, game_id: str, max_turns: int = 50):
        # Determine if we need to open scorecard
        card_id = self.open_scorecard(game_id)
        self.log(f"Active Scorecard: {card_id}")
        
        try:
            data = self.start_game(game_id)
            
            while self.state.turn < max_turns:
                grid = data["frame"]
                game_state = data.get("state", "IN_PROGRESS")
                
                if game_state in ["WIN", "GAME_OVER"]:
                    self.log(f"Final Outcome: {game_state}, Total Score: {self.state.score}")
                    break
                
                # Harness Analysis
                analysis = self.harness.analyze_grid(grid)
                harness_text = f"Entropy: {analysis.entropy:.2f}, Components: {len(analysis.components)}\n"
                
                # Semantic Insights (Detectors)
                if analysis.insights:
                    harness_text += "Visual Detections:\n" + "\n".join([f"- {i.description}" for i in analysis.insights])
                
                # Delta analysis
                if len(self.state.frames) >= 2:
                    delta = self.harness.analyze_delta(self.state.frames[-2], grid)
                    delta_insights = self.harness.generate_delta_insights(delta)
                    if delta_insights:
                        harness_text += "\nRecent Changes:\n" + "\n".join([f"- {i.description}" for i in delta_insights])

                # Get decision
                action, x, y, reasoning = self.get_llm_decision(game_id, grid, harness_text)
                
                # Execute
                data = self.submit_action(action, x, y, reasoning)
                
                # Rate limit safety
                time.sleep(0.5)
                
            self.log(f"Session Terminated. Final Score: {self.state.score}")
        finally:
            self.close_scorecard()

if __name__ == "__main__":
    import sys
    # Example usage: python server/python/arc3_gold_agent.py as66
    target_game = sys.argv[1] if len(sys.argv) > 1 else "as66"
    agent = GoldAgent()
    agent.run(target_game)
