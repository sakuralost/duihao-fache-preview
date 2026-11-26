'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const shotDir = path.join(root, 'beian-shots');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.md': 'text/plain; charset=utf-8',
};

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function saveCapture(req, res) {
  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > 12 * 1024 * 1024) {
      res.writeHead(413);
      res.end('too large');
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on('end', () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const rawName = String(body.name || 'shot');
      const name = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');
      const dataUrl = String(body.dataUrl || '');
      const m = dataUrl.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\s]+)$/);
      if (!m) { send(res, 400, { ok: false, error: 'invalid dataUrl' }); return; }
      const buf = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
      fs.mkdirSync(shotDir, { recursive: true });
      const ext = m[1] === 'jpeg' ? '.jpg' : '.png';
      let file = name;
      if (!/\.(png|jpg|jpeg)$/i.test(file)) file += ext;
      else if (ext === '.jpg' && /\.png$/i.test(file)) file = file.replace(/\.png$/i, '.jpg');
      const dest = path.join(shotDir, file);
      if (!dest.startsWith(shotDir + path.sep) && dest !== shotDir) {
        send(res, 403, { ok: false, error: 'bad name' });
        return;
      }
      fs.writeFileSync(dest, buf);
      console.log('saved', dest, buf.length, 'bytes');
      send(res, 200, { ok: true, file: path.basename(dest), size: buf.length });
    } catch (e) {
      send(res, 400, { ok: false, error: String(e && e.message || e) });
    }
  });
}

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }
  if (req.method === 'POST' && (url === '/capture-save' || url === '/tools/capture-save')) {
    saveCapture(req, res);
    return;
  }
  if (req.method === 'POST' && (url === '/capture-done' || url === '/tools/capture-done')) {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        fs.mkdirSync(shotDir, { recursive: true });
        const body = Buffer.concat(chunks).toString('utf8') || '{}';
        fs.writeFileSync(path.join(shotDir, '_done.txt'), body || 'done');
        send(res, 200, { ok: true });
      } catch (e) {
        send(res, 500, { ok: false, error: String(e && e.message || e) });
      }
    });
    return;
  }
  if (url === '/') url = '/tools/preview.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
const port = process.env.PORT || 33605;
server.listen(port, '127.0.0.1', () => console.log('preview http://127.0.0.1:' + port + '/'));
