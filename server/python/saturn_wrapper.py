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
        options: Dict[str, Any] = cfg.get('options', {})
        if not task_path or not os.path.exists(task_path):
            emit({"type": "error", "message": f"Task file not found: {task_path}"})
            return 1

        start_ts = time.time()

        solver = ARCVisualSolver()
        # Ensure temp image directory exists
        os.makedirs(solver.temp_dir, exist_ok=True)

        # Load the task once
        task = solver.load_task(task_path)

        # Compute total steps based on dataset
        train_len = len(task.get('train', []))
        extra_train = max(0, train_len - 2)
        total_steps = 1 + (1 if train_len > 1 else 0) + (1 if train_len > 1 else 0) + extra_train + 1

        emit({
            'type': 'start',
            'metadata': {
                'trainCount': train_len,
                'testCount': len(task.get('test', [])),
                'model': options.get('model', 'saturn')
            }
        })

        step = 0
        # Phase 1: First training example I/O
        step += 1
        train0_in = solver.create_grid_image(task['train'][0]['input'], label='train1_input')
        train0_out = solver.create_grid_image(task['train'][0]['output'], label='train1_output')
        emit({
            'type': 'progress',
            'phase': 'train_example_1',
            'step': step,
            'totalSteps': total_steps,
            'message': 'Analyzing first training IO pair',
            'images': [
                {'path': train0_in, 'base64': b64(train0_in)},
                {'path': train0_out, 'base64': b64(train0_out)}
            ]
        })
        prompt_1 = (
            "You are looking at a visual puzzle. I'll show you examples of inputs and their corresponding outputs.\n\n"
            "Remember transformations are deterministic and reproducible.\n\n"
            "Here's the first training example:"
        )
        solver.call_ai_with_image(prompt_1, [train0_in, train0_out])

        # Phase 2 and 3 if training[1] exists
        if train_len > 1:
            # Phase 2: predict second training output
            step += 1
            train1_in = solver.create_grid_image(task['train'][1]['input'], label='train2_input')
            emit({
                'type': 'progress',
                'phase': 'train_example_2_predict',
                'step': step,
                'totalSteps': total_steps,
                'message': 'Predicting second training output',
                'images': [ {'path': train1_in, 'base64': b64(train1_in)} ]
            })
            solver.call_ai_with_image("Predict output for second training input based on learned pattern.", [train1_in])

            # Phase 3: reveal second training output
            step += 1
            train1_out = solver.create_grid_image(task['train'][1]['output'], label='train2_output')
            emit({
                'type': 'progress',
                'phase': 'train_example_2_reveal',
                'step': step,
                'totalSteps': total_steps,
                'message': 'Revealing second training output and refining approach',
                'images': [ {'path': train1_out, 'base64': b64(train1_out)} ]
            })
            solver.call_ai_with_image("Here is the correct output for the second training example; refine your approach.", [train1_out])

        # Additional training examples
        for i in range(2, train_len):
            step += 1
            img_in = solver.create_grid_image(task['train'][i]['input'], label=f'train{i+1}_input')
            img_out = solver.create_grid_image(task['train'][i]['output'], label=f'train{i+1}_output')
            emit({
                'type': 'progress',
                'phase': f'train_example_{i+1}',
                'step': step,
                'totalSteps': total_steps,
                'message': f'Processing training example {i+1}',
                'images': [
                    {'path': img_in, 'base64': b64(img_in)},
                    {'path': img_out, 'base64': b64(img_out)}
                ]
            })
            solver.call_ai_with_image(f"Training example {i+1} input/output for analysis.", [img_in, img_out])

        # Phase 4: test input -> predict output
        step += 1
        test_in = solver.create_grid_image(task['test'][0]['input'], label='test_input')
        emit({
            'type': 'progress',
            'phase': 'test_predict',
            'step': step,
            'totalSteps': total_steps,
            'message': 'Generating prediction for test input',
            'images': [ {'path': test_in, 'base64': b64(test_in)} ]
        })
        resp_test = solver.call_ai_with_image("Generate the output grid for this test input.", [test_in])

        predicted = solver.parse_grid_from_response(resp_test)
        success = False
        actual_out = None
        if 'output' in task['test'][0] and task['test'][0]['output']:
            actual_out = task['test'][0]['output']
            success = (predicted == actual_out)

        pred_img_path = None
        if predicted:
            try:
                pred_img_path = solver.create_grid_image(predicted, label='final_prediction')
            except Exception:
                pred_img_path = None

        timing_ms = int((time.time() - start_ts) * 1000)

        emit({
            'type': 'final',
            'success': bool(success),
            'prediction': predicted if predicted else None,
            'result': {
                'patternDescription': 'Saturn visual analysis completed.',
                'solvingStrategy': 'Phased visual reasoning with iterative refinement.',
                'hints': ['Focus on consistent transformations', 'Check object semantics'],
                'alienMeaning': '',
                'confidence': 50 if not success else 90,
                'reasoningLog': json.dumps(solver.conversation_history),
                'hasReasoningLog': True
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
