#!/usr/bin/env python3.13
# Author: Claude Sonnet 5.5 (effort unknown)
# Date: 30-October-2026
# PURPOSE: Draw docs/newsroom/card-art-template.png, the transparent 1500 x 2100 overlay that shows
# an artist where the Card Cabinet draws its own elements (tier border, badges, name plate, stats)
# so the figure and face are composed clear of them. The zone numbers here are the single source
# for CARD_ART_BRIEF.md and for the card renderer's front layout; change them in one place.
# Usage: python3.13 scripts/card_art_template.py
# SRP/DRY check: Pass — one job (zones -> template image); no network, no card data.
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/newsroom/card-art-template.png"
FONT = ROOT / "server/assets/fonts/news-card/IBMPlexSansCondensed-Bold.ttf"
W, H = 1500, 2100  # 5:7, exactly twice the 750 x 1050 card the renderer draws

# (name, box as (left, top, right, bottom) in pixels, RGBA fill, what the code draws there)
ZONES = [
    ("TIER BORDER (code)", (0, 0, W, 52), (214, 40, 40, 120), "Border for Novice, Contributor, Expert, Master, Grandmaster. Art runs under it; keep nothing important here."),
    ("BADGES (code)", (52, 52, W - 52, 200), (30, 120, 220, 110), "Tier medallion, season, card number. Calm, uncluttered background."),
    ("SUBJECT SAFE AREA", (150, 200, W - 150, 1450), (40, 200, 120, 40), "Face, hands, props and the glamour pose live here."),
    ("EYES", (150, 560, W - 150, 780), (255, 255, 255, 70), "Eyes between 27% and 37% down the card."),
    ("NAME PLATE (code)", (52, 1450, W - 52, 1700), (240, 170, 20, 120), "Name banner and team badge. Nothing essential under it."),
    ("STATS (code)", (52, 1700, W - 52, 1960), (150, 60, 220, 120), "Rank, score, medals and tier, redrawn as results change."),
    ("FOOTER (code)", (52, 1960, W - 52, H - 52), (30, 120, 220, 110), "Series line and card number."),
]


def main() -> None:
    image = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    label = ImageFont.truetype(str(FONT), 46)
    small = ImageFont.truetype(str(FONT), 30)
    for name, box, fill, note in ZONES:
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(layer).rectangle(box, fill=fill)
        image = Image.alpha_composite(image, layer)
        draw = ImageDraw.Draw(image)
        draw.rectangle(box, outline=(255, 255, 255, 230), width=4)
        left, top, right, _ = box
        if name == "TIER BORDER (code)":
            draw.text((left + 24, top + 4), name, font=small, fill=(255, 255, 255, 255))
            continue
        draw.text((left + 24, top + 14), name, font=label, fill=(255, 255, 255, 255), stroke_width=4, stroke_fill=(0, 0, 0, 255))
        draw.text((left + 24, top + 72), note, font=small, fill=(255, 255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, W - 1, H - 1), outline=(255, 255, 255, 255), width=6)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT, optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} ({W}x{H})")


if __name__ == "__main__":
    main()
