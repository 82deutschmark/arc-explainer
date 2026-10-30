#!/usr/bin/env python3.13
# Author: Claude Sonnet 5.5 (effort unknown)
# Date: 30-October-2026 (web portraits allowed, Boss, 30-Oct-2026)
# PURPOSE: Fold per-player Kaggle career evidence (content/news/evidence/kaggle-careers/<id>.json)
# into content/news/people.json so every ARC Daily player card gets sourced career highlights and
# its own portrait. Only evidence marked "verified": true is used, so drafts written while Kaggle
# was blocking us never reach a card. Idempotent: facts that were sourced from the player's own
# Kaggle pages are replaced by the verified ones; facts from other sources (Hall of Fame,
# write-ups, X) are kept. Portraits change only when the evidence says "replaced" and the file
# exists: from the player's own Kaggle account (kind kaggle) or, since the Boss allowed outside
# pictures, from a public page that names them (kind web). Group images or missing portraits are
# listed for human attention.
# Makes no network requests. Usage: merge_kaggle_careers.py [--write]  (default is a dry run).
# SRP/DRY check: Pass — one job (evidence -> people.json); reuses the file formats the card
# registry already reads and does not touch cards.json.
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PEOPLE = ROOT / "content/news/people.json"
EVIDENCE = ROOT / "content/news/evidence/kaggle-careers"
IMAGES = ROOT / "client/public"


def is_own_kaggle_source(fact: dict, handles: set[str]) -> bool:
    """True when a fact cites one of the player's own Kaggle pages (profile or competitions)."""
    url = (fact.get("sourceUrl") or "").lower().rstrip("/")
    return any(url == f"https://www.kaggle.com/{h}" or url.startswith(f"https://www.kaggle.com/{h}/") for h in handles)


def fact_row(fact: dict, checked_at: str) -> dict:
    # Alphabetical key order matches the rest of people.json, keeping diffs small.
    return {
        "checkedAt": fact.get("checkedAt") or checked_at,
        "sourceTitle": fact["sourceTitle"],
        "sourceUrl": fact["sourceUrl"],
        "text": fact["text"],
    }


def main() -> int:
    write = "--write" in sys.argv
    people = json.loads(PEOPLE.read_text(encoding="utf-8"))
    by_id = {person["id"]: person for person in people}
    merged, skipped, attention = [], [], []

    for path in sorted(EVIDENCE.glob("*.json")):
        try:
            evidence = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            skipped.append((path.stem, "invalid JSON"))
            continue
        person = by_id.get(path.stem)
        if person is None:
            skipped.append((path.stem, "no such player"))
            continue
        if evidence.get("verified") is not True:
            skipped.append((path.stem, "not verified"))
            continue

        handles = {a["handle"].lower() for a in person.get("accounts", []) if a.get("platform") == "kaggle"}
        if evidence.get("handle"):
            handles.add(evidence["handle"].lower())
        checked_at = evidence.get("checkedAt", "")
        new_facts = [fact_row(f, checked_at) for f in evidence.get("facts", []) if f.get("text") and f.get("sourceUrl") and f.get("sourceTitle")]
        if new_facts:
            # Facts from other sources stay, except exact repeats of the verified ones, so re-running never duplicates.
            fresh = {(f["sourceUrl"], f["text"]) for f in new_facts}
            kept = [f for f in person.get("facts", []) if not is_own_kaggle_source(f, handles) and (f.get("sourceUrl"), f.get("text")) not in fresh]
            # Official ARC Prize honours keep the lead (the card front shows the first highlight);
            # the verified Kaggle record follows, then any other earlier facts.
            honours = [f for f in kept if "arcprize.org" in (f.get("sourceUrl") or "") or "arc.markbarney.net" in (f.get("sourceUrl") or "")]
            others = [f for f in kept if f not in honours]
            person["facts"] = honours + new_facts + others

        portrait = evidence.get("portrait") or {}
        status = portrait.get("status")
        if status == "replaced" and portrait.get("src") and (IMAGES / portrait["src"].lstrip("/")).is_file():
            # The loader only accepts a face traced to the player's own Kaggle account (the account's
            # profile URL) or their Hall of Fame card, so any other source is flagged, never merged.
            account = next((a for a in person.get("accounts", []) if a.get("platform") == "kaggle" and a["handle"].lower() == (evidence.get("handle") or "").lower()), None)
            from_kaggle = "kaggle" in (portrait.get("sourceUrl") or "").lower() or "kaggle-avatars" in (portrait.get("imageUrl") or "").lower()
            if account and from_kaggle:
                person["portrait"] = {
                    "alt": portrait.get("alt") or f"{person['name']}’s own Kaggle profile picture",
                    "checkedAt": checked_at,
                    "kind": "kaggle",
                    "sourceTitle": f"{person['name']} — own Kaggle profile picture",
                    "sourceUrl": account["url"],
                    "src": portrait["src"],
                }
            elif (portrait.get("sourceUrl") or "").startswith("https://"):
                # Boss, 30-Oct-2026: pictures from outside Kaggle are fine when a public page names the player.
                title = portrait.get("sourceTitle") or f"Picture on {portrait['sourceUrl'].split('/')[2]}"
                if person["name"].lower() not in title.lower():
                    title = f"{person['name']} — {title}"
                person["portrait"] = {
                    "alt": portrait.get("alt") or f"{person['name']}, from {portrait['sourceUrl']}",
                    "checkedAt": checked_at,
                    "kind": "web",
                    "sourceTitle": title,
                    "sourceUrl": portrait["sourceUrl"],
                    "src": portrait["src"],
                }
            else:
                attention.append((path.stem, f"new picture {portrait['src']} has no public source page"))
        elif status in ("group-image", "none-available"):
            attention.append((path.stem, status))
        merged.append((path.stem, len(new_facts), status))

    for pid, n, status in merged:
        print(f"merged  {pid:28} facts={n} portrait={status}")
    for pid, why in skipped:
        print(f"skipped {pid:28} {why}")
    for pid, status in attention:
        print(f"ATTENTION {pid:26} portrait: {status}")
    if write:
        PEOPLE.write_text(json.dumps(people, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("people.json written")
    else:
        print("dry run: nothing written (use --write)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
