
/* -------------------------
   Utilities & Defaults
------------------------- */
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const midiToHz   = m => 440.0 * Math.pow(2, (m - 69) / 12);
const midiToNote = m => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);

const MIDI_ABS_LOW  = 20;
const MIDI_ABS_HIGH = 100;

const DEFAULTS = {
  midiLow: 48,
  midiHigh: 72,
  card: [3, 3],
  span: [0, 12],
  mixRatio: 0.5,
  duration: 2.5,
  aim: 0.8,
  win: 10,
};

/* -------------------------
   Storage
------------------------- */
const STORAGE = {
  CURRENT_USER: "eartrainer3_current_user",
  USER_PREFIX: "eartrainer3_user_",
  LAST_NON_GUEST_SETTINGS: "eartrainer3_last_non_guest_settings"
};

const Storage = {
  listUsers() {
    const users = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE.USER_PREFIX)) {
        users.push(k.slice(STORAGE.USER_PREFIX.length));
      }
    }
    return users.sort();
  },

  save(user, data) {
    if (user === "Guest") return;
    localStorage.setItem(STORAGE.USER_PREFIX + user, JSON.stringify(data));
    localStorage.setItem(STORAGE.CURRENT_USER, user);
    if (data.settings) {
      localStorage.setItem(STORAGE.LAST_NON_GUEST_SETTINGS, JSON.stringify(data.settings));
    }
  },

  load(user) {
    if (user === "Guest") {
      const raw = localStorage.getItem(STORAGE.LAST_NON_GUEST_SETTINGS);
      const settings = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
      return { settings, log: [] };
    }
    const raw = localStorage.getItem(STORAGE.USER_PREFIX + user);
    if (!raw) return { settings: { ...DEFAULTS }, log: [] };
    try {
      const parsed = JSON.parse(raw);
      return {
        settings: { ...DEFAULTS, ...(parsed.settings || {}) },
        log: Array.isArray(parsed.log) ? parsed.log : []
      };
    } catch {
      return { settings: { ...DEFAULTS }, log: [] };
    }
  },

  remove(user) {
    if (user === "Guest") return;
    localStorage.removeItem(STORAGE.USER_PREFIX + user);
    const cur = localStorage.getItem(STORAGE.CURRENT_USER);
    if (cur === user) localStorage.removeItem(STORAGE.CURRENT_USER);
  },

  lastUser() {
    return localStorage.getItem(STORAGE.CURRENT_USER) || "Guest";
  }
};

/* -------------------------
   Synth (final version)
------------------------- */
class Synth {
  constructor() {
    // Reuse one global AudioContext across all Synths
    if (!Synth.sharedCtx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      Synth.sharedCtx = new Ctor();
    }
    this.ctx = Synth.sharedCtx;

    // Track currently playing nodes (single voice)
    this.currentNodes = [];

    // Only install unlock once
    if (!Synth._unlockInstalled) {
      Synth._unlocked = false;
      const unlock = () => {
        if (Synth._unlocked) return;
        this.ctx.resume()
          .then(() => { Synth._unlocked = true; })
          .catch(() => {});
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      };
      window.addEventListener("pointerdown", unlock);
      window.addEventListener("keydown", unlock);
      Synth._unlockInstalled = true;
    }
  }

  playChord(midis, dur = DEFAULTS.duration) {
    if (!midis.length) return;

    // Kill any currently playing nodes
    this.currentNodes.forEach(node => {
      try { node.stop(); } catch {}
    });
    this.currentNodes = [];

    const now = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.connect(this.ctx.destination);

    // ADSR envelope
    const A = 0.02, D = 0.15, S = 0.75, R = 0.12;
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(1, now + A);
    masterGain.gain.linearRampToValueAtTime(S, now + A + D);
    masterGain.gain.setValueAtTime(S, now + dur - R);
    masterGain.gain.linearRampToValueAtTime(0, now + dur);

    midis.forEach(midi => {
      const f0 = midiToHz(midi);
      for (let h = 1; h <= 11; h++) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f0 * h;
        g.gain.value = 1 / h;
        osc.connect(g).connect(masterGain);
        osc.start(now);
        osc.stop(now + dur);

        // track nodes so we can kill them on next chord
        this.currentNodes.push(osc);
      }
    });
  }
}



/* -------------------------
   Trainer
------------------------- */
const keyRel = rel => JSON.stringify(rel);

function generateUniverse({ card: [cMin, cMax], span: [sMin, sMax] }) {
  const universe = [];
  const pool = Array.from({ length: sMax }, (_, i) => i + 1);
  function combos(arr, k, start = 0, chosen = []) {
    if (k === 0) {
      const rel = [0, ...chosen];
      const span = chosen.length ? chosen[chosen.length - 1] : 0;
      if (span >= sMin && span <= sMax) universe.push(rel);
      return;
    }
    for (let i = start; i <= arr.length - k; i++) {
      chosen.push(arr[i]);
      combos(arr, k - 1, i + 1, chosen);
      chosen.pop();
    }
  }
  for (let n = cMin; n <= cMax; n++) combos(pool, n - 1);
  return universe;
}

class Trainer {
  constructor(synth, initialSettings = {}) {
    this.synth = synth;
    this.settings = { ...DEFAULTS, ...initialSettings };
    this.universe = generateUniverse(this.settings);
    this.current = null;
    this.log = [];
  }

  changeSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.universe = generateUniverse(this.settings);
    if (this.current && this.current.answered) this.current = null;
  }

  _randomPick() {
    return this.universe[Math.floor(Math.random()*this.universe.length)];
  }

  nextTrial() {
    if (this.current && !this.current.answered) return this.current;
    const rel = this._randomPick();
    if (!rel) return (this.current = null);
    const maxOff = rel[rel.length-1];
    const rootHigh = this.settings.midiHigh - maxOff;
    const rootLow  = this.settings.midiLow;
    if (rootHigh < rootLow) return (this.current = null);
    const root = Math.floor(Math.random() * (rootHigh - rootLow + 1)) + rootLow;
    const midis = rel.map(r => root + r)
                     .filter(m => m >= this.settings.midiLow && m <= this.settings.midiHigh);
    this.current = { rel, root, midis, answered: false };
    if (midis.length > 0) this.synth.playChord(midis, this.settings.duration);
    return this.current;
  }

  replay() {
    if (this.current && this.current.midis) {
      const playable = this.current.midis.filter(
        m => m >= this.settings.midiLow && m <= this.settings.midiHigh
      );
      if (playable.length > 0) this.synth.playChord(playable, this.settings.duration);
    }
  }

  playGuess(guessRel) {
    if (!this.current) return;
    const root = this.current.root;
    const playable = guessRel.map(r => root + r)
      .filter(m => m >= this.settings.midiLow && m <= this.settings.midiHigh);
    if (playable.length > 0) this.synth.playChord(playable, this.settings.duration);
  }

  submitGuess(text) {
    if (!this.current || this.current.answered) return null;
    let nums = text.trim()
      .replace(/,/g, " ")
      .split(/\s+/)
      .filter(s => s.length > 0)
      .map(s => parseInt(s, 10));

    if (nums.length === 0) return { ok: null };
    if (nums[0] !== 0) nums.unshift(0);
    nums = Array.from(new Set(nums)).sort((a,b) => a-b);

    const truth = this.current.rel;
    const ok = keyRel(nums) === keyRel(truth);
    this.current.answered = true;
    this.log.push({ rel: truth, guess: nums, ok });
    return { ok, truth, guess: nums };
  }

  snapshotForSave() {
    return { settings: this.settings, log: this.log };
  }
}

/* -------------------------
   UI Boot
------------------------- */
(function initApp() {
  // inject CSS safety-net so disabled buttons cannot be clicked regardless of page CSS
  (function injectDisabledSafetyCSS() {
    try {
      const css = "button:disabled{pointer-events:none!important;} select:disabled{pointer-events:none!important;}"; 
      const s = document.createElement("style");
      s.setAttribute("data-eartrainer-safety","true");
      s.appendChild(document.createTextNode(css));
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {
      // if injection fails, we'll still rely on JS guards
      console.warn("Failed to inject disabled-safety CSS:", e);
    }

    
  })();

  const el = {
    userSelect:    document.getElementById("userSelect"),
    newUserBtn:    document.getElementById("newUserBtn"),
    deleteUserBtn: document.getElementById("deleteUserBtn"),
    cardMin:       document.getElementById("cardMin"),
    cardMax:       document.getElementById("cardMax"),
    midiLow:       document.getElementById("midiLow"),
    midiHigh:      document.getElementById("midiHigh"),
    spanMin:       document.getElementById("spanMin"),
    spanMax:       document.getElementById("spanMax"),
    mixRatio:      document.getElementById("mixRatio"),
    newSetBtn:     document.getElementById("newSetBtn"),
    replaySetBtn:  document.getElementById("replaySetBtn"),
    guessInput:    document.getElementById("guessInput"),
    submitBtn:     document.getElementById("submitBtn"),
    feedback:      document.getElementById("feedback"),
  };

  let currentUser = "Guest";
  const synth   = new Synth();
  const trainer = new Trainer(synth, DEFAULTS);

  /* ---------- input restriction ---------- */
  if (el.guessInput) {
    el.guessInput.addEventListener("input", () => {
      el.guessInput.value = el.guessInput.value.replace(/[^0-9, ]/g, "");
    });
  }

  /* ---------- constraint solver ---------- */
  function computeRanges(s) {
    const ranges = {};
    ranges.cardMin  = [2, Math.min(5, s.card[1])];
    ranges.cardMax  = [Math.max(2, s.card[0]), Math.min(5, s.span[1] + 1)];
    ranges.spanMax  = [Math.max(s.card[1] - 1, 0), s.midiHigh - s.midiLow];
    ranges.spanMin  = [0, s.span[1]];
    ranges.midiLow  = [MIDI_ABS_LOW, s.midiHigh - s.span[1]];
    ranges.midiHigh = [s.midiLow + s.span[1], MIDI_ABS_HIGH];
    return ranges;
  }

  function fillSelect(select, [min, max], selected, labelFn = x => x) {
    if (!select) return;
    select.innerHTML = "";
    if (min > max) max = min;
    for (let v = min; v <= max; v++) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = labelFn(v);
      if (v === selected) opt.selected = true;
      select.appendChild(opt);
    }
    if (![...select.options].some(o => o.selected)) {
      select.options[0].selected = true;
    }
  }

  function renderSettingsUI(s) {
    const ranges = computeRanges(s);
    fillSelect(el.cardMin,  ranges.cardMin,  s.card[0]);
    fillSelect(el.cardMax,  ranges.cardMax,  s.card[1]);
    fillSelect(el.spanMax,  ranges.spanMax,  s.span[1]);
    fillSelect(el.spanMin,  ranges.spanMin,  s.span[0]);
    fillSelect(el.midiLow,  ranges.midiLow,  s.midiLow,  midiToNote);
    fillSelect(el.midiHigh, ranges.midiHigh, s.midiHigh, midiToNote);

    if (el.mixRatio) {
      el.mixRatio.innerHTML = "";
      for (let v = 0.05; v <= 1.00001; v += 0.05) {
        const val = Math.min(1, v).toFixed(2);
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = val;
        if (Math.abs(parseFloat(val) - s.mixRatio) < 1e-6) opt.selected = true;
        el.mixRatio.appendChild(opt);
      }
    }
  }

  function readSettingsFromUI() {
    return {
      midiLow: +el.midiLow.value,
      midiHigh: +el.midiHigh.value,
      card: [ +el.cardMin.value, +el.cardMax.value ],
      span: [ +el.spanMin.value, +el.spanMax.value ],
      mixRatio: parseFloat(el.mixRatio.value),
    };
  }

  /* ---------- live refresh ---------- */
  ["midiLow","midiHigh","cardMin","cardMax","spanMin","spanMax","mixRatio"].forEach(id => {
    const node = document.getElementById(id);
    if (!node) return;
    node.addEventListener("change", () => {
      const s = readSettingsFromUI();
      trainer.changeSettings(s);
      renderSettingsUI(trainer.settings);
      trainer.changeSettings(readSettingsFromUI());
      updateButtons();
    });
  });

  /* ---------- buttons state ---------- */
    function updateButtons() {
      const cur = trainer.current;
    
      if (!cur) {
        if (el.submitBtn) {
          el.submitBtn.innerHTML = `
            <span style="font-size:1.3em; line-height:1;">⏎</span>
            <span>Submit guess</span>`;
          // keep alignment identical to replay style
          el.submitBtn.style.display = "inline-flex";
          el.submitBtn.style.alignItems = "center";
          el.submitBtn.style.justifyContent = "center";
          el.submitBtn.style.gap = "0.4rem";
        }
        if (el.submitBtn) el.submitBtn.disabled = true;
        if (el.newSetBtn) el.newSetBtn.disabled = false;
        if (el.replaySetBtn) el.replaySetBtn.disabled = true;
        if (el.guessInput) el.guessInput.disabled = true;
        return;
      }
    
      if (cur.answered) {
        // 🔒 EXACT replay block you tuned before
        if (el.submitBtn) {
          el.submitBtn.innerHTML = `
            <span style="font-size:1.8em; line-height:1; display:inline-block; transform: translateY(-0.1em);">⟳</span>
            <span>Replay guess</span>`;
          el.submitBtn.style.display = "inline-flex";
          el.submitBtn.style.alignItems = "center";
          el.submitBtn.style.justifyContent = "center";
          el.submitBtn.style.gap = "0.4rem";
        }
        if (el.submitBtn) el.submitBtn.disabled = false;
        if (el.newSetBtn) el.newSetBtn.disabled = false;
        if (el.replaySetBtn) el.replaySetBtn.disabled = false;
        if (el.guessInput) el.guessInput.disabled = true;
      } else {
        // Submit state: ⏎ before text, same alignment as replay
        if (el.submitBtn) {
          el.submitBtn.innerHTML = `
            <span style="font-size:1.3em; line-height:1;">⏎</span>
            <span>Submit guess</span>`;
          el.submitBtn.style.display = "inline-flex";
          el.submitBtn.style.alignItems = "center";
          el.submitBtn.style.justifyContent = "center";
          el.submitBtn.style.gap = "0.4rem";
        }
        if (el.submitBtn) el.submitBtn.disabled = false;
        if (el.newSetBtn) el.newSetBtn.disabled = true;
        if (el.replaySetBtn) el.replaySetBtn.disabled = false;
        if (el.guessInput) el.guessInput.disabled = false;
      }
    
      if (el.deleteUserBtn) el.deleteUserBtn.disabled = (currentUser === "Guest");
      if (el.newUserBtn) el.newUserBtn.disabled = false;
    }
    
  

  /* ---------- feedback ---------- */
  function updateFeedback(ok, truth, guess) {
    const WIN = trainer.settings.win;
  
    // rolling accuracy for this rel
    const hist = trainer.log.filter(l => keyRel(l.rel) === keyRel(truth)).slice(-WIN);
    const correct = hist.filter(h => h.ok).length;
  
    // minimum accuracy across all rels
    let minAcc = 1;
    for (const rel of trainer.universe) {
      const k = keyRel(rel);
      const relHist = trainer.log.filter(l => keyRel(l.rel) === k).slice(-WIN);
      const c = relHist.filter(h => h.ok).length;
      const acc = c / WIN;
      if (acc < minAcc) minAcc = acc;
    }
    const minCorrect = Math.round(minAcc * WIN);
  
    // overall accuracy
    const total = trainer.log.length;
    const overall = total ? Math.round(trainer.log.filter(l => l.ok).length / total * 100) : 0;
  
    // formatted strings (monospace padding with spaces, not zeros)
    const rolling       = `${correct.toString().padStart(2," ")}/${WIN}`;
    const minDisplay    = `${minCorrect.toString().padStart(2," ")}/${WIN}`;
    const overallDisplay = `${overall.toString().padStart(3," ")}%`;
  
    function formatSet(arr) { return "(" + arr.join(", ") + ")"; }
  
    let msg = "";
    if (ok) {
      msg = `
        <div style="text-align:center;">
          🐢🐢 <span style="color:rgb(48, 134, 48)">${formatSet(truth)}</span>
        </div>`;
      if (el.replaySetBtn) el.replaySetBtn.classList.add("btn-green");
      if (el.submitBtn) el.submitBtn.classList.add("btn-green");
    } else {
      msg = `
        <div style="text-align:center;">
          🙉 <span style="color:rgb(160, 68, 50)">${formatSet(guess)}</span> 
          vs. 
          <span style="color:rgb(48, 134, 48)">${formatSet(truth)}</span> 🙊
        </div>`;
      if (el.replaySetBtn) el.replaySetBtn.classList.add("btn-green");
      if (el.submitBtn) el.submitBtn.classList.add("btn-red");
    }
  
    msg += `
    <div style="text-align:left; margin-top:0.5rem; margin-left:3.7rem; font-family:monospace;">
      Rolling accuracy: <strong>${String(correct).padStart(2, '\u00A0')}/${WIN}</strong><br>
      Minimum accuracy: <strong>${String(Math.round(minAcc * WIN)).padStart(2, '\u00A0')}/${WIN}</strong><br>
      Overall accuracy: <strong>${String(overall).padStart(4, '\u00A0')}%</strong>
    </div>`;
  
    if (el.feedback) el.feedback.innerHTML = msg;
  }
  

  /* ---------- user handling ---------- */
  function switchUser(name, { skipSave = false } = {}) {
    // Save old user
    if (!skipSave && currentUser !== "Guest") {
      Storage.save(currentUser, trainer.snapshotForSave());
    }
  
    // Update global
    currentUser = name;
  
    // Load user data
    const data = Storage.load(currentUser);
    trainer.changeSettings(data.settings);
    trainer.log = data.log || [];
    trainer.current = null;
  
    // Reset UI
    if (el.feedback) el.feedback.innerHTML = "";
    renderSettingsUI(trainer.settings);
    trainer.changeSettings(readSettingsFromUI());
    refreshUserSelect();
  
    // 🔒 Force delete button state right here
    if (el.deleteUserBtn) {
      el.deleteUserBtn.disabled = (currentUser === "Guest");
    }
  
    updateButtons(); // still safe to call
  


    
    try { if (el.newSetBtn) el.newSetBtn.focus(); } catch {}
  }
  
  


  function refreshUserSelect() {
    if (!el.userSelect) return;
    el.userSelect.innerHTML = "";
    const guestOpt = document.createElement("option");
    guestOpt.value = "Guest";
    guestOpt.textContent = "Guest";
    el.userSelect.appendChild(guestOpt);

    Storage.listUsers().forEach(u => {
      const opt = document.createElement("option");
      opt.value = u;
      opt.textContent = u;
      el.userSelect.appendChild(opt);
    });

    if (![...el.userSelect.options].some(o => o.value === currentUser)) {
      currentUser = "Guest";
    }
    el.userSelect.value = currentUser;
  }

  if (el.userSelect) el.userSelect.onchange = e => switchUser(e.target.value);

  if (el.newUserBtn) {
    el.newUserBtn.onclick = () => {
      if (el.newUserBtn.disabled) return;
      const name = prompt("Enter username:");
      if (!name) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      if (trimmed === "Guest") { alert("User name 'Guest' is reserved."); return; }
      if (Storage.listUsers().includes(trimmed)) { alert("User already exists."); return; }
      Storage.save(trimmed, { settings: { ...DEFAULTS }, log: [] });
      switchUser(trimmed);
    };
  }

  if (el.deleteUserBtn) {
    el.deleteUserBtn.onclick = () => {
      if (el.deleteUserBtn.disabled) return;
      if (currentUser === "Guest") return;
      if (!confirm(`Delete user '${currentUser}'?`)) return;
      const toDelete = currentUser;
      Storage.remove(toDelete);
      switchUser("Guest", { skipSave: true });
    };
  }

  /* ---------- handlers ---------- */
  function handleNewSet() {
    if (!el.newSetBtn || el.newSetBtn.disabled) return;
    trainer.nextTrial();
    updateButtons();
    if (el.feedback) el.feedback.innerHTML = "";
    if (el.replaySetBtn) el.replaySetBtn.classList.remove("btn-green", "btn-red");
    if (el.submitBtn) el.submitBtn.classList.remove("btn-green", "btn-red");
    try { if (el.guessInput) el.guessInput.focus(); } catch {}
  }

  function handleReplay() {
    if (!el.replaySetBtn || el.replaySetBtn.disabled) return;
    trainer.replay();
  }

  function handleSubmit() {
    if (!el.submitBtn || el.submitBtn.disabled) return;
    const cur = trainer.current;
    if (!cur) return;

    if (!cur.answered) {
      const res = trainer.submitGuess(el.guessInput ? el.guessInput.value : "");
      if (!res) return;
      updateFeedback(res.ok, res.truth, res.guess);
      if (el.guessInput) { el.guessInput.value = ""; el.guessInput.disabled = true; }
      if (el.newSetBtn) el.newSetBtn.disabled = false;
      updateButtons();
      try { if (el.newSetBtn) el.newSetBtn.focus(); } catch {}
    } else {
      const last = trainer.log[trainer.log.length - 1];
      if (last) trainer.playGuess(last.guess);
    }
  }

  if (el.newSetBtn) el.newSetBtn.onclick = handleNewSet;
  if (el.replaySetBtn) el.replaySetBtn.onclick = handleReplay;
  if (el.submitBtn) el.submitBtn.onclick = handleSubmit;

  // === NEW: Enter-to-submit support ===
  if (el.guessInput) {
    el.guessInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault(); // prevent form submission
        if (!el.submitBtn.disabled) {
          handleSubmit();
        }
      }
    });
  }

  /* ---------- startup ---------- */
  currentUser = Storage.lastUser();
  if (currentUser !== "Guest" && !Storage.listUsers().includes(currentUser)) {
    currentUser = "Guest";
  }

  const data = Storage.load(currentUser);
  trainer.changeSettings(data.settings);
  trainer.log = data.log || [];

  renderSettingsUI(trainer.settings);
  trainer.changeSettings(readSettingsFromUI());

  refreshUserSelect();
  updateButtons();
  document.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const active = document.activeElement;
      if (active && active.tagName === "BUTTON" && !active.disabled) {
        if (!active._enterPressed) {
          active._enterPressed = true;
          active.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
          e.preventDefault();
        }
      }
    }
  });
  refreshUserSelect();
  if (currentUser === "Guest") {
    el.deleteUserBtn.disabled = true;
  }
updateButtons();

   
})();


