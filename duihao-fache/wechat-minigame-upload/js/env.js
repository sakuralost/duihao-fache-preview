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
