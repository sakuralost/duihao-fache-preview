// 关卡生成器：node gen2.js <specIndex> <seconds> <seed>  → 打印最佳候选 JSON
const L = require('../js/logic.js'); const { analyze, ascii } = require('./solver.js');
const SPECS = require('./specs.js');
function mk(seed) { return function () { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function generate(spec, secs, seed) {
  const rnd = mk(seed >>> 0); const pick = a => a[Math.floor(rnd() * a.length)];
  const vs = spec.veh.split(' ').map(t => ({ c: t[0], len: t.length > 1 ? +t[1] : 2 }));
  const caps = {}; vs.forEach(v => (caps[v.c] = caps[v.c] || []).push(v.len === 3 ? 6 : 4));
  function genQueue() {
    for (let tries = 0; tries < 300; tries++) {
      const chunks = [];
      for (const [c, cl] of Object.entries(caps)) {
        const total = cl.reduce((a, b) => a + b, 0);
        const gs = [2, 3, 4].filter(n => cl.every(cp => cp % n === 0) && (spec.groups || []).includes(n));
        // tokens
        const toks = []; let r = total;
        while (r > 0) {
          if (gs.length && rnd() < (spec.groupRate || 0)) { const n = pick(gs); if (n <= r) { toks.push(n); r -= n; continue; } }
          toks.push(1); r--;
        }
        // chunk tokens into runs of ~chunk pax
        let i = 0;
        while (i < toks.length) { const want = pick(spec.chunks); let n = 0, part = []; while (i < toks.length && n < want) { part.push(toks[i]); n += toks[i]; i++; } chunks.push({ c, part }); }
      }
      for (let i = chunks.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [chunks[i], chunks[j]] = [chunks[j], chunks[i]]; }
      let ok = true; for (let i = 1; i < chunks.length; i++) if (chunks[i].c === chunks[i - 1].c) ok = false;
      if (!ok) continue;
      return chunks.map(ch => ch.part.map(n => n === 1 ? ch.c : '(' + ch.c.repeat(n) + ')').join('')).join('');
    }
    return null;
  }
  function depth(s) {
    const memo = {}; const g = L.occGrid(s);
    function d(id, seen) { if (memo[id] != null) return memo[id]; if (seen.has(id)) return 99; seen.add(id);
      const v = s.veh[id]; let m = 0; for (const [x, y] of L.pathCells(s, v)) { const o = g[y * s.cols + x]; if (o >= 0 && o !== id) m = Math.max(m, 1 + d(o, seen)); }
      seen.delete(id); return memo[id] = m; }
    return Math.max(...s.veh.map(v => d(v.id, new Set())));
  }
  const end = Date.now() + secs * 1000; let best = null, n = 0;
  while (Date.now() < end) {
    n++;
    const occ = new Set(); const veh = []; let fail = false;
    const order = vs.slice().sort(() => rnd() - 0.5);
    for (const vv of order) {
      let placed = false;
      for (let t = 0; t < 80 && !placed; t++) {
        const dir = pick(spec.dirs || ['U', 'U', 'U', 'L', 'R', 'D']); const horiz = dir === 'L' || dir === 'R';
        const x = Math.floor(rnd() * (horiz ? 7 - vv.len : 6)), y = Math.floor(rnd() * (horiz ? 8 : 9 - vv.len));
        const cs = []; for (let k = 0; k < vv.len; k++) cs.push(horiz ? [x + k, y] : [x, y + k]);
        if (cs.some(([a, b]) => occ.has(a + ',' + b))) continue;
        cs.forEach(([a, b]) => occ.add(a + ',' + b)); const o = { c: vv.c, x, y, dir }; if (vv.len === 3) o.len = 3; veh.push(o); placed = true;
      }
      if (!placed) { fail = true; break; }
    }
    if (fail) continue;
    const queue = genQueue(); if (!queue) continue;
    const lv = { vehicles: veh, queue };
    const s = L.init(lv, 3); const dp = depth(s); if (dp < (spec.minDepth || 0) || dp >= 99 || dp > (spec.maxDepth || 9)) continue;
    const mv = L.movable(s); if (mv.length < (spec.minMov || 2) || mv.length > (spec.maxMov || 5)) continue;
    // 问号车：初始被挡的车里挑
    if (spec.mystery) { const blocked = s.veh.filter(v => !mv.includes(v.id)).map(v => v.id); if (blocked.length < spec.mystery) continue; blocked.sort(() => rnd() - 0.5).slice(0, spec.mystery).forEach(id => veh[id].m = 1); }
    const r = analyze(lv, 3, false); if (!r.solvable) continue;
    const r5 = analyze(lv, 5, false);
    let viol = 0;
    if (spec.maxR != null && r.pRandom > spec.maxR) viol += (r.pRandom - spec.maxR) * 4;
    if (spec.maxG != null && r.pGreedy > spec.maxG) viol += (r.pGreedy - spec.maxG) * 3;
    if (spec.minR != null && r.pRandom < spec.minR) viol += (spec.minR - r.pRandom) * 2;
    if (spec.minG != null && r.pGreedy < spec.minG) viol += (spec.minG - r.pGreedy) * 2;
    if (spec.needLose) { const lose = require('./solver.js').analyze(lv, 3, true).losing; if (!lose || lose.length > 6) viol += 0.15; }
    let score = viol * 12 + Math.abs(r.pRandom - spec.tR) * 2 + Math.abs(r.pGreedy - spec.tG);
    if (r5.pRandom < r.pRandom) score += 1;
    const rec = { score, viol, lv, r: { taps: r.taps, pRandom: r.pRandom, pGreedy: r.pGreedy, pR5: r5.pRandom, states: r.states }, dp };
    if (!best || rec.score < best.score) best = rec;
  }
  return { best, n };
}
module.exports = { generate };
if (require.main === module) {
  const i = +process.argv[2]; const spec = SPECS[i];
  const { best, n } = generate(spec, +(process.argv[3] || 20), +(process.argv[4] || 1));
  if (!best) { console.log(JSON.stringify({ i, none: true, n })); process.exit(0); }
  console.log(JSON.stringify({ i, n, score: best.score, dp: best.dp, r: best.r, lv: best.lv }));
}
