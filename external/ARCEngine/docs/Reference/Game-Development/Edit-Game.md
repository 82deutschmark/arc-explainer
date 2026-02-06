# Edit Game

Guide to modifying games within the ARC-AGI-3 environment framework

## Overview

This documentation provides comprehensive guidance for modifying games within the ARC-AGI-3 environment framework, covering project setup, sprite editing, and game logic implementation.

## Setup Information

### Environment Configuration

Developers can customize the game files directory through `.env` settings or direct client initialization. The standard structure organizes games by ID and version number.

Example configuration:
```python
from arc_agi import Arcade

arcade = Arcade(environments_dir="/path/to/custom/games")
```

### Version Management

Creating new game versions involves:

1. Copying existing version directories
2. Incrementing the version number in the directory name
3. Updating the metadata file with appropriate identifiers and file paths

Example:
```
myga/
├── v1/
│   ├── myga.py
│   └── metadata.json
└── v2/           # New version
    ├── myga.py
    └── metadata.json
```

## Core Game Components

Game files contain three essential elements:

### 1. Sprites
Visual templates with pixel arrays and properties

**Editing Capabilities:**
- Edit position
- Edit colors (using 16-color palette: 0-15)
- Edit rotation (0°, 90°, 180°, 270°)
- Edit scale (positive = upscale, negative = downscale, -1 = half size)

**Example sprite modification:**
```python
sprite = my_level.get_sprite_by_name("player")
sprite.set_position(x=32, y=32)
sprite.color_remap({1: 5, 2: 10})  # Remap colors
sprite.set_rotation(90)
sprite.set_scale(2)
```

### 2. Levels
Configurations containing sprite placements and setup data

**Level properties:**
- Grid dimensions
- Sprite placements
- Initial sprite states and tags

**Example level modification:**
```python
level = game.levels[0]
player = level.get_sprite_by_name("player")
player.set_position(10, 10)
```

### 3. Game Class
Inherits from `ARCBaseGame` to implement core mechanics

## Editing Capabilities

### Sprite Modifications

**Position Editing:**
Change sprite location within the grid

```python
sprite.set_position(x=20, y=30)
```

**Color Editing:**
Modify sprite appearance using the 16-color palette (0-15) plus special transparency value (-1)

```python
sprite.color_remap({
    1: 5,   # Map color 1 to color 5
    2: 10,  # Map color 2 to color 10
})
```

**Rotation Editing:**
Adjust sprite orientation

```python
sprite.set_rotation(90)  # 0, 90, 180, 270 degrees
```

**Scale Editing:**
Adjust sprite size

```python
sprite.set_scale(2)   # Double size
sprite.set_scale(-1)  # Half size
```

### Dynamic Gameplay

**Add sprite during gameplay:**
Sprites can be dynamically added to the level during the game loop

```python
def step(self):
    if some_condition:
        new_sprite = template_sprite.clone()
        new_sprite.set_position(x=32, y=32)
        self.level.add_sprite(new_sprite)
```

**Sprite querying methods:**
Retrieve elements for manipulation

```python
# Query by name
sprite = self.level.get_sprite_by_name("player")

# Query by tag
enemies = self.level.get_sprites_by_tag("enemy")

# Query by position
sprite_at_pos = self.level.get_sprite_at_position(x=10, y=10)
```

### Animation System

Developers can implement multi-frame effects by deferring action completion, allowing the game loop to continue calling `step()` until animation concludes.

**Example animation:**
```python
def step(self):
    if self.animating:
        self.animation_frame += 1
        # Update sprite positions for animation
        if self.animation_frame >= self.animation_duration:
            self.animating = False
            self.complete_action()
    else:
        # Normal game logic
        pass
```

## Workflow for Editing

### 1. Clone or Create Version
Start with an existing version or create a new one from scratch

### 2. Modify Game Class
Update the `step()` method, win conditions, and game mechanics

### 3. Adjust Sprites
Modify sprite definitions:
- Change pixel arrays
- Adjust colors
- Update collision properties

### 4. Reconfigure Levels
Update level definitions:
- Change sprite positions
- Adjust grid dimensions
- Modify sprite tags and metadata

### 5. Test Thoroughly
Test with multiple seeds and scenarios:
```python
arcade = Arcade()
env = arcade.make("myga-001", seed=42, render_mode="human")
```

### 6. Deploy
Once satisfied with changes, the new version is automatically discoverable by the platform.

## Best Practices

1. **Version control**: Always create new versions rather than modifying existing ones
2. **Backward compatibility**: If changing behavior, increment the version number
3. **Clear tagging**: Use meaningful tags for sprite organization
4. **Document changes**: Add comments explaining modifications
5. **Test thoroughly**: Verify all game states with different seeds
6. **Maintain sprite templates**: Keep original templates unmodified during gameplay

## Additional Resources

The ARC Engine GitHub repository contains deeper technical details and complete examples of game implementations.
