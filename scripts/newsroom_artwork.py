#!/usr/bin/env python3.13
# Author: GPT-6 Sol / Codex
# Date: 2026-10-09
# PURPOSE: Add ARC Explainer branding, a genuine public game PNG and a dated two-team
# ARC-3 scoreboard to approved editorial artwork. Scores come from a newsroom brief.
# SRP/DRY check: Pass — uses the existing brief contract and site artwork; no model calls.
"""Compose deterministic title cards on approved artwork, preserving the original."""
import argparse
from datetime import datetime
import json
from pathlib import Path
from zoneinfo import ZoneInfo
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]


def compose(source, brief_path, output):
    brief = json.loads(Path(brief_path).read_text())
    board = brief['competitions']['arc-3']['articleBase']
    stats = {row['teamId']: row for row in board['stats']}
    rows = [stats[tid] for tid in ('15499660', '15486995')]
    rows.sort(key=lambda row: row['rank'])
    observed = datetime.fromisoformat(board['dataAsOf'].replace('Z', '+00:00')).astimezone(ZoneInfo('America/New_York'))
    canvas = Image.open(source).convert('RGBA')
    # Use a consistent card scale regardless of the approved base art's resolution.
    width = 1920
    canvas = canvas.resize((width, round(canvas.height * width / canvas.width)), Image.Resampling.LANCZOS)
    overlay = Image.new('RGBA', canvas.size)
    draw = ImageDraw.Draw(overlay)
    regular_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
    bold_path = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    regular = lambda size: ImageFont.truetype(regular_path, size)
    bold = lambda size: ImageFont.truetype(bold_path, size)
    ink, blue = (15, 23, 36, 238), '#3b82f6'
    # The header's established six-color ARC Explainer mark and blue ARC-3 identity.
    draw.rounded_rectangle((26, 26, 595, 143), radius=9, fill=ink)
    colors = ('#ef4444', '#f97316', '#facc15', '#22c55e', blue, '#a855f7')
    for index, color in enumerate(colors):
        x, y = 45 + (index % 3) * 20, 47 + (index // 3) * 20
        draw.rectangle((x, y, x + 16, y + 16), fill=color)
    draw.text((119, 42), 'ARC Explainer', font=bold(27), fill='white')
    draw.rectangle((119, 85, 139, 105), fill=blue)
    draw.text((151, 78), 'ARC-3 / THE ARC DAILY', font=bold(26), fill='white')
    game = Image.open(ROOT / 'client/public/arc3-levels/ls20/lvl1.png').convert('RGBA').resize((87, 87), Image.Resampling.NEAREST)
    overlay.alpha_composite(game, (486, 41))
    # Echo the original post's lower-right standings card without covering the faces.
    x, y, card_width, card_height = width - 596, canvas.height - 244, 568, 204
    draw.rounded_rectangle((x, y, x + card_width, y + card_height), radius=8, fill=ink, outline='#aab3c1', width=1)
    draw.rectangle((x + 18, y + 17, x + 30, y + 37), fill=blue)
    draw.text((x + 43, y + 14), 'ARC-3 PUBLIC LEADERBOARD', font=bold(23), fill='white')
    draw.line((x + 18, y + 52, x + card_width - 18, y + 52), fill='#667085', width=1)
    for index, row in enumerate(rows):
        row_y = y + 67 + index * 44
        color = '#ffe15a' if row['rank'] == 1 else 'white'
        draw.text((x + 20, row_y), str(row['rank']), font=bold(29), fill=color)
        draw.text((x + 64, row_y), row['name'], font=bold(29), fill=color)
        score = f"{row['score']:.2f}"
        draw.text((x + card_width - 20 - draw.textlength(score, font=bold(30)), row_y), score, font=bold(30), fill=color)
    date_label = observed.strftime('%b %-d, %Y · %-I:%M %p %Z')
    draw.text((x + 20, y + 165), date_label + ' · provisional', font=regular(18), fill='#d2d8e1')
    draw.rectangle((0, canvas.height - 28, width, canvas.height), fill=ink)
    draw.text((28, canvas.height - 25), 'AI editorial illustration · GPU pile is a metaphor · public game image: ls20 · arc.markbarney.net/news', font=regular(16), fill='white')
    result = Image.alpha_composite(canvas, overlay).convert('RGB')
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    result.save(output, quality=92)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--brief', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    compose(args.source, args.brief, args.output)
