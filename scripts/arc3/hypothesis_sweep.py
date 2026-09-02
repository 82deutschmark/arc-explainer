"""
Author: Claude Opus 5
Date: 01-September-2026
PURPOSE: Ask a locally served vision model to hypothesise about the rules of our synthetic
         ARC-AGI-3 games, many times per game, across a grid of sampler settings, and write
         one self-describing JSONL row per run. The research question is not whether any one
         answer is right; it is how much the *spread* of hypotheses moves with decoding
         parameters. See docs/plans/2026-09-01-arc3-hypothesis-sweep-plan.md.

         Runs unchanged on the MSI Katana (Windows) and the Mac Mini. Machine-local state -
         server port, which model is loaded, quantisation, offload - is discovered at run time
         and recorded on every row, because none of it travels with a checkout.

         Integration points:
           - server/python/community_game_thumbnail.py renders one opening frame per game
             (invoked as a subprocess with PYTHONPATH pointing at external/ARCEngine). It is
             reused unchanged rather than reimplemented; it issues a single RESET and never
             advances a game, so this cannot pollute human-play telemetry.
           - server/data/arc3-games/*.py are the game sources.
           - server/services/arc3Mirror/arc3Triage.json supplies --games queued, the 36 games
             that survived the random-play entry gate.
           - scripts/arc3/hypothesis_prompts.py supplies the prompt variants.

         Dependencies: Python 3.12 (arcengine requires it), Pillow (for the renderer), and the
         standard library only for this file - no openai SDK, no requests, so a cold machine
         needs no pip install beyond what the renderer already needs.
SRP/DRY check: Pass - orchestration and record-keeping only. Frame rendering belongs to the
         thumbnail script, prompt text to hypothesis_prompts.py, and analysis to
         hypothesis_report.py. Request/record conventions (resumability, prompt-token guard,
         complete error records, full sampler config on every row) follow the established
         harness in C:/Projects/G0DM0D3-research/research/run_prompt.py rather than inventing
         a second style.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import platform
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hypothesis_prompts  # noqa: E402

# The Windows console defaults to cp1252 and raises on most non-ASCII model output. Progress
# lines here echo server error strings, which can carry it. Results themselves are written as
# UTF-8 JSONL and are unaffected by this.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

REPO_ROOT = Path(__file__).resolve().parents[2]
GAMES_DIR = REPO_ROOT / "server" / "data" / "arc3-games"
THUMBNAIL_SCRIPT = REPO_ROOT / "server" / "python" / "community_game_thumbnail.py"
ARCENGINE_PATH = REPO_ROOT / "external" / "ARCEngine"
TRIAGE_FILE = REPO_ROOT / "server" / "services" / "arc3Mirror" / "arc3Triage.json"
DEFAULT_OUT_DIR = REPO_ROOT / "data" / "arc3-hypothesis-sweep"

# Ports seen in the wild. 9099 is what the Katana actually served on 01-Sep-2026; 1234 is the
# documented default and was closed. Order matters only for speed, not correctness.
CANDIDATE_PORTS = (9099, 1234)

# A request can legitimately take ten minutes on a partially offloaded 27B model.
REQUEST_TIMEOUT_S = 1800

# Reasoning effort is the ONLY lever that reaches the chat template over HTTP on this server,
# and what it does is not what the name suggests. Probed directly on the Katana against
# qwen3.8-27b, 01-Sep-2026, with a fixed 64-token prompt; only prompt_tokens moved, which means
# the effect is entirely a rewrite of the rendered prompt:
#
#   effort sent        prompt_tokens   what the template did
#   (nothing) / xhigh       64         injects "think carefully, validate assumptions, ..."
#   high                    64         normalised to xhigh
#   low / minimal           52         injects "keep your thinking brief and focused ..."
#   medium                  26         injects NOTHING - the neutral case
#   none                    28         enable_thinking=false; empty <think></think>, no reasoning
#
# So "effort" on this model is a sentence added to the system prompt, not a decode-time budget,
# and `low` is an instruction to be brief that would ride along in every cell using it. MEDIUM
# is the honest "thinking on" setting because it adds no text at all. This matters: a comparison
# of low against none confounds a thinking switch with a prompt edit.
#
# `chat_template_kwargs` - top level, nested, either key - is accepted and ignored (still 64).
NEUTRAL_EFFORT = "medium"
EFFORT_CHOICES = ("none", "low", "medium", "xhigh")

# Rough per-run wall time, used only by --dry-run to size a night. Wrong on other hardware; it
# estimates a budget, it does not enforce one.
# Measured on the Katana at 512px: none 119-215s (n=3), medium 203s (n=1, 600 reasoning
# tokens, finishing naturally well under the ceiling). Reasoning turned
# out far cheaper than the 3500-token ceiling allows for, so these sit deliberately above
# what was observed - a plan that finishes early is better than one that overruns a night.
EST_SECONDS = {"none": 240, "low": 320, "medium": 320, "xhigh": 480}

# Named nights. Both are resumable and replicate-major, so either can be stopped at any point
# and what exists is balanced across cells rather than lopsided.
PLANS = {
    # Settles the question that started this: is the difference between a coherent answer and
    # word salad about thinking, about temperature, or about neither? One game, held constant.
    "confound": {"games": ["queued:1"], "efforts": ["none", NEUTRAL_EFFORT],
                 "temps": [0.7, 1.0], "n": 8},
    # The Boss's actual interest: the same treatment across many games, to see the range of
    # readings rather than the variance on one board. Thinking off, because it is 2.5x cheaper
    # per sample and breadth is what this plan buys.
    "breadth": {"games": ["queued:8"], "efforts": ["none"], "temps": [1.0], "n": 4},
}

# Catches a server-side system prompt being injected behind our back. The earlier sampler work
# lost real time to LM Studio silently inserting 1789 tokens when the system role was omitted.
# Measured on the Katana, 512px frame, qwen3.8-27b, v2_five prompt: 347 (none), 345 (medium),
# 383 (effort unset, where the template injects its xhigh instruction). The ceiling sits well
# above all three and still catches an injection of that size by a wide margin. It scales with
# the prompt and the image, so re-run --calibrate after changing either.
# Raise this ONLY after measuring with --calibrate. Never raise it to silence an abort: the
# abort is the entire point.
DEFAULT_MAX_PROMPT_TOKENS = 1000


# ---------------------------------------------------------------------------
# Server discovery. Nothing about the server is assumed; all of it is recorded.
# ---------------------------------------------------------------------------

def _get_json(url: str, timeout: int = 10):
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def discover_base_url(explicit: str | None) -> str:
    """Return an OpenAI-compatible base URL ending in /v1, probing candidate ports if needed."""
    if explicit:
        return explicit.rstrip("/")
    env = os.environ.get("LM_STUDIO_URL")
    if env:
        return env.rstrip("/")
    for port in CANDIDATE_PORTS:
        try:
            _get_json(f"http://localhost:{port}/api/v0/models", timeout=4)
            return f"http://localhost:{port}/v1"
        except Exception:
            continue
    raise SystemExit(
        "No LM Studio server found on ports "
        + ", ".join(str(p) for p in CANDIDATE_PORTS)
        + ". Start one, or pass --base-url / set LM_STUDIO_URL. "
        "`lms status` reports the port it is actually serving on."
    )


def loaded_model(base_url: str, want: str | None) -> dict:
    """
    Return metadata for a model that is actually loaded.

    Uses /api/v0/models because it reports load state, which /v1/models does not. This never
    loads or unloads anything: each load call creates another VRAM instance, and loading on top
    of an already-resident large model will take the machine down. Load a model in LM Studio
    first; this aborts if nothing is resident.
    """
    root = base_url.rsplit("/v1", 1)[0]
    try:
        models = _get_json(f"{root}/api/v0/models").get("data", [])
    except Exception as exc:
        raise SystemExit(f"Could not list models at {root}/api/v0/models: {exc}")

    live = [m for m in models if m.get("state") == "loaded"]
    if not live:
        raise SystemExit(
            "No model is loaded. Load one in LM Studio before running.\n"
            "This script will not load one for you: an extra load allocates a second VRAM "
            "instance and can crash the machine."
        )
    if want:
        for m in live:
            if m.get("id") == want:
                return m
        raise SystemExit(
            f"Model {want!r} is not loaded. Loaded: {', '.join(m.get('id', '?') for m in live)}"
        )
    if len(live) > 1:
        raise SystemExit(
            "More than one model is loaded; name one with --model so the run is unambiguous: "
            + ", ".join(m.get("id", "?") for m in live)
        )
    return live[0]


# ---------------------------------------------------------------------------
# Stimulus
# ---------------------------------------------------------------------------

def render_frame(game_id: str, out_dir: Path, size: int) -> Path:
    """
    Render (and cache) one game's opening frame as a PNG.

    Delegates to server/python/community_game_thumbnail.py, which loads the game the same way
    the site does, issues one RESET and paints the first frame with the canonical ARC-3 palette.
    """
    out_path = out_dir / f"{game_id}@{size}.png"
    if out_path.exists() and out_path.stat().st_size > 0:
        return out_path

    source = GAMES_DIR / f"{game_id}.py"
    if not source.exists():
        raise SystemExit(f"No game source at {source}")
    if not ARCENGINE_PATH.exists():
        raise SystemExit(
            f"{ARCENGINE_PATH} is missing. Run: git submodule update --init external/ARCEngine"
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    env["PYTHONPATH"] = os.pathsep.join(
        [str(ARCENGINE_PATH), env.get("PYTHONPATH", "")]
    ).rstrip(os.pathsep)

    result = subprocess.run(
        [sys.executable, str(THUMBNAIL_SCRIPT), "--file", str(source), str(out_path), str(size)],
        capture_output=True,
        text=True,
        env=env,
        timeout=120,
    )
    if result.returncode != 0 or not out_path.exists():
        raise SystemExit(
            f"Rendering {game_id} failed.\nstdout: {result.stdout.strip()}\n"
            f"stderr: {result.stderr.strip()}"
        )
    return out_path


def data_url(png_path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(png_path.read_bytes()).decode("ascii")


def frame_sha(png_path: Path) -> str:
    """
    Hash of the exact bytes sent to the model.

    The decisive cross-machine check. The two boxes can legitimately sit on different ARCEngine
    commits - on 01-Sep the Katana was on e243421 while the repository recorded 653c3ee - and a
    different engine could in principle paint a different opening frame, which would make the
    two machines' rows incomparable without anything in the data saying so. Two hosts showing
    the same hash for a game id proves they looked at an identical image; two different hashes
    say the comparison is between stimuli, not between models.
    """
    return hashlib.sha256(png_path.read_bytes()).hexdigest()[:16]


def arcengine_revision() -> str:
    """The engine commit that rendered the frames, plus a dirty marker if it has local edits."""
    try:
        head = subprocess.run(
            ["git", "-C", str(ARCENGINE_PATH), "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=15,
        )
        if head.returncode != 0:
            return "unknown"
        revision = head.stdout.strip()
        dirty = subprocess.run(
            ["git", "-C", str(ARCENGINE_PATH), "status", "--porcelain"],
            capture_output=True, text=True, timeout=15,
        )
        return revision + ("+dirty" if dirty.stdout.strip() else "")
    except Exception:
        return "unknown"


def queued_game_ids() -> list[str]:
    """
    Our authored games that cleared the random-play entry gate, in triage rank order.

    The 14 marked `weak` are excluded: a game a button-masher can beat is a poor stimulus for
    a question about inferring rules.
    """
    if not TRIAGE_FILE.exists():
        raise SystemExit(f"Triage file not found at {TRIAGE_FILE}")
    triage = json.loads(TRIAGE_FILE.read_text(encoding="utf-8"))
    ours = [
        g
        for g in triage.get("games", [])
        if str(g.get("gameId", "")).startswith("t") and g.get("status") == "queued"
    ]
    ours.sort(key=lambda g: g.get("rank", 10**6))
    return [g["gameId"] for g in ours]


# ---------------------------------------------------------------------------
# One request
# ---------------------------------------------------------------------------

def build_body(model_id: str, prompts: dict, image: str, cell: dict, max_tokens: int) -> dict:
    """
    Assemble a chat-completions body.

    Two things here are not cosmetic:

    * The system role is ALWAYS sent, even when its content is empty. Omitting the role lets
      LM Studio substitute its own configured prompt, which is invisible in every field except
      the token count.
    * `reasoning_effort` is ALWAYS sent explicitly, never omitted. It is the only field that
      reaches the chat template over HTTP here - `chat_template_kwargs`, a top-level
      `enable_thinking`, a `reasoning` object and a `/no_think` suffix are all accepted and
      ignored (tested 01-Sep-2026; see the table at the top of this file). Omitting it does not
      mean "default", it means the template's own default of `xhigh`, which silently injects a
      think-carefully instruction into the system prompt. There is a known LM Studio bug where
      a GUI Custom Field overrides the API value (lmstudio-ai/lmstudio-bug-tracker#988, v0.3.25).
      It does NOT apply to this build - probed by sending no field and getting the template
      default rather than the GUI's configured `low` - but the preflight re-checks it per
      machine rather than trusting that, because it is exactly the kind of invisible
      server-side state that silently confounds a whole night.
    """
    body = {
        "model": model_id,
        "messages": [
            {"role": "system", "content": prompts["system"]},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompts["user"]},
                    {"type": "image_url", "image_url": {"url": image}},
                ],
            },
        ],
        "temperature": cell["temperature"],
        "top_p": cell["top_p"],
        "max_tokens": max_tokens,
        "stream": False,
        "reasoning_effort": cell["reasoning_effort"],
    }
    extra = {
        "top_k": cell["top_k"],
        "min_p": cell["min_p"],
        "repeat_penalty": cell["repeat_penalty"],
        "presence_penalty": cell["presence_penalty"],
    }
    # 0 is the disable value for top_k and min_p and must reach the server, so filter on
    # `is None` rather than on falsiness.
    body.update({k: v for k, v in extra.items() if v is not None})
    return body


def call_model(base_url: str, body: dict) -> tuple[dict, int]:
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.time()
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_S) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload, int((time.time() - started) * 1000)


# ---------------------------------------------------------------------------
# Grid
# ---------------------------------------------------------------------------

def cell_key(game_id: str, cell: dict, replicate: int) -> str:
    """Identity of a single run, used for resumability and for grouping at analysis time."""
    return (
        f"{game_id}|{cell['prompt_variant']}|{cell['stimulus_form']}|{cell['image_px']}|"
        f"t{cell['temperature']}|k{cell['top_k']}|p{cell['top_p']}|m{cell['min_p']}|"
        f"rp{cell['repeat_penalty']}|pp{cell['presence_penalty']}|"
        f"effort{cell['reasoning_effort']}|r{replicate}"
    )


def build_cells(args) -> list[dict]:
    cells = []
    for effort in args.efforts:
        for temperature in args.temps:
            for top_k in args.top_ks:
                cells.append(
                    {
                        "prompt_variant": args.prompt_variant,
                        "stimulus_form": "bare_frame",
                        "image_px": args.image_px,
                        "temperature": temperature,
                        "top_k": top_k,
                        "top_p": args.top_p,
                        "min_p": args.min_p,
                        "repeat_penalty": args.repeat_penalty,
                        "presence_penalty": args.presence_penalty,
                        "reasoning_effort": effort,
                        # Derived, and recorded so a row states plainly whether reasoning was
                        # expected. `none` is the only setting that turns it off.
                        "thinking": "off" if effort == "none" else "on",
                    }
                )
    return cells


def completed_keys(path: Path) -> set[str]:
    """Read back what already succeeded so an interrupted night resumes where it stopped."""
    done: set[str] = set()
    if not path.exists():
        return done
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue  # a row torn by a hard kill; the run is simply redone
            if row.get("ok") and row.get("run_key"):
                done.add(row["run_key"])
    return done


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Sample a local vision model's hypotheses about ARC-AGI-3 game frames.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--plan", choices=sorted(PLANS), default=None,
                        help="A named night: 'confound' (one game, thinking and temperature "
                             "crossed) or 'breadth' (eight games, one cell). Sets --games, "
                             "--efforts, --temps and --n; anything given explicitly still wins.")
    parser.add_argument("--games", nargs="+", default=None,
                        help="Game ids, or 'queued:N' for the top N by triage rank.")
    parser.add_argument("--n", type=int, default=None,
                        help="Replicates per cell. The point of the exercise; do not set 1.")
    parser.add_argument("--temps", nargs="+", type=float, default=None)
    parser.add_argument("--efforts", nargs="+", default=None, choices=EFFORT_CHOICES,
                        help="Reasoning effort per cell. 'none' is thinking off; 'medium' is "
                             "thinking on with NO instruction added to the prompt, and is the "
                             "honest comparison against 'none'. 'low' and 'xhigh' each inject a "
                             "sentence telling the model how hard to think, which is a prompt "
                             "edit riding along inside what looks like a sampler setting.")
    parser.add_argument("--top-ks", nargs="+", type=int, default=[500])
    parser.add_argument("--top-p", type=float, default=1.0)
    parser.add_argument("--min-p", type=float, default=0.0, help="0 disables the floor.")
    parser.add_argument("--repeat-penalty", type=float, default=1.0, help="1.0 is neutral.")
    parser.add_argument("--presence-penalty", type=float, default=0.0)
    parser.add_argument("--prompt-variant", default=hypothesis_prompts.DEFAULT_VARIANT,
                        choices=sorted(hypothesis_prompts.PROMPTS))
    parser.add_argument("--image-px", type=int, default=512)
    parser.add_argument("--max-tokens", type=int, default=None,
                        help="Default: 1500 thinking off, 3500 on. A thinking run at 1200 spent "
                             "every token on reasoning and returned EMPTY content.")
    parser.add_argument("--max-prompt-tokens", type=int, default=DEFAULT_MAX_PROMPT_TOKENS,
                        help="Abort if a prompt exceeds this. Guards against server-side prompt "
                             "injection. Raise only after measuring with --calibrate.")
    parser.add_argument("--base-url", default=None)
    parser.add_argument("--model", default=None, help="Required if several models are loaded.")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--tag", default="", help="Appended to the results filename.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print the grid and a time estimate; call nothing.")
    parser.add_argument("--calibrate", action="store_true",
                        help="One 1-token request per effort level; report prompt_tokens and "
                             "whether reasoning actually followed. Run this on a new machine.")
    args = parser.parse_args(argv)

    # A plan fills in only what was not asked for explicitly, so `--plan breadth --n 8` means
    # what it looks like it means.
    plan = PLANS[args.plan] if args.plan else {}
    for field in ("games", "efforts", "temps", "n"):
        if getattr(args, field) is None:
            setattr(args, field, plan.get(field))
    args.games = args.games or ["queued:1"]
    args.efforts = args.efforts or ["none", NEUTRAL_EFFORT]
    args.temps = args.temps or [0.7, 1.0]
    args.n = args.n if args.n is not None else 8
    return args


def resolve_games(spec: list[str]) -> list[str]:
    if len(spec) == 1 and spec[0].startswith("queued"):
        _, _, count = spec[0].partition(":")
        ids = queued_game_ids()
        return ids[: int(count)] if count else ids
    return spec


def main(argv=None) -> int:
    args = parse_args(argv)
    games = resolve_games(args.games)
    cells = build_cells(args)
    prompts = hypothesis_prompts.get(args.prompt_variant)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = args.out_dir / "frames"
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    suffix = f"_{args.tag}" if args.tag else ""
    results_path = args.out_dir / f"hypotheses_{socket.gethostname().lower()}{suffix}.jsonl"

    total = len(games) * len(cells) * args.n
    print(f"games {len(games)}  cells {len(cells)}  n {args.n}  ->  {total} runs")
    for cell in cells:
        est = EST_SECONDS[cell["reasoning_effort"]] * len(games) * args.n
        print(
            f"  effort={cell['reasoning_effort']:<6} temp={cell['temperature']:<4} "
            f"top_k={cell['top_k']:<4} ~{est / 3600:.1f}h"
        )
    grand = sum(EST_SECONDS[c["reasoning_effort"]] for c in cells) * len(games) * args.n
    print(f"  estimated total ~{grand / 3600:.1f}h (Katana rates; re-measure elsewhere)")
    print(f"  results -> {results_path}")

    if args.dry_run:
        print("\ndry run: nothing called.")
        return 0

    base_url = discover_base_url(args.base_url)
    model = loaded_model(base_url, args.model)
    model_id = model.get("id")
    print(f"\nserver {base_url}")
    print(
        f"model  {model_id}  quant={model.get('quantization')} "
        f"ctx={model.get('max_context_length')} arch={model.get('arch')}"
    )

    print("\nrendering frames...")
    frame_paths = {g: render_frame(g, frames_dir, args.image_px) for g in games}
    images = {g: data_url(path) for g, path in frame_paths.items()}
    frame_hashes = {g: frame_sha(path) for g, path in frame_paths.items()}
    engine = arcengine_revision()
    print(f"  {len(images)} frame(s) ready in {frames_dir}")
    print(f"  arcengine {engine}")

    if args.calibrate:
        return calibrate(base_url, model_id, prompts, args, images[games[0]], cells)

    done = completed_keys(results_path)
    if done:
        print(f"\nresuming: {len(done)} run(s) already complete, skipping those")

    host_info = {
        "host": socket.gethostname(),
        "platform": f"{platform.system()} {platform.release()}",
        "python": platform.python_version(),
    }
    static = {
        "arcengine_revision": engine,
        "model_id": model_id,
        "quantization": model.get("quantization"),
        "context_length": model.get("max_context_length"),
        "prompt_variant": args.prompt_variant,
        "system_prompt_sha": hypothesis_prompts.sha(prompts["system"]),
        "user_prompt_sha": hypothesis_prompts.sha(prompts["user"]),
        "run_started": stamp,
        **host_info,
    }

    # Replicate-major ordering. A night that only gets 60% through then leaves every cell with
    # roughly equal n, instead of three complete cells and one untouched. Balanced-but-short
    # beats complete-but-lopsided for every question this experiment asks.
    schedule = [
        (game, cell, replicate)
        for replicate in range(args.n)
        for game in games
        for cell in cells
    ]

    baseline_prompt_tokens: dict[tuple[str, str], int] = {}
    completed = skipped = failed = 0
    started_at = time.time()

    with results_path.open("a", encoding="utf-8") as sink:
        for index, (game, cell, replicate) in enumerate(schedule, start=1):
            key = cell_key(game, cell, replicate)
            if key in done:
                skipped += 1
                continue

            max_tokens = args.max_tokens or (1500 if cell["thinking"] == "off" else 3500)
            body = build_body(model_id, prompts, images[game], cell, max_tokens)
            label = (
                f"[{index}/{len(schedule)}] {game} effort={cell['reasoning_effort']} "
                f"t={cell['temperature']} k={cell['top_k']} r{replicate}"
            )
            print(label, end=" ", flush=True)

            row = {
                **static,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "run_key": key,
                "game_id": game,
                "frame_sha": frame_hashes[game],
                "replicate": replicate,
                "max_tokens": max_tokens,
                **{
                    k: cell[k]
                    for k in (
                        "stimulus_form", "image_px", "temperature", "top_k", "top_p", "min_p",
                        "repeat_penalty", "presence_penalty", "thinking", "reasoning_effort",
                    )
                },
            }

            try:
                payload, elapsed_ms = call_model(base_url, body)
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
                # A failed run is recorded with its full configuration. An error line that
                # cannot be reconstructed from itself is not a log, it is a rumour.
                row.update({"ok": False, "error": str(exc)[:500], "error_type": type(exc).__name__})
                sink.write(json.dumps(row) + "\n")
                sink.flush()
                failed += 1
                print("ERROR", str(exc)[:80])
                continue
            except KeyboardInterrupt:
                print("\ninterrupted; results so far are on disk and the run is resumable.")
                break

            message = payload["choices"][0]["message"]
            usage = payload.get("usage", {})
            prompt_tokens = usage.get("prompt_tokens", 0)
            content = message.get("content") or ""
            reasoning = message.get("reasoning_content") or ""
            finish = payload["choices"][0].get("finish_reason")

            row.update(
                {
                    "ok": True,
                    "elapsed_ms": elapsed_ms,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": usage.get("completion_tokens"),
                    "reasoning_tokens": (usage.get("completion_tokens_details") or {}).get(
                        "reasoning_tokens"
                    ),
                    "finish_reason": finish,
                    "content": content,
                    "reasoning_content": reasoning,
                }
            )
            sink.write(json.dumps(row) + "\n")
            sink.flush()
            completed += 1

            # Guards. All of these abort rather than warn: a confounded batch is worse than a
            # short one, and every failure they catch is silent by nature.
            if prompt_tokens > args.max_prompt_tokens:
                raise SystemExit(
                    f"\nABORT: prompt_tokens={prompt_tokens} exceeds "
                    f"{args.max_prompt_tokens}. This usually means the server injected a system "
                    "prompt of its own. Investigate before raising the ceiling."
                )
            # Baselined PER EFFORT, because effort legitimately changes the rendered prompt -
            # that is how it works here, and a single global baseline would fire on the very
            # thing it is meant to let through.
            seen = baseline_prompt_tokens.setdefault((game, cell["reasoning_effort"]), prompt_tokens)
            if abs(prompt_tokens - seen) > 20:
                raise SystemExit(
                    f"\nABORT: prompt_tokens for {game}/effort={cell['reasoning_effort']} "
                    f"drifted {seen} -> {prompt_tokens} mid-batch. The stimulus or the "
                    "server-side prompt changed under the run."
                )
            # Two-way. Thinking silently ON when asked off, and silently OFF when asked on, are
            # both total confounds, and the second is the one a naive check misses - it looks
            # like a fast, well-behaved run.
            if cell["thinking"] == "off" and reasoning.strip():
                raise SystemExit(
                    "\nABORT: effort=none was requested but reasoning_content came back "
                    f"non-empty ({len(reasoning)} chars). `reasoning_effort` is not reaching "
                    "the template on this server, so every cell would be confounded."
                )
            if cell["thinking"] == "on" and not reasoning.strip():
                raise SystemExit(
                    f"\nABORT: effort={cell['reasoning_effort']} was requested but no reasoning "
                    "came back. Thinking is off when it should be on - most likely a GUI Custom "
                    "Field overriding the API (lmstudio-bug-tracker#988). Check Inference > "
                    "Custom Fields > Reasoning Effort in the app."
                )

            flag = ""
            if finish == "length":
                flag = "  TRUNCATED"
            if not content.strip():
                flag += "  EMPTY-CONTENT"
            print(
                f"{elapsed_ms / 1000:5.0f}s ptok={prompt_tokens} "
                f"ctok={usage.get('completion_tokens')} {finish}{flag}"
            )

    minutes = (time.time() - started_at) / 60
    print(
        f"\ndone: {completed} run(s), {skipped} skipped, {failed} failed, {minutes:.0f} min"
        f"\nresults: {results_path}"
        f"\nnext:    python scripts/arc3/hypothesis_report.py {results_path}"
    )
    return 0


def calibrate(base_url, model_id, prompts, args, image, cells) -> int:
    """
    One cheap request per thinking mode, before committing a night to a grid.

    Verifies the two things that silently invalidate a batch: that the prompt is the size we
    think it is (no injected server-side system prompt), and that `reasoning_effort` actually
    controls thinking on this server rather than being ignored.
    """
    print("\ncalibrating...")
    ok = True
    efforts = sorted({c["reasoning_effort"] for c in cells})
    # An unsent effort field renders the template's own default. If the API value were being
    # overridden by a GUI Custom Field (lmstudio-bug-tracker#988), every row below would show
    # the same prompt_tokens as this one no matter what was asked for.
    probes = [("(unset)", None)] + [(e, e) for e in efforts]
    seen: dict[str, int] = {}
    for label, effort in probes:
        cell = dict(cells[0])
        if effort is not None:
            cell["reasoning_effort"] = effort
            cell["thinking"] = "off" if effort == "none" else "on"
        body = build_body(model_id, prompts, image, cell, max_tokens=1)
        if effort is None:
            body.pop("reasoning_effort", None)
        payload, elapsed_ms = call_model(base_url, body)
        usage = payload.get("usage", {})
        message = payload["choices"][0]["message"]
        prompt_tokens = usage.get("prompt_tokens", 0)
        reasoning = message.get("reasoning_content") or ""
        seen[label] = prompt_tokens

        verdict = "ok"
        if prompt_tokens > args.max_prompt_tokens:
            verdict, ok = "PROMPT TOO LARGE - injection?", False
        elif effort == "none" and reasoning.strip():
            verdict, ok = "THINKING NOT DISABLED - effort ignored", False
        elif effort not in (None, "none") and not reasoning.strip():
            verdict, ok = "NO REASONING - thinking is off when it should be on", False
        print(
            f"  effort={label:<8} {elapsed_ms / 1000:5.1f}s prompt_tokens={prompt_tokens:4d} "
            f"reasoning={len(reasoning):3d} chars  -> {verdict}"
        )

    # The decisive check. Effort is implemented on this model as text injected into the system
    # prompt, so a real effort change MUST move prompt_tokens. If every level renders the same
    # prompt, the API parameter is being ignored and the grid's main axis would be inert.
    distinct = len(set(seen[e] for e in efforts))
    if len(efforts) > 1 and distinct == 1:
        ok = False
        print(
            f"\n  FAIL: every effort level rendered the same prompt ({seen[efforts[0]]} tokens).\n"
            "  The API parameter is not reaching the chat template, so the thinking axis of\n"
            "  this experiment would vary nothing. Check Inference > Custom Fields >\n"
            "  Reasoning Effort in the LM Studio app - a value set there overrides the API."
        )
    elif len(efforts) > 1:
        print(f"\n  effort lever confirmed: {distinct} distinct prompt renderings across "
              f"{len(efforts)} levels")
    if seen.get("(unset)") is not None and "low" not in efforts:
        print("  note: '(unset)' shows the template default, for comparison only.")

    print(
        "\nReference, Katana / qwen3.8-27b / 512px frame / v2_five prompt: 347 (none), 345 "
        "(medium), 383 unset.\nnone and medium sit close together because neither injects "
        "instruction text - the gap is the empty think block. The unset value is larger "
        "because the template's xhigh default DOES inject some, which is the clearest sign "
        "the parameter is being honoured.\nAnother model or image size legitimately differs. "
        "Hundreds more than expected does not - that is an injected prompt.\n"
        f"{'PASS' if ok else 'FAIL - do not start a batch until this passes'}"
    )
    return 0 if ok else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\ninterrupted.")
        sys.exit(130)
