#!/usr/bin/env python3
"""
Author: Cascade (model: Cascade)
Date: 2025-12-02
PURPOSE: Bridge between ARC Explainer Node backend and SnakeBench backend.
         Runs a single SnakeBench game between two models without requiring
         SnakeBench's own Supabase database. Uses the existing SnakeBench
         game engine and replay writer, but constructs player configs
         directly from the request payload.
SRP/DRY check: Pass — single responsibility is running one match and
               returning a compact JSON summary.
"""

import json
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict


def emit_error(message: str) -> None:
    """Emit an error object as the final JSON line."""
    sys.stdout.write(json.dumps({"error": message}, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> int:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            emit_error("Empty SnakeBench payload")
            return 1

        try:
            payload: Dict[str, Any] = json.loads(raw)
        except Exception as e:  # noqa: BLE001
            emit_error(f"Invalid JSON payload: {e}")
            return 1

        model_a = payload.get("modelA")
        model_b = payload.get("modelB")
        if not model_a or not model_b:
            emit_error("modelA and modelB are required")
            return 1

        # Basic game parameters with sane defaults (aligned with SnakeBench main.py)
        width = int(payload.get("width") or 10)
        height = int(payload.get("height") or 10)
        max_rounds = int(payload.get("maxRounds") or 150)
        num_apples = int(payload.get("numApples") or 5)

        def _safe_float(value: Any) -> float:
            try:
                return float(value)
            except (TypeError, ValueError):  # noqa: PERF203
                return 0.0

        pricing_input_a = _safe_float(payload.get("pricingInputA"))
        pricing_output_a = _safe_float(payload.get("pricingOutputA"))
        pricing_input_b = _safe_float(payload.get("pricingInputB"))
        pricing_output_b = _safe_float(payload.get("pricingOutputB"))

        # Resolve SnakeBench backend path relative to this repo
        script_dir = Path(__file__).resolve().parent
        project_root = script_dir.parent.parent
        backend_dir = project_root / "external" / "SnakeBench" / "backend"

        if not backend_dir.exists():
            emit_error(f"SnakeBench backend directory not found at {backend_dir}")
            return 1

        # Make SnakeBench backend importable
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))

        try:
            from main import run_simulation  # type: ignore
        except Exception as e:  # noqa: BLE001
            emit_error(f"Failed to import SnakeBench main module: {e}")
            return 1

        def build_player_config(name: str, input_price: float, output_price: float) -> Dict[str, Any]:
            """Build a minimal player_config for LLMPlayer without DB lookups.

            Fields match what llm_providers.OpenRouterProvider and LLMPlayer expect:
            - name: human-readable label
            - model_name: underlying OpenRouter model slug (we use name verbatim)
            - pricing: simple $/1M token rates (0 by default; ARC Explainer can
              handle cost tracking separately if desired).
            """
            return {
                "name": name,
                "model_name": name,
                "pricing": {
                    "input": float(input_price) if input_price is not None else 0.0,
                    "output": float(output_price) if output_price is not None else 0.0,
                },
                "provider": "OpenRouter",
                "is_active": True,
                "test_status": "arc-explainer",
            }

        model_config_1 = build_player_config(str(model_a), pricing_input_a, pricing_output_a)
        model_config_2 = build_player_config(str(model_b), pricing_input_b, pricing_output_b)

        # Build an argparse-like namespace expected by run_simulation
        game_params = SimpleNamespace(
            width=width,
            height=height,
            max_rounds=max_rounds,
            num_apples=num_apples,
            game_id=None,
            game_type="arc-explainer",
        )

        # Run the actual SnakeBench simulation
        result = run_simulation(model_config_1, model_config_2, game_params)

        game_id = result.get("game_id")
        final_scores: Dict[str, int] = result.get("final_scores") or {}
        game_result: Dict[str, str] = result.get("game_result") or {}

        # Map Snake IDs ("0", "1") back to model names for easier consumption
        scores_by_model = {
            str(model_a): final_scores.get("0", 0),
            str(model_b): final_scores.get("1", 0),
        }
        results_by_model = {
            str(model_a): game_result.get("0"),
            str(model_b): game_result.get("1"),
        }

        # Best-effort path to the completed game JSON for replay
        completed_game_path = None
        if game_id:
            replay_name = f"snake_game_{game_id}.json"
            candidate = backend_dir / "completed_games" / replay_name
            if candidate.exists():
                completed_game_path = str(candidate)

        output = {
            "game_id": game_id,
            "modelA": str(model_a),
            "modelB": str(model_b),
            "scores_by_slot": final_scores,
            "results_by_slot": game_result,
            "scores": scores_by_model,
            "results": results_by_model,
            "completed_game_path": completed_game_path,
        }

        sys.stdout.write(json.dumps(output, ensure_ascii=False) + "\n")
        sys.stdout.flush()
        return 0

    except Exception as e:  # noqa: BLE001
        emit_error(f"Unhandled SnakeBench runner error: {e}")
        return 1


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
