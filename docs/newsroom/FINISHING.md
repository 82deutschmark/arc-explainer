# Finish the assignment and stop

Standing order from Mark Barney, head editor, 22 October 2026. Applies to every Codex,
Claude, OpenClaw and manual newsroom assistant. It supersedes older instructions to
wait for deployment, repeatedly prove completion, or keep improving a finished task.

- **One verification per completed action.** Use the action's success receipt, the required
  local validation, or one visible result. Recheck only after an actual failure or conflicting
  evidence. Do not inspect the same result on the profile, permanent page and screenshots.
- **A successful push finishes publication.** The site builds asynchronously. Report the
  intended story URL and stop; do not poll the page, API, deployment service or image URL.
  Deployment investigation requires a separate explicit assignment from the editor.
- **The editor's confirmation finishes the send.** “I posted it,” “I tweeted it,” or equivalent
  is sufficient. Do not open the browser to verify, obtain a URL, add an image, edit, reply or
  send a duplicate. Record a supplied URL if there is one; a missing URL is not a blocker.
- **Stop means stop immediately.** No cleanup calls, screenshots, ledger maintenance,
  acknowledgments from other agents, memory writes or final verification after a stop order.
- **No work after completion.** Do the requested reporting, essential source checks and
  required local validation once. No cosmetic follow-up, optional illustration variants,
  extra tests, speculative fixes, or repeated tool-status checks after the deliverable is done.
- **Keep browser work bounded.** Inspect only what the next action needs. One account and
  duplicate check before an authorized send, one composition review, and one success result
  are enough. If the editor takes over, stop browser input. Never compete for the controls.
- **Do not create more work to announce this rule.** Inform the relevant desks once. Do not
  wake old jobs, restart paused desks, create monitors, request acknowledgments or poll replies.

The X helper now prepares every edition draft without deployment access. To record an explicit
human confirmation of an existing outbox, use the local-only completion command and finish:

```sh
python3.13 scripts/newsroom_x.py --output <existing-outbox.json> --record-human-post
```

Add `--post-url <editor-supplied-X-URL>` only when the editor supplied it. The helper never
fetches the URL, never sends, and preserves completed outboxes. This command is a response to
an actual human confirmation, not a way to assume that an unsent draft was posted.
