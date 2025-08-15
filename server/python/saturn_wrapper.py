#!/usr/bin/env python3
"""
server/python/saturn_wrapper.py

Wrapper around ARCVisualSolver that:
- Reads a single JSON payload from stdin: { taskPath, options }
- Runs phased visual solving using the existing solver utilities
- Emits NDJSON events to stdout for start/progress/log/final/error
- Base64-encodes generated images so the frontend can render without static hosting

Author: Cascade (model: Cascade GPT-5 medium reasoning)
"""
import sys
import os
import json
import time
import io
import contextlib
import base64
from typing import Any, Dict, List

# Ensure we can import the solver package
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
SOLVER_DIR = os.path.join(PROJECT_ROOT, 'solver')
if SOLVER_DIR not in sys.path:
    sys.path.insert(0, SOLVER_DIR)

try:
    from arc_visual_solver import ARCVisualSolver
except Exception as e:
    print(json.dumps({"type": "error", "message": f"Failed to import solver: {e}"}))
    sys.exit(1)


def emit(obj: Dict[str, Any]):
    """Emit a single NDJSON event to stdout and flush."""
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def b64(path: str) -> str:
    try:
        with open(path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    except Exception:
        return ''


def run():
    try:
        payload_raw = sys.stdin.read()
        cfg = json.loads(payload_raw)
        task_path: str = cfg.get('taskPath')
        if not task_path or not os.path.exists(task_path):
            emit({"type": "error", "message": f"Task file not found: {task_path}"})
            return 1

        start_ts = time.time()

        # Announce start (minimal metadata)
        emit({'type': 'start', 'metadata': {'taskPath': task_path}})

        # Extract options; default provider is openai (explicit, no silent fallback)
        opts: Dict[str, Any] = cfg.get('options') or {}
        provider: str = (opts.get('provider') or 'openai').lower()
        model: str = opts.get('model') or 'gpt-5'
        temperature = opts.get('temperature')
        cell_size = opts.get('cellSize') or 30

        # Normalize common UI model labels to backend ids
        # Note: We do not touch the solver; we keep normalization here in the wrapper.
        if isinstance(model, str):
            m_lower = model.strip().lower()
            if m_lower == 'gpt-5' or m_lower == 'gpt5' or model == 'GPT-5':
                model = 'gpt-5'

            # If provider wasn't explicitly provided, infer from the model label.
            # This avoids passing an OpenAI provider with an Anthropic/Xai model name.
            if not opts.get('provider'):
                if 'claude' in m_lower or 'anthropic' in m_lower:
                    provider = 'anthropic'
                elif 'grok' in m_lower or 'xai' in m_lower:
                    provider = 'xai'
                elif 'gpt' in m_lower or 'openai' in m_lower:
                    provider = 'openai'
                else:
                    # Default to openai if ambiguous
                    provider = 'openai'

        # Enforce supported providers here (no silent fallback)
        if provider != 'openai':
            emit({
                'type': 'error',
                'message': f"Unsupported provider for Saturn Visual Solver: {provider}. Only 'openai' is supported for image delivery (base64 PNG)."
            })
            return 1

        # Construct solver. ARCVisualSolver will also validate, but we fail early here.
        try:
            solver = ARCVisualSolver(provider=provider, model=model, temperature=temperature, cell_size=cell_size)
        except Exception as init_err:
            emit({
                'type': 'error',
                'message': f"Failed to initialize Saturn solver: {init_err}"
            })
            return 1

        os.makedirs(solver.temp_dir, exist_ok=True)

        verbose_output = io.StringIO()
        with contextlib.redirect_stdout(verbose_output):
            success, prediction, num_phases = solver.solve(task_path)

        verbose_log = verbose_output.getvalue()

        # Optionally save prediction image
        pred_img_path = None
        if prediction:
            try:
                pred_img_path = solver.create_grid_image(prediction, label='final_prediction')
            except Exception:
                pred_img_path = None

        timing_ms = int((time.time() - start_ts) * 1000)

        emit({
            'type': 'final',
            'success': bool(success),
            'prediction': prediction if prediction else None,
            'result': {
                'patternDescription': 'Saturn visual analysis completed.',
                'reasoningLog': json.dumps(solver.conversation_history),
                'verboseLog': verbose_log,
                'hasReasoningLog': True,
                'phasesUsed': num_phases,
            },
            'timingMs': timing_ms,
            'images': ([{'path': pred_img_path, 'base64': b64(pred_img_path)}] if pred_img_path else [])
        })
        return 0

    except Exception as e:
        emit({"type": "error", "message": str(e)})
        return 1


if __name__ == '__main__':
    code = run()
    sys.exit(code)
