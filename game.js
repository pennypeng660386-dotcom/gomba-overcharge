(() => {
  const SIZE = 8;
  const SAVE_KEY = 'gomba_overdrive_save';
  const SOUND_KEY = 'gomba_overdrive_sound';
  const CONTACT_KEY = 'gomba_contact_submitted';
  const CONTACT_AT = 'gomba_contact_submitted_at';
  const CONTACT_IP = 'gomba_contact_ip';
  const EASY = [
    [[0, 0]],
    [[0, 0], [0, 1]],
    [[0, 0], [1, 0]],
    [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0]]
  ];
  const LATER = [
    [[0, 0], [1, 0], [2, 0], [2, 1]],
    [[0, 1], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 1], [0, 2], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]]
  ];

  const screens = {
    landing: document.getElementById('landing'),
    game: document.getElementById('game'),
    result: document.getElementById('result'),
    cta: document.getElementById('cta')
  };
  const $ = id => document.getElementById(id);
  const boardEl = $('board');
  const trayEl = $('tray');
  const ghostEl = $('dragGhost');
  const hintEl = $('firstHint');
  const fxLayer = $('fxLayer');
  const shell = $('appShell');

  let save = loadSave();
  let state = null;
  let drag = null;
  let busy = false;
  let ctaShown = false;
  let afterCta = null;
  let soundOn = localStorage.getItem(SOUND_KEY) !== '0';
  let audioCtx = null;
  let lastSpeak = 0;

  function track(eventName, extra = {}) {
    console.log('[GOMBA_EVENT]', eventName, { ts: Date.now(), ...extra });
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function contactSubmitted() {
    return localStorage.getItem(CONTACT_KEY) === '1';
  }

  function markContactSubmitted(ip) {
    localStorage.setItem(CONTACT_KEY, '1');
    localStorage.setItem(CONTACT_AT, new Date().toISOString());
    if (ip) localStorage.setItem(CONTACT_IP, ip);
  }

  async function readPublicIp() {
    if (navigator.onLine === false) return '';
    try {
      const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
      const data = await res.json();
      return data && data.ip ? String(data.ip) : '';
    } catch (_) {
      return '';
    }
  }

  async function sameContactIp() {
    const saved = localStorage.getItem(CONTACT_IP);
    if (!saved) return false;
    const ip = await readPublicIp();
    return !!(ip && ip === saved);
  }

  function buildContactPayload(email, phone) {
    return {
      email: email || undefined,
      phone: phone || undefined,
      source: 'GOMBA_GAME',
      score: state ? state.score : 0,
      best_combo: state ? state.bestCombo : 0,
      stage: state ? state.stage : 1,
      overdrives: state ? state.overdrives : 0,
      timestamp: new Date().toISOString()
    };
  }

  function submitContactLead(payload) {
    // Isolated for a future FUNLE CRM endpoint. No secrets. No fake sync.
    console.log('[GOMBA_CONTACT]', payload);
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return {
        bestScore: data.bestScore || 0,
        bestCombo: data.bestCombo || 0,
        totalGames: data.totalGames || 0,
        totalOverdrives: data.totalOverdrives || 0,
        highestStage: data.highestStage || 1
      };
    } catch (_) {
      return { bestScore: 0, bestCombo: 0, totalGames: 0, totalOverdrives: 0, highestStage: 1 };
    }
  }

  function persist() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      bestScore: save.bestScore,
      bestCombo: save.bestCombo,
      totalGames: save.totalGames,
      totalOverdrives: save.totalOverdrives,
      highestStage: save.highestStage
    }));
  }

  function ensureAudio() {
    if (!soundOn) return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, when, dur, type, vol, end) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(30, end), t + dur);
    gain.gain.setValueAtTime(vol || 0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  function noise(when, dur, vol, center) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const t = ctx.currentTime + when;
    src.buffer = buf;
    filter.type = 'bandpass';
    filter.frequency.value = center || 1200;
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(vol || 0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur);
  }

  function click() {
    noise(0, 0.035, 0.03, 2200);
    tone(180, 0, 0.06, 'triangle', 0.04, 70);
  }

  function speak(word) {
    if (!soundOn || !('speechSynthesis' in window)) return;
    if (!['AMAZING!', 'EXCELLENT!', 'UNSTOPPABLE!', 'OVERDRIVE!'].includes(word)) return;
    const now = Date.now();
    if (now - lastSpeak < 850) return;
    lastSpeak = now;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word.replace('!', ''));
      u.lang = 'en-US';
      u.rate = 1.02;
      u.pitch = word === 'OVERDRIVE!' ? 0.78 : 1.08;
      u.volume = 0.95;
      const voices = speechSynthesis.getVoices();
      const pick = voices.find(v => /^en/i.test(v.lang) && /Samantha|Daniel|Aria|Google US English|Karen/i.test(v.name))
        || voices.find(v => /^en/i.test(v.lang));
      if (pick) u.voice = pick;
      speechSynthesis.speak(u);
    } catch (_) { /* speech is optional */ }
  }

  function rewardSfx(word) {
    if (!soundOn) return;
    ensureAudio();
    if (word === 'GREAT!') {
      tone(160, 0, 0.12, 'sine', 0.07, 60);
      noise(0, 0.06, 0.03, 700);
      tone(520, 0.05, 0.12, 'triangle', 0.045);
      tone(720, 0.14, 0.16, 'triangle', 0.045);
      return;
    }
    if (word === 'AMAZING!') {
      tone(150, 0, 0.14, 'sine', 0.08, 50);
      noise(0.02, 0.12, 0.05, 1800);
      tone(520, 0.04, 0.16, 'triangle', 0.04);
      tone(720, 0.1, 0.16, 'triangle', 0.04);
      tone(980, 0.16, 0.18, 'triangle', 0.04);
      [1080, 1420, 1810].forEach((f, i) => tone(f, 0.14 + i * 0.04, 0.1, 'sine', 0.02));
      return;
    }
    if (word === 'EXCELLENT!') {
      tone(110, 0, 0.18, 'sine', 0.09, 42);
      noise(0.01, 0.1, 0.04, 500);
      tone(470, 0.05, 0.18, 'triangle', 0.045);
      tone(690, 0.11, 0.18, 'triangle', 0.04);
      tone(980, 0.17, 0.2, 'triangle', 0.04);
      tone(220, 0.04, 0.08, 'square', 0.03);
      [1200, 1600, 2100].forEach((f, i) => tone(f, 0.16 + i * 0.04, 0.1, 'sine', 0.02));
      return;
    }
    if (word === 'UNSTOPPABLE!') {
      tone(90, 0, 0.22, 'sawtooth', 0.06, 40);
      noise(0.02, 0.16, 0.05, 900);
      [410, 620, 910, 1270, 1740].forEach((f, i) => tone(f, 0.05 + i * 0.06, 0.18, 'triangle', 0.036));
      [1400, 1800, 2200].forEach((f, i) => tone(f, 0.2 + i * 0.04, 0.1, 'sine', 0.02));
      return;
    }
    if (word === 'OVERDRIVE!') {
      tone(70, 0, 0.55, 'sawtooth', 0.07, 36);
      noise(0.02, 0.12, 0.06, 400);
      noise(0.12, 0.38, 0.07, 850);
      tone(220, 0.18, 0.34, 'square', 0.03, 1120);
      tone(300, 0.08, 0.2, 'sawtooth', 0.04);
      tone(850, 0.28, 0.22, 'triangle', 0.04);
      tone(1280, 0.42, 0.2, 'sine', 0.035);
      tone(1860, 0.55, 0.18, 'sine', 0.03);
      return;
    }
    noise(0, 0.08, 0.045, 1600);
    tone(420, 0.02, 0.08, 'square', 0.035);
    tone(640, 0.07, 0.1, 'square', 0.035);
  }

  function sfx(kind, word) {
    if (!soundOn) return;
    ensureAudio();
    if (kind === 'tap') click();
    else if (kind === 'place') {
      click();
      tone(240, 0.01, 0.08, 'triangle', 0.045, 90);
    } else if (kind === 'invalid') {
      tone(120, 0, 0.14, 'sawtooth', 0.04);
    } else if (kind === 'clear') {
      rewardSfx(word || 'NICE!');
    } else if (kind === 'combo') {
      rewardSfx(word || 'GREAT!');
      speak(word || 'GREAT!');
    } else if (kind === 'overdrive') {
      rewardSfx('OVERDRIVE!');
      speak('OVERDRIVE!');
    } else if (kind === 'over') {
      tone(320, 0, 0.12, 'sawtooth', 0.05);
      tone(180, 0.09, 0.22, 'triangle', 0.05);
    } else if (kind === 'stage') {
      tone(500, 0, 0.08, 'triangle', 0.05);
      tone(750, 0.08, 0.14, 'triangle', 0.05);
    }
  }

  function syncSoundBtn() {
    $('soundBtn').textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';
    $('soundBtn').setAttribute('aria-pressed', soundOn ? 'true' : 'false');
  }

  function syncOffline() {
    const offline = navigator.onLine === false;
    $('statusLeft').textContent = offline ? 'OFFLINE MODE' : '⚡ ENERGY GRID';
  }

  function show(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    window.scrollTo(0, 0);
  }

  function emptyBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function cloneCells(cells) {
    return cells.map(([r, c]) => [r, c]);
  }

  function pieceSize(cells) {
    let maxR = 0;
    let maxC = 0;
    for (const [r, c] of cells) {
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    }
    return { rows: maxR + 1, cols: maxC + 1 };
  }

  function rotateCells(cells) {
    const { rows } = pieceSize(cells);
    const next = cells.map(([r, c]) => [c, rows - 1 - r]);
    const minR = Math.min(...next.map(p => p[0]));
    const minC = Math.min(...next.map(p => p[1]));
    return next.map(([r, c]) => [r - minR, c - minC]);
  }

  function canPlace(board, cells, r0, c0) {
    for (const [r, c] of cells) {
      const rr = r0 + r;
      const cc = c0 + c;
      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) return false;
      if (board[rr][cc]) return false;
    }
    return true;
  }

  function fitsAnywhere(board, cells) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (canPlace(board, cells, r, c)) return true;
      }
    }
    return false;
  }

  function fitsWithRotations(board, cells) {
    let cur = cloneCells(cells);
    for (let i = 0; i < 4; i++) {
      if (fitsAnywhere(board, cur)) return true;
      cur = rotateCells(cur);
    }
    return false;
  }

  function pickShape(board, stage) {
    const pool = stage >= 3 ? EASY.concat(LATER) : EASY;
    for (let i = 0; i < 10; i++) {
      const cells = cloneCells(pool[Math.floor(Math.random() * pool.length)]);
      if (fitsWithRotations(board, cells)) return cells;
    }
    for (const shape of EASY) {
      const cells = cloneCells(shape);
      if (fitsWithRotations(board, cells)) return cells;
    }
    return cloneCells(EASY[0]);
  }

  function fillTray() {
    state.tray = [0, 1, 2].map(() => pickShape(state.board, state.stage));
  }

  function anyPieceFits() {
    return state.tray.some(p => p && fitsWithRotations(state.board, p));
  }

  function renderBoard(preview) {
    const cells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        let cls = 'cell';
        if (state.board[r][c]) cls += ' filled';
        if (preview && preview.map[r + ',' + c]) cls += preview.ok ? ' preview-ok' : ' preview-bad';
        if (state.clearing && state.clearing.has(r + ',' + c)) cls += ' clearing';
        cells.push(`<div class="${cls}" data-r="${r}" data-c="${c}"></div>`);
      }
    }
    boardEl.innerHTML = cells.join('');
  }

  function renderPieceGrid(cells, miniClass) {
    const { rows, cols } = pieceSize(cells);
    const set = new Set(cells.map(([r, c]) => r + ',' + c));
    let html = `<div class="piece-grid" style="grid-template-columns:repeat(${cols},auto)">`;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        html += set.has(r + ',' + c)
          ? `<i class="${miniClass}"></i>`
          : `<i style="visibility:hidden" class="${miniClass}"></i>`;
      }
    }
    return html + '</div>';
  }

  function renderTray() {
    trayEl.innerHTML = state.tray.map((piece, i) => {
      if (!piece) return '<div class="piece used"></div>';
      return `<div class="piece" data-tray="${i}"><button type="button" class="rotate" data-rotate="${i}" aria-label="Rotate">↻</button>${renderPieceGrid(piece, 'mini')}</div>`;
    }).join('');
  }

  function updateHud() {
    $('scoreText').textContent = String(state.score);
    $('bestText').textContent = String(Math.max(save.bestScore, state.score));
    $('comboText').textContent = `×${state.combo}`;
    $('stageText').textContent = String(state.stage);
    $('coreText').textContent = `${Math.round(state.core)}%`;
    $('coreFill').style.width = `${state.core}%`;
    $('coreGlow').style.opacity = String(0.18 + state.core * 0.007);
    $('mascotWrap').classList.toggle('charged', state.core >= 70);
  }

  function flashMsg(text) {
    const el = $('feedback');
    el.textContent = text;
    clearTimeout(flashMsg.t);
    flashMsg.t = setTimeout(() => { el.textContent = ''; }, 720);
  }

  function cheerFor(n, combo) {
    if (combo >= 5) return ['UNSTOPPABLE!', 'unstoppable'];
    if (combo === 4) return ['EXCELLENT!', 'excellent'];
    if (combo === 3) return ['AMAZING!', 'amazing'];
    if (combo === 2) return ['GREAT!', 'great'];
    if (n >= 2) return ['GREAT!', 'great'];
    return ['NICE!', 'nice'];
  }

  function reactMascot(kind) {
    const el = $('mascotWrap');
    el.className = 'mascot-chamber' + (state && state.core >= 70 ? ' charged' : '');
    if (!kind) return;
    el.classList.add('react-' + kind);
    if (kind !== 'gameover') {
      clearTimeout(reactMascot.t);
      reactMascot.t = setTimeout(() => {
        el.classList.remove('react-' + kind);
      }, 900);
    }
  }

  function shake(ms) {
    shell.classList.remove('shaking');
    void shell.offsetWidth;
    shell.classList.add('shaking');
    setTimeout(() => shell.classList.remove('shaking'), ms || 180);
  }

  function flashScreen() {
    const el = $('fxFlash');
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 220);
  }

  function showPraise(word, combo) {
    const el = $('praise');
    $('praiseWord').textContent = word;
    $('praisePlate').textContent = word === 'OVERDRIVE!'
      ? 'CORE 100%'
      : (combo > 1 ? `COMBO X${combo}` : 'LINE CLEAR');
    el.hidden = false;
    void el.offsetWidth;
    clearTimeout(showPraise.t);
    showPraise.t = setTimeout(() => { el.hidden = true; }, 980);
  }

  function fireBeams(lines, explode) {
    const lr = fxLayer.getBoundingClientRect();
    lines.rows.forEach(r => {
      const cell = boardEl.querySelector(`[data-r="${r}"][data-c="0"]`);
      if (!cell) return;
      const q = cell.getBoundingClientRect();
      const b = document.createElement('i');
      b.className = 'beam row';
      b.style.top = (q.top - lr.top - q.height * 0.15) + 'px';
      b.style.height = (q.height * 1.3) + 'px';
      fxLayer.appendChild(b);
      setTimeout(() => b.remove(), 480);
    });
    lines.cols.forEach(c => {
      const cell = boardEl.querySelector(`[data-r="0"][data-c="${c}"]`);
      if (!cell) return;
      const q = cell.getBoundingClientRect();
      const b = document.createElement('i');
      b.className = 'beam col';
      b.style.left = (q.left - lr.left - q.width * 0.15) + 'px';
      b.style.width = (q.width * 1.3) + 'px';
      fxLayer.appendChild(b);
      setTimeout(() => b.remove(), 480);
    });
    if (explode || (lines.rows.length && lines.cols.length)) {
      const x = document.createElement('i');
      x.className = 'beam cross';
      fxLayer.appendChild(x);
      setTimeout(() => x.remove(), 520);
    }
  }

  function spawnDebris(big) {
    const lr = fxLayer.getBoundingClientRect();
    const br = boardEl.getBoundingClientRect();
    const cx = br.left - lr.left + br.width / 2;
    const cy = br.top - lr.top + br.height / 2;
    const shards = big ? 36 : 22;
    const sparks = big ? 28 : 16;
    for (let i = 0; i < shards; i++) {
      const p = document.createElement('i');
      p.className = 'shard';
      p.style.left = (cx + (Math.random() - 0.5) * br.width * 0.5) + 'px';
      p.style.top = (cy + (Math.random() - 0.5) * br.height * 0.2) + 'px';
      p.style.setProperty('--dx', ((Math.random() - 0.5) * (big ? 260 : 170)) + 'px');
      p.style.setProperty('--dy', ((-40 - Math.random() * (big ? 180 : 120))) + 'px');
      fxLayer.appendChild(p);
      setTimeout(() => p.remove(), 560);
    }
    for (let i = 0; i < sparks; i++) {
      const p = document.createElement('i');
      p.className = 'spark';
      p.style.left = (cx + (Math.random() - 0.5) * br.width * 0.55) + 'px';
      p.style.top = (cy + (Math.random() - 0.5) * br.height * 0.18) + 'px';
      p.style.setProperty('--dx', ((Math.random() - 0.5) * (big ? 300 : 200)) + 'px');
      p.style.setProperty('--dy', ((-40 - Math.random() * (big ? 200 : 140))) + 'px');
      fxLayer.appendChild(p);
      setTimeout(() => p.remove(), 620);
    }
  }

  function spawnCoreBits() {
    const lr = fxLayer.getBoundingClientRect();
    const br = boardEl.getBoundingClientRect();
    const core = $('mascotWrap').getBoundingClientRect();
    const tx = core.left - lr.left + core.width / 2;
    const ty = core.top - lr.top + core.height / 2;
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('i');
      const sx = br.left - lr.left + br.width * (0.2 + Math.random() * 0.6);
      const sy = br.top - lr.top + br.height * (0.25 + Math.random() * 0.5);
      p.className = 'core-bit';
      p.style.left = sx + 'px';
      p.style.top = sy + 'px';
      p.style.setProperty('--tx', (tx - sx) + 'px');
      p.style.setProperty('--ty', (ty - sy) + 'px');
      fxLayer.appendChild(p);
      setTimeout(() => p.remove(), 720);
    }
  }

  function playClearFx(lines, n, combo, word, kind) {
    showPraise(word, combo);
    reactMascot(kind);
    fireBeams(lines);
    flashScreen();
    spawnDebris(n >= 2 || combo >= 3);
    spawnCoreBits();
    shake(240);
    flashMsg(word);
    sfx(combo >= 2 || n >= 2 ? 'combo' : 'clear', word);
  }

  function showStageBanner(n) {
    const el = $('stageBanner');
    $('stageBannerNum').textContent = `STAGE ${n}`;
    el.hidden = false;
    sfx('stage');
    setTimeout(() => { el.hidden = true; }, 1000);
  }

  function checkStage() {
    const next = Math.max(1 + Math.floor(state.score / 500), 1 + state.overdrives);
    if (next > state.stage) {
      state.stage = next;
      if (state.stage > save.highestStage) {
        save.highestStage = state.stage;
        persist();
      }
      updateHud();
      showStageBanner(state.stage);
    }
  }

  function startGame() {
    ensureAudio();
    if ('speechSynthesis' in window) speechSynthesis.getVoices();
    state = {
      board: emptyBoard(),
      tray: [null, null, null],
      score: 0,
      combo: 0,
      bestCombo: 0,
      core: 0,
      stage: 1,
      overdrives: 0,
      clearing: null
    };
    busy = false;
    fillTray();
    hintEl.classList.toggle('gone', sessionStorage.getItem('gomba_hint_seen') === '1');
    $('mascotWrap').className = 'mascot-chamber';
    $('coreFill').classList.remove('hot');
    shell.classList.remove('overdrive-dark');
    updateHud();
    renderBoard();
    renderTray();
    syncOffline();
    show('game');
    track('game_start');
  }

  function findPreview(r0, c0, cells) {
    const map = {};
    let ok = true;
    for (const [r, c] of cells) {
      const rr = r0 + r;
      const cc = c0 + c;
      map[rr + ',' + cc] = true;
      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE || state.board[rr][cc]) ok = false;
    }
    return { r0, c0, map, ok };
  }

  function linesToClear(board) {
    const rows = [];
    const cols = [];
    for (let r = 0; r < SIZE; r++) {
      if (board[r].every(Boolean)) rows.push(r);
    }
    for (let c = 0; c < SIZE; c++) {
      let full = true;
      for (let r = 0; r < SIZE; r++) if (!board[r][c]) { full = false; break; }
      if (full) cols.push(c);
    }
    return { rows, cols };
  }

  function applyClears(board, lines) {
    const marks = new Set();
    lines.rows.forEach(r => {
      for (let c = 0; c < SIZE; c++) marks.add(r + ',' + c);
    });
    lines.cols.forEach(c => {
      for (let r = 0; r < SIZE; r++) marks.add(r + ',' + c);
    });
    marks.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      board[r][c] = 0;
    });
    return marks;
  }

  function pickOverdriveTarget(board) {
    let best = { type: 'row', index: 0, count: -1 };
    for (let r = 0; r < SIZE; r++) {
      const count = board[r].reduce((n, v) => n + (v ? 1 : 0), 0);
      if (count > best.count) best = { type: 'row', index: r, count };
    }
    for (let c = 0; c < SIZE; c++) {
      let count = 0;
      for (let r = 0; r < SIZE; r++) if (board[r][c]) count++;
      if (count > best.count) best = { type: 'col', index: c, count };
    }
    return best;
  }

  async function triggerOverdrive() {
    const target = pickOverdriveTarget(state.board);
    const lines = { rows: [], cols: [] };
    if (target.type === 'row') lines.rows.push(target.index);
    else lines.cols.push(target.index);
    const marks = applyClears(state.board, lines);
    state.score += 150 + target.count * 8;
    state.overdrives += 1;
    save.totalOverdrives += 1;
    state.core = 0;
    persist();
    await wait(100);
    shell.classList.add('overdrive-dark');
    $('coreFill').classList.add('hot');
    reactMascot('overdrive');
    state.clearing = marks;
    renderBoard();
    updateHud();
    fireBeams({ rows: [target.type === 'row' ? target.index : 3], cols: [target.type === 'col' ? target.index : 3] }, true);
    flashScreen();
    spawnDebris(true);
    spawnCoreBits();
    shake(280);
    showPraise('OVERDRIVE!', state.combo);
    flashMsg('OVERDRIVE!');
    sfx('overdrive');
    checkStage();
    track('overdrive', { stage: state.stage, target });
    await wait(900);
    state.clearing = null;
    $('coreFill').classList.remove('hot');
    shell.classList.remove('overdrive-dark');
    renderBoard();
    updateHud();
    if (state.overdrives === 3) maybeShowCta('overdrive3');
  }

  async function afterPlace(cells) {
    busy = true;
    state.score += cells.length * 5;
    const lines = linesToClear(state.board);
    const n = lines.rows.length + lines.cols.length;
    if (n) {
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.score += n * 50 + Math.max(0, n - 1) * 25 + (state.combo > 1 ? state.combo * 10 : 0);
      state.core = Math.min(100, state.core + n * 20);
      const marks = applyClears(state.board, lines);
      state.clearing = marks;
      const [text, kind] = cheerFor(n, state.combo);
      renderBoard();
      updateHud();
      playClearFx(lines, n, state.combo, text, kind);
      track('line_clear', { lines: n, combo: state.combo });
      checkStage();
      await wait(420);
      state.clearing = null;
      renderBoard();
      if (state.core >= 100) await triggerOverdrive();
      else updateHud();
      finishTurn();
    } else {
      state.combo = 0;
      updateHud();
      renderBoard();
      checkStage();
      finishTurn();
    }
    busy = false;
  }

  function finishTurn() {
    if (state.tray.every(p => !p)) fillTray();
    renderTray();
    updateHud();
    if (!anyPieceFits()) endGame();
  }

  function endGame() {
    const isBest = state.score > save.bestScore;
    if (isBest) save.bestScore = state.score;
    if (state.bestCombo > save.bestCombo) save.bestCombo = state.bestCombo;
    save.totalGames += 1;
    persist();
    reactMascot('gameover');
    $('newBest').hidden = !isBest;
    $('finalScore').textContent = String(state.score);
    $('finalBest').textContent = String(save.bestScore);
    $('finalOver').textContent = String(state.overdrives);
    $('finalCombo').textContent = `×${state.bestCombo}`;
    $('finalStage').textContent = String(state.stage);
    sfx('over');
    show('result');
    track('game_over', { score: state.score, overdrives: state.overdrives, stage: state.stage });
    const meaningful = state.score >= 250 || state.overdrives >= 1 || state.combo >= 3 || state.bestCombo >= 3;
    if (meaningful) maybeShowCta('gameover');
  }

  async function maybeShowCta(reason) {
    if (contactSubmitted() || ctaShown) return;
    if (await sameContactIp()) {
      markContactSubmitted(localStorage.getItem(CONTACT_IP));
      return;
    }
    ctaShown = true;
    afterCta = reason === 'overdrive3' ? 'game' : 'result';
    $('ctaOffline').hidden = navigator.onLine !== false;
    $('ctaForm').hidden = false;
    $('ctaThanks').hidden = true;
    track('contact_cta_view', { reason });
    if (reason === 'overdrive3') show('cta');
    else setTimeout(() => { if (screens.result.classList.contains('active')) show('cta'); }, 700);
  }

  function goHome() {
    drag = null;
    busy = false;
    ghostEl.hidden = true;
    state = null;
    show('landing');
  }

  function rotateTray(index) {
    if (!state || drag || !state.tray[index]) return;
    state.tray[index] = rotateCells(state.tray[index]);
    renderTray();
  }

  function cellSize() {
    const rect = boardEl.getBoundingClientRect();
    return rect.width / SIZE;
  }

  function boardOrigin(clientX, clientY, grab) {
    const lift = 72;
    const size = cellSize();
    const rect = boardEl.getBoundingClientRect();
    const left = clientX - (grab.c + 0.5) * size;
    const top = clientY - (grab.r + 0.5) * size - lift;
    const c0 = Math.round((left - rect.left) / size);
    const r0 = Math.round((top - rect.top) / size);
    return { r0, c0, left, top, size };
  }

  function paintGhost(cells, size) {
    ghostEl.style.setProperty('--cell', size + 'px');
    ghostEl.innerHTML = renderPieceGrid(cells, 'mini');
    const g = ghostEl.querySelector('.piece-grid');
    if (g) g.style.gap = '3px';
  }

  function onPointerDown(e) {
    if (!state || busy) return;
    const rot = e.target.closest('[data-rotate]');
    if (rot) {
      e.preventDefault();
      e.stopPropagation();
      rotateTray(Number(rot.dataset.rotate));
      sfx('tap');
      return;
    }
    const slot = e.target.closest('[data-tray]');
    if (!slot) return;
    const index = Number(slot.dataset.tray);
    const piece = state.tray[index];
    if (!piece) return;
    e.preventDefault();
    slot.setPointerCapture?.(e.pointerId);
    const grab = { r: 0, c: 0 };
    drag = { index, cells: piece, grab };
    const size = cellSize();
    paintGhost(piece, size);
    ghostEl.hidden = false;
    moveDrag(e.clientX, e.clientY);
  }

  function moveDrag(clientX, clientY) {
    if (!drag) return;
    const pos = boardOrigin(clientX, clientY, drag.grab);
    ghostEl.style.left = pos.left + 'px';
    ghostEl.style.top = pos.top + 'px';
    const preview = findPreview(pos.r0, pos.c0, drag.cells);
    drag.preview = preview;
    renderBoard(preview);
  }

  function onPointerMove(e) {
    if (!drag) return;
    e.preventDefault();
    moveDrag(e.clientX, e.clientY);
  }

  function onPointerUp(e) {
    if (!drag) return;
    e.preventDefault();
    const current = drag;
    drag = null;
    ghostEl.hidden = true;
    ghostEl.innerHTML = '';
    if (current.preview && current.preview.ok) {
      current.cells.forEach(([r, c]) => {
        state.board[current.preview.r0 + r][current.preview.c0 + c] = 1;
      });
      state.tray[current.index] = null;
      hintEl.classList.add('gone');
      sessionStorage.setItem('gomba_hint_seen', '1');
      sfx('place');
      track('piece_place', { cells: current.cells.length });
      afterPlace(current.cells);
    } else {
      sfx('invalid');
      renderBoard();
      renderTray();
    }
  }

  trayEl.addEventListener('pointerdown', onPointerDown, { passive: false });
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp, { passive: false });
  window.addEventListener('pointercancel', onPointerUp, { passive: false });
  window.addEventListener('online', syncOffline);
  window.addEventListener('offline', syncOffline);

  function tapThen(fn) {
    return () => { sfx('tap'); fn(); };
  }

  $('soundBtn').addEventListener('click', () => {
    soundOn = !soundOn;
    localStorage.setItem(SOUND_KEY, soundOn ? '1' : '0');
    syncSoundBtn();
    if (soundOn) { ensureAudio(); sfx('tap'); }
    else if ('speechSynthesis' in window) speechSynthesis.cancel();
  });

  $('playBtn').addEventListener('click', tapThen(startGame));
  $('againBtn').addEventListener('click', tapThen(() => { track('retry'); startGame(); }));
  $('backHomeBtn').addEventListener('click', tapThen(goHome));
  $('gameClose').addEventListener('click', tapThen(goHome));
  $('resultClose').addEventListener('click', tapThen(goHome));
  $('ctaClose').addEventListener('click', tapThen(goHome));
  $('ctaHome').addEventListener('click', tapThen(goHome));
  $('ctaKeep').addEventListener('click', tapThen(() => {
    if (afterCta === 'game' && state) show('game');
    else if (state) show('result');
    else show('landing');
  }));

  $('ctaForm').addEventListener('submit', e => {
    e.preventDefault();
    const email = $('ctaEmail').value.trim();
    const phone = $('ctaPhone').value.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const phoneOk = phone.replace(/\D/g, '').length >= 6;
    if (!emailOk && !phoneOk) return;
    submitContactLead(buildContactPayload(emailOk ? email : '', phoneOk ? phone : ''));
    markContactSubmitted();
    readPublicIp().then(ip => { if (ip) localStorage.setItem(CONTACT_IP, ip); });
    sfx('tap');
    $('ctaForm').hidden = true;
    $('ctaThanks').hidden = false;
    $('ctaEmail').value = '';
    $('ctaPhone').value = '';
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

  syncSoundBtn();
  syncOffline();
  $('bestText').textContent = String(save.bestScore);
  track('play_visit');

  window.addEventListener('gomba-qa', async ev => {
    if (!state) return;
    const detail = ev.detail || {};
    if (detail.overdrive) {
      state.core = 100;
      await triggerOverdrive();
      return;
    }
    if (detail.cta) {
      ctaShown = false;
      await maybeShowCta(detail.reason || 'gameover');
      return;
    }
    if (detail.rows || detail.cols) {
      const lines = { rows: detail.rows || [], cols: detail.cols || [] };
      lines.rows.forEach(r => { for (let c = 0; c < SIZE; c++) state.board[r][c] = 1; });
      lines.cols.forEach(c => { for (let r = 0; r < SIZE; r++) state.board[r][c] = 1; });
      state.combo = detail.combo || 3;
      state.core = Math.min(100, state.core + 20);
      const marks = applyClears(state.board, lines);
      state.clearing = marks;
      const [text, kind] = cheerFor(lines.rows.length + lines.cols.length, state.combo);
      renderBoard();
      updateHud();
      playClearFx(lines, lines.rows.length + lines.cols.length, state.combo, text, kind);
      await wait(420);
      state.clearing = null;
      renderBoard();
    }
  });
})();
