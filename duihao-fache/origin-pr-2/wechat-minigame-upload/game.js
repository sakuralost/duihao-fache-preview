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
