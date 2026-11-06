/* Author: Claude (original chart definitions), preserved by GPT-6.1 Sol
Date: 06-November-2026
PURPOSE: Preserve original article chart data and drawing definitions for offline reproduction; not loaded by the published article.
SRP/DRY check: Pass — original chart definitions reused, animation bootstrap omitted. */

(function () {
"use strict";
var NS = "http://www.w3.org/2000/svg";

/* ---------------- data (sources in D:\codex-work\kaggle-writeup-1104\README.md) ---------------- */
// ms of wall clock per 1,000 generated tokens, from serve.log (split_stages.py -> stages_split.json); a/b runs averaged
var TIME = [
  { d: "1 Oct", n: "Daniel Franzen's notebook, as published", s: "SGLang fork, MTP drafting, 10 games, 8-bit history cache", tok: 605, lanes: 10, acc: 2.69, step: 32.3,
    p: { decode: 1138.0, fresh: 147.5, reread: 111.8, perread: 103.0, idle: 152.2 }, runs: "daniel-base a + b" },
  { d: "3 Oct", n: "+ host-RAM cache tier, tuned drafter", s: "parked games keep their history; accepted tokens 2.69 → 2.89", tok: 648, lanes: 10, acc: 2.89, step: 32.7,
    p: { decode: 1086.9, fresh: 141.8, reread: 96.7, perread: 103.4, idle: 113.8 }, runs: "hicache aft06 a" },
  { d: "6 Oct", n: "+ 8-bit dense weights, exact kernels", s: "12 games; fused kernels; image hashing moved off the scheduler", tok: 992, lanes: 12, acc: 3.06, step: 28.3,
    p: { decode: 761.3, fresh: 83.6, reread: 86.2, perread: 54.8, idle: 22.9 }, runs: "bint8v2l12 c + e" },
  { d: "11 Oct", n: "+ 32 games, a third of the experts cut", s: "4-bit history cache, big-batch kernels, lost-history fix", tok: 1873, lanes: 32, acc: 3.05, step: 37.8,
    p: { decode: 384.5, fresh: 37.9, reread: 62.5, perread: 36.8, idle: 12.1 }, runs: "sc2l32ship a + b" },
  { d: "18 Oct", n: "52.82 config", s: "Mamba 180 slots, 140k window, 24 GB RAM tier", tok: 1934, lanes: 32, acc: 3.05, step: 36.6,
    p: { decode: 363.8, fresh: 37.1, reread: 45.7, perread: 34.6, idle: 36.1 }, runs: "52.82 twin a + b" },
  { d: "23 Oct", n: "56.02 config", s: "per-game verify depth, 4 draft steps, 3 guaranteed experts, 52k keep", tok: 2150, lanes: 32, acc: 3.25, step: 35.1,
    p: { decode: 330.0, fresh: 36.0, reread: 37.9, perread: 32.7, idle: 28.7 }, runs: "56.02 twin a + b", star: true },
  { d: "1 Nov", n: "After 56.02, not shipped", s: "splice, Lean turns, vocab trim; 75-game board", tok: 2441, lanes: 32, acc: 3.21, step: 34.0,
    p: { decode: 331.4, fresh: 24.5, reread: 17.3, perread: 32.0, idle: 4.6 }, runs: "cmb32 a + b", ghost: true }
];
var PARTS = [
  { k: "decode", label: "Decode", group: "Decode", c: "--c-decode" },
  { k: "fresh", label: "Prefill: new turn content", group: "Prefill", c: "--c-new" },
  { k: "reread", label: "Prefill: re-reading lost history", group: "Prefill", c: "--c-reread" },
  { k: "perread", label: "Overhead: fixed cost per read, stalls", group: "Overhead", c: "--c-perread" },
  { k: "idle", label: "Overhead: idle lanes", group: "Overhead", hatch: true }
];
var LADDER = [
  { d: "22 Sep", n: "vLLM, no drafting", tok: 296, lanes: 7 },
  { d: "1 Oct", n: "Daniel's notebook", tok: 605, lanes: 10 },
  { d: "3 Oct", n: "RAM cache tier", tok: 648, lanes: 10 },
  { d: "6 Oct", n: "8-bit, exact kernels", tok: 992, lanes: 12 },
  { d: "11 Oct", n: "32 games, expert cut", tok: 1873, lanes: 32 },
  { d: "18 Oct", n: "52.82 config", tok: 1934, lanes: 32 },
  { d: "23 Oct", n: "56.02 config", tok: 2150, lanes: 32, star: true },
  { d: "1 Nov", n: "after 56.02", tok: 2441, lanes: 32, ghost: true }
];
var STEP = [
  ["Experts", 15.8], ["8-bit dense layers + output head", 3.3], ["Draft chain and gaps", 2.7], ["Attention + indexer", 1.85],
  ["Hyper-connection mix", 1.6], ["Expert routing", 0.7], ["Linear attention", 0.7], ["Hyper-connection combine", 0.6], ["16-bit leftovers", 0.57]
];
var LANES = [[13, 24.0], [20, 30.2], [24, 33.4], [28, 36.5], [32, 38.5], [40, 47.3], [48, 52.5]];
var MEM = [
  { d: "22 Sep", n: "vLLM", p: [76.0, 0, 13.76, 0, 5.21], kv: "984k", lanes: 7 },
  { d: "3 Oct", n: "SGLang + drafter", p: [69.85, 4.75, 11.58, 3.40, 5.39], kv: "1.01M", lanes: 10 },
  { d: "11 Oct", n: "a fifth of experts cut", p: [54.29, 5.19, 17.76, 9.58, 8.15], kv: "2.76M", lanes: 24 },
  { d: "11 Oct", n: "a third of experts cut", p: [46.21, 5.89, 22.36, 11.81, 8.70], kv: "3.47M", lanes: 32 },
  { d: "17 Oct", n: "56.02 config", p: [46.21, 6.19, 24.48, 10.05, 8.04], kv: "3.80M", lanes: 32, star: true }
];
var MPARTS = [
  { label: "Model weights", c: "--c-decode" }, { label: "Draft model + its cache", c: "--c-new" },
  { label: "History cache", c: "--c-reread" }, { label: "Mamba states", c: "--c-yellow" }, { label: "Buffers, graphs, headroom", hatch: true }
];
// kind: i = inference, h = harness, b = both, x = resubmission / failure
var KAGGLE = [
  ["2026-09-21", 7.36, "b", "First Flash-Next notebook (vLLM)"],
  ["2026-09-22", 5.60, "h", "Prompt deletions"],
  ["2026-09-23", 6.17, "x", "Same notebook as 22 Sep, resubmitted"],
  ["2026-09-24", 6.74, "x", "Same notebook again"],
  ["2026-09-25", 6.47, "h", "Compact prompt v5"],
  ["2026-09-26", 4.83, "x", "Compact v5 resubmitted"],
  ["2026-09-27", 8.23, "i", "Moved to SGLang"],
  ["2026-09-28", 12.21, "i", "SGLang + expert pruning"],
  ["2026-09-29", 15.68, "b", "Pruning + temperature 0.8 + tuned drafter"],
  ["2026-09-30", 18.99, "b", "More pruning, temperature 0.6"],
  ["2026-10-01", 8.14, "i", "Different expert set (336)"],
  ["2026-10-02", 3.93, "h", "Our harness + Franzen's tool fixes (Combo A)"],
  ["2026-10-03", 28.94, "b", "Daniel Franzen's notebook + our drafter + animation feed"],
  ["2026-10-04", 27.79, "b", "4-bit cache, 13 games"],
  ["2026-10-05", 31.63, "i", "Host-RAM cache tier + fused 8-bit attention"],
  ["2026-10-06", 33.74, "i", "8-bit dense weights"],
  ["2026-10-07", 31.11, "i", "16-bit line, 11 games"],
  ["2026-10-08", 35.45, "i", "8-bit v3, 13 games"],
  ["2026-10-09", 35.32, "x", "8-bit v3 resubmitted"],
  ["2026-10-10", 39.24, "b", "20 games, 8/4-bit cache, fresh eyes when stuck"],
  ["2026-10-11", 41.69, "i", "A third of the experts cut, 28 games"],
  ["2026-10-12", 41.97, "i", "32 games, 8-bit activations"],
  ["2026-10-13", 37.56, "h", "Summary when the window fills"],
  ["2026-10-14", 38.45, "i", "Relaxed acceptance 0.7 + cache pinning"],
  ["2026-10-15", 47.25, "b", "Notes memory + exact acceptance + new drafter"],
  ["2026-10-16", 48.92, "b", "Notes head + tail, OOM fixes"],
  ["2026-10-17", 47.45, "h", "Goal first"],
  ["2026-10-18", 52.82, "b", "Mamba 180, 140k window, temperature 0.5"],
  ["2026-10-19", 41.37, "h", "Predict before acting"],
  ["2026-10-20", 51.12, "h", "RL LoRA merged at load"],
  ["2026-10-21", 44.68, "h", "Second RL LoRA"],
  ["2026-10-22", 0.00, "x", "Speed stack: model load took 66 min, scorecard closed"],
  ["2026-10-23", 56.02, "i", "Speed stack: per-game verify depth, 4 draft steps, 34 over 32"],
  ["2026-10-24", 47.33, "i", "+ splice + keep-alive"],
  ["2026-10-25", 45.49, "b", "+ splice v3 + game log"],
  ["2026-10-26", 49.34, "i", "Splice v3 stack alone"],
  ["2026-10-28", 53.70, "i", "Expert-kernel rounding + keep-alive + game gate"],
  ["2026-10-29", 49.07, "h", "+ predict before acting"],
  ["2026-10-30", 50.34, "x", "53.70 package resubmitted"],
  ["2026-10-31", 46.41, "b", "Lean turns + vocab trim"],
  ["2026-11-01", 48.37, "i", "53.70 + splice + vocab trim"],
  ["2026-11-02", 49.88, "i", "53.70 + vocab trim"]
];
var KLABEL = { "2026-09-30": "18.99", "2026-10-03": "Daniel's notebook", "2026-10-12": "32 games", "2026-10-15": "notes memory", "2026-10-18": "52.82", "2026-10-23": "56.02" };
var KIND = { i: { label: "Inference change", c: "--c-decode" }, h: { label: "Harness change", c: "--c-new" }, b: { label: "Both", c: "--c-violet" } };
var DELTA = [
  ["Mamba 180 + 140k window + temperature 0.5", 5.37, "47.45 → 52.82", true],
  ["Notes memory + new drafter (+ prompt kernels)", 5.28, "41.97 → 47.25", true],
  ["Speed stack (the 56.02)", 3.20, "52.82 → 56.02", true],
  ["Notes head + tail, OOM fixes", 1.67, "47.25 → 48.92", true],
  ["Goal first", -1.47, "48.92 → 47.45", true],
  ["RL LoRA merged at load", -1.70, "52.82 → 51.12", false],
  ["Expert-kernel rounding + keep-alive + gate", -2.32, "56.02 → 53.70", false],
  ["Same package, resubmitted", -3.36, "53.70 → 50.34", null],
  ["Vocab trim", -3.82, "53.70 → 49.88", false],
  ["Summary when the window fills", -4.41, "41.97 → 37.56", false],
  ["Predict before acting (2nd try)", -4.63, "53.70 → 49.07", false],
  ["Splice + vocab trim", -5.33, "53.70 → 48.37", false],
  ["Second RL LoRA", -8.14, "52.82 → 44.68", false],
  ["Splice + keep-alive", -8.69, "56.02 → 47.33", false],
  ["Lean turns + vocab trim", -9.61, "56.02 → 46.41", false],
  ["Predict before acting", -11.45, "52.82 → 41.37", false]
];

/* ---------------- helpers ---------------- */
function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function el(tag, a, parent, text) {
  var e = document.createElementNS(NS, tag);
  for (var k in a) if (a[k] !== undefined && a[k] !== null) e.setAttribute(k, a[k]);
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
function fmt(n, dp) { return Number(n).toLocaleString("en-US", { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 }); }
function svgFor(id, w, h) {
  var box = document.getElementById(id); box.innerHTML = "";
  var s = el("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h, role: "img", "font-family": css("--mono"), "font-size": 12 });
  box.appendChild(s);
  var defs = el("defs", {}, s);
  var pat = el("pattern", { id: id + "-hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
  el("rect", { width: 6, height: 6, fill: css("--panel") }, pat);
  el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: css("--c-hatch"), "stroke-width": 2 }, pat);
  return s;
}
function widthOf(id) { var w = document.getElementById(id).clientWidth; return Math.max(320, Math.round(w)); }
// bar segment that is rounded only at its data end (right) when last
function seg(s, x, y, w, h, fill, roundEnd) {
  if (w <= 0) return null;
  if (!roundEnd || w < 5) return el("rect", { x: x, y: y, width: w, height: h, fill: fill }, s);
  var r = 4;
  var d = "M" + x + "," + y + "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + h - r) +
    "Q" + (x + w) + "," + (y + h) + " " + (x + w - r) + "," + (y + h) + "H" + x + "Z";
  return el("path", { d: d, fill: fill }, s);
}
function legend(id, items) {
  var L = document.getElementById(id); if (!L) return; L.innerHTML = "";
  items.forEach(function (it) {
    var sp = document.createElement("span"); var i = document.createElement("i");
    if (it.hatch) i.className = "hatch"; else if (it.ring) i.className = "ring"; else { i.style.background = "var(" + it.c + ")"; if (it.dot) i.className = "dot"; }
    if (it.dash) { i.style.background = "transparent"; i.style.borderTop = "2px dashed var(--muted)"; i.style.height = "0"; i.style.borderRadius = "0"; }
    sp.appendChild(i); sp.appendChild(document.createTextNode(it.label)); L.appendChild(sp);
  });
}
function table(id, head, rows) {
  var t = "<table><thead><tr>" + head.map(function (h, i) { return "<th" + (i ? ' class="n"' : "") + ">" + h + "</th>"; }).join("") + "</tr></thead><tbody>";
  rows.forEach(function (r) { t += "<tr>" + r.map(function (c, i) { return "<td" + (i ? ' class="n"' : "") + ">" + c + "</td>"; }).join("") + "</tr>"; });
  document.getElementById(id).innerHTML = t + "</tbody></table>";
}
var tip = document.getElementById("tip");
function hover(node, html) {
  if (!node) return;
  node.style.cursor = "default";
  node.addEventListener("pointermove", function (e) {
    tip.innerHTML = html; tip.style.display = "block";
    var x = e.clientX + 14, y = e.clientY + 14, r = tip.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 14;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  });
  node.addEventListener("pointerleave", function () { tip.style.display = "none"; });
}
function axisText(s, x, y, t, anchor, size, fill, weight, family) {
  return el("text", { x: x, y: y, "text-anchor": anchor || "start", "font-size": size || 11, fill: fill || css("--muted"), "font-weight": weight || 400,
                      "font-family": family || undefined }, s, t);
}

/* ---------------- chart: time split ---------------- */
function drawTime() {
  var W = widthOf("chart-time"), narrow = W < 560;
  var right = narrow ? 92 : 150, left = 0, rowH = narrow ? 74 : 66, top = 8, barH = 20;
  var H = top + TIME.length * rowH + 34;
  var s = svgFor("chart-time", W, H), max = 1700, plotW = W - left - right;
  var X = function (v) { return left + v / max * plotW; };
  [0, 400, 800, 1200, 1600].forEach(function (t) {
    el("line", { x1: X(t), x2: X(t), y1: top, y2: H - 26, stroke: css("--c-grid"), "stroke-width": 1 }, s);
    axisText(s, X(t), H - 10, fmt(t) + (t === 1600 ? " ms" : ""), t === 0 ? "start" : "middle");
  });
  TIME.forEach(function (r, i) {
    var y0 = top + i * rowH, by = y0 + (narrow ? 39 : 34);
    var g = el("g", { opacity: r.ghost ? 0.5 : 1 }, s);
    axisText(g, left, y0 + 13, r.d + "  ·  " + r.n, "start", narrow ? 12 : 13, css("--ink"), 600, css("--body"));
    axisText(g, left, y0 + 26, r.s, "start", narrow ? 10.5 : 11.5, css("--ink-2"), 400, css("--body"));
    var x = X(0), tot = 0;
    PARTS.forEach(function (p) { tot += r.p[p.k]; });
    PARTS.forEach(function (p, j) {
      var w = r.p[p.k] / max * plotW, last = j === PARTS.length - 1;
      var fill = p.hatch ? "url(#chart-time-hatch)" : css(p.c);
      var node = seg(g, x, by, Math.max(0, w - (last ? 0 : 2)), barH, fill, last);
      if (node && p.hatch) node.setAttribute("stroke", css("--c-hatch")), node.setAttribute("stroke-width", 0.8);
      hover(node, "<b>" + r.d + " · " + r.n + "</b><br>" + p.label + ": <b>" + fmt(r.p[p.k]) + " ms</b> (" + fmt(100 * r.p[p.k] / tot) + "% of the run)");
      if (p.k === "decode" && w > 46) axisText(g, x + 6, by + 14, fmt(r.p.decode), "start", 11, css("--c-ontext"), 600);
      x += w;
    });
    axisText(g, X(tot) + 8, by + 10, fmt(tot) + " ms", "start", 12, css("--ink"), 600);
    axisText(g, X(tot) + 8, by + 23, fmt(r.tok) + " tok/s · " + r.lanes + " games", "start", 10.5, css("--ink-2"));
    if (r.star) el("rect", { x: -6, y: y0 - 3, width: W + 4, height: rowH + 1, fill: "none", stroke: css("--accent"), "stroke-width": 1.5, rx: 8 }, s);
  });
  axisText(s, X(max), H - 10, "", "end");
  legend("legend-time", PARTS.map(function (p) { return { label: p.label, c: p.c, hatch: p.hatch }; }));
  table("table-time", ["Stage", "Decode", "New turn", "Re-read", "Per read + stalls", "Idle lanes", "Total ms", "tok/s", "Games", "Accepted/pass", "Step ms", "Runs"],
    TIME.map(function (r) { var t = 0; PARTS.forEach(function (p) { t += r.p[p.k]; });
      return [r.d + " · " + r.n, fmt(r.p.decode), fmt(r.p.fresh), fmt(r.p.reread), fmt(r.p.perread), fmt(r.p.idle), fmt(t), fmt(r.tok), r.lanes, r.acc.toFixed(2), r.step.toFixed(1), r.runs]; }));
}

/* ---------------- chart: ladder ---------------- */
function drawLadder() {
  var W = widthOf("chart-ladder"), narrow = W < 560, H = 270, top = 26, bottom = narrow ? 52 : 46, left = 40, right = 6;
  var s = svgFor("chart-ladder", W, H), max = 2500, plotH = H - top - bottom, n = LADDER.length;
  var bw = (W - left - right) / n, Y = function (v) { return top + plotH - v / max * plotH; };
  [0, 500, 1000, 1500, 2000, 2500].forEach(function (t) {
    el("line", { x1: left, x2: W - right, y1: Y(t), y2: Y(t), stroke: css("--c-grid") }, s);
    axisText(s, left - 6, Y(t) + 4, fmt(t), "end");
  });
  LADDER.forEach(function (r, i) {
    var w = Math.min(54, bw * 0.62), x = left + i * bw + (bw - w) / 2, y = Y(r.tok), h = Y(0) - y;
    var d = "M" + x + "," + (y + h) + "V" + (y + 4) + "Q" + x + "," + y + " " + (x + 4) + "," + y + "H" + (x + w - 4) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + 4) + "V" + (y + h) + "Z";
    var node = el("path", { d: d, fill: r.ghost ? "url(#chart-ladder-hatch)" : css("--c-decode"), stroke: r.ghost ? css("--c-hatch") : "none" }, s);
    hover(node, "<b>" + r.d + " · " + r.n + "</b><br>" + fmt(r.tok) + " tokens per second, " + r.lanes + " games at once" + (r.ghost ? "<br>Never beat 56.02 on Kaggle" : ""));
    axisText(s, x + w / 2, y - 6, fmt(r.tok), "middle", 11.5, css("--ink"), 600);
    axisText(s, x + w / 2, H - bottom + 16, r.d, "middle", narrow ? 10 : 11, css("--ink-2"), r.star ? 600 : 400);
    axisText(s, x + w / 2, H - bottom + 30, r.lanes + " games", "middle", 10, css("--muted"));
    if (r.star) axisText(s, x + w / 2, y - 20, "56.02", "middle", 11, css("--accent"), 600);
  });
  table("table-ladder", ["Stage", "tok/s", "Games at once"], LADDER.map(function (r) { return [r.d + " · " + r.n, fmt(r.tok), r.lanes]; }));
}

/* ---------------- chart: step anatomy ---------------- */
function drawStep() {
  var W = widthOf("chart-step"), narrow = W < 560, labelW = narrow ? 150 : 230, rowH = 26, H = STEP.length * rowH + 6, right = 60;
  var s = svgFor("chart-step", W, H), max = 16, plotW = W - labelW - right;
  STEP.forEach(function (r, i) {
    var y = i * rowH + 4, w = r[1] / max * plotW;
    axisText(s, labelW - 10, y + 13, r[0], "end", narrow ? 11 : 12.5, css("--ink-2"), 400, css("--body"));
    var node = seg(s, labelW, y, w, 18, css("--c-decode"), true);
    hover(node, "<b>" + r[0] + "</b><br>" + r[1] + " ms of the 27.8 ms step (" + fmt(100 * r[1] / 27.8) + "%)");
    axisText(s, labelW + w + 6, y + 13, r[1] + " ms", "start", 11.5, css("--ink"), 600);
  });
  table("table-step", ["Part of the step", "ms", "share"], STEP.map(function (r) { return [r[0], r[1].toFixed(2), fmt(100 * r[1] / 27.8) + "%"]; }));
}

/* ---------------- chart: lanes ---------------- */
function drawLanes() {
  var W = widthOf("chart-lanes"), H = 250, top = 14, bottom = 40, left = 44, right = 96;
  var s = svgFor("chart-lanes", W, H), xmin = 10, xmax = 50, ymax = 90, plotW = W - left - right, plotH = H - top - bottom;
  var X = function (v) { return left + (v - xmin) / (xmax - xmin) * plotW; }, Y = function (v) { return top + plotH - v / ymax * plotH; };
  [0, 30, 60, 90].forEach(function (t) { el("line", { x1: left, x2: left + plotW, y1: Y(t), y2: Y(t), stroke: css("--c-grid") }, s); axisText(s, left - 6, Y(t) + 4, t + (t === 90 ? " ms" : ""), "end"); });
  [13, 20, 24, 28, 32, 40, 48].forEach(function (t) { axisText(s, X(t), H - bottom + 16, t, "middle"); });
  axisText(s, left + plotW / 2, H - 6, "games decoding at once", "middle", 11, css("--ink-2"));
  var lin = LANES.map(function (p) { return [p[0], 24.0 * p[0] / 13]; });
  el("path", { d: lin.map(function (p, i) { return (i ? "L" : "M") + X(p[0]) + "," + Y(p[1]); }).join(""), fill: "none", stroke: css("--muted"), "stroke-width": 2, "stroke-dasharray": "5 4" }, s);
  el("path", { d: LANES.map(function (p, i) { return (i ? "L" : "M") + X(p[0]) + "," + Y(p[1]); }).join("") + "L" + X(48) + "," + Y(0) + "L" + X(13) + "," + Y(0) + "Z", fill: css("--c-blue-soft") }, s);
  el("path", { d: LANES.map(function (p, i) { return (i ? "L" : "M") + X(p[0]) + "," + Y(p[1]); }).join(""), fill: "none", stroke: css("--c-decode"), "stroke-width": 2 }, s);
  LANES.forEach(function (p) {
    var ring = el("circle", { cx: X(p[0]), cy: Y(p[1]), r: p[0] === 32 ? 6 : 4.5, fill: css("--c-decode"), stroke: css("--panel"), "stroke-width": 2 }, s);
    var hit = el("circle", { cx: X(p[0]), cy: Y(p[1]), r: 14, fill: "transparent" }, s);
    hover(hit, "<b>" + p[0] + " games</b><br>measured step " + p[1] + " ms<br>if every game cost the same as at 13: " + (24.0 * p[0] / 13).toFixed(1) + " ms");
  });
  axisText(s, X(48) + 8, Y(52.5) + 4, "measured", "start", 11.5, css("--ink"), 600);
  axisText(s, X(48) + 8, Y(24 * 48 / 13) + 4, "linear", "start", 11.5, css("--ink-2"), 600);
  axisText(s, X(32), Y(38.5) + 20, "shipped: 32", "middle", 11, css("--accent"), 600);
  legend("legend-lanes", [{ label: "Measured step time", c: "--c-decode" }, { label: "If each game added the same time as at 13", dash: true }]);
  table("table-lanes", ["Games", "Measured step ms", "Linear ms"], LANES.map(function (p) { return [p[0], p[1].toFixed(1), (24 * p[0] / 13).toFixed(1)]; }));
}

/* ---------------- chart: memory ---------------- */
function drawMemory() {
  var W = widthOf("chart-memory"), narrow = W < 560, right = narrow ? 84 : 130, rowH = 52, top = 4, barH = 20;
  var H = top + MEM.length * rowH + 30, s = svgFor("chart-memory", W, H), max = 95, plotW = W - right;
  var X = function (v) { return v / max * plotW; };
  [0, 20, 40, 60, 80, 95].forEach(function (t) { el("line", { x1: X(t), x2: X(t), y1: top, y2: H - 24, stroke: css("--c-grid") }, s); axisText(s, X(t), H - 8, t + (t === 95 ? " GiB" : ""), t === 0 ? "start" : (t === 95 ? "end" : "middle")); });
  MEM.forEach(function (r, i) {
    var y0 = top + i * rowH, by = y0 + 20, x = 0;
    axisText(s, 0, y0 + 13, r.d + "  ·  " + r.n, "start", 12.5, css("--ink"), 600, css("--body"));
    r.p.forEach(function (v, j) {
      var p = MPARTS[j], w = X(v), last = j === r.p.length - 1;
      if (v > 0) {
        var node = seg(s, x, by, Math.max(0, w - (last ? 0 : 2)), barH, p.hatch ? "url(#chart-memory-hatch)" : css(p.c), last);
        if (node && p.hatch) node.setAttribute("stroke", css("--c-hatch")), node.setAttribute("stroke-width", 0.8);
        hover(node, "<b>" + r.d + " · " + r.n + "</b><br>" + p.label + ": <b>" + v.toFixed(2) + " GiB</b>");
        if (j === 0 && w > 50) axisText(s, x + 6, by + 14, v.toFixed(1), "start", 11, css("--c-ontext"), 600);
        if (j === 2 && w > 40) axisText(s, x + 6, by + 14, v.toFixed(1), "start", 11, css("--c-ontext"), 600);
      }
      x += w;
    });
    axisText(s, plotW + 8, by + 9, r.kv + " tokens", "start", 12, css("--ink"), 600);
    axisText(s, plotW + 8, by + 22, r.lanes + " games", "start", 10.5, css("--ink-2"));
  });
  legend("legend-memory", MPARTS.map(function (p) { return { label: p.label, c: p.c, hatch: p.hatch }; }));
  table("table-memory", ["Build", "Weights", "Draft + cache", "History cache", "Mamba", "Buffers + headroom", "History tokens", "Games"],
    MEM.map(function (r) { return [r.d + " · " + r.n].concat(r.p.map(function (v) { return v.toFixed(2); })).concat([r.kv, r.lanes]); }));
}

/* ---------------- chart: kaggle staircase (Keith's "where speed stopped helping", redrawn on white) ---------------- */
var STEPLABEL = {
  "2026-09-28": "SGLang + expert pruning", "2026-09-30": "T 0.6, tuned drafter",
  "2026-10-03": "Franzen's public notebook", "2026-10-08": "RAM tier, 8-bit weights, 13 games", "2026-10-10": "20 games, fresh eyes",
  "2026-10-11": "a third of experts cut, 28 → 32 games", "2026-10-15": "notes memory, exact acceptance", "2026-10-16": "notes head + tail",
  "2026-10-18": "Mamba 180, 140k window, T 0.5"
};
function drawKaggle() {
  var W = widthOf("chart-kaggle"), narrow = W < 560, H = narrow ? 360 : 410, top = 26, bottom = 34, left = 34, right = narrow ? 70 : 96;
  var s = svgFor("chart-kaggle", W, H), d0 = Date.parse("2026-09-19"), d1 = Date.parse("2026-11-03"), ymax = 60;
  var plotW = W - left - right, plotH = H - top - bottom;
  var X = function (d) { return left + (Date.parse(d) - d0) / (d1 - d0) * plotW; }, Y = function (v) { return top + plotH - v / ymax * plotH; };
  [0, 10, 20, 30, 40, 50, 60].forEach(function (t) {
    el("line", { x1: left, x2: left + plotW, y1: Y(t), y2: Y(t), stroke: css("--c-grid") }, s);
    axisText(s, left - 6, Y(t) + 4, t, "end");
  });
  [["2026-09-21", "21 Sep"], ["2026-10-01", "1 Oct"], ["2026-10-11", "11 Oct"], ["2026-10-21", "21 Oct"], ["2026-11-01", "1 Nov"]].forEach(function (t) {
    axisText(s, X(t[0]), H - 12, t[1], "middle");
  });
  axisText(s, left, 12, "public score", "start", 11, css("--ink-2"));
  var best = -1, recs = [];
  KAGGLE.forEach(function (r) { if (r[1] > best) { best = r[1]; recs.push(r); } });
  var d = "";
  recs.forEach(function (r, i) { d += i ? "H" + X(r[0]) + "V" + Y(r[1]) : "M" + X(r[0]) + "," + Y(r[1]); });
  d += "H" + X("2026-11-02");
  el("path", { d: d + "V" + Y(0) + "H" + X(recs[0][0]) + "Z", fill: css("--c-blue-soft") }, s);
  el("path", { d: d, fill: "none", stroke: css("--c-decode"), "stroke-width": 2 }, s);
  KAGGLE.forEach(function (r) {
    if (recs.indexOf(r) >= 0) return;
    var prev = 0;
    KAGGLE.forEach(function (q) { if (q[0] < r[0] && q[1] > prev) prev = q[1]; });
    el("circle", { cx: X(r[0]), cy: Y(r[1]), r: 3.6, fill: css("--panel"), stroke: css("--muted"), "stroke-width": 1.5 }, s);
    hover(el("circle", { cx: X(r[0]), cy: Y(r[1]), r: 10, fill: "transparent" }, s),
      "<b>" + r[0].slice(5) + " · " + r[1].toFixed(2) + "</b><br>" + r[3] + "<br>did not beat " + prev.toFixed(2));
  });
  recs.forEach(function (r) {
    el("circle", { cx: X(r[0]), cy: Y(r[1]), r: 4.5, fill: css("--c-decode"), stroke: css("--panel"), "stroke-width": 2 }, s);
    hover(el("circle", { cx: X(r[0]), cy: Y(r[1]), r: 11, fill: "transparent" }, s),
      "<b>" + r[0].slice(5) + " · " + r[1].toFixed(2) + "</b><br>" + r[3] + "<br>new best");
  });
  // step labels sit left of each riser, pushed apart so none overlap (top to bottom)
  var labs = recs.filter(function (r) { return STEPLABEL[r[0]]; }).map(function (r) { return { x: X(r[0]), y: Y(r[1]), t: STEPLABEL[r[0]] }; });
  labs.sort(function (p, q) { return p.y - q.y; });
  labs.forEach(function (l, i) { l.ly = l.y + 4; if (i && l.ly < labs[i - 1].ly + 15) l.ly = labs[i - 1].ly + 15; });
  labs.forEach(function (l) {
    if (l.ly - 4 - l.y > 3) el("line", { x1: l.x - 3, y1: l.y, x2: l.x - 9, y2: l.ly - 4, stroke: css("--muted"), "stroke-width": 1 }, s);
    axisText(s, l.x - 11, l.ly, l.t, "end", narrow ? 9.5 : 11, css("--ink-2"));
  });
  var last = recs[recs.length - 1], lx = X(last[0]), ly = Y(last[1]);
  axisText(s, lx + 8, ly - 10, "56.02", "start", narrow ? 18 : 24, css("--c-decode"), 600);
  axisText(s, lx - 11, ly + 4, "+11% tok/s, 34 games admitted", "end", narrow ? 9.5 : 11, css("--ink"), 600);
  axisText(s, X("2026-10-29"), Y(40.5), "after 56.02: nothing beat it", "middle", narrow ? 9.5 : 11, css("--muted"));
  legend("legend-kaggle", [{ label: "Best so far", c: "--c-decode", dot: true }, { label: "Didn't beat the best", ring: true }]);
  table("table-kaggle", ["Date", "Public score", "What changed"], KAGGLE.map(function (r) { return [r[0], r[1].toFixed(2), r[3]]; }));
  document.querySelectorAll("#table-kaggle td:nth-child(3), #table-kaggle th:nth-child(3)").forEach(function (t) { t.style.textAlign = "left"; t.style.whiteSpace = "normal"; });
}

/* ---------------- chart: deltas ---------------- */
function drawDelta() {
  var W = widthOf("chart-delta"), narrow = W < 560, labelW = narrow ? 150 : 300, rowH = 24, top = 6, right = 16;
  var H = top + DELTA.length * rowH + 30, s = svgFor("chart-delta", W, H), xmin = -14, xmax = 7, plotW = W - labelW - right;
  var X = function (v) { return labelW + (v - xmin) / (xmax - xmin) * plotW; };
  el("rect", { x: X(-3.36), y: top - 2, width: X(3.36) - X(-3.36), height: DELTA.length * rowH, fill: css("--c-grid"), rx: 4 }, s);
  [-12, -9, -6, -3, 0, 3, 6].forEach(function (t) { el("line", { x1: X(t), x2: X(t), y1: top - 2, y2: top + DELTA.length * rowH, stroke: t === 0 ? css("--ink-2") : css("--c-grid"), "stroke-width": t === 0 ? 1.2 : 1 }, s); axisText(s, X(t), H - 10, (t > 0 ? "+" : "") + t, "middle"); });
  DELTA.forEach(function (r, i) {
    var y = top + i * rowH + rowH / 2;
    axisText(s, labelW - 10, y + 4, r[0], "end", narrow ? 10.5 : 12, r[3] === null ? css("--muted") : css("--ink-2"), r[3] === null ? 600 : 400, css("--body"));
    el("line", { x1: X(0), x2: X(r[1]), y1: y, y2: y, stroke: css("--line"), "stroke-width": 2 }, s);
    var c = r[3] === null ? css("--muted") : (r[3] ? css("--c-decode") : css("--c-new"));
    var dot = el("circle", { cx: X(r[1]), cy: y, r: 5.5, fill: r[3] === false ? css("--panel") : c, stroke: r[3] === false ? c : css("--panel"), "stroke-width": r[3] === false ? 2 : 2 }, s);
    var hit = el("circle", { cx: X(r[1]), cy: y, r: 12, fill: "transparent" }, s);
    hover(hit, "<b>" + r[0] + "</b><br>" + r[2] + " (" + (r[1] > 0 ? "+" : "") + r[1].toFixed(2) + ")" + (r[3] === true ? "<br>Kept" : r[3] === false ? "<br>Dropped" : ""));
    var lab = (r[1] > 0 ? "+" : "") + r[1].toFixed(1);
    axisText(s, r[1] >= 0 ? X(r[1]) + 9 : X(r[1]) - 9, y + 4, lab, r[1] >= 0 ? "start" : "end", 11, css("--ink"), 600);
  });
  legend("legend-delta", [{ label: "Kept", c: "--c-decode", dot: true }, { label: "Dropped, or never beat its base", ring: true }, { label: "Same-package spread (noise)", c: "--c-grid" }]);
  table("table-delta", ["Idea", "Change", "Scores"], DELTA.map(function (r) { return [r[0], (r[1] > 0 ? "+" : "") + r[1].toFixed(2), r[2]]; }));
}


/* ---------------- chart: thinking length vs score ---------------- */
var THINK = [
  ["8-bit Mamba states", -19.3, -0.5, "961 / 778 vs 1,044 / 1,111 tokens per move; board 60.2 vs 60.7"],
  ["3-bit + 8-bit states, 194k window", -36.9, -5.9, "639 / 769 vs 1,056 / 1,177; board 45.4 / 43.8 vs 51.9 / 49.0"],
  ["3-bit + corrector LoRA", 45.0, -8.8, "1,514 / 1,659 vs 1,037 / 1,151; board 40.2 / 43.1 vs 51.9 / 49.0"],
  ["3-bit + corrector, medium effort", 50.8, -8.6, "1,592 / 1,707 vs 1,037 / 1,151; board 40.4 / 43.3 vs 51.9 / 49.0"],
  ["RL5", -47.3, -22.0, "median reply 2,657 to 1,401 tokens; 32-game set 51.5 to 29.5"]
];
function drawThink() {
  var W = widthOf("chart-think"), narrow = W < 560, H = 330, top = 14, bottom = 40, left = 44, right = 16;
  var s = svgFor("chart-think", W, H), xmin = -60, xmax = 60, ymin = -25, ymax = 5;
  var plotW = W - left - right, plotH = H - top - bottom;
  var X = function (v) { return left + (v - xmin) / (xmax - xmin) * plotW; }, Y = function (v) { return top + (ymax - v) / (ymax - ymin) * plotH; };
  el("rect", { x: left, y: Y(1.9), width: plotW, height: Y(-1.9) - Y(1.9), fill: css("--c-grid") }, s);
  [-25, -20, -15, -10, -5, 0, 5].forEach(function (t) {
    el("line", { x1: left, x2: left + plotW, y1: Y(t), y2: Y(t), stroke: t === 0 ? css("--ink-2") : css("--c-grid"), "stroke-width": t === 0 ? 1.2 : 1 }, s);
    axisText(s, left - 6, Y(t) + 4, (t > 0 ? "+" : "") + t, "end");
  });
  [-60, -40, -20, 0, 20, 40, 60].forEach(function (t) {
    el("line", { x1: X(t), x2: X(t), y1: top, y2: top + plotH, stroke: t === 0 ? css("--ink-2") : css("--c-grid"), "stroke-width": t === 0 ? 1.2 : 1 }, s);
    axisText(s, X(t), H - 22, (t > 0 ? "+" : "") + t + "%", "middle");
  });
  axisText(s, left + plotW / 2, H - 6, "change in thinking per move", "middle", 11, css("--ink-2"));
  axisText(s, left + 4, top + 12, "score change (points)", "start", 11, css("--ink-2"));
  axisText(s, X(58), Y(1.9) - 4, "board noise, 1 SD", "end", 10, css("--muted"));
  THINK.forEach(function (r) {
    var cx = X(r[1]), cy = Y(r[2]);
    el("circle", { cx: cx, cy: cy, r: 6, fill: css("--c-new"), stroke: css("--panel"), "stroke-width": 2 }, s);
    hover(el("circle", { cx: cx, cy: cy, r: 13, fill: "transparent" }, s), "<b>" + r[0] + "</b><br>thinking " + (r[1] > 0 ? "+" : "") + r[1] + "%, score " + r[2] + "<br>" + r[3]);
    var right = r[1] < 20;
    axisText(s, right ? cx + 10 : cx - 10, cy + (r[0].indexOf("medium") >= 0 ? 16 : (r[0] === "3-bit + corrector LoRA" ? -8 : 4)), r[0], right ? "start" : "end", narrow ? 10 : 11.5, css("--ink"), 500, css("--body"));
  });
  legend("legend-think", [{ label: "Training run or lossy speed change, against its own control", c: "--c-new", dot: true }, { label: "Board noise (1 SD)", c: "--c-grid" }]);
  table("table-think", ["Change", "Thinking per move", "Score change", "Numbers"], THINK.map(function (r) { return [r[0], (r[1] > 0 ? "+" : "") + r[1] + "%", r[2].toFixed(1), r[3]]; }));
}

/* ---------------- waterfalls: decode, prefill, overhead, build by build (ms per 1,000 generated tokens, from TIME) ---------------- */
var WF = {
  decode: { c: "--c-decode", max: 1200, ticks: [0, 300, 600, 900, 1200], steps: [
    ["1 Oct", "Daniel's notebook", 1138.0], ["3 Oct", "tuned drafter", 1086.9], ["6 Oct", "8-bit weights, exact kernels, 12 games", 761.3],
    ["11 Oct", "32 games: experts cut, 4-bit cache, big-batch kernels", 384.5], ["18 Oct", "Mamba 180, 140k window", 363.8],
    ["23 Oct", "per-game verify depth, 4 draft steps, 3 experts", 330.0]] },
  prefill: { c: "--c-new", max: 300, ticks: [0, 100, 200, 300], steps: [
    ["1 Oct", "Daniel's notebook", 259.3], ["3 Oct", "host-RAM tier", 238.5], ["6 Oct", "8-bit weights, faster prompt-read experts", 169.8],
    ["11 Oct", "verbatim history, prompt kernels", 100.4], ["18 Oct", "140k window, RAM tier, pinned checkpoints", 82.8],
    ["23 Oct", "52k keep, fused prompt glue", 73.9]] },
  overhead: { c: "--c-perread", max: 300, ticks: [0, 100, 200, 300], steps: [
    ["1 Oct", "Daniel's notebook", 255.2], ["3 Oct", "harness changes: fewer idle lanes", 217.2],
    ["6 Oct", "image hash off the scheduler, zero-copy hand-off", 77.7], ["11 Oct", "prompt-read CUDA graphs, 32 games", 48.9],
    ["18 Oct", "longer board runs: more idle lanes", 70.7], ["23 Oct", "34 games over 32 lanes", 61.4]] }
};
function wrapWords(s, n) {
  var out = [], line = "";
  s.split(" ").forEach(function (w) { if ((line + " " + w).trim().length > n && line) { out.push(line); line = w; } else { line = (line + " " + w).trim(); } });
  if (line) out.push(line);
  return out;
}
function drawWF(key) {
  var cfg = WF[key], id = "chart-wf-" + key, W = widthOf(id), narrow = W < 560;
  var n = cfg.steps.length + 1, top = 26, left = 44, right = 8, labelH = narrow ? 74 : 64, H = 300 + labelH;
  var s = svgFor(id, W, H), plotH = H - top - labelH - 6, plotW = W - left - right, slot = plotW / n;
  var Y = function (v) { return top + plotH - v / cfg.max * plotH; };
  var col = css(cfg.c), bw = Math.min(54, slot * 0.56);
  cfg.ticks.forEach(function (t) {
    el("line", { x1: left, x2: left + plotW, y1: Y(t), y2: Y(t), stroke: css("--c-grid") }, s);
    axisText(s, left - 6, Y(t) + 4, fmt(t) + (t === cfg.max ? " ms" : ""), "end");
  });
  function bar(i, v0, v1, kind, tip) {
    var x = left + i * slot + (slot - bw) / 2, ya = Y(Math.max(v0, v1)), yb = Y(Math.min(v0, v1));
    var node;
    if (kind === "full") {
      node = el("rect", { x: x, y: ya, width: bw, height: yb - ya, rx: 4, fill: col }, s);
    } else if (kind === "drop") {
      node = el("rect", { x: x, y: ya, width: bw, height: Math.max(1, yb - ya), rx: 3, fill: col, "fill-opacity": 0.18, stroke: col, "stroke-width": 1.4, "stroke-dasharray": "4 3" }, s);
    } else {
      node = el("rect", { x: x, y: ya, width: bw, height: Math.max(1, yb - ya), rx: 3, fill: "url(#" + id + "-hatch)", stroke: css("--muted"), "stroke-width": 1.2 }, s);
    }
    hover(node, tip);
    return x;
  }
  var st = cfg.steps, prev = st[0][2];
  var x0 = bar(0, 0, prev, "full", "<b>" + st[0][0] + " · " + st[0][1] + "</b><br>" + fmt(prev, 1) + " ms per 1,000 tokens");
  axisText(s, x0 + bw / 2, Y(prev) - 7, fmt(prev), "middle", 12, css("--ink"), 600);
  for (var i = 1; i < st.length; i++) {
    var v = st[i][2], d = v - prev, x = bar(i, prev, v, d <= 0 ? "drop" : "rise",
      "<b>" + st[i][0] + " · " + st[i][1] + "</b><br>" + fmt(prev, 1) + " → " + fmt(v, 1) + " ms (" + (d > 0 ? "+" : "") + fmt(d, 1) + ")");
    el("line", { x1: left + (i - 1) * slot + (slot + bw) / 2, x2: x, y1: Y(prev), y2: Y(prev), stroke: css("--muted"), "stroke-width": 1, "stroke-dasharray": "2 3" }, s);
    axisText(s, x + bw / 2, (d <= 0 ? Y(prev) : Y(v)) - 7, (d > 0 ? "+" : "−") + fmt(Math.abs(d)), "middle", 11.5, d > 0 ? css("--muted") : css("--ink"), 600);
    prev = v;
  }
  var last = st[st.length - 1][2], xe = bar(n - 1, 0, last, "full", "<b>56.02 config</b><br>" + fmt(last, 1) + " ms per 1,000 tokens");
  el("line", { x1: left + (n - 2) * slot + (slot + bw) / 2, x2: xe, y1: Y(last), y2: Y(last), stroke: css("--muted"), "stroke-width": 1, "stroke-dasharray": "2 3" }, s);
  axisText(s, xe + bw / 2, Y(last) - 7, fmt(last), "middle", 12, css("--ink"), 600);
  var lab = [[st[0][0], "start: " + st[0][1]]].concat(st.slice(1).map(function (r) { return [r[0], r[1]]; })).concat([["23 Oct", "the 56.02 config"]]);
  lab.forEach(function (l, i) {
    var cx = left + i * slot + slot / 2, yb = top + plotH + 16;
    axisText(s, cx, yb, l[0], "middle", narrow ? 10 : 11, css("--ink"), 600, css("--body"));
    wrapWords(l[1], narrow ? 11 : 17).slice(0, 4).forEach(function (w, j) { axisText(s, cx, yb + 14 + j * 12, w, "middle", narrow ? 9 : 10, css("--ink-2"), 400, css("--body")); });
  });
  table("table-wf-" + key, ["Build", "ms per 1,000 tokens", "Change"], st.map(function (r, i) {
    return [r[0] + " · " + r[1], fmt(r[2], 1), i ? ((r[2] - st[i - 1][2] > 0 ? "+" : "") + fmt(r[2] - st[i - 1][2], 1)) : ""];
  }));
}

/* ---------------- board vs Kaggle, idea by idea ---------------- */
// [idea, board delta (null = no clean board A/B), Kaggle delta, board numbers, Kaggle numbers, kept]
var DELTA2 = [
  ["Notes memory, relaxed acceptance off", 2.75, 8.80, "60.8 vs 58.1 (4 vs 2 runs)", "38.45 → 47.25", true],
  ["Mamba 180, 140k window, temperature 0.5", 4.3, 5.37, "32-game set 54.7 vs 50.4", "47.45 → 52.82", true],
  ["Speed stack (the 56.02)", -1.0, 3.20, "62.1 vs 63.1", "52.82 → 56.02", true],
  ["Notes head + tail, OOM fixes", 1.3, 1.67, "62.1 vs 60.8 (3 vs 4 runs)", "47.25 → 48.92", true],
  ["Goal first", 2.9, -1.47, "one run, 65.0 vs 62.1", "48.92 → 47.45", true],
  ["RL LoRA merged at load", null, -1.70, "no matching board test", "52.82 → 51.12", false],
  ["Expert-kernel rounding, keep-alive, gate", 0.2, -2.32, "62.9 vs 62.7", "56.02 → 53.70", false],
  ["Same package, resubmitted", null, -3.36, "board noise: SD 1.9", "53.70 → 50.34", null],
  ["Relaxed acceptance 0.7, new drafter", 5.0, -3.52, "49.75 vs 44.8", "41.97 → 38.45", false],
  ["Vocab trim", -0.2, -3.82, "66.1 vs 66.2 (4 vs 6 runs)", "53.70 → 49.88", false],
  ["Summary when the window fills", 0.65, -4.41, "45.5 vs 44.8", "41.97 → 37.56", false],
  ["Predict before acting (2nd try)", 2.3, -4.63, "63.9 vs 61.7", "53.70 → 49.07", false],
  ["Splice + vocab trim", 0.4, -5.33, "64.6 vs 64.2", "53.70 → 48.37", false],
  ["Second RL LoRA", null, -8.14, "no matching board test", "52.82 → 44.68", false],
  ["Splice + keep-alive", 2.6, -8.69, "64.7 vs 62.1", "56.02 → 47.33", false],
  ["Lean turns + vocab trim", 1.9, -9.61, "66.1 vs 64.2", "56.02 → 46.41", false],
  ["Predict before acting", 0.7, -11.45, "copycats 60.2 vs 59.5", "52.82 → 41.37", false]
];
function delta2Tally() {
  var up = DELTA2.filter(function (r) { return r[1] !== null && r[1] > 0; });
  return { up: up.length, agree: up.filter(function (r) { return r[2] > 0; }).length, flip: up.filter(function (r) { return r[2] < 0; }).length };
}
function drawDelta2() {
  var W = widthOf("chart-delta2"), narrow = W < 560, labelW = narrow ? 150 : 290, rowH = 27, top = 8, right = 16;
  var H = top + DELTA2.length * rowH + 32, s = svgFor("chart-delta2", W, H), xmin = -14.5, xmax = 10, plotW = W - labelW - right;
  var X = function (v) { return labelW + (v - xmin) / (xmax - xmin) * plotW; };
  var orange = css("--c-new"), blue = css("--c-decode"), grey = css("--muted");
  var t = delta2Tally();
  ["d2-up", "d2-agree", "d2-flip"].forEach(function (id, i) { var n = document.getElementById(id); if (n) n.textContent = [t.up, t.agree, t.flip][i]; });
  // rows where the board said "better" and Kaggle said "worse"
  DELTA2.forEach(function (r, i) {
    if (r[1] !== null && r[1] > 0 && r[2] < 0)
      el("rect", { x: 0, y: top + i * rowH + 1, width: W, height: rowH - 2, fill: css("--c-orange-soft"), rx: 4, "data-a": "band", "data-row": i }, s);
  });
  el("rect", { x: X(-3.36), y: top - 2, width: X(3.36) - X(-3.36), height: DELTA2.length * rowH, fill: css("--c-grid"), "fill-opacity": 0.6, rx: 4, "data-a": "bg" }, s);
  el("rect", { x: X(-1.9), y: top - 2, width: X(1.9) - X(-1.9), height: DELTA2.length * rowH, fill: css("--c-blue-soft"), "fill-opacity": 0.85, rx: 4, "data-a": "bg" }, s);
  [-12, -9, -6, -3, 0, 3, 6, 9].forEach(function (v) {
    el("line", { x1: X(v), x2: X(v), y1: top - 2, y2: top + DELTA2.length * rowH, stroke: v === 0 ? css("--ink-2") : css("--c-grid"), "stroke-width": v === 0 ? 1.2 : 1, "data-a": "bg" }, s);
    axisText(s, X(v), H - 12, (v > 0 ? "+" : "") + v, "middle").setAttribute("data-a", "bg");
  });
  DELTA2.forEach(function (r, i) {
    var y = top + i * rowH + rowH / 2, b = r[1], k = r[2], flip = b !== null && b > 0 && k < 0;
    axisText(s, labelW - 10, y + 4, r[0], "end", narrow ? 10.5 : 12, r[5] === null ? grey : css("--ink-2"), r[5] === null ? 600 : 400, css("--body")).setAttribute("data-a", "label");
    if (b !== null && Math.abs(X(k) - X(b)) > 16) {
      var dir = k < b ? -1 : 1, tipX = X(k) - dir * 8, col = flip ? orange : grey;
      // the line's far end stays on the arrowhead's base while both travel (data-o is the scale origin for the animation)
      el("line", { x1: X(b) + dir * 6, x2: tipX - dir * 7, y1: y, y2: y, stroke: col, "stroke-width": flip ? 2.4 : 1.6, "data-a": "arrow", "data-row": i,
                   "data-o": X(b) - dir * 15 }, s);
      el("path", { d: "M" + tipX + "," + y + " L" + (tipX - dir * 8) + "," + (y - 4.5) + " L" + (tipX - dir * 8) + "," + (y + 4.5) + " z", fill: col,
                   "data-a": "head", "data-row": i, "data-dx": X(b) - X(k) }, s);
    }
    if (b !== null) {
      el("circle", { cx: X(b), cy: y, r: 5.5, fill: blue, stroke: css("--panel"), "stroke-width": 2, "data-a": "board", "data-row": i }, s);
      hover(el("circle", { cx: X(b), cy: y, r: 12, fill: "transparent" }, s), "<b>" + r[0] + "</b><br>board " + (b > 0 ? "+" : "") + b.toFixed(1) + ": " + r[3]);
    }
    el("circle", { cx: X(k), cy: y, r: 5.5, fill: css("--panel"), stroke: orange, "stroke-width": 2.2, "data-a": "kaggle", "data-row": i,
                   "data-dx": b === null ? 0 : X(b) - X(k) }, s);
    hover(el("circle", { cx: X(k), cy: y, r: 12, fill: "transparent" }, s), "<b>" + r[0] + "</b><br>Kaggle " + (k > 0 ? "+" : "") + k.toFixed(2) + ": " + r[4]);
    var lab = (k > 0 ? "+" : "") + k.toFixed(1), left = b === null ? true : k < b;
    axisText(s, left ? X(k) - 10 : X(k) + 10, y + 4, lab, left ? "end" : "start", 11, orange, 600).setAttribute("data-a", "klabel");
  });
  legend("legend-delta2", [{ label: "Our board", c: "--c-decode", dot: true }, { label: "Kaggle", ring: true }, { label: "Board said better, Kaggle said worse", c: "--c-orange-soft" },
    { label: "Board noise, 1 SD", c: "--c-blue-soft" }, { label: "Kaggle, same package twice", c: "--c-grid" }]);
  var ring = document.querySelector("#legend-delta2 i.ring"); if (ring) ring.style.borderColor = "var(--c-new)";
}


})();
