/* 对号发车 — 纯逻辑（与表现层分离；求解器可直接 require）
 * 队列字符串: 单人用颜色字母，团体用括号，如 "AA(BBB)A" = 2 个蓝、1 个 3 人橙团、1 个蓝
 * 第 61 关起默认 2 个车位（level.spots 或下标 >= 60）；1–60 关默认 3 个。
 * 新机制见 DESIGN.md「v1.0.4」：变色车 cycle、冰封车 ice、故障车 block+tow、闸门 gates。 */
  const COLS = 6, ROWS = 8, BASE_SPOTS = 3, LATE_SPOTS = 2;
  const COLORS = ['A', 'B', 'C', 'D'];
  const DIRV = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };

  function defaultSpots(level, idx) {
    if (level && level.spots != null) return level.spots;
    if (idx >= 60) return LATE_SPOTS;
    return BASE_SPOTS;
  }

  function cellsOf(v) {
    const out = []; const horiz = v.dir === 'L' || v.dir === 'R';
    const len = v.len || 1;
    for (let i = 0; i < len; i++) out.push(horiz ? [v.x + i, v.y] : [v.x, v.y + i]);
    return out;
  }
  function parseQueue(str) {
    const q = [], gsz = [], gid = []; let g = 0;
    const src = str || '';
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === '(') { const j = src.indexOf(')', i); const body = src.slice(i + 1, j); const st = q.length; for (const c of body) { q.push(c); gsz.push(0); gid.push(g); } gsz[st] = body.length; g++; i = j; }
      else if (/[A-D]/.test(ch)) { q.push(ch); gsz.push(1); gid.push(g++); }
    }
    return { q, gsz, gid };
  }
  function advanceCycles(s, exceptId) {
    for (const v of s.veh) {
      if (!v.cycle || v.where !== 'lot' || v.id === exceptId) continue;
      const i = COLORS.indexOf(v.c);
      v.c = COLORS[(i < 0 ? 0 : i + 1) % COLORS.length];
    }
  }
  function init(level, nSpots) {
    const P = parseQueue(level.queue);
    const spotsN = nSpots || (level.spots != null ? level.spots : BASE_SPOTS);
    const s = {
      cols: level.cols || COLS, rows: level.rows || ROWS,
      veh: level.vehicles.map((v, i) => {
        const block = !!v.block;
        const len = v.len || (block ? 2 : 2);
        return {
          id: i, c: v.c || 'A', x: v.x, y: v.y, dir: v.dir || 'U', len,
          cap: block ? 0 : (v.cap || (len === 3 ? 6 : 4)),
          m: !!v.m && !block,
          cycle: !!v.cycle && !block,
          ice: block ? 0 : (v.ice | 0),
          block,
          tow: block ? (v.tow | 0) : 0,
          where: 'lot', spot: -1, filled: 0,
        };
      }),
      spots: new Array(spotsN).fill(-1),
      q: P.q, gsz: P.gsz, gid: P.gid, qi: 0, over: null, why: null,
      departed: 0,
      gates: (level.gates || []).map(g => ({ x: g.x, y: g.y, open: g.open | 0 })),
    };
    return s;
  }
  function clone(s) {
    return {
      cols: s.cols, rows: s.rows,
      veh: s.veh.map(v => Object.assign({}, v)),
      spots: s.spots.slice(),
      q: s.q, gsz: s.gsz, gid: s.gid, qi: s.qi, over: s.over, why: s.why,
      departed: s.departed || 0,
      gates: s.gates,
    };
  }
  function occGrid(s) {
    const g = new Array(s.cols * s.rows).fill(-1);
    for (const v of s.veh) if (v.where === 'lot') for (const [x, y] of cellsOf(v)) g[y * s.cols + x] = v.id;
    return g;
  }
  function pathCells(s, v) {
    const cs = cellsOf(v); const [dx, dy] = DIRV[v.dir];
    const [fx, fy] = (v.dir === 'U' || v.dir === 'L') ? cs[0] : cs[cs.length - 1];
    const out = []; let x = fx + dx, y = fy + dy;
    while (x >= 0 && y >= 0 && x < s.cols && y < s.rows) { out.push([x, y]); x += dx; y += dy; }
    return out;
  }
  function closedGate(s, x, y) {
    if (!s.gates) return false;
    const d = s.departed || 0;
    for (const g of s.gates) if (g.x === x && g.y === y && d < g.open) return true;
    return false;
  }
  // 返回挡住的车 id；-2 表示闸门；-1 表示通路畅通
  function blocker(s, id, g) {
    g = g || occGrid(s); const v = s.veh[id];
    for (const [x, y] of pathCells(s, v)) {
      if (closedGate(s, x, y)) return -2;
      const o = g[y * s.cols + x]; if (o >= 0 && o !== id) return o;
    }
    return -1;
  }
  function freeSpot(s) { return s.spots.indexOf(-1); }
  function headColor(s) { return s.qi < s.q.length ? s.q[s.qi] : null; }
  function headSize(s) { return s.qi < s.q.length ? s.gsz[s.qi] : 0; }
  function boardTarget(s) {
    const h = headColor(s); if (!h) return null; const n = headSize(s);
    for (const vid of s.spots) if (vid >= 0) { const v = s.veh[vid]; if (v.c === h && v.cap - v.filled >= n) return v; }
    return null;
  }
  function towReady(s, v) { return v.block && (s.departed || 0) >= (v.tow || 0); }
  function movable(s) {
    const g = occGrid(s); const out = [];
    for (const v of s.veh) {
      if (v.where !== 'lot') continue;
      if (v.block) { if (!towReady(s, v)) continue; }
      else if (v.ice > 0) continue;
      if (blocker(s, v.id, g) === -1) out.push(v.id);
    }
    return out;
  }
  function status(s) {
    s.over = null; s.why = null;
    const lotLeft = s.veh.some(v => v.where === 'lot');
    const parked = s.spots.some(x => x >= 0);
    if (!lotLeft && !parked && s.qi >= s.q.length) { s.over = 'win'; return; }
    if (boardTarget(s)) return;
    if (freeSpot(s) < 0) { s.over = 'fail'; s.why = 'full'; return; }
    if (!lotLeft || movable(s).length === 0) { s.over = 'fail'; s.why = 'stuck'; }
  }
  function resolve(s, ev) {
    for (;;) {
      const v = boardTarget(s); if (!v) break;
      const n = headSize(s);
      for (let k = 0; k < n; k++) {
        v.filled++; s.qi++;
        ev.push({ t: 'board', v: v.id, pax: s.qi - 1, left: v.cap - v.filled, grp: n > 1 });
      }
      if (v.filled === v.cap) {
        s.spots[v.spot] = -1; v.where = 'gone';
        s.departed = (s.departed || 0) + 1;
        for (const u of s.veh) if (u.where === 'lot' && u.ice > 0) u.ice--;
        ev.push({ t: 'depart', v: v.id, spot: v.spot, departed: s.departed });
      }
    }
    status(s);
    return ev;
  }
  function tap(s, id) {
    if (s.over) return { ok: false, reason: 'over' };
    const v = s.veh[id]; if (!v || v.where !== 'lot') return { ok: false, reason: 'gone' };
    if (v.block) {
      if (!towReady(s, v)) return { ok: false, reason: 'block', need: (v.tow || 0) - (s.departed || 0) };
      const b = blocker(s, id); if (b >= 0) return { ok: false, reason: 'blocked', blocker: b };
      if (b === -2) return { ok: false, reason: 'gate' };
      v.where = 'gone';
      advanceCycles(s, id);
      const ev = [{ t: 'tow', v: id }];
      resolve(s, ev);
      return { ok: true, events: ev };
    }
    if (v.ice > 0) return { ok: false, reason: 'ice', need: v.ice };
    const b = blocker(s, id); if (b >= 0) return { ok: false, reason: 'blocked', blocker: b };
    if (b === -2) return { ok: false, reason: 'gate' };
    const sp = freeSpot(s); if (sp < 0) return { ok: false, reason: 'full' };
    v.where = 'spot'; v.spot = sp; s.spots[sp] = id;
    advanceCycles(s, id);
    const ev = [{ t: 'drive', v: id, spot: sp }];
    resolve(s, ev);
    return { ok: true, events: ev };
  }
  function addSpot(s) { s.spots.push(-1); if (s.over === 'fail') status(s); return s.spots.length - 1; }
  function padSpots(s, n) { while (s.spots.length < n) s.spots.push(-1); if (s.over === 'fail') status(s); }
  function key(s) {
    const veh = s.veh.map(v => {
      if (v.block) return v.where === 'gone' ? 'x' : 'b';
      let k = v.where[0];
      if (v.where === 'lot') {
        if (v.cycle) k += v.c;
        if (v.ice) k += 'i' + v.ice;
      } else if (v.where === 'spot') k += v.filled + ':' + v.spot;
      return k;
    }).join(',');
    return veh + '|' + s.qi + '|d' + (s.departed || 0);
  }
module.exports = {
  COLS, ROWS, BASE_SPOTS, LATE_SPOTS, COLORS, DIRV,
  defaultSpots, cellsOf, parseQueue, init, clone, occGrid, pathCells, blocker, tap, movable, key,
  headColor, headSize, boardTarget, freeSpot, addSpot, padSpots, status, resolve, closedGate, towReady,
};
