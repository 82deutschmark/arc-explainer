# Worm Arena Layout Redesign Plan
**Date**: 2025-12-09
**Goal**: Minimize controls, maximize reasoning logs and game space. Clean minimalist aesthetic (parent SnakeBench) + earthy farm colors
**Status**: Planning Phase

---

## Design Direction: Minimalist + Farm Aesthetic

### Aesthetic Vision
**Clean, spacious, professional interface inspired by SnakeBench parent**, with:
- **Reasoning logs as heroes** (large, prominent, monospace, left & right)
- **Game board as center focus** (large ASCII grid, clearly visible)
- **Minimal controls** (hidden by default or collapsed; only "Run Match" + playback when viewing)
- **Earthy farm palette** (warm browns, greens, creams—not SnakeBench blue/greens)
- **Monospace fonts** for reasoning/code; clean sans-serif headers
- **Spacious whitespace** (not cramped like current)

### Layout Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Header: "🌱 Worm Arena"  [Minimal Nav]                     │
├─────────────────────────────────────────────────────────────┤
│  Matchup Title: "Model A vs Model B"                        │
├──────────────────┬──────────────────┬──────────────────────┤
│  Reasoning Log   │   Game Board     │  Reasoning Log       │
│  (Model A)       │   (ASCII Grid)   │  (Model B)           │
│                  │                  │                      │
│  (scrollable)    │   (large)        │  (scrollable)        │
│                  │                  │                      │
├──────────────────┴──────────────────┴──────────────────────┤
│  Metadata: Round X / Y, Scores, Timestamps                 │
├──────────────────────────────────────────────────────────────┤
│  Playback Controls: [◀◀] [◀] [▶] [▶▶] [Play/Pause] Round X  │
├──────────────────────────────────────────────────────────────┤
│  [Minimal] Game Selection / Match Setup (collapsible?)      │
└──────────────────────────────────────────────────────────────┘
```

---

## Color Palette (Earthy Farm Minimalist)

### Primary Colors
- **Page Background**: `#f5f1e8` (cream/sand, warm off-white)
- **Card/Panel Background**: `#faf5f0` (very light cream)
- **Text Primary**: `#3d2817` (dark earthy brown)
- **Text Secondary**: `#7a6b5f` (warm gray-brown)
- **Divider/Border**: `#d4b5a0` (warm tan)

### Game Board & Reasoning Areas
- **Soil Background** (game board): `#6b5344` (dark rich soil)
- **Text in Soil** (ASCII): `#d4a574` (tan/sand, like visible particles)
- **Reasoning Panel Bg**: `#faf5f0` (light cream)
- **Reasoning Text**: `#2d2416` (near-black brown, monospace)
- **Reasoning Accent**: `#6b9e3f` (earthy green for highlights/keywords)

### Player Distinction Colors
- **Player A (Worm 1)**: `#d84949` (warm red/rust)
- **Player B (Worm 2)**: `#e8a11a` (golden orange/amber)
- **Accent/Active**: `#6b9e3f` (earthy green)

---

## Typography

### Fonts
- **Headers/Titles/Body**: Fun cartoon sans-serif
  - **PRIMARY**: **Fredoka** (playful, rounded, friendly—perfect for farm vibe)
  - **ALTERNATIVE**: **Nunito** (warm, organic, soft)
  - **FALLBACK**: **Comic Sans** (only if no custom fonts load; charming but use sparingly)
  - Use Fredoka/Nunito for ALL text: headers, labels, buttons, everything
  - Load from Google Fonts
- **Reasoning Logs**: **Monospace** for code/thoughts, BUT **LARGE and BOLD**
  - Use: `font-family: 'Monaco', 'Menlo', monospace` or system monospace
  - Apply `font-weight: 600` or `700` (bold)
  - Size: **18-20px** (NOT 13-14px—make it PROMINENT)
- **Body/Meta**: Same Fredoka, readable

### Text Sizing
```
Page Title:           32px, bold, Fredoka
Matchup Subtitle:     20px, regular, Fredoka (e.g., "Claude Opus vs Gemini")
Section Headers:      16px, semibold, Fredoka (e.g., "Round 45 / 50")
Body/Controls:        14px, regular, Fredoka
Reasoning Logs:       18-20px, BOLD, monospace (large, prominent, easy to read)
```

---

## Layout Details

### 1. Header (Minimal)
```
🌱 Worm Arena                          [Live Games] [Leaderboards]
```
- **Logo/Title**: Large, friendly, with worm emoji or simple icon
- **Nav**: Link to live games, leaderboards (optional)
- **Background**: Cream/off-white, no decoration needed

### 2. Matchup Title
```
Anthropic: Claude Opus 4.5 vs Google: Gemini 3 Pro
Match run on November 29, 2025 at 10:16:36 PM
```
- Centered, clean, professional
- Show timestamp + basic metadata

### 3. Three-Column Layout (THE HERO SECTION)

#### LEFT COLUMN: Reasoning Log (Model A)
- **Header**: Model A name (with color accent, e.g., red/rust)
- **Content**: Full LLM reasoning text from `frames[index].moves[snake_id].rationale`
  - This is the complete reasoning/thoughts the model output for this round's decision
  - Extracted directly from the replay JSON
- **Scrollable**: `max-h-[600px]` or similar, overflow auto
- **Background**: Light cream with thin brown border
- **Font**: `18-20px, BOLD, monospace` (large, easy to read, prominent)
- **Text color**: Warm dark brown (`#2d2416`)
- **Line-height**: `leading-relaxed` (1.6) for breathing room

#### CENTER COLUMN: Game Board
- **Header**: None (just the board)
- **Content**: Large ASCII grid (game state)
- **Background**: Dark soil brown (`#6b5344`) with subtle texture
- **Border**: Thick wooden-brown border (`8-12px rounded`)
- **Text**: Tan/sand color (`#d4a574`)
- **Size**: Should be large—at least `400px` wide/tall, grow with screen
- **Optional decoration**: Subtle grass tufts at top (CSS pseudo-elements)

#### RIGHT COLUMN: Reasoning Log (Model B)
- **Header**: Model B name (with color accent, e.g., orange/amber)
- **Content**: Full LLM reasoning text from `frames[index].moves[snake_id].rationale`
  - Same structure as LEFT, second player's reasoning
- **Scrollable**: `max-h-[600px]` or similar, overflow auto
- **Font**: `18-20px, BOLD, monospace` (same as LEFT)
- **Same styling as LEFT**

### 4. Metadata Row (Below Columns)
```
Scores: Claude 45 | Gemini 23
Round: 45 / 50 | Apples: 2 | Board: 10x10
```
- Clean, minimal text
- Show current scores, round, board stats

### 5. Playback Controls (Below Metadata)
```
[◀◀] [◀] [▶] [▶▶] [■ Play] Round 45
```
- Centered, minimal buttons
- Only: previous round, next round, play/pause, round indicator
- NO form controls here; separate below

### 6. Game Selection & Setup (Collapsible / Minimal)
**Option A: Collapse by default**
- Small button: "+ New Match" or "▼ Setup Match"
- When expanded: Shows minimal form (Model A, Model B, Board size, Run button)
- When collapsed: Hidden, clean page

**Option B: Minimal inline**
- Show recent games as small list/tabs above main content
- Quick "Run new match" button in header

**Recommendation**: **Option A** - keeps focus on game/reasoning, setup is secondary

---

## Spacing & Visual Hierarchy

| Element | Sizing | Notes |
|---------|--------|-------|
| Page padding | `p-8` (32px) | Generous margins |
| Column gap | `gap-6` (24px) | Breathing room between reasoning/board |
| Section gap | `gap-4` (16px) | Space between sections |
| Reasoning panel padding | `p-4` (16px) | Internal padding |
| Monospace line-height | `leading-relaxed` or `1.6` | Better readability for code |
| Game board min size | `400px` or 50% viewport | Large, prominent |

---

## Component Changes

### 1. Config Panel → Collapsed Toggle
- **Current**: Large form taking up space
- **Change**:
  - Hide by default in a collapsible "Setup" section
  - Show only: Model A selector, Model B selector, "Run Match" button
  - Board size/rounds/apples: Hidden, use defaults or advanced toggle
  - BYO API key: Hidden, advanced option

### 2. Replay Viewer → Three-Column Hero
- **Left**: Reasoning log (scrollable monospace, large)
- **Center**: Game board (large ASCII, prominent)
- **Right**: Reasoning log (scrollable monospace, large)
- **Below**: Metadata + controls

### 3. Recent Games → Minimal Selection
- **Current**: Large table below main content
- **Change**:
  - Move to header tabs OR small dropdown selector
  - Show currently selected game in matchup title
  - Click to switch games (no large list visible by default)

### 4. Summaries → Optional Footer or Sidebar
- **Option A**: Remove from main page (move to separate "Stats" page)
- **Option B**: Show as small widget in footer
- **Recommendation**: Remove from Worm Arena page, focus on game/reasoning

---

## Implementation Phases

### Phase 1: Layout Restructure (Critical)
- [ ] Create three-column layout (reasoning left, board center, reasoning right)
- [ ] Move game board to center, make it large
- [ ] Hide config panel by default (collapsible toggle)
- [ ] Increase monospace text size (13-14px instead of 11px)
- [ ] Update spacing: `gap-6`, `p-8` throughout

### Phase 2: Styling & Colors (Critical)
- [ ] Apply earthy color palette (cream bg, brown text, soil board)
- [ ] Add wooden border to game board
- [ ] Update reasoning panels to light cream background
- [ ] Apply warm brown shadows instead of gray
- [ ] Update button colors to warm tones

### Phase 3: Typography (Critical)
- [ ] Add Fredoka font for headers (or keep system sans-serif if simpler)
- [ ] Increase header sizes (28px title, 18px subtitle)
- [ ] Ensure monospace reasoning is 13-14px (readable)
- [ ] Update all tiny text (11px, 10px) to 13-14px minimum

### Phase 4: Visual Polish (Nice-to-Have)
- [ ] Add subtle grass tufts at top of game board (CSS pseudo-elements)
- [ ] Add subtle soil texture overlay to board background
- [ ] Add worm emoji indicators next to reasoning headers
- [ ] Smooth transitions for collapsed/expanded config

### Phase 5: Game Selection UX (Nice-to-Have)
- [ ] Move recent games to header tabs or dropdown
- [ ] Quick "New Match" button in header or as sticky bar

---

## Files to Modify

1. **[client/src/pages/SnakeArena.tsx](client/src/pages/SnakeArena.tsx)**
   - Restructure layout: three-column with reasoning left/right, game center
   - Make game board large and prominent
   - Collapse config panel by default
   - Increase all text sizes (especially monospace reasoning)
   - Update color classes to earthy palette

2. **[client/src/globals.css](client/src/globals.css)** (optional)
   - Add custom color variables for earthy palette
   - Define monospace font stack with better defaults
   - Add subtle soil texture or background pattern

---

## Success Criteria

✓ **Reasoning logs dominate** - Large, readable monospace, left and right columns
✓ **Game board prominent** - Large ASCII grid in center, clearly visible
✓ **Controls minimal** - Config hidden by default, only playback visible when viewing
✓ **Earthy aesthetic** - Warm browns, greens, creams; farm-like but professional
✓ **Typography hierarchy** - Headers 18-28px, body 13px, monospace 13-14px (not tiny)
✓ **Spacing generous** - No cramped feeling; clean, spacious layout
✓ **Quick game selection** - Easy to switch between recent games
✓ **Parent-inspired** - Follows minimalist SnakeBench layout philosophy

---

## Visual Inspiration Summary

**From SnakeBench Parent:**
- Three-column layout with reasoning on sides, game in center
- Large, prominent game board
- Minimal controls below board
- Clean, spacious, professional

**Farm Theme Overlay:**
- Earthy color palette (browns, greens, creams)
- Monospace with warm, readable tones
- Subtle worm/farm details (optional emoji, grass tufts)
- Wooden-framed game board (looks like dirt window)

---

**Next Step**: Await approval on this minimalist + farm aesthetic plan, then implement.
