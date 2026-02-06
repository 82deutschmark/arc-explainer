# CHROMATIC COLLAPSE
## A Reality-Bending Puzzle Game for ARCEngine

**Genre:** Abstract Puzzle / Reality Manipulation  
**Tagline:** *"When colors collide, reality rewrites itself."*

---

## THE PITCH

Imagine a game where **every action changes the rules**. Not metaphorically—literally. You're not just moving through a maze; you're **rewriting the physics of the world** with every collision.

**Chromatic Collapse** is a puzzle game where colored entities have **emergent interaction rules**. When two colors touch, they don't just merge or destroy—they **transform based on color theory**, creating cascading chain reactions that reshape the entire level. Red + Blue = Purple (a new entity with new behaviors). Yellow + Blue = Green (which might phase through walls). The player must think several moves ahead, predicting how color combinations will alter the game state.

This isn't another maze game. This isn't another merge game. This is **emergent chemistry meets spatial reasoning**, where the puzzle isn't just "reach the exit"—it's "engineer the right sequence of reactions to make reaching the exit possible."

---

## WHY THIS WORKS IN ARCENGINE

The previous assistant was thinking too small. They saw the merge mechanic and thought "collect key pieces." They saw movement and thought "navigate maze." But ARCEngine's **real power** lies in:

1. **Dynamic sprite creation/destruction** - We can spawn new entities mid-game
2. **Interaction mode switching** - Entities can become tangible, intangible, or invisible based on reactions
3. **Pixel-perfect collision** - Essential for complex multi-entity interactions
4. **Color remapping** - Change entity properties on the fly
5. **Turn-based frame generation** - Perfect for showing cascading reactions step-by-step

**Chromatic Collapse** exploits ALL of these simultaneously.

---

## CORE MECHANICS

### 1. Color Fusion System

When two colored entities collide, they **fuse** according to color theory:

| Color A | Color B | Result | Properties |
|---------|---------|--------|------------|
| Red (2) | Blue (9) | Purple (12) | Pushes other entities |
| Red (2) | Yellow (4) | Orange (8) | Destroys walls on contact |
| Blue (9) | Yellow (4) | Green (6) | Phases through walls (INTANGIBLE) |
| Red (2) | Green (6) | Brown (14) | Heavy, immovable anchor |
| Purple (12) | Yellow (4) | White (7) | Victory condition |
| Any | Black (0) | Void | Entity removed |

### 2. The Player is a Catalyst

You control a **transparent catalyst** (color -1). You don't merge—you **push** colored entities into each other. Your job is to:
- Position entities for optimal collisions
- Create chain reactions
- Engineer specific color outcomes
- Avoid creating blocking situations

### 3. Cascading Reactions

When a fusion creates a new entity, it **immediately checks for new collisions**. This creates chain reactions:

```
Turn 1: Push Red into Blue → Creates Purple
Turn 2: Purple spawns, collides with Yellow → Creates White
Turn 3: White reaches goal → WIN
```

### 4. Environmental Hazards

- **Black Voids** (color 0): Destroy any entity that touches them
- **Gray Walls** (color 5): Solid barriers (except Green can phase through)
- **Cyan Locks** (color 3): Only Orange can destroy
- **Teal Triggers** (color 11): Activate when specific color touches them

### 5. Win Condition

Create **White** (the ultimate fusion) and guide it to the **goal zone**. White is rare—it requires Purple + Yellow, which means you need Red + Blue first.

---

## WHAT MAKES THIS INNOVATIVE

### Beyond the Examples

- **simple_maze**: Static world, static rules → We have **dynamic rules**
- **merge**: Collect and grow → We have **strategic transformation**
- **complex_maze**: Push blocks → We have **reactive chemistry**
- **Key Forge**: Linear collection → We have **non-linear problem solving**

### Emergent Complexity

Early levels teach basic fusions. Later levels require:
- **Multi-step planning**: "I need White, so I need Purple, so I need Red and Blue positioned correctly"
- **Resource management**: Limited entities, must use them wisely
- **Spatial reasoning**: Positioning matters—wrong order = unsolvable state
- **Timing**: Some reactions must happen before others

### Replayability

Multiple solutions exist. Speedrunners can find optimal reaction chains. Puzzle enthusiasts can discover elegant solutions.

---

## LEVEL PROGRESSION

### Tutorial Levels (1-3)

**Level 1: First Contact**
- 1 Red entity, 1 Blue entity, empty goal
- Teach: Push entities together, observe Purple creation
- Win: Create Purple

**Level 2: Chain Reaction**
- 1 Red, 1 Blue, 1 Yellow, goal zone
- Teach: Purple + Yellow = White
- Win: Create White and reach goal

**Level 3: Obstacle Course**
- Walls blocking direct paths
- Teach: Navigation + fusion planning

### Intermediate Levels (4-7)

**Level 4: The Green Phase**
- Maze with no clear path
- Blue + Yellow = Green (phases through walls)
- Teach: Some fusions grant new abilities

**Level 5: Destructive Force**
- Cyan locks blocking goal
- Red + Yellow = Orange (destroys locks)
- Teach: Environmental interaction

**Level 6: Void Management**
- Black voids scattered
- Must avoid creating entities near voids
- Teach: Negative space matters

**Level 7: Anchor Points**
- Red + Green = Brown (immovable)
- Use Brown to block unwanted reactions
- Teach: Defensive fusion

### Advanced Levels (8-12)

**Level 8: Triple Fusion**
- Need to create White, but limited space
- Must plan 3-step reaction chain
- Teach: Long-term planning

**Level 9: Parallel Reactions**
- Multiple fusion chains must happen simultaneously
- Teach: Multi-threaded thinking

**Level 10: The Gauntlet**
- All mechanics combined
- Multiple solutions possible
- Teach: Mastery

**Level 11: Reverse Engineering**
- Goal: Create specific color pattern
- Work backwards from desired result
- Teach: Inverse problem solving

**Level 12: Chromatic Singularity**
- Final boss level
- 6+ entities, complex maze, multiple hazards
- Requires perfect execution

---

## TECHNICAL IMPLEMENTATION

### Sprite Definitions

```python
# Player (Catalyst) - Transparent pusher
"catalyst": Sprite(
    pixels=[[10, 10], [10, 10]],  # Pink 2x2
    name="catalyst",
    blocking=BlockingMode.BOUNDING_BOX,
    interaction=InteractionMode.TANGIBLE,
    tags=["player"],
)

# Color Entities (1x1 for simplicity, can scale up)
"red": Sprite(pixels=[[2]], name="red", tags=["entity", "red"])
"blue": Sprite(pixels=[[9]], name="blue", tags=["entity", "blue"])
"yellow": Sprite(pixels=[[4]], name="yellow", tags=["entity", "yellow"])
"purple": Sprite(pixels=[[12]], name="purple", tags=["entity", "purple"])
"orange": Sprite(pixels=[[8]], name="orange", tags=["entity", "orange"])
"green": Sprite(pixels=[[6]], name="green", tags=["entity", "green"])
"brown": Sprite(pixels=[[14]], name="brown", tags=["entity", "brown"])
"white": Sprite(pixels=[[7]], name="white", tags=["entity", "white"])

# Environment
"wall": Sprite(pixels=[[5]], blocking=BlockingMode.PIXEL_PERFECT)
"void": Sprite(pixels=[[0]], tags=["hazard", "void"])
"lock": Sprite(pixels=[[3]], tags=["destructible"])
"goal": Sprite(pixels=[[11]], tags=["goal"], interaction=InteractionMode.INTANGIBLE)
```

### Core Game Loop

```python
class ChromaticCollapse(ARCBaseGame):
    def step(self) -> None:
        # 1. Move player (catalyst)
        dx, dy = self._get_movement_input()
        player_collisions = self.try_move("catalyst", dx, dy)
        
        # 2. Push entities player collides with
        for entity in player_collisions:
            if "entity" in entity.tags:
                self._push_entity(entity, dx, dy)
        
        # 3. Process all entity collisions (cascading)
        self._process_reactions()
        
        # 4. Check win/lose conditions
        if self._check_win():
            self.next_level()
        elif self._check_lose():
            self.lose()
        
        self.complete_action()
    
    def _push_entity(self, entity: Sprite, dx: int, dy: int) -> None:
        """Push an entity and check for collisions."""
        collisions = self.try_move_sprite(entity, dx, dy)
        
        for other in collisions:
            if "entity" in other.tags:
                # Two entities collided - trigger fusion
                self._fuse_entities(entity, other)
    
    def _fuse_entities(self, entity1: Sprite, entity2: Sprite) -> None:
        """Fuse two entities based on color rules."""
        color1 = self._get_entity_color(entity1)
        color2 = self._get_entity_color(entity2)
        
        result_color = FUSION_RULES.get((color1, color2))
        
        if result_color is None:
            return  # No fusion rule
        
        # Remove original entities
        self.current_level.remove_sprite(entity1)
        self.current_level.remove_sprite(entity2)
        
        # Create new entity at midpoint
        new_x = (entity1.x + entity2.x) // 2
        new_y = (entity1.y + entity2.y) // 2
        
        new_entity = self._create_entity(result_color, new_x, new_y)
        self.current_level.add_sprite(new_entity)
        
        # Trigger cascade check
        self._pending_reactions.append(new_entity)
    
    def _process_reactions(self) -> None:
        """Process cascading reactions until stable."""
        max_iterations = 10  # Prevent infinite loops
        iteration = 0
        
        while self._pending_reactions and iteration < max_iterations:
            entity = self._pending_reactions.pop(0)
            
            # Check if new entity collides with anything
            collisions = self.current_level.collides_with(entity)
            
            for other in collisions:
                if "entity" in other.tags:
                    self._fuse_entities(entity, other)
                elif "hazard" in other.tags:
                    self._handle_hazard(entity, other)
                elif "destructible" in other.tags and self._can_destroy(entity):
                    self.current_level.remove_sprite(other)
            
            iteration += 1
```

### Fusion Rules Dictionary

```python
FUSION_RULES = {
    ("red", "blue"): "purple",
    ("blue", "red"): "purple",
    ("red", "yellow"): "orange",
    ("yellow", "red"): "orange",
    ("blue", "yellow"): "green",
    ("yellow", "blue"): "green",
    ("red", "green"): "brown",
    ("green", "red"): "brown",
    ("purple", "yellow"): "white",
    ("yellow", "purple"): "white",
    # Void interactions
    ("red", "void"): None,  # Entity destroyed
    ("blue", "void"): None,
    # ... etc
}
```

---

## VISUAL DESIGN

### Color Palette Strategy

Using ARCEngine's 16-color palette strategically:

- **Primary Colors** (entities): Red (2), Blue (9), Yellow (4)
- **Secondary Colors** (fusions): Purple (12), Orange (8), Green (6)
- **Tertiary Colors** (advanced): Brown (14), White (7)
- **Environment**: Black (0), Gray (5), Cyan (3), Teal (11)
- **Player**: Pink (10) - stands out, clearly not fusible
- **Background**: Navy (15) - dark but distinct from black

### Animation Strategy

Each fusion creates a mini-animation sequence:
1. Frame 1: Entities touch
2. Frame 2: Flash white (collision moment)
3. Frame 3: New entity appears
4. Frame 4-N: Cascade reactions (if any)

This uses ARCEngine's multi-frame action system beautifully.

---

## WHY THIS WILL SUCCEED

### 1. **Unique Gameplay**
No other puzzle game combines color theory, spatial reasoning, and emergent chemistry like this.

### 2. **Perfect for ARCEngine**
Uses every advanced feature: dynamic sprites, interaction modes, cascading logic, multi-frame actions.

### 3. **Scalable Complexity**
Tutorial levels are simple. Advanced levels are brain-melting. Appeals to casual and hardcore players.

### 4. **Speedrun Potential**
Optimal solutions exist. Community can compete for fastest/most elegant solutions.

### 5. **Educational Value**
Teaches color theory, cause-and-effect reasoning, systems thinking.

### 6. **Memorable**
Players will remember "that game where colors react like chemistry."

---

## DEVELOPMENT ROADMAP

### Phase 1: Core Mechanics (Week 1)
- Implement basic fusion system
- Player movement and pushing
- 3 primary colors + Purple fusion
- Tutorial levels 1-2

### Phase 2: Cascading Reactions (Week 2)
- Reaction queue system
- Multi-step fusion chains
- Animation frames for reactions
- Tutorial level 3 + Intermediate levels 4-5

### Phase 3: Environmental Interactions (Week 3)
- Hazards (voids, locks)
- Special entity properties (Green phasing, Orange destruction)
- Intermediate levels 6-7

### Phase 4: Advanced Puzzles (Week 4)
- Complex level design
- Multiple solution paths
- Advanced levels 8-12
- Balancing and polish

### Phase 5: Polish & Juice (Week 5)
- Visual feedback improvements
- Sound design (if applicable)
- UI for showing fusion rules
- Playtesting and iteration

---

## RISK MITIGATION

### Technical Risks

**Risk:** Cascading reactions cause infinite loops  
**Mitigation:** Max iteration limit (10), careful rule design to prevent cycles

**Risk:** Performance issues with many entities  
**Mitigation:** Limit entities per level (max 8), optimize collision checks

**Risk:** Unsolvable states  
**Mitigation:** Level design guidelines, reset button always available

### Design Risks

**Risk:** Too complex for players  
**Mitigation:** Gradual tutorial, visual fusion guide in UI, undo feature

**Risk:** Not enough depth  
**Mitigation:** 12+ levels, multiple solutions, optional challenges

**Risk:** Frustrating trial-and-error  
**Mitigation:** Show fusion rules in UI, allow experimentation without penalty

---

## COMPETITIVE ANALYSIS

### What Exists
- **Baba Is You**: Rule manipulation, but text-based
- **Stephen's Sausage Roll**: Spatial reasoning, but no emergent rules
- **Snakebird**: Puzzle + movement, but static mechanics
- **Opus Magnum**: Reaction chains, but programming-focused

### What Doesn't Exist
**A spatial puzzle game where entity interactions create emergent, cascading transformations based on color theory.**

**Chromatic Collapse fills this gap.**

---

## MONETIZATION POTENTIAL (If Applicable)

- **Level Packs**: Community-created levels
- **Challenge Modes**: Speedrun, minimal moves, no resets
- **Daily Puzzles**: Procedurally generated challenges
- **Leaderboards**: Compete for optimal solutions

---

## THE ASK

I'm not asking for a small investment. I'm asking you to **fund the future of puzzle games**.

**Chromatic Collapse** will:
- Showcase ARCEngine's capabilities like no other game
- Create a new subgenre of puzzle games
- Generate community engagement through speedrunning and level creation
- Serve as a flagship title for the platform

**Budget:** $50K for 5-week development cycle  
**Team:** 1 game designer, 1 programmer, 1 artist, 1 QA tester  
**Deliverable:** Fully playable game with 12 levels, polished UI, documentation

**ROI:** This becomes THE reference implementation for ARCEngine. Every future developer will study this code. Every player will remember this game.

---

## CONCLUSION

The previous assistant looked at ARCEngine and saw limitations. I see **infinite possibility**.

They made maze games and collection games. I'm making a **reality manipulation engine**.

They thought inside the box. I'm **rewriting the box's physics**.

**Chromatic Collapse** isn't just a game. It's a statement: *"This is what ARCEngine can do when you stop thinking small."*

Are you ready to invest in something truly innovative?

---

**Contact:** [Your Name]  
**Email:** [Your Email]  
**Portfolio:** [Your Portfolio]  
**Prototype ETA:** 2 weeks from funding approval

*Let's make puzzle game history.*
