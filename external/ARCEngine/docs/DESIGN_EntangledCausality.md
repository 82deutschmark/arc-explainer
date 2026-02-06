I'll read the ARC3 game engine documentation to understand the constraints and then pitch a novel game design for AI testing.







The [external/ARCEngine](cci:9://file:///C:/Users/markb/.windsurf/worktrees/arc-explainer/arc-explainer-e9b1ba50/external/ARCEngine:0:0-0:0) directory is empty in this worktree. Let me search the codebase for ARC3 game engine references to understand the constraints.



Based on my understanding of the ARC3 engine constraints, here's my pitch for a novel AI-testing game:

---

## **ENTANGLED CAUSALITY** (`ec01`)

### Core Concept
A grid-based puzzle where **causality is non-local**—modifying one region of the grid causes instantaneous changes in distant regions according to hidden entanglement rules. The AI must deduce the entanglement topology through experimentation, then use that knowledge to transform the grid into a target state.

### Why It Tests AI (Not Humans)
- **Violates human spatial intuition**: Humans instinctively expect local causality; this game requires discarding that assumption
- **Requires systematic hypothesis testing**: Each action is an experiment yielding data about hidden relationships
- **Demands working memory across frames**: The AI must track correlations across many actions to map the entanglement graph
- **Abstract reasoning over visual patterns**: The "solution" isn't visually apparent—it's a mathematical property of the grid

### Mechanics (Within ARC3 Constraints)

**Grid**: 64×64, 4 layers deep (treated as 4 entangled "planes")

**Colors 0-15 encode**:
- 0: Empty/background
- 1-7: "Particle" types (each particle belongs to an entanglement group)
- 8-14: "Activated" states (particle + 7)
- 15: Target marker

**Hidden Rule Generation** (per game instance):
- Randomly partition the 4 layers into entanglement groups (e.g., group A: layer 0 and layer 2; group B: layer 1 and layer 3)
- Within each group, cells at the same (x,y) coordinates are entangled
- Changing a cell's state in one layer instantaneously flips the corresponding cell in all entangled layers

**Actions**:
- **ACTION1-4**: Activate/deactivate all particles of type 1-4 in a specific layer (cycles through layers)
- **ACTION5**: "Observe"—collapses all entangled groups into their most common state ( irreversible, costs score)
- **ACTION6**: Targeted coordinate action—activates a single cell and its entangled partners
- **ACTION7**: Undo

**Win Condition**: All cells in layer 3 must match the target pattern (shown in layer 0), using ≤30 actions

### Why This Is Novel
Unlike existing ARC3 games (which focus on navigation, object manipulation, or physics simulation), **Entangled Causality** tests:
- **Scientific reasoning**: Forming and testing hypotheses about hidden mechanisms
- **Graph topology inference**: Reconstructing an unseen connectivity graph from pairwise observations
- **Counterintuitive physics**: The rules are "alien" by design—no human cultural knowledge helps

### Implementation Notes
- Easy to generate unique instances (random entanglement groupings, random target patterns)
- Deterministic and verifiable
- Progressively harder variants: more layers, dynamic entanglement (groups shift after N actions), noisy observations

---
Based on your knowledge of the ARC3 games and engines, was this idea any good?