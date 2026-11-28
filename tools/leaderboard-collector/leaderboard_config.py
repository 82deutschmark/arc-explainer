# Author: GPT-6 / Codex; Claude Opus 5.5 Medium
# Date: 2026-10-08; 28-Nov-2026 (Claude Opus 5.5 Medium): Generalist Gaming added as a table entry, so the newspaper's
#       board, ticker and cards have a live feed for the contest the paper now follows. ARC entries unchanged.
# PURPOSE: Competition identities, separate storage, and featured-team coverage for
# the scheduled leaderboard collector, including the continuing reporter watch list.
# SRP/DRY check: Pass — both collection jobs import this shared configuration.
"""Competition identities and separate local storage for the leaderboard jobs."""
import os
from pathlib import Path

ARC3 = "arc-prize-2026-arc-agi-3"
ARC2 = "arc-prize-2026-arc-agi-2"
GGA = "generalist-gaming-agent"

# subdir: where the job keeps this contest's files under the data root ("" for ARC-3, the original layout).
# ours: the editor's team (its row feeds the landing page's standing); pinned and featured keep a full trail.
COMPETITIONS = {
    ARC3: {"subdir": "", "ours": "15605182", "pinned": [],
           "featured": {"15770880", "16032816", "15501006", "16371045", "16021367", "15508513"}},
    ARC2: {"subdir": "arc-2", "ours": "17023174", "pinned": ["15605185"],
           "featured": {"15605185", "15507730", "15486939", "15487968", "15486728", "15526034"}},
    # Logical Arbitrage is the editor's Generalist Gaming team (wiki/publication/conflicts.json in the newsroom).
    # Featured: Daniel Franzen and Keith Tyser, the first two Goose stories on this board.
    GGA: {"subdir": GGA, "ours": "17431944", "pinned": [], "featured": {"17457080", "17431467"}},
}

COMP = os.environ.get("LEADERBOARD_COMPETITION", ARC3)
if COMP not in COMPETITIONS:
    raise ValueError(f"unsupported LEADERBOARD_COMPETITION: {COMP}")
_C = COMPETITIONS[COMP]

ROOT = Path(os.environ.get("LEADERBOARD_DATA_DIR") or Path.home() / ".cache/arc3-leaderboard-data")
DATA = ROOT / _C["subdir"] if _C["subdir"] else ROOT
OUR_TEAM_ID = _C["ours"]
PINNED_TEAM_IDS = [OUR_TEAM_ID, *_C["pinned"]]
FEATURED_TEAM_IDS = frozenset({OUR_TEAM_ID, *_C["featured"]})


def check_competition(latest):
    """Only pre-existing ARC3 snapshots may omit the competition identifier."""
    if latest is not None and latest.get("competition", ARC3) != COMP:
        raise ValueError(f"saved leaderboard belongs to another competition; refusing {COMP}")
