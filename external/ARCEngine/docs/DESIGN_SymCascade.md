I'll read the referenced documents to understand the ARC3 game engine constraints and existing examples, then pitch a novel game design.

Let me search for the development guide to understand all constraints before pitching the game design.

Let me search for more ARC3 documentation to understand all constraints:

Let me read the ARC3 integration and game documentation to better understand the constraints and goals:

# Game Design Pitch: **"Symmetry Cascade"** (Game ID: `sy47`)

## Core Concept

A puzzle game about **discovering and exploiting dynamic symmetry rules** to transform a pattern into a target configuration. Players must infer which reflection axes are active, understand how operations compose across symmetries, and plan transformation sequences.

## Why This Tests Abstract Reasoning

Unlike existing ARC3 games that focus on navigation, physics simulation, or tile matching, **Symmetry Cascade** specifically tests:

1. **Pattern abstraction** - Recognizing symmetry relationships without explicit markers
2. **Rule composition** - Understanding how symmetries interact and compound
3. **Hypothesis testing** - Inferring hidden symmetry axes through experimentation  
4. **Spatial transformation reasoning** - The core skill ARC-AGI was designed to measure

## Game Mechanics

### Visual Layout (64×64 grid)
```
┌─────────────────────────────────┐
│  [Active Axes Indicator: 3×3]  │  ← Shows which symmetries are active (players must decode)
├─────────────────────────────────┤
│                                 │
│     Working Grid (30×30)        │  ← Main playfield with editable pattern
│                                 │
├─────────────────────────────────┤
│     Target Grid (30×30)         │  ← Goal pattern (static reference)
└─────────────────────────────────┘
```

### Core Rules

1. **Symmetry Axes**: Each level has 1-3 active reflection axes (horizontal, vertical, diagonal-1, diagonal-2, center-point rotation)
   - Axes are **not visually marked** - players must infer them
   - A small 3×3 "axis indicator" shows encoded hints (abstract symbols, not explicit labels)

2. **Actions**:
   - **ACTION6 (x,y)**: Click a cell to toggle its color (cycles through 3-4 colors)
   - **ACTION1-4**: Activate special "transformation brushes" that apply to clicked regions
   - **ACTION5**: "Lock in" - commits current symmetry hypothesis and applies it globally
   - **ACTION7**: Undo last operation

3. **The Hook - Cascading Symmetry**:
   - When you click a cell, the change reflects across **all active symmetry axes simultaneously**
   - Example: If both horizontal and vertical axes are active, clicking one cell changes 4 cells (the original + 3 reflections)
   - With diagonal symmetry added, one click affects 8 cells
   - **Players must experimentally discover which axes are active by observing the cascade pattern**

4. **Win Condition**: Make the working grid match the target grid exactly

5. **Difficulty Progression**:
   - **Level 1-2**: Single symmetry axis (horizontal or vertical), sparse pattern
   - **Level 3-4**: Two perpendicular axes, medium complexity
   - **Level 5-6**: Three+ axes including diagonals, dense patterns
   - **Level 7-8**: **Dynamic symmetry** - axes change after certain actions or when specific patterns are formed

## Why This Is Novel

**Compared to existing games:**

- **ls20 (Locksmith)**: Navigation + state transformation → **sy47 is pure spatial reasoning**
- **ft09 (Functional Tiles)**: Color precedence rules → **sy47 has compositional symmetry rules**  
- **vc33 (Volume Control)**: Physics simulation → **sy47 is abstract mathematical transformation**
- **sp80/as66/lp85**: All involve moving entities → **sy47 is stateless pattern matching with hidden rules**

**What makes it distinctly ARC-like:**
- Core challenge is **inferring abstract rules from observations** (which symmetries are active?)
- Requires **building a mental model** through experimentation
- Tests **compositional reasoning** (how multiple symmetries interact)
- **No hand-holding** - players must discover the mechanics themselves

## Technical Implementation Notes

```python
class Sy47(ARCBaseGame):
    """Symmetry Cascade - Discover and exploit reflection axes"""
    
    def __init__(self, seed: int = 0):
        self._rng = random.Random(seed)
        self.active_axes = []  # ['horizontal', 'vertical', 'diagonal_1', etc.]
        self.working_pattern = {}  # Current state
        self.target_pattern = {}   # Goal state
        
    def step(self):
        if self.action.id == GameAction.ACTION6:
            x, y = self.action.data.get("x"), self.action.data.get("y")
            coords = self.camera.display_to_grid(x, y)
            
            if coords:
                # Toggle clicked cell
                self._toggle_cell(*coords)
                
                # Apply cascading symmetry transformations
                for axis in self.active_axes:
                    reflected_coords = self._reflect_point(coords, axis)
                    self._toggle_cell(*reflected_coords)
                
                # Check win condition
                if self._check_match():
                    self.next_level()
        
        self.complete_action()
```

## Sample Level Design - Level 1

**Axis indicator** (3×3 grid, top-left):
```
[0] [11] [0]    ← Horizontal line = horizontal symmetry active
[0] [11] [0]    
[0] [11] [0]
```

**Target pattern** (simplified 8×8 example):
```
. . B B B B . .
. . B . . B . .
. . . . . . . .
. . . . . . . .
. . . . . . . .
. . . . . . . .
. . B . . B . .
. . B B B B . .
```
*(Player must discover this has horizontal symmetry and replicate it)*

## Why Players/Agents Will Love (or Struggle With) This

✅ **For strong reasoners**: Elegant "aha!" moments when discovering each symmetry axis  
✅ **For systematic thinkers**: Rewards methodical experimentation  
✅ **For ARC-AGI goals**: Directly tests core abstraction and reasoning skills  
⚠️ **Challenge for brute-force**: Exponential search space makes random clicking futile  
⚠️ **Difficulty curve**: Later levels with dynamic/conditional symmetries will be genuinely hard

---

## Alternative Names
- "Mirror Protocol" 
- "Axis Inference"
- "Reflection Cascade"
