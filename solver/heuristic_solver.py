# Author: https://github.com/zoecarver/saturn-arc/tree/main ???  
# Date: 2025-10-12
# PURPOSE: Minimal ARC transform learner + predictor for integration with ARC Explainer.
# SRP/DRY check: Pass
# shadcn/ui: N/A (backend)

from __future__ import annotations
import json, sys, itertools
from dataclasses import dataclass
from typing import Callable, List, Tuple, Dict, Optional
import numpy as np

Grid = np.ndarray  # shape (H,W), dtype=int8, values 0..9

# ---------- grids.py ----------
def to_grid(a): return np.array(a, dtype=np.int8)
def from_grid(g: Grid): return [[int(x) for x in row] for row in g.tolist()]
def same_shape(a: Grid, b: Grid) -> bool: return a.shape == b.shape
def eq(a: Grid, b: Grid) -> bool: return a.shape == b.shape and np.array_equal(a, b)

def trim_zero_border(g: Grid) -> Grid:
    nz = np.argwhere(g != 0)
    if nz.size == 0: return g.copy()
    (r0,c0),(r1,c1) = nz.min(0), nz.max(0)
    return g[r0:r1+1, c0:c1+1]

def pad_to(g: Grid, shape: Tuple[int,int], fill: int=0) -> Grid:
    H,W = shape
    out = np.full((H,W), fill, dtype=np.int8)
    h,w = g.shape
    r0 = (H - h)//2
    c0 = (W - w)//2
    out[r0:r0+h, c0:c0+w] = g
    return out

def rotate_k(g: Grid, k: int) -> Grid:
    k = k % 4
    return np.rot90(g, k=k)

def flip(g: Grid, axis: int) -> Grid:
    return np.flip(g, axis=axis)

def transpose(g: Grid) -> Grid:
    return g.T.copy()

def scale_nn(g: Grid, k: int) -> Grid:
    # nearest-neighbor integer scale
    return np.kron(g, np.ones((k,k), dtype=np.int8))

def color_map(g: Grid, m: Dict[int,int]) -> Grid:
    out = g.copy()
    for s,t in m.items():
        out[g==s] = t
    return out

def most_common_color(g: Grid) -> int:
    vals, counts = np.unique(g, return_counts=True)
    return int(vals[counts.argmax()])

# ---------- Connected components (4-neigh) ----------
def cc_labels(g: Grid) -> Tuple[Grid, Dict[int,int]]:
    H,W = g.shape
    lab = np.full((H,W), -1, dtype=np.int32)
    cur = 0
    sizes = {}
    for r in range(H):
        for c in range(W):
            if g[r,c]==0 or lab[r,c]!=-1: continue
            # BFS
            q=[(r,c)]; lab[r,c]=cur; size=0
            col=g[r,c]
            while q:
                rr,cc=q.pop()
                size+=1
                for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
                    nr,nc=rr+dr,cc+dc
                    if 0<=nr<H and 0<=nc<W and lab[nr,nc]==-1 and g[nr,nc]==col:
                        lab[nr,nc]=cur; q.append((nr,nc))
            sizes[cur]=size; cur+=1
    return lab, sizes

def keep_largest_object(g: Grid) -> Grid:
    lab, sizes = cc_labels(g)
    if not sizes: return g
    k = max(sizes, key=sizes.get)
    out = np.zeros_like(g)
    out[lab==k] = g[lab==k]
    return out

# ---------- prims.py (parameterized transforms) ----------
@dataclass(frozen=True)
class Transform:
    name: str
    fn: Callable[[Grid], Grid]

def deduce_color_map(train_pairs: List[Tuple[Grid,Grid]]) -> Optional[Dict[int,int]]:
    # Require 1-1 mapping consistent across pairs for colors present in inputs
    mapping: Dict[int,int] = {}
    for xin, yout in train_pairs:
        cin = np.unique(xin)
        cout = np.unique(yout)
        # heuristic: if counts match and sizes similar, try by rank; else skip
        # better: check per-color majority mapping by argmax of y where xin==c
        for c in cin:
            mask = (xin==c)
            # choose most common color in output where input had c
            tgt = int(np.bincount(yout[mask].ravel(), minlength=10).argmax())
            if c in mapping and mapping[c]!=tgt: return None
            mapping[c]=tgt
    return mapping

def candidate_transforms(train_pairs: List[Tuple[Grid,Grid]]) -> List[Transform]:
    Ts: List[Transform] = []
    # geometry
    Ts += [Transform(f"rot{k*90}", lambda g,k=k: rotate_k(g,k)) for k in (0,1,2,3)]
    Ts += [Transform("flip_v", lambda g: flip(g,0))]
    Ts += [Transform("flip_h", lambda g: flip(g,1))]
    Ts += [Transform("transpose", transpose)]
    # object and framing
    Ts += [Transform("trim", trim_zero_border),
           Transform("largest_object", keep_largest_object)]
    # scaling
    Ts += [Transform("scale2", lambda g: scale_nn(g,2)),
           Transform("scale3", lambda g: scale_nn(g,3))]
    # color mapping learned
    cmap = deduce_color_map(train_pairs)
    if cmap:
        Ts.append(Transform("color_map", lambda g, m=cmap: color_map(g,m)))
    # identity and constant fill baselines
    Ts.append(Transform("identity", lambda g: g.copy()))
    # constant fill to most-common output color learned from pairs
    out_mode = most_common_color(np.block([ [y] for _,y in train_pairs ]))
    Ts.append(Transform("const_fill", lambda g, c=out_mode: np.full((g.shape[0], g.shape[1]), c, dtype=np.int8)))
    return Ts

# ---------- program.py ----------
def apply_with_shape_match(t: Transform, x: Grid, target_shape: Tuple[int,int]) -> Grid:
    y = t.fn(x)
    # pad or trim to match target if needed
    if y.shape == target_shape: return y
    # attempt centered trim or pad
    if y.shape[0] > target_shape[0] or y.shape[1] > target_shape[1]:
        y = trim_zero_border(y)
    if y.shape != target_shape:
        y = pad_to(y, target_shape, fill=0)
    return y

def fits_transform_on_all(t: Transform, train_pairs: List[Tuple[Grid,Grid]]) -> bool:
    for xin, yout in train_pairs:
        yhat = apply_with_shape_match(t, xin, yout.shape)
        if not eq(yhat, yout): return False
    return True

def compose(t1: Transform, t2: Transform) -> Transform:
    return Transform(f"{t1.name}∘{t2.name}", lambda g: t1.fn(t2.fn(g)))

def learn_program(train_pairs: List[Tuple[Grid,Grid]]) -> Optional[Transform]:
    Ts = candidate_transforms(train_pairs)

    # 1) single transform
    for t in Ts:
        if fits_transform_on_all(t, train_pairs):
            return t

    # 2) two-step compositions (prune with quick shape check)
    for t1, t2 in itertools.product(Ts, Ts):
        comp = compose(t1, t2)
        if fits_transform_on_all(comp, train_pairs):
            return comp

    # 3) fallback: trim then color_map then geometry tries
    trimT = Transform("trim", trim_zero_border)
    Ts2 = [Transform(f"{t.name}∘trim", lambda g, t=t: t.fn(trim_zero_border(g))) for t in Ts]
    for t in Ts2:
        if fits_transform_on_all(t, train_pairs):
            return t

    return None

# ---------- cli.py ----------
def load_task(path: str):
    obj = json.load(open(path, "r"))
    trains = [(to_grid(p["input"]), to_grid(p["output"])) for p in obj["train"]]
    tests = [to_grid(p["input"]) for p in obj["test"]]
    return trains, tests

def predict_for_task(task_path: str) -> Dict:
    trains, tests = load_task(task_path)
    prog = learn_program(trains)
    preds = []
    if prog is None:
        # last-resort: copy trimmed largest object and center to each test shape
        fallback = Transform("largest_object+center", lambda g: keep_largest_object(trim_zero_border(g)))
        prog = fallback
    for xin in tests:
        # pick a target shape using median train output shape
        hs, ws = zip(*[y.shape for _,y in trains])
        target_shape = (int(np.median(hs)), int(np.median(ws)))
        yhat = apply_with_shape_match(prog, xin, target_shape)
        preds.append(from_grid(yhat))
    return {
        "program": prog.name,
        "multiple_predicted_outputs": preds if len(preds)>1 else None,
        "predicted_output_grid": preds[0] if len(preds)==1 else None
    }

def main():
    if len(sys.argv)<2:
        print("usage: python solver/heuristic_solver.py /path/to/task.json"); sys.exit(2)
    path = sys.argv[1]
    out = predict_for_task(path)
    print(json.dumps(out))

if __name__ == "__main__":
    main()
