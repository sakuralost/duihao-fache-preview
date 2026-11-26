/* 把 CommonJS 小游戏打成浏览器可打开的预览包（不用于上传） */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = [
  'js/config.js',
  'js/env.js',
  'js/analytics.js',
  'js/logic.js',
  'js/levels.js',
  'js/tween.js',
  'js/draw.js',
  'js/app.js',
  'game.js',
];

function idOf(file) {
  return './' + file.replace(/\\/g, '/').replace(/\.js$/, '');
}

const parts = [];
parts.push(`(function(){
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
  if (out.indexOf('./') !== 0) out = './' + out.replace(/^\\//, '');
  return out.replace(/\\.js$/, '');
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
`);

for (const file of files) {
  const id = idOf(file);
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  parts.push(`define(${JSON.stringify(id)}, function(require, module, exports) {\n${src}\n});\n`);
}

parts.push(`
req('./game', './game');
})();
`);

const out = path.join(__dirname, 'preview.bundle.js');
fs.writeFileSync(out, parts.join('\n'));
console.log('wrote', out, fs.statSync(out).size, 'bytes');
