#!/usr/bin/env python3
"""
Author: Claude Sonnet 4
Date: 2026-01-02
PURPOSE: Python wrapper for LLM Council subprocess integration.
         Follows the same NDJSON protocol as saturn_wrapper.py and beetree_wrapper.py.
         Reads JSON input from stdin, runs council deliberation, outputs NDJSON events to stdout.
SRP/DRY check: Pass - Single responsibility: subprocess bridge for council.
"""

import sys
import json
import asyncio
import os
from pathlib import Path

# Add llm-council to Python path
COUNCIL_DIR = Path(__file__).parent.parent.parent / "llm-council"
sys.path.insert(0, str(COUNCIL_DIR))

def emit_event(event: dict):
    """Emit a JSON event to stdout (NDJSON protocol)."""
    print(json.dumps(event), flush=True)

def emit_log(level: str, message: str):
    """Emit a log event."""
    emit_event({"type": "log", "level": level, "message": message})

def emit_error(message: str):
    """Emit an error event."""
    emit_event({"type": "error", "message": message})

def emit_progress(stage: str, message: str, data: dict = None):
    """Emit a progress event."""
    event = {"type": "progress", "stage": stage, "message": message}
    if data:
        event["data"] = data
    emit_event(event)

async def run_council(query: str):
    """
    Run the 3-stage council deliberation.
    Returns tuple of (stage1_results, stage2_results, stage3_result, metadata)
    """
    try:
        emit_log("info", "Attempting to import council backend modules...")
        from backend.council import (
            stage1_collect_responses,
            stage2_collect_rankings,
            stage3_synthesize_final,
            calculate_aggregate_rankings
        )
        from backend.config import COUNCIL_MODELS, CHAIRMAN_MODEL

        emit_log("info", f"Imports successful. Council models: {COUNCIL_MODELS}")
        emit_log("info", f"Chairman model: {CHAIRMAN_MODEL}")

        # Stage 1: Collect individual responses
        emit_progress("stage1", "Collecting individual responses from council members...")
        emit_log("info", "Starting stage1_collect_responses...")
        stage1_results = await stage1_collect_responses(query)
        emit_log("info", f"Stage 1 complete, got {len(stage1_results) if stage1_results else 0} results")
        
        if not stage1_results:
            emit_error("All council models failed to respond")
            return None, None, None, None
            
        emit_event({
            "type": "stage1_complete",
            "data": stage1_results,
            "count": len(stage1_results)
        })
        
        # Stage 2: Collect rankings
        emit_progress("stage2", "Council members evaluating and ranking each other's responses...")
        emit_log("info", "Starting stage2_collect_rankings...")
        stage2_results, label_to_model = await stage2_collect_rankings(query, stage1_results)
        emit_log("info", f"Stage 2 complete, got {len(stage2_results) if stage2_results else 0} rankings")
        aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)

        emit_event({
            "type": "stage2_complete",
            "data": stage2_results,
            "label_to_model": label_to_model,
            "aggregate_rankings": aggregate_rankings
        })

        # Stage 3: Synthesize final answer
        emit_progress("stage3", "Chairman synthesizing final response...")
        emit_log("info", "Starting stage3_synthesize_final...")
        stage3_result = await stage3_synthesize_final(query, stage1_results, stage2_results)
        emit_log("info", "Stage 3 complete")
        
        emit_event({
            "type": "stage3_complete",
            "data": stage3_result
        })
        
        metadata = {
            "label_to_model": label_to_model,
            "aggregate_rankings": aggregate_rankings
        }
        
        return stage1_results, stage2_results, stage3_result, metadata
        
    except ImportError as e:
        emit_error(f"Failed to import council modules: {e}")
        return None, None, None, None
    except Exception as e:
        emit_error(f"Council execution error: {e}")
        return None, None, None, None

async def main():
    """Main entry point - read stdin, run council, emit results."""
    try:
        emit_log("info", "Main function started")
        # Read JSON payload from stdin
        input_data = sys.stdin.read()
        emit_log("info", f"Received input: {len(input_data)} chars")
        if not input_data.strip():
            emit_error("No input provided")
            return 1

        payload = json.loads(input_data)
        query = payload.get("query", "")
        emit_log("info", f"Parsed query: {len(query)} chars")
        
        if not query:
            emit_error("No query provided in payload")
            return 1
        
        emit_event({"type": "start", "message": "Starting LLM Council deliberation"})
        emit_log("info", f"Query length: {len(query)} chars")
        
        # Check for OPENROUTER_API_KEY
        if not os.environ.get("OPENROUTER_API_KEY"):
            emit_error("OPENROUTER_API_KEY environment variable not set")
            return 1
        
        # Run the council
        stage1, stage2, stage3, metadata = await run_council(query)
        
        if stage1 is None:
            # Error already emitted
            return 1
        
        # Emit final result
        emit_event({
            "type": "final",
            "success": True,
            "result": {
                "stage1": stage1,
                "stage2": stage2,
                "stage3": stage3,
                "metadata": metadata
            }
        })
        
        return 0
        
    except json.JSONDecodeError as e:
        emit_error(f"Invalid JSON input: {e}")
        return 1
    except Exception as e:
        emit_error(f"Unexpected error: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
