/* 对号发车 — 纯逻辑（与网页版 v2 共用规则，微信小游戏 CommonJS 导出）
 * 原网页版注释：
 * 队列字符串: 单人用颜色字母，团体用括号，如 "AA(BBB)A" = 2 个蓝、1 个 3 人橙团、1 个蓝 */
  const COLS = 6, ROWS = 8, BASE_SPOTS = 3;
  const DIRV = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  function cellsOf(v) {
    const out = []; const horiz = v.dir === 'L' || v.dir === 'R';
    for (let i = 0; i < v.len; i++) out.push(horiz ? [v.x + i, v.y] : [v.x, v.y + i]);
    return out;
  }
  function parseQueue(str) {
    const q = [], gsz = [], gid = []; let g = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '(') { const j = str.indexOf(')', i); const body = str.slice(i + 1, j); const st = q.length; for (const c of body) { q.push(c); gsz.push(0); gid.push(g); } gsz[st] = body.length; g++; i = j; }
      else if (/[A-D]/.test(ch)) { q.push(ch); gsz.push(1); gid.push(g++); }
    }
    return { q, gsz, gid };
  }
  function init(level, nSpots) {
    const P = parseQueue(level.queue);
    const s = {
      cols: level.cols || COLS, rows: level.rows || ROWS,
      veh: level.vehicles.map((v, i) => { const len = v.len || 2; return { id: i, c: v.c, x: v.x, y: v.y, dir: v.dir, len, cap: v.cap || (len === 3 ? 6 : 4), m: !!v.m, where: 'lot', spot: -1, filled: 0 }; }),
      spots: new Array(nSpots || BASE_SPOTS).fill(-1),
      q: P.q, gsz: P.gsz, gid: P.gid, qi: 0, over: null, why: null,
    };
    return s;
  }
  function clone(s) {
    return { cols: s.cols, rows: s.rows, veh: s.veh.map(v => Object.assign({}, v)), spots: s.spots.slice(), q: s.q, gsz: s.gsz, gid: s.gid, qi: s.qi, over: s.over, why: s.why };
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
  function blocker(s, id, g) {
    g = g || occGrid(s); const v = s.veh[id];
    for (const [x, y] of pathCells(s, v)) { const o = g[y * s.cols + x]; if (o >= 0 && o !== id) return o; }
    return -1;
  }
  function freeSpot(s) { return s.spots.indexOf(-1); }
  function headColor(s) { return s.qi < s.q.length ? s.q[s.qi] : null; }
  function headSize(s) { return s.qi < s.q.length ? s.gsz[s.qi] : 0; }
  // 队首（整团）能上的车：同色、空座 >= 团人数，取最左边的车位
  function boardTarget(s) {
    const h = headColor(s); if (!h) return null; const n = headSize(s);
    for (const vid of s.spots) if (vid >= 0) { const v = s.veh[vid]; if (v.c === h && v.cap - v.filled >= n) return v; }
    return null;
  }
  function movable(s) {
    const g = occGrid(s); const out = [];
    for (const v of s.veh) if (v.where === 'lot' && blocker(s, v.id, g) < 0) out.push(v.id);
    return out;
  }
  function status(s) {
    s.over = null; s.why = null;
    const lotLeft = s.veh.some(v => v.where === 'lot');
    const parked = s.spots.some(x => x >= 0);
    if (!lotLeft && !parked && s.qi >= s.q.length) { s.over = 'win'; return; }
    if (boardTarget(s)) return; // 不应出现（resolve 会上完）
    if (freeSpot(s) < 0) { s.over = 'fail'; s.why = 'full'; return; }
    if (!lotLeft || movable(s).length === 0) { s.over = 'fail'; s.why = 'stuck'; }
  }
  function resolve(s, ev) {
    for (;;) {
      const v = boardTarget(s); if (!v) break;
      const n = headSize(s);
      for (let k = 0; k < n; k++) { v.filled++; s.qi++; ev.push({ t: 'board', v: v.id, pax: s.qi - 1, left: v.cap - v.filled, grp: n > 1 }); }
      if (v.filled === v.cap) { s.spots[v.spot] = -1; v.where = 'gone'; ev.push({ t: 'depart', v: v.id, spot: v.spot }); }
    }
    status(s);
    return ev;
  }
  function tap(s, id) {
    if (s.over) return { ok: false, reason: 'over' };
    const v = s.veh[id]; if (!v || v.where !== 'lot') return { ok: false, reason: 'gone' };
    const b = blocker(s, id); if (b >= 0) return { ok: false, reason: 'blocked', blocker: b };
    const sp = freeSpot(s); if (sp < 0) return { ok: false, reason: 'full' };
    v.where = 'spot'; v.spot = sp; s.spots[sp] = id;
    const ev = [{ t: 'drive', v: id, spot: sp }];
    resolve(s, ev);
    return { ok: true, events: ev };
  }
  // 多 1 个车位（分享解锁 / 复活）；返回新车位下标
  function addSpot(s) { s.spots.push(-1); if (s.over === 'fail') status(s); return s.spots.length - 1; }
  function padSpots(s, n) { while (s.spots.length < n) s.spots.push(-1); if (s.over === 'fail') status(s); }
  function key(s) { return s.veh.map(v => v.where[0] + (v.where === 'spot' ? v.filled + ':' + v.spot : '')).join(',') + '|' + s.qi; }
module.exports = { COLS, ROWS, BASE_SPOTS, DIRV, cellsOf, parseQueue, init, clone, occGrid, pathCells, blocker, tap, movable, key, headColor, headSize, boardTarget, freeSpot, addSpot, padSpots, status };
