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
