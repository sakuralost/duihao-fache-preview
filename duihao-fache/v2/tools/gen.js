const L = require('../js/logic.js'); const { analyze, ascii } = require('./solver.js');
let seed = (+process.argv[2] || 1) >>> 0; function rnd() { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
const colors = (process.argv[3] || 'AAABBBCCDD').split('');
const spots = +(process.argv[4] || 4);
function genQueue(counts) { // chunks of 2-4, interleave, no same adjacent
  for (let tries = 0; tries < 200; tries++) {
    const chunks = [];
    for (const [c, n] of Object.entries(counts)) { let r = n; while (r > 0) { let k = Math.min(r, pick([2, 2, 3, 4])); if (r - k === 1) k = r <= 4 ? r : k - 1; chunks.push(c.repeat(k)); r -= k; } }
    for (let i = chunks.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [chunks[i], chunks[j]] = [chunks[j], chunks[i]]; }
    let ok = true; for (let i = 1; i < chunks.length; i++) if (chunks[i][0] === chunks[i - 1][0]) ok = false;
    if (ok) return chunks.join('');
  }
  return null;
}
function depth(s) { // blocking depth
  const memo = {}; const g = L.occGrid(s);
  function d(id, seen) { if (memo[id] != null) return memo[id]; if (seen.has(id)) return 99; seen.add(id);
    const v = s.veh[id]; let m = 0; for (const [x, y] of L.pathCells(s, v)) { const o = g[y * s.cols + x]; if (o >= 0 && o !== id) m = Math.max(m, 1 + d(o, seen)); }
    seen.delete(id); return memo[id] = m; }
  return Math.max(...s.veh.map(v => d(v.id, new Set())));
}
let best = [];
for (let iter = 0; iter < +(process.argv[5] || 3000); iter++) {
  const occ = new Set(); const veh = [];
  let fail = false;
  for (const c of colors) {
    let placed = false;
    for (let t = 0; t < 60 && !placed; t++) {
      const dir = pick(['U', 'U', 'U', 'L', 'R', 'D']); const horiz = dir === 'L' || dir === 'R';
      const x = Math.floor(rnd() * (horiz ? 5 : 6)), y = Math.floor(rnd() * (horiz ? 8 : 7));
      const cs = horiz ? [[x, y], [x + 1, y]] : [[x, y], [x, y + 1]];
      if (cs.some(([a, b]) => occ.has(a + ',' + b))) continue;
      cs.forEach(([a, b]) => occ.add(a + ',' + b)); veh.push({ c, x, y, dir }); placed = true;
    }
    if (!placed) { fail = true; break; }
  }
  if (fail) continue;
  // shuffle vehicle order so ids not grouped by colour
  const counts = {}; colors.forEach(c => counts[c] = (counts[c] || 0) + 4);
  const queue = genQueue(counts); if (!queue) continue;
  const lv = { spots, vehicles: veh, queue };
  const s = L.init(lv); const dp = depth(s); if (dp < 3 || dp >= 99) continue;
  const initMov = L.movable(s).length; if (initMov < 2 || initMov > 4) continue;
  const r = analyze(lv); if (!r.solvable) continue;
  const score = Math.abs(r.pRandom - (+process.argv[6]||0.2)) + Math.abs(r.pGreedy - (+process.argv[7]||0.55));
  best.push({ score, lv, r, dp }); best.sort((a, b) => a.score - b.score); best = best.slice(0, 3);
}
for (const b of best) { console.log('\nscore', b.score.toFixed(3), 'depth', b.dp, 'pR', b.r.pRandom.toFixed(3), 'pG', b.r.pGreedy.toFixed(3), 'taps', b.r.taps); console.log(ascii(b.lv)); console.log(JSON.stringify(b.lv)); }
