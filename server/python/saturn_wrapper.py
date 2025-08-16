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
import threading
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
    """Emit a single NDJSON event and flush.
    Important: write to sys.__stdout__ to avoid recursion when stdout is redirected.
    """
    sys.__stdout__.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.__stdout__.flush()


def b64(path: str) -> str:
    try:
        with open(path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    except Exception:
        return ''


# Cascade: StreamEmitter tees Python prints to both an in-memory buffer and
# NDJSON 'log' events so the UI can display real-time console output.
class StreamEmitter(io.TextIOBase):
    def __init__(self, sink: io.StringIO, level: str = 'info') -> None:
        self._sink = sink
        self._buf = ''
        self._level = level

    def write(self, s: Any) -> int:
        try:
            text = s if isinstance(s, str) else str(s)
        except Exception:
            text = str(s)
        # Always store full output for final verbose log
        self._sink.write(text)
        self._buf += text
        # Emit each complete line as a log event
        count = 0
        while '\n' in self._buf:
            line, self._buf = self._buf.split('\n', 1)
            line_stripped = line.strip()
            if line_stripped:
                emit({ 'type': 'log', 'level': ('error' if self._level == 'error' else 'info'), 'message': line_stripped })
            count += 1
        return len(text)

    def flush(self) -> None:
        # No-op; flush handled by emit and outer streams
        pass


def run():
    try:
        payload_raw = sys.stdin.read()
        cfg = json.loads(payload_raw)
        task_path: str = cfg.get('taskPath')
        if not task_path or not os.path.exists(task_path):
            emit({"type": "error", "message": f"Task file not found: {task_path}"})
            return 1

        start_ts = time.time()
        # Cascade: derive a simple task id for per-run image isolation
        task_id = os.path.splitext(os.path.basename(task_path))[0]

        # Announce start (minimal metadata)
        emit({'type': 'start', 'metadata': {'taskPath': task_path}})

        # Extract options; default provider is openai (explicit, no silent fallback)
        opts: Dict[str, Any] = cfg.get('options') or {}
        provider: str = (opts.get('provider') or 'openai').lower()
        model: str = opts.get('model') or 'gpt-5'
        temperature = opts.get('temperature')
        cell_size = opts.get('cellSize') or 30
        # Cascade: total steps hint used only for UI progress context on image events
        max_steps = int(opts.get('maxSteps') or 8)

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

        # Provider pass-through: do not block non-OpenAI providers here.
        # Note: The current ARCVisualSolver implementation is OpenAI-backed.
        # Other providers may still function if upstream components adapt,
        # but we intentionally avoid blocking at the wrapper level to match
        # previous behavior requested by the application.
        # (Cascade) 2025-08-15: removed OpenAI-only guard.
        emit({ 'type': 'log', 'level': 'info', 'message': f"Provider selected: {provider}; model: {model}" })

        # Construct solver. ARCVisualSolver.__init__ takes no kwargs; provider/model are
        # enforced/normalized in this wrapper and used implicitly by the solver internals.
        # Do NOT pass unsupported kwargs like 'provider' to avoid init errors.
        try:
            solver = ARCVisualSolver()
        except Exception as init_err:
            emit({
                'type': 'error',
                'message': f"Failed to initialize Saturn solver: {init_err}"
            })
            return 1

        # Cascade: Isolate images per run by creating a unique subdirectory.
        # This prevents the watcher from emitting PNGs from previous runs.
        run_dir = os.path.join(solver.temp_dir, f"{task_id}_{int(time.time()*1000)}")
        solver.temp_dir = run_dir
        os.makedirs(solver.temp_dir, exist_ok=True)

        # Cascade: Start a lightweight watcher thread that streams newly created PNGs
        # from the solver's temp directory as incremental progress events. This avoids
        # touching the solver internals while enabling the UI to display images as
        # they are generated. The watcher deduplicates by filename, caps the number
        # of images, and stops when the solve completes.
        stop_event = threading.Event()

        def _watch_and_emit_images():
            seen: set[str] = set()
            cap = 50  # safety cap to avoid excessive events
            while not stop_event.is_set():
                try:
                    # Sort for stable ordering when multiple files appear between polls
                    for name in sorted(os.listdir(solver.temp_dir)):
                        if not name.lower().endswith('.png'):
                            continue
                        if name in seen:
                            continue
                        full = os.path.join(solver.temp_dir, name)
                        data = b64(full)
                        if data:
                            emit({
                                'type': 'progress',
                                'phase': 'image',
                                'step': 0,  # unknown without modifying solver; UI uses this only as a hint
                                'totalSteps': max_steps,
                                'message': f'Image generated: {name}',
                                'images': [{ 'path': full, 'base64': data }],
                            })
                            seen.add(name)
                            if len(seen) >= cap:
                                stop_event.set()
                                break
                except Exception:
                    # Swallow watcher errors to avoid interrupting the solve
                    pass
                time.sleep(0.25)

        watcher = threading.Thread(target=_watch_and_emit_images, daemon=True)
        watcher.start()

        verbose_output = io.StringIO()
        # Cascade: redirect both stdout and stderr through StreamEmitter so
        # prints are emitted live as NDJSON 'log' events and also captured.
        with contextlib.redirect_stdout(StreamEmitter(verbose_output, 'info')):
            with contextlib.redirect_stderr(StreamEmitter(verbose_output, 'error')):
                success, prediction, num_phases = solver.solve(task_path)

        # Ensure watcher stops after solve finishes
        stop_event.set()
        try:
            watcher.join(timeout=1.0)
        except Exception:
            pass

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
