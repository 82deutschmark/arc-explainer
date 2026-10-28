# Show the commissioned feature on the edition permalink

Author: GPT-6.1 Sol / Codex
Date: 28 October 2026

The editor followed the evening-edition link and saw a short recap without the promised image. The saved feature and cover exist, but only the front-page component resolves frontPageFeatureId. The permanent edition page and its initial server HTML ignore it.

Scope: reuse the same feature selection and dispatch presentation on the front page and edition permalink; show the complete feature, cover, caption and primary-source links before the closing recap. Preserve all immutable edition, feature and evidence JSON. Missing or unrelated feature references leave the ordinary edition readable.

Validation: render the real October 28 permalink with the committed archive and check its full feature, image and recap. Check direct HTTP initial HTML as well. Run the required newsroom content and Python suites, then build. Commit and push the fix; no deployment polling or duplicate announcement.

Completed: shared dispatch rendering and feature selection now cover the actual edition URL in React and server HTML. Regression checks use the committed October 28 article, all five feature sections, original sources and reviewed image. Missing and cross-contest references preserve the recap. Validation passed: 30 news tests, 69 newsroom Python checks and production build. Existing TypeScript diagnostics remain outside changed files.
