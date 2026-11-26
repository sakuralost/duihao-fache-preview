(function (root) {
  var NS = root.JellyShop || (root.JellyShop = {});

  function AudioBus() {
    this.ctx = null;
    this.muted = false;
    this.voices = 0;
  }

  AudioBus.prototype.unlock = function () {
    var Ctx = null;
    if (typeof wx !== 'undefined' && wx.createWebAudioContext) Ctx = wx.createWebAudioContext;
    else if (typeof window !== 'undefined' && window.AudioContext) Ctx = window.AudioContext;
    if (!Ctx) return;
    if (!this.ctx) {
      try { this.ctx = new Ctx(); } catch (err) { return; }
    }
    if (this.ctx.resume) this.ctx.resume();
  };

  AudioBus.prototype.toggle = function () {
    this.muted = !this.muted;
    return this.muted;
  };

  AudioBus.prototype.tone = function (freq, dur, type, gain) {
    if (this.muted || !this.ctx || this.voices >= 4) return;
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    var amp = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    var now = ctx.currentTime;
    amp.gain.setValueAtTime(gain || 0.06, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
    this.voices += 1;
    var self = this;
    setTimeout(function () { self.voices = Math.max(0, self.voices - 1); }, dur * 1000 + 30);
  };

  AudioBus.prototype.suck = function () { this.tone(560, 0.04, 'sine', 0.045); };
  AudioBus.prototype.throw = function () { this.tone(320, 0.18, 'sine', 0.05); };
  AudioBus.prototype.land = function () { this.tone(210, 0.05, 'triangle', 0.06); };
  AudioBus.prototype.pop = function (wave) { this.tone(460 + (wave || 1) * 55, 0.16, 'sine', 0.07); };

  NS.AudioBus = AudioBus;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof globalThis !== 'undefined' ? globalThis : this);
