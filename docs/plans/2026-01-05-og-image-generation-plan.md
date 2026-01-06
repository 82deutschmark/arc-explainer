# Open Graph Image Generation Plan

**Author:** Claude Haiku (updated by Sonnet 4)
**Date:** 2026-01-05 (updated 2026-01-05)
**Goal:** Implement dynamic OG image generation so puzzle links display grid previews when shared on Discord, Slack, Twitter, etc.

## Overview

When users share links to ARC Explainer puzzles, the pages should render beautiful grid visualizations as preview images (like arcprize.org does). This requires:

1. **Backend API endpoint** – generates PNG from task grids on-demand
2. **Meta tag injection** – ensures pages include `og:image` pointing to generated image
3. **Image service** – handles grid-to-PNG rendering optimized for social media

---

## Architecture

### Current State
- `server/services/gridImageService.ts` – Already renders grids to PNG using `sharp`
- `puzzleController.ts` – Handles puzzle data endpoints
- React pages (e.g., `PuzzleExaminer.tsx`) – Render puzzle details client-side
- **`server/middleware/metaTagInjector.ts`** – Existing middleware for SSR meta tag injection (currently only static routes)
- **`shared/routes.ts`** – Centralized route meta tag definitions

### What We're Adding
```
┌─────────────────┐
│  Browser/Client │
│  (Share Link)   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Social Platform        │
│  (Discord/Slack/Twitter)│
└────────┬────────────────┘
         │ Reads meta tags
         ▼
┌────────────────────────────────────┐
│  Page HTML <head>                  │
│  <meta og:image="/api/og-image/X"> │
└────────┬─────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  /api/og-image/:taskId Endpoint         │
│  ✓ Load task data                       │
│  ✓ Render grid to PNG                   │
│  ✓ Return image file                    │
└─────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Backend Image Generation Service

**File:** `server/services/ogImageService.ts` (new)

**Responsibilities:**
- Generate OG-optimized images from ARC grids
- Handle sizing/styling for social media (typically 1200x630px recommended)
- Reuse `gridImageService.renderGridToPng()` but with OG-specific parameters
- Composite multiple examples (2-3 training examples) into a single attractive image
- Add branding/title text overlay

**Key Functions:**
```typescript
export async function generateOgImageForTask(
  task: ARCTask,
  options?: OgImageOptions
): Promise<Buffer>

export interface OgImageOptions {
  width?: number;           // Default 1200
  height?: number;          // Default 630
  exampleCount?: number;    // How many training examples (default 2)
  cellSize?: number;        // Pixels per cell
}
```

**Implementation Notes:**
- Use `sharp` for compositing (already a dependency)
- Include task ID on the image (top-left corner, white text on semi-transparent black)
- **Example Selection Rules:**
  - Show first 2 training examples (most representative of the pattern)
  - If only 1 training example exists, show it larger
  - Skip test inputs (don't spoil the puzzle)
- **Layout Specification:**
  - Canvas: 1200x630px (social media standard)
  - Background: Dark gray (#1a1a2e) for contrast
  - Each example: Input grid → Output grid (side by side with arrow)
  - Examples stacked vertically if 2 shown
  - Minimum cell size: 8px (for readability at thumbnail size)
  - Maximum cell size: 24px (to fit grids in available space)
  - Padding: 40px on all sides
  - Gap between examples: 30px
- Cache the generated images in memory with LRU eviction (see Caching Strategy)

---

### Phase 2: API Endpoint

**File:** `server/controllers/ogImageController.ts` (new)

**Responsibilities:**
- Handle `GET /api/og-image/:taskId` requests
- Validate task exists
- Call `ogImageService.generateOgImageForTask()`
- Return PNG with proper headers

**Example Route Handler:**
```typescript
export async function getOgImage(req: Request, res: Response) {
  const { taskId } = req.params;

  // Validate taskId format
  // Load task from database
  // Generate OG image
  // Set response headers: Content-Type: image/png, Cache-Control
  // Return image buffer
}
```

**Response Headers:**
- `Content-Type: image/png`
- `Cache-Control: public, max-age=86400` (cache for 24 hours)

**Route Registration:** Add to appropriate router file (likely `server/routes/` or directly in main app)

---

### Phase 3: Meta Tag Injection (Server-Side)

**CRITICAL:** Client-side meta tag injection does NOT work for social media crawlers (Discord, Twitter, Slack). These crawlers do not execute JavaScript – they only read the initial HTML response.

**Solution:** Extend the existing `metaTagInjector.ts` middleware to handle dynamic puzzle routes.

**File:** `server/middleware/metaTagInjector.ts` (modify)

**Changes Required:**
1. Add pattern matching for `/puzzle/:taskId` routes (in addition to exact path matches)
2. Fetch puzzle metadata (title, description) from the puzzle loader
3. Generate dynamic `og:image` URL pointing to `/api/og-image/:taskId`
4. Inject the tags into HTML before sending to crawler

**Dynamic Route Patterns:**
```typescript
// Routes that need dynamic meta tags:
// /puzzle/:taskId - Puzzle detail pages
// /puzzle/:taskId/discussion - Discussion pages
// /puzzle/:taskId/analyze - Analysis pages
```

**Implementation:**
```typescript
// In metaTagInjector.ts - add dynamic route handling
const puzzleRouteMatch = requestPath.match(/^\/puzzle\/([a-f0-9]{8})(?:\/.*)?$/);
if (puzzleRouteMatch) {
  const taskId = puzzleRouteMatch[1];
  // Generate puzzle-specific meta tags with OG image URL
  const tags = await generatePuzzleMetaTags(taskId);
  // ... inject into HTML
}
```

---

### Phase 4: Integration & Testing

**Files to Modify:**

1. **App Initialization**
   - Register the new API route
   - Ensure CORS allows image requests if needed

2. **Puzzle Pages**
   - Add meta tag hook to puzzle detail pages
   - Verify tags update when taskId changes

3. **Testing**
   - Unit tests for `ogImageService` grid rendering
   - Integration test for API endpoint (returns valid PNG)
   - Manual testing with Discord/Slack preview tools (metatags.io)

---

## File Checklist

### New Files
- [ ] `server/services/ogImageService.ts` – OG image generation logic with LRU caching
- [ ] `server/controllers/ogImageController.ts` – HTTP endpoint handler
- [ ] `tests/unit/services/ogImageService.test.ts` – Unit tests
- [ ] `tests/integration/ogImage.test.ts` – Integration tests including crawler validation

### Modified Files
- [ ] `server/routes.ts` – Register new `/api/og-image/:taskId` route
- [ ] `server/middleware/metaTagInjector.ts` – Add dynamic puzzle route handling
- [ ] `CHANGELOG.md` – Document new feature

### NOT Needed (Client-Side)
- ~~`client/src/hooks/useOgTags.ts`~~ – NOT NEEDED: crawlers don't execute JS
- ~~`client/src/pages/*.tsx`~~ – NOT NEEDED: meta tags injected server-side

---

## Key Decisions & Rationale

### Why a Dedicated ogImageService?
- Separates concerns: `gridImageService` is generic grid rendering, `ogImageService` is social-media-optimized
- Easier to customize styling, size, and composition for OG images
- Can cache/optimize differently from other image uses

### Image Sizing
- **Social Media Standard:** 1200×630px (Twitter/Discord/Slack recommended)
- **Cell Size:** Adjust dynamically based on grid dimensions to fill the space
- **Examples:** Show 2-3 training examples to give viewers a sense of the puzzle

### Caching Strategy
- **In-Memory LRU Cache** with 100-entry limit (puzzles are static, ~200KB each max)
- **24-hour TTL** on cache entries
- **Cache Key Format:** `og-image:${taskId}:${exampleCount}` (allows different compositions)
- **Eviction Policy:** LRU (Least Recently Used) when cache exceeds 100 entries
- **No invalidation needed** – ARC puzzle data is immutable
- **Multi-instance note:** Each server instance has its own cache; this is acceptable for our scale (~4-5 users)

```typescript
// Cache implementation using Map with LRU eviction
const OG_IMAGE_CACHE = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
```

### URL Structure
- `/api/og-image/:taskId` – Simple, predictable
- Returns PNG directly (not a redirect or data URL)
- Allows social platforms to cache the image

---

## Dependencies & Prerequisites

### Already Available
- `sharp` (used by `gridImageService`, image processing)
- `express` (HTTP framework)
- `ARC_COLORS_TUPLES` (color palette from shared config)
- `ARCTask` types (from shared types)

### May Need to Install
- None expected (check if `sharp` is in `package.json`)

---

## Testing Strategy

### Unit Tests (ogImageService)
```typescript
describe('ogImageService', () => {
  it('should generate a PNG buffer for a valid task', async () => {
    const task = loadTestTask('6ffbe589');
    const buffer = await generateOgImageForTask(task);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should include training examples in the image', async () => {
    // Verify image contains expected grid colors
  });
});
```

### Integration Tests (API endpoint)
```typescript
describe('GET /api/og-image/:taskId', () => {
  it('should return a PNG with correct headers', async () => {
    const res = await request(app).get('/api/og-image/6ffbe589');
    expect(res.status).toBe(200);
    expect(res.type).toBe('image/png');
  });

  it('should return 404 for invalid taskId', async () => {
    const res = await request(app).get('/api/og-image/invalid-id');
    expect(res.status).toBe(404);
  });
});
```

### Crawler Validation Tests (CRITICAL)
```typescript
describe('Crawler meta tag validation', () => {
  it('should include og:image meta tag in HTML for puzzle routes', async () => {
    const res = await request(app)
      .get('/puzzle/6ffbe589')
      .set('User-Agent', 'Discordbot/2.0'); // Simulate crawler
    
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.text).toContain('<meta property="og:image"');
    expect(res.text).toContain('/api/og-image/6ffbe589');
  });

  it('should include og:title with puzzle ID', async () => {
    const res = await request(app).get('/puzzle/6ffbe589');
    expect(res.text).toMatch(/<meta property="og:title"[^>]*6ffbe589/);
  });
});
```

### Manual Validation
- Use [metatags.io](https://metatags.io) or [opengraph.dev](https://opengraph.dev) to preview links
- Paste puzzle URL and verify image displays correctly
- Test sharing on Discord/Slack and check preview

---

## Performance Considerations

1. **Image Generation Cost:** sharp is fast, but generating on-demand can add latency
   - Solution: Cache images in memory or Redis (24-hour TTL)
   - Consider pre-generating popular tasks during off-peak hours

2. **Bandwidth:** PNG files are reasonably small (typically 50-200KB for grids)
   - Cache-Control headers enable browser/CDN caching
   - Social platforms cache previews for shared links

3. **Monitoring:** Consider logging image generation times to identify bottlenecks

---

## Future Enhancements (Out of Scope)

- Pre-generate images at build time for all tasks
- Customizable styling (themes, fonts, colors)
- Include model prediction overlays on OG images
- A/B test different image layouts for engagement

---

## Rollout Plan

1. **Develop & Test:** Implement all files locally, run unit + integration tests
2. **Manual Testing:** Verify links preview correctly on Discord/Slack
3. **Deploy:** Merge to main, deploy to production
4. **Monitor:** Check logs for any image generation errors
5. **Iterate:** Gather feedback and refine image styling if needed

---

## Questions for the Implementer

1. Is `sharp` already in `package.json`? (Should be, since `gridImageService` uses it)
2. Should images be cached? If so, in-memory or Redis?
3. Are there other puzzle detail pages beyond `PuzzleExaminer`, `PuzzleDiscussion`, `PuzzleAnalyst`?
4. Should the OG image show input+output side-by-side, or just input grids?
5. Any branding/styling preferences (colors, fonts, layout)?

---

## Summary

This plan adds a single, focused feature: dynamic OG image generation for puzzle sharing. It reuses existing `gridImageService` logic, integrates cleanly with the current controller/routes pattern, and requires minimal changes to puzzle pages. The result: when users share puzzle links, they get beautiful grid previews instead of generic text.
