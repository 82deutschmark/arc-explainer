# ARC-AGI-3 "Study Guide" Agent Implementation Plan

## Objective
Build a high-performance Python agent for ARC-AGI-3 that leverages "Gold Intel" (pre-studied game mechanics) rather than open-ended reasoning. The agent will use **GPT-5-Nano** for decision making, supplemented by the **Arc3Harness** for semantic grid analysis and visual input (PNG).

## Architecture: The "Study Guide" Approach
Instead of a "Thinking" agent that makes guesses, this agent acts like a student who has memorized the test. 

### 1. Game Identification & Rule Selection
- The agent immediately identifies the `game_id`.
- It loads a "Cheat Sheet" for that specific game (extracted from our analysis docs).
- This cheat sheet is injected into the System Prompt to guide the LLM's visual interpretation.

### 2. Analytical Layer (Arc3Harness)
- Uses the upgraded `Arc3Harness` to detect:
    - **LS20**: Key position (bottom-left) and current rotation state.
    - **FT09**: Top-right reference region and dominant color precedence.
    - **VC33**: White column heights (liquid levels).
    - **SP80**: Gravity paths and container boundaries.
    - **AS66**: Sliding paths, hazard detection (red/orange), and target color.
    - **LP85**: Indicator slots (small yellow squares) vs current blocks.

### 3. Execution Loop
1. **Initialize**: Load `.env` (API Keys), Open Scorecard.
2. **Perception**: 
    - Render current grid to PNG.
    - Run `Arc3Harness.analyze_grid()` for semantic insights.
3. **Decision (GPT-5-Nano)**:
    - System Prompt: "You are playing [GAME_NAME]. Remember: [SPECIFIC RULES]."
    - User Prompt: [GRID_PNG] + [HARNESS_INSIGHTS] + [PREVIOUS_ACTIONS].
4. **Action**: Execute `ACTION1-7`. If a multi-action sequence is known (e.g., AS66 Level 1), the agent can queue them.
5. **Evaluation**: Check if the action moved the state closer to the goal.
6. **Cleanup**: Close Scorecard.

## Key Components to Build
1. **`arc3_gold_agent.py`**: The main entry point and execution loop.
2. **`gold_prompts.py`**: A library of game-specific strategic prompts (The "Study Guide").
3. **`arc3_api_client.py`**: Reliable wrapper for Scorecard, Reset, and Action endpoints.

## Success Metrics
- **Zero-Turn Failure**: Avoiding instant-death hazards in AS66.
- **Fast Wins**: Solving Level 1 matches in 3-5 moves using known sequences.
- **Hydraulic Mastery**: Correct volume-shifting in VC33 without "thinking" loops.
