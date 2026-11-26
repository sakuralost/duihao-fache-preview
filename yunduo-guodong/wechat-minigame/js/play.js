(function (root) {
  var NS = root.JellyShop || (root.JellyShop = {});

  var T = {
    suckOne: 160,
    suckStagger: 45,
    followTau: 70,
    slotFade: 90,
    returnOne: 140,
    returnStagger: 30,
    spoonIn: 180,
    chargeDown: 180,
    chargeHold: 50,
    chargeBreath: 240,
    spoonFlick: 140,
    spoonFade: 200,
    aimCycle: 420,
    aimStagger: 140,
    aimFadeIn: 90,
    aimFadeOut: 110,
    hintIn: 160,
    idleBob: 700,
    hintHop: 280,
    wellTau: 70,
    missUp: 160,
    missDown: 220,
    missIn: 140,
    missHold: 500,
    missOut: 220,
    throwBase: 260,
    throwPerCell: 24,
    throwMax: 440,
    throwFollow: 32,
    throwHoriz: 80,
    land: 140,
    judgePause: 40,
    pulse: 120,
    breakOne: 180,
    breakStagger: 28,
    dropLife: 220,
    fallCell: 150,
    fallSettle: 90,
    fallStagger: 20,
    chainPause: 90,
    comboIn: 120,
    comboHold: 400,
    comboOut: 180,
    failDim: 400,
    cardIn: 280,
    shake: 90
  };
  NS.TIMING = T;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function easeIn(t) { t = clamp(t, 0, 1); return t * t * t; }

  function keyScale(t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (var i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        var a = keys[i - 1];
        var b = keys[i];
        return lerp(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
      }
    }
    return keys[keys.length - 1][1];
  }

  var SUCK_SCALE = [[0, 1], [0.35, 0.92], [0.7, 1.05], [1, 1]];
  var LAND_SCALE = [[0, 1], [0.4, 1.18], [0.7, 0.94], [1, 1]];

  function computeLayout(w, h, safeTop, safeBottom) {
    var margin = 16;
    var topBar = Math.max(78, (safeTop || 0) + 58);
    var bottomSafe = Math.max(18, safeBottom || 0);
    var handLane = 196;
    var boardTop = topBar + 28;
    var boardBottom = h - bottomSafe - handLane;
    var availW = w - margin * 2;
    var availH = Math.max(180, boardBottom - boardTop);
    var cell = Math.min(availW / NS.COLS, availH / NS.ROWS);
    var gridW = cell * NS.COLS;
    var gridH = cell * NS.ROWS;
    var gridX = (w - gridW) / 2;
    var gridY = boardTop + Math.max(0, (availH - gridH) / 2);
    return {
      w: w,
      h: h,
      cell: cell,
      gridX: gridX,
      gridY: gridY,
      gridW: gridW,
      gridH: gridH,
      topBar: topBar,
      grabTop: gridY + gridH - Math.min(120, cell * 2.4),
      grabBottom: gridY + gridH,
      dockTop: gridY + gridH + 6,
      dockBottom: h - bottomSafe - 8
    };
  }

  function cellCenter(layout, col, row) {
    return {
      x: layout.gridX + (col + 0.5) * layout.cell,
      y: layout.gridY + (row + 0.5) * layout.cell
    };
  }

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function Session(level, layout, audio, images) {
    this.level = level;
    this.layout = layout;
    this.audio = audio;
    this.images = images || {};
    this.logic = NS.gridFromColumns(level.columns);
    this.pieces = [];
    this.held = [];
    this.drops = [];
    this.phase = 'idle';
    this.phaseT = 0;
    this.spoons = level.spoons;
    this.wave = 0;
    this.maxWave = 0;
    this.outcome = null;
    this.buttons = [];
    this.pointer = { x: 0, y: 0, down: false };
    this.ghostMode = false;
    this.slotA = 0;
    this.slotX = 0;
    this.slotWarm = false;
    this.targetCol = 0;
    this.sourceCol = 0;
    this.shake = 0;
    this.combo = null;
    this.groups = [];
    this.impact = { col: 0, row: 0 };
    this.throwDur = T.throwBase;
    this.spoon = { on: false, x: 0, y: 0, alpha: 0, scale: 1, scaleY: 1, rot: -0.2 };
    this.hoverCol = -1;
    this.missCol = -1;
    this.missAt = -9999;
    this.wellA = [0, 0, 0, 0, 0, 0];
    this.pendingUp = null;
    this.nextId = 1;
    this.time = 0;
    this._spawn();
    if (level.demo) this._beginDemo();
  }

  Session.prototype._spawn = function () {
    for (var c = 0; c < NS.COLS; c++) {
      for (var r = 0; r < NS.ROWS; r++) {
        if (!this.logic[c][r]) continue;
        var at = cellCenter(this.layout, c, r);
        this.pieces.push(this._makePiece(this.logic[c][r], c, r, at.x, at.y, false));
      }
    }
  };

  Session.prototype._makePiece = function (type, col, row, x, y, ghost) {
    return {
      id: this.nextId++,
      type: type,
      col: col,
      row: row,
      originCol: col,
      originRow: row,
      x: x,
      y: y,
      scale: 1,
      scaleY: 1,
      opacity: ghost ? 0.78 : 1,
      settled: !ghost,
      alive: true,
      ghost: ghost,
      fromBottom: 0
    };
  };

  Session.prototype.pieceAt = function (col, row) {
    for (var i = 0; i < this.pieces.length; i++) {
      var p = this.pieces[i];
      if (p.alive && p.settled && !p.ghost && p.col === col && p.row === row) return p;
    }
    return null;
  };

  Session.prototype.colCenter = function (col) {
    return this.layout.gridX + (col + 0.5) * this.layout.cell;
  };

  Session.prototype.columnByHysteresis = function (x, current) {
    var col = current;
    while (col < NS.COLS - 1 && x >= this.colCenter(col + 1)) col += 1;
    while (col > 0 && x <= this.colCenter(col - 1)) col -= 1;
    return col;
  };

  Session.prototype.handTarget = function (piece) {
    return {
      x: this.pointer.x,
      y: this.pointer.y - Math.max(72, this.layout.cell * 1.15) - piece.fromBottom * Math.max(18, this.layout.cell * 0.46)
    };
  };

  Session.prototype._beginDemo = function () {
    var from = this.level.demo.from;
    var run = NS.peekRun(this.logic, from);
    if (!run) return;
    this.ghostMode = true;
    this.pointer.x = this.colCenter(from);
    this.pointer.y = (this.layout.grabTop + this.layout.grabBottom) / 2;
    this.pointer.down = true;
    this.demo = { stage: 'suck', to: this.level.demo.to };
    this.held = [];
    for (var i = 0; i < run.length; i++) {
      var at = cellCenter(this.layout, from, run[i].row);
      var ghost = this._makePiece(run[i].type, from, run[i].row, at.x, at.y, true);
      ghost.fromBottom = i;
      ghost.originCol = from;
      ghost.originRow = run[i].row;
      ghost.suckFromX = at.x;
      ghost.suckFromY = at.y;
      ghost.settled = false;
      this.pieces.push(ghost);
      this.held.push(ghost);
    }
    this.sourceCol = from;
    this.targetCol = from;
    this.slotX = this.colCenter(from);
    this.slotA = 0;
    var home = this._dockCenter(from);
    this.spoonGrabFrom = { x: home.x, y: home.y - 8, rot: 0.08 };
    this.spoon.on = true;
    this.spoon.alpha = 1;
    this.spoon.x = home.x;
    this.spoon.y = home.y - 8;
    this.phase = 'sucking';
    this.phaseT = 0;
  };

  Session.prototype.skipDemo = function () {
    if (!this.ghostMode) return;
    for (var i = 0; i < this.pieces.length; i++) {
      if (this.pieces[i].ghost) this.pieces[i].alive = false;
    }
    this.held = [];
    this.ghostMode = false;
    this.demo = null;
    this.pendingUp = null;
    this.spoon.on = false;
    this.spoon.alpha = 0;
    this.phase = 'idle';
    this.phaseT = 0;
    this.slotA = 0;
  };

  Session.prototype.setLayout = function (layout) {
    this.layout = layout;
    if (this.phase === 'idle' || this.phase === 'result') {
      for (var i = 0; i < this.pieces.length; i++) {
        var p = this.pieces[i];
        if (!p.alive || !p.settled || p.ghost) continue;
        var at = cellCenter(layout, p.col, p.row);
        p.x = at.x;
        p.y = at.y;
      }
    }
  };

  Session.prototype.pointerDown = function (x, y) {
    this.audio && this.audio.unlock && this.audio.unlock();
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.down = true;
    if (this._hitButton(x, y)) return;
    if (this.ghostMode || this.phase !== 'idle') return;
    var col = this._columnAt(x);
    var inGrab = y >= this.layout.grabTop && y <= this.layout.grabBottom && col >= 0;
    var inDock = y >= this.layout.dockTop - 6 && y <= this.layout.dockBottom + 10 && col >= 0;
    if (inGrab || inDock) {
      this.hoverCol = col;
      this._beginSuck(col);
      return;
    }
    if (y >= this.layout.gridY) this._nudge(x);
  };

  Session.prototype.pointerMove = function (x, y) {
    this.pointer.x = x;
    this.pointer.y = y;
    if (this.phase !== 'idle' || this.pointer.down) return;
    var col = this._columnAt(x);
    var inZone = y >= this.layout.grabTop && y <= this.layout.dockBottom + 10;
    this.hoverCol = inZone && col >= 0 ? col : -1;
  };

  Session.prototype._columnAt = function (x) {
    var col = Math.floor((x - this.layout.gridX) / this.layout.cell);
    if (col < 0 || col >= NS.COLS) return -1;
    return col;
  };

  Session.prototype._nearestCol = function (x) {
    var local = (x - this.layout.gridX) / this.layout.cell;
    return clamp(Math.round(local - 0.5), 0, NS.COLS - 1);
  };

  Session.prototype._nudge = function (x) {
    this.missCol = this._nearestCol(x);
    this.missAt = this.time;
    this.hoverCol = this.missCol;
  };

  Session.prototype._dockCenter = function (col) {
    var span = this.layout.dockBottom - this.layout.dockTop;
    return {
      x: this.layout.gridX + (col + 0.5) * this.layout.cell,
      y: this.layout.dockTop + span * 0.36
    };
  };

  Session.prototype._updateWells = function (dt) {
    var focus = -1;
    if (this.phase === 'idle') focus = this.hoverCol;
    else if (this.phase === 'sucking' || this.phase === 'returning') focus = this.sourceCol;
    else if (this.phase === 'holding' || this.phase === 'squashing' || this.phase === 'flying') focus = this.targetCol;
    var k = 1 - Math.exp(-(dt || 16) / T.wellTau);
    for (var c = 0; c < NS.COLS; c++) {
      var target = c === focus ? 1 : 0;
      this.wellA[c] += (target - this.wellA[c]) * k;
    }
  };

  Session.prototype.pointerUp = function (x, y) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.down = false;
    var button = this._pressedButton;
    this._pressedButton = null;
    if (button && this._inside(button, x, y)) {
      if (button.id === 'skip') this.skipDemo();
      else if (this.onAction) this.onAction(button.id);
      return;
    }
    if (this.ghostMode) return;
    if (this.phase === 'sucking') {
      this.pendingUp = { x: x, y: y };
      return;
    }
    if (this.phase === 'holding') this._release();
  };

  Session.prototype._inside = function (button, x, y) {
    return x >= button.x && y >= button.y && x <= button.x + button.w && y <= button.y + button.h;
  };

  Session.prototype._hitButton = function (x, y) {
    for (var i = 0; i < this.buttons.length; i++) {
      if (this._inside(this.buttons[i], x, y)) {
        this._pressedButton = this.buttons[i];
        return true;
      }
    }
    return false;
  };

  Session.prototype._beginSuck = function (col) {
    var run = NS.peekRun(this.logic, col);
    if (!run) return;
    this.held = [];
    for (var i = 0; i < run.length; i++) {
      var piece = this.pieceAt(col, run[i].row);
      if (!piece) continue;
      piece.fromBottom = i;
      piece.originCol = col;
      piece.originRow = run[i].row;
      piece.suckFromX = piece.x;
      piece.suckFromY = piece.y;
      piece.settled = false;
      piece.suckSound = false;
      this.logic[col][run[i].row] = null;
      this.held.push(piece);
    }
    if (!this.held.length) return;
    this.sourceCol = col;
    this.targetCol = col;
    this.slotX = this.colCenter(col);
    this.slotA = 0;
    this.slotWarm = false;
    this.pendingUp = null;
    this.phase = 'sucking';
    this.phaseT = 0;
    this.wave = 0;
    var home = this._dockCenter(col);
    this.spoonGrabFrom = { x: home.x, y: home.y - 8, rot: 0.08 };
    this.spoon.on = true;
    this.spoon.alpha = 1;
    this.spoon.x = home.x;
    this.spoon.y = home.y - 8;
    this.spoon.rot = 0.08;
  };

  Session.prototype._release = function () {
    var below = this.pointer.y > this.layout.dockBottom + 12;
    var same = this.targetCol === this.sourceCol;
    var rows = NS.placeRows(this.logic, this.targetCol, this.held.length);
    if (below || same || !rows) this._beginReturn();
    else this._beginThrow(rows);
  };

  Session.prototype._beginReturn = function () {
    this.phase = 'returning';
    this.phaseT = 0;
    for (var i = 0; i < this.held.length; i++) {
      var piece = this.held[i];
      piece.retFromX = piece.x;
      piece.retFromY = piece.y;
      piece.retDelay = piece.fromBottom * T.returnStagger;
    }
  };

  Session.prototype._beginThrow = function (rows) {
    var count = this.held.length;
    var minRow = rows[0];
    for (var i = 0; i < count; i++) {
      var piece = this.held[i];
      piece.placeCol = this.targetCol;
      piece.placeRow = rows[count - 1 - piece.fromBottom];
      piece.depart = (piece.placeRow - minRow) * T.throwFollow;
      piece.landing = false;
      piece.landed = false;
      piece.landSound = false;
      if (piece.placeRow < minRow) minRow = piece.placeRow;
    }
    this.impact = { col: this.targetCol, row: rows[0] };
    if (!this.ghostMode) this.spoons -= 1;
    for (var n = 0; n < count; n++) {
      this.held[n].chargeFromX = this.held[n].x;
      this.held[n].chargeFromY = this.held[n].y;
    }
    this.spoon.chargeFromX = this.spoon.x;
    this.spoon.chargeFromY = this.spoon.y;
    this.phase = 'squashing';
    this.phaseT = 0;
  };

  Session.prototype._beginFlight = function () {
    this.phase = 'flying';
    this.phaseT = 0;
    this.spoon.flickFromY = this.spoon.y;
    this.spoon.flickFromRot = this.spoon.rot;
    if (this.audio) this.audio.throw();
    var lead = this.held[0];
    for (var i = 1; i < this.held.length; i++) {
      if (this.held[i].placeRow < lead.placeRow) lead = this.held[i];
    }
    var dest = cellCenter(this.layout, lead.placeCol, lead.placeRow);
    var cells = Math.max(1, Math.round(Math.abs(lead.y - dest.y) / this.layout.cell));
    this.throwDur = Math.min(T.throwMax, T.throwBase + T.throwPerCell * cells);
    for (var j = 0; j < this.held.length; j++) {
      this.held[j].flyFromX = this.held[j].x;
      this.held[j].flyFromY = this.held[j].y;
    }
  };

  Session.prototype.update = function (dt) {
    dt = Math.min(34, Math.max(0, dt || 0));
    this.time += dt;
    this.phaseT += dt;
    this._updateWells(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    if (this.combo) {
      this.combo.age += dt;
      if (this.combo.age > T.comboIn + T.comboHold + T.comboOut) this.combo = null;
    }
    this._updateDrops(dt);
    if (this.phase === 'sucking') this._updateSuck(dt);
    else if (this.phase === 'holding') this._updateHold(dt);
    else if (this.phase === 'returning') this._updateReturn();
    else if (this.phase === 'squashing') this._updateSquash();
    else if (this.phase === 'flying') this._updateFlight(dt);
    else if (this.phase === 'prejudge') {
      if (this.phaseT >= T.judgePause) this._startResolve();
    } else if (this.phase === 'pulsing') {
      if (this.phaseT >= T.pulse) {
        this.phase = 'breaking';
        this.phaseT = 0;
        this._armBreak();
      }
    } else if (this.phase === 'breaking') this._updateBreak(dt);
    else if (this.phase === 'falling') this._updateFall();
    else if (this.phase === 'chainpause') {
      if (this.phaseT >= T.chainPause) this._startResolve();
    } else if (this.phase === 'ghostFade') this._updateGhostFade();
    else if (this.phase === 'result') this._layoutResultButtons();
    else this._layoutPlayButtons();

    if (this.ghostMode && this.demo && this.demo.stage === 'move' && this.phase === 'holding') {
      var u = Math.min(1, this.phaseT / 700);
      var fromX = this.colCenter(this.level.demo.from);
      var toX = this.colCenter(this.demo.to);
      this.pointer.x = lerp(fromX, toX, easeOut(u));
      if (u >= 1) {
        this.demo.stage = 'thrown';
        this.targetCol = this.demo.to;
        this._release();
      }
    }
  };

  Session.prototype._updateSuck = function () {
    var allDone = true;
    for (var i = 0; i < this.held.length; i++) {
      var piece = this.held[i];
      var local = (this.phaseT - piece.fromBottom * T.suckStagger) / T.suckOne;
      if (local < 1) allDone = false;
      var t = clamp(local, 0, 1);
      var hand = this.handTarget(piece);
      var e = easeOut(t);
      var xE = t < 0.42 ? 0 : easeOut((t - 0.42) / 0.58);
      piece.x = lerp(piece.suckFromX, hand.x, xE);
      piece.y = lerp(piece.suckFromY, hand.y, e);
      piece.scale = 1;
      piece.scaleY = 1 + Math.sin(Math.PI * t) * 0.34;
      if (local >= 0 && !piece.suckSound && this.audio) {
        piece.suckSound = true;
        this.audio.suck();
      }
    }
    this.slotA = Math.min(1, this.phaseT / T.slotFade);
    this.slotX = this.colCenter(this.sourceCol);
    var intro = easeOut(clamp(this.phaseT / T.spoonIn, 0, 1));
    var from = this.spoonGrabFrom || { x: this.colCenter(this.sourceCol), y: this.pointer.y, rot: 0 };
    this.spoon.on = true;
    this.spoon.alpha = 1;
    this.spoon.x = lerp(from.x, this._spoonX(this.colCenter(this.sourceCol)), intro);
    this.spoon.y = lerp(from.y, this.pointer.y - 62, intro);
    this.spoon.rot = lerp(from.rot || 0, -0.12, intro);
    this.spoon.scale = 1;
    this.spoon.scaleY = 1;
    if (!allDone) return;
    this.phase = 'holding';
    this.phaseT = 0;
    if (this.ghostMode && this.demo) this.demo.stage = 'move';
    if (this.pendingUp) {
      this.pointer.x = this.pendingUp.x;
      this.pointer.y = this.pendingUp.y;
      this.pendingUp = null;
      this.targetCol = this.columnByHysteresis(this.pointer.x, this.sourceCol);
      this._release();
    }
  };

  Session.prototype._updateHold = function (dt) {
    var k = 1 - Math.exp(-dt / T.followTau);
    var breath = (1 - Math.cos((this.phaseT / T.chargeBreath) * Math.PI)) / 2;
    for (var i = 0; i < this.held.length; i++) {
      var piece = this.held[i];
      var hand = this.handTarget(piece);
      piece.x += (hand.x - piece.x) * k;
      piece.y += (hand.y + breath * 7 - piece.y) * k;
      piece.scale += (1 - piece.scale) * k;
      piece.scaleY += (lerp(1, 0.84, breath) - piece.scaleY) * k;
    }
    var spoonX = this._spoonX(this.pointer.x);
    var spoonY = this.pointer.y - 62 + breath * 6;
    this.spoon.x += (spoonX - this.spoon.x) * k;
    this.spoon.y += (spoonY - this.spoon.y) * k;
    this.spoon.alpha = 1;
    this.spoon.on = true;
    this.spoon.scale = 1;
    this.spoon.scaleY = lerp(1, 0.9, breath);
    this.spoon.rot += (-0.12 - this.spoon.rot) * k;
    if (!this.ghostMode || (this.demo && this.demo.stage !== 'move')) {
      this.targetCol = this.columnByHysteresis(this.pointer.x, this.targetCol);
    } else if (this.demo && this.demo.stage === 'move') {
      this.targetCol = this.columnByHysteresis(this.pointer.x, this.targetCol);
    }
    var rows = NS.placeRows(this.logic, this.targetCol, this.held.length);
    this.slotWarm = this.targetCol !== this.sourceCol && !rows;
    var dest = this.colCenter(this.targetCol);
    this.slotX += (dest - this.slotX) * (1 - Math.exp(-dt / 40));
    this.slotA = Math.min(1, this.slotA + dt / T.slotFade);
  };

  Session.prototype._updateReturn = function () {
    var allDone = true;
    for (var i = 0; i < this.held.length; i++) {
      var piece = this.held[i];
      var local = (this.phaseT - piece.retDelay) / T.returnOne;
      if (local < 1) allDone = false;
      var t = clamp(local, 0, 1);
      var dest = cellCenter(this.layout, piece.originCol, piece.originRow);
      var e = easeOut(t);
      piece.x = lerp(piece.retFromX, dest.x, e);
      piece.y = lerp(piece.retFromY, dest.y, e);
      piece.scaleY = t > 0.65 ? 1 - Math.sin((t - 0.65) / 0.35 * Math.PI) * 0.14 : 1;
      piece.scale = 1;
    }
    this.slotA = Math.max(0, this.slotA - this.phaseT / T.slotFade);
    this.spoon.alpha = Math.max(0, 1 - this.phaseT / T.spoonIn);
    if (!allDone) return;
    if (!this.ghostMode) {
      for (var j = 0; j < this.held.length; j++) {
        var back = this.held[j];
        this.logic[back.originCol][back.originRow] = back.type;
        back.col = back.originCol;
        back.row = back.originRow;
        back.settled = true;
        back.scaleY = 1;
      }
    }
    this.held = [];
    this.spoon.on = false;
    this.spoon.alpha = 0;
    this.phase = this.ghostMode ? 'ghostFade' : 'idle';
    this.phaseT = 0;
  };

  Session.prototype._spoonX = function (pointerX) {
    var left = pointerX - 42;
    if (left < 36) return pointerX + 42;
    if (left > this.layout.w - 36) return pointerX - 42;
    return left;
  };

  Session.prototype._placeSpoon = function (x, y, alpha, rot) {
    this.spoon.on = true;
    this.spoon.x = x;
    this.spoon.y = y;
    this.spoon.alpha = alpha;
    this.spoon.rot = rot;
    this.spoon.scale = 1;
    this.spoon.scaleY = 1;
  };

  Session.prototype._updateSquash = function () {
    var e = easeIn(clamp(this.phaseT / T.chargeDown, 0, 1));
    var dip = 28 * e;
    for (var i = 0; i < this.held.length; i++) {
      var piece = this.held[i];
      piece.x = piece.chargeFromX;
      piece.y = piece.chargeFromY + dip;
      piece.scale = lerp(1, 1.16, e);
      piece.scaleY = lerp(1, 0.64, e);
    }
    this.spoon.x = this.spoon.chargeFromX;
    this.spoon.y = this.spoon.chargeFromY + dip;
    this.spoon.scale = lerp(1, 1.08, e);
    this.spoon.scaleY = lerp(1, 0.78, e);
    this.spoon.alpha = 1;
    this.spoon.on = true;
    if (this.phaseT >= T.chargeDown + T.chargeHold) this._beginFlight();
  };

  Session.prototype._updateFlight = function (dt) {
    var allDone = true;
    for (var i = 0; i < this.held.length; i++) {
      var piece = this.held[i];
      var dest = cellCenter(this.layout, piece.placeCol, piece.placeRow);
      if (!piece.landing) {
        var local = this.phaseT - piece.depart;
        if (local < this.throwDur) {
          allDone = false;
          if (local >= 0) {
            var t = local / this.throwDur;
            var xEase = clamp(local / T.throwHoriz, 0, 1);
            piece.x = lerp(piece.flyFromX, dest.x, easeOut(xEase));
            piece.y = lerp(piece.flyFromY, dest.y, easeOut(t));
            piece.scale = lerp(1.16, 1, t);
            piece.scaleY = t < 0.32 ? lerp(0.64, 1.46, t / 0.32) : lerp(1.46, 1, (t - 0.32) / 0.68);
          }
          continue;
        }
        piece.landing = true;
        piece.landT = 0;
        piece.x = dest.x;
        piece.y = dest.y;
        if (!piece.landSound && this.audio) {
          piece.landSound = true;
          this.audio.land();
        }
      }
      piece.landT += dt;
      var lt = piece.landT / T.land;
      if (lt < 1) allDone = false;
      piece.scale = keyScale(clamp(lt, 0, 1), LAND_SCALE);
      piece.scaleY = piece.scale;
      if (lt >= 1 && !piece.landed) {
        piece.landed = true;
        if (!this.ghostMode) {
          this.logic[piece.placeCol][piece.placeRow] = piece.type;
          piece.col = piece.placeCol;
          piece.row = piece.placeRow;
          piece.settled = true;
        }
      }
    }
    var flick = this.phaseT;
    if (flick < T.spoonFlick) {
      var flickU = flick / T.spoonFlick;
      this.spoon.y = this.spoon.flickFromY - 52 * easeOut(flickU);
      this.spoon.rot = lerp(this.spoon.flickFromRot, -0.55, easeOut(flickU));
      this.spoon.scaleY = lerp(0.78, 1.2, flickU);
      this.spoon.alpha = 1;
      this.spoon.on = true;
    } else {
      var flickOut = clamp((flick - T.spoonFlick) / T.spoonFade, 0, 1);
      this.spoon.y = (this.spoon.flickFromY - 52) + 36 * flickOut;
      this.spoon.alpha = 1 - flickOut;
      this.spoon.on = this.spoon.alpha > 0.02;
    }
    if (allDone) {
      this.held = [];
      this.slotA = 0;
      this.phase = this.ghostMode ? 'ghostFade' : 'prejudge';
      this.phaseT = 0;
    }
  };

  Session.prototype._startResolve = function () {
    var groups = NS.findGroups(this.logic);
    if (!groups.length) {
      this._finishCheck();
      return;
    }
    this.wave += 1;
    if (this.wave > this.maxWave) this.maxWave = this.wave;
    this.groups = groups;
    var maxSize = 0;
    var cells = [];
    for (var g = 0; g < groups.length; g++) {
      if (groups[g].length > maxSize) maxSize = groups[g].length;
      for (var i = 0; i < groups[g].length; i++) cells.push(groups[g][i]);
    }
    if (this.wave >= 2 || maxSize >= 5) {
      this.shake = T.shake;
      this.combo = {
        text: this.wave >= 2 ? this.wave + ' 连锁' : maxSize + ' 颗一起',
        age: 0
      };
    }
    if (this.audio) this.audio.pop(this.wave);
    for (var n = 0; n < this.pieces.length; n++) this.pieces[n].glow = false;
    for (var g2 = 0; g2 < groups.length; g2++) {
      for (var k = 0; k < groups[g2].length; k++) {
        var glowing = this.pieceAt(groups[g2][k].c, groups[g2][k].r);
        if (glowing) glowing.glow = true;
      }
    }
    var sx = 0;
    var sy = 0;
    for (var c = 0; c < cells.length; c++) {
      sx += cells[c].c;
      sy += cells[c].r;
    }
    this.impact = {
      col: Math.round(sx / cells.length),
      row: Math.round(sy / cells.length)
    };
    this.phase = 'pulsing';
    this.phaseT = 0;
  };

  Session.prototype._armBreak = function () {
    this._breaking = [];
    for (var g = 0; g < this.groups.length; g++) {
      for (var i = 0; i < this.groups[g].length; i++) {
        var cell = this.groups[g][i];
        var piece = this.pieceAt(cell.c, cell.r);
        if (!piece) continue;
        var dist = Math.abs(piece.col - this.impact.col) + Math.abs(piece.row - this.impact.row);
        piece.breakDelay = dist * T.breakStagger;
        piece.dropsSpawned = false;
        piece.breaking = true;
        this._breaking.push(piece);
      }
    }
    this._dropBudget = this.groups.length && this.groups[0].length >= 5 ? 6 : 4;
  };

  Session.prototype._updateBreak = function () {
    var allDone = true;
    var list = this._breaking || [];
    for (var i = 0; i < list.length; i++) {
      var piece = list[i];
      var local = (this.phaseT - piece.breakDelay) / T.breakOne;
      if (local < 1) allDone = false;
      var e = clamp(local, 0, 1);
      piece.scale = 1 + 0.35 * easeOut(e);
      piece.opacity = 1 - e;
      if (local >= 0 && !piece.dropsSpawned) {
        piece.dropsSpawned = true;
        this._spawnDrops(piece, this._dropBudget || 4);
      }
    }
    if (!allDone) return;
    for (var j = 0; j < list.length; j++) {
      var gone = list[j];
      this.logic[gone.col][gone.row] = null;
      gone.alive = false;
      gone.settled = false;
    }
    this._startFalls();
  };

  Session.prototype._spawnDrops = function (piece, count) {
    if (this.drops.length > 36) count = Math.min(count, 2);
    for (var i = 0; i < count; i++) {
      var ang = Math.random() * Math.PI * 2;
      var dist = 24 + Math.random() * 16;
      this.drops.push({
        x: piece.x,
        y: piece.y,
        ox: piece.x,
        oy: piece.y,
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist,
        age: 0,
        rot: ang
      });
    }
  };

  Session.prototype._updateDrops = function (dt) {
    for (var i = this.drops.length - 1; i >= 0; i--) {
      var drop = this.drops[i];
      drop.age += dt;
      if (drop.age >= T.dropLife) this.drops.splice(i, 1);
    }
  };

  Session.prototype._startFalls = function () {
    var plan = NS.planFalls(this.logic);
    this._falling = [];
    for (var i = 0; i < plan.length; i++) {
      var move = plan[i];
      var piece = this.pieceAt(move.col, move.from);
      if (!piece) continue;
      piece.fallFrom = move.from;
      piece.fallTo = move.to;
      piece.settled = false;
      piece.fallDone = false;
      this.logic[move.col][move.from] = null;
      this._falling.push(piece);
    }
    var maxFrom = -1;
    for (var j = 0; j < this._falling.length; j++) {
      if (this._falling[j].fallFrom > maxFrom) maxFrom = this._falling[j].fallFrom;
    }
    for (var k = 0; k < this._falling.length; k++) {
      var falling = this._falling[k];
      falling.fallDelay = (maxFrom - falling.fallFrom) * T.fallStagger;
      falling.fallCells = falling.fallTo - falling.fallFrom;
    }
    this.phase = 'falling';
    this.phaseT = 0;
    if (!this._falling.length) {
      this.phase = 'chainpause';
      this.phaseT = 0;
    }
  };

  Session.prototype._updateFall = function () {
    var allDone = true;
    for (var i = 0; i < this._falling.length; i++) {
      var piece = this._falling[i];
      var moveDur = piece.fallCells * T.fallCell;
      var local = this.phaseT - piece.fallDelay;
      var from = cellCenter(this.layout, piece.col, piece.fallFrom);
      var to = cellCenter(this.layout, piece.col, piece.fallTo);
      if (local < 0) {
        allDone = false;
        continue;
      }
      if (local < moveDur) {
        allDone = false;
        var e = easeIn(local / moveDur);
        piece.x = lerp(from.x, to.x, e);
        piece.y = lerp(from.y, to.y, e);
        piece.scaleY = 1;
      } else if (local < moveDur + T.fallSettle) {
        allDone = false;
        piece.x = to.x;
        piece.y = to.y;
        var s = (local - moveDur) / T.fallSettle;
        piece.scaleY = 1 - Math.sin(s * Math.PI) * 0.14;
      } else if (!piece.fallDone) {
        piece.fallDone = true;
        piece.x = to.x;
        piece.y = to.y;
        piece.scaleY = 1;
        piece.row = piece.fallTo;
        piece.settled = true;
        this.logic[piece.col][piece.fallTo] = piece.type;
      }
    }
    if (allDone) {
      this.phase = 'chainpause';
      this.phaseT = 0;
    }
  };

  Session.prototype._finishCheck = function () {
    this.wave = 0;
    if (NS.isEmpty(this.logic)) {
      this.outcome = 'win';
      this.phase = 'result';
    } else if (this.spoons <= 0) {
      this.outcome = 'lose';
      this.phase = 'result';
    } else {
      this.outcome = null;
      this.phase = 'idle';
    }
    this.phaseT = 0;
  };

  Session.prototype._updateGhostFade = function () {
    var t = clamp(this.phaseT / 200, 0, 1);
    for (var i = 0; i < this.pieces.length; i++) {
      if (this.pieces[i].ghost && this.pieces[i].alive) this.pieces[i].opacity = 0.78 * (1 - t);
    }
    if (t < 1) return;
    for (var j = 0; j < this.pieces.length; j++) {
      if (this.pieces[j].ghost) this.pieces[j].alive = false;
    }
    this.ghostMode = false;
    this.demo = null;
    this.phase = 'idle';
    this.phaseT = 0;
  };

  Session.prototype._layoutPlayButtons = function () {
    var layout = this.layout;
    this.buttons = [];
    var hudY = Math.max(12, layout.topBar - 58);
    if (this.ghostMode) {
      this.buttons.push({ id: 'skip', label: '跳过示范', x: 16, y: hudY, w: 96, h: 36 });
    } else if (this.phase === 'idle' || this.phase === 'holding' || this.phase === 'sucking') {
      this.buttons.push({ id: 'restart', label: '重开', x: 16, y: hudY, w: 64, h: 32 });
    }
  };

  Session.prototype._layoutResultButtons = function () {
    var layout = this.layout;
    var cardW = Math.min(320, layout.w - 40);
    var cardX = (layout.w - cardW) / 2;
    var cardY = this._cardY();
    var buttons = [];
    var y = cardY + 148;
    var gap = 48;
    if (this.outcome === 'win' && this.level.id < NS.LEVELS.length) {
      buttons.push({ id: 'next', label: '下一关', x: cardX + 24, y: y, w: cardW - 48, h: 42 });
      y += gap;
    }
    buttons.push({ id: 'restart', label: '再来一盘', x: cardX + 24, y: y, w: cardW - 48, h: 42 });
    y += gap;
    buttons.push({ id: 'home', label: '回柜台', x: cardX + 24, y: y, w: cardW - 48, h: 42 });
    y += gap;
    buttons.push({ id: 'share', label: '告诉朋友这句', x: cardX + 24, y: y, w: cardW - 48, h: 42 });
    if (this.outcome === 'lose' && this.level.id >= 4) {
      y += gap;
      buttons.push({ id: 'ad', label: '看视频，再给 5 勺', x: cardX + 24, y: y, w: cardW - 48, h: 42 });
    }
    this.buttons = buttons;
    this._cardBottom = y + 52;
  };

  Session.prototype._cardY = function () {
    var arrived = easeOut(clamp(this.phaseT / T.cardIn, 0, 1));
    var rest = Math.max(72, this.layout.h * 0.22);
    return lerp(this.layout.h + 20, rest, arrived);
  };

  Session.prototype.shareText = function () {
    if (this.maxWave >= 2) return '我在云朵果冻铺第 ' + this.level.id + ' 关接上了 ' + this.maxWave + ' 波';
    if (this.outcome === 'win') return '我在云朵果冻铺清空了第 ' + this.level.id + ' 关';
    return '云朵果冻铺第 ' + this.level.id + ' 关，这盘还没清空';
  };

  Session.prototype.draw = function (ctx) {
    var layout = this.layout;
    var shakeX = 0;
    if (this.shake > 0) shakeX = Math.sin(this.shake * 0.45) * 2 * (this.shake / T.shake);
    ctx.save();
    ctx.translate(shakeX, 0);
    this._drawBoard(ctx);
    this._drawGuide(ctx);
    this._drawDock(ctx);
    this._drawAim(ctx);
    this._drawSpoon(ctx);
    this._drawPieces(ctx);
    this._drawDrops(ctx);
    this._drawCombo(ctx);
    ctx.restore();
    this._drawHud(ctx);
    if (this.phase === 'result') this._drawResult(ctx);
  };

  Session.prototype._drawBoard = function (ctx) {
    var layout = this.layout;
    if (this.phase === 'holding' && this.pointer.y <= layout.dockBottom) {
      ctx.save();
      ctx.globalAlpha = clamp(this.phaseT / T.hintIn, 0, 1);
      ctx.fillStyle = '#7a3d4e';
      ctx.font = '600 15px "WenQuanYi Micro Hei", "PingFang SC", "Noto Sans SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('松手，向上发射', clamp(this.pointer.x, 92, layout.w - 92), Math.min(this.pointer.y - 28, layout.dockTop - 8));
      ctx.restore();
    }
    if (this.phase === 'holding' && this.pointer.y > layout.dockBottom + 18) {
      ctx.save();
      ctx.fillStyle = '#7a3d4e';
      ctx.font = '600 16px "WenQuanYi Micro Hei", "PingFang SC", "Noto Sans SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('放回', layout.w / 2, layout.h - 18);
      ctx.restore();
    }
  };

  Session.prototype._drawGuide = function (ctx) {
    var sprite = this.images.track;
    if (!sprite) return;
    var layout = this.layout;
    var trackBottom = this._dockCenter(0).y + layout.cell * 0.7;
    for (var c = 0; c < NS.COLS; c++) {
      var focus = Math.max(this.wellA[c] || 0, this._missStrength(c));
      var bw = layout.cell * (0.84 + focus * 0.1);
      var x = layout.gridX + (c + 0.5) * layout.cell - bw / 2;
      ctx.save();
      ctx.globalAlpha = 0.78 + focus * 0.22;
      ctx.drawImage(sprite, x, layout.gridY - 6, bw, trackBottom - layout.gridY + 6);
      ctx.restore();
    }
  };

  Session.prototype._hintLift = function (col) {
    var level = this.level;
    if (!level || level.id > 2 || level.hintCol !== col) return 0;
    if (this.phase !== 'idle' && !this.ghostMode) return 0;
    var hop = T.hintHop;
    var total = hop * 4;
    if (this.time < 0 || this.time >= total) return 0;
    var local = this.time % (hop * 2);
    return 12 * Math.sin((local / (hop * 2)) * Math.PI);
  };

  Session.prototype._missStrength = function (col) {
    if (this.missCol !== col) return 0;
    var age = this.time - this.missAt;
    if (age < 0) return 0;
    if (age < T.missUp) return age / T.missUp;
    if (age < T.missUp + T.missDown) return 1 - (age - T.missUp) / T.missDown;
    return 0;
  };

  Session.prototype._drawDock = function (ctx) {
    var layout = this.layout;
    var well = this.images.well;
    var spoon = this.images.spoon;
    if (this.images.deck) {
      ctx.save();
      ctx.drawImage(this.images.deck, layout.gridX - 28, layout.dockTop - 36, layout.gridW + 56, layout.dockBottom - layout.dockTop + 46);
      ctx.restore();
    }
    for (var c = 0; c < NS.COLS; c++) {
      var focus = Math.max(this.wellA[c] || 0, this._missStrength(c));
      var hint = this._hintLift(c);
      var center = this._dockCenter(c);
      var scale = 1 + focus * 0.08;
      var y = center.y - focus * 8 - hint;
      var bw = layout.cell * 0.92 * scale;
      var bh = Math.min(layout.cell * 1.05, (layout.dockBottom - layout.dockTop) * 0.62) * scale;
      if (well) {
        ctx.save();
        ctx.globalAlpha = 0.82 + focus * 0.18;
        ctx.drawImage(well, center.x - bw / 2, y - bh / 2, bw, bh);
        ctx.restore();
      }
      var idleAlpha = 0.96;
      if (this.spoon.on && c === this.sourceCol && this.phase !== 'idle') idleAlpha = Math.max(0, 0.96 * (1 - this.spoon.alpha));
      if (spoon && idleAlpha > 0.04) {
        ctx.save();
        ctx.globalAlpha = idleAlpha;
        ctx.translate(center.x, y - 2);
        ctx.rotate(0.06);
        var sw = layout.cell * 0.36;
        ctx.drawImage(spoon, -sw / 2, -sw * 0.45, sw, sw * 1.9);
        ctx.restore();
      }
    }
    if (this.missCol >= 0) {
      var age = this.time - this.missAt;
      var alpha = 0;
      if (age < T.missIn) alpha = age / T.missIn;
      else if (age < T.missIn + T.missHold) alpha = 1;
      else if (age < T.missIn + T.missHold + T.missOut) alpha = 1 - (age - T.missIn - T.missHold) / T.missOut;
      if (alpha > 0) {
        var at = this._dockCenter(this.missCol);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#7a3d4e';
        ctx.font = '600 15px "WenQuanYi Micro Hei", "PingFang SC", "Noto Sans SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('按这一把勺子', clamp(at.x, 78, layout.w - 78), layout.dockTop - 12);
        ctx.restore();
      }
    }
  };

  Session.prototype._drawAim = function (ctx) {
    if (this.phase !== 'holding' && this.phase !== 'squashing') return;
    var sprite = this.images.drop;
    if (!sprite || this.slotA < 0.05) return;
    var layout = this.layout;
    for (var i = 0; i < 3; i++) {
      var local = (this.time + i * T.aimStagger) % T.aimCycle;
      var alpha = 1;
      if (local < T.aimFadeIn) alpha = local / T.aimFadeIn;
      else if (local > T.aimCycle - T.aimFadeOut) alpha = (T.aimCycle - local) / T.aimFadeOut;
      var y = layout.gridY + layout.gridH - 18 - (local / T.aimCycle) * layout.gridH * 0.66;
      ctx.save();
      ctx.globalAlpha = alpha * this.slotA;
      ctx.translate(this.slotX, y);
      ctx.drawImage(sprite, -8, -11, 16, 22);
      ctx.restore();
    }
  };

  Session.prototype._drawSpoon = function (ctx) {
    if (!this.spoon.on || this.spoon.alpha <= 0.02 || !this.images.spoon) return;
    ctx.save();
    ctx.translate(this.spoon.x, this.spoon.y);
    ctx.rotate(this.spoon.rot || 0);
    ctx.scale(this.spoon.scale || 1, this.spoon.scaleY || 1);
    ctx.globalAlpha = this.spoon.alpha;
    ctx.drawImage(this.images.spoon, -26, -18, 52, 96);
    ctx.restore();
  };

  Session.prototype._drawPieces = function (ctx) {
    var list = this.pieces.filter(function (p) { return p.alive && !p.ghost; });
    var ghosts = this.pieces.filter(function (p) { return p.alive && p.ghost; });
    list.sort(function (a, b) { return a.y - b.y; });
    for (var i = 0; i < list.length; i++) this._drawPiece(ctx, list[i]);
    for (var j = 0; j < ghosts.length; j++) this._drawPiece(ctx, ghosts[j]);
    if (this.held.length >= 2 && (this.phase === 'holding' || this.phase === 'sucking')) {
      var anchor = this.held[this.held.length - 1];
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(anchor.x + 22, anchor.y - 8, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6a4450';
      ctx.font = '700 12px "WenQuanYi Micro Hei", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(this.held.length), anchor.x + 22, anchor.y - 7);
      ctx.restore();
    }
  };

  Session.prototype._drawPiece = function (ctx, piece) {
    var sprite = this.images[NS.TYPE_META[piece.type].sprite];
    var size = this.layout.cell * 0.9 * piece.scale;
    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.scale(1, piece.scaleY || 1);
    ctx.globalAlpha = piece.opacity;
    if (sprite) ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    if (piece.glow && this.phase === 'pulsing') {
      ctx.globalAlpha = 0.22 * clamp(this.phaseT / T.pulse, 0, 1);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  Session.prototype._drawDrops = function (ctx) {
    var sprite = this.images.drop;
    if (!sprite) return;
    for (var i = 0; i < this.drops.length; i++) {
      var drop = this.drops[i];
      var t = drop.age / T.dropLife;
      var e = easeOut(t);
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.translate(drop.ox + drop.dx * e, drop.oy + drop.dy * e);
      ctx.rotate(drop.rot);
      ctx.drawImage(sprite, -10, -12, 20, 24);
      ctx.restore();
    }
  };

  Session.prototype._drawCombo = function (ctx) {
    if (!this.combo) return;
    var age = this.combo.age;
    var alpha = 1;
    var scale = 1;
    if (age < T.comboIn) {
      var t = age / T.comboIn;
      alpha = t;
      scale = lerp(0.82, 1, easeOut(t));
    } else if (age > T.comboIn + T.comboHold) {
      alpha = 1 - (age - T.comboIn - T.comboHold) / T.comboOut;
    }
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.translate(this.layout.w / 2, this.layout.gridY + 28);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#a24b62';
    ctx.font = '700 28px "WenQuanYi Micro Hei", "PingFang SC", "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.combo.text, 0, 0);
    ctx.restore();
  };

  Session.prototype._drawHud = function (ctx) {
    var layout = this.layout;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6a4450';
    ctx.font = '600 16px "WenQuanYi Micro Hei", "PingFang SC", "Noto Sans SC", sans-serif';
    var hudY = Math.max(12, layout.topBar - 58);
    if (this.images.spoon) ctx.drawImage(this.images.spoon, 92, hudY - 2, 20, 34);
    ctx.fillText('勺子 ' + this.spoons, 116, hudY + 16);
    ctx.fillText('第 ' + this.level.id + ' 关 · ' + this.level.title, 16, layout.topBar - 8);
    ctx.font = '500 14px "WenQuanYi Micro Hei", "PingFang SC", "Noto Sans SC", sans-serif';
    ctx.fillStyle = 'rgba(90, 49, 64, 0.8)';
    ctx.fillText(this.level.hint, 16, layout.gridY - 16);
    if (this.phase !== 'result') this._drawButtons(ctx, this.buttons);
    ctx.restore();
  };

  Session.prototype._drawButtons = function (ctx, buttons) {
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      roundRect(ctx, button.x, button.y, button.w, button.h, 14);
      ctx.fillStyle = button.id === 'next' || button.id === 'start' ? '#ff8fab' : 'rgba(255,248,244,0.94)';
      ctx.fill();
      ctx.fillStyle = '#5a3140';
      ctx.font = '600 16px "WenQuanYi Micro Hei", "PingFang SC", "Noto Sans SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 + 1);
    }
  };

  Session.prototype._drawResult = function (ctx) {
    var layout = this.layout;
    var dim = this.outcome === 'lose'
      ? clamp(this.phaseT / T.failDim, 0, 1) * 0.45
      : clamp(this.phaseT / T.cardIn, 0, 1) * 0.28;
    ctx.save();
    ctx.fillStyle = 'rgba(80, 48, 58, ' + dim + ')';
    ctx.fillRect(0, 0, layout.w, layout.h);
    var cardW = Math.min(320, layout.w - 40);
    var cardX = (layout.w - cardW) / 2;
    var cardY = this._cardY();
    var cardH = Math.max(280, (this._cardBottom || cardY + 360) - cardY);
    roundRect(ctx, cardX, cardY, cardW, cardH, 22);
    ctx.fillStyle = '#fffaf7';
    ctx.fill();
    ctx.fillStyle = '#5a3140';
    ctx.textAlign = 'center';
    ctx.font = '700 26px "WenQuanYi Micro Hei", "PingFang SC", "Noto Sans SC", sans-serif';
    ctx.fillText(this.outcome === 'win' ? '这盘清空了' : '勺子用完了', layout.w / 2, cardY + 48);
    ctx.font = '500 16px "WenQuanYi Micro Hei", "PingFang SC", "Noto Sans SC", sans-serif';
    var line = this.maxWave >= 2 ? '接上了 ' + this.maxWave + ' 波' : '这一盘的连锁不多';
    ctx.fillText(line, layout.w / 2, cardY + 86);
    ctx.font = '500 14px "WenQuanYi Micro Hei", "PingFang SC", "Noto Sans SC", sans-serif';
    ctx.fillStyle = 'rgba(90,49,64,0.75)';
    ctx.fillText('分享不给道具', layout.w / 2, cardY + 118);
    this._drawButtons(ctx, this.buttons);
    ctx.restore();
  };

  Session.prototype.snapshot = function () {
    return {
      phase: this.phase,
      spoons: this.spoons,
      outcome: this.outcome,
      empty: NS.isEmpty(this.logic),
      maxWave: this.maxWave,
      time: this.time,
      ghost: this.ghostMode,
      held: this.held.length
    };
  };

  NS.computeLayout = computeLayout;
  NS.Session = Session;
  NS.roundRect = roundRect;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof globalThis !== 'undefined' ? globalThis : this);
