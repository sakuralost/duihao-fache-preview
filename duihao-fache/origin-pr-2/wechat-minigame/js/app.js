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
  let selectPage = 0;
  const SELECT_PER = 20;
  const tintCache = {};
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
  function dispN() {
    const base = (G && G.baseSpots) || L.BASE_SPOTS;
    return base + C.MAX_EXTRA + (G && G.tempSpot >= 0 ? 1 : 0);
  }
  function spotW() { return dispN() > 5 ? 52 : 58; }
  function spotX(i) {
    const n = dispN(), w = spotW(), gap = n > 5 ? 5 : 8, total = n * w + (n - 1) * gap;
    return 195 - total / 2 + i * (w + gap) + w / 2;
  }
  function slotPos(k) { return { x: C.HEAD_X + k * C.PAX_SP, y: C.FEET_Y }; }
  function groupSizeAt(i) {
    const gid = G.state.gid, gsz = G.state.gsz;
    let j = i;
    while (j > 0 && gid[j] === gid[j - 1]) j--;
    return gsz[j] || 1;
  }
  function queueGap(i) {
    if (i <= 0) return C.PAX_SP;
    if (G.state.gid[i] === G.state.gid[i - 1]) return C.PAX_SP;
    if (groupSizeAt(i - 1) > 1 || groupSizeAt(i) > 1) return C.PAX_SP + C.PAX_GROUP_GAP;
    return C.PAX_SP;
  }
  // 同组紧凑，组与组（以及团与单个乘客）之间留出明显空隙。可见人数随空隙收缩，避免窄屏溢出。
  function computeQueueXs(head) {
    const qlen = G.state.q.length;
    const X0 = C.HEAD_X;
    const limit = 318;
    const xs = new Array(qlen).fill(X0);
    let x = X0, count = 0;
    const maxCount = Math.min(C.VISIBLE, Math.max(0, qlen - head));
    for (let k = 0; k < maxCount; k++) {
      const i = head + k;
      const nx = k === 0 ? X0 : x + queueGap(i);
      if (k > 0 && G.state.gid[i] !== G.state.gid[i - 1]) {
        let end = nx;
        const sz = groupSizeAt(i);
        for (let t = 1; t < sz; t++) end += C.PAX_SP;
        if (end > limit && count >= 4) break;
      }
      if (nx > limit && count >= 4) break;
      x = Math.min(nx, limit);
      xs[i] = x;
      count++;
    }
    let edge = count ? xs[head + count - 1] : X0;
    for (let i = head + count; i < qlen; i++) {
      edge += queueGap(i);
      xs[i] = edge;
    }
    G.queueXs = xs;
    G.queueShown = count;
    G.moreX = Math.min(352, (count ? xs[head + count - 1] : X0) + 22);
    return xs;
  }
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
    const nSpots = L.defaultSpots(level, idx);
    const state = L.init(level, nSpots);
    G = {
      idx, level, state, history: [], veh: [], pax: [], spots: [], counters: [],
      visHead: 0, boardCursor: 0, arriveAt: {}, lastBoardEnd: {}, spotFreeAt: [],
      busyUntil: 0, chain: 0, lastDepartT: -9, lastDepartChain: -1, combo: 0, maxCombo: 0,
      undoFree: 2, undoUsed: 0, lockUntil: 0, ended: false, tutorial: !!level.tutorial,
      tempSpot: -1, revived: false, shareUnlocked: 0, sharedOnce: false, lockEls: [], groups: [],
      road: { dep: [], arr: [] }, fx: [], headMark: { visible: false, wait: false, text: '队首', color: '#b0561c' },
      more: '', handTarget: null, counterLeft: {},
      baseSpots: nSpots, layoutGen: 0, depVis: 0, queueXs: null, queueShown: C.VISIBLE, moreX: 0,
    };
    fieldOx = fieldOy = 0; rewinding = false; hideCards();
    fade = Math.max(fade, 0);
    ui.levelTitle = `第 ${idx + 1} 关 · ${level.name}`;
    for (let i = 0; i < state.spots.length; i++) makeSpot('open');
    for (let i = 0; i < C.MAX_EXTRA; i++) makeLocked();
    placeSpots(0);
    state.veh.forEach(v => {
      const h = v.len * C.CELL - 6;
      const e = new Ent(C.VEH_W, h, 'veh');
      const cpos = cellCenter(v);
      e.x = cpos.x; e.y = cpos.y; e.rot = C.DIR_ROT[v.dir];
      e.revealed = !v.m; e.len = v.len; e.id = v.id; e.c = v.c;
      e.block = !!v.block;
      e.cycle = !!v.cycle;
      e.iceVis = v.ice || 0;
      e.thawUntil = 0;
      e.seatShown = 0;
      e.cycling = false;
      e.imgKey = (v.block || v.m) ? 'mystery' : busImg(v);
      e.mys = !!v.m && !v.block; e.z = 10 + v.y;
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

  function spotRewardLeft() {
    return !!(G && G.shareUnlocked < C.MAX_EXTRA && G.lockEls.length);
  }
  function rewardLabel(purpose) {
    return purpose === 'revive' ? '看完复活：临时 +1 车位' : '看完解锁 1 个车位';
  }
  function grantReward(purpose) {
    if (purpose === 'revive') addTempSpot();
    else unlockSpot();
  }
  // 本局还没成功分享过：开车位、复活都可以选分享或广告。分享成功一次之后，这两件事只能看广告。
  function offerReward(purpose, returnTo) {
    if (!G) return;
    if (purpose === 'spot' && !spotRewardLeft()) { toast('本局车位已全部解锁'); return; }
    if (purpose === 'revive' && G.revived) return;
    ui.rewardPurpose = purpose;
    ui.rewardReturn = returnTo || null;
    if (!G.sharedOnce) {
      ui.modal = 'share';
      ui.shareBusy = false;
      cardAnimT = now();
      return;
    }
    watchAd(rewardLabel(purpose), () => grantReward(purpose));
  }
  function closeRewardChoice() {
    ui.shareBusy = false;
    if (ui.rewardReturn === 'fail' && ui.fail) ui.modal = 'fail';
    else ui.modal = null;
  }
  function askShare() { offerReward('spot', null); }
  function cancelShare() { closeRewardChoice(); }
  function finishShare(ok) {
    ui.modal = null;
    ui.shareBusy = false;
    ui.rewardReturn = null;
    if (!ok) { toast('分享未完成'); return; }
    if (G) G.sharedOnce = true;
    grantReward(ui.rewardPurpose === 'revive' ? 'revive' : 'spot');
  }
  function confirmShare() {
    if (!G || G.sharedOnce) { toast('本局已经分享过，请看广告'); return; }
    ui.shareBusy = true;
    const opt = { title: C.SHARE_TITLE, imageUrl: C.SHARE_IMAGE };
    const used = env.shareAppMessage(opt);
    if (used) {
      hideAt = Date.now();
      sharePending = finishShare;
    } else {
      const t = now();
      at(t + 2, () => finishShare(true));
    }
  }
  function confirmRewardAd() {
    const purpose = ui.rewardPurpose === 'revive' ? 'revive' : 'spot';
    ui.modal = null;
    ui.shareBusy = false;
    ui.rewardReturn = null;
    watchAd(rewardLabel(purpose), () => grantReward(purpose));
  }

  function ensureAd() {
    if (videoAd || !C.AD_UNIT_ID) return videoAd;
    videoAd = env.createRewardedVideoAd(C.AD_UNIT_ID);
    if (videoAd && videoAd.onError) {
      try { videoAd.onError(() => { toast('广告暂时无法播放'); }); } catch (e) {}
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
      const fail = () => {
        try { if (ad.offClose) ad.offClose(onClose); } catch (e) {}
        toast('广告暂时无法播放，请稍后再试');
      };
      const show = () => {
        Promise.resolve(ad.show()).catch(() => {
          if (ad.load) return Promise.resolve(ad.load()).then(() => ad.show());
          throw new Error('no load');
        }).catch(fail);
      };
      show();
      return;
    }
    if (!C.AD_UNIT_ID) { openWatch(label, done); return; }
    toast('广告还没准备好');
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
    const xs = computeQueueXs(head);
    const shown = G.queueShown;
    const gen = ++G.layoutGen;
    const tAnim = t0 == null ? now() : t0;
    G.pax.forEach((e, i) => {
      if (e.walking || e.gone) return;
      const k = i - head; if (k < 0) return;
      const p = { x: xs[i], y: C.FEET_Y };
      const wasVisible = e.visible;
      if (k >= shown) { e.visible = false; e.x = p.x; e.y = p.y; return; }
      e.visible = true;
      if (!animate || !wasVisible) {
        if (!wasVisible && animate) {
          const from = p.x + (queueGap(i) || C.PAX_SP);
          e.x = from; e.alpha = 0;
          add(tAnim, 0.18, u => {
            if (G.layoutGen !== gen) return;
            e.alpha = u; e.x = lerp(from, p.x, E.outQ(u));
          });
        } else { e.x = p.x; e.y = p.y; }
        return;
      }
      const sx0 = e.x;
      if (Math.abs(sx0 - p.x) < 0.5) { e.y = p.y; return; }
      add(tAnim, 0.16, u => {
        if (G.layoutGen !== gen) return;
        e.x = lerp(sx0, p.x, E.outQ(u));
        e.oy = -Math.sin(u * Math.PI) * 2.5;
      });
    });
    const rem = G.pax.length - head;
    G.headMark.visible = rem > 0;
    G.more = rem > shown ? `+${rem - shown}` : '';
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
      e.glow = !s.over && !v.block && v.where === 'lot' && mov.has(i) && v.c === h;
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
    // 上车动画进行时也允许点其他车。逻辑在点击时立刻结算，动画只是把结果演出来。
    if (v.block && (s.departed || 0) < (v.tow || 0)) {
      toast('还要再发 ' + ((v.tow || 0) - (s.departed || 0)) + ' 辆才能拖走');
      return;
    }
    if (!v.block && v.ice > 0) {
      toast('冰还没化（还差 ' + v.ice + ' 辆）');
      bump(id, id, t);
      return;
    }
    const b = L.blocker(s, id);
    if (b === -2) { toast('闸门还关着'); bump(id, id, t); return; }
    if (b >= 0) { bump(id, b, t); return; }
    if (!v.block && L.freeSpot(s) < 0) { toast('车位已满'); return; }
    G.history.push(L.clone(s));
    const r = L.tap(s, id);
    if (!r.ok) { G.history.pop(); return; }
    G.chain++;
    if (G.tutorial) { G.tutorial = false; G.handTarget = null; }
    syncMechanicVisuals();
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
      else if (ev.t === 'tow') scheduleTow(ev.v, t);
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
      e.seatShown = Math.max(0, v.cap - left);
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
    if (chain === G.lastDepartChain || td - G.lastDepartT <= C.COMBO_WINDOW) G.combo++; else G.combo = 1;
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
  function scheduleTow(id, t) {
    const e = G.veh[id], v = G.state.veh[id];
    const [dx, dy] = L.DIRV[v.dir] || [0, -1];
    const x0 = e.x, y0 = e.y;
    const x1 = x0 + dx * 300, y1 = y0 + dy * 300;
    e.z = 210; e.idle = false;
    burstAt(x0, y0, 76, 0.4);
    add(t, 0.55, u => {
      const k = E.inQ(u);
      e.x = lerp(x0, x1, k);
      e.y = lerp(y0, y1, k);
      e.alpha = u < 0.72 ? 1 : 1 - (u - 0.72) / 0.28;
    }, () => { e.visible = false; e.alpha = 1; });
    G.busyUntil = Math.max(G.busyUntil, t + 0.55);
  }
  function syncMechanicVisuals() {
    if (!G) return;
    const t = now();
    G.state.veh.forEach((v, i) => {
      const e = G.veh[i];
      if (!e) return;
      if (v.cycle && v.where === 'lot' && e.c !== v.c && !e.cycling) {
        e.cycling = true;
        add(t, 0.2, u => { e.sx = 1 - u; }, () => { e.c = v.c; e.imgKey = busImg(v); e.mys = false; });
        add(t + 0.2, 0.22, u => { e.sx = E.outBack(u); }, () => { e.sx = 1; e.cycling = false; });
        burstAt(e.x, e.y, 72, 0.4);
      }
      if ((e.iceVis || 0) !== (v.ice || 0)) {
        const prev = e.iceVis || 0;
        e.iceVis = v.ice || 0;
        if (prev > 0 && !v.ice) e.thawUntil = t + 0.32;
        burstAt(e.x, e.y - 8, 60, 0.35);
      }
    });
    const dep = G.state.departed || 0;
    if (dep !== (G.depVis || 0)) {
      const prev = G.depVis || 0;
      G.depVis = dep;
      (G.state.gates || []).forEach(g => {
        if (prev < g.open && dep >= g.open) {
          g.fadeAt = t;
          burstAt(C.LOT_X + (g.x + 0.5) * C.CELL, C.LOT_Y + (g.y + 0.5) * C.CELL, 70, 0.4);
        }
      });
    }
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
    // 过关 1 星；没撤销、没复活、没分享加车位再 +1；本局最高连发 ≥ 4 再 +1。
    let s = 1;
    const clean = G.undoUsed === 0 && !G.revived && !(G.shareUnlocked > 0);
    if (clean) s++;
    if ((G.maxCombo || 0) >= 4) s++;
    return s;
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
        stat: `最高连发 ×${Math.max(1, G.maxCombo)} · 撤销 ${G.undoUsed} 次${G.revived ? ' · 复活 1 次' : ''}${G.shareUnlocked ? ' · 加过车位' : ''}`,
        hint: '三星：不撤销、不复活、不分享加车位，且连发达到 4',
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
      ui.fail = {
        mainPrefix, colorName: C.CNAME[c], color: C.CCOL[c], mainSuffix, sub,
        canRevive, canShare, sharedOnce: !!G.sharedOnce,
        short: !canRevive && !canShare,
      };
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
      e.seatShown = v.where === 'spot' ? v.filled : 0;
      e.c = v.c;
      e.iceVis = v.ice || 0;
      e.thawUntil = 0;
      e.cycling = false;
      e.block = !!v.block;
      if (v.block) { e.imgKey = 'mystery'; e.mys = false; e.visible = v.where !== 'gone'; }
      else if (!v.m) { e.imgKey = busImg(v); e.mys = false; }
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
    G.depVis = prev.departed || 0;
    (G.state.gates || []).forEach(g => { g.fadeAt = 0; });
    const xsUndo = computeQueueXs(prev.qi);
    G.pax.forEach((P, i) => {
      P.walking = false; P.paxFrame = 0; P.flip = C.PAX_FLIP_IDLE; P.sx = P.sy = 1; P.oy = 0; P.idle = true; P.z = 500 - i;
      if (i < prev.qi) { P.visible = false; P.gone = true; return; }
      const k = i - prev.qi; const p = { x: xsUndo[i], y: C.FEET_Y };
      if (k >= G.queueShown) { P.visible = false; P.gone = false; P.x = p.x; P.y = p.y; return; }
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
    const pages = Math.max(1, Math.ceil(LEVELS.length / SELECT_PER));
    if (selectPage >= pages) selectPage = pages - 1;
    if (selectPage < 0) selectPage = 0;
    const pageStart = selectPage * SELECT_PER;
    const pageEnd = Math.min(LEVELS.length, pageStart + SELECT_PER);
    D.fillText(ctx, '第 ' + (pageStart + 1) + '–' + pageEnd + ' 关', 195, 74, {
      size: 15, color: '#fff',
      shadows: [{ x: 0, y: 1, color: 'rgba(80,30,0,.8)' }],
    });
    const gridLeft = 22, gridTop = 96, gapX = 10, colW = (346 - 3 * gapX) / 4;
    for (let n = 0; n < pageEnd - pageStart; n++) {
      const i = pageStart + n + 1;
      const col = n % 4, row = Math.floor(n / 4);
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
    if (selectPage > 0) drawBtnImage('btn-secondary', 16, 676, 108, 52, '上一页', 'secondary', 'sel-prev', 16);
    if (selectPage < pages - 1) drawBtnImage('btn-secondary', 266, 676, 108, 52, '下一页', 'secondary', 'sel-next', 16);
    D.fillText(ctx, (selectPage + 1) + ' / ' + pages, 195, 702, {
      size: 14, color: '#fff',
      shadows: [{ x: 0, y: 1, color: 'rgba(0,0,0,.7)' }],
    });
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
    const vst = G && G.state && G.state.veh[e.id];
    const frozen = vst && !e.block && (vst.ice > 0 || (e.thawUntil && t < e.thawUntil));
    if (frozen) {
      const tint = icedSprite(e.imgKey);
      let a = vst.ice > 0 ? 0.72 : Math.max(0, (e.thawUntil - t) / 0.32);
      if (tint) {
        ctx.globalAlpha = e.alpha * a;
        ctx.drawImage(tint, -e.w / 2, -e.h / 2, e.w, e.h);
      }
    }
    // arrow
    const towReady = e.block && vst && (G.state.departed || 0) >= (vst.tow || 0);
    const arrowA = (e.parked || (e.block && !towReady)) ? 0 : 1;
    if (arrowA > 0.02) {
      const ap = im('arrow');
      if (ap) {
        ctx.globalAlpha = e.alpha * arrowA;
        const ay = e.mys ? -e.h * 0.26 : 0;
        ctx.drawImage(ap, -11, ay - 10, 22, 24);
      }
    }
    // 车身不再画 A/B/C/D。颜色靠巴士贴图；队列和失败说明用「蓝/橙/紫/绿」。容量牌子单独画。
    drawVehiclePlates(e, t);
    ctx.restore();
  }

  function icedSprite(key) {
    const cacheKey = 'ice:' + key;
    if (tintCache[cacheKey]) return tintCache[cacheKey];
    const src = im(key);
    if (!src) return null;
    try {
      const c = makeOffscreen(src.width || 64, src.height || 128);
      const g = c.getContext('2d');
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(186, 226, 255, 0.55)';
      g.fillRect(0, 0, c.width, c.height);
      tintCache[cacheKey] = c;
      return c;
    } catch (err) { return null; }
  }

  function drawVehiclePlates(e, t) {
    const v = G && G.state && G.state.veh[e.id];
    if (!v) return;
    ctx.save();
    ctx.globalAlpha = e.alpha;
    if (e.block) {
      ctx.translate(0, e.h / 2 - 16);
      ctx.rotate(-e.rot * Math.PI / 180);
      const ready = (G.state.departed || 0) >= (v.tow || 0);
      const label = ready ? '拖走' : ('故障' + Math.max(0, (v.tow || 0) - (G.depVis || 0)));
      const w = ready ? 40 : 48;
      const pill = im('pill');
      if (pill) ctx.drawImage(pill, -w / 2, -10, w, 20);
      D.fillText(ctx, label, 0, 0, { size: 11, color: '#6b3f1d' });
      ctx.restore();
      return;
    }
    const cap = v.cap || 4;
    const filled = e.seatShown || 0;
    const label = filled > 0 ? (filled + '/' + cap) : (cap + '座');
    const w = label.length >= 4 ? 46 : 40;
    // 原来车尾字母圆牌的位置：本地坐标 +y 是车尾，再把牌子转正。
    ctx.save();
    ctx.translate(0, e.h / 2 - 16);
    ctx.rotate(-e.rot * Math.PI / 180);
    const pill = im('pill');
    if (pill) ctx.drawImage(pill, -w / 2, -9, w, 18);
    D.fillText(ctx, label, 0, 0, {
      size: 11,
      color: filled > 0 ? (C.CCOL[v.c] || '#6b3f1d') : '#6b3f1d',
    });
    ctx.restore();
    if (e.cycle && v.where === 'lot') {
      ctx.save();
      ctx.translate(e.w / 2 + 2, -8);
      ctx.rotate(-e.rot * Math.PI / 180);
      const bd = im('badge');
      if (bd) ctx.drawImage(bd, -11, -11, 22, 22);
      D.fillText(ctx, '变', 0, 0, { size: 11, color: '#e2462f' });
      ctx.restore();
    }
    if ((e.iceVis || 0) > 0) {
      ctx.save();
      ctx.translate(0, e.h / 2 - 40);
      ctx.rotate(-e.rot * Math.PI / 180);
      const ip = im('pill');
      if (ip) ctx.drawImage(ip, -22, -9, 44, 18);
      D.fillText(ctx, '冰' + e.iceVis, 0, 0, { size: 11, color: '#1d4e89' });
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
    if (G.state && G.state.gates) {
      G.state.gates.forEach(g => {
        const left = Math.max(0, g.open - (G.depVis || 0));
        const opening = g.fadeAt && t - g.fadeAt < 0.35;
        if (left <= 0 && !opening) return;
        const u = opening ? Math.min(1, (t - g.fadeAt) / 0.35) : 0;
        const alpha = 1 - u;
        if (alpha <= 0.02) return;
        const x = C.LOT_X + g.x * C.CELL, y = C.LOT_Y + g.y * C.CELL;
        ctx.save();
        ctx.globalAlpha = alpha;
        const pic = im('tile-spot-locked');
        if (pic) ctx.drawImage(pic, x + 3, y + 3, C.CELL - 6, C.CELL - 6);
        const pill = im('pill');
        if (pill) ctx.drawImage(pill, x + 2, y + 13, C.CELL - 4, 18);
        D.fillText(ctx, left > 0 ? ('闸' + left) : '开', x + C.CELL / 2, y + 22, { size: 11, color: '#6b3f1d' });
        ctx.restore();
      });
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
        D.fillText(ctx, (G && G.sharedOnce) ? '广告解锁' : '分享解锁', 0, d.h / 2 - 14 + bob, {
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
      D.fillText(ctx, G.more, G.moreX || (C.HEAD_X + C.VISIBLE * C.PAX_SP - 8), C.FEET_Y - 48, {
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
    drawGameName(195, 802, 13);
    D.fillText(ctx, '三星需连发≥4', 195, 776, {
      size: 11, weight: '700', color: '#fff6dc',
      shadows: [{ x: 0, y: 1, color: 'rgba(60,30,0,.85)' }],
    });

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

  function drawIntroDemo(kind, x, y, w, h) {
    ctx.save();
    D.roundRect(ctx, x, y, w, h, 16);
    ctx.clip();
    ctx.fillStyle = '#f6e6c8';
    ctx.fillRect(x, y, w, h);
    const lot = im('tile-lot');
    if (lot) {
      for (let i = 0; i < 3; i++) ctx.drawImage(lot, x + 16 + i * 48, y + 78, 44, 44);
    }
    if (kind === 'cycle') {
      ['bus-a', 'bus-b', 'bus-c', 'bus-d'].forEach((k, i) => {
        const pic = im(k);
        const cx = x + 40 + i * 60;
        if (pic) ctx.drawImage(pic, cx - 16, y + 28, 32, 78);
        if (i < 3) D.fillText(ctx, '→', cx + 30, y + 70, { size: 16, color: '#a0521c' });
      });
      const bd = im('badge');
      if (bd) ctx.drawImage(bd, x + 28, y + 18, 22, 22);
      D.fillText(ctx, '变', x + 39, y + 29, { size: 12, color: '#e2462f' });
    } else if (kind === 'ice') {
      const bus = im('bus-a');
      if (bus) ctx.drawImage(bus, x + 48, y + 36, 40, 100);
      const tint = icedSprite('bus-a');
      if (tint) ctx.drawImage(tint, x + 48, y + 36, 40, 100);
      const pill = im('pill');
      if (pill) ctx.drawImage(pill, x + 36, y + 28, 64, 22);
      D.fillText(ctx, '冰2', x + 68, y + 39, { size: 13, color: '#1d4e89' });
      const other = im('bus-b');
      if (other) ctx.drawImage(other, x + 150, y + 48, 36, 88);
      D.fillText(ctx, '先发走这辆', x + 168, y + 150, { size: 13, color: '#6b3f1d' });
    } else if (kind === 'tow') {
      const cov = im('mystery');
      if (cov) ctx.drawImage(cov, x + 54, y + 40, 44, 96);
      const pill = im('pill');
      if (pill) ctx.drawImage(pill, x + 40, y + 28, 72, 22);
      D.fillText(ctx, '故障2', x + 76, y + 39, { size: 13, color: '#6b3f1d' });
      const arrow = im('arrow');
      if (arrow) ctx.drawImage(arrow, x + 150, y + 70, 28, 32);
      D.fillText(ctx, '发够就能拖走', x + 168, y + 150, { size: 13, color: '#6b3f1d' });
    } else if (kind === 'gate') {
      const bus = im('bus-c');
      if (bus) ctx.drawImage(bus, x + 70, y + 70, 36, 90);
      const gate = im('tile-spot-locked');
      if (gate) ctx.drawImage(gate, x + 78, y + 36, 52, 52);
      const pill = im('pill');
      if (pill) ctx.drawImage(pill, x + 70, y + 48, 68, 22);
      D.fillText(ctx, '闸2', x + 104, y + 59, { size: 13, color: '#6b3f1d' });
      D.fillText(ctx, '发够车数自己开', x + 150, y + 160, { size: 13, color: '#6b3f1d' });
    }
    ctx.restore();
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
      const top = 180, h = 450, x = 22, w = 346;
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
      D.fillText(ctx, ui.win.stat, 195, top + 158, { size: 14, weight: '700', color: '#7a4a22' });
      if (ui.win.hint) {
        D.wrapText(ctx, ui.win.hint, 195, top + 182, 300, 18, { size: 13, weight: '700', color: '#8a5a32', vcenter: false });
      }
      drawBtnImage('btn-secondary', 95, top + 248, 200, 52, '推荐这款游戏', 'secondary', 'win-recommend', 16);
      const bw = 140, bh = 58, by = top + h - 78;
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
      const shared = !!ui.fail.sharedOnce;
      if (ui.fail.canRevive) {
        yb = drawFailAction('fail-revive', yb, shared ? '看广告复活' : '分享好友复活', shared ? '临时 +1 车位，接着玩' : '本局第一次可分享，也可看广告');
      }
      if (ui.fail.canShare) {
        yb = drawFailAction('fail-share', yb, shared ? '看广告开车位' : '分享好友', shared ? '本局再开 1 个车位' : '本局解锁 1 个车位');
      }
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
      const introImg = ui.intro.img ? im(ui.intro.img) : null;
      if (introImg) {
        ctx.save();
        D.roundRect(ctx, 65, top + 50, 260, 195, 16);
        ctx.clip();
        ctx.drawImage(introImg, 65, top + 50, 260, 195);
        ctx.restore();
      } else if (ui.intro.demo) {
        drawIntroDemo(ui.intro.demo, 65, top + 50, 260, 195);
      }
      D.fillText(ctx, ui.intro.title, 195, top + 270, {
        size: 24, color: '#f07a22',
        shadows: [{ x: 0, y: 2, color: '#fff3dc' }, { x: 0, y: 3, color: '#b65a1e' }],
      });
      D.wrapText(ctx, ui.intro.text, 195, top + 300, 300, 22, { size: 15, weight: '700', color: '#6b3f1d' });
      drawBtnImage('btn-primary', 120, top + h - 90, 150, 58, '知道了', 'primary', 'intro-ok', 20);
    }

    if (ui.modal === 'share') {
      const top = 120, h = 600, x = 22, w = 346;
      drawPanel(x, top, w, h);
      const si = im('share-illu');
      if (si) {
        ctx.save();
        D.roundRect(ctx, 65, top + 36, 260, 195, 16);
        ctx.clip();
        ctx.drawImage(si, 65, top + 36, 260, 195);
        ctx.restore();
      }
      D.fillText(ctx, ui.rewardPurpose === 'revive' ? '复活这一局' : '再开一个车位', 195, top + 248, {
        size: 24, color: '#f07a22',
        shadows: [{ x: 0, y: 2, color: '#fff3dc' }, { x: 0, y: 3, color: '#b65a1e' }],
      });
      D.wrapText(ctx, '本局第一次可以分享给好友。分享成功后，再复活或开车位只能看广告。只在这一局有效。', 195, top + 278, 300, 22, { size: 15, weight: '700', color: '#6b3f1d' });
      if (ui.shareBusy) {
        const bob = Math.sin(t * (Math.PI * 2 / 0.6)) * 3;
        const sh = im('share');
        if (sh) ctx.drawImage(sh, 100, top + 350 + bob, 30, 30);
        D.fillText(ctx, '正在分享给好友…', 230, top + 365 + bob, { size: 16, color: '#2f8a2f' });
      } else {
        drawBtnImage('btn-primary', 70, top + 360, 250, 58, '分享好友', 'primary', 'share-ok', 20);
        drawBtnImage('btn-secondary', 70, top + 428, 250, 58, '看广告', 'secondary', 'share-ad', 20);
        drawBtnImage('btn-secondary', 120, top + 500, 150, 48, '取消', 'secondary', 'share-cancel', 16);
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

  function openRecommend() {
    env.openRecommend(C.RECOMMEND_OPENLINK).catch((err) => {
      const code = err && (err.errCode != null ? err.errCode : err.code);
      if (code === -7) return;
      if (code === -3) toast('请在微信里推荐');
      else if (code === -1) toast('推荐组件未配置');
      else toast('推荐暂时打不开');
    });
  }
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
  function goSelect() {
    const cur = Math.min(Math.max(progress.unlocked || 1, 1), LEVELS.length);
    selectPage = Math.floor((cur - 1) / SELECT_PER);
    const pages = Math.max(1, Math.ceil(LEVELS.length / SELECT_PER));
    if (selectPage >= pages) selectPage = pages - 1;
    screen = 'select';
  }
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
    if (id === 'sel-prev') { if (selectPage > 0) selectPage--; return; }
    if (id === 'sel-next') {
      const pages = Math.ceil(LEVELS.length / SELECT_PER);
      if (selectPage < pages - 1) selectPage++;
      return;
    }
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
    if (id === 'win-recommend') { openRecommend(); return; }
    if (id === 'win-select' || id === 'fail-select') { hideCards(); cancelAll(); G = null; goSelect(); return; }
    if (id === 'fail-revive') { if (!G || G.revived) return; offerReward('revive', 'fail'); return; }
    if (id === 'fail-share') { offerReward('spot', 'fail'); return; }
    if (id === 'intro-ok') { closeIntro(); return; }
    if (id === 'share-ok') { confirmShare(); return; }
    if (id === 'share-ad') { confirmRewardAd(); return; }
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
      goSelect: (page) => {
        dbgClear(); G = null; goSelect();
        if (page != null) selectPage = Math.max(0, page | 0);
      },
      startLevel: (i) => { fade = 0; startLevel(i); screen = 'play'; },
      closeIntro: () => { ui.modal = null; ui.intro = null; if (G) G.lockUntil = 0; },
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
