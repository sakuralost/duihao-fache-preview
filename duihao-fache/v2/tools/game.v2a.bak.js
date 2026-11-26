/* 对号发车 v2 — 表现层（只对生成图片做位移/旋转/缩放/透明度和简单滤镜） */
(function () {
  'use strict';
  const L = window.Logic, LEVELS = window.LEVELS;
  const $ = s => document.querySelector(s);
  const A = 'assets/';
  // ---------- 布局常量（舞台 390x844） ----------
  const CELL = 44, LOT_X = 63, LOT_Y = 306, COLS = 6, ROWS = 8;
  const SPOT_W = 58, SPOT_H = 106, SPOT_Y = 156, SPOT_GAP = 8, SPOT_CY = SPOT_Y + 8 + 41;
  const ROAD_Y = 286, LANE_L = 47, LANE_R = 343, LANE_B = 682;
  const HEAD_X = 46, FEET_Y = 132, PAX_SP = 25, VISIBLE = 12;
  const VEH_W = 36;
  const DIR_ROT = { U: 0, R: 90, D: 180, L: -90 };
  const CNAME = { A: '蓝', B: '橙', C: '紫', D: '绿' };
  const CCOL = { A: '#2f7fd0', B: '#e5761b', C: '#8a5cc9', D: '#3f9e3f' };
  const PAX_FLIP_IDLE = 1;   // 队伍里朝向（1=原图，-1=镜像）
  // ---------- 舞台缩放 ----------
  const stage = $('#stage');
  function fit() {
    const s = Math.min(window.innerWidth / 390, window.innerHeight / 844);
    stage.style.transform = `translate(-50%,-50%) scale(${s})`;
  }
  window.addEventListener('resize', fit); fit();
  // ---------- 进度存档 ----------
  const SAVE_KEY = 'duihao-v2-progress';
  let progress = { unlocked: 1, stars: {} };
  try { const p = JSON.parse(localStorage.getItem(SAVE_KEY)); if (p) progress = p; } catch (e) {}
  function saveProgress() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) {} }
  // ---------- 预加载 ----------
  const preload = ['bus-a', 'bus-b', 'bus-c', 'bus-d'].map(n => A + n + '.png');
  'abcd'.split('').forEach(c => [0, 1, 2].forEach(i => preload.push(`${A}pax-${c}-${i}.png`)));
  for (let i = 0; i < 14; i++) preload.push(`${A}confetti-${i}.png`);
  preload.forEach(src => { const im = new Image(); im.src = src; });
  // ---------- 时间与补间 ----------
  const now = () => performance.now() / 1000;
  let tasks = [];
  function add(start, dur, fn, done) { const t = { start, dur: Math.max(dur, 1e-4), fn, done }; tasks.push(t); return t; }
  function at(time, fn) { return add(time, 1e-4, null, fn); }
  function cancelAll() { tasks = []; }
  const E = {
    lin: u => u, inQ: u => u * u, outQ: u => 1 - (1 - u) * (1 - u), inOutQ: u => u < .5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u),
    outC: u => 1 - Math.pow(1 - u, 3), inOutC: u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2,
    outBack: u => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
  };
  const lerp = (a, b, u) => a + (b - a) * u;
  function angTo(cur, target) { return cur + ((((target - cur) % 360) + 540) % 360 - 180); }
  // ---------- 实体 ----------
  class Ent {
    constructor(el, w, h, kind) { this.el = el; this.w = w; this.h = h; this.kind = kind; this.x = 0; this.y = 0; this.rot = 0; this.sx = 1; this.sy = 1; this.ox = 0; this.oy = 0; this.alpha = 1; this.lift = 1; this.flip = 1; this.idle = true; this.phase = Math.random() * 6.28; this.visible = true; }
    render(t) {
      if (!this.visible) { if (this.el.style.display !== 'none') this.el.style.display = 'none'; return; }
      if (this.el.style.display === 'none') this.el.style.display = '';
      let sx = this.sx * this.lift, sy = this.sy * this.lift, oy = this.oy;
      if (this.kind === 'veh') {
        if (this.idle) { const b = Math.sin(t * 2.4 + this.phase); oy += b * 0.6; sx *= 1 + 0.012 * b; sy *= 1 - 0.006 * b; }
        this.el.style.transform = `translate(${(this.x - this.w / 2 + this.ox).toFixed(2)}px,${(this.y - this.h / 2 + oy).toFixed(2)}px) rotate(${this.rot.toFixed(2)}deg) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
        if (this.badge) this.badge.style.transform = `rotate(${(-this.rot).toFixed(1)}deg)`;
      } else {
        if (this.idle) { const b = Math.sin(t * 3.1 + this.phase); sy *= 1 + 0.03 * b; sx *= 1 - 0.012 * b; }
        this.el.style.transform = `translate(${(this.x - this.w / 2 + this.ox).toFixed(2)}px,${(this.y - this.h + oy).toFixed(2)}px) scale(${(sx * this.flip).toFixed(3)},${sy.toFixed(3)})`;
      }
      this.el.style.opacity = this.alpha;
    }
  }
  // ---------- 路径（圆角折线） ----------
  function buildPath(pts, radius) {
    const out = [];
    const pushLine = (a, b) => { const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / 3)); for (let i = 1; i <= n; i++) out.push({ x: lerp(a.x, b.x, i / n), y: lerp(a.y, b.y, i / n) }); };
    out.push({ x: pts[0].x, y: pts[0].y });
    let cur = pts[0];
    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = cur, p1 = pts[i], p2 = pts[i + 1];
      const d01 = Math.hypot(p1.x - p0.x, p1.y - p0.y), d12 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const r = Math.min(radius, d01 / 2, d12 / 2);
      const a = { x: p1.x - (p1.x - p0.x) / d01 * r, y: p1.y - (p1.y - p0.y) / d01 * r };
      const b = { x: p1.x + (p2.x - p1.x) / d12 * r, y: p1.y + (p2.y - p1.y) / d12 * r };
      pushLine(p0, a);
      for (let k = 1; k <= 8; k++) { const u = k / 8; out.push({ x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * p1.x + u * u * b.x, y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * p1.y + u * u * b.y }); }
      cur = b;
    }
    pushLine(cur, pts[pts.length - 1]);
    const len = [0]; for (let i = 1; i < out.length; i++) len.push(len[i - 1] + Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y));
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
  // ---------- 屏幕切换 ----------
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  }
  function fadeSwap(fn) { const f = $('#fade'); f.classList.add('on'); setTimeout(() => { fn(); f.classList.remove('on'); }, 300); }
  let toastTimer = 0;
  function toast(msg) { const t = $('#toast'); t.querySelector('span').textContent = msg; t.classList.remove('hidden'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 1300); }

  // ---------- 局内状态 ----------
  let G = null; // 当前关卡运行时
  const fxLayer = $('#fx-layer'), vehLayer = $('#veh-layer'), paxLayer = $('#pax-layer'), spotLayer = $('#spot-layer'), lotLayer = $('#lot-layer');
  function cellCenter(v) { const cs = L.cellsOf(v); let x = 0, y = 0; cs.forEach(([cx, cy]) => { x += cx; y += cy; }); x /= cs.length; y /= cs.length; return { x: LOT_X + (x + .5) * CELL, y: LOT_Y + (y + .5) * CELL }; }
  function spotX(i) { const n = G.level.spots, total = n * SPOT_W + (n - 1) * SPOT_GAP, s0 = 195 - total / 2; return s0 + i * (SPOT_W + SPOT_GAP) + SPOT_W / 2; }
  function slotPos(k) { return { x: HEAD_X + k * PAX_SP, y: FEET_Y }; }

  function startLevel(idx) {
    cancelAll();
    const level = LEVELS[idx];
    const state = L.init(level);
    G = { idx, level, state, history: [], veh: [], pax: [], spots: [], counters: [], visHead: 0, boardCursor: 0, arriveAt: {}, lastBoardEnd: {}, spotFreeAt: [], busyUntil: 0, chain: 0, lastDepartT: -9, lastDepartChain: -1, combo: 0, maxCombo: 0, undoFree: 2, undoUsed: 0, lockUntil: 0, ended: false, tutorial: !!level.tutorial };
    lotLayer.innerHTML = ''; spotLayer.innerHTML = ''; vehLayer.innerHTML = ''; paxLayer.innerHTML = ''; fxLayer.innerHTML = '';
    hideCards();
    $('#level-title').textContent = `第 ${idx + 1} 关 · ${level.name}`;
    // 车场地砖
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const im = document.createElement('img'); im.src = A + 'tile-lot.jpg'; im.className = 'lot-tile'; im.style.left = (LOT_X + x * CELL) + 'px'; im.style.top = (LOT_Y + y * CELL) + 'px'; lotLayer.appendChild(im); }
    // 车位
    for (let i = 0; i < level.spots; i++) {
      const d = document.createElement('div'); d.className = 'spot'; d.style.left = (spotX(i) - SPOT_W / 2) + 'px'; d.style.top = SPOT_Y + 'px';
      d.innerHTML = `<img src="${A}tile-spot.jpg"><div class="warn-lbl"><img src="${A}pill.png"><span>最后 1 个车位！</span></div>`;
      spotLayer.appendChild(d); G.spots.push(d); G.spotFreeAt.push(0);
      const c = document.createElement('div'); c.className = 'counter'; c.style.left = (spotX(i) - 32) + 'px'; c.style.top = (SPOT_Y + SPOT_H - 14) + 'px'; c.style.opacity = 0;
      c.innerHTML = `<img src="${A}pill.png"><span></span>`; fxLayer.appendChild(c); G.counters.push(c);
    }
    // 车辆
    state.veh.forEach(v => {
      const h = v.len * CELL - 6;
      const el = document.createElement('div'); el.className = 'veh'; el.dataset.id = v.id; el.dataset.color = v.c;
      el.style.width = VEH_W + 'px'; el.style.height = h + 'px';
      el.innerHTML = `<img class="body" src="${A}bus-${v.c.toLowerCase()}.png"><img class="arrow" src="${A}arrow.png"><div class="vb"><img src="${A}badge.png"><span style="color:${CCOL[v.c]}">${v.c}</span></div>`;
      vehLayer.appendChild(el);
      const e = new Ent(el, VEH_W, h, 'veh'); const c = cellCenter(v); e.x = c.x; e.y = c.y; e.rot = DIR_ROT[v.dir]; e.badge = el.querySelector('.vb');
      e.sx = e.sy = 0; const t0 = now() + 0.15 + v.id * 0.05;
      add(t0, 0.35, u => { const s = E.outBack(u); e.sx = e.sy = s; });
      el.style.zIndex = 10 + v.y;
      el.addEventListener('pointerdown', () => { if (G.state.veh[v.id].where === 'lot') { el.classList.add('lift'); e.lift = 1.07; } });
      const up = () => { el.classList.remove('lift'); e.lift = 1; };
      el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
      el.addEventListener('click', () => onTap(v.id));
      G.veh.push(e);
    });
    // 乘客
    state.q.forEach((c, i) => {
      const el = document.createElement('div'); el.className = 'pax'; el.innerHTML = `<img src="${A}pax-${c.toLowerCase()}-0.png">`;
      el.style.zIndex = 500 - i; paxLayer.appendChild(el);
      const e = new Ent(el, 27, 54, 'pax'); e.c = c; e.img = el.firstChild; e.flip = PAX_FLIP_IDLE;
      const p = slotPos(i); e.x = p.x; e.y = p.y; e.visible = i < VISIBLE;
      if (i < VISIBLE) { const t0 = now() + 0.2 + i * 0.05; e.alpha = 0; e.ox = 60; add(t0, 0.35, u => { e.alpha = Math.min(1, u * 2); e.ox = 60 * (1 - E.outC(u)); }); }
      G.pax.push(e);
    });
    G.headMark = document.createElement('div'); G.headMark.className = 'head-mark'; G.headMark.innerHTML = `<img src="${A}pill.png"><span>队首</span>`; fxLayer.appendChild(G.headMark);
    G.more = document.createElement('div'); G.more.className = 'more'; fxLayer.appendChild(G.more);
    lastSpotSig = '';
    layoutQueue(false);
    // 教学
    $('#tutorial').classList.toggle('hidden', !G.tutorial);
    refreshHUD();
  }

  // ---------- 队伍 ----------
  function layoutQueue(animate, t0) {
    const head = G.visHead;
    G.pax.forEach((e, i) => {
      if (e.walking || e.gone) return;
      const k = i - head; if (k < 0) return;
      const p = slotPos(Math.min(k, VISIBLE));
      const wasVisible = e.visible;
      if (k >= VISIBLE) { e.visible = false; e.x = p.x; e.y = p.y; return; }
      e.visible = true;
      if (!animate || !wasVisible) { if (!wasVisible && animate) { e.x = p.x + PAX_SP; e.alpha = 0; add(t0, 0.18, u => { e.alpha = u; e.x = lerp(p.x + PAX_SP, p.x, E.outQ(u)); }); } else { e.x = p.x; e.y = p.y; } return; }
      const sx0 = e.x;
      if (Math.abs(sx0 - p.x) < 0.5) return;
      add(t0, 0.16, u => { e.x = lerp(sx0, p.x, E.outQ(u)); e.oy = -Math.sin(u * Math.PI) * 2.5; });
    });
    const rem = G.pax.length - head;
    const hm = G.headMark; if (rem > 0) { hm.style.display = ''; hm.style.left = HEAD_X + 'px'; hm.style.top = (FEET_Y - 1) + 'px'; } else hm.style.display = 'none';
    const hidden = Math.max(0, rem - VISIBLE);
    G.more.textContent = hidden ? `+${hidden}` : ''; G.more.style.left = (HEAD_X + VISIBLE * PAX_SP - 8) + 'px'; G.more.style.top = (FEET_Y - 26) + 'px';
    refreshChips();
  }
  function refreshChips() {
    const q = G.state.q, chips = $('#chips'); chips.innerHTML = '';
    if (G.visHead >= q.length) { $('#queue-count').innerHTML = ''; return; }
    const lbl = document.createElement('span'); lbl.className = 'chip-label'; lbl.textContent = '接下来'; chips.appendChild(lbl);
    let i = G.visHead, n = 0;
    while (i < q.length && n < 5) { const c = q[i]; let j = i; while (j < q.length && q[j] === c) j++; const d = document.createElement('div'); d.className = 'chip' + (n === 0 ? ' first' : ''); d.innerHTML = `<img src="${A}pill.png"><span style="color:${CCOL[c]}">${CNAME[c]}×${j - i}</span>`; chips.appendChild(d); i = j; n++; }
    $('#queue-count').innerHTML = `剩<br>${q.length - G.visHead}人`;
  }

  // ---------- HUD / 提示 ----------
  function refreshHUD() {
    const s = G.state;
    const mov = new Set(L.movable(s)); const h = L.headColor(s);
    G.veh.forEach((e, i) => { const v = s.veh[i]; e.el.classList.toggle('glow', !s.over && v.where === 'lot' && mov.has(i) && v.c === h); });
    refreshSpots(now());
    const un = $('#undo-num'), ub = $('#undo-badge');
    if (G.undoFree > 0) { un.textContent = G.undoFree; ub.classList.remove('ad'); } else { un.textContent = '看'; ub.classList.add('ad'); }
    if (G.tutorial) placeHand();
  }
  // 车位显示按画面：车还停在位上（或正开过来）就算占用
  let lastSpotSig = '';
  function refreshSpots(t) {
    const s = G.state; const n = s.spots.length;
    let vfree = 0, vfreeIdx = -1;
    for (let i = 0; i < n; i++) { const occ = s.spots[i] >= 0 || G.spotFreeAt[i] > t; if (!occ) { vfree++; if (vfreeIdx < 0) vfreeIdx = i; } }
    const lfree = s.spots.filter(x => x < 0).length;
    const warnIdx = (!s.over && lfree === 1 && vfree === 1) ? vfreeIdx : -1;
    // 队首等待提示
    const h = L.headColor(s); let waiting = false;
    if (h && t > G.boardCursor + 0.35) waiting = !s.spots.some(vid => vid >= 0 && s.veh[vid].c === h);
    const sig = vfree + '|' + warnIdx + '|' + waiting + '|' + h;
    if (sig === lastSpotSig) return; lastSpotSig = sig;
    const info = $('#spot-info'); info.innerHTML = `空车位 <b>${vfree}</b> / ${n}`; info.classList.toggle('low', vfree <= 1);
    G.spots.forEach((d, i) => d.classList.toggle('warn', i === warnIdx));
    const sp = G.headMark.querySelector('span');
    if (waiting) { sp.innerHTML = `等<b style="color:${CCOL[h]}">${CNAME[h]}</b>车`; G.headMark.classList.add('wait'); } else { sp.textContent = '队首'; G.headMark.classList.remove('wait'); }
  }
  function placeHand() {
    const s = G.state; const h = L.headColor(s); const mov = L.movable(s);
    const id = mov.find(i => s.veh[i].c === h);
    const hand = $('#tut-hand');
    if (id == null) { hand.style.display = 'none'; return; }
    hand.style.display = ''; G.handTarget = G.veh[id];
  }

  // ---------- 点车 ----------
  function onTap(id) {
    if (!G || G.ended) return;
    const t = now(); if (t < G.lockUntil) return;
    const s = G.state; const v = s.veh[id]; if (v.where !== 'lot') return;
    if (s.over) return;
    const b = L.blocker(s, id);
    if (b >= 0) { bump(id, b, t); return; }
    if (L.freeSpot(s) < 0) { toast('车位已满'); return; }
    G.history.push(L.clone(s));
    const r = L.tap(s, id);
    G.chain++;
    if (G.tutorial) { G.tutorial = false; $('#tutorial').classList.add('hidden'); }
    schedule(r.events, t);
    refreshHUD();
    if (s.over) {
      const endT = G.busyUntil;
      G.ended = true; G.veh.forEach(e => e.el.classList.remove('glow'));
      if (s.over === 'win') at(endT + 0.15, winSequence);
      else at(endT + 0.1, failSequence);
    }
  }
  function bump(id, bid, t) {
    const e = G.veh[id], v = G.state.veh[id]; const [dx, dy] = L.DIRV[v.dir];
    G.lockUntil = Math.max(G.lockUntil, t + 0.05);
    add(t, 0.1, u => { const k = E.outQ(u) * CELL * 0.25; e.ox = dx * k; e.oy = dy * k; e.sy = 1 - 0.06 * u; });
    add(t + 0.1, 0.16, u => { const k = (1 - E.outBack(u)) * CELL * 0.25; e.ox = dx * k; e.oy = dy * k; e.sy = 0.94 + 0.06 * u; }, () => { e.ox = e.oy = 0; e.sy = 1; });
    const be = G.veh[bid]; at(t + 0.08, () => { be.el.classList.remove('red'); void be.el.offsetWidth; be.el.classList.add('red'); });
    at(t + 0.6, () => be.el.classList.remove('red'));
    const f = $('#field');
    add(t + 0.08, 0.22, u => { const a = (1 - u) * 3; f.style.transform = `translate(${(Math.sin(u * 40) * a).toFixed(2)}px,${(Math.cos(u * 33) * a * .6).toFixed(2)}px)`; }, () => { f.style.transform = ''; });
  }

  // ---------- 事件排程 ----------
  function schedule(events, t) {
    const chain = G.chain;
    for (const ev of events) {
      if (ev.t === 'drive') scheduleDrive(ev.v, ev.spot, t);
      else if (ev.t === 'board') scheduleBoard(ev.v, ev.pax, ev.left);
      else if (ev.t === 'depart') scheduleDepart(ev.v, ev.spot, chain);
    }
  }
  function drivePath(v, spot) {
    const c = cellCenter(v), sx = spotX(spot); const pts = [{ x: c.x, y: c.y }];
    if (v.dir === 'U') { if (Math.abs(c.x - sx) > 2) { pts.push({ x: c.x, y: ROAD_Y }, { x: sx, y: ROAD_Y }); } }
    else if (v.dir === 'L') pts.push({ x: LANE_L, y: c.y }, { x: LANE_L, y: ROAD_Y }, { x: sx, y: ROAD_Y });
    else if (v.dir === 'R') pts.push({ x: LANE_R, y: c.y }, { x: LANE_R, y: ROAD_Y }, { x: sx, y: ROAD_Y });
    else { const side = c.x < 195 ? LANE_L : LANE_R; pts.push({ x: c.x, y: LANE_B }, { x: side, y: LANE_B }, { x: side, y: ROAD_Y }, { x: sx, y: ROAD_Y }); }
    pts.push({ x: sx, y: SPOT_CY });
    return buildPath(pts, 18);
  }
  function scheduleDrive(id, spot, t) {
    const e = G.veh[id], v = G.state.veh[id];
    const P = drivePath(v, spot);
    const dj = Math.max(0, P.total - (ROAD_Y - SPOT_CY) - 14);
    const t1 = t + 0.09, T1 = 0.12 + dj / 1300;
    const t2 = Math.max(t1 + T1, G.spotFreeAt[spot] + 0.03), T2 = 0.26;
    const arrive = t2 + T2;
    G.arriveAt[id] = arrive + 0.04; G.lastBoardEnd[id] = arrive;
    G.spotFreeAt[spot] = 1e9; // 被占用
    e.el.classList.remove('glow');
    // 起步蓄力
    add(t, 0.09, u => { e.idle = false; e.sx = 1 + 0.08 * u; e.sy = 1 - 0.12 * u; e.el.style.zIndex = 200; });
    // 加速驶出
    add(t1, T1, u => { const d = dj * (u < 0.35 ? E.inQ(u / 0.35) * 0.25 : 0.25 + 0.75 * (u - 0.35) / 0.65); const p = pathAt(P, d); e.x = p.x; e.y = p.y; e.rot = angTo(e.rot, p.rot); const st = Math.sin(u * Math.PI); e.sx = lerp(1.08, 1, Math.min(1, u * 4)) - 0.03 * st; e.sy = lerp(0.88, 1, Math.min(1, u * 4)) + 0.07 * st; });
    // 入位刹车
    add(t2, T2, u => { const d = dj + (P.total - dj) * E.outC(u); const p = pathAt(P, d); e.x = p.x; e.y = p.y; e.rot = angTo(e.rot, p.rot); e.sy = 1 + 0.04 * (1 - u); },
      () => { e.rot = 0; e.el.classList.add('parked'); e.el.style.zIndex = 60; });
    add(arrive, 0.18, u => { const k = Math.sin(u * Math.PI); e.sy = 1 - 0.06 * k; e.oy = -2 * k; }, () => { e.sy = 1; e.oy = 0; e.idle = true; });
    // 记录上车前的计数显示
    at(arrive, () => setCounter(spot, v.cap, v.c, false));
    G.counterLeft = G.counterLeft || {}; G.counterLeft[id] = v.cap;
    G.busyUntil = Math.max(G.busyUntil, arrive + 0.2);
  }
  function setCounter(spot, left, c, pop, cap) {
    const el = G.counters[spot]; el.style.opacity = 1;
    el.querySelector('span').innerHTML = left > 0 ? `<span style="color:${CCOL[c]}">还差 ${left}</span>` : `<span style="color:#e2462f">满员!</span>`;
    if (pop) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  }
  function scheduleBoard(id, paxIdx, left) {
    const e = G.veh[id], v = G.state.veh[id], P = G.pax[paxIdx];
    const tb = Math.max(G.boardCursor, G.arriveAt[id]); G.boardCursor = tb + 0.11;
    const sx = spotX(v.spot);
    const WALK = 0.3, HOP = 0.12;
    const door = { x: sx + 17, y: SPOT_Y + 22 };
    at(tb, () => {
      G.visHead = paxIdx + 1; P.walking = true; P.idle = false; P.visible = true; P.el.style.zIndex = 900;
      layoutQueue(true, tb);
      const x0 = P.x, y0 = P.y; P.flip = door.x >= x0 ? 1 : -1;
      add(tb, WALK, u => {
        const k = E.inOutQ(u); P.x = lerp(x0, door.x, k); P.y = lerp(y0, door.y, k);
        const step = Math.floor(u * WALK / 0.075); P.img.src = `${A}pax-${P.c.toLowerCase()}-${1 + (step % 2)}.png`;
        P.oy = -Math.abs(Math.sin(u * Math.PI * 4)) * 3;
      });
      add(tb + WALK, HOP, u => { P.x = lerp(door.x, sx, u); P.y = lerp(door.y, SPOT_Y + 52, u); P.oy = -Math.sin(u * Math.PI) * 12; const s = 1 - 0.55 * u; P.sx = P.sy = s; P.alpha = 1 - u * u; },
        () => { P.visible = false; P.gone = true; P.walking = false; });
    });
    const tin = tb + WALK + HOP;
    at(tin, () => {
      setCounter(v.spot, left, v.c, true);
      add(tin, 0.14, u => { const k = Math.sin(u * Math.PI); e.sy = 1 - 0.07 * k; e.sx = 1 + 0.04 * k; e.oy = 1.5 * k; }, () => { e.sy = e.sx = 1; e.oy = 0; });
    });
    G.lastBoardEnd[id] = tin + 0.14;
    G.busyUntil = Math.max(G.busyUntil, tin + 0.2);
  }
  function scheduleDepart(id, spot, chain) {
    const e = G.veh[id];
    const td = G.lastBoardEnd[id] + 0.1;
    // 连发
    if (chain === G.lastDepartChain || td - G.lastDepartT <= 1.5) G.combo++; else G.combo = 1;
    G.lastDepartT = td; G.lastDepartChain = chain; G.maxCombo = Math.max(G.maxCombo, G.combo);
    const combo = G.combo, sx = spotX(spot);
    // 鸣笛弹跳
    at(td, () => { e.idle = false; fxText('嘀嘀！', 'honk', sx, SPOT_Y - 2, 0.7, -16); if (combo >= 2) comboPop(combo, td); });
    add(td, 0.24, u => { const k = Math.sin(u * Math.PI * 2) * (1 - u); e.sx = 1 + 0.12 * k; e.sy = 1 - 0.1 * k; e.oy = -3 * Math.abs(k); });
    // 倒出车位
    const t1 = td + 0.26, T1 = 0.2;
    at(t1, () => { G.counters[spot].style.opacity = 0; e.el.style.zIndex = 210; });
    add(t1, T1, u => { const k = E.inOutQ(u); e.y = lerp(SPOT_CY, ROAD_Y, k); e.x = sx + 6 * k; e.rot = lerp(0, 35, k); e.sx = 1; e.sy = 1; });
    // 拉伸开走
    const t2 = t1 + T1, T2 = 0.42; const x0 = sx + 6;
    add(t2, T2, u => { const k = E.inQ(u); e.x = lerp(x0, 450, k); e.y = ROAD_Y; e.rot = lerp(35, 90, Math.min(1, u * 3)); e.sy = 1 + 0.16 * Math.min(1, u * 2); e.sx = 1 - 0.05 * Math.min(1, u * 2); }, () => { e.visible = false; });
    // 车位亮起
    G.spotFreeAt[spot] = t1 + T1;
    at(t1 + T1, () => { const d = G.spots[spot]; d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash'); });
    G.busyUntil = Math.max(G.busyUntil, t2 + T2);
  }
  // ---------- 特效 ----------
  function fxText(txt, cls, x, y, dur, rise) {
    const d = document.createElement('div'); d.className = 'fx-text ' + cls; d.textContent = txt; d.style.left = x + 'px'; d.style.top = y + 'px'; fxLayer.appendChild(d);
    const t = now(); add(t, dur, u => { d.style.transform = `translate(-50%,-50%) translateY(${(rise * E.outQ(u)).toFixed(1)}px) scale(${(u < .2 ? lerp(.5, 1.15, u / .2) : lerp(1.15, 1, Math.min(1, (u - .2) / .2))).toFixed(3)})`; d.style.opacity = u > .7 ? (1 - (u - .7) / .3) : 1; }, () => d.remove());
    return d;
  }
  function comboPop(n, t) { fxText(`连发 ×${n}`, 'combo', 195, 352, 1.0, -46 - n * 6); }
  function confetti() {
    const t = now();
    for (let i = 0; i < 44; i++) {
      const im = document.createElement('img'); im.src = `${A}confetti-${i % 14}.png`; im.className = 'confetti'; fxLayer.appendChild(im);
      const x0 = 195 + (Math.random() - .5) * 60, y0 = 330, vx = (Math.random() - .5) * 520, vy = -380 - Math.random() * 360, rs = (Math.random() - .5) * 900, sc = .7 + Math.random() * .7, delay = Math.random() * .15;
      add(t + delay, 1.9, u => { const tt = u * 1.9; const x = x0 + vx * tt, y = y0 + vy * tt + 520 * tt * tt; im.style.transform = `translate(${x - 10}px,${y - 10}px) rotate(${rs * tt}deg) scale(${sc})`; im.style.opacity = u > .75 ? (1 - u) * 4 : 1; }, () => im.remove());
    }
  }
  // ---------- 结束 ----------
  function hideCards() { ['#card-mask', '#card-win', '#card-fail'].forEach(s => $(s).classList.add('hidden')); }
  function calcStars() { let s = 3; if (G.undoUsed > 0) s--; if (!G.level.tutorial && G.maxCombo < 2) s--; return Math.max(1, s); }
  function winSequence() {
    confetti();
    const stars = calcStars();
    const key = String(G.idx + 1); progress.stars[key] = Math.max(progress.stars[key] || 0, stars); progress.unlocked = Math.max(progress.unlocked, G.idx + 2); saveProgress();
    setTimeout(() => {
      $('#card-mask').classList.remove('hidden'); $('#card-win').classList.remove('hidden');
      const box = $('#win-stars'); box.innerHTML = '';
      for (let i = 0; i < 3; i++) { const im = document.createElement('img'); im.src = A + (i < stars ? 'star-gold.png' : 'star-grey.png'); if (i === 1) im.className = 'mid'; box.appendChild(im); setTimeout(() => im.classList.add('pop'), 250 + i * 170); }
      $('#win-stat').textContent = `最高连发 ×${Math.max(1, G.maxCombo)} · 撤销 ${G.undoUsed} 次`;
      const last = G.idx + 1 >= LEVELS.length; const nb = $('#win-next'); nb.classList.toggle('disabled', last); nb.querySelector('span').textContent = last ? '敬请期待' : '下一关';
    }, 450);
  }
  function failSequence() {
    // 定格 0.5 秒 → 车位一起抖 → 原因卡片
    const t = now();
    add(t + 0.5, 0.32, u => { const a = (1 - u) * 4; G.spots.forEach((d, i) => d.style.transform = `translateX(${(Math.sin(u * 46 + i) * a).toFixed(2)}px)`); G.veh.forEach(e => { if (G.state.veh[e.el.dataset.id].where === 'spot') e.ox = Math.sin(u * 46) * a; }); }, () => { G.spots.forEach(d => d.style.transform = ''); G.veh.forEach(e => e.ox = 0); });
    at(t + 0.85, () => {
      const c = L.headColor(G.state);
      $('#fail-reason').innerHTML = `车位满了，队首要的是 <b style="color:${CCOL[c]}">${CNAME[c]}</b> 色<br><small style="font-size:14px;font-weight:700">停着的车里没有${CNAME[c]}色车</small>`;
      $('#card-mask').classList.remove('hidden'); $('#card-fail').classList.remove('hidden');
    });
  }
  // ---------- 撤销 ----------
  function requestUndo() {
    if (!G || !G.history.length) { toast('还没有可撤销的步骤'); return; }
    if (now() < G.lockUntil) return;
    if (G.undoFree > 0) { G.undoFree--; doUndo(); return; }
    // 免费次数用完：3 秒「观看」占位，获得 1 次
    const w = $('#watch'); w.classList.remove('hidden'); let n = 3; $('#watch-sec').textContent = n;
    const iv = setInterval(() => { n--; $('#watch-sec').textContent = n; if (n <= 0) { clearInterval(iv); w.classList.add('hidden'); doUndo(); } }, 1000);
  }
  function doUndo() {
    cancelAll(); hideCards();
    const prev = G.history.pop(); G.state = prev; G.undoUsed++; G.ended = false;
    const t = now(), D = 0.4; G.lockUntil = t + D;
    G.boardCursor = 0; G.arriveAt = {}; G.lastBoardEnd = {}; G.spotFreeAt = G.spotFreeAt.map(() => 0); G.busyUntil = 0; G.combo = 0; G.lastDepartT = -9;
    $('#field').classList.add('rewinding'); fxText('⟲ 撤销', 'rewind', 195, 300, 0.6, -20);
    prev.veh.forEach((v, i) => {
      const e = G.veh[i]; let tx, ty, tr;
      e.el.classList.remove('red', 'glow');
      if (v.where === 'lot') { const c = cellCenter(v); tx = c.x; ty = c.y; tr = DIR_ROT[v.dir]; e.el.classList.remove('parked'); e.el.style.zIndex = 10 + v.y; }
      else if (v.where === 'spot') { tx = spotX(v.spot); ty = SPOT_CY; tr = 0; e.el.classList.add('parked'); e.el.style.zIndex = 60; G.spotFreeAt[v.spot] = 1e9; }
      else { add(t, D * .6, u => e.alpha = 1 - u, () => { e.visible = false; e.alpha = 1; }); return; }
      if (!e.visible) { e.visible = true; e.x = 430; e.y = ROAD_Y; e.rot = 90; e.alpha = 1; }
      const x0 = e.x, y0 = e.y, r0 = e.rot, r1 = angTo(r0, tr);
      e.idle = false;
      add(t, D, u => { const k = E.inOutC(u); e.x = lerp(x0, tx, k); e.y = lerp(y0, ty, k); e.rot = lerp(r0, r1, k); e.sx = e.sy = 1; e.ox = e.oy = 0; }, () => { e.rot = tr; e.idle = true; });
    });
    G.counters.forEach(c => c.style.opacity = 0);
    prev.spots.forEach((vid, i) => { if (vid >= 0) { const v = prev.veh[vid]; setCounter(i, v.cap - v.filled, v.c, false); } });
    G.visHead = prev.qi;
    G.pax.forEach((P, i) => {
      P.walking = false; P.img.src = `${A}pax-${P.c.toLowerCase()}-0.png`; P.flip = PAX_FLIP_IDLE; P.sx = P.sy = 1; P.oy = 0; P.idle = true; P.el.style.zIndex = 500 - i;
      if (i < prev.qi) { P.visible = false; P.gone = true; return; }
      const k = i - prev.qi; const p = slotPos(Math.min(k, VISIBLE));
      if (k >= VISIBLE) { P.visible = false; P.gone = false; P.x = p.x; P.y = p.y; return; }
      if (P.gone || !P.visible) { P.gone = false; P.visible = true; P.x = p.x; P.y = p.y; P.alpha = 0; add(t + 0.1, D - 0.1, u => { P.alpha = u; P.sx = P.sy = lerp(.6, 1, E.outBack(u)); }); }
      else { const x0 = P.x, y0 = P.y; P.alpha = 1; add(t, D, u => { const kk = E.inOutC(u); P.x = lerp(x0, p.x, kk); P.y = lerp(y0, p.y, kk); }); }
    });
    lastSpotSig = '';
    layoutQueue(false);
    at(t + D, () => { $('#field').classList.remove('rewinding'); refreshHUD(); });
    refreshHUD();
    if (G.level.tutorial && G.history.length === 0) { G.tutorial = true; $('#tutorial').classList.remove('hidden'); }
  }
  // ---------- 主循环 ----------
  function frame() {
    const t = now();
    const list = tasks; const keep = [];
    for (let i = 0; i < list.length; i++) {
      const k = list[i];
      if (t < k.start) { keep.push(k); continue; }
      const u = Math.min(1, (t - k.start) / k.dur);
      if (k.fn) k.fn(u);
      if (u >= 1) { if (k.done) k.done(); } else keep.push(k);
    }
    // 回调里可能新增任务
    if (tasks === list) tasks = keep;
    if (G) {
      G.veh.forEach(e => e.render(t)); G.pax.forEach(e => e.render(t)); refreshSpots(t);
      if (G.tutorial && G.handTarget) { const h = $('#tut-hand'); const e = G.handTarget; const b = Math.abs(Math.sin(t * 4)); h.style.transform = `translate(${e.x - 8}px,${e.y - 92 + b * 14}px) scale(${1 - b * 0.06})`; }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- 选关 ----------
  function buildSelect() {
    const g = $('#level-grid'); g.innerHTML = '';
    for (let i = 1; i <= 20; i++) {
      const d = document.createElement('div'); const playable = i <= LEVELS.length; const open = playable && i <= progress.unlocked;
      d.className = 'lv ' + (open ? 'open' : 'locked') + (open && i === Math.min(progress.unlocked, LEVELS.length) && !progress.stars[i] ? ' cur' : '');
      d.dataset.level = i;
      if (open) { const st = progress.stars[i] || 0; d.innerHTML = `<div class="tile"><img src="${A}tile-level.png"><div class="num">${i}</div></div><div class="lstars">${[0, 1, 2].map(k => `<img src="${A}${k < st ? 'star-gold' : 'star-grey'}.png">`).join('')}</div>`; d.addEventListener('click', () => fadeSwap(() => { startLevel(i - 1); show('scr-play'); })); }
      else { d.innerHTML = `<div class="tile"><img src="${A}tile-locked.png"></div><div class="lbl">${playable ? '过关解锁' : '尚未开放'}</div>`; d.addEventListener('click', () => toast(playable ? '先通过上一关' : '第 ' + i + ' 关尚未开放')); }
      g.appendChild(d);
    }
  }
  // ---------- 按钮 ----------
  $('#btn-start').addEventListener('click', () => fadeSwap(() => { startLevel(Math.min(progress.unlocked, LEVELS.length) - 1); show('scr-play'); }));
  $('#btn-select').addEventListener('click', () => { buildSelect(); show('scr-select'); });
  $('#sel-back').addEventListener('click', () => show('scr-start'));
  $('#play-back').addEventListener('click', () => { cancelAll(); hideCards(); G = null; buildSelect(); show('scr-select'); });
  $('#btn-undo').addEventListener('click', requestUndo);
  $('#btn-retry').addEventListener('click', () => fadeSwap(() => startLevel(G.idx)));
  $('#win-next').addEventListener('click', () => { if (G.idx + 1 >= LEVELS.length) { toast('第 4 关尚未开放'); return; } const n = G.idx + 1; fadeSwap(() => startLevel(n)); });
  $('#win-select').addEventListener('click', () => { hideCards(); cancelAll(); G = null; buildSelect(); show('scr-select'); });
  $('#fail-undo').addEventListener('click', requestUndo);
  $('#fail-retry').addEventListener('click', () => fadeSwap(() => startLevel(G.idx)));
  $('#fail-select').addEventListener('click', () => { hideCards(); cancelAll(); G = null; buildSelect(); show('scr-select'); });
  show('scr-start');
  // 测试钩子（只读 + 点车）
  window.DH = { get G() { return G; }, levels: LEVELS, tap: onTap, busy: () => G && now() < G.busyUntil + 0.05, start: i => { startLevel(i); show('scr-play'); }, version: 'DUIHAO-V2-20261117' };
})();
