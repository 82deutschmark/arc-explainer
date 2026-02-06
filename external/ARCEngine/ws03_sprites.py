
from arcengine import (
    ARCBaseGame,
    Camera,
    Level,
    Sprite,
)
import logging
from typing import List

# Define WS03 sprites (Jarring colors)
# Colors: 0=Black, 1=DarkGray, 4=Red?, 5=Gray, 6=Pink, 8=Red, 9=Maroon?, 11=Yellow, 12=Orange, 13=DarkRed, 14=Green, 15=Purple
# Screenshot shows: Black walls (0), Dark floor (1?), Pink/Purple/Yellow objects.

sprites = {
    "dcb": Sprite(
        pixels=[
            [-1, 6, -1],
            [6, 6, -1],
            [-1, 6, 6],
        ],
        name="dcb",
        visible=True,
        collidable=True,
        layer=1,
    ),
    "fij": Sprite(
        pixels=[
            [6, 6, 6],
            [-1, -1, 6],
            [6, -1, 6],
        ],
        name="fij",
        visible=True,
        collidable=False,
        layer=-2,
    ),
    "ggk": Sprite(
        pixels=[
            [5, 5, 5, 5, 5, 5, 5],
            [5, -1, -1, -1, -1, -1, 5],
            [5, -1, -1, -1, -1, -1, 5],
            [5, -1, -1, -1, -1, -1, 5],
            [5, -1, -1, -1, -1, -1, 5],
            [5, -1, -1, -1, -1, -1, 5],
            [5, 5, 5, 5, 5, 5, 5],
        ],
        name="ggk",
        visible=True,
        collidable=True,
        tags=["yar", "vdr"],
        layer=-3,
    ),
    "hep": Sprite(
        pixels=[[5]*10]*10,
        name="hep",
        visible=True,
        collidable=True,
        tags=["nfq"],
        layer=1,
    ),
    "hul": Sprite(
        pixels=[
            [13, 13, -1, -1, -1, -1, -1, 13, 13],
            [13]*9,
            [13]*9,
            [13]*9,
            [13]*9,
            [13]*9,
            [13]*9,
            [13]*9,
            [13]*9,
        ],
        name="hul",
        visible=True,
        collidable=True,
        layer=-4,
    ),
    "kdj": Sprite(
        pixels=[
            [6, -1, 6],
            [-1, 6, -1],
            [6, -1, 6],
        ],
        name="kdj",
        visible=True,
        collidable=True,
        tags=["wex"],
        layer=10,
    ),
    "kdy": Sprite(
        pixels=[
            [-2, -2, -2, -2, -2],
            [-2, -2, 6, -2, -2],
            [-2, 1, 6, 6, -2],
            [-2, -2, 1, -2, -2],
            [-2, -2, -2, -2, -2],
        ],
        name="kdy",
        visible=True,
        collidable=True,
        tags=["bgt"],
        layer=-1,
    ),
    "krg": Sprite(
        pixels=[[8]],
        name="krg",
        visible=True,
        collidable=True,
        layer=3,
    ),
    "lhs": Sprite(
        pixels=[[5]*5]*5,
        name="lhs",
        visible=True,
        collidable=False,
        tags=["mae"],
        layer=-3,
    ),
    "lyd": Sprite(
        pixels=[
            [-1, 6, -1],
            [-1, 6, -1],
            [6, 6, 6],
        ],
        name="lyd",
        visible=True,
        collidable=True,
    ),
    # mgu: Floor. Original ws03 had 5. Screenshot shows Dark Gray (1).
    # We construct it carefully.
    "mgu": Sprite(
        pixels=[[1, 1, 1, 1] + [-1]*60]*24 + [[4]*12 + [-1]*52, [4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4] + [-1]*52]*7 + [[4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4] + [1]*52]*3 + [[4]*12 + [1]*52],
        name="mgu",
        visible=True,
        collidable=True,
    ),
    "nio": Sprite(
        pixels=[
            [-1, 6, 6],
            [6, -1, 6],
            [-1, 6, -1],
        ],
        name="nio",
        visible=True,
        collidable=True,
    ),
    # nlo: Walls. Original ws03 had 4. Screenshot shows Black (0).
    "nlo": Sprite(
        pixels=[[0]*5]*5,
        name="nlo",
        visible=True,
        collidable=True,
        tags=["jdd"],
        layer=-5,
    ),
    "opw": Sprite(
        pixels=[
            [6, 6, -1],
            [-1, 6, 6],
            [6, -1, 6],
        ],
        name="opw",
        visible=True,
        collidable=True,
    ),
    "pca": Sprite(
        pixels=[
            [12]*5,
            [12]*5,
            [15]*5,
            [15]*5,
            [15]*5,
        ],
        name="pca",
        visible=True,
        collidable=True,
        tags=["caf"],
    ),
    "qqv": Sprite(
        pixels=[
            [-2, -2, -2, -2, -2],
            [-2, 15, 8, 8, -2],
            [-2, 15, 6, 11, -2],
            [-2, 12, 12, 11, -2],
            [-2, -2, -2, -2, -2],
        ],
        name="qqv",
        visible=True,
        collidable=False,
        tags=["gic"],
        layer=-1,
    ),
    "rzt": Sprite(
        pixels=[
            [6, -1, -1],
            [-1, 6, -1],
            [-1, -1, 6],
        ],
        name="rzt",
        visible=True,
        collidable=True,
        tags=["axa"],
    ),
    "snw": Sprite(
        pixels=[
            [5, 5, 5, 5, 5, 5, 5],
            [5, -1, -1, -1, -1, -1, 5],
            [5, -1, -1, -1, -1, -1, 5],
            [5, -1, -1, -1, -1, -1, 5],
            [5, -1, -1, -1, -1, -1, 5],
            [5, -1, -1, -1, -1, -1, 5],
            [5, 5, 5, 5, 5, 5, 5],
        ],
        name="snw",
        visible=True,
        collidable=True,
        tags=["yar"],
        layer=-3,
    ),
    "tmx": Sprite(
        pixels=[
            [6, -1, 6],
            [6, -1, 6],
            [6, 6, 6],
        ],
        name="tmx",
        visible=True,
        collidable=True,
    ),
    "tuv": Sprite(
        pixels=[[6]*10] + [[6] + [-1]*8 + [6]]*8 + [[6]*10],
        name="tuv",
        visible=False,
        collidable=True,
        tags=["fng"],
        layer=5,
    ),
    "ulq": Sprite(
        pixels=[[6]*7] + [[6] + [-1]*5 + [6]]*5 + [[6]*7],
        name="ulq",
        visible=False,
        collidable=True,
        tags=["qex"],
        layer=-1,
    ),
    "vxy": Sprite(
        pixels=[
            [-2, -2, -2, -2, -2],
            [-2, 6, -2, -2, -2],
            [-2, -2, 6, 6, -2],
            [-2, -2, 6, -2, -2],
            [-2, -2, -2, -2, -2],
        ],
        name="vxy",
        visible=True,
        collidable=False,
        tags=["gsu"],
        layer=-1,
    ),
    "zba": Sprite(
        pixels=[
            [11, 11, 11],
            [11, -1, 11],
            [11, 11, 11],
        ],
        name="zba",
        visible=True,
        collidable=False,
        tags=["iri"],
        layer=-1,
    ),
}
