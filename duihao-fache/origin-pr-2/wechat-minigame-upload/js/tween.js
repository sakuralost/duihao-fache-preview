/* 对号发车 — 时间轴补间与路径 */
'use strict';

const env = require('./env');

const E = {
  lin: u => u,
  inQ: u => u * u,
  outQ: u => 1 - (1 - u) * (1 - u),
  inOutQ: u => u < .5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u),
  outC: u => 1 - Math.pow(1 - u, 3),
  inOutC: u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2,
  outBack: u => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
};
const lerp = (a, b, u) => a + (b - a) * u;
function angTo(cur, target) { return cur + ((((target - cur) % 360) + 540) % 360 - 180); }

function createClock() {
  let tasks = [];
  function add(start, dur, fn, done) {
    const t = { start, dur: Math.max(dur, 1e-4), fn, done };
    tasks.push(t);
    return t;
  }
  function at(time, fn) { return add(time, 1e-4, null, fn); }
  function cancelAll() { tasks = []; }
  function pump() {
    const t = env.now();
    const list = tasks;
    const keep = [];
    for (let i = 0; i < list.length; i++) {
      const k = list[i];
      if (t < k.start) { keep.push(k); continue; }
      const u = Math.min(1, (t - k.start) / k.dur);
      if (k.fn) k.fn(u);
      if (u >= 1) { if (k.done) k.done(); } else keep.push(k);
    }
    if (tasks === list) tasks = keep;
  }
  return { add, at, cancelAll, pump, E, lerp, angTo, now: env.now };
}

function buildPath(pts, radius) {
  const out = [];
  const pushLine = (a, b) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / 3));
    for (let i = 1; i <= n; i++) out.push({ x: lerp(a.x, b.x, i / n), y: lerp(a.y, b.y, i / n) });
  };
  out.push({ x: pts[0].x, y: pts[0].y });
  let cur = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = cur, p1 = pts[i], p2 = pts[i + 1];
    const d01 = Math.hypot(p1.x - p0.x, p1.y - p0.y), d12 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const r = Math.min(radius, d01 / 2, d12 / 2);
    const a = { x: p1.x - (p1.x - p0.x) / d01 * r, y: p1.y - (p1.y - p0.y) / d01 * r };
    const b = { x: p1.x + (p2.x - p1.x) / d12 * r, y: p1.y + (p2.y - p1.y) / d12 * r };
    pushLine(p0, a);
    for (let k = 1; k <= 8; k++) {
      const u = k / 8;
      out.push({
        x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * p1.x + u * u * b.x,
        y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * p1.y + u * u * b.y,
      });
    }
    cur = b;
  }
  pushLine(cur, pts[pts.length - 1]);
  const len = [0];
  for (let i = 1; i < out.length; i++) len.push(len[i - 1] + Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y));
  return { pts: out, len, total: len[len.length - 1] };
}

function pathAt(P, d) {
  d = Math.max(0, Math.min(P.total, d));
  let lo = 0, hi = P.len.length - 1;
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (P.len[m] <= d) lo = m; else hi = m; }
  const seg = P.len[hi] - P.len[lo] || 1, u = (d - P.len[lo]) / seg;
  const a = P.pts[lo], b = P.pts[hi];
  const i0 = Math.max(0, lo - 2), i1 = Math.min(P.pts.length - 1, hi + 2);
  const hx = P.pts[i1].x - P.pts[i0].x, hy = P.pts[i1].y - P.pts[i0].y;
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), rot: Math.atan2(hx, -hy) * 180 / Math.PI };
}

module.exports = { E, lerp, angTo, createClock, buildPath, pathAt };
