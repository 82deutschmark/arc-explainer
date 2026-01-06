# LP85: Loop & Pull - Intel & Strategy

## Game Overview
- **Game ID**: `lp85`
- **Official Title**: Loop & Pull
- **Category**: Evaluation
- **Difficulty**: Hard

## Core Mechanics
- **Interaction**: Click-based (ACTION6).
- **Control Objects**: **Green** objects (Advance/Forward) and **Red** objects (Reverse/Back).
- **Game Objects**: Loops or sequences of colored blocks.
- **Goal**: Align the **yellow** colored block with a specific indicated target position.

## Advanced Level Complications
- **Multiple Loops**: Levels with several independent or interlocking looping sequences.
- **Multiple Targets**: Aligning multiple colored blocks simultaneously.
- **Non-Looping Controls**: Buttons that control different mechanics (e.g., shifts, toggles, or gates) rather than simple directional looping.

## Proven Strategies
- **Sequence Matching**: Determine the "length" of the loop (e.g., how many clicks to return to original state).
- **State Estimation**: Predict the relative position of the yellow block after $n$ clicks on the Green vs. Red controllers.

## Potential Obstacles for Agents
- **Complexity**: Hard-difficulty levels with non-linear controls will require the agent to build an internal state-transition model.
- **Visual Occlusion**: Do loops overlap or hide other segments?

## Questions for Refining Strategy
1. **Loop Sensitivity**: Does clicking a Green object advance *all* loops, or only the specific loop associated with that object's position/cluster?
2. **Indicated Positions**: How is the "target position" visually distinguished (e.g., a hollow yellow border, a specific gray tile)?
3. **Button Mechanics**: For "buttons that control different things," can you describe an example of a non-looping effect?
