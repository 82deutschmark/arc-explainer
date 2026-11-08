#!/usr/bin/env python3
"""
Author: Claude Opus 5.5 Low (round 13: now a short alias of make_variant_pages.py white, Claude Opus 5.5 Low)
Date: 08-November-2026
PURPOSE: Build the white-background alternate of the Turducken write-up,
         ../2026-11-06-arc3-solution-draft-white.html, from the main page. Since round 13 every art
         alternate (classic, white, cat, 1950s) is built by make_variant_pages.py from one ART table;
         this file is kept so the command older notes give still works, and simply runs its white build.
         Run from anywhere: python3 client/public/specials/arc3-solution-draft/make_white_page.py
         White copies are made on the Team 4TB drive (loose-goose/art/2026-11-08-turducken-white,
         transplant_white.py and MANIFEST.txt there); only web-size copies live in white/.
SRP/DRY check: Pass -- no logic of its own; the white build lives in make_variant_pages.py.
"""

import sys
from pathlib import Path

sys.dont_write_bytecode = True  # keep the published folder free of __pycache__
sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_variant_pages  # noqa: E402  (same folder)

if __name__ == "__main__":
    sys.argv = [sys.argv[0], "white"]
    sys.exit(make_variant_pages.main())
