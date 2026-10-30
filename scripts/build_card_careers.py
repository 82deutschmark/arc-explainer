#!/usr/bin/env python3.13
# Author: Claude Sonnet 5.5 (effort unknown)
# Date: 30-October-2026
# PURPOSE: Turn the verified Kaggle career evidence (content/news/evidence/kaggle-careers/*.json, plus the
# earlier Son and Mark proof files) into content/news/careers.json, the per-person career the Card Cabinet
# prints on a card's back: Kaggle Competitions tier, medal counts, overall rank, join year, organisation
# and the completed-competition table. A card never infers any of it: a tier Kaggle does not show stays
# null, a year appears only when the competition title, slug or an exact completion date proves it, and a
# medal panel counted from list icons is not used. Rules ported from the design-panel data analyst's
# prototype (30-Oct-2026). Makes no network requests; output is byte-stable.
# Usage: python3.13 scripts/build_card_careers.py [--check]   (--check fails if the file is stale)
# SRP/DRY check: Pass — one job (evidence -> careers.json). The server only reads the result; the evidence
# merge for card facts stays in scripts/merge_kaggle_careers.py.
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "content/news/evidence/kaggle-careers"
PROOFS = ROOT / "docs/newsroom/card-proofs/2026-10-29"
OUT = ROOT / "content/news/careers.json"

# Kaggle's own Competitions ladder, lowest first. Anything else on a profile is not a tier.
LADDER = ["Novice", "Contributor", "Expert", "Master", "Grandmaster"]
MEDALS = ("gold", "silver", "bronze")
YEAR = re.compile(r"\b(20[0-3]\d)\b")


def tier_of(raw) -> str | None:
    """'Competitions Grandmaster' -> 'Grandmaster'; anything not on the ladder -> None."""
    text = re.sub(r"^Competitions\s+", "", str(raw or "").strip(), flags=re.I)
    return next((name for name in LADDER if name.lower() == text.lower()), None)


def medals_of(profile: dict) -> dict | None:
    """Counts from the profile's medal panel only; icon counts or a missing panel give None."""
    raw = profile.get("medals")
    if not isinstance(raw, dict) or not any(color in raw for color in MEDALS):
        return None
    if str(profile.get("medalsBasis", "")).lower().startswith("counted from"):
        return None
    return {color: int(raw.get(color) or 0) for color in MEDALS}


def medal_of(raw) -> str | None:
    value = str(raw or "").strip().lower()
    return value if value in MEDALS else None


def organisation_of(profile: dict) -> str | None:
    """A strict organisation field, else the organisation in a 'Role at Organisation' line; never a slogan."""
    for key in ("organization", "employer", "affiliation"):
        if isinstance(profile.get(key), str) and profile[key].strip():
            return profile[key].strip()
    for key in ("occupation", "occupationLine", "workplaceShown", "listedRole", "headerOccupation", "roleLine", "headline", "workLine", "occupationShown"):
        value = profile.get(key)
        found = re.match(r"^.+?\s+at\s+(?P<org>.+)$", value.strip(), re.I) if isinstance(value, str) else None
        if found and not re.fullmatch(r"[\d\W]+", found.group("org")):
            return found.group("org").strip()
    return None


def location_of(profile: dict) -> str | None:
    for key in ("location", "listedLocation", "headerLocation", "locationLine", "locationShown", "country"):
        if isinstance(profile.get(key), str) and profile[key].strip():
            return profile[key].strip()
    return None


def year_of(title: str, url: str, exact: str | None) -> int | None:
    """An exact completion date wins, then a year in the title, then in the slug; nothing else counts."""
    if exact:
        try:
            return datetime.strptime(" ".join(exact.split()[:4]), "%a %b %d %Y").year
        except ValueError:
            found = YEAR.search(exact)
            if found:
                return int(found.group(1))
    for text in (title or "", (url or "").rstrip("/").split("/")[-1]):
        found = YEAR.search(text)
        if found:
            return int(found.group(1))
    return None


def sources() -> dict:
    """personId -> normalised evidence, from the careers folder and the two earlier proof files."""
    found = {}
    for path in sorted(EVIDENCE.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("verified") is not True:
            continue
        found[data["personId"]] = {"handle": data.get("handle"), "checkedAt": data["checkedAt"], "profile": data["profile"],
                                   "rows": data.get("completedResults", [])}
    son = json.loads((PROOFS / "son-kaggle-history-evidence.json").read_text(encoding="utf-8"))
    found.setdefault(son["personId"], {"handle": son["handle"], "checkedAt": son["checkedAt"], "profile": son["profile"], "rows": son["completedResults"]})
    mark = json.loads((PROOFS / "mark-kaggle-history-evidence.json").read_text(encoding="utf-8"))
    found.setdefault(mark["personId"], {
        "handle": mark["handle"], "checkedAt": mark["checkedAt"],
        "profile": {"competitionTier": None, "medals": None, "joinedMonth": mark["joined"][:7]},
        "rows": [{"competition": r["title"], "competitionUrl": r["url"], "rank": r["rank"], "teams": r["teams"], "medal": r.get("medalShown"),
                  "teamName": None, "exactCompletionDate": None} for r in mark["completedCompetitions"]]})
    return found


def career(evidence: dict) -> dict:
    profile = evidence["profile"]
    joined = str(profile.get("joinedMonth") or "")[:4]
    return {
        "checkedAt": evidence["checkedAt"],
        "profileUrl": f"https://www.kaggle.com/{evidence['handle']}",
        "tier": tier_of(profile.get("competitionTier")),
        "medals": medals_of(profile),
        "rank": ({"current": profile.get("competitionRank"), "outOf": profile.get("competitionRankOutOf"), "best": profile.get("highestCompetitionRank")}
                 if profile.get("competitionRank") else None),
        "joinedYear": int(joined) if joined.isdigit() else None,
        "organisation": organisation_of(profile),
        "location": location_of(profile),
        # Kaggle lists newest first and the evidence keeps that order; a card back may re-sort.
        "rows": [{"year": year_of(row["competition"], row["competitionUrl"], row.get("exactCompletionDate")), "competition": row["competition"],
                  "competitionUrl": row["competitionUrl"], "team": row.get("teamName") or None, "rank": row["rank"], "fieldSize": row["teams"],
                  "medal": medal_of(row.get("medal"))} for row in evidence["rows"]],
    }


def main() -> int:
    careers = {pid: career(evidence) for pid, evidence in sorted(sources().items())}
    text = json.dumps({"version": 1, "careers": careers}, indent=1, ensure_ascii=False) + "\n"
    if "--check" in sys.argv:
        if not OUT.is_file() or OUT.read_text(encoding="utf-8") != text:
            print("content/news/careers.json is stale: run python3.13 scripts/build_card_careers.py")
            return 1
        print("careers.json is current")
        return 0
    OUT.write_text(text, encoding="utf-8")
    tiers = {}
    for item in careers.values():
        tiers[item["tier"]] = tiers.get(item["tier"], 0) + 1
    print(f"wrote {OUT.relative_to(ROOT)}: {len(careers)} careers, tiers {tiers}, rows {sum(len(c['rows']) for c in careers.values())}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
