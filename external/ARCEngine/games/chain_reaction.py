# MIT License
#
# Copyright (c) 2026 ARCEngine Contributors
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

import numpy as np
from arcengine import ARCBaseGame, Camera, Level, Sprite

sprites = {
    "plr": Sprite(
        pixels=[
            [-1, 12, -1],
            [12, 11, 12],
            [-1, 12, -1],
        ],
        name="plr",
        visible=True,
        collidable=True,
        layer=10,
        tags=["plr"],
    ),
    "ext": Sprite(
        pixels=[
            [7, 0, 7],
            [0, 1, 0],
            [7, 0, 7],
        ],
        name="ext",
        visible=True,
        collidable=True,
        layer=5,
        tags=["ext", "lck"],
    ),
    "exu": Sprite(
        pixels=[
            [14, 10, 14],
            [10, 11, 10],
            [14, 10, 14],
        ],
        name="exu",
        visible=True,
        collidable=True,
        layer=5,
        tags=["ext"],
    ),
    "bkr": Sprite(
        pixels=[
            [8, 13, 8],
            [13, 8, 13],
            [8, 13, 8],
        ],
        name="bkr",
        visible=True,
        collidable=True,
        layer=8,
        tags=["psh", "clr", "red"],
    ),
    "bkb": Sprite(
        pixels=[
            [9, 1, 9],
            [1, 9, 1],
            [9, 1, 9],
        ],
        name="bkb",
        visible=True,
        collidable=True,
        layer=8,
        tags=["psh", "clr", "blu"],
    ),
    "bky": Sprite(
        pixels=[
            [11, 4, 11],
            [4, 11, 4],
            [11, 4, 11],
        ],
        name="bky",
        visible=True,
        collidable=True,
        layer=8,
        tags=["psh", "clr", "ylw"],
    ),
    "bkc": Sprite(
        pixels=[
            [10, 9, 10],
            [9, 10, 9],
            [10, 9, 10],
        ],
        name="bkc",
        visible=True,
        collidable=True,
        layer=8,
        tags=["psh", "clr", "cyn"],
    ),
    "bkp": Sprite(
        pixels=[
            [15, 6, 15],
            [6, 15, 6],
            [15, 6, 15],
        ],
        name="bkp",
        visible=True,
        collidable=True,
        layer=8,
        tags=["psh", "clr", "pur"],
    ),
    "bkg": Sprite(
        pixels=[
            [14, 3, 14],
            [3, 14, 3],
            [14, 3, 14],
        ],
        name="bkg",
        visible=True,
        collidable=True,
        layer=8,
        tags=["psh", "clr", "grn"],
    ),
    "wl1": Sprite(
        pixels=[
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
        ],
        name="wl1",
        visible=True,
        collidable=True,
        layer=-1,
        tags=["wll"],
    ),
    "wl2": Sprite(
        pixels=[
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, 2, 2, 2, 2, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, 2, 2, 2, 2, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, 2, 2, 2, 2, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, 2, 2, 2, 2, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
        ],
        name="wl2",
        visible=True,
        collidable=True,
        layer=-1,
        tags=["wll"],
    ),
    "wl3": Sprite(
        pixels=[
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
            [2, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, 2],
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
        ],
        name="wl3",
        visible=True,
        collidable=True,
        layer=-1,
        tags=["wll"],
    ),
    "wl4": Sprite(
        pixels=[
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, -1, -1, 2],
            [2, -1, -1, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, -1, -1, 2],
            [2, -1, -1, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, -1, -1, 2],
            [2, -1, -1, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, -1, -1, 2],
            [2, -1, -1, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
        ],
        name="wl4",
        visible=True,
        collidable=True,
        layer=-1,
        tags=["wll"],
    ),
    "wl5": Sprite(
        pixels=[
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
            [2, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, 2, 2, -1, -1, -1, 2, 2, 2, 2, -1, -1, -1, -1, 2, 2, 2, 2, -1, -1, -1, 2, 2, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, 2, 2, -1, -1, -1, 2, 2, 2, 2, -1, -1, -1, -1, 2, 2, 2, 2, -1, -1, -1, 2, 2, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, -1, -1, 2],
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
        ],
        name="wl5",
        visible=True,
        collidable=True,
        layer=-1,
        tags=["wll"],
    ),
    "wl6": Sprite(
        pixels=[
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
            [2, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, 2],
            [2, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, 2, 2, 2, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2],
            [2, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, 2],
            [2, -1, -1, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, -1, -1, -1, 2],
            [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
        ],
        name="wl6",
        visible=True,
        collidable=True,
        layer=-1,
        tags=["wll"],
    ),
}

levels = [
    Level(
        sprites=[
            sprites["wl1"].clone().set_position(0, 0),
            sprites["plr"].clone().set_position(3, 12),
            sprites["ext"].clone().set_position(12, 12),
            sprites["bkr"].clone().set_position(5, 5),
            sprites["bkr"].clone().set_position(10, 8),
        ],
        grid_size=(16, 16),
        data={"ofs": (24, 24)},
        name="lv1",
    ),
    Level(
        sprites=[
            sprites["wl2"].clone().set_position(0, 0),
            sprites["plr"].clone().set_position(2, 13),
            sprites["ext"].clone().set_position(12, 13),
            sprites["bkb"].clone().set_position(3, 2),
            sprites["bkb"].clone().set_position(12, 11),
        ],
        grid_size=(16, 16),
        data={"ofs": (24, 24)},
        name="lv2",
    ),
    Level(
        sprites=[
            sprites["wl3"].clone().set_position(0, 0),
            sprites["plr"].clone().set_position(2, 17),
            sprites["ext"].clone().set_position(16, 17),
            sprites["bkr"].clone().set_position(2, 2),
            sprites["bkr"].clone().set_position(2, 10),
            sprites["bkb"].clone().set_position(16, 2),
            sprites["bkb"].clone().set_position(16, 10),
        ],
        grid_size=(20, 20),
        data={"ofs": (22, 22)},
        name="lv3",
    ),
    Level(
        sprites=[
            sprites["wl4"].clone().set_position(0, 0),
            sprites["plr"].clone().set_position(2, 17),
            sprites["ext"].clone().set_position(16, 17),
            sprites["bky"].clone().set_position(7, 6),
            sprites["bky"].clone().set_position(12, 6),
            sprites["bkc"].clone().set_position(7, 12),
            sprites["bkc"].clone().set_position(12, 12),
        ],
        grid_size=(20, 20),
        data={"ofs": (22, 22)},
        name="lv4",
    ),
    Level(
        sprites=[
            sprites["wl5"].clone().set_position(0, 0),
            sprites["plr"].clone().set_position(2, 21),
            sprites["ext"].clone().set_position(20, 21),
            sprites["bkr"].clone().set_position(3, 3),
            sprites["bkr"].clone().set_position(19, 19),
            sprites["bkb"].clone().set_position(19, 3),
            sprites["bkb"].clone().set_position(3, 19),
            sprites["bky"].clone().set_position(8, 9),
            sprites["bky"].clone().set_position(15, 14),
        ],
        grid_size=(24, 24),
        data={"ofs": (20, 20)},
        name="lv5",
    ),
    Level(
        sprites=[
            sprites["wl6"].clone().set_position(0, 0),
            sprites["plr"].clone().set_position(2, 21),
            sprites["ext"].clone().set_position(20, 21),
            sprites["bkr"].clone().set_position(5, 3),
            sprites["bkr"].clone().set_position(18, 19),
            sprites["bkp"].clone().set_position(3, 11),
            sprites["bkp"].clone().set_position(19, 11),
            sprites["bkg"].clone().set_position(11, 3),
            sprites["bkg"].clone().set_position(11, 19),
        ],
        grid_size=(24, 24),
        data={"ofs": (20, 20)},
        name="lv6",
    ),
]

CLR = frozenset({"red", "blu", "ylw", "cyn", "pur", "grn"})
WAL = 2


class ChainReaction(ARCBaseGame):
    plr: Sprite
    ext: Sprite
    wll: Sprite
    ulk: bool

    def __init__(self) -> None:
        super().__init__("chain_reaction", levels, Camera(0, 0, 16, 16, 5, 4))

    def on_set_level(self, level: Level) -> None:
        pls = level.get_sprites_by_tag("plr")
        if pls:
            self.plr = pls[0]

        exs = level.get_sprites_by_tag("ext")
        if exs:
            self.ext = exs[0]

        wls = level.get_sprites_by_tag("wll")
        if wls:
            self.wll = wls[0]

        self.ulk = False

        gsz = level.grid_size
        if gsz:
            self.camera.width = gsz[0]
            self.camera.height = gsz[1]

    def step(self) -> None:
        dx, dy = 0, 0
        if self.action.id.value == 1:
            dy = -1
        elif self.action.id.value == 2:
            dy = 1
        elif self.action.id.value == 3:
            dx = -1
        elif self.action.id.value == 4:
            dx = 1

        if dx != 0 or dy != 0:
            self.mov(dx, dy)

        self.upd()

        if self.ulk and self.plr.collides_with(self.ext):
            self.nxt()

        self.complete_action()

    def mov(self, dx: int, dy: int) -> None:
        nx = self.plr.x + dx
        ny = self.plr.y + dy

        blk = self.gbl(nx, ny, dx, dy)

        if blk is None:
            if not self.wlc(nx, ny):
                self.plr.move(dx, dy)
        elif "psh" in blk.tags:
            self.psh(blk, dx, dy)

    def gbl(self, x: int, y: int, dx: int, dy: int) -> Sprite | None:
        for spr in self.current_level.get_sprites():
            if spr == self.plr or spr == self.wll:
                continue
            if not spr.is_collidable or not spr.is_visible:
                continue
            if self.led(spr, x, y, dx, dy):
                return spr
        return None

    def led(self, spr: Sprite, x: int, y: int, dx: int, dy: int) -> bool:
        pcx = x + 1
        pcy = y + 1
        scx = spr.x + spr.width // 2
        scy = spr.y + spr.height // 2

        if dy == -1:
            if not (spr.x <= pcx < spr.x + spr.width):
                return False
            return spr.y <= y < spr.y + spr.height
        elif dy == 1:
            if not (spr.x <= pcx < spr.x + spr.width):
                return False
            return spr.y <= y + 2 < spr.y + spr.height
        elif dx == -1:
            if not (spr.y <= pcy < spr.y + spr.height):
                return False
            return spr.x <= x < spr.x + spr.width
        elif dx == 1:
            if not (spr.y <= pcy < spr.y + spr.height):
                return False
            return spr.x <= x + 2 < spr.x + spr.width
        return False

    def psh(self, blk: Sprite, dx: int, dy: int) -> None:
        bx = blk.x + dx
        by = blk.y + dy

        tgt = self.gbs(bx, by, blk)

        if tgt is None:
            if not self.wlc(bx, by):
                blk.move(dx, dy)
                self.plr.move(dx, dy)
        elif "clr" in tgt.tags:
            if self.mtc(blk, tgt):
                self.dpr(blk, tgt)
                self.plr.move(dx, dy)

    def mtc(self, b1: Sprite, b2: Sprite) -> bool:
        c1 = set(b1.tags) & CLR
        c2 = set(b2.tags) & CLR
        if len(c1) == 1 and len(c2) == 1:
            return c1 == c2
        return False

    def dpr(self, b1: Sprite, b2: Sprite) -> None:
        self.current_level.remove_sprite(b1)
        self.current_level.remove_sprite(b2)

    def gbs(self, x: int, y: int, exc: Sprite | None = None) -> Sprite | None:
        for spr in self.current_level.get_sprites():
            if spr == self.plr:
                continue
            if spr == self.wll:
                continue
            if spr == exc:
                continue
            if not spr.is_collidable:
                continue
            if not spr.is_visible:
                continue
            if self.occ(spr, x, y):
                return spr
        return None

    def occ(self, spr: Sprite, x: int, y: int) -> bool:
        for py in range(3):
            for px in range(3):
                cx = x + px
                cy = y + py
                if spr.x <= cx < spr.x + spr.width and spr.y <= cy < spr.y + spr.height:
                    return True
        return False

    def wlc(self, x: int, y: int) -> bool:
        for py in range(3):
            for px in range(3):
                wx = x + px
                wy = y + py
                lx = wx - self.wll.x
                ly = wy - self.wll.y
                if ly < 0 or ly >= len(self.wll.pixels):
                    return True
                if lx < 0 or lx >= len(self.wll.pixels[0]):
                    return True
                if self.wll.pixels[ly][lx] == WAL:
                    return True
        return False

    def cnt(self) -> int:
        clr = self.current_level.get_sprites_by_tag("clr")
        return len(clr)

    def upd(self) -> None:
        rem = self.cnt()
        if rem == 0 and not self.ulk:
            self.ulk = True
            exu = sprites["exu"].clone()
            exu.set_position(self.ext.x, self.ext.y)
            self.current_level.remove_sprite(self.ext)
            self.current_level.add_sprite(exu)
            self.ext = exu

    def nxt(self) -> None:
        if self.is_last_level():
            self.win()
        else:
            self.next_level()
