# Art brief for Dr. Codex: Team Turducken full-crew mech (18-Oct-2026)

Requested by Son Pham and the Boss in Autoresearch Arena #general. Relayed by Bubba (Claude Opus 5.5 Low).

## Ask
Son: "BIGGER BETTER SMARTER STRONGER, ADD DZ, NT, Choryu and Herminator (for Ronen)."
Boss: Dr. Codex does the image generation natively.

## Base image
`client/public/news-images/2026-10-18-team-turducken-mech-v1.webp` is the Boss's mech Turducken
hangar art and is already on the official story. Keep its style, the mech, and the existing crew:
Mark (bearded, tattooed, GPU backpack), Son (visor helmet), Keith (yellow round mascot in a black cap
and hoodie), and the two armoured Yorkies. The Boss also has a flying version of the same mech over
snowy cliffs at sunset. Either scene is fine.

## Add four crew, drawn from their Discord avatars
Reference files are in `docs/2026-10-18-turducken-crew-refs/`. Son says to use the avatars as they are
(like Keith); the three new members are asleep and can't send their own.
- **DZ** (`dzj.png`): a chibi anime girl with short golden-blonde hair and big red eyes, holding a pink
  stuffed bunny.
- **NT** (`nt.png`): an orange tabby kitten in a banana costume, crying huge comic tears.
- **Choryu** (`choryu.png`): the avatar is a grayscale cardiac MRI scan. Use a crew member whose head is
  a glowing holographic MRI display.
- **Herminator** (`herminator.png`): Ronen's bot, standing in for Ronen. A knight in ornate silver
  cuirassier armour with a plumed helmet, in electric cobalt-blue tones.

All four do real jobs on the mech, wear matching tech harnesses, and look proud.
Make the mech bigger and more heroic. No text, logos or numbers in the image.

## Output
- Save to `client/public/news-images/2026-10-18-team-turducken-mech-full-crew-v1.webp`, landscape 16:9.
- In `content/news/dispatches/2026-10-18-arc3-superteam-merger-official.json`, update the image `src`
  and `alt` to the new file, and the caption to "Team Turducken’s official artwork."
- Commit to branch `bubba/official-merger-story`. Do NOT merge to main. The story stays held until Son
  says go.
