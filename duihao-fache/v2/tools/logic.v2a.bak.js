/* 对号发车 v2 — pure game logic (shared by game and Node solver) */
(function (root) {
  const COLS = 6, ROWS = 8;
  const DIRV = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  function cellsOf(v) {
    const out = [];
    const horiz = v.dir === 'L' || v.dir === 'R';
    for (let i = 0; i < v.len; i++) out.push(horiz ? [v.x + i, v.y] : [v.x, v.y + i]);
    return out;
  }
  function init(level) {
    const s = {
      cols: level.cols || COLS, rows: level.rows || ROWS,
      veh: level.vehicles.map((v, i) => ({ id: i, c: v.c, x: v.x, y: v.y, dir: v.dir, len: v.len || 2, cap: v.cap || 4, where: 'lot', spot: -1, filled: 0, parkOrder: -1 })),
      spots: new Array(level.spots).fill(-1),
      q: level.queue.split(''), qi: 0, parkSeq: 0, over: null,
    };
    return s;
  }
  function clone(s) {
    return { cols: s.cols, rows: s.rows, veh: s.veh.map(v => Object.assign({}, v)), spots: s.spots.slice(), q: s.q, qi: s.qi, parkSeq: s.parkSeq, over: s.over };
  }
  function occGrid(s) {
    const g = new Array(s.cols * s.rows).fill(-1);
    for (const v of s.veh) if (v.where === 'lot') for (const [x, y] of cellsOf(v)) g[y * s.cols + x] = v.id;
    return g;
  }
  // front cell and path cells to edge
  function pathCells(s, v) {
    const cs = cellsOf(v); const [dx, dy] = DIRV[v.dir];
    let [fx, fy] = (v.dir === 'U' || v.dir === 'L') ? cs[0] : cs[cs.length - 1];
    const out = [];
    let x = fx + dx, y = fy + dy;
    while (x >= 0 && y >= 0 && x < s.cols && y < s.rows) { out.push([x, y]); x += dx; y += dy; }
    return out;
  }
  function blocker(s, id, g) {
    g = g || occGrid(s);
    const v = s.veh[id];
    for (const [x, y] of pathCells(s, v)) { const o = g[y * s.cols + x]; if (o >= 0 && o !== id) return o; }
    return -1;
  }
  function freeSpot(s) { return s.spots.indexOf(-1); }
  function headColor(s) { return s.qi < s.q.length ? s.q[s.qi] : null; }
  function resolve(s, ev) {
    for (;;) {
      const h = headColor(s); if (!h) break;
      let best = null;
      for (const vid of s.spots) if (vid >= 0) { const v = s.veh[vid]; if (v.c === h && v.filled < v.cap && (!best || v.parkOrder < best.parkOrder)) best = v; }
      if (!best) break;
      best.filled++; s.qi++;
      ev.push({ t: 'board', v: best.id, pax: s.qi - 1, left: best.cap - best.filled });
      if (best.filled === best.cap) {
        s.spots[best.spot] = -1; best.where = 'gone';
        ev.push({ t: 'depart', v: best.id, spot: best.spot });
      }
    }
    // status
    const lotLeft = s.veh.some(v => v.where === 'lot');
    const parked = s.spots.some(x => x >= 0);
    if (!lotLeft && !parked && s.qi >= s.q.length) s.over = 'win';
    else if (freeSpot(s) < 0) s.over = 'fail';
    return ev;
  }
  function tap(s, id) {
    if (s.over) return { ok: false, reason: 'over' };
    const v = s.veh[id]; if (!v || v.where !== 'lot') return { ok: false, reason: 'gone' };
    const b = blocker(s, id); if (b >= 0) return { ok: false, reason: 'blocked', blocker: b };
    const sp = freeSpot(s); if (sp < 0) return { ok: false, reason: 'full' };
    v.where = 'spot'; v.spot = sp; v.parkOrder = s.parkSeq++; s.spots[sp] = id;
    const ev = [{ t: 'drive', v: id, spot: sp }];
    resolve(s, ev);
    return { ok: true, events: ev };
  }
  function movable(s) {
    const g = occGrid(s); const out = [];
    for (const v of s.veh) if (v.where === 'lot' && blocker(s, v.id, g) < 0) out.push(v.id);
    return out;
  }
  function key(s) { return s.veh.map(v => v.where[0] + (v.where === 'spot' ? v.filled + ':' + v.spot : '')).join(',') + '|' + s.qi; }
  function failReasonColor(s) { return headColor(s); }
  const API = { COLS, ROWS, DIRV, cellsOf, init, clone, occGrid, pathCells, blocker, tap, movable, key, headColor, freeSpot, failReasonColor };
  if (typeof module !== 'undefined') module.exports = API; else root.Logic = API;
})(this);
