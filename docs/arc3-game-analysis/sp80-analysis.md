# SP80: Streaming Purple - Intel & Strategy

## Game Overview
- **Game ID**: `sp80`
- **Official Title**: Streaming Purple
- **Category**: Evaluation
- **Difficulty**: Medium

## Core Mechanics
- **Emitters**: A source node that produces a stream of purple liquid.
- **Physics**: The purple liquid falls straight down according to gravity.
- **Targets**: White U-shaped containers at the bottom of the screen.
- **Toolbox**: The agent can place (and potentially move) **platforms** to redirect the downward flow.
- **Goal**: Redirect the entire stream into the white containers. Liquid must not spill outside the U-shapes.

## Advanced Level Complications
- **Movable Platforms**: Some platforms can be repositioned.
- **Platform-Emitters**: Later levels feature platforms that also act as emitters.
- **Multiple Flows**: Managing multiple streams into discrete containers.

## Proven Strategies
- **Topology Analysis**: Use delta analysis to see where the purple pixels are falling and place platforms diagonally to "slide" the flow horizontally.
- **Containment Check**: Monitor the boundary of the white U-shaped containers for any purple pixels (spillage).

## Potential Obstacles for Agents
- **Static vs. Dynamic Flow**: Understanding that the stream is continuous and "painting" the grid over time.
- **Resource Limits**: Are there a limited number of platforms that can be placed?

## Questions for Refining Strategy
1. **Platform Availability**: Does the agent have an "inventory" of platforms to place, or can they draw/create them anywhere?
2. **Platform Controls**: Is placing a platform an ACTION6 (Click) to toggle a pixel, or a drag-and-drop mechanism?
3. **Movable Emitters**: For "platforms which also contain an emitter," does moving the platform also shift the source point of the gravity-fed stream immediately?
