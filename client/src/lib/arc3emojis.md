# ARC3 Emoji Palette

Author: Cascade  GPT 5.1 (high)
Date: 2025-12-07

## Overview

This document defines a whimsical, **emoji-only** palette for representing the 16 ARC3 colour indices (`0–15`) using **single-character, Windows-friendly emojis**.  

The design goals are:

- **Random-feeling, non-literal mapping** – emojis are *not* chosen to visually match the hex colours.  
- **Highly recognisable icons** – food, vehicles, plants, etc., that are easy to distinguish at a glance.  
- **Single code point per cell** – no combining sequences (e.g. burning hearts), so every grid cell is exactly one emoji.  

This palette is intended for visualisation, playful UIs, or teaching tools where ARC3 colour indices are shown as emoji mosaics.

---

## ARC3 Colour → Emoji Mapping

The table below maps each ARC3 colour index to a single emoji.  
The emojis are taken, in order, from the example string you provided:

> 🧇🍩🥑🥜💐🥔🍓🍑🍉🚁🛸🚥🍋🍍🌵🚑 …

Only the **first 16** emojis from that sequence are used here.

| ARC3 index | Hex       | Name        | Emoji |
|-----------:|-----------|-------------|:-----:|
| 0          | `#FFFFFF` | White       | 🧇 |
| 1          | `#CCCCCC` | Light Gray  | 🍩 |
| 2          | `#999999` | Gray        | 🥑 |
| 3          | `#666666` | Dark Gray   | 🥜 |
| 4          | `#333333` | Darker Gray | 💐 |
| 5          | `#000000` | Black       | 🥔 |
| 6          | `#E53AA3` | Pink        | 🍓 |
| 7          | `#FF7BCC` | Light Pink  | 🍑 |
| 8          | `#F93C31` | Red         | 🍉 |
| 9          | `#1E93FF` | Blue        | 🚁 |
| 10         | `#88D8F1` | Light Blue  | 🛸 |
| 11         | `#FFDC00` | Yellow      | 🚥 |
| 12         | `#FF851B` | Orange      | 🍋 |
| 13         | `#921231` | Dark Red    | 🍍 |
| 14         | `#4FCC30` | Green       | 🌵 |
| 15         | `#A356D0` | Purple      | 🚑 |

---

## Usage Ideas

- **Emoji grids for ARC3 puzzles** – map each cell value (0–15) through this table to render a mosaic instead of flat colours.
- **Legends in the UI** – show a 4×4 mini-grid or simple list using these emojis alongside the actual ARC3 colour swatches (`arc3Colors.ts`).
- **Teaching / explanation tools** – use the randomness to emphasise that colour *indices* are abstract labels, not inherently tied to any real-world meaning.

If you later want a code-ready mapping (e.g. `ARC3_EMOJI_PALETTE[0] === '🧇'`), you can mirror this table in TypeScript, or feed these directly into `EmojiMosaicAccent` via `customCells`.

---

## Random Example ARC3 Palettes (from `emojis.md`)

Below are additional 16-emoji palettes for ARC3.  
Each line is a **length-16 sequence** intended to be read as:

> colour index 0 → first emoji, 1 → second emoji, …, 15 → sixteenth emoji

The emojis were chosen by sampling one glyph from different arrays in `client/src/lib/emojis.md` (`SPACE_EMOJIS`).  
The set names are ignored at usage time – these are just strange symbols in an ARC3 alphabet.

### Palette A

`🌟 ⚡ 🔥 🌪 🤪 🤖 💠 👽 🦄 🐍 🍍 🍪 🍄 🧪 𓂀 ♊`

### Palette B

`🌕 📡 🍔 🎲 ㊗️ 🚪 🐙 🐤 🏰 🦋 🔨 🎸 🥕 ☕ ⚽ 🚗`

### Palette C

`🌞 😎 💡 🆎 🐯 🐢 🥭 🧁 🌴 🔬 𓃒 ♌ 🧢 🏠 🟡 🍷`

