# Author: in-house (ar02, v2); redrawn by Claude Opus 5.5 High (18-Oct-2026)
# Date: 18-October-2026
# PURPOSE: ab02, a trading game on a grid: walk to stalls, buy a good cheap, sell it dear elsewhere, reach the gold
#   goal before the timer runs out. Since 18-Oct nothing on screen is a digit (games must not speak): a stall's price
#   is a heap of coins (one coin per unit), a door's cost a row of pips, the gold a bar of coins along the top that
#   fills toward a goal mark, and the good being carried is shown by its colour alone. The FONT table and the glyph
#   helpers are gone. Rules, levels and timers are unchanged. Reads nothing; arcengine only.
# SRP/DRY check: Pass -- one game file; the drawing helpers below are the only ones (no font left to reuse).
# CHANGELOG
#   18-Oct-2026 Claude Opus 5.5 High: every number redrawn as a quantity (the Boss: "It can't use numbers"): price
#     coin heaps, door pips, gold coin bar with a goal mark; carried good shown by colour only; FONT, _glyph and
#     _number removed. Shut doors drawn as doors (they were drawn as wall, hiding their cost). Rules and levels
#     untouched.
#
# Arbitrage Runner v2 - Buy low, sell high across market stalls
#
# D-pad to move. Visit stalls to buy stocks cheap and sell them
# at other stalls for profit. Reach the target gold to win each level.
#
# New in v2:
# - Timer: each step costs 1 tick. Run out = game over.
# - Paid doors: walk into a locked gate to spend gold and unlock new markets.
# - Cycling prices: some stalls change price on a fixed schedule.
# - Rival trader: an NPC that races between stalls, depleting them temporarily.

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, RenderableUserDisplay
from collections import deque

# Palette: 0=White 1=LightGray 2=Gray 3=DarkGray 4=VeryDarkGray 5=Black
# 6=Magenta 7=LightMagenta 8=Red 9=Blue 10=LightBlue 11=Yellow
# 12=Orange 13=Maroon 14=Green 15=Purple

_DIR = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}
HUD_H = 8
STOCK_COLORS = [8, 9, 12]  # Red, Blue, Orange for stocks 0, 1, 2
DEPLETE_TIME = 4  # steps a stall is unusable after rival visits

# ── Level definitions ────────────────────────────────────────────────
# Stall tuple: (x, y, stype, good_id, base_price)
#   stype 0 = buy (player pays price, gets stock)
#   stype 1 = sell (player gives stock, earns price)
#
# Door tuple: (x, y, cost)
#
# Cycles dict: {stall_index: ([price0, price1, ...], period)}
#
# Rival dict: {"start": (x,y), "buy": (x,y), "sell": (x,y), "speed": N}
#   speed = rival moves once every N player steps

LEVELS = [
    # ── L1: First Trade ──────────────────────────────────────────────
    # Simple: one buy, one sell, generous timer.
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
        "timer": 25,
        "doors": [],
        "cycles": {},
        "rival": None,
    },
    # ── L2: Two Markets ──────────────────────────────────────────────
    # Two stock types with different margins.
    {
        "name": "Two Markets",
        "grid_w": 9, "grid_h": 7,
        "walls": set(),
        "player": (1, 3),
        "stalls": [
            (2, 1, 0, 0, 1),   # buy stock0 for 1
            (7, 1, 1, 0, 3),   # sell stock0 for 3
            (2, 5, 0, 1, 2),   # buy stock1 for 2
            (7, 5, 1, 1, 5),   # sell stock1 for 5
        ],
        "start_gold": 2,
        "target_gold": 8,
        "timer": 30,
        "doors": [],
        "cycles": {},
        "rival": None,
    },
    # ── L3: Walled Off ────────────────────────────────────────────────
    # Navigate through a gap in a wall dividing the markets.
    {
        "name": "Walled Off",
        "grid_w": 10, "grid_h": 8,
        "walls": {(5, 1), (5, 2), (5, 4), (5, 5), (5, 6)},
        "player": (2, 3),
        "stalls": [
            (1, 3, 0, 0, 1),   # buy stock0 for 1
            (8, 3, 1, 0, 4),   # sell stock0 for 4
        ],
        "start_gold": 2,
        "target_gold": 11,
        "timer": 40,
        "doors": [],
        "cycles": {},
        "rival": None,
    },
    # ── L4: Locked Market ─────────────────────────────────────────────
    # A paid door blocks access to a premium market.
    # Left: cheap trades (profit 2). Right (behind door): profit 4.
    {
        "name": "Locked Market",
        "grid_w": 10, "grid_h": 8,
        "walls": {(5, 1), (5, 2), (5, 4), (5, 5), (5, 6)},
        "player": (1, 3),
        "stalls": [
            (1, 1, 0, 0, 1),   # buy stock0 for 1
            (3, 1, 1, 0, 3),   # sell stock0 for 3 (profit 2)
            (7, 1, 0, 1, 1),   # buy stock1 for 1
            (8, 5, 1, 1, 5),   # sell stock1 for 5 (profit 4)
        ],
        "start_gold": 2,
        "target_gold": 14,
        "timer": 55,
        "doors": [(5, 3, 3)],   # door at gap, costs 3 gold
        "cycles": {},
        "rival": None,
    },
    # ── L5: Price Swings ──────────────────────────────────────────────
    # The sell stall cycles between high and low prices.
    # Trade when the price is high for max profit.
    {
        "name": "Price Swings",
        "grid_w": 9, "grid_h": 7,
        "walls": set(),
        "player": (4, 3),
        "stalls": [
            (1, 3, 0, 0, 1),   # buy stock0 for 1 (fixed)
            (7, 3, 1, 0, 5),   # sell stock0 — base 5, cycles
        ],
        "start_gold": 2,
        "target_gold": 12,
        "timer": 45,
        "doors": [],
        "cycles": {1: ([5, 2], 12)},  # sell price alternates 5/2 every 12 steps
        "rival": None,
    },
    # ── L6: The Competitor ────────────────────────────────────────────
    # A rival trader patrols between stock0 stalls, depleting them.
    # Stock1 is safe but less profitable.
    {
        "name": "The Competitor",
        "grid_w": 10, "grid_h": 8,
        "walls": set(),
        "player": (1, 3),
        "stalls": [
            (2, 1, 0, 0, 1),   # buy stock0 for 1
            (8, 1, 1, 0, 5),   # sell stock0 for 5 (profit 4)
            (2, 6, 0, 1, 1),   # buy stock1 for 1
            (8, 6, 1, 1, 4),   # sell stock1 for 4 (profit 3)
        ],
        "start_gold": 2,
        "target_gold": 14,
        "timer": 65,
        "doors": [],
        "cycles": {},
        "rival": {"start": (5, 1), "buy": (2, 1), "sell": (8, 1), "speed": 2},
    },
    # ── L7: Double Doors ──────────────────────────────────────────────
    # Two doors gate increasingly profitable markets. Invest wisely.
    # Free: profit 2. Door1 (cost 3): profit 4. Door2 (cost 4): profit 7.
    {
        "name": "Double Doors",
        "grid_w": 11, "grid_h": 7,
        "walls": {(4, 1), (4, 2), (4, 4), (4, 5),
                  (7, 1), (7, 2), (7, 4), (7, 5)},
        "player": (1, 3),
        "stalls": [
            # Free zone
            (1, 1, 0, 0, 1),   # buy stock0 for 1
            (1, 5, 1, 0, 3),   # sell stock0 for 3 (profit 2)
            # Behind door 1
            (5, 1, 0, 1, 1),   # buy stock1 for 1
            (5, 5, 1, 1, 5),   # sell stock1 for 5 (profit 4)
            # Behind door 2
            (9, 1, 0, 2, 1),   # buy stock2 for 1
            (9, 5, 1, 2, 8),   # sell stock2 for 8 (profit 7)
        ],
        "start_gold": 3,
        "target_gold": 20,
        "timer": 70,
        "doors": [(4, 3, 3), (7, 3, 4)],
        "cycles": {},
        "rival": None,
    },
    # ── L8: Trading Floor (STRAP) ─────────────────────────────────────
    # Big level: maze, doors, rival, cycling prices. Marathon.
    {
        "name": "Trading Floor",
        "grid_w": 12, "grid_h": 8,
        "walls": {(4, 1), (4, 2), (4, 4), (4, 5), (4, 6),
                  (8, 1), (8, 2), (8, 4), (8, 5), (8, 6)},
        "player": (1, 3),
        "stalls": [
            # Free zone (left)
            (1, 1, 0, 0, 1),   # buy stock0 for 1
            (1, 6, 1, 0, 3),   # sell stock0 for 3 (profit 2)
            # Behind door 1 (middle)
            (5, 1, 0, 1, 1),   # buy stock1 for 1
            (5, 6, 1, 1, 5),   # sell stock1 — base 5, cycles [5,3]
            # Behind door 2 (right)
            (10, 1, 0, 2, 1),  # buy stock2 for 1
            (10, 6, 1, 2, 8),  # sell stock2 for 8 (profit 7)
        ],
        "start_gold": 5,
        "target_gold": 28,
        "timer": 110,
        "doors": [(4, 3, 3), (8, 3, 5)],
        "cycles": {3: ([5, 3], 15)},  # middle sell cycles 5/3
        "rival": {"start": (2, 3), "buy": (1, 1), "sell": (1, 6), "speed": 3},
    },
    # ── L9: Hostile Takeover ──────────────────────────────────────────
    # Fast rival competes for stock0 (top row). Stock1 (bottom) is safe.
    {
        "name": "Hostile Takeover",
        "grid_w": 9, "grid_h": 7,
        "walls": set(),
        "player": (1, 3),
        "stalls": [
            (1, 1, 0, 0, 1),   # buy stock0 for 1
            (7, 1, 1, 0, 5),   # sell stock0 for 5 (profit 4, rival)
            (1, 5, 0, 1, 1),   # buy stock1 for 1
            (7, 5, 1, 1, 4),   # sell stock1 for 4 (profit 3, safe)
        ],
        "start_gold": 3,
        "target_gold": 15,
        "timer": 55,
        "doors": [],
        "cycles": {},
        "rival": {"start": (4, 1), "buy": (1, 1), "sell": (7, 1), "speed": 1},
    },
    # ── L10: Wall Street (STRAP) ─────────────────────────────────────
    # Grand finale: rival, two doors, cycling prices, long grind.
    {
        "name": "Wall Street",
        "grid_w": 12, "grid_h": 8,
        "walls": {(3, 1), (3, 2), (3, 4), (3, 5), (3, 6),
                  (7, 1), (7, 2), (7, 4), (7, 5), (7, 6)},
        "player": (1, 3),
        "stalls": [
            # Free zone
            (1, 1, 0, 0, 1),   # buy stock0 for 1
            (1, 6, 1, 0, 3),   # sell stock0 for 3 (profit 2)
            # Behind door 1
            (4, 1, 0, 1, 1),   # buy stock1 for 1
            (4, 6, 1, 1, 5),   # sell stock1 — cycles [5,3]
            # Behind door 2
            (10, 1, 0, 2, 1),  # buy stock2 for 1
            (10, 6, 1, 2, 9),  # sell stock2 for 9 (profit 8)
        ],
        "start_gold": 5,
        "target_gold": 35,
        "timer": 130,
        "doors": [(3, 3, 3), (7, 3, 5)],
        "cycles": {3: ([5, 3], 12)},
        "rival": {"start": (1, 4), "buy": (1, 1), "sell": (1, 6), "speed": 2},
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


def _heap(frame, x, y, w, h, n, color):
    """A price as a heap of coins: n single-pixel coins filling a w x h box from the bottom row up, left to right,
    so a dearer stall shows a taller heap. Clipped to the box (no level's price overflows its stall's box)."""
    for k in range(min(n, w * h)):
        row, col = divmod(k, w)
        frame[y + h - 1 - row, x + col] = color


def _pips(frame, x, y, w, n, color):
    """A cost as pips: n single pixels with a gap between each, in rows of up to (w + 1) // 2, from the top."""
    per = max(1, (w + 1) // 2)
    for k in range(n):
        row, col = divmod(k, per)
        px, py = x + 2 * col, y + 2 * row
        if 0 <= px < 64 and 0 <= py < 64:
            frame[py, px] = color


def _draw_person(frame, px, py, cell, head_c, body_c):
    """Draw a small person icon in the cell."""
    cx = px + cell // 2
    if cell >= 7:
        frame[py + 1, cx] = head_c
        for dc in range(-1, 2):
            frame[py + 2, cx + dc] = body_c
        frame[py + 3, cx] = body_c
        frame[py + 4, cx - 1] = body_c
        frame[py + 4, cx + 1] = body_c
    elif cell >= 5:
        frame[py, cx] = head_c
        for dc in range(-1, 2):
            frame[py + 1, cx + dc] = body_c
        frame[py + 2, cx] = body_c
        frame[py + 3, cx - 1] = body_c
        frame[py + 3, cx + 1] = body_c
    else:
        frame[py + cell // 2, px + cell // 2] = body_c


class Ar02Display(RenderableUserDisplay):
    def __init__(self, game):
        self.game = game

    def render_interface(self, frame):
        frame[:, :] = 5  # Black background
        g = self.game

        cell = min(64 // g.grid_w, (64 - HUD_H) // g.grid_h)
        game_h = 64 - HUD_H
        ox = (64 - g.grid_w * cell) // 2
        oy = HUD_H + (game_h - g.grid_h * cell) // 2

        # ── Grid floor ──
        for gy in range(g.grid_h):
            for gx in range(g.grid_w):
                px, py = ox + gx * cell, oy + gy * cell
                if px + cell > 64 or py + cell > 64 or px < 0 or py < 0:
                    continue
                # a shut door is also in g.walls (on_set_level), so it is drawn first or it would look like wall
                if (gx, gy) in g.door_map:
                    # Door: purple tile; its gold cost is a block of pips (rows of three, a gap between each)
                    cost = g.door_map[(gx, gy)]
                    can_buy = g.gold >= cost
                    bg = 15 if can_buy else 13  # Purple / Maroon
                    frame[py:py + cell, px:px + cell] = bg
                    nc = 11 if can_buy else 3  # Yellow / DarkGray
                    rows = -(-cost // 3)
                    _pips(frame, px + (cell - 5) // 2, py + (cell - (2 * rows - 1)) // 2, 5, cost, nc)
                elif (gx, gy) in g.walls:
                    frame[py:py + cell, px:px + cell] = 2
                    if cell >= 4:
                        frame[py + 1:py + cell - 1, px + 1:px + cell - 1] = 3
                else:
                    frame[py:py + cell, px:px + cell] = 4  # VeryDarkGray floor
                    frame[py, px:px + cell] = 3
                    frame[py:py + cell, px] = 3

        # ── Stalls ──
        for si, (sx, sy, stype, good_id, _base_price) in enumerate(g.stall_defs):
            px, py = ox + sx * cell, oy + sy * cell
            if px + cell > 64 or py + cell > 64 or px < 0 or py < 0:
                continue

            price = g._get_price(si)
            depleted = (sx, sy) in g.stall_cooldown

            if depleted:
                bg = 3  # DarkGray when depleted
                can = False
            elif stype == 0:
                can = g.carrying is None and g.gold >= price
            else:
                can = g.carrying == good_id

            if not depleted:
                bg = 14 if can else 3
            frame[py:py + cell, px:px + cell] = bg

            # Layout inside a stall (cell 5 to 8 pixels): the top row is a stripe in the good's colour; under it,
            # after a one-pixel gap, the price as a heap of coins (yellow to buy, white to sell, grey when it
            # cannot be used now); on cells of 7 or more the buy/sell arrow sits in the bottom two rows, beside
            # the heap. Each part has its own pixels, so nothing overlaps.
            nc = (11 if stype == 0 else 0) if (can and not depleted) else 2
            sc = STOCK_COLORS[good_id % len(STOCK_COLORS)]
            frame[py, px + 1:px + cell - 1] = sc
            if cell >= 7:
                # heap on the left (cell - 5 wide: 2 on cell 7, 3 on cell 8), the arrow on the right (3 wide, against
                # the right edge), with a free column between them
                _heap(frame, px + 1, py + 2, cell - 5, cell - 3, price, nc)
                mid = px + cell - 2
                bot = py + cell - 2
                if stype == 0:
                    for dc in range(-1, 2):
                        frame[bot - 1, mid + dc] = nc
                    frame[bot, mid] = nc
                else:
                    frame[bot - 1, mid] = nc
                    for dc in range(-1, 2):
                        frame[bot, mid + dc] = nc
            else:
                _heap(frame, px + 1, py + 2, cell - 2, cell - 2, price, nc)

        # ── Rival ──
        if g.rival_pos is not None:
            rx, ry = g.rival_pos
            rpx, rpy = ox + rx * cell, oy + ry * cell
            if 0 <= rpx and rpx + cell <= 64 and 0 <= rpy and rpy + cell <= 64:
                _draw_person(frame, rpx, rpy, cell, 8, 13)  # Red head, Maroon body

        # ── Player ──
        ppx, ppy = ox + g.px * cell, oy + g.py * cell
        if 0 <= ppx and ppx + cell <= 64 and 0 <= ppy and ppy + cell <= 64:
            if g.carrying is not None:
                sc = STOCK_COLORS[g.carrying % len(STOCK_COLORS)]
                frame[ppy:ppy + cell, ppx:ppx + cell] = sc
                if cell >= 4:
                    frame[ppy + 1:ppy + cell - 1, ppx + 1:ppx + cell - 1] = 4
            _draw_person(frame, ppx, ppy, cell, 0, 10)  # White head, LightBlue body

        # ══════ HUD ══════
        # Row 0: Timer bar
        if g.max_timer > 0:
            frac = max(0.0, g.timer / g.max_timer)
            bar_w = max(0, int(62 * frac))
            if frac > 0.5:
                tc = 14  # Green
            elif frac > 0.25:
                tc = 11  # Yellow
            else:
                tc = 8   # Red
            if bar_w > 0:
                frame[0, 1:1 + bar_w] = tc

        # Row 7: green ticker line
        for x in range(0, 64, 2):
            frame[HUD_H - 1, x] = 14

        # Gold: a coin, then a bar of coins that fills toward the goal mark. The track runs from x=4 to the goal
        # mark (light grey); every unit of gold is one coin, wide enough to count on small goals (a dark gap
        # between coins) and one pixel each on large ones. Unfilled track is dark grey.
        frame[3:5, 1:3] = 11
        x0, room = 4, 50
        unit = max(1, room // max(1, g.target_gold))
        goal = x0 + unit * g.target_gold
        frame[3:5, x0:goal] = 4
        for k in range(min(g.gold, g.target_gold)):
            a = x0 + k * unit
            frame[3:5, a:a + max(1, unit - 1)] = 11
        frame[2:6, min(goal, 55)] = 1

        # Carrying indicator (right side)
        bx = 57
        if g.carrying is not None:
            sc = STOCK_COLORS[g.carrying % len(STOCK_COLORS)]
            frame[2:7, bx:bx + 6] = sc       # the good carried, by its colour
        else:
            frame[2:7, bx:bx + 6] = 4
            for i in range(5):
                if bx + i < 63:
                    frame[2 + i, bx + i] = 3
                if bx + 4 - i >= 0:
                    frame[2 + i, bx + 4 - i] = 3

        return frame


class Ab02(ARCBaseGame):
    def __init__(self):
        self.display = Ar02Display(self)
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
        for idx, (sx, sy, stype, gid, price) in enumerate(d["stalls"]):
            self.stall_map[(sx, sy)] = (stype, gid, price, idx)
        self.gold = d["start_gold"]
        self.target_gold = d["target_gold"]
        self.carrying = None
        self.timer = d["timer"]
        self.max_timer = d["timer"]
        self.step_count = 0

        # Doors
        self.door_map = {}
        for dx, dy, cost in d.get("doors", []):
            self.door_map[(dx, dy)] = cost
            self.walls.add((dx, dy))

        # Cycling prices
        self.cycles = d.get("cycles", {})

        # Stall cooldowns (from rival depletion)
        self.stall_cooldown = {}

        # Rival
        rival = d.get("rival")
        if rival:
            self.rival_pos = rival["start"]
            self.rival_buy = rival["buy"]
            self.rival_sell = rival["sell"]
            self.rival_speed = rival["speed"]
            self.rival_phase = "to_buy"
        else:
            self.rival_pos = None

    def _get_price(self, stall_idx):
        if stall_idx in self.cycles:
            prices, period = self.cycles[stall_idx]
            return prices[self.step_count // period % len(prices)]
        return self.stall_defs[stall_idx][4]

    def _bfs_next(self, start, goal):
        """Return next tile on shortest BFS path from start to goal."""
        if start == goal:
            return start
        visited = {start}
        q = deque()
        q.append((start, start))
        while q:
            (cx, cy), first = q.popleft()
            for ddx, ddy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                nx, ny = cx + ddx, cy + ddy
                if (nx, ny) in visited:
                    continue
                if (nx, ny) in self.walls or (nx, ny) in self.door_map:
                    continue
                if not (0 <= nx < self.grid_w and 0 <= ny < self.grid_h):
                    continue
                visited.add((nx, ny))
                f = first if first != start else (nx, ny)
                if (nx, ny) == goal:
                    return f
                q.append(((nx, ny), f))
        return start  # no path — stay put

    def _move_rival(self):
        if self.rival_pos is None:
            return
        target = self.rival_buy if self.rival_phase == "to_buy" else self.rival_sell
        nxt = self._bfs_next(self.rival_pos, target)
        self.rival_pos = nxt

        if self.rival_pos == target:
            self.stall_cooldown[target] = DEPLETE_TIME
            self.rival_phase = "to_sell" if self.rival_phase == "to_buy" else "to_buy"

    def step(self):
        aid = self.action.id.value
        if aid not in _DIR:
            self.complete_action()
            return

        dx, dy = _DIR[aid]
        nx, ny = self.px + dx, self.py + dy

        # Door interaction: walk into a door to pay and open it
        if (nx, ny) in self.door_map:
            cost = self.door_map[(nx, ny)]
            if self.gold >= cost:
                self.gold -= cost
                self.walls.discard((nx, ny))
                del self.door_map[(nx, ny)]
                self.px, self.py = nx, ny
            # else: can't afford — treated like a wall
        elif (nx, ny) not in self.walls:
            self.px, self.py = nx, ny

        # Stall interaction
        key = (self.px, self.py)
        if key in self.stall_map and key not in self.stall_cooldown:
            stype, gid, _bp, si = self.stall_map[key]
            price = self._get_price(si)
            if stype == 0 and self.carrying is None and self.gold >= price:
                self.gold -= price
                self.carrying = gid
            elif stype == 1 and self.carrying == gid:
                self.gold += price
                self.carrying = None

        # Win check (before timer so last-step wins count)
        if self.gold >= self.target_gold and self.carrying is None:
            self.next_level()
            self.complete_action()
            return

        # Timer
        self.step_count += 1
        self.timer -= 1
        if self.timer <= 0:
            self.lose()
            self.complete_action()
            return

        # Rival movement
        if self.rival_pos is not None and self.step_count % self.rival_speed == 0:
            self._move_rival()

        # Cooldown ticks
        expired = [k for k, v in self.stall_cooldown.items() if v <= 1]
        for k in expired:
            del self.stall_cooldown[k]
        for k in list(self.stall_cooldown.keys()):
            if k not in expired:
                self.stall_cooldown[k] -= 1

        self.complete_action()
