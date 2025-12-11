Claude’s Plan
Worm Arena UI Redesign Plan
Author: Claude Code (Haiku 4.5) Date: 2025-12-10 Purpose: Redesign WormArena.tsx to match SnakeBench's clean, efficient layout with proper information hierarchy and zero duplication
Executive Summary
The current Worm Arena UI suffers from severe layout inefficiency:
50% screen waste: Lines 153-178 create a giant horizontal section that duplicates reasoning displays
Control duplication: WormArenaControls embeds reasoning boxes that are redundant with the main 3-column reasoning panels
Poor hierarchy: Playback controls buried inside a massive container instead of compact bar
Missing navigation: No header links to leaderboard/top matches like SnakeBench has
Target: Match SnakeBench's layout exactly - clean header with nav, compact controls bar, 3-column reasoning/board layout, minimal vertical space waste.
Current Architecture Problems
Problem 1: Giant Middle Section (Lines 153-178)
// WormArena.tsx lines 153-178
<div className="mb-6">
  <div className="flex items-center gap-4 mb-4">
    <h2>🐛 Replay Controls · {matchupLabel}</h2>
    <div className="flex-1">  {/* ← EXPANDS TO FILL WIDTH */}
      <WormArenaControls       {/* ← CONTAINS DUPLICATE REASONING */}
        currentThought={playerAReasoning}
        upcomingThought={playerBReasoning}
        // ... controls ...
      />
    </div>
  </div>
</div>
Impact:
Takes 50%+ of viewport before main content
WormArenaControls contains TWO reasoning boxes (current/upcoming) in md:grid-cols-2 layout
These reasoning boxes duplicate what's shown in the 3-column grid below
Problem 2: Reasoning Duplication
Location A - WormArenaControls.tsx lines 67-84:
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div><h4>Current move</h4>{currentThought}</div>
  <div><h4>Upcoming move</h4>{upcomingThought}</div>
</div>
Location B - WormArena.tsx lines 213-220 & 229-236:
<WormArenaReasoning playerName={playerAName} reasoning={playerAReasoning} />
<WormArenaGameBoard />
<WormArenaReasoning playerName={playerBName} reasoning={playerBReasoning} />
Result: Users see the SAME reasoning text TWICE on screen.
Problem 3: Control Placement
Playback buttons (First/Prev/Play/Next/Last) are inside WormArenaControls
But WormArenaControls is buried inside a flex container
Should be in a compact horizontal bar like SnakeBench's bottom controls
Problem 4: Missing Navigation
No links to Leaderboard, Top Matches, etc. in header
SnakeBench has "Live Games", "Top Match", "About" tabs
Target Layout (SnakeBench Reference)
┌─────────────────────────────────────────────────────┐
│ 🐛 SnakeBench    [Live Games] [Top Match] [About]   │ ← Compact header with nav
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ OpenAI: GPT-5 Image vs xAI: Grok Code Fast 1        │ ← Match title
│ Match run on November 22, 2025 at 04:20:55 PM       │
└─────────────────────────────────────────────────────┘

┌───────────┬─────────────────┬───────────┐
│ OpenAI:   │                 │ xAI:      │
│ GPT-5     │   GAME BOARD    │ Grok Fast │
│           │                 │           │
│ Strategy: │                 │ Strategy: │
│ "Keep     │                 │ "Okay, I  │
│ sweeping  │                 │ need to   │
│ right..." │                 │ carefully │
│           │                 │ consider" │
│           │                 │           │
│ 🍎🍎🍎🍎🍎🍎🍎 │                 │ 🍎🍎🍎🍎🍎   │ ← Scores
└───────────┴─────────────────┴───────────┘

┌─────────────────────────────────────────────────────┐
│ [<<] [<] [⏸] [>] [>>]  Round 23 / 91                │ ← Compact controls bar
│ Thoughts show: [Current move ▼] [Upcoming move]     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Match ID: 835a096a-4da3-4d85-b857-26733da891f5 [📋] │
└─────────────────────────────────────────────────────┘
Key differences from current Worm Arena:
No giant middle section - controls are compact bar
Reasoning panels are the ONLY place reasoning is shown (not duplicated)
Header has navigation links
Match info is prominent but compact
Everything fits on one screen without massive vertical scroll
Implementation Plan
Phase 1: Header & Navigation
Goal: Add navigation links to WormArenaHeader Files to modify:
client/src/components/WormArenaHeader.tsx
Changes:
Add new prop: links?: Array<{ label: string; href: string; active?: boolean }>
Render links in header after title/emoji section
Style links to match SnakeBench aesthetic (subtle hover, active indicator)
Example:
<div className="flex items-center gap-6">
  <h1>🐛 Worm Arena 🐛</h1>
  <nav className="flex gap-4">
    {links?.map(link => (
      <Link
        href={link.href}
        className={cn(
          "text-sm font-medium transition-colors hover:text-primary",
          link.active && "text-primary border-b-2 border-primary"
        )}
      >
        {link.label}
      </Link>
    ))}
  </nav>
</div>
WormArena.tsx updates:
<WormArenaHeader
  totalGames={totalGames}
  links={[
    { label: 'Live Games', href: '/worm-arena/live', active: false },
    { label: 'Top Match', href: '/worm-arena', active: true },
    { label: 'Leaderboard', href: '/leaderboard' },
  ]}
/>
Phase 2: Remove Giant Middle Section
Goal: Delete lines 153-178 entirely, extract controls into compact bar Files to modify:
client/src/pages/WormArena.tsx
Changes: DELETE these lines (153-178):
<div className="mb-6">
  <div className="flex items-center gap-4 mb-4">
    <h2 className="text-2xl font-bold flex items-center gap-2">
      <span>🐛</span>
      <span>Replay Controls</span>
      <span className="text-xl text-muted-foreground">· {matchupLabel}</span>
    </h2>
    <div className="flex-1">
      <WormArenaControls
        // ... all props
      />
    </div>
  </div>
</div>
Reasoning: This entire section is redundant and wastes screen space.
Phase 3: Create Compact Controls Bar Component
Goal: New component for playback controls ONLY (no reasoning) Files to create:
client/src/components/WormArenaControlBar.tsx
Component structure:
/**
 * Author: Claude Code (Haiku 4.5)
 * Date: 2025-12-10
 * PURPOSE: Compact horizontal bar for playback controls and round info
 * SRP/DRY check: Pass - Single responsibility (playback only, no reasoning)
 */

interface WormArenaControlBarProps {
  // Playback controls
  onFirst: () => void;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onLast: () => void;
  isPlaying: boolean;

  // Status
  currentRound: number;
  totalRounds: number;

  // Thought toggle
  showNextMove: boolean;
  onToggleThought: (show: boolean) => void;
}

export function WormArenaControlBar({ ... }: WormArenaControlBarProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 border rounded-lg bg-card">
      {/* Left: Playback buttons */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onFirst}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button size="sm" onClick={onPlayPause}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="sm" variant="outline" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={onLast}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Center: Round indicator */}
      <div className="text-sm font-medium">
        Round {currentRound} / {totalRounds}
      </div>

      {/* Right: Thought toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Thoughts show:</span>
        <div className="flex rounded-md border">
          <Button
            size="sm"
            variant={!showNextMove ? "default" : "ghost"}
            onClick={() => onToggleThought(false)}
          >
            Current move
          </Button>
          <Button
            size="sm"
            variant={showNextMove ? "default" : "ghost"}
            onClick={() => onToggleThought(true)}
          >
            Upcoming move
          </Button>
        </div>
      </div>
    </div>
  );
}
Key principles:
NO reasoning display (that belongs in WormArenaReasoning)
Compact horizontal layout
All controls in one row
Clear visual hierarchy
Phase 4: Update WormArena.tsx Layout
Goal: Reorganize page to match SnakeBench structure Files to modify:
client/src/pages/WormArena.tsx
New layout structure:
return (
  <div className="min-h-screen" style={{ backgroundColor: '#f5e6d3' }}>
    {/* SECTION 1: Header with navigation */}
    <WormArenaHeader
      totalGames={totalGames}
      links={[
        { label: 'Live Games', href: '/worm-arena/live' },
        { label: 'Replay', href: '/worm-arena', active: true },
        { label: 'Leaderboard', href: '/leaderboard' },
      ]}
    />

    <div className="max-w-7xl mx-auto px-8 py-8">
      {/* Loading/error states */}
      {isLoadingGame && <LoadingSpinner />}
      {gameError && <ErrorAlert />}
      {!frames?.length && <EmptyState />}

      {frames && (
        <>
          {/* SECTION 2: Match title & timestamp (compact) */}
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold mb-2">{matchupLabel}</h2>
            <p className="text-sm text-muted-foreground">
              Match run on {formatDate(gameData.game.started_at)}
            </p>
          </div>

          {/* SECTION 3: Three-column layout (MAIN CONTENT) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Left: Player A reasoning */}
            <WormArenaReasoning
              playerName={playerAName}
              reasoning={playerAReasoning}
              color="red"
              score={finalScores[0] || 0}
            />

            {/* Center: Game board */}
            <WormArenaGameBoard
              width={boardWidth}
              height={boardHeight}
              state={currentFrame.state}
              highlightCells={highlightedCells}
            />

            {/* Right: Player B reasoning */}
            <WormArenaReasoning
              playerName={playerBName}
              reasoning={playerBReasoning}
              color="gold"
              score={finalScores[1] || 0}
            />
          </div>

          {/* SECTION 4: Compact control bar */}
          <WormArenaControlBar
            onFirst={handleFirstFrame}
            onPrev={handlePrevFrame}
            onPlayPause={handlePlayPause}
            onNext={handleNextFrame}
            onLast={handleLastFrame}
            isPlaying={isPlaying}
            currentRound={frameIndex + 1}
            totalRounds={frames.length}
            showNextMove={showNextMove}
            onToggleThought={setShowNextMove}
          />

          {/* SECTION 5: Match metadata (compact) */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <div className="flex justify-center gap-6 flex-wrap">
              <span><strong>Board:</strong> {boardWidth}x{boardHeight}</span>
              <span><strong>Max Rounds:</strong> {maxRounds}</span>
            </div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span>Match ID: {selectedGameId}</span>
              <Button size="sm" variant="ghost" onClick={copyMatchId}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* SECTION 6: Game selector (collapsible, at bottom) */}
          <Accordion type="single" collapsible className="mt-8">
            <AccordionItem value="games">
              <AccordionTrigger>Browse Recent Games</AccordionTrigger>
              <AccordionContent>
                <WormArenaRecentGames
                  games={games}
                  selectedGameId={selectedGameId}
                  onSelectGame={handleGameSelection}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
    </div>
  </div>
);
Key changes:
❌ REMOVE giant middle section (lines 153-178)
✅ ADD match title/timestamp before 3-column grid
✅ ADD WormArenaControlBar AFTER 3-column grid (not embedded in middle)
✅ KEEP 3-column reasoning/board layout (it works!)
✅ MOVE match metadata below controls (compact)
✅ KEEP game selector at bottom (collapsible)
Phase 5: Clean Up WormArenaControls
Goal: Decide whether to deprecate or simplify WormArenaControls Option A: Deprecate entirely (recommended)
Delete client/src/components/WormArenaControls.tsx
All functionality moved to WormArenaControlBar
Option B: Simplify for reuse
Remove reasoning boxes (lines 67-84)
Keep only playback buttons
Use in both replay and live pages
Recommendation: Option A - create clean WormArenaControlBar, deprecate old component.
Phase 6: Update WormArenaReasoning Component
Goal: Ensure reasoning panel shows scores like SnakeBench Files to modify:
client/src/components/WormArenaReasoning.tsx
Changes:
Add score prop
Display score with emoji apples at bottom of panel (like SnakeBench)
interface WormArenaReasoningProps {
  playerName: string;
  reasoning: string;
  color: 'red' | 'gold';
  score: number;  // ← NEW
}

export function WormArenaReasoning({ playerName, reasoning, color, score }: WormArenaReasoningProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn("text-center", color === 'red' ? 'text-red-600' : 'text-yellow-600')}>
          {playerName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Strategy text */}
        <div className="text-sm">
          <strong>Strategy:</strong>
          <p className="mt-2 whitespace-pre-wrap">{reasoning}</p>
        </div>

        {/* Score display */}
        <div className="mt-4 pt-4 border-t flex items-center justify-center gap-1">
          {Array.from({ length: score }).map((_, i) => (
            <span key={i}>🍎</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
Phase 7: Typography & Styling Improvements
Goal: Larger, bolder text matching SnakeBench aesthetic Files to modify:
client/src/pages/WormArena.tsx
client/src/components/WormArenaHeader.tsx
client/src/components/WormArenaReasoning.tsx
client/src/components/WormArenaControlBar.tsx
Typography changes:
// Match title (currently text-2xl, make it text-3xl font-bold)
<h2 className="text-3xl font-bold mb-2">{matchupLabel}</h2>

// Player names in reasoning panels (currently default, make them text-lg font-bold)
<CardTitle className="text-lg font-bold">{playerName}</CardTitle>

// Strategy text (currently text-sm, make it text-base)
<div className="text-base">
  <strong>Strategy:</strong>
  <p className="mt-2 whitespace-pre-wrap font-medium">{reasoning}</p>
</div>

// Control bar text (currently default, make it font-semibold)
<div className="text-base font-semibold">
  Round {currentRound} / {totalRounds}
</div>

// Header links (add font-semibold)
<Link className="text-base font-semibold">{link.label}</Link>
Font weight progression:
Headings: font-bold (700)
Subheadings: font-semibold (600)
Body text: font-medium (500)
Secondary text: font-normal (400)
File Change Summary
Files to Create
client/src/components/WormArenaControlBar.tsx - New compact controls bar
Files to Modify
client/src/pages/WormArena.tsx - Main layout restructure
client/src/components/WormArenaHeader.tsx - Add navigation links
client/src/components/WormArenaReasoning.tsx - Add score display, improve typography
Files to Deprecate (Optional)
client/src/components/WormArenaControls.tsx - Replaced by WormArenaControlBar
Before & After Comparison
Before (Current Issues)
❌ Giant middle section wastes 50% of screen
❌ Duplicate reasoning displays (2 locations)
❌ Controls buried in flex container
❌ No header navigation
❌ Poor typography (too small, not bold enough)
❌ Unclear information hierarchy
After (Target State)
✅ Compact layout, all content visible in one screen
✅ Single reasoning display per player (3-column grid)
✅ Compact horizontal control bar (below grid)
✅ Header with navigation links (Leaderboard, Top Match)
✅ Bold, readable typography (text-3xl headings, text-base body)
✅ Clear hierarchy: Title → Grid → Controls → Metadata
Testing Checklist
After implementation:
 Header shows navigation links (Live, Replay, Leaderboard)
 No giant middle section exists
 Reasoning appears ONLY in 3-column grid (not duplicated)
 Control bar is compact horizontal bar below grid
 Typography is bold and readable (matches SnakeBench)
 Playback controls work (First/Prev/Play/Next/Last)
 Thought toggle works (Current Move ↔ Upcoming Move)
 Score displays with emoji apples in reasoning panels
 Match ID is copyable
 Game selector is collapsible at bottom
 Responsive on mobile (grid becomes vertical stack)
Rollout Strategy
Phase 1-3: Create new components, don't break existing (additive changes)
Phase 4: Swap layout (breaking change, test thoroughly)
Phase 5-7: Polish and refinement
Optional: Keep old WormArenaControls for WormArenaLive.tsx until that page is also updated
Notes
This redesign focuses ONLY on the replay page (WormArena.tsx)
WormArenaLive.tsx may need similar updates in future
All data is already available (reasoning, scores, board state)
No backend/API changes required
Maintains farm aesthetic (brown colors, worm emojis)
Uses existing shadcn/ui components (Card, Button, Accordion)
Estimated complexity: Medium (mostly layout restructuring, minimal logic changes) Risk level: Low (all data already flows correctly, just changing presentation)