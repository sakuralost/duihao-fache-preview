/* 仅本地：接收微信开发者工具模拟器里截下的主画布，写入 beian-shots-devtools/（不碰 beian-shots/） */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const outDir = path.join(__dirname, '..', 'beian-shots-devtools', 'raw');
fs.mkdirSync(outDir, { recursive: true });
function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
http.createServer((req, res) => {
  if (req.method !== 'POST') return send(res, 404, { ok: false });
  const chunks = []; let size = 0;
  req.on('data', (c) => { size += c.length; if (size > 40 * 1024 * 1024) { req.destroy(); return; } chunks.push(c); });
  req.on('end', () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (req.url.startsWith('/done')) { fs.writeFileSync(path.join(outDir, '_done.json'), JSON.stringify(body, null, 2)); return send(res, 200, { ok: true }); }
      if (req.url.startsWith('/log')) { console.log('[game]', JSON.stringify(body)); fs.appendFileSync(path.join(outDir, '_log.txt'), JSON.stringify(body) + '\n'); return send(res, 200, { ok: true }); }
      const name = path.basename(String(body.name || 'shot')).replace(/[^a-zA-Z0-9._-]/g, '_');
      const m = String(body.dataUrl || '').match(/^data:image\/png;base64,(.+)$/s);
      if (!m) return send(res, 400, { ok: false, error: 'invalid dataUrl' });
      const buf = Buffer.from(m[1], 'base64');
      const dest = path.join(outDir, name.replace(/\.png$/i, '') + '.png');
      fs.writeFileSync(dest, buf);
      fs.writeFileSync(dest + '.json', JSON.stringify(body.meta || {}, null, 2));
      console.log('saved', dest, buf.length);
      send(res, 200, { ok: true, size: buf.length });
    } catch (e) { send(res, 500, { ok: false, error: String(e && e.message || e) }); }
  });
}).listen(33606, '127.0.0.1', () => console.log('devtools shot server http://127.0.0.1:33606'));
