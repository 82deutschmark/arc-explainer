"""
Author: Claude Opus 5.5
Date: 2026-10-15
PURPOSE: Turns the checked manuscript docs/2026-10-15-argon-shouts-scored-article.md into the ARC Daily Digest
  dispatch draft docs/2026-10-15-argon-shouts-scored-dispatch-draft.json, so the published words are exactly the
  words whose quotes data/argon-vs-haiku/verify_quotes.py checked. It strips the [argon ...] quote tags and the
  model's markdown backticks and bold marks, attaches sources, the chart (outburst_chart.py) and the credits, and
  checks every section against scripts/newsroom.py's dispatch rules. Publish with
  `python3.13 scripts/newsroom.py dispatch-publish --draft docs/2026-10-15-argon-shouts-scored-dispatch-draft.json`.
SRP/DRY check: Pass -- validation is newsroom.validate_dispatch itself; this file only assembles the draft.
"""
import json, re, sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import newsroom  # noqa: E402

MANUSCRIPT = ROOT / "docs" / "2026-10-15-argon-shouts-scored-article.md"
DRAFT = ROOT / "docs" / "2026-10-15-argon-shouts-scored-dispatch-draft.json"
READ_AT = "2026-10-15T22:00:00Z"  # when the replays and Google's pages were read for this story
REPLAY = "https://arcprize.org/replay/"
SOURCES = [
    ("results", "ARC Prize: Gemini 4 Argon results", "https://arcprize.org/results/google-gemini-4-argon"),
    ("first-dispatch", "ARC Daily Digest: Mind Blown, 532 Times (15 October)",
     "https://arc.markbarney.net/news#2026-10-15-gemini-4-argon-mind-blown"),
    ("sk48-medium", "Replay: sk48, standard harness, medium", REPLAY + "e3ab3eb6-f9de-4735-ac7d-b9681b247500"),
    ("m0r0-low", "Replay: m0r0, standard harness, low", REPLAY + "d8379bc2-fcb1-4d8c-aba3-a7e2654d0e77"),
    ("dc22-high", "Replay: dc22, standard harness, high", REPLAY + "08fc7dc2-d279-481a-9d5d-226c1d741110"),
    ("sc25-medium", "Replay: sc25, standard harness, medium", REPLAY + "47db246e-5cbe-4130-b3fb-ee46b3763bef"),
    ("wa30-low", "Replay: wa30, standard harness, low", REPLAY + "5f474a31-e86a-49f9-9759-27fd4aa2fd6e"),
    ("bp35-low", "Replay: bp35, standard harness, low", REPLAY + "c127733d-8027-43a8-a493-6e94173a9dbb"),
    ("lp85-medium", "Replay: lp85, standard harness, medium", REPLAY + "bebf4051-2ec1-467e-95a2-61cda057239d"),
    ("s5i5-medium", "Replay: s5i5, standard harness, medium", REPLAY + "4050a5b4-4840-47d2-b793-95e3eed68f31"),
    ("lf52-low", "Replay: lf52, standard harness, low", REPLAY + "cf635aee-a094-4e01-be2c-c80382464c28"),
    ("lf52-medium", "Replay: lf52, standard harness, medium", REPLAY + "fbd4dfe0-199f-4b79-9764-4c1e548e4fa3"),
    ("bp35-medium", "Replay: bp35, standard harness, medium", REPLAY + "f241a636-5d84-4eeb-8334-303eaec5f190"),
    ("ls20-low", "Replay: ls20, standard harness, low", REPLAY + "e5b931aa-9111-49c7-bf49-26fa9c46a88d"),
    ("g50t-medium", "Replay: g50t, standard harness, medium", REPLAY + "0a22fda2-0fb1-4e3c-9a77-c4f9b12723a0"),
    ("ka59-medium", "Replay: ka59, standard harness, medium", REPLAY + "0a0bfb85-24a7-4eb1-a3e7-82fc5cdaa581"),
    ("ft09-low", "Replay: ft09, standard harness, low", REPLAY + "3cda9213-f41a-44af-9962-a5eda18aeb16"),
    ("ar25-adapter", "Replay: ar25, Provider Adapter, high", REPLAY + "5e3e2989-204f-45b4-bc41-0cb82997e2f7"),
    ("cd82-adapter", "Replay: cd82, Provider Adapter, medium", REPLAY + "0b2f36da-44ef-414f-a2de-1a0322d0cedb"),
    ("s5i5-adapter", "Replay: s5i5, Provider Adapter, medium", REPLAY + "98ff4503-7854-4ae8-9439-8a9eb15c822f"),
    ("google-thinking", "Google: Gemini thinking (thought summaries and signatures)",
     "https://ai.google.dev/gemini-api/docs/interactions/thinking.md.txt"),
]
SECTION_SOURCES = [
    ["results", "sk48-medium", "first-dispatch"],
    ["m0r0-low"],
    ["dc22-high", "sc25-medium", "wa30-low", "bp35-low", "results"],
    ["wa30-low", "lp85-medium", "s5i5-medium", "results", "first-dispatch"],
    ["lf52-low", "lf52-medium", "bp35-medium", "ls20-low", "g50t-medium", "dc22-high", "ka59-medium", "ft09-low",
     "ar25-adapter", "cd82-adapter", "s5i5-adapter", "google-thinking"],
]
IMAGE = dict(
    src="/news-images/2026-10-15-argon-shouts-chart.png",
    alt=("Chart. Top: what became of each MIND BLOWN, BINGO, EUREKA or WHOA shout. Standard harness, 1,224 shouts: "
         "16% were the last shout before the level fell, 48% were followed by another shout first, 36% came on a "
         "level never beaten. Provider Adapter, 174 shouts: 56%, 42% and 2%. Bottom, standard harness: how often a "
         "level fell within 10 moves. Any move 13.6%, WHOA 6.3%, BINGO 5.7%, WAIT A SECOND 5.1%, MIND BLOWN 4.4%, "
         "HOLD EVERYTHING 3.4%, EUREKA 2.0%."),
    caption=("What happened after Argon said it had cracked it. Chart by the ARC Daily Digest from ARC Prize's 150 "
             "public replays; some standard-harness runs were cut short by API errors or move limits."),
)
EDITOR_NOTE = (
    "Written by Claude Opus 5.5 at the head editor's request, as an in-depth follow-up to the paper's first Argon "
    "dispatch, from ARC Prize's 150 public Gemini 4 Argon replays. Quotes are the model's visible answer text, "
    "except three lines named as Google's thinking summaries; none is hidden thinking. Every quote was checked by "
    "script against the replay step it came from, and every count can be reproduced with "
    "data/gemini-4-argon-traces/outburst_outcomes.py. The model's claimed discoveries were not checked against game code.")
INTERPRETATION = (
    "Argon's shouts mark the moment it changes its theory of a game, usually early in a hard level, rather than the "
    "moment it is about to win: in the standard harness about one in six was the last shout it needed. Under the "
    "Provider Adapter, which keeps its reasoning between moves, more than half were. That points at memory more than "
    "mood. A reading of public replays, not checked against game code.")


def prose(text):
    text = re.sub(r"\s*\[argon [\w-]+ [0-9a-f]{8} step \d+\]", "", text)
    return re.sub(r"\s+", " ", text.replace("**", "").replace("`", "")).strip()


def main():
    md = MANUSCRIPT.read_text(encoding="utf-8")
    md = re.sub(r"<!--.*?-->", "", md, flags=re.S)
    headline = re.search(r"^# (.+)$", md, re.M).group(1).strip()
    body = md.split("\n## Notes for the desk", 1)[0]
    parts = re.findall(r"^## (.+?)\n+(.+?)(?=\n## |\Z)", body, re.M | re.S)
    if len(parts) != len(SECTION_SOURCES):
        raise SystemExit(f"expected {len(SECTION_SOURCES)} sections, found {len(parts)}")
    published = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    draft = dict(
        commissionedBy="mark-barney",
        competition="arc-3",
        editorNote=EDITOR_NOTE,
        generatedBy="claude-opus-5-5",
        headline=headline,
        id="2026-10-15-gemini-4-argon-shouts-scored",
        image=IMAGE,
        interpretation=INTERPRETATION,
        publishedAt=published,
        sections=[dict(heading=h.strip(), sourceIds=ids, text=prose(t)) for (h, t), ids in zip(parts, SECTION_SOURCES)],
        sources=[dict(accessedAt=READ_AT, id=i, title=title, url=url) for i, title, url in SOURCES],
    )
    for s in draft["sections"]:
        print(f"{len(s['text']):5d} chars  {s['heading']}")
    newsroom.validate_dispatch(draft)
    DRAFT.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("valid draft:", DRAFT.relative_to(ROOT), "publishedAt", published)


if __name__ == "__main__":
    main()
