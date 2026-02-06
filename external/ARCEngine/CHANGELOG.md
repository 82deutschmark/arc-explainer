# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **games/official/** - Official ARC-AGI-3 preview games downloaded via `arc-agi` API
  - `ls20.py` - Shape-matching navigation puzzle (7 levels, 4 actions)
  - `ft09.py` - Color-cycling constraint satisfaction (6 levels, 6 actions)
  - `vc33.py` - Rail-switching train routing (7 levels, click-only)
  - All MIT licensed by ARC Prize Foundation
  - **Author**: ARC Prize Foundation (downloaded by Claude Sonnet 4)

- **docs/OFFICIAL_PREVIEW_GAMES.md** - Deep analysis of official preview game mechanics
  - Detailed breakdown of ls20 shape/color/rotation matching
  - ft09 constraint satisfaction logic explained
  - vc33 rail switching and animation system
  - Code patterns and obfuscation notes
  - Instructions for cloning and modification
  - **Author**: Claude Sonnet 4

- **examples/inspect_preview_games.py** - Utility to download and inspect official games via API
  - **Author**: Claude Sonnet 4

- **ARC3_OFFICIAL_EXAMPLES.md** - Comprehensive documentation of official ARC-AGI-3 example games from https://docs.arcprize.org/
  - Official preview games reference (ls20, ft09, vc33)
  - Complete ab12 click-to-remove example with full source code
  - Editing existing games guide
  - Sprite techniques (modification, inline edits, dynamic add/remove)
  - Animation pattern for multi-frame effects
  - Directory structure reference for both official and local formats
  - Color palette reference
  - **Author**: Claude Sonnet 4

- **examples/ab12_template.py** - Clonable game template based on official ARC Prize Foundation example
  - Procedural sprite generation with seeding
  - ACTION6 (click) handling with coordinate conversion
  - Level progression with varying grid sizes
  - Local testing harness included
  - **Author**: Claude Sonnet 4
