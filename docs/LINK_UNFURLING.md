/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-30
 * PURPOSE: Documentation for link unfurling system
 * SRP/DRY check: Pass - Documentation only
 */

# Link Unfurling Documentation

## Overview

Link unfurling is the feature that displays rich previews when sharing links on social media platforms (Discord, Twitter, Slack, iMessage, etc.). This is implemented using Express middleware instead of full server-side rendering.

## Architecture

### How It Works

1. **Route Matching**: Checks if the requested path has custom meta tags defined
2. **Meta Tag Injection**: Reads the built `index.html` and replaces everything between `<!-- META_TAGS_START -->` and `<!-- META_TAGS_END -->` with route-specific Open Graph and Twitter Card tags
3. **Fallback**: For routes without custom tags, serves the default `index.html` with original meta tags

### Files Involved

- **client/index.html**: Contains `<!-- META_TAGS_START -->` and `<!-- META_TAGS_END -->` markers wrapping default meta tags
- **shared/routes.ts**: Centralized route meta tag configuration (add new routes here)
- **server/middleware/metaTagInjector.ts**: Meta tag injection logic using regex replacement
- **server/index.ts**: Registers middleware before SPA fallback in production (line 194)
- **server/vite.ts**: Integrates meta tag injection into Vite's HTML transformation pipeline for development mode (line 95)

### Why This Approach?

- **Simple**: No need for full SSR (Vike/Next.js)
- **Railway-friendly**: Minimal performance impact vs SSR cold starts (500ms-2s)
- **Industry standard**: Common pattern for SPAs that need social media previews

## Currently Implemented Routes

### `/re-arc` - RE-ARC Bench

**Meta Tags:**
- **Title**: "RE-ARC Bench - Test Your ARC Solver"
- **Description**: "Generate fresh ARC puzzles and evaluate your solver with verifiable results using server-secret seeds"
- **URL**: https://arc.markbarney.net/re-arc
- **Type**: website

**Preview**: When sharing `/re-arc` on Discord/Twitter, users see a rich card with the title and description above.

## Future Route Expansion

All usages of `usePageMeta` should be replaced by this.

The following routes would benefit from custom meta tags in Phase 2:

### `/puzzle/:id` - Individual Puzzle Pages

**Potential Meta Tags:**
- **Title**: "ARC Puzzle {puzzleId} - {shortDescription}"
- **Description**: "View and analyze ARC-AGI puzzle {puzzleId} with training examples and test cases"
- **Image**: Dynamic puzzle preview image (could be generated SVG or screenshot)
- **URL**: https://arc.markbarney.net/puzzle/{puzzleId}

**Implementation Notes:**
- Requires dynamic meta tag generation based on puzzle data
- May need to query database or read puzzle JSON during middleware execution
- Consider caching to avoid repeated DB queries

### `/debate/:id` - Model Debate Pages

**Potential Meta Tags:**
- **Title**: "AI Model Debate on Puzzle {puzzleId}"
- **Description**: "Watch {modelA} vs {modelB} debate strategies for solving ARC puzzle {puzzleId}"
- **Image**: Could use puzzle image or debate-specific graphic
- **URL**: https://arc.markbarney.net/debate/{debateId}

**Implementation Notes:**
- Requires fetching debate metadata (participating models, puzzle ID)
- Could show debate outcome in description

### `/worm-arena/live/:id` - Live Worm Arena Matches

**Potential Meta Tags:**
- **Title**: "Live: {agentA} vs {agentB} in Worm Arena"
- **Description**: "Watch AI agents compete in real-time snake gameplay"
- **Image**: Could capture a frame from the match or use arena graphic
- **URL**: https://arc.markbarney.net/worm-arena/live/{matchId}

**Implementation Notes:**
- May need to fetch match status from live_game table
- Could show current score or round number

### `/leaderboards` - Leaderboard Pages

**Potential Meta Tags:**
- **Title**: "ARC-AGI Model Leaderboards - ELO Rankings"
- **Description**: "Compare AI model performance on ARC puzzles with ELO rankings, accuracy metrics, and cost analysis"
- **Image**: Could be a leaderboard snapshot or chart
- **URL**: https://arc.markbarney.net/leaderboards

**Implementation Notes:**
- Could include top model in description
- Static tags likely sufficient (no dynamic data needed)

## Adding New Routes

To add link unfurling for a new route:

### 1. Add to `ROUTE_META_TAGS` in `shared/routes.ts`

```typescript
export const ROUTE_META_TAGS: Record<string, RouteMetaTags> = {
  // ... existing routes
  '/your-route': {
    title: 'Your Page Title',
    description: 'Your page description for social media',
    url: 'https://arc.markbarney.net/your-route',
    image: '/your-preview-image.svg', // optional
    type: 'website', // optional
  },
};
```

#### For Dynamic Routes (e.g., `/puzzle/:id`)

You'll need to:
1. Modify the middleware to handle dynamic path matching
2. Extract route parameters (e.g., `puzzleId`)
3. Fetch necessary data (from DB or filesystem)
4. Generate meta tags dynamically

**Example pattern:**
```typescript
// Match dynamic route
if (requestPath.startsWith('/puzzle/')) {
  const puzzleId = requestPath.split('/')[2];
  const puzzleData = await fetchPuzzleData(puzzleId);

  const routeMetaTags = {
    title: `ARC Puzzle ${puzzleId}`,
    description: puzzleData.description,
    url: `https://arc.markbarney.net/puzzle/${puzzleId}`,
    image: `/api/puzzle/${puzzleId}/preview.png`, // if you have dynamic images
  };

  // ... inject tags
}
```

### 2. Validate Locally

1. Start dev server: `npm run dev`
2. In your browser, go to the page route and see if the page title is correct.

### 3. Validate with Link Preview

1. Start dev server: `npm run dev`
2. Run `npx localtunnel --port 3000` (or whatever port the server is running on), it'll give you a URL like `https://early-zoos-see.loca.lt`
3. Paste into https://linkpreview.xyz/, add the page route e.g. `https://early-zoos-see.loca.lt/re-arc`, and see the results

### 4. Railway Deployment

After deploying to Railway, validate like above again

## Known Limitations

1. **Static routes only**: Dynamic routes (e.g., `/puzzle/:id`) require additional implementation
2. **No image generation**: If you want dynamic preview images, you'll need to implement image generation endpoints
3. **Cache considerations**: Bots may cache previews, so changes to meta tags require cache invalidation on the platform side
