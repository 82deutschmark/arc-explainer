#!/usr/bin/env python3.13
# Author: Claude Sonnet 5.5 (effort unknown)
# Date: 30-October-2026
# PURPOSE: Snapshot last year's ARC Hall of Fame (the 2025 ARC Raiders card set, every contributor and every
# painted card) into content/news/hall-of-fame.json so the Card Cabinet can keep and show the whole old set
# next to this year's, and next year's set can do the same with this one. Reads the Hall of Fame's own public
# API (https://arc.markbarney.net/api/contributors), the data its page renders; never edits the cards or
# their art. Each card keeps the #contributor anchor the Hall of Fame page uses, so every old card stays
# linked to its permanent place. Usage: python3.13 scripts/build_hall_of_fame_series.py
# SRP/DRY check: Pass — one job (Hall of Fame API -> series file); the Cabinet reads the file, not the API.
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "content/news/hall-of-fame.json"
SOURCE = "https://arc.markbarney.net/api/contributors?limit=500"
SITE = "https://arc.markbarney.net"


def main() -> int:
    with urllib.request.urlopen(urllib.request.Request(SOURCE, headers={"User-Agent": "arc-explainer-card-cabinet"}), timeout=30) as response:
        contributors = json.loads(response.read().decode("utf-8"))["contributors"]
    cards = []
    for item in sorted(contributors, key=lambda c: (-(c.get("yearStart") or 0), c.get("rank") if c.get("rank") is not None else 999, c["fullName"].lower())):
        images = [part.strip() for part in (item.get("imageUrl") or "").split(",") if part.strip()]
        cards.append({
            "id": int(item["id"]),
            "path": f"/hall-of-fame#contributor-{item['id']}",
            "name": item["fullName"],
            "handle": item.get("handle") or None,
            "year": item.get("yearStart"),
            "category": item["category"],
            "achievement": item.get("achievement") or None,
            "score": item.get("score") or None,
            "rank": item.get("rank"),
            "team": item.get("teamName") or None,
            "affiliation": item.get("affiliation") or None,
            # Painted card art: loose files at the site root (/jfPuget3.png) or under /news-images (/news-images/people/...).
            "images": images,
        })
    result = {
        "version": 1,
        "series": {"id": "hall-of-fame-2025", "name": "ARC Raiders", "title": "ARC Hall of Fame", "season": "2025", "page": f"{SITE}/hall-of-fame", "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},
        "cards": cards,
    }
    OUT.write_text(json.dumps(result, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(cards)} cards, {sum(1 for c in cards if c['images'])} with painted art")
    return 0


if __name__ == "__main__":
    sys.exit(main())
