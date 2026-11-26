/* 备案截图专用（仅 C.CAPTURE_MODE=true 时由 game.js 调用）：在微信开发者工具模拟器里依次切到 10 个画面，
   读取模拟器主画布原图，POST 到本机 127.0.0.1:33606。截完删除本文件并把 CAPTURE_MODE 改回 false。 */
'use strict';
const HOST = 'http://127.0.0.1:33606';
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
function post(p, data) {
  return new Promise((resolve, reject) => {
    wx.request({ url: HOST + p, method: 'POST', data, header: { 'content-type': 'application/json' },
      success: (r) => (r.statusCode === 200 ? resolve(r.data) : reject(new Error('HTTP ' + r.statusCode))),
      fail: (e) => reject(new Error(e && e.errMsg || 'request fail')) });
  });
}
module.exports = function runCapture(canvas, dh) {
  const jobs = [
    ['scene-start', 600, () => dh.goStart()],
    ['scene-select', 600, () => { dh.setProgress({ unlocked: 4, stars: { 1: 3, 2: 2, 3: 3 } }); dh.goSelect(); }],
    ['scene-play', 1200, () => dh.startLevel(1)],
    ['play-health', 600, () => dh.goHealth()],
    ['play-board', 1200, () => dh.startLevel(0)],
    ['play-longbus', 800, () => { dh.startLevel(4); dh.showIntro(); }],
    ['play-group', 800, () => { dh.startLevel(8); dh.showIntro(); }],
    ['play-result', 600, () => { dh.startLevel(1); dh.showWin(); }],
    ['sys-share-ad', 600, () => { dh.startLevel(1); dh.showFail(); }],
    ['sys-undo', 1200, () => dh.startLevel(2)],
  ];
  (async () => {
    await wait(2500);
    let info = {};
    try { info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); } catch (e) {}
    let dev = {};
    try { dev = wx.getDeviceInfo ? wx.getDeviceInfo() : {}; } catch (e) {}
    await post('/log', { msg: 'start', w: canvas.width, h: canvas.height, info, model: dev.model }).catch(() => {});
    let failed = 0;
    for (const [name, ms, setup] of jobs) {
      try {
        setup();
        await wait(ms);
        const dataUrl = canvas.toDataURL('image/png');
        await post('/shot', { name, dataUrl, meta: { w: canvas.width, h: canvas.height, model: dev.model, windowWidth: info.windowWidth, windowHeight: info.windowHeight, pixelRatio: info.pixelRatio, screen: dh.screen(), t: Date.now() } });
      } catch (e) {
        failed++;
        await post('/log', { msg: 'fail ' + name, err: String(e && e.message || e) }).catch(() => {});
      }
    }
    await post('/done', { ok: failed === 0, failed, t: Date.now() }).catch(() => {});
    dh.goStart();
  })();
};
