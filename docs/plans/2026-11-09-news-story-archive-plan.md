<!--
Author: GPT-6 / Codex (reasoning effort not exposed)
Date: 09-November-2026
PURPOSE: Record the scope and release checks for the story archive on the existing community address.
SRP/DRY check: Pass — the archive uses the published news index and each story's existing address.
-->

# Story archive

Replace the October source roundup at `/news/community` with a browsable list of published editions and features. The archive reads the same records as the paper and updates when a new story is published.

- List stories newest first, grouped by month, with publication dates, competition names and standfirsts.
- Let readers search the headlines and standfirsts and filter by competition. Keep the full list of story links in the plain server page.
- Update the paper's links and page metadata. Keep the wire on its dedicated page.
- Check archive content, filters, and phone layout locally, then push to the host's release branch.
