# Dev Routes Pattern

**Author:** Claude Code (Sonnet 4.5)
**Date:** 2025-12-28
**Purpose:** Guide for creating dev-only component showcases that are excluded from production builds

---

## Overview

Dev routes provide isolated pages for visually inspecting component variants without needing to trigger each state manually. These routes:
- Only exist in development mode
- Are completely stripped from production builds (zero bytes added to `dist/`)
- Follow a consistent URL namespace pattern
- Live in `client/src/pages/dev/`

## Quick Start

### 1. Create Your Showcase Page

```tsx
// client/src/pages/dev/MyComponentShowcase.tsx
import { MyComponent } from "@/components/path/to/MyComponent";

export default function MyComponentShowcase() {
  const scenarios = [
    { title: "Loading State", props: { isLoading: true } },
    { title: "Error State", props: { error: "Network failed" } },
    { title: "Success State", props: { data: mockData } },
  ];

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">MyComponent Variants</h1>
        <p className="text-muted-foreground">
          Visual reference for all states in{" "}
          <code className="text-sm bg-muted px-1 py-0.5 rounded">
            components/path/to/MyComponent.tsx
          </code>
        </p>
      </div>

      <div className="space-y-6">
        {scenarios.map((scenario, i) => (
          <div key={i} className="space-y-2">
            <h3 className="text-sm font-mono text-muted-foreground">
              {scenario.title}
            </h3>
            <MyComponent {...scenario.props} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 2. Add to App.tsx

In `client/src/App.tsx`, add the import at the top:

```tsx
import MyComponentShowcase from "@/pages/dev/MyComponentShowcase";
```

Then add the route to the dev-only section (just before the NotFound route):

```tsx
{/* Dev-only routes for component showcases (excluded from production builds) */}
{import.meta.env.DEV && (
  <>
    <Route path="/dev/rearc/error-display" component={ReArcErrorShowcase} />
    <Route path="/dev/my-component" component={MyComponentShowcase} />
  </>
)}
```

### 3. Reference in Component File

Update your component's header comment to reference the dev route:

```tsx
/**
 * MyComponent.tsx
 *
 * Author: {Your Name}
 * Date: {timestamp}
 * PURPOSE: Description of what this component does
 * SRP/DRY check: Pass
 *
 * Dev showcase: View all variants at /dev/my-component (dev mode only)
 */
```

## URL Namespace Pattern

Use hierarchical paths that mirror your component structure:

```
/dev/rearc/error-display        → components/rearc/ErrorDisplay.tsx
/dev/rearc/generation-preview   → components/rearc/GenerationSection.tsx preview
/dev/worm-arena/game-states     → components/worm-arena/GameBoard.tsx states
/dev/ui/alert-variants          → shadcn alert component variants
```

## How It Works

### Vite Environment Variables

`import.meta.env.DEV` is a compile-time constant:
- **Development:** `true` → routes are included
- **Production:** `false` → entire code block is removed by tree-shaking

### Verification

After building for production, verify routes are excluded:

```bash
npm run build
# Search for your dev route - should return nothing
grep -r "dev/my-component" dist/
```

## When to Create Dev Routes

**DO create dev routes for:**
- Components with multiple visual states (loading, error, empty, success)
- Complex error message variants
- Form validation states
- Different data scenarios (empty lists, single item, many items)

**DON'T create dev routes for:**
- Simple components with one state
- Components that are easy to access normally
- One-off debugging (just use the regular page)

## Examples

### Current Dev Routes

1. **RE-ARC Error Display** ([/dev/rearc/error-display](http://localhost:5173/dev/rearc/error-display))
   - File: `pages/dev/ReArcErrorShowcase.tsx`
   - Shows: All 26 error variants from `components/rearc/ErrorDisplay.tsx`
   - Why: Validation errors are hard to trigger manually

## Best Practices

1. **Keep it simple** - These are reference tools, not production features
2. **Document scenarios** - Use clear titles for each variant
3. **Mirror component structure** - URL should reflect component path
4. **Export as default** - Consistency with other pages
5. **Use realistic data** - Show actual use cases, not "foo/bar" placeholders
6. **Group related states** - Organize by error type, loading state, etc.

## File Structure

```
client/src/
├── pages/
│   ├── dev/                          # All dev-only pages
│   │   ├── ReArcErrorShowcase.tsx    # Example showcase
│   │   └── MyComponentShowcase.tsx   # Your new showcase
│   ├── PuzzleBrowser.tsx             # Regular pages
│   └── ...
└── components/
    ├── rearc/
    │   └── ErrorDisplay.tsx          # Component being showcased
    └── ...
```

## TypeScript Considerations

If your component uses complex types, import them from the component file:

```tsx
import { MyComponent, type MyComponentProps } from "@/components/MyComponent";

const scenarios: Array<{ title: string; props: MyComponentProps }> = [
  // ...
];
```

## Adding to DEVELOPER_GUIDE.md

When creating new dev routes for major component groups, consider adding a reference in `docs/DEVELOPER_GUIDE.md` under the relevant section.

---

**Questions?** Check existing showcases in `client/src/pages/dev/` for real examples.