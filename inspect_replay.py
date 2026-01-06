
import json
import os

replay_path = r'd:\GitHub\arc-explainer\arc3\as66-821a4dcad9c2.db85123a-891c-4fde-8bd3-b85c6702575d.jsonl'

with open(replay_path, 'r') as f:
    for i in range(10):
        line = f.readline()
        if not line:
            break
        data = json.loads(line)
        action_input = data.get('action_input', {})
        action_id = action_input.get('id')
        score = data.get('score')
        state = data.get('state')
        print(f"Turn {i}: ActionID={action_id}, Score={score}, State={state}")
