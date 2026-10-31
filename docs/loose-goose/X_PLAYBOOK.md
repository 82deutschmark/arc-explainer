# Posting on X for the Loose Goose

Author: Claude Sonnet 5.5 Medium · 31 October 2026 · distilled from the ARC Daily Digest's X work, including the last weekend of
ARC Prize 2026. Builds on [X_POSTING.md](../newsroom/X_POSTING.md), [ART_DESK.md](../newsroom/ART_DESK.md) and
[FINISHING.md](../newsroom/FINISHING.md); where this file is stricter or newer, this file wins for the Goose.

## The rules that never bend

1. **Discord first.** Every post is previewed in the feed channel with its picture and the Boss's mention before it reaches X. A reaction from anyone, or the Boss's written word in chat ("looks good, go for it"), clears that exact post. No reaction means the post stays a draft. Do not poll, nag or schedule a retry.
2. **One send per item.** An outbox in state `posting` or `posted` is never overwritten, retried blindly or edited. If a send is uncertain, check the profile once. If the Boss says he posted it, record it and stop.
3. **Every post tags @kaggle and carries #Kaggle** (the Boss, 31 October). Reserve the characters before drafting.
4. **Nothing unsourced.** Every number, name and handle is checked against the board or a ledger right before posting. Tag other people only when they have a fresh, real reason to be tagged and the handle is verified (the person's own profile, or a ledger source). Zero other tags is a complete post.
5. **Attribute causes.** Say who said it. "An ARC Prize moderator said on Discord…", "CPMP says…". Never state a cause as fact on someone's behalf.
6. **The Boss's own words about posts:** stories, not filler. A "card of the day" bank was rejected as boring (31 October). Post when something true and interesting happened. A quiet stretch is a quiet stretch.
7. **Finish and stop.** The post is sent or scheduled and recorded: the job is done. Do not watch it.

## Length and shape

- 280 characters. A web address counts as 23. Count with the real text.
- Open with the news in capitals or a clear headline, then one fact sentence or two, then `@kaggle #Kaggle`, then the link on its own line.
- The link is the story's own page, so the share card carries the picture (see Pictures).
- No bare "editorial illustration", "AI-generated" or "not real equipment" disclaimers (the Boss ruled them out). Credit the art quietly on the page.
- Points are not places. "Tufa leads ARC-2 by less than a point" is points. "Dipam and Om went from 208th to 14th" is places. Never mix them in one claim.
- Time in Eastern with the zone named in the post. UTC deadlines get both. Remember US clocks changed on 1 November 2026.

## Cadence (what worked, what to change)

A normal contest day on the ARC Digest: Early edition 6 am, Late edition 6 pm, one afternoon recap at 2:20 pm, wire stories every two hours, one to two specials. X got one post for each edition, one for the recap and one per special.

For the Goose:
- Routine: one morning post, one evening post, one midday leaderboard note only if something moved. Three or fewer a day.
- Specials: at most one a day normally, two in the last two days.
- Space every post at least two hours from the next. Do not stack a special on top of a scheduled edition. We crowded ourselves once on 31 October; schedule the special for the next clear slot instead.
- Final days: a countdown post at the start of the last day, one four hours out, one thirty minutes out, one when the bell rings, then silence until there is an official statement or results.
- Breaking news (a deadline change, a Kaggle statement, a new leader, a freeze): post fast, with the source named, after the Discord preview. It is the one thing that justifies an extra post.
- After the bell: no standings claims. Only the private board or an official announcement decides results.

## What counts as a story (see EDITORIAL_PLAYBOOK.md)

A leader swap, a team crossing a prize line, a very large jump up the board, two names at the top of two different contests, a rule change from the organizer, a named person saying something quotable. Not: a roster explainer with no news, a profile because we have the card, a countdown with nothing in it.

## Pictures: the part that cost us time

- **The picture leads.** A reviewed custom illustration leads the post. A generic site card is not a substitute.
- **Route A (Codex with signed-in Chrome):** attach the exact reviewed file through the browser's file picker, add alt text, and look at the compose preview before pressing Post. This is the established route in X_POSTING.md.
- **Route B (no file picker, which is the case in the Claude app's own browser pane):** give the story its own page with `og:image` and `twitter:card=summary_large_image`, then post the link. `scripts/weekend_story_page.py <dispatch id> <slug> <image>` builds that page from a dispatch. The share card then shows the art large. Steps: push, wait for the deploy (the page returns 200; about ten to fifteen minutes on 31 October), open the composer, paste the post, and wait until the card appears in the preview. The first one or two tries may show no card while X crawls the new page; reload the composer and type the text again.
- Convert pictures for web: 1400 wide webp for the page, never the 2 to 4 MB originals.
- Alt text describes what is in the picture. Do not write that it is generated.

## The mechanics in the Claude app's own browser pane (X is signed in there)

- Compose at `x.com/compose/post`. Click the text box, then type. Typing is reliable.
- **Do not edit text in place.** Select-all did not work and the text doubled. If a draft is wrong, navigate to the composer afresh (force) and type it again. Navigating away throws the draft away, so only do it on purpose.
- To schedule: click the clock icon in the composer toolbar. The picker shows month, day, year, hour and minute as native selects. Set them with a short script that uses the select element's own value setter and then dispatches a change event; clicking inside native selects is unreliable. Then press Confirm. The composer returns with "Will send on …" and a **Schedule** button. Press it, and look for the confirmation line "Your post will be sent on …". Pressing Confirm alone does not schedule anything.
- The picker's time zone is the account's (Eastern Daylight until 1 November 2026, Eastern Standard after).
- Scheduled posts live at `x.com/compose/post/unsent/scheduled`. Open one to edit it (edits keep the picture), or use Edit, tick the post and Delete to remove it.
- A sent post can be edited for about an hour. Do not edit sent posts without the Boss's word; leave them.
- Screenshot after every step that changes state. Coordinates in the pane are in the page's own frame; a 0.6-scale screenshot needs its numbers divided by 0.6.
- Never use the Boss's own Chrome (the Claude in Chrome extension) unless he asks. The app's pane is the default.

## Receipts

Every post gets a small JSON file in `~/bubba-workspace/reports/arc-daily-x/`: state (`draft`, `scheduled`, `posted`), the text, the link, the picture, the Discord message id, who approved and how, and the send time. Draft first, then update. These files are how the next shift knows what already went out.

## Templates (fill the braces from the board right before posting)

Breaking:
```
{HEADLINE IN CAPITALS}. {Who} says {one plain sentence}. {What it means in one more}. @kaggle #Kaggle
{story page}
```
Leader swap or new leader:
```
NEW LEADER IN {contest}. {Team} reaches {score}, passing {previous leader}. {One fact about the gap or the time}. @kaggle #Kaggle
{story page}
```
Story:
```
{STORY HEADLINE}. {The surprising number}. {The second fact}. @kaggle #Kaggle
{story page}
```
Four hours out:
```
FOUR HOURS TO THE BELL. {Leader} leads {contest} at {score}. {Gold line fact}. @kaggle #Kaggle
{magazine cover}
```
The bell has rung (post only after it passed unchanged):
```
THE BELL HAS RUNG. Submissions are closed and the private leaderboard decides. Kaggle lists the winners announcement for {date}. @kaggle #Kaggle
{final hours page}
```

## Traps we hit (31 October 2026)

- A post went out before the Boss's "tag Kaggle" rule: the old post kept no tag. Put the rule in the template first.
- A "no extension" post was scheduled for Sunday morning. By then it was yesterday's news (it had been reported the day before). Before scheduling, ask: will this still be news at the send time? If not, do not schedule it.
- A card-of-the-day bank was drafted from the card data. The Boss rejected it. The cards support stories; they are not the story.
- Quoting a staffer's retracted guidance as current. Check the live thread for edits before quoting it, and say when something was withdrawn.
- A fact-check pass found overstated words on our own pages ("everyone", "the hosts say", a cause stated as fact). Run the fact-check before the post, not after.
