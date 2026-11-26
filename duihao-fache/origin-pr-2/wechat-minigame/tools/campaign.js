/* 100 关求解、连发模拟、21–100 关生成。不上传微信。
 * node tools/campaign.js probe
 * node tools/campaign.js gen
 * node tools/campaign.js report
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('../js/logic');

const ROOT = path.join(__dirname, '..');
const LEVELS_FILE = path.join(ROOT, 'js/levels.js');
const REPORT_FILE = path.join(__dirname, 'solve-report.json');

const CELL = 44, LOT_X = 63, LOT_Y = 306, ROAD_Y = 286, LANE_L = 47, LANE_R = 343, LANE_B = 682, SPOT_CY = 205;
const COMBO_WINDOW = 2.0;
const TAP_GAP = 0.05;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rnd() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function ri(rng, n) { return Math.floor(rng() * n); }
function pick(rng, a) { return a[ri(rng, a.length)]; }
function shuffle(rng, a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = ri(rng, i + 1); const t = b[i]; b[i] = b[j]; b[j] = t; }
  return b;
}

function cellCenter(v) {
  const cs = L.cellsOf(v); let x = 0, y = 0;
  cs.forEach(([cx, cy]) => { x += cx; y += cy; });
  return { x: LOT_X + (x / cs.length + 0.5) * CELL, y: LOT_Y + (y / cs.length + 0.5) * CELL };
}
function spotX(i, base) {
  const n = base + 2;
  const w = n > 5 ? 52 : 58, gap = n > 5 ? 5 : 8;
  const total = n * w + (n - 1) * gap;
  return 195 - total / 2 + i * (w + gap) + w / 2;
}
function buildPath(pts, radius) {
  const out = [];
  const lerp = (a, b, u) => a + (b - a) * u;
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
    const a = { x: p1.x - (p1.x - p0.x) / (d01 || 1) * r, y: p1.y - (p1.y - p0.y) / (d01 || 1) * r };
    const b = { x: p1.x + (p2.x - p1.x) / (d12 || 1) * r, y: p1.y + (p2.y - p1.y) / (d12 || 1) * r };
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
  let total = 0;
  for (let i = 1; i < out.length; i++) total += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
  return total;
}
function driveTotal(v, spot, base) {
  const cpos = cellCenter(v), sx = spotX(spot, base);
  const pts = [{ x: cpos.x, y: cpos.y }];
  if (v.dir === 'U') { if (Math.abs(cpos.x - sx) > 2) pts.push({ x: cpos.x, y: ROAD_Y }, { x: sx, y: ROAD_Y }); }
  else if (v.dir === 'L') pts.push({ x: LANE_L, y: cpos.y }, { x: LANE_L, y: ROAD_Y }, { x: sx, y: ROAD_Y });
  else if (v.dir === 'R') pts.push({ x: LANE_R, y: cpos.y }, { x: LANE_R, y: ROAD_Y }, { x: sx, y: ROAD_Y });
  else {
    const side = cpos.x < 195 ? LANE_L : LANE_R;
    pts.push({ x: cpos.x, y: LANE_B }, { x: side, y: LANE_B }, { x: side, y: ROAD_Y }, { x: sx, y: ROAD_Y });
  }
  pts.push({ x: sx, y: SPOT_CY });
  return buildPath(pts, 18);
}

function comboOf(level, taps, nSpots, windowSec) {
  windowSec = windowSec == null ? COMBO_WINDOW : windowSec;
  const s = L.init(level, nSpots);
  const anim = {
    spotFreeAt: new Array(nSpots).fill(0),
    roadArr: [], roadDep: [],
    boardCursor: 0, arriveAt: {}, lastBoardEnd: {},
    combo: 0, maxCombo: 0, lastT: -9, lastChain: -1,
  };
  let t = 0;
  for (let ti = 0; ti < taps.length; ti++) {
    const id = taps[ti];
    const v = s.veh[id];
    if (!v || v.where !== 'lot') return { maxCombo: 0, win: false, reason: 'stale' };
    const snap = { x: v.x, y: v.y, dir: v.dir, len: v.len, id: v.id };
    const r = L.tap(s, id);
    if (!r.ok) return { maxCombo: anim.maxCombo, win: false, reason: r.reason };
    scheduleTap(anim, r.events, t, snap, nSpots, windowSec);
    t += TAP_GAP;
  }
  return { maxCombo: anim.maxCombo, win: s.over === 'win', over: s.over, why: s.why };
}

function scheduleTap(anim, events, t0, snap, base, windowSec) {
  let tDrive = t0;
  for (const ev of events) {
    if (ev.t === 'drive') schedDrive(anim, ev, tDrive, snap, base);
    else if (ev.t === 'board') schedBoard(anim, ev);
    else if (ev.t === 'depart') schedDepart(anim, ev, t0, windowSec);
  }
}
function schedDrive(anim, ev, t, snap, base) {
  const total = driveTotal(snap, ev.spot, base);
  const dj = Math.max(0, total - (ROAD_Y - SPOT_CY) - 14);
  const T1 = 0.12 + dj / 1300, T2 = 0.26;
  let t1, t2;
  for (let k = 0; k < 12; k++) {
    t1 = t + 0.09;
    t2 = Math.max(t1 + T1, (anim.spotFreeAt[ev.spot] || 0) + 0.03);
    const ra = t1 + T1 * 0.55, rb = t2 + T2;
    let hit = null;
    for (const ab of anim.roadArr) if (ra < ab[1] && rb > ab[0]) { hit = ab[1]; break; }
    if (hit == null) { anim.roadArr.push([ra, rb]); break; }
    t += hit - ra + 0.02;
  }
  const arrive = t2 + T2;
  anim.arriveAt[ev.v] = arrive + 0.04;
  anim.lastBoardEnd[ev.v] = arrive;
  anim.spotFreeAt[ev.spot] = 1e9;
}
function schedBoard(anim, ev) {
  const tb = Math.max(anim.boardCursor, anim.arriveAt[ev.v] || 0);
  anim.boardCursor = tb + 0.11;
  anim.lastBoardEnd[ev.v] = tb + 0.3 + 0.12 + 0.14;
}
function schedDepart(anim, ev, tapT, windowSec) {
  let td = (anim.lastBoardEnd[ev.v] || 0) + 0.1;
  for (let k = 0; k < 12; k++) {
    const a = td + 0.26, b = td + 0.26 + 0.2 + 0.42;
    let hit = null;
    for (const xy of anim.roadArr) if (a < xy[1] && b > xy[0]) { hit = xy[1]; break; }
    if (hit == null) { anim.roadDep.push([a, b]); break; }
    td = hit - 0.26 + 0.02;
  }
  const chain = tapT;
  if (chain === anim.lastChain || td - anim.lastT <= windowSec) anim.combo++;
  else anim.combo = 1;
  if (anim.combo > anim.maxCombo) anim.maxCombo = anim.combo;
  anim.lastT = td;
  anim.lastChain = chain;
  anim.spotFreeAt[ev.spot] = td + 0.26 + 0.2;
}

function findPath(level, nSpots, limit) {
  const memo = new Map();
  let nodes = 0;
  let capped = false;
  function dfs(s) {
    if (s.over === 'win') return [];
    if (s.over === 'fail') return null;
    const k = L.key(s);
    if (memo.has(k)) return memo.get(k);
    if (nodes >= limit) { capped = true; memo.set(k, null); return null; }
    nodes++;
    memo.set(k, null);
    const mv = L.movable(s);
    const h = L.headColor(s);
    mv.sort((a, b) => (s.veh[a].c === h ? 0 : 1) - (s.veh[b].c === h ? 0 : 1) || a - b);
    for (const id of mv) {
      const n = L.clone(s);
      const r = L.tap(n, id);
      if (!r.ok) continue;
      const sub = dfs(n);
      if (sub) { const path = [id].concat(sub); memo.set(k, path); return path; }
    }
    return null;
  }
  const path = dfs(L.init(level, nSpots));
  return { path, nodes, capped, solvable: !!path };
}

function countStates(level, nSpots, limit) {
  const seen = new Set();
  const q = [L.init(level, nSpots)];
  seen.add(L.key(q[0]));
  let solvable = q[0].over === 'win';
  let qi = 0;
  while (qi < q.length && seen.size < limit) {
    const s = q[qi++];
    if (s.over === 'win') { solvable = true; continue; }
    if (s.over === 'fail') continue;
    for (const id of L.movable(s)) {
      const n = L.clone(s);
      const r = L.tap(n, id);
      if (!r.ok) continue;
      const k = L.key(n);
      if (seen.has(k)) continue;
      seen.add(k);
      if (n.over === 'win') solvable = true;
      q.push(n);
      if (seen.size >= limit) break;
    }
  }
  return { states: seen.size, capped: seen.size >= limit, solvable };
}

function randomWinRate(level, nSpots, trials, rng) {
  let w = 0;
  for (let t = 0; t < trials; t++) {
    const s = L.init(level, nSpots);
    let g = 40;
    while (!s.over && g--) {
      const mv = L.movable(s);
      if (!mv.length) break;
      L.tap(s, mv[ri(rng, mv.length)]);
    }
    if (s.over === 'win') w++;
  }
  return w / trials;
}

function replay(level, taps, nSpots) {
  const s = L.init(level, nSpots);
  for (const id of taps) {
    const r = L.tap(s, id);
    if (!r.ok) return { ok: false, reason: r.reason };
  }
  return { ok: s.over === 'win', over: s.over, why: s.why };
}

function appendPassengers(s, str) {
  const p = L.parseQueue(str);
  const baseG = s.gid.length ? s.gid[s.gid.length - 1] + 1 : 0;
  for (let i = 0; i < p.q.length; i++) {
    s.q.push(p.q[i]); s.gsz.push(p.gsz[i]); s.gid.push(baseG + p.gid[i]);
  }
}
function chunkFor(c, need, rng) {
  if (need === 6 && rng() < 0.75) return '(' + c + c + c + ')(' + c + c + c + ')';
  if (need === 4 && rng() < 0.7) return '(' + c + c + ')(' + c + c + ')';
  if (need === 2 && rng() < 0.4) return '(' + c + c + ')';
  return c.repeat(need);
}
function occupied(vehicles, gates) {
  const occ = new Set();
  for (const v of vehicles) {
    for (const [x, y] of L.cellsOf(v)) {
      if (x < 0 || y < 0 || x >= 6 || y >= 8) return null;
      const k = x + ',' + y;
      if (occ.has(k)) return null;
      occ.add(k);
    }
  }
  for (const g of gates || []) {
    if (g.x < 0 || g.y < 0 || g.x >= 6 || g.y >= 8) return null;
    if (occ.has(g.x + ',' + g.y)) return null;
  }
  return occ;
}

function layoutTier(rng, tier, intro) {
  const vehicles = [];
  const gates = [];
  const cols = shuffle(rng, [0, 1, 2, 3, 4, 5]);
  const useN = intro ? 3 : (tier <= 2 ? 3 + ri(rng, 2) : 4 + ri(rng, 2));
  const used = cols.slice(0, Math.min(6, useN));
  const depth = intro ? 2 : (tier <= 2 ? 2 + ri(rng, 2) : tier === 3 ? 2 + ri(rng, 2) : 3 + ri(rng, 2));
  const palette = shuffle(rng, ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D']);
  let pi = 0;
  const blockCol = tier >= 4 ? used[0] : -1;
  const gateCol = tier >= 5 ? used[Math.min(1, used.length - 1)] : -1;
  for (const x of used) {
    let y = 0;
    if (x === blockCol) {
      vehicles.push({ c: 'A', x, y: 0, dir: 'U', len: 2, block: true, tow: 2 + ri(rng, 2) });
      y = 2;
    } else if (x === gateCol) {
      gates.push({ x, y: 0, open: 2 + ri(rng, 2) });
      y = 1;
    }
    let stacked = 0;
    while (stacked < depth && y <= 6) {
      const len = (y <= 4 && rng() < (tier >= 3 ? 0.28 : 0.12)) ? 3 : 2;
      if (y + len > 8) break;
      const car = { c: palette[pi++ % palette.length], x, y, dir: 'U', len };
      if (tier >= 2 && rng() < 0.18 && !car.block) car.m = 1;
      vehicles.push(car);
      y += len;
      stacked++;
    }
  }
  const passengers = vehicles.filter(v => !v.block);
  if (passengers.length < 6) return null;
  if (tier >= 2) {
    const pool = passengers.filter(v => !v.m);
    if (!pool.length) return null;
    pick(rng, pool).cycle = true;
  }
  if (tier >= 3) {
    const tops = passengers.filter(v => v.y <= 1 && !v.cycle);
    const pool = tops.length >= 2 ? tops : passengers.filter(v => !v.cycle);
    if (pool.length < 2) return null;
    const iced = pick(rng, pool);
    iced.ice = tier >= 5 ? 2 : 1 + ri(rng, 2);
    const freeish = passengers.filter(v => v.y <= 1 && v !== iced && !v.ice);
    if (freeish.length < 1 && tops.length < 2) return null;
  }
  if (blockCol >= 0) {
    const blk = vehicles.find(v => v.block);
    const others = vehicles.filter(v => !v.block && v.x !== blockCol).length;
    if (!blk || others < 1) return null;
    blk.tow = Math.max(1, Math.min(blk.tow || 1, others));
  }
  if (gateCol >= 0 && gates.length) {
    const others = vehicles.filter(v => !v.block && v.x !== gateCol).length;
    if (others < 1) return null;
    gates[0].open = Math.max(1, Math.min(gates[0].open, others));
  }
  if (!occupied(vehicles, gates)) return null;
  const s0 = L.init({ vehicles, queue: 'A', gates }, tier >= 4 ? 2 : 3);
  if (!L.movable(s0).length) return null;
  return { vehicles, gates };
}

function construct(layout, spots, rng) {
  const queueParts = [];
  const taps = [];
  const s = L.init({ vehicles: layout.vehicles, queue: '', gates: layout.gates }, spots);
  for (let guard = 0; guard < 80; guard++) {
    if (!s.veh.some(v => v.where !== 'gone') && s.qi >= s.q.length) { L.status(s); break; }
    const mov = L.movable(s);
    const free = s.spots.filter(x => x < 0).length;
    if (free === 0) {
      const sid = s.spots.find(id => id >= 0);
      if (sid == null) return null;
      const v = s.veh[sid];
      const need = v.cap - v.filled;
      if (need <= 0) return null;
      const part = chunkFor(v.c, need, rng);
      queueParts.push(part);
      appendPassengers(s, part);
      L.resolve(s, []);
      continue;
    }
    if (!mov.length) return null;
    const blocks = mov.filter(id => s.veh[id].block);
    const id = (blocks.length && rng() < 0.9) ? pick(rng, blocks) : pick(rng, mov);
    const v = s.veh[id];
    if (!v.block) {
      const need = v.cap - v.filled;
      const part = chunkFor(v.c, need, rng);
      queueParts.push(part);
      appendPassengers(s, part);
    }
    taps.push(id);
    const r = L.tap(s, id);
    if (!r.ok) return null;
  }
  if (s.over !== 'win') L.status(s);
  if (s.over !== 'win') return null;
  const level = {
    vehicles: layout.vehicles.map(v => {
      const o = { c: v.c, x: v.x, y: v.y, dir: v.dir };
      if (v.len && v.len !== 2) o.len = v.len;
      if (v.m) o.m = 1;
      if (v.cycle) o.cycle = true;
      if (v.ice) o.ice = v.ice;
      if (v.block) { o.block = true; o.tow = v.tow || 0; delete o.c; o.c = 'A'; }
      return o;
    }),
    queue: queueParts.join(''),
    gates: layout.gates && layout.gates.length ? layout.gates.map(g => ({ x: g.x, y: g.y, open: g.open })) : undefined,
    spots,
  };
    const again = replay(level, taps, spots);
    if (!again.ok) return null;
    const combo = comboOf(level, taps, spots, COMBO_WINDOW);
    if (!combo.win || combo.maxCombo < 4) return null;
    const found = findPath(level, spots, 25000);
    if (!found.solvable) return null;
    let seen = comboOf(level, found.path, spots, COMBO_WINDOW).maxCombo;
    if (seen < 4) seen = searchCombo(level, spots, 12000);
    if (seen < 4) return null;
    level._taps = taps.length;
    level._combo = seen;
    return level;
}

const NAMES = {
  2: ['变色初见', '看色再开', '换色让路', '先别点它', '第三色', '锁色上车', '变完再走', '连变两次', '等它变绿', '变色夹心', '颜色对上', '不要急变', '变色长队', '换一档色', '算准这一变', '变色堵着', '旁边先走', '变色回位', '四色轮换', '变色收官'],
  3: ['冰还没化', '等一辆发车', '薄冰', '化开再走', '冰下车队', '先发热车', '冰封路口', '两格冰', '化冰时刻', '冰与团体', '别敲冰车', '暖车先发', '冰层下面', '再化一格', '冰封长队', '化冰之后', '冷热交替', '冰车让路', '最后一层冰', '冰封收官'],
  4: ['故障挡路', '先拖再走', '布盖着', '两个车位', '拖走让路', '故障在前', '窄站台', '拖完再上', '占着出口', '故障与冰', '只剩两格', '拖车到来', '布下有路', '拖早了没用', '双位极限', '故障长队', '让出路口', '拖车不占位', '两格也够', '故障收官'],
  5: ['闸门关着', '发够再开', '门后的车', '数清再走', '闸门与冰', '两格过闸', '自动开闸', '门还差一辆', '闸前排队', '开闸时刻', '门后长队', '闸门回位', '先发再过', '双闸之间', '门开的瞬间', '闸后团体', '数到就开', '最后一道闸', '闸门深处', '全线收官'],
};
const INTRO = {
  21: { isNew: '变色车', intro: { demo: 'cycle', title: '变色车：开走别的车就会换色', text: '标着「变」的车还停在停车场时，每成功开走一辆别的车，它就按蓝、橙、紫、绿的顺序换色。开进车位后颜色锁定，乘客按锁定的颜色上车。' } },
  41: { isNew: '冰封车', intro: { demo: 'ice', title: '冰封车：等别的车先发走', text: '结着冰的车现在点不动。每有一辆客车满员发走，冰就少一格，数字归零后才能开。把故障车拖走不算发车。' } },
  61: { isNew: '故障车', intro: { demo: 'tow', title: '故障车：拖走才让路', text: '盖着布的故障车不载客，也不占车位。等满员发车达到角标上的数量，点它，车会被拖出画面。从这一关起，默认只有 2 个车位。' } },
  81: { isNew: '闸门', intro: { demo: 'gate', title: '闸门：发够车数才打开', text: '车道上的闸门挡着路，不用去点它。满员发车达到角标上的数量后，闸门会自己打开，后面的车才能通过。' } },
};

function tierOf(n) {
  if (n <= 20) return 1;
  if (n <= 40) return 2;
  if (n <= 60) return 3;
  if (n <= 80) return 4;
  return 5;
}

function generateOne(n, rng) {
  const tier = tierOf(n);
  const spots = n >= 61 ? 2 : 3;
  const intro = n === 21 || n === 41 || n === 61 || n === 81;
  for (let attempt = 0; attempt < 1200; attempt++) {
    const layout = layoutTier(rng, tier, intro);
    if (!layout) continue;
    const passengers = layout.vehicles.filter(v => !v.block).length;
    const blocks = layout.vehicles.length - passengers;
    const wantMin = intro ? 6 : (tier === 2 ? 10 : tier === 3 ? 10 : tier === 4 ? 12 : 13);
    const wantMax = intro ? 9 : (tier === 2 ? 12 : tier === 3 ? 13 : 14);
    if (passengers + blocks < wantMin || passengers + blocks > wantMax) continue;
    if (tier >= 2 && !layout.vehicles.some(v => v.cycle)) continue;
    if (tier >= 3 && !layout.vehicles.some(v => v.ice)) continue;
    if (tier >= 4 && !layout.vehicles.some(v => v.block)) continue;
    if (tier >= 5 && !(layout.gates && layout.gates.length)) continue;
    const built = construct(layout, spots, rng);
    if (!built) continue;
    const lv = {
      name: NAMES[tier][(n - 1) % 20],
      spots,
      vehicles: built.vehicles,
      queue: built.queue,
    };
    if (built.gates) lv.gates = built.gates;
    const meta = INTRO[n];
    if (meta) { lv.isNew = meta.isNew; lv.intro = meta.intro; }
    const wr = randomWinRate(lv, spots, 40, rng);
    if (intro) { if (wr > 0.5) continue; }
    else if (tier === 2 && wr > 0.03) continue;
    else if (tier === 3 && wr > 0.02) continue;
    else if (wr > 0.015) continue;
    lv._wr = +wr.toFixed(3);
    return lv;
  }
  return null;
}

function loadExisting() {
  const src = fs.readFileSync(LEVELS_FILE, 'utf8');
  const lines = src.split('\n');
  const head = [];
  const kept = [];
  let seen = 0;
  for (const line of lines) {
    if (line.includes('"name"') && seen < 20) {
      kept.push(line.replace(/,\s*$/, ','));
      seen++;
    }
  }
  if (seen !== 20) throw new Error('未能原样取出前 20 关，实际 ' + seen);
  return kept;
}

function writeLevels(keptLines, levels) {
  const body = keptLines.map(l => l.replace(/\s+$/, '')).concat(levels.map(lv => {
    const copy = Object.assign({}, lv);
    return '  ' + JSON.stringify(copy) + ',';
  }));
  body[body.length - 1] = body[body.length - 1].replace(/,$/, '');
  const text = `/* 对号发车 关卡 1–100（固定布局与颜色，无随机）
 * 1–20 与 1.0.0 上传版本逐字相同，关卡数据未改。
 * 21–40 变色车，41–60 冰封车，61–80 故障车且默认 2 车位，81–100 闸门且默认 2 车位。
 * 默认车位下均可解，且存在连发≥4 的操作序列。见 tools/campaign.js 与 tools/solve-report.json。
 */
const LEVELS = [
${body.join('\n')}
];
module.exports = LEVELS;
`;
  fs.writeFileSync(LEVELS_FILE, text);
}

function analyzeAll(levels) {
  const rows = [];
  for (let i = 0; i < levels.length; i++) {
    const lv = levels[i];
    const spots = L.defaultSpots(lv, i);
    const t0 = Date.now();
    const found = findPath(lv, spots, 60000);
    let combo = 0;
    if (found.path) combo = comboOf(lv, found.path, spots, COMBO_WINDOW).maxCombo;
    let bestCombo = combo;
    if (found.path && bestCombo < 4) {
      bestCombo = searchCombo(lv, spots, 20000);
    }
    const st = countStates(lv, spots, 40000);
    const wr = randomWinRate(lv, spots, 80, mulberry32(1000 + i * 17));
    const passengers = lv.vehicles.filter(v => !v.block).length;
    rows.push({
      level: i + 1,
      name: lv.name,
      tier: tierOf(i + 1),
      spots,
      cars: lv.vehicles.length,
      passengers,
      taps: found.path ? found.path.length : null,
      solvable: !!found.solvable,
      searchNodes: found.nodes,
      searchCapped: found.capped,
      states: st.states,
      statesCapped: st.capped,
      winRate: +wr.toFixed(3),
      maxCombo: bestCombo,
      star3: bestCombo >= 4 && !!found.solvable,
      ms: Date.now() - t0,
      cycle: lv.vehicles.some(v => v.cycle),
      ice: lv.vehicles.some(v => v.ice),
      block: lv.vehicles.some(v => v.block),
      gate: !!(lv.gates && lv.gates.length),
    });
    console.log(
      `L${i + 1} ${lv.name} spots=${spots} taps=${rows[rows.length - 1].taps} nodes=${found.nodes} states=${st.states}${st.capped ? '+' : ''} wr=${wr.toFixed(2)} combo=${bestCombo} ${found.solvable && bestCombo >= 4 ? 'OK' : 'FAIL'} ${rows[rows.length - 1].ms}ms`
    );
  }
  return rows;
}

function searchCombo(level, nSpots, limit) {
  let best = 0;
  let nodes = 0;
  const memo = new Map();
  function dfs(s, path) {
    if (best >= 4 || nodes >= limit) return;
    if (s.over === 'win') {
      const c = comboOf(level, path, nSpots, COMBO_WINDOW).maxCombo;
      if (c > best) best = c;
      return;
    }
    if (s.over) return;
    const k = L.key(s);
    const prev = memo.get(k);
    if (prev != null && prev <= path.length) return;
    memo.set(k, path.length);
    nodes++;
    const mv = L.movable(s);
    for (const id of mv) {
      const n = L.clone(s);
      if (!L.tap(n, id).ok) continue;
      path.push(id);
      dfs(n, path);
      path.pop();
      if (best >= 4) return;
    }
  }
  dfs(L.init(level, nSpots), []);
  return best;
}

function median(nums) {
  const a = nums.filter(x => x != null).slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function summarize(rows) {
  const tiers = {};
  for (const r of rows) {
    const t = tiers[r.tier] = tiers[r.tier] || [];
    t.push(r);
  }
  const out = [];
  for (const k of Object.keys(tiers)) {
    const list = tiers[k];
    out.push({
      tier: +k,
      levels: list.length,
      spots: list[0].spots,
      medianTaps: median(list.map(r => r.taps)),
      medianNodes: median(list.map(r => r.searchNodes)),
      medianStates: median(list.map(r => r.states)),
      medianWinRate: median(list.map(r => r.winRate)),
      solvable: list.filter(r => r.solvable).length,
      star3: list.filter(r => r.star3).length,
    });
  }
  return out;
}

function probe() {
  const levels = require('../js/levels');
  const rows = [];
  for (let i = 0; i < Math.min(20, levels.length); i++) {
    const lv = levels[i];
    const found = findPath(lv, 3, 80000);
    const c15 = found.path ? comboOf(lv, found.path, 3, 1.5).maxCombo : 0;
    const c20 = found.path ? comboOf(lv, found.path, 3, 2.0).maxCombo : 0;
    const c22 = found.path ? comboOf(lv, found.path, 3, 2.2).maxCombo : 0;
    let best = c20;
    if (found.path && best < 4) best = searchCombo(lv, 3, 30000);
    rows.push({ i: i + 1, name: lv.name, taps: found.path && found.path.length, nodes: found.nodes, c15, c20, c22, best });
    console.log(`L${i + 1} ${lv.name} taps=${rows[rows.length - 1].taps} nodes=${found.nodes} c1.5=${c15} c2.0=${c20} c2.2=${c22} best2=${best}`);
  }
  console.log('fail c2.0', rows.filter(r => r.c20 < 4).map(r => r.i).join(','));
  console.log('fail best', rows.filter(r => r.best < 4).map(r => r.i).join(','));
}

function gen() {
  const kept = loadExisting();
  const rng = mulberry32(20261124);
  const levels = [];
  for (let n = 21; n <= 100; n++) {
    const lv = generateOne(n, rng);
    if (!lv) {
      console.error('生成失败', n);
      process.exit(1);
    }
    console.log('gen', n, lv.name, 'cars', lv.vehicles.length, 'wr', lv._wr, 'queue', lv.queue.length);
    delete lv._taps; delete lv._combo; delete lv._wr;
    levels.push(lv);
  }
  writeLevels(kept, levels);
  console.log('wrote', LEVELS_FILE);
}

function report() {
  const levels = require('../js/levels');
  if (levels.length !== 100) {
    console.error('关卡数', levels.length);
    process.exit(1);
  }
  const rows = analyzeAll(levels);
  const summary = summarize(rows);
  const bad = rows.filter(r => !r.solvable || !r.star3);
  const out = { window: COMBO_WINDOW, tapGap: TAP_GAP, summary, bad: bad.map(r => r.level), rows };
  fs.writeFileSync(REPORT_FILE, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log('bad', out.bad.join(',') || 'none');
  if (bad.length) process.exit(1);
}

if (require.main === module) {
  const cmd = process.argv[2] || 'probe';
  if (cmd === 'probe') probe();
  else if (cmd === 'gen') gen();
  else if (cmd === 'report') report();
  else { console.error('unknown', cmd); process.exit(1); }
}

module.exports = { layoutTier, construct, generateOne, mulberry32, findPath, comboOf, searchCombo, randomWinRate, writeLevels, loadExisting };
