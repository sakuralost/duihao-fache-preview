(function (root) {
  var NS = root.JellyShop || (root.JellyShop = {});
  var FONT = '"WenQuanYi Micro Hei", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif';

  function App(opts) {
    this.canvas = opts.canvas;
    this.ctx = opts.ctx;
    this.images = opts.images;
    this.audio = opts.audio;
    this.storage = opts.storage;
    this.share = opts.share;
    this.screen = 'home';
    this.session = null;
    this.layout = NS.computeLayout(opts.width, opts.height, opts.safeTop || 0, opts.safeBottom || 0);
    this.modal = null;
    this.toast = null;
    this.toastT = 0;
    this.buttons = [];
    this.levelId = 1;
  }

  App.prototype.resize = function (w, h, safeTop, safeBottom) {
    this.layout = NS.computeLayout(w, h, safeTop || 0, safeBottom || 0);
    if (this.session) this.session.setLayout(this.layout);
  };

  App.prototype.startLevel = function (id) {
    var level = null;
    for (var i = 0; i < NS.LEVELS.length; i++) if (NS.LEVELS[i].id === id) level = NS.LEVELS[i];
    if (!level) return;
    this.levelId = id;
    this.modal = null;
    var self = this;
    this.session = new NS.Session(level, this.layout, this.audio, this.images);
    this.session.onAction = function (action) { self._onAction(action); };
    this.screen = 'play';
  };

  App.prototype._onAction = function (action) {
    if (action === 'restart') this.startLevel(this.levelId);
    else if (action === 'home') this.screen = 'home';
    else if (action === 'next') this.startLevel(Math.min(NS.LEVELS.length, this.levelId + 1));
    else if (action === 'share') this._share();
    else if (action === 'ad') this.modal = 'ad';
  };

  App.prototype._share = function () {
    var text = this.session ? this.session.shareText() : '云朵果冻铺';
    if (this.share) this.share(text);
    this.toast = text + '。试玩版不发道具。';
    this.toastT = 2200;
  };

  App.prototype.update = function (dt) {
    if (this.toastT > 0) this.toastT -= dt;
    if (this.screen === 'play' && this.session) this.session.update(dt);
  };

  App.prototype.pointerDown = function (x, y) {
    if (this.audio) this.audio.unlock();
    if (this.modal) return;
    if (this.screen === 'home') {
      this._press = this._hit(x, y);
      return;
    }
    if (this.session) this.session.pointerDown(x, y);
  };

  App.prototype.pointerMove = function (x, y) {
    if (this.screen === 'play' && this.session) this.session.pointerMove(x, y);
  };

  App.prototype.pointerUp = function (x, y) {
    if (this.modal) {
      if (this._hit(x, y) && this._hit(x, y).id === 'close-ad') this.modal = null;
      return;
    }
    if (this.screen === 'home') {
      var hit = this._hit(x, y);
      if (hit && this._press && hit.id === this._press.id) {
        if (hit.id === 'start') this.startLevel(1);
        else if (hit.id.indexOf('level-') === 0) this.startLevel(Number(hit.id.slice(6)));
      }
      this._press = null;
      return;
    }
    if (this.session) this.session.pointerUp(x, y);
  };

  App.prototype._hit = function (x, y) {
    for (var i = 0; i < this.buttons.length; i++) {
      var button = this.buttons[i];
      if (x >= button.x && y >= button.y && x <= button.x + button.w && y <= button.y + button.h) return button;
    }
    return null;
  };

  App.prototype.draw = function () {
    var ctx = this.ctx;
    var layout = this.layout;
    ctx.clearRect(0, 0, layout.w, layout.h);
    if (this.images.bg) {
      var iw = this.images.bg.width;
      var ih = this.images.bg.height;
      var scale = Math.max(layout.w / iw, layout.h / ih);
      var dw = iw * scale;
      var dh = ih * scale;
      ctx.drawImage(this.images.bg, (layout.w - dw) / 2, (layout.h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#f6e4ea';
      ctx.fillRect(0, 0, layout.w, layout.h);
    }
    if (this.screen === 'home') this._drawHome(ctx);
    else if (this.session) this.session.draw(ctx);
    if (this.modal === 'ad') this._drawAd(ctx);
    if (this.toastT > 0) this._drawToast(ctx);
  };

  App.prototype._drawHome = function (ctx) {
    var layout = this.layout;
    var buttons = [];
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5a3140';
    ctx.font = '700 40px ' + FONT;
    ctx.fillText('云朵果冻铺', layout.w / 2, layout.h * 0.16);
    ctx.font = '500 16px ' + FONT;
    ctx.fillStyle = 'rgba(90,49,64,0.82)';
    ctx.fillText('把一串果冻抽起来，抛进另一列', layout.w / 2, layout.h * 0.16 + 36);
    var sprites = [this.images.strawberry, this.images.milk, this.images.mint];
    var gap = Math.min(96, layout.w / 4);
    for (var i = 0; i < sprites.length; i++) {
      if (!sprites[i]) continue;
      var x = layout.w / 2 + (i - 1) * gap;
      ctx.drawImage(sprites[i], x - 36, layout.h * 0.28, 72, 72);
    }
    var bw = Math.min(240, layout.w - 80);
    var bx = (layout.w - bw) / 2;
    var by = layout.h * 0.46;
    buttons.push({ id: 'start', label: '开始第一关', x: bx, y: by, w: bw, h: 52 });
    var chip = 64;
    var total = chip * 4 + 12 * 3;
    var startX = (layout.w - total) / 2;
    for (var n = 1; n <= 4; n++) {
      buttons.push({
        id: 'level-' + n,
        label: String(n),
        x: startX + (n - 1) * (chip + 12),
        y: by + 78,
        w: chip,
        h: 44
      });
    }
    this.buttons = buttons;
    for (var b = 0; b < buttons.length; b++) {
      var button = buttons[b];
      NS.roundRect(ctx, button.x, button.y, button.w, button.h, 16);
      ctx.fillStyle = button.id === 'start' ? '#ff8fab' : 'rgba(255,248,244,0.94)';
      ctx.fill();
      ctx.fillStyle = '#5a3140';
      ctx.font = (button.id === 'start' ? '700 20px ' : '700 18px ') + FONT;
      ctx.textBaseline = 'middle';
      ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 + 1);
    }
    ctx.font = '500 14px ' + FONT;
    ctx.fillStyle = 'rgba(90,49,64,0.75)';
    ctx.fillText('第 1 到 4 关 · 手数闯关 · 不接广告', layout.w / 2, by + 150);
    ctx.restore();
  };

  App.prototype._drawAd = function (ctx) {
    var layout = this.layout;
    ctx.save();
    ctx.fillStyle = 'rgba(80,48,58,0.45)';
    ctx.fillRect(0, 0, layout.w, layout.h);
    var w = Math.min(320, layout.w - 40);
    var h = 230;
    var x = (layout.w - w) / 2;
    var y = layout.h * 0.28;
    NS.roundRect(ctx, x, y, w, h, 20);
    ctx.fillStyle = '#fffaf7';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5a3140';
    ctx.font = '700 20px ' + FONT;
    ctx.fillText('广告位还没接上', layout.w / 2, y + 48);
    ctx.font = '500 15px ' + FONT;
    ctx.fillText('正式版这里播放激励视频。', layout.w / 2, y + 92);
    ctx.fillText('试玩版不播放，也不加勺子。', layout.w / 2, y + 118);
    ctx.font = '500 13px ' + FONT;
    ctx.fillStyle = 'rgba(90,49,64,0.7)';
    ctx.fillText('每局最多 2 次，这一版先占位。', layout.w / 2, y + 148);
    var button = { id: 'close-ad', label: '知道了', x: x + 40, y: y + 172, w: w - 80, h: 40 };
    this.buttons = [button];
    NS.roundRect(ctx, button.x, button.y, button.w, button.h, 14);
    ctx.fillStyle = '#ff8fab';
    ctx.fill();
    ctx.fillStyle = '#5a3140';
    ctx.font = '700 16px ' + FONT;
    ctx.textBaseline = 'middle';
    ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2);
    ctx.restore();
  };

  App.prototype._drawToast = function (ctx) {
    var layout = this.layout;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.toastT / 300);
    ctx.fillStyle = 'rgba(90,49,64,0.88)';
    var w = Math.min(layout.w - 32, 340);
    NS.roundRect(ctx, (layout.w - w) / 2, layout.h - 120, w, 64, 14);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '500 14px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var text = this.toast || '';
    ctx.fillText(text.length > 28 ? text.slice(0, 28) + '…' : text, layout.w / 2, layout.h - 88);
    ctx.restore();
  };

  function loadImages(loadImage, base) {
    var files = {
      strawberry: base + 'images/strawberry.png',
      milk: base + 'images/milk.png',
      mint: base + 'images/mint.png',
      drop: base + 'images/drop.png',
      spoon: base + 'images/spoon.png',
      well: base + 'images/well.png',
      track: base + 'images/track.png',
      deck: base + 'images/deck.png',
      bg: base + 'images/bg.jpg'
    };
    var keys = Object.keys(files);
    return Promise.all(keys.map(function (key) {
      return loadImage(files[key]).then(function (img) { return { key: key, img: img }; });
    })).then(function (list) {
      var images = {};
      list.forEach(function (item) { images[item.key] = item.img; });
      return images;
    });
  }

  function fitCanvas(canvas, cssW, cssH) {
    var dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
    if (typeof wx !== 'undefined' && wx.getWindowInfo) {
      var info = wx.getWindowInfo();
      dpr = Math.min(info.pixelRatio || 1, 2);
    }
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, dpr: dpr };
  }

  NS.bootBrowser = function (canvas) {
    var cssW = window.innerWidth;
    var cssH = window.innerHeight;
    var fitted = fitCanvas(canvas, cssW, cssH);
    var audio = new NS.AudioBus();
    var safeTop = 0;
    var safeBottom = 0;
    var probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);visibility:hidden';
    document.body.appendChild(probe);
    safeTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    safeBottom = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
    document.body.removeChild(probe);
    return loadImages(function (src) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error(src)); };
        img.src = src;
      });
    }, 'wechat-minigame/').then(function (images) {
      var app = new App({
        canvas: canvas,
        ctx: fitted.ctx,
        images: images,
        audio: audio,
        width: cssW,
        height: cssH,
        safeTop: safeTop,
        safeBottom: safeBottom,
        share: function (text) {
          if (navigator.share) navigator.share({ text: text }).catch(function () {});
        }
      });
      root.__JELLY__ = app;
      var last = performance.now();
      function frame(now) {
        var dt = now - last;
        last = now;
        var w = window.innerWidth;
        var h = window.innerHeight;
        if (w !== cssW || h !== cssH) {
          cssW = w;
          cssH = h;
          fitted = fitCanvas(canvas, cssW, cssH);
          app.ctx = fitted.ctx;
          app.resize(cssW, cssH, safeTop, safeBottom);
        } else {
          app.ctx.setTransform(fitted.dpr, 0, 0, fitted.dpr, 0, 0);
        }
        app.update(dt);
        app.draw();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      function point(event) {
        var rect = canvas.getBoundingClientRect();
        var src = event.touches && event.touches[0] ? event.touches[0] : event.changedTouches && event.changedTouches[0] ? event.changedTouches[0] : event;
        return {
          x: (src.clientX - rect.left) * (cssW / rect.width),
          y: (src.clientY - rect.top) * (cssH / rect.height)
        };
      }
      canvas.addEventListener('pointerdown', function (event) {
        canvas.setPointerCapture && canvas.setPointerCapture(event.pointerId);
        var p = point(event);
        app.pointerDown(p.x, p.y);
      });
      canvas.addEventListener('pointermove', function (event) {
        var p = point(event);
        app.pointerMove(p.x, p.y);
      });
      canvas.addEventListener('pointerup', function (event) {
        var p = point(event);
        app.pointerUp(p.x, p.y);
      });
      canvas.addEventListener('pointercancel', function () {
        if (app.session && app.session.phase === 'holding') app.session._beginReturn();
      });
      document.addEventListener('touchmove', function (event) { event.preventDefault(); }, { passive: false });
    });
  };

  NS.bootWechat = function () {
    var canvas = wx.createCanvas();
    var info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    var cssW = info.windowWidth;
    var cssH = info.windowHeight;
    var dpr = Math.min(info.pixelRatio || 1, 2);
    var safeTop = 0;
    var safeBottom = 0;
    if (info.safeArea) {
      safeTop = info.safeArea.top || 0;
      safeBottom = Math.max(0, (info.screenHeight || cssH) - info.safeArea.bottom);
    }
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var audio = new NS.AudioBus();
    loadImages(function (src) {
      return new Promise(function (resolve, reject) {
        var img = wx.createImage();
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error(src)); };
        img.src = src;
      });
    }, '').then(function (images) {
      var app = new App({
        canvas: canvas,
        ctx: ctx,
        images: images,
        audio: audio,
        width: cssW,
        height: cssH,
        safeTop: safeTop,
        safeBottom: safeBottom,
        share: function (text) {
          if (wx.shareAppMessage) wx.shareAppMessage({ title: text });
        }
      });
      var last = Date.now();
      function frame() {
        var now = Date.now();
        var dt = now - last;
        last = now;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        app.update(dt);
        app.draw();
        var raf = canvas.requestAnimationFrame || requestAnimationFrame;
        raf(frame);
      }
      frame();
      wx.onTouchStart(function (event) {
        var t = event.touches[0];
        app.pointerDown(t.x, t.y);
      });
      wx.onTouchMove(function (event) {
        var t = event.touches[0];
        if (t) app.pointerMove(t.x, t.y);
      });
      wx.onTouchEnd(function (event) {
        var t = (event.changedTouches && event.changedTouches[0]) || event.touches[0];
        if (t) app.pointerUp(t.x, t.y);
      });
      wx.onTouchCancel(function () {
        if (app.session && app.session.phase === 'holding') app.session._beginReturn();
      });
    }).catch(function (err) {
      console.error(err);
    });
  };

  NS.App = App;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof globalThis !== 'undefined' ? globalThis : this);
