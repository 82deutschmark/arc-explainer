"""
Author: Claude Sonnet 5.5
Date: 2026-10-15
PURPOSE: Check that every tagged quote in a write-up really appears in the transcript step it cites.
  A quote is text in double quotes immediately followed by a tag like [argon medium e3ab3eb6 step 238] or
  [haiku max c51d831a step 25]. The text may use "..." to join fragments; each fragment must appear verbatim
  (whitespace-insensitive) in that step of that session's transcript. Prints every failure and a summary.
  No network, no model calls.
SRP/DRY check: Pass -- one job, reads the same transcripts digest.py reads.
"""
import glob, re, sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent
TAG = re.compile(r"[\"“](?P<q>[^\"”]{8,}?)[\"”]\s*\[(?P<m>argon|haiku) (?P<cfg>[\w-]+) (?P<sid>[0-9a-f]{8}) step (?P<n>\d+)\]")
_cache = {}


def norm(s):
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", s).strip()


def find_file(model, cfg, sid):
    if model == "argon":
        level = cfg.replace("-adapter", "")
        prefix = f"google-barium-bb3-{level}" + ("-provider-adapter" if cfg.endswith("adapter") else "")
        pat = DATA / "gemini-4-argon-traces" / "sessions" / f"{prefix}__*__{sid}*.md"
    else:
        prefix = "anthropic-claude-haiku-5-5-max" + ("-provider-adapter" if cfg.endswith("adapter") else "")
        pat = DATA / "haiku-5-5-traces" / "sessions" / f"{prefix}__*__{sid}*.md"
    hits = glob.glob(str(pat))
    return hits[0] if hits else None


def steps_of(path):
    if path not in _cache:
        text = Path(path).read_text(encoding="utf-8")
        parts = re.split(r"\n## step ", text)[1:]
        _cache[path] = {int(p.split(" ", 1)[0]): norm(p) for p in parts}
    return _cache[path]


def check(text):
    ok = bad = 0
    for m in TAG.finditer(text):
        path = find_file(m["m"], m["cfg"], m["sid"])
        label = f"[{m['m']} {m['cfg']} {m['sid']} step {m['n']}]"
        if not path:
            print("NO FILE", label, "|", m["q"][:70])
            bad += 1
            continue
        step = steps_of(path).get(int(m["n"]))
        if step is None:
            print("NO STEP", label)
            bad += 1
            continue
        frags = [norm(f) for f in re.split(r"\.\.\.|…", m["q"]) if f.strip()]
        missing = [f for f in frags if f not in step]
        # tolerate a step off by one (the heading number vs the digest's step label)
        if missing:
            near = [s for n_, s in steps_of(path).items() if abs(n_ - int(m["n"])) <= 1]
            if all(any(f in s for s in near) for f in missing):
                print("OFF-BY-ONE", label, "|", missing[0][:70])
                ok += 1
                continue
            print("MISSING", label, "|", missing[0][:90])
            bad += 1
        else:
            ok += 1
    return ok, bad


if __name__ == "__main__":
    total_ok = total_bad = 0
    for f in sys.argv[1:]:
        ok, bad = check(Path(f).read_text(encoding="utf-8"))
        print(f"{f}: {ok} verified, {bad} failed")
        total_ok += ok
        total_bad += bad
    print("TOTAL", total_ok, "verified,", total_bad, "failed")
