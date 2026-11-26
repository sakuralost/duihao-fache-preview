/* 备案截图自动采集（仅本地预览，不上传微信） */
(function () {
  if (!window.__DUIHAO_CAPTURE) return;

  var listEl = document.getElementById('list');
  var statusEl = document.getElementById('status');

  function setStatus(t) { if (statusEl) statusEl.textContent = t; }

  function addItem(name, cls, extra) {
    var li = document.createElement('li');
    li.className = cls || '';
    li.textContent = name + (extra ? '  ' + extra : '');
    if (listEl) listEl.appendChild(li);
    return li;
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function frames(n) {
    return new Promise(function (resolve) {
      function tick() { n--; if (n <= 0) resolve(); else requestAnimationFrame(tick); }
      requestAnimationFrame(tick);
    });
  }

  function waitDH(timeout) {
    timeout = timeout || 20000;
    var t0 = Date.now();
    return new Promise(function (resolve, reject) {
      (function tick() {
        var dh = window.DH || (window.GameGlobal && window.GameGlobal.DH);
        if (dh && typeof dh.screenshotStage === 'function') return resolve(dh);
        if (Date.now() - t0 > timeout) return reject(new Error('游戏未就绪'));
        requestAnimationFrame(tick);
      })();
    });
  }

  function dataUrlSize(dataUrl) {
    var i = dataUrl.indexOf(',');
    var b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
    return Math.floor(b64.length * 0.75) - (b64.slice(-2) === '==' ? 2 : b64.slice(-1) === '=' ? 1 : 0);
  }

  function toJpeg(dataUrl, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = img.naturalWidth || 780;
        c.height = img.naturalHeight || 1688;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve(c.toDataURL('image/jpeg', quality || 0.95));
      };
      img.onerror = function () { reject(new Error('jpeg 转码失败')); };
      img.src = dataUrl;
    });
  }

  async function postShot(name, dataUrl) {
    var last;
    for (var attempt = 1; attempt <= 4; attempt++) {
      try {
        var res = await fetch('/capture-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, dataUrl: dataUrl }),
        });
        var json = await res.json().catch(function () { return {}; });
        if (!res.ok || !json.ok) throw new Error(json.error || ('HTTP ' + res.status));
        return json;
      } catch (e) {
        last = e;
        if (attempt < 4) await wait(800 * attempt);
      }
    }
    throw last;
  }

  async function capture(dh, file) {
    await frames(2);
    var dataUrl = dh.screenshotStage();
    if (!dataUrl || dataUrl.indexOf('data:image') !== 0) throw new Error('screenshotStage 未返回图片');
    var size = dataUrlSize(dataUrl);
    if (size < 60 * 1024) {
      dataUrl = await toJpeg(dataUrl, 0.95);
      file = file.replace(/\.png$/i, '.jpg');
    }
    var info = await postShot(file, dataUrl);
    return info;
  }

  var jobs = [
    { file: 'scene-start.png', wait: 350, setup: function (dh) { dh.goStart(); } },
    {
      file: 'scene-select.png', wait: 350,
      setup: function (dh) {
        dh.setProgress({ unlocked: 4, stars: { 1: 3, 2: 2, 3: 3 } });
        dh.goSelect();
      },
    },
    { file: 'scene-play.png', wait: 950, setup: function (dh) { dh.startLevel(1); } },
    { file: 'play-health.png', wait: 350, setup: function (dh) { dh.goHealth(); } },
    { file: 'play-board.png', wait: 950, setup: function (dh) { dh.startLevel(0); } },
    {
      file: 'play-longbus.png', wait: 500,
      setup: function (dh) { dh.startLevel(4); dh.showIntro(); },
    },
    {
      file: 'play-group.png', wait: 500,
      setup: function (dh) { dh.startLevel(8); dh.showIntro(); },
    },
    { file: 'play-result.png', wait: 250, setup: function (dh) { dh.startLevel(1); dh.showWin(); } },
    { file: 'sys-share-ad.png', wait: 250, setup: function (dh) { dh.startLevel(1); dh.showFail(); } },
    { file: 'sys-undo.png', wait: 800, setup: function (dh) { dh.startLevel(2); } },
  ];

  async function run() {
    setStatus('等待游戏加载…');
    var dh = await waitDH();
    await wait(200);
    var failed = 0;
    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      setStatus('正在截取 ' + job.file + '（' + (i + 1) + '/' + jobs.length + '）');
      try {
        job.setup(dh);
        await wait(job.wait || 400);
        var info = await capture(dh, job.file);
        addItem(info.file || job.file, 'ok', (info.size ? Math.round(info.size / 1024) + ' KB' : '') + ' 已保存');
      } catch (e) {
        failed++;
        addItem(job.file, 'err', String(e && e.message || e));
      }
    }
    if (failed) setStatus('完成，但有 ' + failed + ' 张失败');
    else setStatus('完成');
    try {
      await fetch('/capture-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: failed === 0, failed: failed, time: Date.now() }),
      });
    } catch (e) {}
    window.__DUIHAO_CAPTURE_DONE = failed === 0;
    window.__DUIHAO_CAPTURE_FAILED = failed;
  }

  run().catch(function (e) {
    setStatus('失败：' + (e && e.message || e));
    addItem('capture', 'err', String(e && e.message || e));
    window.__DUIHAO_CAPTURE_DONE = false;
  });
})();
