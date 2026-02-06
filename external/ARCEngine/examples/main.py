"""Benchmark the SimpleMaze game."""

import time

from simple_maze import SimpleMaze

from arcengine import ActionInput, GameAction


def main() -> None:
    """Run the benchmark."""
    # Create the game
    game = SimpleMaze()

    # Array to store outputs
    outputs = []

    # Time the benchmark
    start_time = time.time()

    # Run 10000 actions
    for _ in range(10000):
        # Alternate between the four movement actions
        action_id = ActionInput(id=GameAction.ACTION1)
        output = game.perform_action(action_id, raw=True)
        outputs.append(output)

    end_time = time.time()

    # Print results
    print(f"Time taken: {end_time - start_time:.2f} seconds")
    print(f"Average time per action: {(end_time - start_time) / 10000 * 1000:.2f} ms")


if __name__ == "__main__":
    main()
