(() => {
  const SAVE_KEY = "duihao-fache-progress";
  const FREE_UNDOS = 2;
  const BUS_W = 28;
  const CAR_W = 20;

  const screens = {
    start: document.getElementById("screen-start"),
    select: document.getElementById("screen-select"),
    play: document.getElementById("screen-play")
  };

  let progress = { unlocked: 1, cleared: [] };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) progress = { ...progress, ...JSON.parse(raw) };
  } catch (e) {}

  function save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  }

  function show(name) {
    Object.values(screens).forEach((el) => el.classList.remove("active"));
    screens[name].classList.add("active");
  }

  function toast(text) {
    const el = document.getElementById("toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 1400);
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /* ---------- select grid ---------- */
  function renderSelect() {
    const grid = document.getElementById("level-grid");
    grid.innerHTML = "";
    for (let i = 1; i <= 20; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "level-btn";
      const playable = i <= Math.max(progress.unlocked, 3) && i <= 3;
      const locked = i > 3 || i > progress.unlocked;
      if (progress.cleared.includes(i)) b.classList.add("cleared");
      if (locked) {
        b.classList.add("locked");
        b.textContent = i > 3 ? i : i;
        if (i > 3) b.title = "后面的关卡还没做";
      } else {
        b.textContent = String(i);
        b.addEventListener("click", () => startLevel(i));
      }
      grid.appendChild(b);
    }
  }

  /* ---------- play state ---------- */
  let levelId = 1;
  let state = null;
  let busy = false;

  function startLevel(id) {
    levelId = id;
    const def = LEVELS[id - 1];
    state = {
      queue: def.queue.slice(),
      slots: Array(def.slots).fill(null),
      vehicles: def.vehicles.map((v) => ({
        ...v,
        status: "lot", // lot | slot | gone
        boarded: 0
      })),
      steps: 0,
      undos: FREE_UNDOS,
      history: [],
      result: null
    };
    hideOverlays();
    show("play");
    renderPlay(true);
  }

  function hideOverlays() {
    document.getElementById("overlay-win").classList.remove("show");
    document.getElementById("overlay-fail").classList.remove("show");
    document.getElementById("overlay-ad").classList.remove("show");
  }

  function snapshot() {
    state.history.push({
      queue: state.queue.slice(),
      slots: state.slots.slice(),
      vehicles: clone(state.vehicles),
      steps: state.steps
    });
  }

  function vehicleById(id) {
    return state.vehicles.find((v) => v.id === id);
  }

  function isBlocked(v) {
    if (!v.blockedBy) return false;
    const other = vehicleById(v.blockedBy);
    return other && other.status === "lot";
  }

  function firstFreeSlot() {
    const i = state.slots.indexOf(null);
    return i;
  }

  function posOf(v) {
    if (v.at === "ahead") return AHEAD[v.stall];
    return STALL[v.stall];
  }

  function renderPlay() {
    const def = LEVELS[levelId - 1];
    document.getElementById("hud-level").textContent = def.title;
    document.getElementById("hud-steps").textContent = `步数 ${state.steps}`;
    document.getElementById("btn-undo").disabled = false;

    const lot = document.getElementById("lot");
    lot.innerHTML = "";
    state.vehicles.forEach((v) => {
      if (v.status !== "lot") return;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "vehicle";
      el.dataset.id = v.id;
      const w = v.kind === "car" ? CAR_W : BUS_W;
      const p = posOf(v);
      el.style.width = w + "%";
      el.style.left = p.x + "%";
      el.style.top = p.y + "%";
      const src = v.kind === "car" ? "assets/car-blocker.png" : LINE[v.line].bus;
      el.innerHTML = `<img src="${src}" alt="${v.kind === "car" ? "挡路车" : v.line + "线巴士"}" />`;
      el.addEventListener("click", () => onTap(v.id, el));
      lot.appendChild(el);
    });

    const qd = document.getElementById("queue-dock");
    qd.innerHTML = "";
    state.queue.forEach((line, i) => {
      const img = document.createElement("img");
      img.className = "pax";
      img.src = LINE[line].pax;
      img.alt = line + "线乘客";
      img.style.zIndex = String(20 - i);
      qd.appendChild(img);
    });

    const sd = document.getElementById("slot-dock");
    sd.innerHTML = "";
    state.slots.forEach((vid) => {
      const bay = document.createElement("div");
      bay.className = "bay";
      bay.innerHTML = `<img class="bay-bg" src="assets/slot-bay.png" alt="上客槽" />`;
      if (vid) {
        const v = vehicleById(vid);
        if (v && v.status === "slot") {
          const img = document.createElement("img");
          img.className = "docked";
          img.src = LINE[v.line].bus;
          img.alt = v.line + "线巴士";
          bay.appendChild(img);
        }
      }
      sd.appendChild(bay);
    });
  }

  async function onTap(id, el) {
    if (busy || state.result) return;
    const v = vehicleById(id);
    if (!v || v.status !== "lot") return;
    if (isBlocked(v)) {
      el.classList.remove("blocked");
      void el.offsetWidth;
      el.classList.add("blocked");
      toast("被挡住了");
      return;
    }
    if (v.kind === "bus" && firstFreeSlot() === -1) {
      toast("上客槽满了");
      return;
    }
    snapshot();
    busy = true;
    if (v.kind === "car") {
      await departBlocker(v, el);
      state.steps += 1;
      resolveSlots();
      busy = false;
      renderPlay();
      checkEnd();
      return;
    }
    const slotIndex = firstFreeSlot();
    await moveBusToSlot(v, el, slotIndex);
    state.steps += 1;
    boardAndMaybeDepart(v);
    resolveSlots();
    busy = false;
    renderPlay();
    checkEnd();
  }

  function animateTo(el, x, y, w) {
    return new Promise((resolve) => {
      el.style.left = x + "%";
      el.style.top = y + "%";
      if (w) el.style.width = w + "%";
      const done = () => {
        el.removeEventListener("transitionend", done);
        resolve();
      };
      el.addEventListener("transitionend", done);
      setTimeout(done, 800);
    });
  }

  async function departBlocker(v, el) {
    v.status = "gone";
    await animateTo(el, 50, 115, CAR_W);
    el.style.opacity = "0";
  }

  async function moveBusToSlot(v, el, slotIndex) {
    const n = state.slots.length;
    const x = 18 + (slotIndex + 0.5) * (64 / n);
    await animateTo(el, x, 82, 24);
    v.status = "slot";
    state.slots[slotIndex] = v.id;
    el.style.opacity = "0";
  }

  function canBoard(v) {
    return state.queue.length > 0 && state.queue[0] === v.line && v.boarded < LEVELS[levelId - 1].capacity;
  }

  function canDepart(v) {
    const cap = LEVELS[levelId - 1].capacity;
    if (v.boarded <= 0) return false;
    if (v.boarded >= cap) return true;
    // 队首暂时都上不了这辆车
    return !state.queue.length || state.queue[0] !== v.line;
  }

  function boardAndMaybeDepart(v) {
    const cap = LEVELS[levelId - 1].capacity;
    while (canBoard(v)) {
      state.queue.shift();
      v.boarded += 1;
    }
    if (canDepart(v)) {
      departBus(v);
    }
  }

  function departBus(v) {
    const i = state.slots.indexOf(v.id);
    if (i >= 0) state.slots[i] = null;
    v.status = "gone";
  }

  function resolveSlots() {
    let changed = true;
    while (changed) {
      changed = false;
      state.vehicles.filter((v) => v.status === "slot").forEach((v) => {
        if (canBoard(v)) {
          while (canBoard(v)) {
            state.queue.shift();
            v.boarded += 1;
          }
          changed = true;
        }
        if (canDepart(v)) {
          departBus(v);
          changed = true;
        }
      });
    }
  }

  function checkEnd() {
    const leftoverPax = state.queue.length;
    const lotLeft = state.vehicles.filter((v) => v.status === "lot");
    const slotBuses = state.vehicles.filter((v) => v.status === "slot");

    if (leftoverPax === 0 && lotLeft.length === 0 && slotBuses.length === 0) {
      win();
      return;
    }

    // 死锁：槽全满，且槽里没有车能继续上客或发车，并且停车场里的巴士也进不来（槽已满）
    const full = state.slots.every((s) => s !== null);
    if (!full) return;
    const anyUseful = slotBuses.some((v) => canBoard(v) || canDepart(v));
    if (!anyUseful) {
      // 再给一次自动上客机会（队首变化后）
      let progressed = false;
      slotBuses.forEach((v) => {
        const before = v.boarded + String(v.status);
        boardAndMaybeDepart(v);
        if (v.boarded + String(v.status) !== before) progressed = true;
      });
      if (progressed) {
        renderPlay();
        checkEnd();
        return;
      }
      fail("上客槽堵死了，没有车能发车。");
    }
  }

  function win() {
    state.result = "win";
    if (!progress.cleared.includes(levelId)) progress.cleared.push(levelId);
    progress.unlocked = Math.max(progress.unlocked, levelId + 1);
    save();
    document.getElementById("win-msg").textContent = `用了 ${state.steps} 步`;
    const next = document.getElementById("btn-next");
    if (levelId >= 3) {
      next.querySelector("span").textContent = "回选关";
    } else {
      next.querySelector("span").textContent = "下一关";
    }
    document.getElementById("overlay-win").classList.add("show");
  }

  function fail(msg) {
    state.result = "fail";
    document.getElementById("fail-msg").textContent = msg;
    document.getElementById("overlay-fail").classList.add("show");
  }

  function undo() {
    if (busy || state.result) return;
    if (!state.history.length) {
      toast("没有可撤销的步骤");
      return;
    }
    if (state.undos <= 0) {
      watchAd(() => {
        state.undos += 1;
        applyUndo();
      });
      return;
    }
    applyUndo();
  }

  function applyUndo() {
    const snap = state.history.pop();
    state.queue = snap.queue;
    state.slots = snap.slots;
    state.vehicles = snap.vehicles;
    state.steps = snap.steps;
    state.undos -= 1;
    state.result = null;
    hideOverlays();
    renderPlay();
    toast(`剩余免费撤销 ${Math.max(state.undos, 0)} 次`);
  }

  function watchAd(done) {
    const ov = document.getElementById("overlay-ad");
    const num = document.getElementById("ad-countdown");
    let n = 3;
    num.textContent = String(n);
    ov.classList.add("show");
    const t = setInterval(() => {
      n -= 1;
      num.textContent = String(n);
      if (n <= 0) {
        clearInterval(t);
        ov.classList.remove("show");
        done();
      }
    }, 1000);
  }

  /* ---------- bindings ---------- */
  document.getElementById("btn-start").addEventListener("click", () => {
    let next = 1;
    for (let i = 1; i <= 3; i++) {
      if (!progress.cleared.includes(i) && i <= progress.unlocked) { next = i; break; }
    }
    startLevel(next);
  });
  document.getElementById("btn-to-select").addEventListener("click", () => {
    renderSelect();
    show("select");
  });
  document.getElementById("btn-select-back").addEventListener("click", () => show("start"));
  document.getElementById("btn-undo").addEventListener("click", undo);
  document.getElementById("btn-retry").addEventListener("click", () => startLevel(levelId));
  document.getElementById("btn-next").addEventListener("click", () => {
    if (levelId >= 3) {
      renderSelect();
      show("select");
    } else startLevel(levelId + 1);
  });
  document.getElementById("btn-win-select").addEventListener("click", () => {
    renderSelect();
    show("select");
  });
  document.getElementById("btn-fail-retry").addEventListener("click", () => startLevel(levelId));
  document.getElementById("btn-fail-select").addEventListener("click", () => {
    renderSelect();
    show("select");
  });
})();
