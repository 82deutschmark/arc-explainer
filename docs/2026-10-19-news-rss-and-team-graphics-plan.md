# RSS content check and separate team graphics

Author: GPT-6.1 Sol / Codex
Date: 19 October 2026

The Boss explicitly requested fixing the recurring RSS check and adding ARC2/ARC3
team references to the image generator skill in this conversation.

- Keep the existing feed policy: newest 40 edition articles. The full archive stays
  in the sitemap. Fix the integration check to verify each contract separately,
  including exact RSS membership, order, latest build date and share-card links.
- Keep newsroom graphics guidance in the existing character guide. Add an exact,
  dated team/cast map there and route the installed imagegen skill to that map via
  a scoped supporting reference. Preserve all existing artwork and skill behavior.
- Run the required news integration/front-page and Python newsroom checks, validate
  the edited skill, review the diff, then commit and push only these changes.

No model API calls, social sends, deployment checks or automation edits are needed.

Validation completed: all 27 news integration/front-page tests and 62 Python
newsroom tests pass. The imagegen skill validates, its adapter links resolve, and
all nine named frozen input images exist. Production RSS code remains unchanged.
