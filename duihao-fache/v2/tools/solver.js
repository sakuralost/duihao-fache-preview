const L = require('../js/logic.js');
function analyze(level, nSpots, opts_lose = true) {
  nSpots = nSpots || 3;
  const memoP = new Map(), memoG = new Map(), memoW = new Map();
  function step(s, id) { const t = L.clone(s); L.tap(t, id); return t; }
  function pRandom(s) {
    if (s.over) return s.over === 'win' ? 1 : 0;
    const k = L.key(s); if (memoP.has(k)) return memoP.get(k);
    const ms = L.movable(s); if (!ms.length) { memoP.set(k, 0); return 0; }
    let p = 0; for (const m of ms) p += pRandom(step(s, m)); p /= ms.length; memoP.set(k, p); return p;
  }
  function pGreedy(s) { // prefer movable vehicles of head colour
    if (s.over) return s.over === 'win' ? 1 : 0;
    const k = L.key(s); if (memoG.has(k)) return memoG.get(k);
    let ms = L.movable(s); if (!ms.length) { memoG.set(k, 0); return 0; }
    const h = L.headColor(s); const hm = ms.filter(m => s.veh[m].c === h); if (hm.length) ms = hm;
    let p = 0; for (const m of ms) p += pGreedy(step(s, m)); p /= ms.length; memoG.set(k, p); return p;
  }
  function solve(s) { // returns tap sequence or null
    if (s.over) return s.over === 'win' ? [] : null;
    const k = L.key(s); if (memoW.has(k)) return memoW.get(k);
    memoW.set(k, null);
    for (const m of L.movable(s)) { const r = solve(step(s, m)); if (r) { const out = [m, ...r]; memoW.set(k, out); return out; } }
    return null;
  }
  // find one losing sequence
  function lose(s) {
    if (s.over) return s.over === 'fail' ? [] : null;
    for (const m of L.movable(s)) { const r = lose(step(s, m)); if (r) return [m, ...r]; }
    return null;
  }
  const s0 = L.init(level, nSpots);
  const sol = solve(s0);
  return { solvable: !!sol, solution: sol, taps: sol && sol.length, pRandom: pRandom(s0), pGreedy: pGreedy(s0), states: memoP.size, losing: opts_lose ? lose(L.init(level, nSpots)) : null };
}
function rollout(level, nSpots, greedy, trials) {
  trials = trials || 400; let w = 0, seed = 0xC0FFEE;
  function rnd() { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  for (let t = 0; t < trials; t++) {
    const st = L.init(level, nSpots); let g = 80;
    while (!st.over && g--) {
      let ms = L.movable(st); if (!ms.length) break;
      if (greedy) { const h = L.headColor(st); const hm = ms.filter(m => st.veh[m].c === h); if (hm.length) ms = hm; }
      L.tap(st, ms[Math.floor(rnd() * ms.length)]);
    }
    if (st.over === 'win') w++;
  }
  return w / trials;
}
function ascii(level) {
  const s = L.init(level); const g = Array.from({ length: s.rows }, () => Array(s.cols).fill(' . '));
  const ar = { U: '^', D: 'v', L: '<', R: '>' };
  for (const v of s.veh) for (const [x, y] of L.cellsOf(v)) g[y][x] = (v.m ? v.c.toLowerCase() : v.c) + ar[v.dir] + (v.id % 10);
  return g.map(r => r.join('')).join('\n');
}
module.exports = { analyze, ascii, rollout };
if (require.main === module) {
  const LV = require('../js/levels.js');
  const fmt = p => (p*100).toFixed(p < 0.001 && p > 0 ? 2 : 1) + "%";
  const rows = [];
  LV.forEach((lv, i) => {
    const r = analyze(lv, 3);
    const r5 = analyze(lv, 5, false);
    console.log(`\n== L${i + 1} ${lv.name} vehicles=${lv.vehicles.length} pax=${L.parseQueue(lv.queue).q.length} queue=${lv.queue}`);
    console.log(ascii(lv));
    console.log(JSON.stringify({ solvable3: r.solvable, taps: r.taps, solution: r.solution, pRandom3: +r.pRandom.toFixed(3), pGlow3: +r.pGreedy.toFixed(3), pRandom5: +r5.pRandom.toFixed(3), pGlow5: +r5.pGreedy.toFixed(3), states: r.states, losingExample: r.losing }));
    const mcR = rollout(lv, 3, false, 400), mcG = rollout(lv, 3, true, 400);
    console.log('  MC400 pRandom', +mcR.toFixed(3), 'pGlow', +mcG.toFixed(3));
    rows.push(`| ${i + 1} | ${lv.name} | ${lv.isNew || ''} | ${lv.vehicles.length} | ${r.taps} | ${(r.pRandom * 100).toFixed(1)}% | ${(r.pGreedy * 100).toFixed(1)}% | MC ${(mcR*100).toFixed(1)}% / ${(mcG*100).toFixed(1)}% | ${(r5.pRandom * 100).toFixed(1)}% |`);
    if (!r.solvable) console.log('!!! UNSOLVABLE at 3 spots');
  });
  console.log('\n| 关 | 名称 | 新元素 | 车数 | 最少点击 | 乱点胜率(3位,精确) | 点亮车胜率(3位,精确) | 400次抽样 乱点/点亮 | 乱点胜率(5位) |\n|---|---|---|---|---|---|---|---|\n' + rows.join('\n'));
}
