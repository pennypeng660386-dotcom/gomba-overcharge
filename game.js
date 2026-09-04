(() => {
  const SIZE = 8;
  const SAVE_KEY = 'gomba_overdrive_save';
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

  let save = loadSave();
  let state = null;
  let drag = null;
  let ctaShown = false;
  let afterCta = null;

  function track(eventName, extra = {}) {
    console.log('[GOMBA_EVENT]', eventName, { ts: Date.now(), ...extra });
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

  function pickShape(board, stage) {
    const pool = stage >= 3 ? EASY.concat(LATER) : EASY;
    for (let i = 0; i < 10; i++) {
      const cells = cloneCells(pool[Math.floor(Math.random() * pool.length)]);
      if (fitsAnywhere(board, cells)) return cells;
    }
    for (const shape of EASY) {
      const cells = cloneCells(shape);
      if (fitsAnywhere(board, cells)) return cells;
    }
    return cloneCells(EASY[0]);
  }

  function fillTray() {
    state.tray = [0, 1, 2].map(() => pickShape(state.board, state.stage));
  }

  function anyPieceFits() {
    return state.tray.some(p => p && fitsAnywhere(state.board, p));
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
    let html = `<div class="piece" style="grid-template-columns:repeat(${cols},auto)">`;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        html += set.has(r + ',' + c) ? `<i class="${miniClass}"></i>` : '<i style="visibility:hidden" class="' + miniClass + '"></i>';
      }
    }
    return html + '</div>';
  }

  function renderTray() {
    trayEl.innerHTML = state.tray.map((piece, i) => {
      if (!piece) return '<div class="piece-slot empty"></div>';
      return `<div class="piece-slot" data-tray="${i}">${renderPieceGrid(piece, 'mini')}</div>`;
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
    flashMsg.t = setTimeout(() => { el.textContent = ''; }, 700);
  }

  function bumpFlash(overdrive) {
    const shell = $('appShell');
    shell.classList.remove('flash', 'overdrive-fx');
    void shell.offsetWidth;
    shell.classList.add(overdrive ? 'overdrive-fx' : 'flash');
    setTimeout(() => shell.classList.remove('flash', 'overdrive-fx'), 500);
  }

  function startGame() {
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
    fillTray();
    hintEl.classList.toggle('gone', sessionStorage.getItem('gomba_hint_seen') === '1');
    updateHud();
    renderBoard();
    renderTray();
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

  function triggerOverdrive() {
    const target = pickOverdriveTarget(state.board);
    const lines = { rows: [], cols: [] };
    if (target.type === 'row') lines.rows.push(target.index);
    else lines.cols.push(target.index);
    const marks = applyClears(state.board, lines);
    state.score += 150 + target.count * 8;
    state.overdrives += 1;
    save.totalOverdrives += 1;
    state.core = 0;
    if (state.overdrives % 3 === 0) state.stage += 1;
    if (state.stage > save.highestStage) save.highestStage = state.stage;
    persist();
    $('mascotWrap').classList.add('overdrive');
    bumpFlash(true);
    flashMsg('OVERDRIVE ⚡');
    state.clearing = marks;
    renderBoard();
    setTimeout(() => {
      state.clearing = null;
      $('mascotWrap').classList.remove('overdrive');
      renderBoard();
      updateHud();
    }, 180);
    track('overdrive', { stage: state.stage, target });
    if (state.overdrives === 3 && !ctaShown) maybeShowCta('overdrive3');
  }

  function afterPlace(cells) {
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
      bumpFlash(false);
      flashMsg(state.combo >= 2 ? `COMBO ×${state.combo}` : 'ZAP! ⚡');
      track('line_clear', { lines: n, combo: state.combo });
      renderBoard();
      updateHud();
      setTimeout(() => {
        state.clearing = null;
        renderBoard();
        if (state.core >= 100) triggerOverdrive();
        else updateHud();
        finishTurn();
      }, 160);
    } else {
      state.combo = 0;
      updateHud();
      renderBoard();
      finishTurn();
    }
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
    $('newBest').hidden = !isBest;
    $('finalScore').textContent = String(state.score);
    $('finalBest').textContent = String(save.bestScore);
    $('finalOver').textContent = String(state.overdrives);
    $('finalCombo').textContent = `×${state.bestCombo}`;
    show('result');
    track('game_over', { score: state.score, overdrives: state.overdrives, stage: state.stage });
    const meaningful = state.score >= 250 || state.overdrives >= 1 || state.combo >= 3 || state.bestCombo >= 3;
    if (meaningful && !ctaShown) maybeShowCta('gameover');
  }

  function maybeShowCta(reason) {
    if (ctaShown) return;
    ctaShown = true;
    afterCta = reason === 'overdrive3' ? 'game' : 'result';
    $('ctaOffline').hidden = navigator.onLine !== false;
    track('contact_cta_view', { reason });
    if (reason === 'overdrive3') show('cta');
    else setTimeout(() => { if (screens.result.classList.contains('active')) show('cta'); }, 700);
  }

  function closeCtaToPlay() {
    show('game');
  }

  function goHome() {
    drag = null;
    ghostEl.hidden = true;
    state = null;
    show('landing');
  }

  function cellSize() {
    const rect = boardEl.getBoundingClientRect();
    return rect.width / SIZE;
  }

  function boardOrigin(clientX, clientY, cells, grab) {
    const lift = 72;
    const size = cellSize();
    const rect = boardEl.getBoundingClientRect();
    const left = clientX - (grab.c + 0.5) * size;
    const top = clientY - (grab.r + 0.5) * size - lift;
    const c0 = Math.round((left - rect.left) / size);
    const r0 = Math.round((top - rect.top) / size);
    return { r0, c0, left, top, size, cells };
  }

  function paintGhost(cells, size) {
    ghostEl.style.setProperty('--cell', size + 'px');
    ghostEl.innerHTML = renderPieceGrid(cells, 'mini');
    const g = ghostEl.querySelector('.piece');
    if (g) g.style.gap = '3px';
  }

  function onPointerDown(e) {
    if (!state) return;
    const slot = e.target.closest('[data-tray]');
    if (!slot) return;
    const index = Number(slot.dataset.tray);
    const piece = state.tray[index];
    if (!piece) return;
    e.preventDefault();
    slot.setPointerCapture?.(e.pointerId);
    const { rows, cols } = pieceSize(piece);
    const grab = { r: Math.min(rows - 1, Math.floor(rows / 2)), c: Math.min(cols - 1, Math.floor(cols / 2)) };
    for (const [r, c] of piece) {
      if (r === 0 && c === 0) { grab.r = 0; grab.c = 0; break; }
    }
    drag = { index, cells: piece, grab };
    const size = cellSize();
    paintGhost(piece, size);
    ghostEl.hidden = false;
    moveDrag(e.clientX, e.clientY);
  }

  function moveDrag(clientX, clientY) {
    if (!drag) return;
    const pos = boardOrigin(clientX, clientY, drag.cells, drag.grab);
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
      track('piece_place', { cells: current.cells.length });
      afterPlace(current.cells);
    } else {
      renderBoard();
      renderTray();
    }
  }

  trayEl.addEventListener('pointerdown', onPointerDown, { passive: false });
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp, { passive: false });
  window.addEventListener('pointercancel', onPointerUp, { passive: false });

  $('playBtn').addEventListener('click', startGame);
  $('againBtn').addEventListener('click', () => { track('retry'); startGame(); });
  $('backHomeBtn').addEventListener('click', goHome);
  $('gameClose').addEventListener('click', goHome);
  $('resultClose').addEventListener('click', goHome);
  $('ctaClose').addEventListener('click', goHome);
  $('ctaHome').addEventListener('click', goHome);
  $('ctaKeep').addEventListener('click', () => {
    if (afterCta === 'game' && state) show('game');
    else if (state) show('result');
    else show('landing');
  });

  $('ctaForm').addEventListener('submit', e => {
    e.preventDefault();
    const email = $('ctaEmail').value.trim();
    const phone = $('ctaPhone').value.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const phoneOk = phone.replace(/\D/g, '').length >= 6;
    if (!emailOk && !phoneOk) return;
    // TODO: connect to FUNLE CRM game_subscriber endpoint in later phase.
    $('ctaThanks').hidden = false;
    $('ctaEmail').value = '';
    $('ctaPhone').value = '';
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

  $('bestText').textContent = String(save.bestScore);
  track('play_visit');
})();
