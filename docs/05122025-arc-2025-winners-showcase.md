# 2025 ARC-AGI Competition Winners Showcase

## Objective
Repurpose the HumanTradingCards.tsx page to prominently showcase the 2025 ARC-AGI competition winners (announced December 5th, 2025) with a fresh, celebratory design while maintaining existing trading card sections below.

## Files to Modify
- `client/src/pages/HumanTradingCards.tsx` - Replace "2025 Leaderboard" section with winners podium showcase
- `client/src/utils/humanCardHelpers.ts` - Add 2025 winner color schemes and visual hierarchy helpers
- `shared/types/contributor.ts` - Already supports required fields (rank, category, yearStart)

## Files to Create
- `client/src/components/human/WinnersPodiumCard.tsx` - Hero card component for podium display (1st, 2nd, 3rd)
- `client/src/components/human/WinnersSection.tsx` - Section wrapper with title and layout logic

## Implementation Tasks

### Phase 1: Create Winners Components

1. Create `client/src/components/human/WinnersSection.tsx`
   - Import Card, Badge, Avatar from shadcn/ui
   - Accept props: `winners: ArcContributor[]`, `year: number`
   - Implement section header with Trophy icon and "2025 ARC Prize Winners" title
   - Use gradient background blur effect (similar to founders section)
   - Sort winners by rank (1, 2, 3, then rest)
   - Render WinnersPodiumCard for top 3, HumanTradingCard for others in grid

2. Create `client/src/components/human/WinnersPodiumCard.tsx`
   - Import Card, CardHeader, CardContent, CardTitle, Badge, Avatar, Dialog from shadcn/ui
   - Accept prop: `winner: ArcContributor`
   - Implement podium-style visual hierarchy:
     - Rank 1: Larger size (col-span-2), gold border, animated glow
     - Rank 2: Silver border, slightly elevated
     - Rank 3: Bronze border
   - Display winner avatar (imageUrl or GIF fallback)
   - Show rank badge with medal emoji (🥇 🥈 🥉)
   - Display achievement, score, and team name
   - Include social links row
   - Add "View Profile" button triggering Dialog with HumanTradingCard

3. Update `client/src/utils/humanCardHelpers.ts`
   - Add `getWinnerColors()` function returning rank-specific gradients:
     - Rank 1: Gold (#FFD700) gradient with amber accents
     - Rank 2: Silver (#C0C0C0) gradient with slate accents
     - Rank 3: Bronze (#CD7F32) gradient with orange accents
   - Add `getWinnerBadgeVariant()` mapping rank to shadcn badge variants
   - Add `formatPrizeAmount()` helper if prize data exists in score field

### Phase 2: Update Main Page Layout

4. Modify `client/src/pages/HumanTradingCards.tsx` lines 25-58
   - Rename `leaderboard2025` to `winners2025` in useMemo categorization
   - Filter for `yearStart === 2025 && category === 'competition_winner'`
   - Keep rank sorting (already exists)
   - Remove old 2025 Leaderboard section (lines 161-176)

5. Replace 2025 Leaderboard section (lines 161-176) with WinnersSection
   - Import WinnersSection component
   - Render `<WinnersSection winners={winners2025} year={2025} />`
   - Position immediately after founders section (line 159)

6. Update page header (lines 77-87)
   - Change subtitle to mention "2025 ARC Prize Winners & Hall of Fame"
   - Keep existing Users icon and "ARC Hall of Fame" title

### Phase 3: Visual Enhancements

7. Add celebratory styling to WinnersPodiumCard
   - Implement hover animations (scale, glow pulse)
   - Add confetti-style gradient backdrop for rank 1
   - Use shadcn/ui Avatar component with fallback initials
   - Apply border-4 for rank 1, border-2 for others
   - Add subtle box-shadow elevation

8. Implement responsive layout in WinnersSection
   - Desktop (lg+): Podium layout with 1st place center-top, 2nd/3rd flanking
   - Tablet (md): 3-column grid for top 3
   - Mobile (sm): Vertical stack with rank 1 emphasized

9. Add accessibility features
   - ARIA labels for rank badges and winner cards
   - Keyboard navigation for Dialog triggers
   - Alt text for all avatars
   - Focus indicators on interactive elements

### Phase 4: Data Integration

10. Verify database has 2025 winners data
    - Check `arc_contributors` table for entries with yearStart=2025, category='competition_winner'
    - Ensure ranks 1, 2, 3 exist with complete data (achievement, score, imageUrl, links)
    - Verify team names and affiliations are populated

11. Test API endpoint filtering
    - Confirm `useArcContributors()` correctly filters 2025 winners
    - Validate rank sorting in response
    - Check image URLs load correctly

### Phase 5: Polish & Testing

12. Add loading states
    - Skeleton loaders for WinnersPodiumCard components
    - Shimmer effect during data fetch
    - Use shadcn/ui Skeleton component

13. Handle edge cases
    - No winners data: Show placeholder with "Winners TBA"
    - Missing images: Fallback to GIF generator
    - Incomplete data: Graceful degradation with default values

14. Ensure SRP/DRY compliance
    - WinnersSection: Single responsibility for winners layout
    - WinnersPodiumCard: Single responsibility for podium display
    - Reuse existing HumanTradingCard for full profile modal
    - Reuse humanCardHelpers for color/formatting utilities
    - Reuse shadcn/ui components throughout

## Integration Points

### With Existing Components
- `HumanTradingCard` - Reused in Dialog for full winner profiles
- `useArcContributors` hook - Fetches all contributor data including winners
- `humanCardHelpers.ts` - Extended with winner-specific color schemes
- shadcn/ui components - Card, Badge, Avatar, Dialog, Skeleton

### With Database
- `arc_contributors` table - Source of truth for winner data
- Filter by `yearStart = 2025` and `category = 'competition_winner'`
- Rank field determines podium position

### Visual Hierarchy
- Section order: Founders → 2025 Winners (new) → 2024 Winners → Researchers → Pioneers
- 2025 Winners gets gradient backdrop and prominent spacing
- Podium cards visually distinct from standard trading cards

## Component Structure

```tsx
// WinnersSection.tsx
<section className="relative">
  <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 to-purple-600/20 blur-3xl -z-10" />
  <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-6">
    <Trophy className="h-6 w-6 text-amber-400" />
    <h2 className="text-2xl font-bold">2025 ARC Prize Winners</h2>
  </div>

  {/* Top 3 Podium */}
  <div className="grid md:grid-cols-3 gap-6 mb-8">
    {topThree.map(winner => <WinnersPodiumCard key={winner.id} winner={winner} />)}
  </div>

  {/* Other Winners Grid */}
  {remainingWinners.length > 0 && (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {remainingWinners.map(winner => <HumanTradingCard key={winner.id} contributor={winner} />)}
    </div>
  )}
</section>
```

```tsx
// WinnersPodiumCard.tsx
<Card className={cn(
  "relative overflow-hidden transition-all duration-300 hover:scale-105",
  rank === 1 && "border-4 border-amber-500 shadow-2xl shadow-amber-500/50",
  rank === 2 && "border-2 border-slate-400",
  rank === 3 && "border-2 border-orange-600"
)}>
  <CardHeader>
    <div className="flex items-start gap-4">
      <Avatar className="h-20 w-20">
        <AvatarImage src={winner.imageUrl || gifUrl} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <Badge variant={badgeVariant} className="mb-2">
          {rankEmoji} Rank #{winner.rank}
        </Badge>
        <CardTitle className="text-xl">{winner.fullName}</CardTitle>
        <p className="text-sm text-muted-foreground">{winner.teamName}</p>
      </div>
    </div>
  </CardHeader>
  <CardContent>
    <p className="text-sm mb-4">{winner.achievement}</p>
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">Score:</span>
      <span className="font-mono font-bold">{winner.score}</span>
    </div>
    <SocialLinks links={winner.links} />
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full mt-4">View Profile</Button>
      </DialogTrigger>
      <DialogContent>
        <HumanTradingCard contributor={winner} />
      </DialogContent>
    </Dialog>
  </CardContent>
</Card>
```

## shadcn/ui Components Used
- Card, CardHeader, CardContent, CardTitle - Winner card structure
- Badge - Rank display and category tags
- Avatar, AvatarImage, AvatarFallback - Winner photos
- Dialog, DialogContent, DialogTrigger - Full profile modal
- Button - "View Profile" action
- Skeleton - Loading states
- Separator - Section dividers

## Color Scheme for Winners
- Rank 1 (Gold): border-amber-500, bg-amber-500/10, text-amber-400, shadow-amber-500/50
- Rank 2 (Silver): border-slate-400, bg-slate-400/10, text-slate-300, shadow-slate-400/30
- Rank 3 (Bronze): border-orange-600, bg-orange-600/10, text-orange-400, shadow-orange-600/30
- Background gradient: from-amber-500/20 to-purple-600/20

## Validation
Implementation plan complete. User will test:
- Visual appearance of podium layout
- Responsive behavior across breakpoints
- Dialog interactions for full profiles
- Data accuracy from API
- Accessibility with keyboard navigation
- Loading states and error handling
