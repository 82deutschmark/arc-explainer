# A front page led by the contenders

## Scope

- Reduce the permanent masthead and remove the large static introduction, slogan and newspaper self-description.
- Put published competition stories and dated, sourced social dispatches above resource shelves and advertising. The newest dispatch can lead its own competition; later editions replace it by publication time.
- Refresh the archive while the page is open. Date labels reflect published content, not the visitor's current date.
- Add immutable short dispatch JSON, validated at publication and server read boundaries, with primary-source links and a separate editorial interpretation.
- Make checking public competitor posts on X and Kaggle discussions part of each reporter run. Use the existing signed-in browser; verify account identities and preserve exact source links. Do not send social messages.
- Create a cartoon echoing Tufa's snowy boulevard: Chen's fluffy rabbit grows while Tufa's friendly cartoon spider straps on graphics cards. User approved the generated preview and asked for programmatic ARC-3 branding, a real game PNG and the two scores. The approved artwork is now the sourced dispatch's illustration and can accompany same-day evening coverage with its dated caption.

## Evidence and editorial limits

- Read Tufa's original post and recent profile posts through the user's signed-in Chrome session. Confirmed the black cartoon spider avatar.
- Independently checked Chen's public Kaggle profile: `threerabbits`, she/her, two-rabbit avatar, Competitions Master, double-degree student at National Taiwan University and Waseda University.
- Re-prepared the manual preview after adding notebook facts. The final ARC-3 observation at `2026-10-09T17:23:04Z` has Chen first at 59.17, Tufa second at 56.52; one listed Chen member and six listed Tufa members. Listed roster size does not establish compute, budget, outside assistance or submission methods.
- Chen's score event from 55.77 to 59.17 is documented in the immutable October 9 morning evidence. The manual preview has no prior-evening Chen comparison; do not call that event her full evening net gain.
- The hardware in the cartoon is a metaphor for Tufa's public rhetoric. No claims about actual card brands, purchases or hardware counts.
- Scheduled evening publication still needs fresh 6 pm evidence and covers both contests separately. This work does not rewrite existing editions or change the automation settings.

## Verification

- Production client build, focused news/SEO integration checks and real-content desktop/phone renders.
- Check dispatch validation rejects missing citations, unsafe asset paths, future timestamps and changed retries.
- Stage only intended code, content, documentation and reviewed illustration assets; safe fetch/rebase and push to main.

Client build passed, along with 20 news/SEO integration checks and 10 newsroom
unit checks. Actual component renders use current committed stories and the new
dispatch at desktop and phone widths. Repository-wide TypeScript checking still
has existing unrelated diagnostics; none name the edited news files. The X draft
helper was audited without sending a post. Full generation prompt and overlay
instructions are in `docs/newsroom/2026-10-09-rabbit-spider-artwork.md`.
