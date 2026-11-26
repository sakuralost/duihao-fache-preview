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
