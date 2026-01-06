#!/bin/bash
# Background ARC3 Game Runner
# Author: Claude Haiku 4.5
# Date: 2026-01-04
# PURPOSE: Run GPT-5 Nano agent(s) in the background, logging results
# Usage: ./run_arc3_background.sh [game_id] [num_games]
#        ./run_arc3_background.sh ls20 5    # Play ls20 five times
#        ./run_arc3_background.sh all 1     # Play all 6 games once each

set -e

# Configuration
PYTHON_SCRIPT="arc3_gpt5_nano_agent.py"
LOG_DIR="../../logs/arc3_games"
MODEL="${MODEL:-gpt-5-nano}"

# Parse arguments
GAME_ID="${1:-ls20}"
RUNS="${2:-1}"

# Create log directory
mkdir -p "$LOG_DIR"

# Expand "all" to all game IDs
if [ "$GAME_ID" = "all" ]; then
    GAMES=("ls20" "ft09" "sp80" "as66" "lp85" "vc33")
else
    GAMES=("$GAME_ID")
fi

# Build games array for all runs
GAMES_TO_PLAY=()
for ((i = 0; i < RUNS; i++)); do
    for game in "${GAMES[@]}"; do
        GAMES_TO_PLAY+=("$game")
    done
done

# Create config JSON
CONFIG=$(cat <<EOF
{
    "games": [$(printf '"%s"' "${GAMES_TO_PLAY[@]}" | sed 's/" /", "/g')],
    "model": "$MODEL",
    "max_turns": 80
}
EOF
)

# Generate log filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/gpt5_nano_${TIMESTAMP}.jsonl"

echo "Starting GPT-5 Nano background player..."
echo "Games to play: ${#GAMES_TO_PLAY[@]} total"
echo "  Games: ${GAMES_TO_PLAY[*]}"
echo "  Model: $MODEL"
echo "  Log file: $LOG_FILE"
echo "---"

# Run the agent, piping output to log file
echo "$CONFIG" | python3 "$PYTHON_SCRIPT" | tee "$LOG_FILE"

echo "---"
echo "Completed! Results logged to: $LOG_FILE"
echo "To monitor progress:"
echo "  tail -f $LOG_FILE | grep -E 'game\.(started|won|over)'"
