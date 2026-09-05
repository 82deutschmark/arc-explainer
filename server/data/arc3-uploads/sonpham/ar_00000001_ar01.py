# Arbitrage Runner - Buy low, sell high across market stalls
#
# D-pad to move. Visit stalls to buy stocks cheap and sell them
# at other stalls for profit. Reach the target amount to win.
# Each stall has a fixed buy/sell price. Carry one stock at a time.
# Step on a buy stall = buy (costs gold). Step on sell stall = sell (earns gold).

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay

# Palette: 0=White 1=LightGray 2=Gray 3=DarkGray 4=VeryDarkGray 5=Black
# 6=Magenta 7=LightMagenta 8=Red 9=Blue 10=LightBlue 11=Yellow
# 12=Orange 13=Maroon 14=Green 15=Purple

_DIR = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}
HUD_H = 8
STOCK_COLORS = [8, 9, 12]  # Red, Blue, Orange for stocks 0, 1, 2

FONT = {
    0: [0b111, 0b101, 0b101, 0b101, 0b111],
    1: [0b010, 0b110, 0b010, 0b010, 0b111],
    2: [0b111, 0b001, 0b111, 0b100, 0b111],
    3: [0b111, 0b001, 0b111, 0b001, 0b111],
    4: [0b101, 0b101, 0b111, 0b001, 0b001],
    5: [0b111, 0b100, 0b111, 0b001, 0b111],
    6: [0b111, 0b100, 0b111, 0b101, 0b111],
    7: [0b111, 0b001, 0b010, 0b010, 0b010],
    8: [0b111, 0b101, 0b111, 0b101, 0b111],
    9: [0b111, 0b101, 0b111, 0b001, 0b111],
}

LEVELS = [
    # L1: Simple - buy for 1, sell for 3, need 5 gold (start with 1)
    {
        "name": "First Trade",
        "grid_w": 7, "grid_h": 7,
        "walls": set(),
        "player": (3, 3),
        "stalls": [
            (1, 3, 0, 0, 1),   # buy stock0 for 1
            (5, 3, 1, 0, 3),   # sell stock0 for 3
        ],
        "start_gold": 1,
        "target_gold": 5,
    },
    # L2: Two stocks, different margins
    {
        "name": "Two Markets",
        "grid_w": 8, "grid_h": 7,
        "walls": set(),
        "player": (1, 3),
        "stalls": [
            (2, 1, 0, 0, 1),   # buy stock0 for 1
            (6, 1, 1, 0, 3),   # sell stock0 for 3
            (2, 5, 0, 1, 2),   # buy stock1 for 2
            (6, 5, 1, 1, 5),   # sell stock1 for 5
        ],
        "start_gold": 2,
        "target_gold": 8,
    },
    # L3: Need multiple trips
    {
        "name": "Repeat Customer",
        "grid_w": 8, "grid_h": 7,
        "walls": set(),
        "player": (1, 3),
        "stalls": [
            (1, 1, 0, 0, 1),
            (6, 1, 1, 0, 2),
            (1, 5, 0, 1, 1),
            (6, 5, 1, 1, 3),
        ],
        "start_gold": 2,
        "target_gold": 10,
    },
    # L4: Walls between markets
    {
        "name": "Walled Markets",
        "grid_w": 9, "grid_h": 8,
        "walls": {(4, 1), (4, 2), (4, 4), (4, 5), (4, 6)},
        "player": (1, 3),
        "stalls": [
            (2, 1, 0, 0, 1),
            (7, 1, 1, 0, 4),
            (2, 6, 0, 1, 2),
            (7, 6, 1, 1, 5),
        ],
        "start_gold": 2,
        "target_gold": 12,
    },
    # L5: Three stocks
    {
        "name": "Triple Market",
        "grid_w": 10, "grid_h": 8,
        "walls": {(5, 1), (5, 2), (5, 4), (5, 5), (5, 6)},
        "player": (1, 3),
        "stalls": [
            (2, 1, 0, 0, 1), (8, 1, 1, 0, 3),
            (2, 3, 0, 1, 2), (8, 3, 1, 1, 5),
            (2, 6, 0, 2, 3), (8, 6, 1, 2, 7),
        ],
        "start_gold": 3,
        "target_gold": 15,
    },
    # L6: Must choose optimal routes
    {
        "name": "Optimal Route",
        "grid_w": 10, "grid_h": 9,
        "walls": {(3, 1), (3, 2), (3, 4), (3, 5), (3, 7),
                  (7, 2), (7, 3), (7, 5), (7, 6), (7, 7)},
        "player": (1, 4),
        "stalls": [
            (1, 1, 0, 0, 1), (5, 1, 1, 0, 3),
            (5, 7, 0, 1, 2), (8, 1, 1, 1, 6),
        ],
        "start_gold": 2,
        "target_gold": 14,
    },
    # L7: Maze with markets scattered
    {
        "name": "Market Maze",
        "grid_w": 10, "grid_h": 10,
        "walls": {(3, 1), (3, 2), (3, 3), (3, 5), (3, 6), (3, 8),
                  (6, 2), (6, 3), (6, 5), (6, 6), (6, 7), (6, 8)},
        "player": (1, 4),
        "stalls": [
            (1, 1, 0, 0, 1), (8, 1, 1, 0, 4),
            (4, 4, 0, 1, 2), (8, 8, 1, 1, 6),
        ],
        "start_gold": 2,
        "target_gold": 16,
    },
    # L8: Complex economy
    {
        "name": "Supply Chain",
        "grid_w": 11, "grid_h": 9,
        "walls": {(4, 1), (4, 2), (4, 4), (4, 5), (4, 7),
                  (7, 2), (7, 3), (7, 5), (7, 6), (7, 7)},
        "player": (1, 4),
        "stalls": [
            (1, 1, 0, 0, 1), (5, 1, 1, 0, 2),
            (1, 7, 0, 1, 2), (9, 7, 1, 1, 5),
            (5, 4, 0, 2, 3), (9, 1, 1, 2, 8),
        ],
        "start_gold": 3,
        "target_gold": 20,
    },
    # L9: Tight margins, many trips
    {
        "name": "Thin Margins",
        "grid_w": 11, "grid_h": 10,
        "walls": {(3, 1), (3, 2), (3, 4), (3, 5), (3, 7), (3, 8),
                  (6, 2), (6, 3), (6, 5), (6, 6), (6, 8),
                  (9, 1), (9, 3), (9, 4), (9, 6), (9, 7), (9, 8)},
        "player": (1, 4),
        "stalls": [
            (1, 1, 0, 0, 1), (4, 1, 1, 0, 2),
            (1, 8, 0, 1, 1), (7, 1, 1, 1, 3),
            (4, 8, 0, 2, 2), (10, 4, 1, 2, 6),
        ],
        "start_gold": 2,
        "target_gold": 18,
    },
    # L10: Grand marketplace
    {
        "name": "Grand Bazaar",
        "grid_w": 12, "grid_h": 10,
        "walls": {(3, 1), (3, 2), (3, 4), (3, 5), (3, 7), (3, 8),
                  (6, 1), (6, 2), (6, 4), (6, 5), (6, 7), (6, 8),
                  (9, 2), (9, 3), (9, 5), (9, 6), (9, 8)},
        "player": (1, 4),
        "stalls": [
            (1, 1, 0, 0, 1), (7, 1, 1, 0, 3),
            (1, 8, 0, 1, 2), (10, 1, 1, 1, 6),
            (4, 3, 0, 2, 3), (10, 8, 1, 2, 8),
            (4, 6, 0, 0, 1), (7, 8, 1, 0, 4),
        ],
        "start_gold": 3,
        "target_gold": 25,
    },
]


def _border(w, h):
    s = set()
    for x in range(w):
        s.add((x, 0))
        s.add((x, h - 1))
    for y in range(h):
        s.add((0, y))
        s.add((w - 1, y))
    return s


def _glyph(frame, x, y, rows, color):
    for ri, row in enumerate(rows):
        for col in range(3):
            if row & (1 << (2 - col)):
                px, py = x + col, y + ri
                if 0 <= px < 64 and 0 <= py < 64:
                    frame[py, px] = color


def _number(frame, x, y, n, color):
    for i, ch in enumerate(str(n)):
        _glyph(frame, x + i * 4, y, FONT[int(ch)], color)


class Ar01Display(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    def render_interface(self, frame):
        frame[:, :] = 5  # Black background
        g = self.game

        # Dynamic cell size - scale grid to fill available space
        cell = min(64 // g.grid_w, (64 - HUD_H) // g.grid_h)
        game_h = 64 - HUD_H
        ox = (64 - g.grid_w * cell) // 2
        oy = HUD_H + (game_h - g.grid_h * cell) // 2

        # --- Grid (dark trading floor with spreadsheet grid lines) ---
        for gy in range(g.grid_h):
            for gx in range(g.grid_w):
                px, py = ox + gx * cell, oy + gy * cell
                if px + cell > 64 or py + cell > 64 or px < 0 or py < 0:
                    continue
                if (gx, gy) in g.walls:
                    frame[py:py + cell, px:px + cell] = 2  # Gray walls
                    if cell >= 4:
                        frame[py + 1:py + cell - 1, px + 1:px + cell - 1] = 3
                else:
                    frame[py:py + cell, px:px + cell] = 4  # VeryDarkGray floor
                    frame[py, px:px + cell] = 3  # grid top edge
                    frame[py:py + cell, px] = 3  # grid left edge

        # --- Stalls (bright green if interactable, dark if not) ---
        for sx, sy, stype, good_id, price in g.stall_defs:
            px, py = ox + sx * cell, oy + sy * cell
            if px + cell > 64 or py + cell > 64 or px < 0 or py < 0:
                continue

            if stype == 0:
                can = g.carrying is None and g.gold >= price
            else:
                can = g.carrying == good_id

            bg = 14 if can else 3  # Green / DarkGray
            frame[py:py + cell, px:px + cell] = bg

            # Price number at top of cell
            dx = (cell - 3) // 2
            dy = 1 if cell >= 7 else 0
            # Yellow = buy price, White = sell price; Gray when not interactable
            nc = (11 if stype == 0 else 0) if can else 2
            _glyph(frame, px + dx, py + dy, FONT[min(price, 9)], nc)

            # Stock color dot (bottom-right)
            sc = STOCK_COLORS[good_id % len(STOCK_COLORS)]
            if cell >= 6:
                frame[py + cell - 2, px + cell - 2] = sc
                frame[py + cell - 2, px + cell - 3] = sc
            elif cell >= 4:
                frame[py + cell - 1, px + cell - 1] = sc

            # Buy/sell arrow indicator (when cell big enough)
            if cell >= 7:
                mid = px + cell // 2
                bot = py + cell - 1
                if stype == 0:  # Buy: down arrow
                    for dc in range(-1, 2):
                        frame[bot - 1, mid + dc] = nc
                    frame[bot, mid] = nc
                else:  # Sell: up arrow
                    frame[bot - 1, mid] = nc
                    for dc in range(-1, 2):
                        frame[bot, mid + dc] = nc

        # --- Player (trader icon) ---
        ppx, ppy = ox + g.px * cell, oy + g.py * cell
        if 0 <= ppx and ppx + cell <= 64 and 0 <= ppy and ppy + cell <= 64:
            # Stock color border when carrying
            if g.carrying is not None:
                sc = STOCK_COLORS[g.carrying % len(STOCK_COLORS)]
                frame[ppy:ppy + cell, ppx:ppx + cell] = sc
                if cell >= 4:
                    frame[ppy + 1:ppy + cell - 1, ppx + 1:ppx + cell - 1] = 4

            # Person icon (White head, LightBlue suit)
            cx = ppx + cell // 2
            hc, bc = 0, 10
            if cell >= 7:
                frame[ppy + 1, cx] = hc
                for dc in range(-1, 2):
                    frame[ppy + 2, cx + dc] = bc
                frame[ppy + 3, cx] = bc
                frame[ppy + 4, cx - 1] = bc
                frame[ppy + 4, cx + 1] = bc
            elif cell >= 5:
                frame[ppy, cx] = hc
                for dc in range(-1, 2):
                    frame[ppy + 1, cx + dc] = bc
                frame[ppy + 2, cx] = bc
                frame[ppy + 3, cx - 1] = bc
                frame[ppy + 3, cx + 1] = bc
            else:
                frame[ppy + cell // 2, ppx + cell // 2] = bc

        # === HUD ===
        # Dashed green ticker line separating HUD from game
        for x in range(0, 64, 2):
            frame[HUD_H - 1, x] = 14

        # Gold: coin icon + number in yellow
        frame[2:4, 1:3] = 11  # 2x2 gold coin
        _number(frame, 4, 1, g.gold, 11)

        # Separator + target in light gray
        sep = 4 + len(str(g.gold)) * 4 + 1
        frame[1:6, sep] = 3
        _number(frame, sep + 2, 1, g.target_gold, 1)

        # Stock indicator (right side)
        bx = 57
        if g.carrying is not None:
            sc = STOCK_COLORS[g.carrying % len(STOCK_COLORS)]
            frame[1:6, bx:bx + 6] = sc
            _glyph(frame, bx + 1, 1, FONT[g.carrying % 10], 0)
        else:
            frame[1:6, bx:bx + 6] = 4  # empty dark slot
            for i in range(5):
                if bx + i < 63:
                    frame[1 + i, bx + i] = 3
                if bx + 4 - i >= 0:
                    frame[1 + i, bx + 4 - i] = 3

        return frame


class Ar01(ARCBaseGame):
    def __init__(self):
        self.display = Ar01Display(self)
        levels = []
        for ldef in LEVELS:
            levels.append(Level(
                sprites=[],
                grid_size=(64, 64),
                data=ldef,
                name=ldef["name"],
            ))
        super().__init__(
            "ar", levels,
            Camera(0, 0, 64, 64, 5, 5, [self.display]),
            False, len(levels), [1, 2, 3, 4],
        )

    def on_set_level(self, level):
        d = LEVELS[self.level_index]
        self.grid_w = d["grid_w"]
        self.grid_h = d["grid_h"]
        self.walls = _border(d["grid_w"], d["grid_h"]) | set(d["walls"])
        self.px, self.py = d["player"]
        self.stall_defs = d["stalls"]
        self.stall_map = {}
        for sx, sy, stype, gid, price in d["stalls"]:
            self.stall_map[(sx, sy)] = (stype, gid, price)
        self.gold = d["start_gold"]
        self.target_gold = d["target_gold"]
        self.carrying = None

    def step(self):
        aid = self.action.id.value
        if aid not in _DIR:
            self.complete_action()
            return

        dx, dy = _DIR[aid]
        nx, ny = self.px + dx, self.py + dy

        if (nx, ny) in self.walls:
            self.complete_action()
            return

        self.px, self.py = nx, ny

        # Check stall interaction
        if (self.px, self.py) in self.stall_map:
            stype, gid, price = self.stall_map[(self.px, self.py)]
            if stype == 0 and self.carrying is None and self.gold >= price:
                self.gold -= price
                self.carrying = gid
            elif stype == 1 and self.carrying == gid:
                self.gold += price
                self.carrying = None

        # Check win
        if self.gold >= self.target_gold:
            self.next_level()

        self.complete_action()
