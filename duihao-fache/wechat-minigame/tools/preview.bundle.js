(function(){
var modules = {};
function norm(from, id) {
  if (id.charAt(0) !== '.') return id;
  var base = from.split('/').slice(0, -1);
  id.split('/').forEach(function (p) {
    if (p === '.' || p === '') return;
    if (p === '..') base.pop();
    else base.push(p);
  });
  var out = base.join('/');
  if (out.indexOf('./') !== 0) out = './' + out.replace(/^\//, '');
  return out.replace(/\.js$/, '');
}
function req(from, id) {
  var key = norm(from, id);
  var m = modules[key];
  if (!m) throw new Error('找不到模块 ' + id + '（从 ' + from + ' 解析为 ' + key + '）');
  if (m.inited) return m.exports;
  m.inited = true;
  m.exports = {};
  var module = m;
  m.fn(function(sub) { return req(key, sub); }, m, m.exports);
  return m.exports;
}
function define(id, fn) { modules[id] = { fn: fn, exports: {}, inited: false }; }

define("./js/config", function(require, module, exports) {
/* 对号发车 — 布局常量与可替换配置 */

// 开通流量主后，把激励视频广告位 ID 填到这里即可接入真广告。
// 留空时走「观看（广告占位）」倒计时，并给予同等奖励，方便开发与提审前联调。
const AD_UNIT_ID = '';

// 备案截图专用开关：仅在微信开发者工具里截备案图时临时改为 true，截完必须改回 false（正式版保持关闭）。
const CAPTURE_MODE = false;

const SAVE_KEY = 'duihao-wechat-progress';
const VERSION = 'DUIHAO-WX-1.0.2';

// 舞台逻辑分辨率（与网页版一致）
const STAGE_W = 390, STAGE_H = 844;

const CELL = 44, LOT_X = 63, LOT_Y = 306, COLS = 6, ROWS = 8;
const SPOT_H = 106, SPOT_Y = 156, SPOT_CY = SPOT_Y + 8 + 41, MAX_EXTRA = 2;
const ROAD_Y = 286, LANE_L = 47, LANE_R = 343, LANE_B = 682;
const HEAD_X = 46, FEET_Y = 132, PAX_SP = 25, VISIBLE = 12;
const VEH_W = 36;
const DIR_ROT = { U: 0, R: 90, D: 180, L: -90 };
const CNAME = { A: '蓝', B: '橙', C: '紫', D: '绿' };
const CCOL = { A: '#2f7fd0', B: '#e5761b', C: '#8a5cc9', D: '#3f9e3f' };
const PAX_FLIP_IDLE = 1;

const SHARE_TITLE = '帮我解锁一个车位！《对号发车》';
const SHARE_IMAGE = 'assets/share-illu.jpg';

// 游戏圈首页（游戏内打开）。来自 MP → 游戏圈 → 基础设置 → 游戏内打开。
const GAME_CLUB_OPENLINK = '-SSEykJvFV3pORt5kTNpSxOGrDgxFr91wHUyG6LqPylSSR_tWYDokPbcRKtTvLg7Udvxa4hF_utX0uQ1Kg2xk7z1MfgG71ApiroUd20uEjCqIsB-Q_FLvtLCvIufAi9zQW31mrP_060cqbkEAaGiSCNeJNEaTppMc2WrXS_Z2E8802iQu5a-xYFF-xBild2-TFydkJ7HT32EQC3UU8fFT1JB6ZRkFvmFwbljQrTwiIsKIX0Q1WfJTOO49p5saz0__GRwcKGmFv6WzW2UAyS-jRMseTPJVz42PsgepDo42Jyw1mUWVnCOchpYD65eoqPyQcdrXnNLbbcAq5sXRMhoxA';

// 倒计时占位广告秒数（无广告位 ID 时使用）
const PLACEHOLDER_AD_SEC = 3;

module.exports = {
  AD_UNIT_ID, CAPTURE_MODE, SAVE_KEY, VERSION,
  STAGE_W, STAGE_H,
  CELL, LOT_X, LOT_Y, COLS, ROWS,
  SPOT_H, SPOT_Y, SPOT_CY, MAX_EXTRA,
  ROAD_Y, LANE_L, LANE_R, LANE_B,
  HEAD_X, FEET_Y, PAX_SP, VISIBLE,
  VEH_W, DIR_ROT, CNAME, CCOL, PAX_FLIP_IDLE,
  SHARE_TITLE, SHARE_IMAGE, GAME_CLUB_OPENLINK, PLACEHOLDER_AD_SEC,
};

});

define("./js/env", function(require, module, exports) {
/* 对号发车 — 运行环境抽象（微信小游戏 / 本地预览） */
'use strict';

const hasWx = typeof wx !== 'undefined' && typeof wx.createImage === 'function';
function hasDomPointer() {
  try { return typeof document !== 'undefined' && !!document.addEventListener && typeof window !== 'undefined'; }
  catch (e) { return false; }
}


function getCanvas() {
  if (typeof canvas !== 'undefined' && canvas && canvas.getContext) return canvas;
  if (hasWx && wx.createCanvas) return wx.createCanvas();
  throw new Error('找不到 Canvas');
}

function getWindowInfo() {
  if (hasWx) {
    try {
      if (typeof wx.getWindowInfo === 'function') return wx.getWindowInfo();
    } catch (e) {}
    try {
      const s = wx.getSystemInfoSync();
      return {
        windowWidth: s.windowWidth,
        windowHeight: s.windowHeight,
        pixelRatio: s.pixelRatio || 2,
        safeArea: s.safeArea,
        statusBarHeight: s.statusBarHeight || 0,
      };
    } catch (e) {}
  }
  const c = getCanvas();
  const cssW = Number(c.dataset && c.dataset.cssWidth) || (c.clientWidth || 390);
  const cssH = Number(c.dataset && c.dataset.cssHeight) || (c.clientHeight || 844);
  return { windowWidth: cssW, windowHeight: cssH, pixelRatio: (typeof window !== 'undefined' && window.devicePixelRatio) || 2, safeArea: null, statusBarHeight: 0 };
}

function createImage() {
  if (hasWx) return wx.createImage();
  return new Image();
}

function now() {
  if (typeof performance !== 'undefined' && performance.now) return performance.now() / 1000;
  return Date.now() / 1000;
}

function raf(fn) {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn);
  const c = getCanvas();
  if (c && typeof c.requestAnimationFrame === 'function') return c.requestAnimationFrame(fn);
  return setTimeout(() => fn(Date.now()), 16);
}

function loadStorage(key, fallback) {
  try {
    if (hasWx && typeof wx.getStorageSync === 'function') {
      const p = wx.getStorageSync(key);
      if (p && typeof p === 'object') return Object.assign(fallback, p);
      if (typeof p === 'string' && p) return Object.assign(fallback, JSON.parse(p));
      return fallback;
    }
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (raw) return Object.assign(fallback, JSON.parse(raw));
    }
  } catch (e) {}
  return fallback;
}

function saveStorage(key, value) {
  try {
    if (hasWx && typeof wx.setStorageSync === 'function') {
      wx.setStorageSync(key, value);
      return;
    }
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

function onTouch(handlers) {
  const bind = (name, wxName, evName) => {
    const fn = handlers[name];
    if (!fn) return;
    if (hasWx && typeof wx[wxName] === 'function' && !hasDomPointer()) {
      wx[wxName](fn);
    } else if (typeof window !== 'undefined') {
      const c = getCanvas();
      const map = (e) => {
        const r = c.getBoundingClientRect ? c.getBoundingClientRect() : { left: 0, top: 0, width: c.clientWidth || c.width, height: c.clientHeight || c.height };
        const toTouch = (t) => {
          const sx = r.width / ((c.dataset && Number(c.dataset.cssWidth)) || r.width);
          // client coordinates are already in CSS pixels of the page; canvas may be scaled by CSS
          const x = (t.clientX - r.left) * ((c.dataset && Number(c.dataset.cssWidth) || r.width) / r.width);
          const y = (t.clientY - r.top) * ((c.dataset && Number(c.dataset.cssHeight) || r.height) / r.height);
          return { clientX: t.clientX, clientY: t.clientY, x, y, identifier: t.identifier || 0 };
        };
        const src = name === 'start' ? (e.changedTouches || e.touches || [e]) : (e.changedTouches || [e]);
        const list = e.changedTouches ? Array.prototype.map.call(e.changedTouches, toTouch)
          : e.touches && e.touches.length ? Array.prototype.map.call(e.touches, toTouch)
          : [toTouch(e)];
        fn({ touches: list, changedTouches: list, preventDefault() { e.preventDefault && e.preventDefault(); } });
      };
      const target = c;
      if (window.PointerEvent) {
        if (name === 'start') target.addEventListener('pointerdown', map);
        if (name === 'move') target.addEventListener('pointermove', map);
        if (name === 'end') target.addEventListener('pointerup', map);
        if (name === 'cancel') target.addEventListener('pointercancel', map);
      } else {
        target.addEventListener(evName, map, { passive: false });
      }
    }
  };
  bind('start', 'onTouchStart', 'touchstart');
  bind('move', 'onTouchMove', 'touchmove');
  bind('end', 'onTouchEnd', 'touchend');
  bind('cancel', 'onTouchCancel', 'touchcancel');
}

function showShareMenu() {
  if (hasWx && typeof wx.showShareMenu === 'function') {
    try { wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] }); } catch (e) {
      try { wx.showShareMenu({ withShareTicket: true }); } catch (e2) {}
    }
  }
}

function onShareAppMessage(builder) {
  if (hasWx && typeof wx.onShareAppMessage === 'function') {
    wx.onShareAppMessage(builder);
  }
}

function shareAppMessage(opt) {
  // 仅在真·微信小游戏里走 wx.shareAppMessage；本地预览返回 false，由游戏走 2 秒占位
  if (hasWx && typeof wx.shareAppMessage === 'function' && !hasDomPointer()) {
    wx.shareAppMessage(opt);
    return true;
  }
  return false;
}

function onShow(fn) { if (hasWx && typeof wx.onShow === 'function') wx.onShow(fn); }
function onHide(fn) { if (hasWx && typeof wx.onHide === 'function') wx.onHide(fn); }
function onResize(fn) { if (hasWx && typeof wx.onWindowResize === 'function') wx.onWindowResize(fn); }

function keepScreenOn() {
  if (hasWx && typeof wx.setKeepScreenOn === 'function') {
    try { wx.setKeepScreenOn({ keepScreenOn: true }); } catch (e) {}
  }
}

function setFPS(n) {
  if (hasWx && typeof wx.setPreferredFramesPerSecond === 'function') {
    try { wx.setPreferredFramesPerSecond(n); } catch (e) {}
  }
}

let clubMgr = null;
let clubLink = '';
let clubReady = false;
let clubBusy = false;

function openGameClub(openlink) {
  return new Promise((resolve, reject) => {
    const inGame = hasWx && !hasDomPointer() && typeof wx.createPageManager === 'function';
    if (!inGame) {
      reject({ errCode: -3, errMsg: 'preview' });
      return;
    }
    if (!openlink) {
      reject({ errCode: -1, errMsg: 'openlink empty' });
      return;
    }
    if (clubBusy) {
      reject({ errCode: -7, errMsg: 'busy' });
      return;
    }
    try {
      if (!clubMgr) clubMgr = wx.createPageManager();
    } catch (e) {
      reject(e);
      return;
    }
    if (clubReady && clubLink === openlink) {
      try {
        clubMgr.show();
        resolve();
      } catch (e) {
        reject(e);
      }
      return;
    }
    clubBusy = true;
    clubMgr.load({ openlink }).then((res) => {
      clubBusy = false;
      clubReady = true;
      clubLink = openlink;
      try { clubMgr.show(); } catch (e) { reject(e); return; }
      resolve(res);
    }).catch((err) => {
      clubBusy = false;
      clubReady = false;
      reject(err || { errCode: -5, errMsg: 'load failed' });
    });
  });
}

function createRewardedVideoAd(adUnitId) {
  if (!adUnitId) return null;
  if (hasWx && typeof wx.createRewardedVideoAd === 'function') {
    try { return wx.createRewardedVideoAd({ adUnitId }); } catch (e) { return null; }
  }
  return null;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = createImage();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败: ' + src));
    img.src = src;
  });
}

module.exports = {
  hasWx, hasDomPointer, getCanvas, getWindowInfo, createImage, now, raf,
  loadStorage, saveStorage, onTouch,
  showShareMenu, onShareAppMessage, shareAppMessage,
  onShow, onHide, onResize, keepScreenOn, setFPS,
  createRewardedVideoAd, openGameClub, loadImage,
};

});

define("./js/analytics", function(require, module, exports) {
/* 对号发车 — 统计上报（只走微信自定义分析，不上自建服务器，以符合单机承诺） */
'use strict';

const env = require('./env');

function nativeWx() {
  try {
    return !!(env.hasWx && typeof wx !== 'undefined' && typeof wx.reportEvent === 'function' && !env.hasDomPointer());
  } catch (e) {
    return false;
  }
}

function report(eventId, data) {
  if (!nativeWx()) return;
  const payload = {};
  if (data) {
    Object.keys(data).forEach((k) => {
      const v = data[k];
      if (v == null || v === '') return;
      payload[k] = typeof v === 'number' ? v : String(v);
    });
  }
  try { wx.reportEvent(eventId, payload); } catch (e) {}
}

module.exports = {
  gameOpen() { report('game_open'); },
  levelStart(level, action) { report('level_start', { level: level, action: action || 'enter' }); },
  levelWin(level, stars, undos, revived) {
    report('level_win', { level: level, stars: stars, undos: undos, revived: revived ? 1 : 0 });
  },
  levelFail(level, reason) { report('level_fail', { level: level, reason: reason || '' }); },
  shareUnlock(level, extra) { report('share_unlock', { level: level, extra: extra }); },
  adRevive(level) { report('ad_revive', { level: level }); },
  undo(level, via) { report('undo', { level: level, via: via || 'free' }); },
};

});

define("./js/logic", function(require, module, exports) {
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

});

define("./js/levels", function(require, module, exports) {
/* 对号发车 关卡 1–40（固定布局与颜色，无随机；默认 3 个车位均可解，见 v2/tools/solver-report.txt）
 * 1–20 与 1.0.0 上传版本逐字相同；21–40 为新增。
 */
const LEVELS = [
      {"name":"点亮着的车","tutorial":true,"vehicles":[{"c":"A","x":1,"y":3,"dir":"U"},{"c":"B","x":4,"y":3,"dir":"U"},{"c":"B","x":0,"y":5,"dir":"R"},{"c":"B","x":3,"y":6,"dir":"U"}],"queue":"AAAABBBBBBBBBBBB"},
      {"name":"先挖出来","vehicles":[{"c":"B","x":2,"y":7,"dir":"L"},{"c":"A","x":3,"y":1,"dir":"L"},{"c":"C","x":2,"y":0,"dir":"U"},{"c":"A","x":2,"y":5,"dir":"U"},{"c":"C","x":3,"y":4,"dir":"U"},{"c":"B","x":1,"y":3,"dir":"U"}],"queue":"AAAABBBBAAAACCCCBBBBCCCC"},
      {"name":"只有 3 个车位","vehicles":[{"c":"B","x":2,"y":1,"dir":"U"},{"c":"B","x":3,"y":7,"dir":"R"},{"c":"C","x":3,"y":0,"dir":"D"},{"c":"D","x":2,"y":4,"dir":"D"},{"c":"A","x":1,"y":6,"dir":"L"},{"c":"A","x":0,"y":6,"dir":"U"},{"c":"C","x":0,"y":3,"dir":"U"},{"c":"D","x":4,"y":2,"dir":"U"}],"queue":"CCDDDDBBBBCCDDDDBBBAAAACCCCAAAAB"},
      {"name":"层层堵车","vehicles":[{"c":"A","x":4,"y":7,"dir":"R"},{"c":"D","x":5,"y":2,"dir":"U"},{"c":"C","x":1,"y":4,"dir":"U"},{"c":"C","x":2,"y":5,"dir":"R"},{"c":"A","x":3,"y":1,"dir":"L"},{"c":"A","x":2,"y":0,"dir":"L"},{"c":"D","x":0,"y":0,"dir":"D"},{"c":"B","x":5,"y":4,"dir":"D"},{"c":"B","x":4,"y":4,"dir":"U"}],"queue":"DDDDCCCCAAADDDDBBBAABCCCCAAAABBBBAAA"},
      {"name":"长巴士来了","isNew":"长巴士（6 座）","intro":{"img":"intro-long","title":"长巴士：6 个座位","text":"长巴士占 3 格，要坐满 6 个人才发车。"},"vehicles":[{"c":"A","x":3,"y":1,"dir":"R","len":3},{"c":"B","x":2,"y":3,"dir":"R","len":3},{"c":"A","x":5,"y":3,"dir":"D"},{"c":"B","x":0,"y":3,"dir":"U"},{"c":"C","x":1,"y":4,"dir":"U"},{"c":"C","x":4,"y":6,"dir":"L"},{"c":"D","x":2,"y":6,"dir":"L"}],"queue":"DDCCDDBBCCAAAABBBBAAAACCCCBBBBAA"},
      {"name":"长短混搭","vehicles":[{"c":"C","x":2,"y":5,"dir":"U"},{"c":"A","x":2,"y":4,"dir":"R"},{"c":"D","x":4,"y":3,"dir":"D"},{"c":"B","x":1,"y":0,"dir":"L","len":3},{"c":"B","x":5,"y":5,"dir":"D"},{"c":"A","x":0,"y":3,"dir":"R","len":3},{"c":"A","x":1,"y":1,"dir":"U"},{"c":"C","x":3,"y":2,"dir":"R"}],"queue":"BBBBAAACCCCADDDDAACCCCAAABBAAABBBBAA"},
      {"name":"先放谁？","vehicles":[{"c":"B","x":5,"y":0,"dir":"U"},{"c":"C","x":1,"y":0,"dir":"U","len":3},{"c":"C","x":1,"y":3,"dir":"R"},{"c":"A","x":0,"y":5,"dir":"U","len":3},{"c":"D","x":2,"y":5,"dir":"L"},{"c":"B","x":3,"y":0,"dir":"U","len":3},{"c":"A","x":2,"y":6,"dir":"U"},{"c":"D","x":0,"y":4,"dir":"R"}],"queue":"BBBBCCCCAADDDCCAAAABBBBDDDCCCCBBAAAADD"},
      {"name":"高峰时段","peak":true,"vehicles":[{"c":"C","x":1,"y":3,"dir":"R"},{"c":"D","x":3,"y":2,"dir":"R","len":3},{"c":"A","x":0,"y":3,"dir":"U","len":3},{"c":"A","x":1,"y":6,"dir":"R"},{"c":"A","x":0,"y":0,"dir":"L"},{"c":"B","x":3,"y":3,"dir":"U","len":3},{"c":"C","x":0,"y":1,"dir":"R","len":3},{"c":"B","x":4,"y":6,"dir":"R"},{"c":"D","x":2,"y":4,"dir":"U"}],"queue":"DDADDDDBBBBAAAACCAACCAAACCBBBCCDDDCCDAAAABBB"},
      {"name":"团体票","isNew":"团体票（N 人团）","intro":{"img":"intro-group","title":"团体票：一起上同一辆车","text":"「N 人团」必须整团坐进同一辆车，座位不够就整团等着。"},"vehicles":[{"c":"A","x":3,"y":5,"dir":"U","len":3},{"c":"A","x":3,"y":1,"dir":"U","len":3},{"c":"C","x":0,"y":5,"dir":"U"},{"c":"B","x":0,"y":1,"dir":"L"},{"c":"B","x":5,"y":1,"dir":"U"},{"c":"C","x":0,"y":7,"dir":"R"}],"queue":"CC(CC)(BB)(BB)CCAAA(AA)(CC)A(AAA)(BB)(BB)AAA"},
      {"name":"三人团","vehicles":[{"c":"C","x":3,"y":1,"dir":"U"},{"c":"B","x":5,"y":4,"dir":"U"},{"c":"B","x":4,"y":1,"dir":"U","len":3},{"c":"A","x":1,"y":3,"dir":"L","len":3},{"c":"C","x":0,"y":5,"dir":"D"},{"c":"A","x":4,"y":5,"dir":"U","len":3},{"c":"D","x":0,"y":3,"dir":"D"}],"queue":"(AA)(AAA)BB(CC)(BB)(BB)CCA(AA)(DD)(DD)CA(AAA)(BB)BB(CC)C"},
      {"name":"算好座位","vehicles":[{"c":"D","x":4,"y":0,"dir":"U"},{"c":"A","x":2,"y":0,"dir":"U","len":3},{"c":"A","x":0,"y":4,"dir":"U","len":3},{"c":"D","x":3,"y":4,"dir":"U"},{"c":"B","x":4,"y":5,"dir":"U","len":3},{"c":"C","x":0,"y":0,"dir":"R"},{"c":"B","x":5,"y":5,"dir":"U"},{"c":"C","x":0,"y":1,"dir":"U","len":3}],"queue":"(BB)B(DD)(DD)CCCAABBBA(AAA)BB(BB)C(CC)(DD)(DD)C(CC)C(AAA)(AAA)"},
      {"name":"换个思路","vehicles":[{"c":"A","x":0,"y":0,"dir":"U","len":3},{"c":"B","x":3,"y":7,"dir":"R"},{"c":"B","x":5,"y":4,"dir":"U","len":3},{"c":"D","x":2,"y":3,"dir":"U"},{"c":"A","x":1,"y":2,"dir":"U","len":3},{"c":"C","x":2,"y":6,"dir":"U"},{"c":"D","x":4,"y":0,"dir":"D"},{"c":"C","x":2,"y":1,"dir":"R"}],"queue":"(BB)(BB)A(AAA)CC(DD)ACCDDAAB(BB)AAA(AA)CC(CC)(DD)(DD)(BB)B"},
      {"name":"团团转","vehicles":[{"c":"C","x":3,"y":3,"dir":"L"},{"c":"A","x":2,"y":0,"dir":"D","len":3},{"c":"B","x":4,"y":5,"dir":"U","len":3},{"c":"A","x":5,"y":2,"dir":"U","len":3},{"c":"D","x":3,"y":0,"dir":"U","len":3},{"c":"B","x":0,"y":1,"dir":"D"},{"c":"B","x":2,"y":5,"dir":"R"},{"c":"D","x":1,"y":5,"dir":"U"},{"c":"C","x":1,"y":0,"dir":"U","len":3}],"queue":"DD(DD)(CC)(CC)BBBDDAAABBB(BB)(AA)A(DD)(DD)BBAAACC(CC)(AA)ACCBBBB"},
      {"name":"晚高峰","peak":true,"vehicles":[{"c":"D","x":0,"y":2,"dir":"U"},{"c":"A","x":1,"y":0,"dir":"D","len":3},{"c":"A","x":5,"y":5,"dir":"U","len":3},{"c":"B","x":3,"y":5,"dir":"U","len":3},{"c":"B","x":0,"y":4,"dir":"L"},{"c":"D","x":3,"y":0,"dir":"L","len":3},{"c":"C","x":2,"y":0,"dir":"D","len":3},{"c":"C","x":4,"y":2,"dir":"D"},{"c":"B","x":5,"y":1,"dir":"U"},{"c":"C","x":1,"y":5,"dir":"L"}],"queue":"D(DD)BB(CC)(CC)BBCCCD(DD)(AAA)DD(DD)BBAAABB(CC)C(BB)BAB(BB)(CC)CAA(AAA)C"},
      {"name":"问号车","isNew":"问号车","intro":{"img":"intro-mystery","title":"问号车：开出前看不到颜色","text":"盖着布的车，前面的路一空就会揭开颜色。"},"vehicles":[{"c":"C","x":1,"y":4,"dir":"U"},{"c":"C","x":5,"y":4,"dir":"U","m":1},{"c":"A","x":2,"y":6,"dir":"L","len":3},{"c":"B","x":2,"y":0,"dir":"U"},{"c":"B","x":3,"y":2,"dir":"U","len":3},{"c":"A","x":4,"y":3,"dir":"D","m":1},{"c":"D","x":4,"y":1,"dir":"L"}],"queue":"CCCCBBCCCCBBAADAABBDDDAAAABBBBAA"},
      {"name":"揭开看看","vehicles":[{"c":"A","x":0,"y":2,"dir":"U"},{"c":"C","x":0,"y":1,"dir":"L"},{"c":"D","x":2,"y":5,"dir":"U","m":1},{"c":"A","x":3,"y":6,"dir":"L","len":3,"m":1},{"c":"B","x":4,"y":3,"dir":"D","m":1},{"c":"D","x":5,"y":2,"dir":"U"},{"c":"C","x":1,"y":6,"dir":"D"},{"c":"B","x":0,"y":0,"dir":"R","len":3}],"queue":"AAACCBBCCBBBBDDCADDDCCCAAABBBBDDDAAA"},
      {"name":"暗中有团","vehicles":[{"c":"C","x":4,"y":0,"dir":"L","m":1},{"c":"B","x":0,"y":0,"dir":"D","len":3,"m":1},{"c":"D","x":2,"y":6,"dir":"D"},{"c":"A","x":5,"y":5,"dir":"U","len":3},{"c":"B","x":3,"y":7,"dir":"R","m":1},{"c":"C","x":2,"y":4,"dir":"L","len":3},{"c":"D","x":0,"y":7,"dir":"L"},{"c":"A","x":1,"y":4,"dir":"U","len":3}],"queue":"CCC(AAA)DDD(AA)ACCCCB(BB)D(DD)(DD)(AAA)A(CC)C(BB)(AA)BBB(BB)"},
      {"name":"终极拥堵","peak":true,"vehicles":[{"c":"A","x":4,"y":4,"dir":"U","len":3,"m":1},{"c":"D","x":2,"y":0,"dir":"U","len":3},{"c":"A","x":0,"y":3,"dir":"R","len":3,"m":1},{"c":"B","x":3,"y":3,"dir":"R","len":3},{"c":"C","x":0,"y":4,"dir":"R","len":3,"m":1},{"c":"B","x":5,"y":0,"dir":"U"},{"c":"C","x":0,"y":6,"dir":"U"},{"c":"B","x":5,"y":5,"dir":"U","m":1},{"c":"C","x":0,"y":0,"dir":"U"},{"c":"D","x":3,"y":0,"dir":"U"}],"queue":"(AAA)BBAAA(DD)DB(BB)CC(CC)DDC(CC)B(BB)D(DD)CC(DD)A(AA)(BB)(CC)(CC)(BB)CBB(AA)A"},
      {"name":"看准再开","vehicles":[{"c":"A","x":0,"y":3,"dir":"R","len":3,"m":1},{"c":"B","x":1,"y":1,"dir":"U"},{"c":"A","x":2,"y":4,"dir":"R","len":3},{"c":"C","x":5,"y":3,"dir":"D"},{"c":"B","x":5,"y":0,"dir":"D","len":3,"m":1},{"c":"C","x":3,"y":2,"dir":"L"},{"c":"D","x":5,"y":6,"dir":"D"},{"c":"D","x":1,"y":6,"dir":"R"}],"queue":"AAAADDAA(BB)BB(DD)CC(CC)DDDDAABBA(AA)B(BB)BAC(CC)C"},
      {"name":"车站之王","peak":true,"vehicles":[{"c":"D","x":2,"y":1,"dir":"U"},{"c":"B","x":2,"y":6,"dir":"U"},{"c":"A","x":1,"y":1,"dir":"U","len":3,"m":1},{"c":"D","x":1,"y":6,"dir":"U","m":1},{"c":"A","x":3,"y":1,"dir":"L","len":3},{"c":"B","x":0,"y":4,"dir":"U","len":3},{"c":"C","x":2,"y":5,"dir":"L","m":1},{"c":"B","x":4,"y":3,"dir":"R"},{"c":"D","x":5,"y":4,"dir":"U","len":3,"m":1},{"c":"C","x":1,"y":0,"dir":"R","len":3}],"queue":"B(BB)CC(CC)B(BB)AACC(DD)(DD)(BB)A(AAA)BB(AA)ABBCC(BB)D(DD)A(DD)D(CC)(DD)(DD)AA"},
  {"name":"夜班加开","peak":true,"vehicles":[{"c":"B","x":0,"y":0,"dir":"U"},{"c":"A","x":0,"y":2,"dir":"U"},{"c":"C","x":1,"y":0,"dir":"U"},{"c":"A","x":1,"y":2,"dir":"U","len":3},{"c":"D","x":3,"y":0,"dir":"U","m":1},{"c":"B","x":3,"y":2,"dir":"U"},{"c":"C","x":4,"y":0,"dir":"U"},{"c":"D","x":4,"y":2,"dir":"U"},{"c":"A","x":5,"y":0,"dir":"U"},{"c":"B","x":5,"y":2,"dir":"U","len":3}],"queue":"(AA)(AA)(AAA)(AAA)(AA)(AA)(BB)(BB)(BB)(BB)(BBB)(BBB)(CC)(CC)(CC)(CC)(DD)(DD)(DD)(DD)"},
  {"name":"借道停车","vehicles":[{"c":"C","x":0,"y":0,"dir":"U"},{"c":"D","x":0,"y":2,"dir":"U"},{"c":"A","x":0,"y":4,"dir":"U"},{"c":"B","x":2,"y":0,"dir":"U"},{"c":"A","x":2,"y":2,"dir":"U","len":3},{"c":"D","x":4,"y":0,"dir":"U","m":1},{"c":"C","x":4,"y":2,"dir":"U","len":3},{"c":"B","x":5,"y":0,"dir":"U"},{"c":"D","x":5,"y":2,"dir":"U"}],"queue":"AAAACCCCDDDDAAAAAABBBBCCCCCCDDDDBBBBDDDD"},
  {"name":"双闸发车","vehicles":[{"c":"B","x":0,"y":0,"dir":"L","len":3},{"c":"C","x":3,"y":0,"dir":"R","len":3},{"c":"A","x":0,"y":1,"dir":"U"},{"c":"D","x":0,"y":3,"dir":"U"},{"c":"A","x":2,"y":1,"dir":"U","len":3},{"c":"B","x":2,"y":4,"dir":"U"},{"c":"D","x":4,"y":1,"dir":"U"},{"c":"C","x":4,"y":3,"dir":"U"},{"c":"B","x":5,"y":1,"dir":"U"},{"c":"A","x":5,"y":3,"dir":"U"}],"queue":"AAAAAAAAAADDDDBBBBBBBBBBDDDDCCCCCCCCCCBBBBAAAA"},
  {"name":"问号路障","vehicles":[{"c":"B","x":0,"y":0,"dir":"L","len":3,"m":1},{"c":"C","x":0,"y":1,"dir":"U"},{"c":"A","x":0,"y":3,"dir":"U"},{"c":"D","x":1,"y":1,"dir":"U","m":1},{"c":"A","x":1,"y":3,"dir":"U","len":3},{"c":"C","x":3,"y":0,"dir":"U"},{"c":"B","x":3,"y":2,"dir":"U","len":3},{"c":"D","x":5,"y":0,"dir":"U"},{"c":"C","x":5,"y":2,"dir":"U"}],"queue":"AAAACCCCAAAAAADDDDBBBBBBBBBBBBCCCCCCCCDDDD"},
  {"name":"专座三人","peak":true,"vehicles":[{"c":"B","x":0,"y":0,"dir":"U"},{"c":"A","x":0,"y":2,"dir":"U","len":3},{"c":"C","x":1,"y":0,"dir":"U","m":1},{"c":"A","x":1,"y":2,"dir":"U","len":3},{"c":"D","x":3,"y":0,"dir":"U"},{"c":"B","x":3,"y":2,"dir":"U","len":3},{"c":"A","x":4,"y":0,"dir":"U"},{"c":"C","x":4,"y":2,"dir":"U","len":3},{"c":"D","x":5,"y":0,"dir":"U"},{"c":"B","x":5,"y":2,"dir":"U"}],"queue":"(AAA)(AAA)(BB)(BB)(AAA)(AAA)(CC)(CC)(BBB)(BBB)(DD)(DD)(AA)(AA)(BB)(BB)(CCC)(CCC)(DD)(DD)"},
  {"name":"先停错色","vehicles":[{"c":"B","x":0,"y":0,"dir":"U"},{"c":"C","x":0,"y":2,"dir":"U"},{"c":"A","x":0,"y":4,"dir":"U"},{"c":"D","x":2,"y":0,"dir":"U"},{"c":"A","x":2,"y":2,"dir":"U"},{"c":"B","x":2,"y":4,"dir":"U"},{"c":"C","x":4,"y":0,"dir":"U","m":1},{"c":"D","x":4,"y":2,"dir":"U","len":3}],"queue":"AAAABBBBCCCCAAAADDDDBBBBCCCCDDDDDD"},
  {"name":"高峰夹心","peak":true,"vehicles":[{"c":"B","x":0,"y":0,"dir":"U"},{"c":"A","x":0,"y":2,"dir":"U"},{"c":"C","x":2,"y":0,"dir":"U"},{"c":"D","x":2,"y":2,"dir":"U","len":3},{"c":"D","x":4,"y":0,"dir":"U","m":1},{"c":"C","x":4,"y":2,"dir":"U"},{"c":"B","x":5,"y":0,"dir":"U"},{"c":"A","x":5,"y":2,"dir":"U","len":3}],"queue":"(AAA)BBBBCCCC(DDD)(DDD)DDDDCCCCBBBBA(AAA)(AAA)"},
  {"name":"巷子很深","vehicles":[{"c":"B","x":0,"y":0,"dir":"U","m":1},{"c":"C","x":0,"y":2,"dir":"U","m":1},{"c":"A","x":0,"y":4,"dir":"U","len":3},{"c":"D","x":2,"y":0,"dir":"U"},{"c":"B","x":2,"y":2,"dir":"U","len":3},{"c":"C","x":4,"y":0,"dir":"U"},{"c":"D","x":4,"y":2,"dir":"U"},{"c":"A","x":4,"y":4,"dir":"U"}],"queue":"AAAAAABBBBCCCCDDDD(BBB)(BBB)CCCCDDDDAAAA"},
  {"name":"横竖都堵","vehicles":[{"c":"C","x":0,"y":0,"dir":"L","len":3},{"c":"B","x":3,"y":6,"dir":"R","m":1},{"c":"A","x":0,"y":1,"dir":"U"},{"c":"D","x":0,"y":3,"dir":"U"},{"c":"A","x":1,"y":1,"dir":"U","len":3},{"c":"D","x":4,"y":0,"dir":"U"},{"c":"A","x":4,"y":2,"dir":"U"},{"c":"C","x":5,"y":0,"dir":"U"},{"c":"B","x":5,"y":2,"dir":"U"}],"queue":"AAAAAAAAAAAAAADDDDDDDDCCCCCCCCCCBBBBBBBB"},
  {"name":"分毫不差","peak":true,"vehicles":[{"c":"C","x":0,"y":0,"dir":"U"},{"c":"A","x":0,"y":2,"dir":"U","len":3},{"c":"B","x":2,"y":0,"dir":"U"},{"c":"A","x":2,"y":2,"dir":"U"},{"c":"D","x":3,"y":0,"dir":"U","m":1},{"c":"B","x":3,"y":2,"dir":"U","len":3},{"c":"C","x":5,"y":0,"dir":"U"},{"c":"D","x":5,"y":2,"dir":"U"}],"queue":"(AAA)(AA)AAAAABBBB(BBB)(BBB)CCCCCCCCDDDDDDDD"},
  {"name":"倒车出站","vehicles":[{"c":"B","x":0,"y":6,"dir":"D"},{"c":"A","x":0,"y":3,"dir":"D","len":3},{"c":"C","x":2,"y":6,"dir":"D","m":1},{"c":"D","x":2,"y":4,"dir":"D"},{"c":"B","x":2,"y":2,"dir":"D"},{"c":"A","x":4,"y":6,"dir":"D"},{"c":"C","x":4,"y":3,"dir":"D","len":3},{"c":"D","x":5,"y":6,"dir":"D"},{"c":"A","x":5,"y":4,"dir":"D"}],"queue":"AAAAAABBBBCCCCDDDDBBBBAAAACCCCCCDDDDAAAA"},
  {"name":"路口横车","vehicles":[{"c":"D","x":0,"y":0,"dir":"L","len":3},{"c":"B","x":0,"y":1,"dir":"U"},{"c":"A","x":0,"y":3,"dir":"U","len":3},{"c":"C","x":1,"y":1,"dir":"U","m":1},{"c":"B","x":1,"y":3,"dir":"U","len":3},{"c":"A","x":2,"y":1,"dir":"U"},{"c":"C","x":2,"y":3,"dir":"U","len":3},{"c":"B","x":4,"y":0,"dir":"U"},{"c":"D","x":4,"y":2,"dir":"U"},{"c":"C","x":5,"y":0,"dir":"U"},{"c":"A","x":5,"y":2,"dir":"U"}],"queue":"AAAAAABBBBAAAA(BBB)(BBB)CCCC(CCC)(CCC)BBBBCCCCAAAADDDDDDDDDD"},
  {"name":"晚班团体","peak":true,"vehicles":[{"c":"C","x":0,"y":0,"dir":"U","m":1},{"c":"A","x":0,"y":2,"dir":"U","len":3},{"c":"B","x":1,"y":0,"dir":"U"},{"c":"D","x":1,"y":2,"dir":"U"},{"c":"A","x":3,"y":0,"dir":"U"},{"c":"B","x":3,"y":2,"dir":"U","len":3},{"c":"D","x":4,"y":0,"dir":"U"},{"c":"C","x":4,"y":2,"dir":"U"},{"c":"B","x":5,"y":0,"dir":"U"},{"c":"A","x":5,"y":2,"dir":"U"}],"queue":"(AAA)(AAA)(AA)(AA)(AA)(AA)(BB)(BB)(BBB)(BBB)(BB)(BB)(CC)(CC)(CC)(CC)(DD)(DD)(DD)(DD)"},
  {"name":"布盖三辆","vehicles":[{"c":"B","x":0,"y":0,"dir":"U","m":1},{"c":"A","x":0,"y":2,"dir":"U","len":3},{"c":"C","x":2,"y":0,"dir":"U","m":1},{"c":"B","x":2,"y":2,"dir":"U"},{"c":"D","x":3,"y":0,"dir":"U","m":1},{"c":"C","x":3,"y":2,"dir":"U","len":3},{"c":"A","x":5,"y":0,"dir":"U"},{"c":"D","x":5,"y":2,"dir":"U"}],"queue":"(AAA)(AAA)AAAA(BB)(BB)(BB)(BB)(CC)(CC)(CCC)(CCC)(DD)(DD)(DD)(DD)"},
  {"name":"四色轮转","vehicles":[{"c":"B","x":0,"y":0,"dir":"U"},{"c":"C","x":0,"y":2,"dir":"U"},{"c":"A","x":0,"y":4,"dir":"U","len":3},{"c":"D","x":2,"y":0,"dir":"U","m":1},{"c":"A","x":2,"y":2,"dir":"U"},{"c":"B","x":2,"y":4,"dir":"U"},{"c":"C","x":4,"y":0,"dir":"U"},{"c":"D","x":4,"y":2,"dir":"U","len":3},{"c":"A","x":5,"y":0,"dir":"U"},{"c":"B","x":5,"y":2,"dir":"U"}],"queue":"AAAAAABBBBCCCCAAAADDDDBBBBBBBBCCCCDDDDDDAAAA"},
  {"name":"座位卡死","peak":true,"vehicles":[{"c":"A","x":0,"y":0,"dir":"U","len":3},{"c":"B","x":0,"y":3,"dir":"U"},{"c":"D","x":0,"y":5,"dir":"U"},{"c":"A","x":2,"y":0,"dir":"U"},{"c":"C","x":2,"y":2,"dir":"U","len":3},{"c":"D","x":4,"y":0,"dir":"U","m":1},{"c":"B","x":4,"y":2,"dir":"U"},{"c":"C","x":5,"y":0,"dir":"U"},{"c":"B","x":5,"y":2,"dir":"U"}],"queue":"(AAA)(AAA)(AA)(AA)BBBBDDDDBBBBDDDDBBBBCCCCCCCCCC"},
  {"name":"左右分道","vehicles":[{"c":"B","x":0,"y":0,"dir":"L"},{"c":"C","x":4,"y":0,"dir":"R","m":1},{"c":"A","x":0,"y":2,"dir":"L","len":3},{"c":"D","x":3,"y":2,"dir":"R","len":3},{"c":"A","x":0,"y":3,"dir":"U"},{"c":"C","x":0,"y":5,"dir":"U"},{"c":"B","x":2,"y":3,"dir":"U","len":3},{"c":"D","x":2,"y":6,"dir":"U"},{"c":"A","x":5,"y":3,"dir":"U"},{"c":"D","x":5,"y":5,"dir":"U"}],"queue":"BBBBCCCCAAAAAADDDDDDAAAABBBBBBCCCCAAAADDDDDDDD"},
  {"name":"加班加点","peak":true,"vehicles":[{"c":"C","x":0,"y":0,"dir":"U","m":1},{"c":"D","x":0,"y":2,"dir":"U"},{"c":"A","x":0,"y":4,"dir":"U","len":3},{"c":"B","x":2,"y":0,"dir":"U"},{"c":"A","x":2,"y":2,"dir":"U"},{"c":"B","x":2,"y":4,"dir":"U","len":3},{"c":"D","x":4,"y":0,"dir":"U","m":1},{"c":"C","x":4,"y":2,"dir":"U","len":3},{"c":"A","x":5,"y":0,"dir":"U"},{"c":"D","x":5,"y":2,"dir":"U"}],"queue":"AAAAAACCCCDDDDAAAABBBB(BBB)(BBB)DDDD(CCC)(CCC)AAAADDDD"},
  {"name":"总调度室","vehicles":[{"c":"B","x":0,"y":0,"dir":"L","len":3,"m":1},{"c":"C","x":3,"y":0,"dir":"R","len":3},{"c":"D","x":0,"y":1,"dir":"U"},{"c":"A","x":0,"y":3,"dir":"U","len":3},{"c":"A","x":2,"y":1,"dir":"U"},{"c":"B","x":2,"y":3,"dir":"U"},{"c":"D","x":3,"y":1,"dir":"U","m":1},{"c":"C","x":3,"y":3,"dir":"U"},{"c":"B","x":5,"y":1,"dir":"U"},{"c":"A","x":5,"y":3,"dir":"U"},{"c":"D","x":5,"y":5,"dir":"U"}],"queue":"(AAA)(AAA)DDDDAAAABBBBBBBBBBBBBBCCCCCCCCCCDDDDAAAADDDD"},
  {"name":"全站通车","peak":true,"vehicles":[{"c":"D","x":1,"y":0,"dir":"R","len":3,"m":1},{"c":"B","x":0,"y":0,"dir":"U","m":1},{"c":"C","x":0,"y":2,"dir":"U"},{"c":"A","x":0,"y":4,"dir":"U","len":3},{"c":"A","x":1,"y":1,"dir":"U"},{"c":"B","x":1,"y":3,"dir":"U","len":3},{"c":"C","x":3,"y":1,"dir":"U","m":1},{"c":"D","x":3,"y":3,"dir":"U","len":3},{"c":"B","x":4,"y":1,"dir":"U"},{"c":"A","x":4,"y":3,"dir":"U"},{"c":"D","x":5,"y":1,"dir":"U"},{"c":"C","x":5,"y":3,"dir":"U"}],"queue":"AAAAAABBBBCCCCAAAA(BBB)(BBB)BBBBAAAACCCCCCCC(DDD)(DDD)(DDD)(DDD)DDDD"}
];
module.exports = LEVELS;

});

define("./js/tween", function(require, module, exports) {
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

});

define("./js/draw", function(require, module, exports) {
/* 对号发车 — Canvas 绘制辅助（只绘制已有 PNG/JPG，不生成像素画） */
'use strict';

function img(assets, key) { return assets[key] || null; }

function drawImage(ctx, im, x, y, w, h) {
  if (!im) return;
  ctx.drawImage(im, x, y, w, h);
}

function cover(ctx, im, x, y, w, h) {
  if (!im) { ctx.fillStyle = '#d9c3a5'; ctx.fillRect(x, y, w, h); return; }
  const iw = im.width, ih = im.height;
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s, dh = ih * s;
  ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawNineSlice(ctx, im, x, y, w, h, srcSlice, dstSlice) {
  if (!im) {
    ctx.fillStyle = '#f3e2c4';
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    return;
  }
  const iw = im.width, ih = im.height;
  const s = srcSlice, d = dstSlice;
  const sw = Math.max(1, iw - 2 * s), sh = Math.max(1, ih - 2 * s);
  const dw = Math.max(1, w - 2 * d), dh = Math.max(1, h - 2 * d);
  ctx.drawImage(im, 0, 0, s, s, x, y, d, d);
  ctx.drawImage(im, iw - s, 0, s, s, x + w - d, y, d, d);
  ctx.drawImage(im, 0, ih - s, s, s, x, y + h - d, d, d);
  ctx.drawImage(im, iw - s, ih - s, s, s, x + w - d, y + h - d, d, d);
  ctx.drawImage(im, s, 0, sw, s, x + d, y, dw, d);
  ctx.drawImage(im, s, ih - s, sw, s, x + d, y + h - d, dw, d);
  ctx.drawImage(im, 0, s, s, sh, x, y + d, d, dh);
  ctx.drawImage(im, iw - s, s, s, sh, x + w - d, y + d, d, dh);
  ctx.drawImage(im, s, s, sw, sh, x + d, y + d, dw, dh);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function applyShadows(ctx, shadows) {
  // shadows: [{x,y,blur,color}] — canvas only supports one shadow; we layer text instead
}

function fillText(ctx, text, x, y, opt) {
  opt = opt || {};
  const size = opt.size || 16;
  const weight = opt.weight || '900';
  const font = opt.font || '"Noto Sans CJK SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textBaseline = opt.baseline || 'middle';
  const shadows = opt.shadows || [];
  const ls = opt.letterSpacing || 0;
  const align = opt.align || 'center';
  ctx.textAlign = align;
  if (!ls) {
    for (const s of shadows) {
      ctx.fillStyle = s.color;
      ctx.fillText(text, x + (s.x || 0), y + (s.y || 0));
    }
    ctx.fillStyle = opt.color || '#fff';
    ctx.fillText(text, x, y);
    return;
  }
  // letter-spacing: draw per character
  const chars = Array.from(text);
  const widths = chars.map(ch => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
  let start = x;
  if (align === 'center') start = x - total / 2;
  else if (align === 'right') start = x - total;
  ctx.textAlign = 'left';
  let cx = start;
  for (let i = 0; i < chars.length; i++) {
    for (const s of shadows) {
      ctx.fillStyle = s.color;
      ctx.fillText(chars[i], cx + (s.x || 0), y + (s.y || 0));
    }
    ctx.fillStyle = opt.color || '#fff';
    ctx.fillText(chars[i], cx, y);
    cx += widths[i] + ls;
  }
  ctx.textAlign = opt.align || 'center';
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, opt) {
  opt = opt || {};
  const size = opt.size || 15;
  ctx.font = `${opt.weight || '700'} ${size}px ${opt.font || '"Noto Sans CJK SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'}`;
  ctx.textAlign = opt.align || 'center';
  ctx.textBaseline = opt.baseline || 'top';
  const lines = [];
  const paras = String(text).split('\n');
  for (const para of paras) {
    let line = '';
    for (const ch of Array.from(para)) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = ch; }
      else line = test;
    }
    lines.push(line);
  }
  const startY = opt.vcenter ? y - (lines.length * lineHeight) / 2 : y;
  ctx.fillStyle = opt.color || '#6b3f1d';
  lines.forEach((ln, i) => ctx.fillText(ln, x, startY + i * lineHeight));
  return lines.length;
}

function hit(x, y, r) {
  return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
}

function vehContains(e, x, y, t) {
  if (!e.visible) return false;
  const pose = e.pose ? e.pose(t) : { sx: e.sx, sy: e.sy, ox: e.ox, oy: e.oy };
  const dx = x - (e.x + (pose.ox || 0));
  const dy = y - (e.y + (pose.oy || 0));
  const rad = (e.rot || 0) * Math.PI / 180;
  const c = Math.cos(-rad), s = Math.sin(-rad);
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  const sx = Math.abs(pose.sx || 1), sy = Math.abs(pose.sy || 1);
  const hw = e.w * sx / 2 + 4, hh = e.h * sy / 2 + 4;
  return lx >= -hw && lx <= hw && ly >= -hh && ly <= hh;
}

module.exports = { img, drawImage, cover, drawNineSlice, roundRect, fillText, wrapText, hit, vehContains };

});

define("./js/app", function(require, module, exports) {
/* 对号发车 — Canvas 表现层（玩法逻辑复用 js/logic.js + js/levels.js） */
'use strict';

const L = require('./logic');
const LEVELS = require('./levels');
const C = require('./config');
const env = require('./env');
const { E, lerp, angTo, createClock, buildPath, pathAt } = require('./tween');
const D = require('./draw');
const analytics = require('./analytics');

const AKEY = {
  bus: (v) => (v.len === 3 ? 'lbus-' : 'bus-') + v.c.toLowerCase(),
};

const ASSET_LIST = (function () {
  const list = [
    'bus-a', 'bus-b', 'bus-c', 'bus-d', 'lbus-a', 'lbus-b', 'lbus-c', 'lbus-d',
    'mystery', 'burst', 'unlock', 'share', 'group-badge', 'arrow', 'hand',
    'badge', 'pill', 'panel', 'panel-card',
    'btn-primary', 'btn-secondary', 'btn-undo', 'btn-retry',
    'tile-lot', 'tile-spot', 'tile-spot-locked', 'tile-spot-temp',
    'tile-level', 'tile-locked', 'star-gold', 'star-grey',
    'bg-play', 'ui-start', 'ui-select', 'age-8plus',
    'intro-long', 'intro-group', 'intro-mystery', 'share-illu',
  ];
  'abcd'.split('').forEach(c => [0, 1, 2].forEach(i => list.push(`pax-${c}-${i}`)));
  for (let i = 0; i < 14; i++) list.push(`confetti-${i}`);
  return list;
})();

function assetSrc(name) {
  const jpg = /^(tile-lot|tile-spot|tile-spot-locked|tile-spot-temp|bg-play|ui-start|ui-select|intro-long|intro-group|intro-mystery|share-illu)$/;
  return 'assets/' + name + (jpg.test(name) ? '.jpg' : '.png');
}

class Ent {
  constructor(w, h, kind) {
    this.w = w; this.h = h; this.kind = kind;
    this.x = 0; this.y = 0; this.rot = 0;
    this.sx = 1; this.sy = 1; this.ox = 0; this.oy = 0;
    this.alpha = 1; this.lift = 1; this.flip = 1;
    this.idle = true; this.phase = Math.random() * 6.28;
    this.visible = true; this.ps = 1;
    this.z = 0; this.glow = false; this.redUntil = 0; this.parked = false;
    this.mys = false; this.imgKey = ''; this.c = ''; this.len = 2;
    this.revealed = true; this.id = 0; this.paxFrame = 0; this.arrowA = 1;
  }
  pose(t) {
    let sx = this.sx * this.lift * this.ps, sy = this.sy * this.lift * this.ps, oy = this.oy;
    if (this.kind === 'veh') {
      if (this.idle) {
        const b = Math.sin(t * 2.4 + this.phase);
        oy += b * 0.6; sx *= 1 + 0.012 * b; sy *= 1 - 0.006 * b;
      }
    } else if (this.idle) {
      const b = Math.sin(t * 3.1 + this.phase);
      sy *= 1 + 0.03 * b; sx *= 1 - 0.012 * b;
    }
    return { sx, sy, oy, ox: this.ox };
  }
}

function createGame(canvas, assets) {
  let ctx = canvas.getContext('2d');
  const clock = createClock();
  const now = () => env.now();

  let layout = { W: C.STAGE_W, H: C.STAGE_H, dpr: 2, scale: 1, ox: 0, oy: 0 };
  let screen = 'health'; // health | start | select | play | loading
  let G = null;
  let lastSpotSig = '';
  let toastTimer = 0;
  let toastMsg = '';
  let toastUntil = 0;
  let fade = 0;
  let fieldOx = 0, fieldOy = 0, rewinding = false;
  let buttons = [];
  let pressed = null;
  let pressStart = null;
  let videoAd = null;
  let sharePending = null;
  let hideAt = 0;
  let cardAnimT = 0;
  let starPopT = 0;

  const ui = {
    modal: null, // win | fail | intro | share | watch
    ageInfo: false,
    shareBusy: false,
    watchSec: 0, watchLabel: '', watchDone: null, watchStart: 0,
    intro: null,
    win: null,
    fail: null,
    chips: [],
    queueCount: '',
    spotInfo: { vfree: 3, n: 3, low: false },
    levelTitle: '',
    titleBob: 0,
  };

  let progress = env.loadStorage(C.SAVE_KEY, { unlocked: 1, stars: {}, seenIntro: {} });
  if ('extraSpots' in progress) {
    delete progress.extraSpots;
    try { env.saveStorage(C.SAVE_KEY, progress); } catch (e) {}
  }
  function saveProgress() { env.saveStorage(C.SAVE_KEY, progress); }

  env.showShareMenu();
  env.onShareAppMessage(() => ({ title: C.SHARE_TITLE, imageUrl: C.SHARE_IMAGE }));
  env.onHide(() => { hideAt = Date.now(); });
  env.onShow(() => {
    if (!sharePending) return;
    const cb = sharePending;
    sharePending = null;
    const dt = Date.now() - hideAt;
    // 微信不返回分享结果，回到前台且离开超过短阈值即视为已分享
    cb(dt >= 400);
  });

  function resize() {
    const info = env.getWindowInfo();
    const W = info.windowWidth, H = info.windowHeight, dpr = Math.max(1, info.pixelRatio || 2);
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    const scale = Math.min(W / C.STAGE_W, H / C.STAGE_H);
    const ox = (W - C.STAGE_W * scale) / 2;
    const oy = (H - C.STAGE_H * scale) / 2;
    layout = { W, H, dpr, scale, ox, oy };
  }

  function toLogical(t) {
    const cx = (typeof t.clientX === 'number') ? t.clientX : t.x;
    const cy = (typeof t.clientY === 'number') ? t.clientY : t.y;
    return { x: (cx - layout.ox) / layout.scale, y: (cy - layout.oy) / layout.scale };
  }

  function im(name) { return assets[name] || null; }

  function add(start, dur, fn, done) { return clock.add(start, dur, fn, done); }
  function at(time, fn) { return clock.at(time, fn); }
  function cancelAll() { clock.cancelAll(); }

  function toast(msg) {
    toastMsg = msg; toastUntil = now() + 1.3;
  }

  function fadeSwap(fn) {
    const t = now();
    add(t, 0.3, u => { fade = 0.55 * u; }, () => {
      fn();
      const t2 = now();
      add(t2, 0.3, u => { fade = 0.55 * (1 - u); }, () => { fade = 0; });
    });
  }

  function hideCards() { ui.modal = null; ui.win = null; ui.fail = null; ui.ageInfo = false; }

  function cellCenter(v) {
    const cs = L.cellsOf(v); let x = 0, y = 0;
    cs.forEach(([cx, cy]) => { x += cx; y += cy; });
    x /= cs.length; y /= cs.length;
    return { x: C.LOT_X + (x + .5) * C.CELL, y: C.LOT_Y + (y + .5) * C.CELL };
  }
  function dispN() { return L.BASE_SPOTS + C.MAX_EXTRA + (G && G.tempSpot >= 0 ? 1 : 0); }
  function spotW() { return dispN() > 5 ? 52 : 58; }
  function spotX(i) {
    const n = dispN(), w = spotW(), gap = n > 5 ? 5 : 8, total = n * w + (n - 1) * gap;
    return 195 - total / 2 + i * (w + gap) + w / 2;
  }
  function slotPos(k) { return { x: C.HEAD_X + k * C.PAX_SP, y: C.FEET_Y }; }
  function busImg(v) { return AKEY.bus(v); }

  function makeSpot(kind) {
    const d = {
      kind, x: 0, y: C.SPOT_Y, w: spotW(), h: C.SPOT_H,
      warn: false, flashT: 0, opacity: 1, ty: 0, scale: 1, shakeX: 0,
    };
    G.spots.push(d);
    G.spotFreeAt.push(0);
    const c = { x: 0, y: C.SPOT_Y + C.SPOT_H - 14, w: 64, opacity: 0, text: '', color: '#6b3f1d', popT: 0 };
    G.counters.push(c);
    return d;
  }
  function makeLocked() {
    const d = {
      kind: 'locked', x: 0, y: C.SPOT_Y, w: spotW(), h: C.SPOT_H,
      warn: false, flashT: 0, opacity: 1, ty: 0, scale: 1, shakeX: 0,
    };
    G.lockEls.push(d);
    return d;
  }
  function placeSpots(dur) {
    const w = spotW(), n = G.spots.length, t = now();
    const items = G.spots.map((d, i) => [d, i]).concat(G.lockEls.map((d, k) => [d, n + k]));
    items.forEach(([d, i]) => {
      const x1 = spotX(i) - w / 2, x0 = d.x || x1, w0 = d.w || w;
      if (!dur) { d.x = x1; d.w = w; }
      else add(t, dur, u => { const k = E.inOutQ(u); d.x = lerp(x0, x1, k); d.w = lerp(w0, w, k); });
    });
    const cw = Math.min(64, w + 4);
    G.counters.forEach((c, i) => {
      c.w = cw;
      const x1 = spotX(i) - cw / 2, x0 = c.x || x1;
      if (!dur) c.x = x1;
      else add(t, dur, u => { c.x = lerp(x0, x1, E.inOutQ(u)); });
    });
    if (dur) G.state.veh.forEach(v => {
      if (v.where !== 'spot') return;
      const e = G.veh[v.id];
      const x0 = e.x, x1 = spotX(v.spot);
      if (Math.abs(x1 - x0) > .5 && (G.arriveAt[v.id] || 0) < t) add(t, dur, u => { e.x = lerp(x0, x1, E.inOutQ(u)); });
    });
  }

  function startLevel(idx, why) {
    cancelAll();
    const level = LEVELS[idx];
    const state = L.init(level, L.BASE_SPOTS);
    G = {
      idx, level, state, history: [], veh: [], pax: [], spots: [], counters: [],
      visHead: 0, boardCursor: 0, arriveAt: {}, lastBoardEnd: {}, spotFreeAt: [],
      busyUntil: 0, chain: 0, lastDepartT: -9, lastDepartChain: -1, combo: 0, maxCombo: 0,
      undoFree: 2, undoUsed: 0, lockUntil: 0, ended: false, tutorial: !!level.tutorial,
      tempSpot: -1, revived: false, shareUnlocked: 0, lockEls: [], groups: [],
      road: { dep: [], arr: [] }, fx: [], headMark: { visible: false, wait: false, text: '队首', color: '#b0561c' },
      more: '', handTarget: null, counterLeft: {},
    };
    fieldOx = fieldOy = 0; rewinding = false; hideCards();
    fade = Math.max(fade, 0);
    ui.levelTitle = `第 ${idx + 1} 关 · ${level.name}`;
    for (let i = 0; i < state.spots.length; i++) makeSpot('open');
    for (let i = state.spots.length; i < L.BASE_SPOTS + C.MAX_EXTRA; i++) makeLocked();
    placeSpots(0);
    state.veh.forEach(v => {
      const h = v.len * C.CELL - 6;
      const e = new Ent(C.VEH_W, h, 'veh');
      const cpos = cellCenter(v);
      e.x = cpos.x; e.y = cpos.y; e.rot = C.DIR_ROT[v.dir];
      e.revealed = !v.m; e.len = v.len; e.id = v.id; e.c = v.c;
      e.imgKey = v.m ? 'mystery' : busImg(v);
      e.mys = !!v.m; e.z = 10 + v.y;
      e.sx = e.sy = 0;
      const t0 = now() + 0.15 + v.id * 0.05;
      add(t0, 0.35, u => { const s = E.outBack(u); e.sx = e.sy = s; });
      G.veh.push(e);
    });
    state.q.forEach((c, i) => {
      const e = new Ent(27, 54, 'pax');
      e.c = c; e.paxFrame = 0; e.flip = C.PAX_FLIP_IDLE; e.z = 500 - i;
      const p = slotPos(i); e.x = p.x; e.y = p.y; e.visible = i < C.VISIBLE;
      if (i < C.VISIBLE) {
        const t0 = now() + 0.2 + i * 0.05; e.alpha = 0; e.ox = 60;
        add(t0, 0.35, u => { e.alpha = Math.min(1, u * 2); e.ox = 60 * (1 - E.outC(u)); });
      }
      G.pax.push(e);
    });
    state.gsz.forEach((n, i) => { if (n > 1) G.groups.push({ start: i, n, c: state.q[i] }); });
    lastSpotSig = '';
    layoutQueue(false);
    refreshHUD();
    if (level.intro && !progress.seenIntro[idx + 1]) showIntro(level.intro, idx);
    analytics.levelStart(idx + 1, why || 'enter');
  }

  function burstAt(x, y, size, dur) {
    const fx = { typ: 'burst', x, y, size, t0: now(), dur, dead: false };
    G.fx.push(fx);
    add(fx.t0, dur, u => { fx.u = u; }, () => { fx.dead = true; });
  }
  function fxText(txt, cls, x, y, dur, rise) {
    const fx = { typ: 'text', txt, cls, x, y, dur, rise, t0: now(), dead: false };
    G.fx.push(fx);
    add(fx.t0, dur, u => { fx.u = u; }, () => { fx.dead = true; });
    return fx;
  }
  function comboPop(n) { fxText(`连发 ×${n}`, 'combo', 195, 352, 1.0, -46 - n * 6); }

  function unlockSpot() {
    if (!G || G.shareUnlocked >= C.MAX_EXTRA || !G.lockEls.length) return;
    G.shareUnlocked++;
    analytics.shareUnlock(G.idx + 1, G.shareUnlocked);
    const d = G.lockEls.shift();
    const idx = L.addSpot(G.state);
    const t = now(), x = d.x + spotW() / 2, y = C.SPOT_Y + C.SPOT_H / 2;
    const lock = { typ: 'unlock', x, y, t0: t, dead: false };
    G.fx.push(lock);
    add(t, 0.9, u => { lock.u = u; }, () => { lock.dead = true; });
    at(t + 0.3, () => {
      burstAt(x, y, 150, 0.8);
      d.kind = 'open'; d.flashT = now();
      fxText('+1 车位', 'unlock', x, C.SPOT_Y - 14, 1.1, -24);
    });
    G.spots.splice(idx, 0, d); G.spotFreeAt.splice(idx, 0, 0);
    const c = { x: 0, y: C.SPOT_Y + C.SPOT_H - 14, w: 64, opacity: 0, text: '', color: '#6b3f1d', popT: 0 };
    G.counters.splice(idx, 0, c);
    placeSpots(0); resumeIfRescued(); lastSpotSig = ''; at(t + 0.35, refreshHUD); refreshHUD();
  }

  function addTempSpot() {
    G.revived = true; analytics.adRevive(G.idx + 1); const idx = L.addSpot(G.state); G.tempSpot = idx;
    const d = makeSpot('temp');
    G.spots.splice(G.spots.length - 1, 1);
    G.spots.splice(idx, 0, d);
    G.spotFreeAt.pop(); G.spotFreeAt.splice(idx, 0, 0);
    const c = G.counters.pop(); G.counters.splice(idx, 0, c);
    placeSpots(0.35);
    const t = now(); const x1 = spotX(idx);
    d.x = x1 - spotW() / 2; d.w = spotW(); d.ty = -120; d.scale = 0.6; d.opacity = 0;
    add(t + 0.25, 0.45, u => {
      d.ty = -120 * (1 - E.outBack(u));
      d.scale = lerp(0.6, 1, E.outBack(u));
      d.opacity = Math.min(1, u * 3);
    }, () => {
      d.ty = 0; d.scale = 1; d.opacity = 1;
      burstAt(x1, C.SPOT_Y + C.SPOT_H / 2, 140, 0.7);
      fxText('临时 +1 车位', 'unlock', x1, C.SPOT_Y - 14, 1.2, -24);
    });
    resumeIfRescued(); lastSpotSig = ''; at(t + 0.75, refreshHUD);
  }
  function resumeIfRescued() {
    if (G.ended && !G.state.over) { G.ended = false; hideCards(); G.lockUntil = now() + 0.4; }
  }

  function askShare() {
    if (!G || G.shareUnlocked >= C.MAX_EXTRA) { toast('本局车位已全部解锁'); return; }
    ui.modal = 'share'; ui.shareBusy = false; cardAnimT = now();
  }
  function cancelShare() { ui.modal = null; ui.shareBusy = false; }
  function confirmShare() {
    ui.shareBusy = true;
    const opt = { title: C.SHARE_TITLE, imageUrl: C.SHARE_IMAGE };
    const used = env.shareAppMessage(opt);
    if (used) {
      hideAt = Date.now();
      sharePending = (ok) => {
        ui.modal = null; ui.shareBusy = false;
        if (ok) unlockSpot();
        else toast('分享未完成');
      };
    } else {
      // 本地预览 / 无分享接口：2 秒占位后解锁（与网页版一致）
      const t = now();
      at(t + 2, () => { ui.modal = null; ui.shareBusy = false; unlockSpot(); });
    }
  }

  function ensureAd() {
    if (videoAd || !C.AD_UNIT_ID) return videoAd;
    videoAd = env.createRewardedVideoAd(C.AD_UNIT_ID);
    if (videoAd && videoAd.onError) {
      try { videoAd.onError(() => {}); } catch (e) {}
    }
    return videoAd;
  }
  function watchAd(label, done) {
    const ad = ensureAd();
    if (ad && typeof ad.show === 'function') {
      const onClose = (res) => {
        try { if (ad.offClose) ad.offClose(onClose); } catch (e) {}
        if (res && res.isEnded) done();
        else toast('需要看完广告才能获得奖励');
      };
      try { if (ad.onClose) ad.onClose(onClose); } catch (e) {}
      const failToPlaceholder = () => {
        try { if (ad.offClose) ad.offClose(onClose); } catch (e) {}
        toast('广告暂时无法播放，改用占位');
        openWatch(label, done);
      };
      const show = () => {
        Promise.resolve(ad.show()).catch(() => {
          if (ad.load) return Promise.resolve(ad.load()).then(() => ad.show());
          throw new Error('no load');
        }).catch(failToPlaceholder);
      };
      show();
      return;
    }
    openWatch(label, done);
  }
  function openWatch(label, done) {
    ui.modal = 'watch';
    ui.watchLabel = label;
    ui.watchSec = C.PLACEHOLDER_AD_SEC;
    ui.watchDone = done;
    ui.watchStart = now();
    const tick = () => {
      if (ui.modal !== 'watch') return;
      const left = C.PLACEHOLDER_AD_SEC - Math.floor(now() - ui.watchStart);
      ui.watchSec = Math.max(0, left);
      if (ui.watchSec <= 0) {
        ui.modal = null;
        const fn = ui.watchDone; ui.watchDone = null;
        if (fn) fn();
      } else at(now() + 0.25, tick);
    };
    at(now() + 0.25, tick);
  }

  function showIntro(intro, idx) {
    G.lockUntil = now() + 1e6;
    ui.modal = 'intro';
    ui.intro = intro;
    ui.introIdx = idx;
    cardAnimT = now();
  }
  function closeIntro() {
    progress.seenIntro[ui.introIdx + 1] = 1; saveProgress();
    ui.modal = null; ui.intro = null;
    if (G) G.lockUntil = now() + 0.1;
  }

  function layoutQueue(animate, t0) {
    const head = G.visHead;
    G.pax.forEach((e, i) => {
      if (e.walking || e.gone) return;
      const k = i - head; if (k < 0) return;
      const p = slotPos(Math.min(k, C.VISIBLE));
      const wasVisible = e.visible;
      if (k >= C.VISIBLE) { e.visible = false; e.x = p.x; e.y = p.y; return; }
      e.visible = true;
      if (!animate || !wasVisible) {
        if (!wasVisible && animate) {
          e.x = p.x + C.PAX_SP; e.alpha = 0;
          add(t0, 0.18, u => { e.alpha = u; e.x = lerp(p.x + C.PAX_SP, p.x, E.outQ(u)); });
        } else { e.x = p.x; e.y = p.y; }
        return;
      }
      const sx0 = e.x;
      if (Math.abs(sx0 - p.x) < 0.5) return;
      add(t0, 0.16, u => { e.x = lerp(sx0, p.x, E.outQ(u)); e.oy = -Math.sin(u * Math.PI) * 2.5; });
    });
    const rem = G.pax.length - head;
    G.headMark.visible = rem > 0;
    G.more = rem > C.VISIBLE ? `+${rem - C.VISIBLE}` : '';
    refreshChips();
  }
  function refreshChips() {
    const q = G.state.q;
    ui.chips = [];
    if (G.visHead >= q.length) { ui.queueCount = ''; return; }
    let i = G.visHead, n = 0;
    while (i < q.length && n < 5) {
      const c = q[i]; let j = i; while (j < q.length && q[j] === c) j++;
      ui.chips.push({ c, text: `${C.CNAME[c]}×${j - i}`, first: n === 0 });
      i = j; n++;
    }
    ui.queueCount = String(q.length - G.visHead);
  }

  function refreshHUD() {
    if (!G) return;
    const s = G.state;
    const mov = new Set(L.movable(s)); const h = L.headColor(s);
    G.veh.forEach((e, i) => {
      const v = s.veh[i];
      e.glow = !s.over && v.where === 'lot' && mov.has(i) && v.c === h;
    });
    G.veh.forEach((e, i) => {
      const v = s.veh[i]; if (!v.m) return;
      const show = v.where !== 'lot' || mov.has(i);
      if (show !== e.revealed) revealVeh(e, v, show);
    });
    refreshSpots(now());
    if (G.tutorial) placeHand();
  }
  function refreshSpots(t) {
    if (!G) return;
    const s = G.state; const n = s.spots.length;
    let vfree = 0, vfreeIdx = -1;
    for (let i = 0; i < n; i++) {
      const occ = s.spots[i] >= 0 || G.spotFreeAt[i] > t;
      if (!occ) { vfree++; if (vfreeIdx < 0) vfreeIdx = i; }
    }
    const lfree = s.spots.filter(x => x < 0).length;
    const warnIdx = (!s.over && lfree === 1 && vfree === 1) ? vfreeIdx : -1;
    const h = L.headColor(s); let waiting = false; let tight = false;
    if (h && t > G.boardCursor + 0.35) {
      waiting = !L.boardTarget(s);
      tight = waiting && s.spots.some(vid => vid >= 0 && s.veh[vid].c === h);
    }
    const sig = vfree + '|' + warnIdx + '|' + waiting + '|' + h + '|' + tight + '|' + n;
    if (sig === lastSpotSig) return; lastSpotSig = sig;
    ui.spotInfo = { vfree, n, low: vfree <= 1 };
    G.spots.forEach((d, i) => { d.warn = i === warnIdx; });
    if (waiting) {
      G.headMark.wait = true;
      G.headMark.text = tight ? '坐不下' : `等${C.CNAME[h]}车`;
      G.headMark.color = tight ? '#b0561c' : C.CCOL[h];
    } else {
      G.headMark.wait = false; G.headMark.text = '队首'; G.headMark.color = '#b0561c';
    }
  }
  function revealVeh(e, v, show) {
    e.revealed = show; const t = now();
    if (!show) { e.imgKey = 'mystery'; e.mys = true; return; }
    add(t, 0.14, u => { e.sx = 1 - u; }, () => { e.imgKey = busImg(v); e.mys = false; });
    add(t + 0.14, 0.26, u => { e.sx = E.outBack(u); }, () => { e.sx = 1; });
    at(t + 0.12, () => burstAt(e.x, e.y, 90, 0.5));
  }
  function placeHand() {
    const s = G.state; const h = L.headColor(s); const mov = L.movable(s);
    const id = mov.find(i => s.veh[i].c === h);
    if (id == null) { G.handTarget = null; return; }
    G.handTarget = G.veh[id];
  }

  function onTap(id) {
    if (!G || G.ended) return;
    const t = now(); if (t < G.lockUntil) return;
    const s = G.state; const v = s.veh[id]; if (!v || v.where !== 'lot') return;
    if (s.over) return;
    const b = L.blocker(s, id);
    if (b >= 0) { bump(id, b, t); return; }
    if (L.freeSpot(s) < 0) { toast('车位已满'); return; }
    G.history.push(L.clone(s));
    const r = L.tap(s, id);
    G.chain++;
    if (G.tutorial) { G.tutorial = false; G.handTarget = null; }
    schedule(r.events, t);
    refreshHUD();
    if (s.over) {
      const endT = G.busyUntil;
      G.ended = true; G.veh.forEach(e => { e.glow = false; });
      if (s.over === 'win') at(endT + 0.15, winSequence);
      else at(endT + 0.1, failSequence);
    }
  }
  function bump(id, bid, t) {
    const e = G.veh[id], v = G.state.veh[id]; const [dx, dy] = L.DIRV[v.dir];
    G.lockUntil = Math.max(G.lockUntil, t + 0.05);
    add(t, 0.1, u => { const k = E.outQ(u) * C.CELL * 0.25; e.ox = dx * k; e.oy = dy * k; e.sy = 1 - 0.06 * u; });
    add(t + 0.1, 0.16, u => { const k = (1 - E.outBack(u)) * C.CELL * 0.25; e.ox = dx * k; e.oy = dy * k; e.sy = 0.94 + 0.06 * u; }, () => { e.ox = e.oy = 0; e.sy = 1; });
    const be = G.veh[bid];
    at(t + 0.08, () => { be.redUntil = now() + 0.45; });
    add(t + 0.08, 0.22, u => {
      const a = (1 - u) * 3;
      fieldOx = Math.sin(u * 40) * a;
      fieldOy = Math.cos(u * 33) * a * .6;
    }, () => { fieldOx = fieldOy = 0; });
  }

  function schedule(events, t) {
    const chain = G.chain;
    for (const ev of events) {
      if (ev.t === 'drive') scheduleDrive(ev.v, ev.spot, t);
      else if (ev.t === 'board') scheduleBoard(ev.v, ev.pax, ev.left);
      else if (ev.t === 'depart') scheduleDepart(ev.v, ev.spot, chain);
    }
  }
  function drivePath(v, spot) {
    const cpos = cellCenter(v), sx = spotX(spot); const pts = [{ x: cpos.x, y: cpos.y }];
    if (v.dir === 'U') { if (Math.abs(cpos.x - sx) > 2) { pts.push({ x: cpos.x, y: C.ROAD_Y }, { x: sx, y: C.ROAD_Y }); } }
    else if (v.dir === 'L') pts.push({ x: C.LANE_L, y: cpos.y }, { x: C.LANE_L, y: C.ROAD_Y }, { x: sx, y: C.ROAD_Y });
    else if (v.dir === 'R') pts.push({ x: C.LANE_R, y: cpos.y }, { x: C.LANE_R, y: C.ROAD_Y }, { x: sx, y: C.ROAD_Y });
    else {
      const side = cpos.x < 195 ? C.LANE_L : C.LANE_R;
      pts.push({ x: cpos.x, y: C.LANE_B }, { x: side, y: C.LANE_B }, { x: side, y: C.ROAD_Y }, { x: sx, y: C.ROAD_Y });
    }
    pts.push({ x: sx, y: C.SPOT_CY });
    return buildPath(pts, 18);
  }
  function scheduleDrive(id, spot, t) {
    const e = G.veh[id], v = G.state.veh[id];
    const P = drivePath(v, spot);
    const dj = Math.max(0, P.total - (C.ROAD_Y - C.SPOT_CY) - 14);
    const T1 = 0.12 + dj / 1300, T2 = 0.26;
    let t1, t2;
    for (let k = 0; k < 12; k++) {
      t1 = t + 0.09; t2 = Math.max(t1 + T1, G.spotFreeAt[spot] + 0.03);
      const ra = t1 + T1 * 0.55, rb = t2 + T2; let hit = null;
      for (const [a, b] of G.road.dep) if (ra < b && rb > a) { hit = b; break; }
      if (hit == null) { G.road.arr.push([ra, rb]); break; }
      t += hit - ra + 0.02;
    }
    const arrive = t2 + T2;
    G.arriveAt[id] = arrive + 0.04; G.lastBoardEnd[id] = arrive;
    G.spotFreeAt[spot] = 1e9;
    e.glow = false;
    if (t > now() + 0.05) G.lockUntil = Math.max(G.lockUntil, now() + 0.05);
    add(t, 0.09, u => { e.idle = false; e.sx = 1 + 0.08 * u; e.sy = 1 - 0.12 * u; e.z = 200; });
    add(t1, T1, u => {
      const d = dj * (u < 0.35 ? E.inQ(u / 0.35) * 0.25 : 0.25 + 0.75 * (u - 0.35) / 0.65);
      const p = pathAt(P, d); e.x = p.x; e.y = p.y; e.rot = angTo(e.rot, p.rot);
      const st = Math.sin(u * Math.PI);
      e.sx = lerp(1.08, 1, Math.min(1, u * 4)) - 0.03 * st;
      e.sy = lerp(0.88, 1, Math.min(1, u * 4)) + 0.07 * st;
    });
    const ps1 = v.len === 3 ? 0.84 : 1;
    add(t2, T2, u => {
      const d = dj + (P.total - dj) * E.outC(u);
      const p = pathAt(P, d); e.x = p.x; e.y = p.y; e.rot = angTo(e.rot, p.rot);
      e.sy = 1 + 0.04 * (1 - u); e.ps = lerp(1, ps1, u);
    }, () => { e.rot = 0; e.parked = true; e.z = 60; });
    add(arrive, 0.18, u => { const k = Math.sin(u * Math.PI); e.sy = 1 - 0.06 * k; e.oy = -2 * k; }, () => { e.sy = 1; e.oy = 0; e.idle = true; });
    at(arrive, () => setCounter(spot, v.cap, v.c, false));
    G.counterLeft[id] = v.cap;
    G.busyUntil = Math.max(G.busyUntil, arrive + 0.2);
  }
  function setCounter(spot, left, c, pop) {
    const el = G.counters[spot]; if (!el) return;
    el.opacity = 1;
    el.color = left > 0 ? C.CCOL[c] : '#e2462f';
    el.text = left > 0 ? `还差 ${left}` : '满员!';
    if (pop) el.popT = now();
  }
  function scheduleBoard(id, paxIdx, left) {
    const e = G.veh[id], v = G.state.veh[id], P = G.pax[paxIdx];
    const tb = Math.max(G.boardCursor, G.arriveAt[id]); G.boardCursor = tb + 0.11;
    const sx = spotX(v.spot);
    const WALK = 0.3, HOP = 0.12;
    const door = { x: sx + 17, y: C.SPOT_Y + 22 };
    at(tb, () => {
      G.visHead = paxIdx + 1; P.walking = true; P.idle = false; P.visible = true; P.z = 900;
      layoutQueue(true, tb);
      const x0 = P.x, y0 = P.y; P.flip = door.x >= x0 ? 1 : -1;
      add(tb, WALK, u => {
        const k = E.inOutQ(u); P.x = lerp(x0, door.x, k); P.y = lerp(y0, door.y, k);
        const step = Math.floor(u * WALK / 0.075); P.paxFrame = 1 + (step % 2);
        P.oy = -Math.abs(Math.sin(u * Math.PI * 4)) * 3;
      });
      add(tb + WALK, HOP, u => {
        P.x = lerp(door.x, sx, u); P.y = lerp(door.y, C.SPOT_Y + 52, u);
        P.oy = -Math.sin(u * Math.PI) * 12;
        const s = 1 - 0.55 * u; P.sx = P.sy = s; P.alpha = 1 - u * u;
      }, () => { P.visible = false; P.gone = true; P.walking = false; });
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
    let td = G.lastBoardEnd[id] + 0.1;
    for (let k = 0; k < 12; k++) {
      const a = td + 0.26, b = td + 0.26 + 0.2 + 0.42; let hit = null;
      for (const [x, y] of G.road.arr) if (a < y && b > x) { hit = y; break; }
      if (hit == null) { G.road.dep.push([a, b]); break; }
      td = hit - 0.26 + 0.02;
    }
    if (chain === G.lastDepartChain || td - G.lastDepartT <= 1.5) G.combo++; else G.combo = 1;
    G.lastDepartT = td; G.lastDepartChain = chain; G.maxCombo = Math.max(G.maxCombo, G.combo);
    const combo = G.combo, sx = spotX(spot);
    at(td, () => { e.idle = false; fxText('嘀嘀！', 'honk', sx, C.SPOT_Y - 2, 0.7, -16); if (combo >= 2) comboPop(combo); });
    add(td, 0.24, u => { const k = Math.sin(u * Math.PI * 2) * (1 - u); e.sx = 1 + 0.12 * k; e.sy = 1 - 0.1 * k; e.oy = -3 * Math.abs(k); });
    const t1 = td + 0.26, T1 = 0.2;
    at(t1, () => { if (G.counters[spot]) G.counters[spot].opacity = 0; e.z = 210; });
    const ps0 = e.len === 3 ? 0.84 : 1;
    add(t1, T1, u => {
      const k = E.inOutQ(u); e.y = lerp(C.SPOT_CY, C.ROAD_Y, k); e.x = sx + 6 * k; e.rot = lerp(0, 35, k);
      e.sx = 1; e.sy = 1; e.ps = lerp(ps0, 1, u);
    });
    const t2 = t1 + T1, T2 = 0.42; const x0 = sx + 6;
    add(t2, T2, u => {
      const k = E.inQ(u); e.x = lerp(x0, 450, k); e.y = C.ROAD_Y;
      e.rot = lerp(35, 90, Math.min(1, u * 3));
      e.sy = 1 + 0.16 * Math.min(1, u * 2);
      e.sx = 1 - 0.05 * Math.min(1, u * 2);
    }, () => { e.visible = false; });
    G.spotFreeAt[spot] = t1 + T1;
    at(t1 + T1, () => { const d = G.spots[spot]; if (d) d.flashT = now(); });
    G.busyUntil = Math.max(G.busyUntil, t2 + T2);
  }

  function confetti() {
    const t = now();
    for (let i = 0; i < 44; i++) {
      const fx = {
        typ: 'confetti', i: i % 14, t0: t + Math.random() * .15, dur: 1.9, dead: false,
        x0: 195 + (Math.random() - .5) * 60, y0: 330,
        vx: (Math.random() - .5) * 520, vy: -380 - Math.random() * 360,
        rs: (Math.random() - .5) * 900, sc: .7 + Math.random() * .7,
      };
      G.fx.push(fx);
      add(fx.t0, 1.9, u => { fx.u = u; }, () => { fx.dead = true; });
    }
  }
  function calcStars() {
    let s = 3;
    if (G.undoUsed > 0 || G.revived) s--;
    if (!G.level.tutorial && G.maxCombo < 2) s--;
    return Math.max(1, s);
  }
  function winSequence() {
    confetti();
    const stars = calcStars();
    const key = String(G.idx + 1);
    progress.stars[key] = Math.max(progress.stars[key] || 0, stars);
    progress.unlocked = Math.max(progress.unlocked, G.idx + 2);
    saveProgress();
    analytics.levelWin(G.idx + 1, stars, G.undoUsed, G.revived);
    at(now() + 0.45, () => {
      ui.modal = 'win';
      cardAnimT = now();
      starPopT = now();
      const last = G.idx + 1 >= LEVELS.length;
      ui.win = {
        stars,
        stat: `最高连发 ×${Math.max(1, G.maxCombo)} · 撤销 ${G.undoUsed} 次${G.revived ? ' · 复活 1 次' : ''}`,
        last,
        nextLabel: last ? '敬请期待' : '下一关',
      };
    });
  }
  function failSequence() {
    const t = now();
    add(t + 0.5, 0.32, u => {
      const a = (1 - u) * 4;
      G.spots.forEach((d, i) => { d.shakeX = Math.sin(u * 46 + i) * a; });
      G.veh.forEach(e => {
        if (G.state.veh[e.id].where === 'spot') e.ox = Math.sin(u * 46) * a;
      });
    }, () => { G.spots.forEach(d => { d.shakeX = 0; }); G.veh.forEach(e => { e.ox = 0; }); });
    at(t + 0.85, () => {
      const s = G.state, c = L.headColor(s), n = L.headSize(s);
      const who = n > 1 ? `${n}人团` : '';
      const tight = s.spots.some(vid => vid >= 0 && s.veh[vid].c === c);
      let sub = tight ? `停着的${C.CNAME[c]}色车坐不下${who || '了'}` : `停着的车里没有${C.CNAME[c]}色车`;
      let mainPrefix = '车位满了，队首要的是 ';
      let mainSuffix = ` 色${who}`;
      if (s.why === 'stuck') {
        mainPrefix = '队首的 ';
        mainSuffix = ` 色${who}没车可坐了`;
        sub = '剩下的车都坐不下，试试撤销';
      }
      analytics.levelFail(G.idx + 1, s.why || 'full');
      const canRevive = !G.revived && s.why === 'full' && L.movable(s).length > 0;
      const canShare = s.why === 'full' && G.shareUnlocked < C.MAX_EXTRA && L.movable(s).length > 0;
      ui.modal = 'fail';
      cardAnimT = now();
      ui.fail = { mainPrefix, colorName: C.CNAME[c], color: C.CCOL[c], mainSuffix, sub, canRevive, canShare, short: !canRevive && !canShare };
    });
  }

  function requestUndo() {
    if (!G || !G.history.length) { toast('还没有可撤销的步骤'); return; }
    if (now() < G.lockUntil) return;
    if (G.undoFree > 0) { G.undoFree--; analytics.undo(G.idx + 1, 'free'); doUndo(); return; }
    watchAd('看完获得 1 次撤销', () => { analytics.undo(G.idx + 1, 'ad'); doUndo(); });
  }
  function doUndo() {
    cancelAll(); hideCards();
    const prev = G.history.pop();
    L.padSpots(prev, G.state.spots.length);
    prev.over = null; L.status(prev); G.state = prev; G.undoUsed++; G.ended = false;
    G.road = { dep: [], arr: [] };
    const t = now(), Dur = 0.4; G.lockUntil = t + Dur;
    G.boardCursor = 0; G.arriveAt = {}; G.lastBoardEnd = {};
    G.spotFreeAt = G.spotFreeAt.map(() => 0); G.busyUntil = 0; G.combo = 0; G.lastDepartT = -9;
    G.fx = G.fx.filter(f => !f.dead);
    rewinding = true;
    fxText('撤销', 'rewind', 195, 300, 0.6, -20);
    prev.veh.forEach((v, i) => {
      const e = G.veh[i]; let tx, ty, tr;
      e.redUntil = 0; e.glow = false;
      if (v.where === 'lot') {
        const cpos = cellCenter(v); tx = cpos.x; ty = cpos.y; tr = C.DIR_ROT[v.dir];
        e.parked = false; e.z = 10 + v.y;
      } else if (v.where === 'spot') {
        tx = spotX(v.spot); ty = C.SPOT_CY; tr = 0; e.parked = true; e.z = 60; G.spotFreeAt[v.spot] = 1e9;
      } else {
        add(t, Dur * .6, u => { e.alpha = 1 - u; }, () => { e.visible = false; e.alpha = 1; });
        return;
      }
      const ps0 = e.ps, ps1 = (v.where === 'spot' && v.len === 3) ? 0.84 : 1;
      add(t, Dur, u => { e.ps = lerp(ps0, ps1, u); });
      if (!e.visible) { e.visible = true; e.x = 430; e.y = C.ROAD_Y; e.rot = 90; e.alpha = 1; }
      const x0 = e.x, y0 = e.y, r0 = e.rot, r1 = angTo(r0, tr);
      e.idle = false;
      add(t, Dur, u => {
        const k = E.inOutC(u); e.x = lerp(x0, tx, k); e.y = lerp(y0, ty, k); e.rot = lerp(r0, r1, k);
        e.sx = e.sy = 1; e.ox = e.oy = 0;
      }, () => { e.rot = tr; e.idle = true; });
    });
    G.counters.forEach(c => { c.opacity = 0; });
    prev.spots.forEach((vid, i) => { if (vid >= 0) { const v = prev.veh[vid]; setCounter(i, v.cap - v.filled, v.c, false); } });
    G.visHead = prev.qi;
    G.pax.forEach((P, i) => {
      P.walking = false; P.paxFrame = 0; P.flip = C.PAX_FLIP_IDLE; P.sx = P.sy = 1; P.oy = 0; P.idle = true; P.z = 500 - i;
      if (i < prev.qi) { P.visible = false; P.gone = true; return; }
      const k = i - prev.qi; const p = slotPos(Math.min(k, C.VISIBLE));
      if (k >= C.VISIBLE) { P.visible = false; P.gone = false; P.x = p.x; P.y = p.y; return; }
      if (P.gone || !P.visible) {
        P.gone = false; P.visible = true; P.x = p.x; P.y = p.y; P.alpha = 0;
        add(t + 0.1, Dur - 0.1, u => { P.alpha = u; P.sx = P.sy = lerp(.6, 1, E.outBack(u)); });
      } else {
        const x0 = P.x, y0 = P.y; P.alpha = 1;
        add(t, Dur, u => { const kk = E.inOutC(u); P.x = lerp(x0, p.x, kk); P.y = lerp(y0, p.y, kk); });
      }
    });
    lastSpotSig = '';
    layoutQueue(false);
    at(t + Dur, () => { rewinding = false; refreshHUD(); });
    refreshHUD();
    if (G.level.tutorial && G.history.length === 0) { G.tutorial = true; placeHand(); }
  }


  // ---------- 绘制 ----------
  function pushBtn(id, x, y, w, h) { buttons.push({ id, x, y, w, h }); }
  function isPressed(id) { return pressed === id; }

  function drawBtnImage(name, x, y, w, h, label, kind, id, fontSize) {
    const sc = isPressed(id) ? 0.94 : 1;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(sc, sc);
    const pic = im(name);
    if (pic) ctx.drawImage(pic, -w / 2, -h / 2, w, h);
    if (label) {
      if (kind === 'primary') {
        D.fillText(ctx, label, 0, -2, {
          size: fontSize || 24, color: '#fff',
          shadows: [{ x: 0, y: 2, color: '#b8501a' }],
        });
      } else {
        D.fillText(ctx, label, 0, -2, {
          size: fontSize || 20, color: '#7a4a22',
          shadows: [{ x: 0, y: 1, color: '#fff6e4' }],
        });
      }
    }
    ctx.restore();
    pushBtn(id, x, y, w, h);
  }

  function drawIconBack(x, y, id) {
    const sc = isPressed(id) ? 0.94 : 1;
    ctx.save();
    ctx.translate(x + 19, y + 19);
    ctx.scale(sc, sc);
    const pic = im('badge');
    if (pic) ctx.drawImage(pic, -19, -19, 38, 38);
    D.fillText(ctx, '‹', 0, -2, { size: 28, color: '#8a5a2c' });
    ctx.restore();
    pushBtn(id, x, y, 38, 38);
  }

  function drawPill(x, y, w, h, text, color) {
    const pic = im('pill');
    if (pic) ctx.drawImage(pic, x, y, w, h);
    D.fillText(ctx, text, x + w / 2, y + h / 2 - 1, { size: 16, color: color || '#6b3f1d' });
  }

  function drawPanel(x, y, w, h) {
    D.drawNineSlice(ctx, im('panel'), x, y, w, h, 96, 46);
  }

  function cardEnterT() {
    const u = Math.min(1, (now() - cardAnimT) / 0.35);
    const k = 1 - Math.pow(1 - u, 3);
    // approximate overshoot
    const s = u < 1 ? (0.85 + 0.15 * E.outBack(Math.min(1, u))) : 1;
    return { u, s: Math.min(1.06, s), ty: (1 - k) * 40 };
  }

  function isCapture() {
    if (C.CAPTURE_MODE) return true;
    if (typeof GameGlobal !== 'undefined' && GameGlobal && GameGlobal.__DUIHAO_CAPTURE) return true;
    return typeof window !== 'undefined' && !!window.__DUIHAO_CAPTURE;
  }

  // 备案截图专用：无字距、无立体阴影、浅底深字，便于平台识别游戏名。正式游玩仍用原来的立体标题。
  function drawClearNamePlate(cx, cy, size) {
    const s = size || 36;
    const w = s * 4.7;
    const h = s * 1.32;
    const x = cx - w / 2;
    const y = cy - h / 2;
    ctx.save();
    D.roundRect(ctx, x, y, w, h, Math.min(12, h / 3));
    ctx.fillStyle = '#fff7e6';
    ctx.fill();
    ctx.lineWidth = Math.max(2, Math.round(s / 16));
    ctx.strokeStyle = '#c45d18';
    ctx.stroke();
    ctx.restore();
    D.fillText(ctx, '对号发车', cx, cy, {
      size: s, weight: '900', color: '#4a280e', letterSpacing: 0, shadows: [],
    });
  }

  function drawGameName(x, y, size) {
    if (isCapture()) {
      drawClearNamePlate(x, y, Math.max(22, size || 14));
      return;
    }
    D.fillText(ctx, '对号发车', x, y, {
      size: size || 14, weight: '900', color: '#fff7e6',
      shadows: [
        { x: 0, y: 1, color: '#e0782c' },
        { x: 0, y: 2, color: 'rgba(80,30,0,.55)' },
      ],
    });
  }

  const AGE_BADGE_W = 72; // 短边 72 >= 舞台短边 390 的 1/10（官方最小边长要求）
  const AGE_BADGE_RATIO = 1038 / 810;

  function ageBadgeH(w) { return w * AGE_BADGE_RATIO; }

  function drawAgeBadge(x, y, w) {
    const h = ageBadgeH(w);
    const pic = im('age-8plus');
    if (pic) ctx.drawImage(pic, x, y, w, h);
    pushBtn('btn-age-badge', x, y, w, h);
  }

  function drawAgeInfo() {
    ctx.fillStyle = 'rgba(40, 22, 8, 0.62)';
    ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
    pushBtn('btn-age-close', 0, 0, C.STAGE_W, C.STAGE_H);
    const x = 28, w = 334, h = 430, y = 180;
    drawPanel(x, y, w, h);
    const bw = 64, bh = ageBadgeH(bw);
    drawAgeBadge(195 - bw / 2, y + 22, bw);
    D.fillText(ctx, '适宜 8 周岁以上用户使用', 195, y + 22 + bh + 28, {
      size: 16, color: '#6b3f1d',
    });
    const lines = [
      '本游戏是卡通益智过关游戏，画面简约友好，',
      '没有写实对抗，也没有陌生人自由社交。',
      '请在家长指导下合理安排游戏时间。',
    ];
    lines.forEach((ln, i) => {
      D.fillText(ctx, ln, 195, y + 22 + bh + 58 + i * 24, { size: 14, weight: '700', color: '#6b3f1d' });
    });
    drawBtnImage('btn-primary', 70, y + h - 96, 250, 72, '我知道了', 'primary', 'btn-age-close', 22);
  }

  function drawHealth(t) {

    D.cover(ctx, im('ui-start'), 0, 0, C.STAGE_W, C.STAGE_H);
    ctx.fillStyle = 'rgba(40, 22, 8, 0.58)';
    ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
    const bob = isCapture() ? 0 : Math.sin(t * (Math.PI * 2 / 2.4)) * 3;
    if (isCapture()) {
      drawClearNamePlate(195, 78, 36);
    } else {
      D.fillText(ctx, '对号发车', 195, 78 + bob, {
        size: 48, letterSpacing: 4, color: '#fff7e6',
        shadows: [
          { x: 0, y: 3, color: '#e0782c' },
          { x: 0, y: 6, color: '#9c4a1a' },
          { x: 0, y: 9, color: 'rgba(80,30,0,.45)' },
        ],
      });
    }
    const x = 22, w = 346, h = 580, y = 118;
    drawPanel(x, y, w, h);
    const bw = AGE_BADGE_W, bh = ageBadgeH(bw);
    const bx = 52, by = y + 28;
    drawAgeBadge(bx, by, bw);
    D.fillText(ctx, '适宜 8 周岁以上', 230, by + bh / 2 - 12, { size: 18, color: '#6b3f1d' });
    D.fillText(ctx, '用户使用', 230, by + bh / 2 + 14, { size: 18, color: '#6b3f1d' });
    D.fillText(ctx, '《健康游戏忠告》', 195, y + 28 + bh + 36, {
      size: 20, color: '#f07a22', letterSpacing: 2,
      shadows: [{ x: 0, y: 2, color: '#fff3dc' }, { x: 0, y: 3, color: '#b65a1e' }],
    });
    const lines = [
      '抵制不良游戏，拒绝盗版游戏。',
      '注意自我保护，谨防受骗上当。',
      '适度游戏益脑，沉迷游戏伤身。',
      '合理安排时间，享受健康生活。',
    ];
    lines.forEach((ln, i) => {
      D.fillText(ctx, ln, 195, y + 28 + ageBadgeH(AGE_BADGE_W) + 86 + i * 36, { size: 16, weight: '700', color: '#6b3f1d' });
    });
    drawBtnImage('btn-primary', 70, y + h - 108, 250, 80, '进入游戏', 'primary', 'btn-health-enter', 24);
  }

  function drawStart(t) {
    D.cover(ctx, im('ui-start'), 0, 0, C.STAGE_W, C.STAGE_H);
    const bob = isCapture() ? 0 : Math.sin(t * (Math.PI * 2 / 2.4)) * 5;
    if (isCapture()) {
      drawClearNamePlate(195, 130, 42);
    } else {
      D.fillText(ctx, '对号发车', 195, 130 + bob, {
        size: 62, letterSpacing: 6, color: '#fff7e6',
        shadows: [
          { x: 0, y: 4, color: '#e0782c' },
          { x: 0, y: 8, color: '#9c4a1a' },
          { x: 0, y: 12, color: 'rgba(80,30,0,.45)' },
        ],
      });
    }
    D.fillText(ctx, '点车出库 · 同色上车 · 坐满发车', 195, 188, {
      size: 16, weight: '700', color: '#7a4320', letterSpacing: 2,
      shadows: [{ x: 0, y: 1, color: '#fff3dc' }],
    });
    drawBtnImage('btn-primary', 70, 534, 250, 88, '开始游戏', 'primary', 'btn-start', 24);
    drawBtnImage('btn-secondary', 95, 636, 200, 72, '选择关卡', 'secondary', 'btn-select', 20);
    if (!isCapture()) {
      drawBtnImage('btn-secondary', 95, 718, 200, 72, '游戏圈', 'secondary', 'btn-club', 20);
    }
    D.fillText(ctx, '微信版 · 共 ' + LEVELS.length + ' 关', 195, 822, {
      size: 12, weight: '700', color: '#fff',
      shadows: [{ x: 0, y: 1, color: 'rgba(0,0,0,.6)' }],
    });
    const bw = AGE_BADGE_W, bh = ageBadgeH(bw);
    drawAgeBadge(C.STAGE_W - 16 - bw, 16, bw);
  }

  function drawSelect(t) {
    D.cover(ctx, im('ui-select'), 0, 0, C.STAGE_W, C.STAGE_H);
    ctx.fillStyle = 'rgba(255,236,205,0.18)';
    ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
    drawIconBack(16, 22, 'sel-back');
    drawPill(110, 22, 170, 38, '选择关卡');
    drawGameName(195, 72, 14);
    const gridLeft = 22, gridTop = 96, gapX = 10, gapY = 12, colW = (346 - 3 * gapX) / 4;
    for (let i = 1; i <= 20; i++) {
      const col = (i - 1) % 4, row = Math.floor((i - 1) / 4);
      const cx = gridLeft + col * (colW + gapX) + colW / 2;
      const top = gridTop + row * (96 + 0); // css gap 12, cell height 96 includes gap? 
      // grid gap is 12px row, cell height 96, so row stride = 96? 
      // .lv height 96 and gap 12 → stride 108
      const ly = gridTop + row * 108;
      const playable = i <= LEVELS.length;
      const open = playable && i <= progress.unlocked;
      const cur = open && i === Math.min(progress.unlocked, LEVELS.length) && !progress.stars[i];
      const tile = 72;
      let ts = 1;
      if (cur) ts = 1 + 0.07 * (0.5 + 0.5 * Math.sin(t * (Math.PI * 2 / 1.4)));
      if (open && isPressed('lv-' + i)) ts *= 0.93;
      const pic = im(open ? 'tile-level' : 'tile-locked');
      ctx.save();
      ctx.translate(cx, ly + 36);
      ctx.scale(ts, ts);
      if (pic) ctx.drawImage(pic, -tile / 2, -tile / 2, tile, tile);
      if (open) {
        D.fillText(ctx, String(i), 0, -1, {
          size: 30, color: '#a0521c', shadows: [{ x: 0, y: 2, color: '#fff3dc' }],
        });
      }
      ctx.restore();
      if (open) {
        const st = progress.stars[i] || 0;
        for (let k = 0; k < 3; k++) {
          const sp = im(k < st ? 'star-gold' : 'star-grey');
          if (sp) ctx.drawImage(sp, cx - 26 + k * 18, ly + 74, 16, 16);
        }
      } else {
        D.fillText(ctx, playable ? '过关解锁' : '尚未开放', cx, ly + 80, {
          size: 11, weight: '700', color: '#fff',
          shadows: [{ x: 0, y: 1, color: 'rgba(0,0,0,.7)' }],
        });
        if (LEVELS[i - 1] && LEVELS[i - 1].isNew) {
          D.fillText(ctx, '新', cx + 28, ly + 8, {
            size: 12, color: '#fff',
            shadows: [{ x: 0, y: 0, color: '#e2462f' }, { x: 0, y: 1, color: '#8e2a1e' }],
          });
        }
      }
      pushBtn('lv-' + i, cx - colW / 2, ly, colW, 96);
    }
    if (isCapture()) {
      drawClearNamePlate(195, 844 - 34, 22);
    } else {
      D.fillText(ctx, '对号发车 · 共 ' + LEVELS.length + ' 关，过关后解锁下一关', 195, 844 - 34, {
        size: 13, weight: '700', color: '#fff',
        shadows: [{ x: 0, y: 1, color: 'rgba(0,0,0,.7)' }],
      });
    }
  }

  function drawVehicle(e, t) {
    if (!e.visible || e.alpha <= 0) return;
    const pose = e.pose(t);
    const img = im(e.imgKey);
    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.x + pose.ox + fieldOx, e.y + pose.oy + fieldOy);
    ctx.rotate(e.rot * Math.PI / 180);
    ctx.scale(pose.sx, pose.sy);
    // shadow / glow / red
    const red = e.redUntil > t;
    if (e.glow) {
      const g = 0.5 + 0.5 * Math.sin(t * (Math.PI * 2 / 1.1));
      ctx.shadowColor = 'rgba(255, 207, 58, ' + (0.7 + 0.3 * g) + ')';
      ctx.shadowBlur = 8 + 10 * g;
      ctx.shadowOffsetY = 0;
    } else if (red) {
      ctx.shadowColor = 'rgba(255, 32, 32, 0.95)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 0;
    } else {
      ctx.shadowColor = 'rgba(40,20,5,0.45)';
      ctx.shadowBlur = e.lift > 1.02 ? 8 : 3;
      ctx.shadowOffsetY = e.lift > 1.02 ? 8 : 3;
    }
    if (img) ctx.drawImage(img, -e.w / 2, -e.h / 2, e.w, e.h);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    // arrow
    const arrowA = e.parked ? 0 : 1;
    if (arrowA > 0.02) {
      const ap = im('arrow');
      if (ap) {
        ctx.globalAlpha = e.alpha * arrowA;
        const ay = e.mys ? -e.h * 0.26 : 0;
        ctx.drawImage(ap, -11, ay - 10, 22, 24);
      }
    }
    // badge
    if (!e.mys) {
      ctx.globalAlpha = e.alpha;
      ctx.save();
      ctx.translate(0, e.h / 2 - 15);
      ctx.rotate(-e.rot * Math.PI / 180);
      const bd = im('badge');
      if (bd) ctx.drawImage(bd, -9, -9, 18, 18);
      D.fillText(ctx, e.c, 0, 0, { size: 11, color: C.CCOL[e.c] || '#6b3f1d' });
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPax(e, t) {
    if (!e.visible || e.alpha <= 0) return;
    const pose = e.pose(t);
    const key = `pax-${e.c.toLowerCase()}-${e.paxFrame || 0}`;
    const img = im(key);
    ctx.save();
    ctx.globalAlpha = e.alpha;
    ctx.translate(e.x + pose.ox + fieldOx, e.y + pose.oy + fieldOy);
    ctx.scale(pose.sx * e.flip, pose.sy);
    ctx.shadowColor = 'rgba(40,20,5,0.35)';
    ctx.shadowBlur = 2; ctx.shadowOffsetY = 2;
    if (img) ctx.drawImage(img, -e.w / 2, -e.h, e.w, e.h);
    ctx.restore();
  }

  function drawPlay(t) {
    ctx.save();
    ctx.translate(fieldOx, fieldOy);
    if (rewinding) {
      try { ctx.filter = 'sepia(0.35) saturate(1.15) brightness(1.04)'; } catch (e) {}
    }
    // background
    const bg = im('bg-play');
    if (bg) ctx.drawImage(bg, 0, 0, C.STAGE_W, C.STAGE_H);
    else { ctx.fillStyle = '#d9c3a5'; ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H); }
    // lot tiles
    const lot = im('tile-lot');
    for (let y = 0; y < C.ROWS; y++) for (let x = 0; x < C.COLS; x++) {
      if (lot) ctx.drawImage(lot, C.LOT_X + x * C.CELL, C.LOT_Y + y * C.CELL, C.CELL, C.CELL);
    }
    // spots
    const allSpots = G.spots.map((d, i) => ({ d, i, locked: false })).concat(G.lockEls.map((d, k) => ({ d, i: G.spots.length + k, locked: true })));
    allSpots.forEach(({ d, i, locked }) => {
      const imgName = d.kind === 'temp' ? 'tile-spot-temp' : d.kind === 'locked' ? 'tile-spot-locked' : 'tile-spot';
      const pic = im(imgName);
      ctx.save();
      const cx = d.x + d.w / 2 + (d.shakeX || 0), cy = d.y + d.h / 2 + (d.ty || 0);
      ctx.translate(cx, cy);
      ctx.scale(d.scale || 1, d.scale || 1);
      ctx.globalAlpha = d.opacity == null ? 1 : d.opacity;
      // flash / warn
      if (d.flashT && t - d.flashT < 0.5) {
        const u = (t - d.flashT) / 0.5;
        ctx.shadowColor = 'rgba(255,243,160,' + (1 - u) + ')';
        ctx.shadowBlur = 16 * (1 - u);
      } else if (d.warn) {
        const g = 0.5 + 0.5 * Math.sin(t * (Math.PI * 2 / 0.8));
        ctx.shadowColor = 'rgba(255,30,30,' + (0.5 + 0.5 * g) + ')';
        ctx.shadowBlur = 4 + 10 * g;
      }
      if (pic) ctx.drawImage(pic, -d.w / 2, -d.h / 2, d.w, d.h);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      if (d.kind === 'temp') {
        D.fillText(ctx, '临时', 0, -d.h / 2 + 14, {
          size: 11, color: '#fff', shadows: [{ x: 0, y: 1, color: 'rgba(120,50,0,.9)' }],
        });
      }
      if (d.kind === 'locked') {
        const bob = Math.sin(t * (Math.PI * 2 / 1.6)) * 3;
        const sh = im('share');
        if (sh) ctx.drawImage(sh, -14, d.h / 2 - 46 + bob, 28, 28);
        D.fillText(ctx, '分享解锁', 0, d.h / 2 - 14 + bob, {
          size: 11, color: '#fff2c4', shadows: [{ x: 0, y: 1, color: 'rgba(0,0,0,.8)' }],
        });
        ctx.restore();
        pushBtn('lock-' + i, d.x, d.y, d.w, d.h);
        return;
      }
      if (d.warn) {
        const wb = 1 + 0.08 * Math.sin(t * (Math.PI * 2 / 0.8));
        ctx.save(); ctx.scale(wb, wb);
        const pill = im('pill');
        if (pill) ctx.drawImage(pill, -46, -13, 92, 26);
        D.fillText(ctx, '最后 1 个车位！', 0, 0, { size: 11, color: '#d62828' });
        ctx.restore();
      }
      ctx.restore();
    });

    // vehicles by z, then pax, then fx
    const vehs = G.veh.slice().sort((a, b) => a.z - b.z);
    vehs.forEach(e => drawVehicle(e, t));
    const pax = G.pax.slice().sort((a, b) => a.z - b.z);
    pax.forEach(e => drawPax(e, t));

    // counters
    G.counters.forEach((c) => {
      if (c.opacity < 0.02) return;
      ctx.save();
      ctx.globalAlpha = c.opacity;
      let sc = 1;
      if (c.popT && t - c.popT < 0.18) sc = lerp(1.35, 1, (t - c.popT) / 0.18);
      ctx.translate(c.x + c.w / 2, c.y + 12);
      ctx.scale(sc, sc);
      const pill = im('pill');
      if (pill) ctx.drawImage(pill, -c.w / 2, -12, c.w, 24);
      D.fillText(ctx, c.text, 0, 0, { size: 13, color: c.color });
      ctx.restore();
    });

    // group badges
    G.groups.forEach(g => {
      const m = G.pax.slice(g.start, g.start + g.n);
      const vis = m.every(P => P.visible && !P.walking && !P.gone);
      if (!vis) return;
      const x = m.reduce((a, P) => a + P.x + P.ox, 0) / g.n;
      const gb = im('group-badge');
      ctx.save();
      ctx.translate(x, C.FEET_Y - 22);
      if (gb) ctx.drawImage(gb, -26, -12, 52, 24);
      D.fillText(ctx, `${g.n}人团`, 20, 0, { size: 11, color: C.CCOL[g.c], align: 'right' });
      ctx.restore();
    });

    // head mark + more
    if (G.headMark.visible) {
      let sc = 1;
      if (G.headMark.wait) sc = 1 + 0.12 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
      ctx.save();
      ctx.translate(C.HEAD_X, C.FEET_Y - 1 + 9);
      ctx.scale(sc, sc);
      const pill = im('pill');
      if (pill) ctx.drawImage(pill, -27, -9, 54, 18);
      D.fillText(ctx, G.headMark.text, 0, 0, { size: 11, color: G.headMark.color || '#b0561c' });
      ctx.restore();
    }
    if (G.more) {
      D.fillText(ctx, G.more, C.HEAD_X + C.VISIBLE * C.PAX_SP - 8, C.FEET_Y - 18, {
        size: 13, color: '#7a4320', align: 'left', shadows: [{ x: 0, y: 1, color: '#fff3dc' }],
      });
    }

    // fx
    G.fx = G.fx.filter(f => !f.dead);
    G.fx.forEach(fx => {
      if (fx.typ === 'burst') {
        const u = fx.u || 0; const s = fx.size * (0.3 + 0.9 * E.outC(u));
        const pic = im('burst');
        ctx.save();
        ctx.translate(fx.x, fx.y);
        ctx.rotate(u * 80 * Math.PI / 180);
        ctx.globalAlpha = u < .6 ? 1 : (1 - u) / .4;
        if (pic) ctx.drawImage(pic, -s / 2, -s / 2, s, s);
        ctx.restore();
      } else if (fx.typ === 'unlock') {
        const u = fx.u || 0;
        const s = u < .35 ? E.outBack(u / .35) : 1;
        const rise = u > .5 ? (u - .5) / .5 : 0;
        const pic = im('unlock');
        ctx.save();
        ctx.translate(fx.x, fx.y - 6 - rise * 46);
        ctx.scale(s, s);
        ctx.rotate(Math.sin(u * 18) * 8 * (1 - u) * Math.PI / 180);
        ctx.globalAlpha = u > .7 ? (1 - u) / .3 : 1;
        if (pic) ctx.drawImage(pic, -24, -24, 48, 48);
        ctx.restore();
      } else if (fx.typ === 'confetti') {
        const u = fx.u || 0; const tt = u * 1.9;
        const x = fx.x0 + fx.vx * tt, y = fx.y0 + fx.vy * tt + 520 * tt * tt;
        const pic = im('confetti-' + fx.i);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(fx.rs * tt * Math.PI / 180);
        ctx.scale(fx.sc, fx.sc);
        ctx.globalAlpha = u > .75 ? (1 - u) * 4 : 1;
        if (pic) ctx.drawImage(pic, -10, -10, 20, 20);
        ctx.restore();
      } else if (fx.typ === 'text') {
        const u = fx.u || 0;
        const sc = u < .2 ? lerp(.5, 1.15, u / .2) : lerp(1.15, 1, Math.min(1, (u - .2) / .2));
        const oy = (fx.rise || 0) * E.outQ(u);
        ctx.save();
        ctx.translate(fx.x, fx.y + oy);
        ctx.scale(sc, sc);
        ctx.globalAlpha = u > .7 ? (1 - (u - .7) / .3) : 1;
        let opt = { size: 20, color: '#ffe066', shadows: [{ x: 0, y: 2, color: '#b05a12' }] };
        if (fx.cls === 'combo') opt = { size: 34, color: '#fff6c8', letterSpacing: 2, shadows: [{ x: 0, y: 3, color: '#e07a1c' }, { x: 0, y: 6, color: '#9c4a1a' }] };
        else if (fx.cls === 'honk') opt = { size: 14, color: '#fff', shadows: [{ x: 0, y: 1, color: '#7a3a10' }] };
        else if (fx.cls === 'rewind') opt = { size: 22, color: '#fff', shadows: [{ x: 0, y: 2, color: '#3069b0' }] };
        D.fillText(ctx, fx.txt, 0, 0, opt);
        ctx.restore();
      }
    });

    try { ctx.filter = 'none'; } catch (e) {}
    ctx.restore();

    // HUD (not shaken)
    drawIconBack(10, 7, 'play-back');
    const pillW = Math.max(190, Math.min(240, 24 + ui.levelTitle.length * 15));
    drawPill(195 - pillW / 2, 7, pillW, 38, ui.levelTitle);
    if (ui.queueCount) {
      D.fillText(ctx, '剩', 390 - 28, 14, { size: 12, color: '#fff', shadows: [{ x: 0, y: 1, color: 'rgba(60,30,0,.8)' }] });
      D.fillText(ctx, ui.queueCount + '人', 390 - 28, 30, { size: 12, color: '#fff', shadows: [{ x: 0, y: 1, color: 'rgba(60,30,0,.8)' }] });
    }
    // chips
    let chipX = 12;
    if (ui.chips.length) {
      D.fillText(ctx, '接下来', chipX, 60, {
        size: 11, color: '#fff', align: 'left',
        shadows: [{ x: 0, y: 1, color: 'rgba(60,30,0,.9)' }],
      });
      chipX += 40;
      ui.chips.forEach((ch) => {
        const w = ch.first ? 70 : 62;
        const sc = ch.first ? 1.12 : 1;
        ctx.save();
        ctx.translate(chipX, 60);
        ctx.scale(sc, sc);
        const pill = im('pill');
        if (pill) ctx.drawImage(pill, 0, -10, w, 20);
        D.fillText(ctx, ch.text, w / 2, 0, { size: 12, color: C.CCOL[ch.c] });
        ctx.restore();
        chipX += (ch.first ? w * 1.12 + 4 : w) + 4;
      });
    }
    // bottom HUD
    // undo
    const ubox = { x: 18, y: 706, w: 62, h: 76 };
    const rbox = { x: 390 - 18 - 62, y: 706, w: 62, h: 76 };
    const us = isPressed('btn-undo') ? 0.9 : 1;
    ctx.save(); ctx.translate(ubox.x + 31, ubox.y + 29); ctx.scale(us, us);
    const uimg = im('btn-undo');
    if (uimg) ctx.drawImage(uimg, -29, -29, 58, 58);
    ctx.restore();
    D.fillText(ctx, '撤销', ubox.x + 31, ubox.y + 68, { size: 12, color: '#fff', shadows: [{ x: 0, y: 1, color: 'rgba(60,30,0,.9)' }] });
    // badge
    const badge = im('badge');
    ctx.save(); ctx.translate(ubox.x + 62 - 6, ubox.y + 8);
    if (badge) ctx.drawImage(badge, -13, -13, 26, 26);
    const undoAd = G && G.undoFree <= 0;
    D.fillText(ctx, undoAd ? '看' : String(G ? G.undoFree : 2), 0, 0, {
      size: undoAd ? 10 : 13, color: undoAd ? '#2f7fd0' : '#e2462f',
    });
    ctx.restore();
    pushBtn('btn-undo', ubox.x, ubox.y, ubox.w, ubox.h);
    // retry
    const rs = isPressed('btn-retry') ? 0.9 : 1;
    ctx.save(); ctx.translate(rbox.x + 31, rbox.y + 29); ctx.scale(rs, rs);
    const rimg = im('btn-retry');
    if (rimg) ctx.drawImage(rimg, -29, -29, 58, 58);
    ctx.restore();
    D.fillText(ctx, '重来', rbox.x + 31, rbox.y + 68, { size: 12, color: '#fff', shadows: [{ x: 0, y: 1, color: 'rgba(60,30,0,.9)' }] });
    pushBtn('btn-retry', rbox.x, rbox.y, rbox.w, rbox.h);
    // spot info
    if (ui.spotInfo) {
      const col = ui.spotInfo.low ? '#ff6a5a' : '#ffe27a';
      D.fillText(ctx, '空车位', 175, 748, { size: 17, color: '#fff', align: 'right', shadows: [{ x: 0, y: 2, color: 'rgba(60,30,0,.85)' }] });
      D.fillText(ctx, String(ui.spotInfo.vfree), 195, 748, { size: 24, color: col, shadows: [{ x: 0, y: 2, color: 'rgba(60,30,0,.85)' }] });
      D.fillText(ctx, '/ ' + ui.spotInfo.n, 230, 748, { size: 17, color: '#fff', align: 'left', shadows: [{ x: 0, y: 2, color: 'rgba(60,30,0,.85)' }] });
    }
    drawGameName(195, 800, 14);

    // tutorial
    if (G && G.tutorial && !ui.modal) {
      if (G.handTarget) {
        const e = G.handTarget;
        const b = Math.abs(Math.sin(t * 4));
        const hx = e.x - 8, hy = e.y - 92 + b * 14, hs = 1 - b * 0.06;
        const hand = im('hand');
        ctx.save(); ctx.translate(hx, hy); ctx.scale(hs, hs);
        if (hand) ctx.drawImage(hand, 0, 0, 44, 77);
        ctx.restore();
      }
      // bubble
      drawPanel(30, 604, 330, 58);
      D.fillText(ctx, '点亮着的车，让同色乘客上车', 195, 633, { size: 17, color: '#6b3f1d' });
    }
  }

  function drawModal(t) {
    if (!ui.modal) return;
    if (ui.modal === 'watch') {
      ctx.fillStyle = 'rgba(20,12,4,0.6)';
      ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
      const x = (C.STAGE_W - 260) / 2, y = (C.STAGE_H - 170) / 2;
      drawPanel(x, y, 260, 170);
      D.fillText(ctx, '观看', 195, y + 40, { size: 26, color: '#6b3f1d' });
      D.fillText(ctx, '（广告占位 · 未开通流量主）', 195, y + 66, { size: 12, weight: '700', color: '#6b3f1d' });
      D.fillText(ctx, String(ui.watchSec), 195, y + 104, { size: 40, color: '#f07a22' });
      D.fillText(ctx, ui.watchLabel || '', 195, y + 138, { size: 13, weight: '700', color: '#6b3f1d' });
      return;
    }
    // mask
    ctx.fillStyle = ui.modal === 'share' ? 'rgba(20,12,4,0.55)' : 'rgba(40,22,8,0.45)';
    ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
    const ent = cardEnterT();
    ctx.save();
    ctx.translate(195, 0);
    ctx.translate(0, ent.ty);
    ctx.scale(ent.s, ent.s);
    ctx.translate(-195, 0);

    if (ui.modal === 'win' && ui.win) {
      const top = 236, h = 300, x = 22, w = 346;
      drawPanel(x, top, w, h);
      D.fillText(ctx, '过关！', 195, top + 50, {
        size: 38, color: '#f07a22', letterSpacing: 4,
        shadows: [{ x: 0, y: 3, color: '#fff3dc' }, { x: 0, y: 5, color: '#b65a1e' }],
      });
      const starsY = top + 110;
      for (let i = 0; i < 3; i++) {
        const delay = 0.25 + i * 0.17;
        const u = Math.max(0, Math.min(1, (now() - starPopT - delay) / 0.35));
        const pop = E.outBack(u);
        const sz = (i === 1 ? 66 : 58) * pop;
        const pic = im(i < ui.win.stars ? 'star-gold' : 'star-grey');
        const sx = 195 + (i - 1) * 64;
        const sy = starsY - (i === 1 ? 4 : 0);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate((-40 * (1 - u)) * Math.PI / 180);
        if (pic) ctx.drawImage(pic, -sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      }
      D.fillText(ctx, ui.win.stat, 195, top + 160, { size: 14, weight: '700', color: '#7a4a22' });
      const bw = 140, bh = 58, by = top + h - 34 - bh + 10;
      drawBtnImage('btn-primary', 195 - 10 - bw, by, bw, bh, ui.win.nextLabel, 'primary', 'win-next', 20);
      drawBtnImage('btn-secondary', 195 + 10, by, bw, bh, '回选关', 'secondary', 'win-select', 17);
    }

    if (ui.modal === 'fail' && ui.fail) {
      const actions = (ui.fail.canRevive ? 1 : 0) + (ui.fail.canShare ? 1 : 0);
      const short = actions === 0;
      const top = short ? 236 : (actions > 1 ? 160 : 200);
      const h = short ? 310 : (actions > 1 ? 470 : 400);
      const x = 22, w = 346;
      drawPanel(x, top, w, h);
      D.fillText(ctx, '差一点！', 195, top + 50, {
        size: 38, color: '#d94a3a', letterSpacing: 4,
        shadows: [{ x: 0, y: 3, color: '#fff3dc' }, { x: 0, y: 5, color: '#8e2a1e' }],
      });
      // reason
      const ry = top + 110;
      ctx.font = '900 18px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const a = ui.fail.mainPrefix, b = ui.fail.colorName, c = ui.fail.mainSuffix;
      const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width * (22 / 18), wc = ctx.measureText(c).width;
      const total = wa + wb + wc;
      let cx = 195 - total / 2;
      ctx.font = '900 18px sans-serif'; ctx.fillStyle = '#6b3f1d'; ctx.textAlign = 'left';
      ctx.fillText(a, cx, ry); cx += wa;
      ctx.font = '900 22px sans-serif'; ctx.fillStyle = ui.fail.color;
      ctx.fillText(b, cx, ry); cx += wb;
      ctx.font = '900 18px sans-serif'; ctx.fillStyle = '#6b3f1d';
      ctx.fillText(c, cx, ry);
      D.fillText(ctx, ui.fail.sub, 195, ry + 28, { size: 14, weight: '700', color: '#6b3f1d' });

      function drawFailAction(id, y, label, sub) {
        const bw = 230, bh = 80, bx = 80;
        const sc = isPressed(id) ? 0.94 : 1;
        ctx.save(); ctx.translate(bx + bw / 2, y + bh / 2); ctx.scale(sc, sc);
        const pic = im('btn-primary');
        if (pic) ctx.drawImage(pic, -bw / 2, -bh / 2, bw, bh);
        D.fillText(ctx, label, 0, -8, { size: 22, color: '#fff', shadows: [{ x: 0, y: 2, color: '#b8501a' }] });
        D.fillText(ctx, sub, 0, 16, { size: 11, weight: '700', color: '#fff6dc' });
        ctx.restore();
        pushBtn(id, bx, y, bw, bh);
        return y + 88;
      }
      let yb = top + 160;
      if (ui.fail.canRevive) yb = drawFailAction('fail-revive', yb, '看广告复活', '临时 +1 车位，接着玩');
      if (ui.fail.canShare) yb = drawFailAction('fail-share', yb, '分享好友', '本局解锁 1 个车位');
      const bw = 100, bh = 52;
      const by = top + h - 34 - bh + 8;
      const gap = 10, totalB = bw * 3 + gap * 2, sx = 195 - totalB / 2;
      drawBtnImage('btn-secondary', sx, by, bw, bh, '撤销', 'secondary', 'fail-undo', 16);
      drawBtnImage('btn-secondary', sx + bw + gap, by, bw, bh, '重来', 'secondary', 'fail-retry', 16);
      drawBtnImage('btn-secondary', sx + (bw + gap) * 2, by, bw, bh, '回选关', 'secondary', 'fail-select', 16);
    }

    if (ui.modal === 'intro' && ui.intro) {
      const top = 160, h = 470, x = 22, w = 346;
      drawPanel(x, top, w, h);
      D.fillText(ctx, '新元素', 195, top + 36, {
        size: 14, color: '#fff', letterSpacing: 4,
        shadows: [
          { x: -1, y: 0, color: '#e2462f' }, { x: 1, y: 0, color: '#e2462f' },
          { x: 0, y: -1, color: '#e2462f' }, { x: 0, y: 1, color: '#e2462f' },
          { x: 0, y: 1, color: '#8e2a1e' },
        ],
      });
      const introImg = im(ui.intro.img);
      if (introImg) {
        ctx.save();
        D.roundRect(ctx, 65, top + 50, 260, 195, 16);
        ctx.clip();
        ctx.drawImage(introImg, 65, top + 50, 260, 195);
        ctx.restore();
      }
      D.fillText(ctx, ui.intro.title, 195, top + 270, {
        size: 24, color: '#f07a22',
        shadows: [{ x: 0, y: 2, color: '#fff3dc' }, { x: 0, y: 3, color: '#b65a1e' }],
      });
      D.wrapText(ctx, ui.intro.text, 195, top + 300, 300, 22, { size: 15, weight: '700', color: '#6b3f1d' });
      drawBtnImage('btn-primary', 120, top + h - 90, 150, 58, '知道了', 'primary', 'intro-ok', 20);
    }

    if (ui.modal === 'share') {
      const top = 150, h = 480, x = 22, w = 346;
      drawPanel(x, top, w, h);
      const si = im('share-illu');
      if (si) {
        ctx.save();
        D.roundRect(ctx, 65, top + 36, 260, 195, 16);
        ctx.clip();
        ctx.drawImage(si, 65, top + 36, 260, 195);
        ctx.restore();
      }
      D.fillText(ctx, '分享给好友', 195, top + 255, {
        size: 24, color: '#f07a22',
        shadows: [{ x: 0, y: 2, color: '#fff3dc' }, { x: 0, y: 3, color: '#b65a1e' }],
      });
      D.wrapText(ctx, '每分享 1 次，本局多 1 个车位（每局最多 2 个）', 195, top + 285, 300, 22, { size: 15, weight: '700', color: '#6b3f1d' });
      if (ui.shareBusy) {
        const bob = Math.sin(t * (Math.PI * 2 / 0.6)) * 3;
        const sh = im('share');
        if (sh) ctx.drawImage(sh, 100, top + 350 + bob, 30, 30);
        D.fillText(ctx, '正在分享给好友…', 230, top + 365 + bob, { size: 16, color: '#2f8a2f' });
      } else {
        drawBtnImage('btn-primary', 50, top + h - 100, 140, 58, '分享', 'primary', 'share-ok', 20);
        drawBtnImage('btn-secondary', 200, top + h - 100, 140, 58, '取消', 'secondary', 'share-cancel', 17);
      }
    }
    ctx.restore();
  }

  function drawToast() {
    if (now() > toastUntil || !toastMsg) return;
    const w = Math.max(170, 40 + toastMsg.length * 16);
    const x = 195 - w / 2, y = 330, h = 40;
    const pill = im('pill');
    if (pill) ctx.drawImage(pill, x, y, w, h);
    D.fillText(ctx, toastMsg, 195, y + 20, { size: 16, color: '#c0392b' });
  }

  function render() {
    const t = now();
    buttons = [];
    const { W, H, dpr, scale, ox, oy } = layout;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // letterbox / blurred edges
    ctx.fillStyle = '#3a2c22';
    ctx.fillRect(0, 0, W, H);
    const bg = im('bg-play');
    if (bg) {
      ctx.save();
      try { ctx.filter = 'blur(18px) brightness(0.7)'; } catch (e) {}
      D.cover(ctx, bg, -20, -20, W + 40, H + 40);
      try { ctx.filter = 'none'; } catch (e) {}
      ctx.restore();
    }
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    // clip to stage
    ctx.beginPath(); ctx.rect(0, 0, C.STAGE_W, C.STAGE_H); ctx.clip();
    ctx.imageSmoothingEnabled = true;
    try { ctx.imageSmoothingQuality = 'high'; } catch (e) {}

    renderStage(t);
    ctx.restore();
  }

  function renderStage(t) {
    if (screen === 'health') drawHealth(t);
    else if (screen === 'start') drawStart(t);
    else if (screen === 'select') drawSelect(t);
    else if (screen === 'play' && G) drawPlay(t);
    else {
      ctx.fillStyle = '#d9c3a5'; ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
    }
    drawModal(t);
    drawToast();
    if (ui.ageInfo) drawAgeInfo();
    if (fade > 0) { ctx.fillStyle = `rgba(43,29,18,${fade})`; ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H); }
  }

  function goHealth() { screen = 'health'; }
  function goStart() { screen = 'start'; }

  function openClub() {
    env.openGameClub(C.GAME_CLUB_OPENLINK).catch((err) => {
      const code = err && (err.errCode != null ? err.errCode : err.code);
      if (code === -7) return;
      if (code === -3) toast('请在微信里打开游戏圈');
      else if (code === -2) toast('微信版本过低');
      else if (code === -1) toast('游戏圈链接未配置');
      else toast('游戏圈暂时打不开');
    });
  }
  function goSelect() { screen = 'select'; }
  function goPlay(idx) { startLevel(idx); screen = 'play'; }

  function makeOffscreen(w, h) {
    let c = null;
    if (typeof document !== 'undefined' && document.createElement) c = document.createElement('canvas');
    else if (typeof wx !== 'undefined' && typeof wx.createCanvas === 'function') c = wx.createCanvas();
    if (!c) throw new Error('无法创建离屏 Canvas');
    c.width = w; c.height = h;
    return c;
  }

  function screenshotStage() {
    const prev = ctx;
    const prevButtons = buttons;
    const off = makeOffscreen(C.STAGE_W * 2, C.STAGE_H * 2);
    const octx = off.getContext('2d');
    ctx = octx;
    buttons = [];
    octx.setTransform(2, 0, 0, 2, 0, 0);
    octx.imageSmoothingEnabled = true;
    try { octx.imageSmoothingQuality = 'high'; } catch (e) {}
    try { renderStage(now()); }
    finally { ctx = prev; buttons = prevButtons; }
    return off.toDataURL('image/png');
  }

  function dbgClear() { fade = 0; toastMsg = ''; toastUntil = 0; hideCards(); ui.shareBusy = false; ui.watchDone = null; }

  function dbgEnsurePlay(idx) {
    dbgClear();
    if (!G || (idx != null && G.idx !== idx)) startLevel(idx == null ? 0 : idx);
    screen = 'play';
    if (ui.modal === 'intro') { ui.modal = null; ui.intro = null; if (G) G.lockUntil = 0; }
  }

  function onButton(id) {
    if (id === 'btn-age-badge') { ui.ageInfo = true; return; }
    if (id === 'btn-age-close') { ui.ageInfo = false; return; }
    if (id === 'btn-health-enter') { fadeSwap(() => goStart()); return; }
    if (id === 'btn-start') {
      fadeSwap(() => goPlay(Math.min(progress.unlocked, LEVELS.length) - 1));
      return;
    }
    if (id === 'btn-select') { goSelect(); return; }
    if (id === 'btn-club') { openClub(); return; }
    if (id === 'sel-back') { goStart(); return; }
    if (id && id.indexOf('lv-') === 0) {
      const i = +id.slice(3);
      const playable = i <= LEVELS.length;
      const open = playable && i <= progress.unlocked;
      if (open) fadeSwap(() => goPlay(i - 1));
      else toast(playable ? '先通过上一关' : '第 ' + i + ' 关尚未开放');
      return;
    }
    if (id === 'play-back') { cancelAll(); hideCards(); G = null; goSelect(); return; }
    if (id === 'btn-undo' || id === 'fail-undo') { requestUndo(); return; }
    if (id === 'btn-retry' || id === 'fail-retry') { if (G) fadeSwap(() => startLevel(G.idx, 'retry')); return; }
    if (id === 'win-next') {
      if (!G) return;
      if (G.idx + 1 >= LEVELS.length) { toast('更多关卡敬请期待'); return; }
      const n = G.idx + 1; fadeSwap(() => startLevel(n)); return;
    }
    if (id === 'win-select' || id === 'fail-select') { hideCards(); cancelAll(); G = null; goSelect(); return; }
    if (id === 'fail-revive') { if (!G || G.revived) return; watchAd('看完复活：临时 +1 车位', () => { addTempSpot(); }); return; }
    if (id === 'fail-share') { askShare(); return; }
    if (id === 'intro-ok') { closeIntro(); return; }
    if (id === 'share-ok') { confirmShare(); return; }
    if (id === 'share-cancel') { cancelShare(); return; }
    if (id && id.indexOf('lock-') === 0) {
      if (!G || (G.ended && G.state.over === 'win')) return;
      askShare();
    }
  }

  function findBtn(x, y) {
    for (let i = buttons.length - 1; i >= 0; i--) {
      const b = buttons[i];
      if (D.hit(x, y, b)) return b;
    }
    return null;
  }
  function findVeh(x, y) {
    if (!G || screen !== 'play' || ui.modal) return null;
    const t = now();
    // topmost first
    const list = G.veh.slice().sort((a, b) => b.z - a.z);
    for (const e of list) {
      if (G.state.veh[e.id].where !== 'lot') continue;
      if (D.vehContains(e, x - fieldOx, y - fieldOy, t)) return e;
    }
    return null;
  }

  let downVeh = null;
  function onPointerDown(x, y) {
    pressStart = { x, y, t: now() };
    if (ui.modal === 'watch') return;
    const b = findBtn(x, y);
    if (b) { pressed = b.id; return; }
    const e = findVeh(x, y);
    if (e) { downVeh = e; e.lift = 1.07; pressed = 'veh-' + e.id; }
  }
  function onPointerMove(x, y) {
    if (downVeh) {
      const dist = Math.hypot(x - pressStart.x, y - pressStart.y);
      if (dist > 40) { downVeh.lift = 1; downVeh = null; pressed = null; }
    }
  }
  function onPointerUp(x, y) {
    if (downVeh) { downVeh.lift = 1; }
    const veh = downVeh; downVeh = null;
    const id = pressed; pressed = null;
    if (ui.modal === 'watch') return;
    if (veh && Math.hypot(x - pressStart.x, y - pressStart.y) < 40) { onTap(veh.id); return; }
    const b = findBtn(x, y);
    if (b && b.id === id) onButton(b.id);
  }
  function onPointerCancel() {
    if (downVeh) downVeh.lift = 1;
    downVeh = null; pressed = null;
  }

  env.onTouch({
    start(e) { const t = e.changedTouches[0]; const p = toLogical(t); onPointerDown(p.x, p.y); },
    move(e) { const t = e.changedTouches[0]; const p = toLogical(t); onPointerMove(p.x, p.y); },
    end(e) { const t = e.changedTouches[0]; const p = toLogical(t); onPointerUp(p.x, p.y); },
    cancel() { onPointerCancel(); },
  });

  let running = false;
  function frame() {
    clock.pump();
    if (G) refreshSpots(now());
    render();
    if (running) env.raf(frame);
  }
  function start() {
    resize();
    running = true;
    screen = 'health';
    analytics.gameOpen();
    env.raf(frame);
  }

  return {
    start, resize, ASSET_LIST,
    // 调试钩子（开发者工具 Console 可用；备案截图页也会调用）
    debug: {
      get G() { return G; },
      levels: LEVELS,
      tap: onTap,
      goHealth: () => { dbgClear(); G = null; goHealth(); },
      goStart: () => { dbgClear(); G = null; goStart(); },
      goSelect: () => { dbgClear(); G = null; goSelect(); },
      startLevel: (i) => { fade = 0; startLevel(i); screen = 'play'; },
      setProgress: (p) => {
        if (!p || typeof p !== 'object') return progress;
        if (p.unlocked != null) progress.unlocked = p.unlocked;
        if (p.stars) progress.stars = Object.assign({}, p.stars);
        return progress;
      },
      showWin: () => {
        dbgEnsurePlay();
        ui.modal = 'win';
        cardAnimT = now() - 1;
        starPopT = now() - 2;
        ui.win = { stars: 3, stat: '最高连发 ×2 · 撤销 0 次', last: false, nextLabel: '下一关' };
      },
      showFail: () => {
        dbgEnsurePlay(1);
        const c = (G && L.headColor(G.state)) || 'A';
        const n = (G && L.headSize(G.state)) || 1;
        const who = n > 1 ? (n + '人团') : '';
        ui.modal = 'fail';
        cardAnimT = now() - 1;
        ui.fail = {
          mainPrefix: '车位满了，队首要的是 ',
          colorName: C.CNAME[c], color: C.CCOL[c],
          mainSuffix: ' 色' + who,
          sub: '停着的车里没有' + C.CNAME[c] + '色车',
          canRevive: true, canShare: true, short: false,
        };
      },
      showShare: () => {
        dbgEnsurePlay(1);
        ui.modal = 'share';
        ui.shareBusy = false;
        cardAnimT = now() - 1;
      },
      showWatch: (label) => {
        dbgEnsurePlay();
        ui.modal = 'watch';
        ui.watchLabel = label || '看完复活：临时 +1 车位';
        ui.watchSec = C.PLACEHOLDER_AD_SEC;
        ui.watchDone = null;
        ui.watchStart = now() + 1e6;
      },
      showIntro: () => {
        fade = 0;
        if (!G || !G.level || !G.level.intro) startLevel((G && G.idx === 8) ? 8 : 4);
        screen = 'play';
        if (G && G.level && G.level.intro) showIntro(G.level.intro, G.idx);
        cardAnimT = now() - 1;
      },
      screenshotStage,
      version: C.VERSION,
      progress: () => progress,
      spots: () => G && G.state.spots.length,
      screen: () => screen,
    },
  };
}

module.exports = { createGame, ASSET_LIST, assetSrc };

});

define("./game", function(require, module, exports) {
/* 对号发车 — 微信小游戏入口 */
'use strict';

const env = require('./js/env');
const C = require('./js/config');
const { createGame, ASSET_LIST, assetSrc } = require('./js/app');

env.keepScreenOn();
env.setFPS(60);

const canvas = env.getCanvas();
const ctx = canvas.getContext('2d');

function paintLoading(done, total, err) {
  const info = env.getWindowInfo();
  const W = info.windowWidth, H = info.windowHeight, dpr = Math.max(1, info.pixelRatio || 2);
  canvas.width = Math.max(1, Math.round(W * dpr));
  canvas.height = Math.max(1, Math.round(H * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#3a2c22';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff7e6';
  ctx.font = '900 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('对号发车', W / 2, H / 2 - 40);
  ctx.font = '700 14px sans-serif';
  ctx.fillStyle = '#e8d2b0';
  ctx.fillText(err ? ('加载失败：' + err) : '正在上车…', W / 2, H / 2);
  const bw = Math.min(240, W * 0.6), bh = 10;
  const x = (W - bw) / 2, y = H / 2 + 28;
  ctx.fillStyle = 'rgba(255,247,230,0.2)';
  ctx.fillRect(x, y, bw, bh);
  const p = total ? done / total : 0;
  ctx.fillStyle = '#f07a22';
  ctx.fillRect(x, y, bw * p, bh);
  ctx.fillStyle = '#fff7e6';
  ctx.font = '700 12px sans-serif';
  ctx.fillText(Math.round(p * 100) + '%', W / 2, y + 24);
}

function loadAll() {
  const assets = {};
  let done = 0;
  const total = ASSET_LIST.length;
  paintLoading(0, total);
  return new Promise((resolve, reject) => {
    let failed = 0;
    const next = () => {
      done++;
      paintLoading(done, total, failed ? (failed + ' 张图未加载') : null);
      if (done >= total) resolve(assets);
    };
    ASSET_LIST.forEach((name) => {
      env.loadImage(assetSrc(name)).then((img) => {
        assets[name] = img;
        next();
      }).catch((e) => {
        failed++;
        console.warn(e && e.message ? e.message : e);
        next();
      });
    });
  });
}

loadAll().then((assets) => {
  const game = createGame(canvas, assets);
  env.onResize(() => game.resize());
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => game.resize());
  }
  game.start();
  // 方便在微信开发者工具 Console 里调关、查状态
  const g = (typeof GameGlobal !== 'undefined') ? GameGlobal : (typeof global !== 'undefined' ? global : {});
  g.DH = game.debug;
  g.__duihao = { version: C.VERSION, appid: 'wx3fad237336dba3ba' };
  if (C.CAPTURE_MODE) require('./js/capture-devtools')(canvas, game.debug);
}).catch((err) => {
  console.error(err);
  paintLoading(0, 1, String(err && err.message || err));
});

});


req('./game', './game');
})();
