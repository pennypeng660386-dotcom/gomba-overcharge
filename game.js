(() => {
  const screens = {
    landing: document.getElementById('landing'),
    game: document.getElementById('game'),
    result: document.getElementById('result'),
    subscribe: document.getElementById('subscribe')
  };

  const $ = id => document.getElementById(id);
  const playBtn = $('playBtn');
  const holdBtn = $('holdBtn');
  const againBtn = $('againBtn');
  const nextDropBtn = $('nextDropBtn');
  const subscribeAgainBtn = $('subscribeAgainBtn');
  const subscribeForm = $('subscribeForm');

  let state = null;
  let raf = 0;
  let pressStart = 0;

  function track(eventName, extra = {}) {
    console.log('[GOMBA_EVENT]', eventName, { ts: Date.now(), ...extra });
  }

  function show(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    window.scrollTo(0, 0);
  }

  function resetGame() {
    state = {
      charge: 0,
      combo: 0,
      bestCombo: 0,
      lives: 3,
      angle: 0,
      speed: 0.085,
      direction: 1,
      startedAt: performance.now(),
      holding: false
    };
    updateUI();
  }

  function updateUI() {
    $('chargeText').textContent = `${Math.round(state.charge)}%`;
    $('comboText').textContent = `×${state.combo}`;
    $('livesText').textContent = '♥'.repeat(state.lives) + '♡'.repeat(3 - state.lives);
    $('barFill').style.width = `${state.charge}%`;
    $('coreFill').style.height = `${state.charge}%`;
  }

  function startGame() {
    resetGame();
    show('game');
    track('game_start');
    cancelAnimationFrame(raf);
    loop();
  }

  function loop(now = performance.now()) {
    if (!state) return;
    state.angle = (state.angle + state.speed * 16.67) % 360;
    $('needle').style.transform = `translate(-50%,-100%) rotate(${state.angle}deg)`;

    // Speed rises with charge, but is capped for playability.
    state.speed = Math.min(0.20, 0.085 + state.charge * 0.0009);
    raf = requestAnimationFrame(loop);
  }

  function flash(text, kind) {
    const el = $('feedback');
    el.textContent = text;
    el.className = `feedback ${kind || ''}`;
    clearTimeout(flash.t);
    flash.t = setTimeout(() => { el.textContent = ''; }, 650);
  }

  // Orange sweet spot is 54–104 degrees.
  function evaluateRelease() {
    const angle = state.angle % 360;
    let gain = 0;
    if (angle >= 66 && angle <= 92) {
      gain = 14;
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      flash('PERFECT ⚡', 'perfect');
    } else if (angle >= 54 && angle <= 104) {
      gain = 7;
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      flash('GOOD', 'good');
    } else {
      state.lives -= 1;
      state.combo = 0;
      flash('BURNOUT', 'bad');
    }

    state.charge = Math.min(100, state.charge + gain);
    updateUI();

    if (state.charge >= 100) {
      winGame();
    } else if (state.lives <= 0) {
      loseGame();
    }
  }

  function winGame() {
    cancelAnimationFrame(raf);
    const elapsed = Math.max(1, Math.round((performance.now() - state.startedAt) / 1000));
    $('resultTitle').textContent = 'FULLY CHARGED';
    $('resultSub').textContent = 'You woke the core.';
    $('finalCore').textContent = '100%';
    $('finalCombo').textContent = `×${state.bestCombo}`;
    $('finalTime').textContent = `0:${String(elapsed).padStart(2, '0')}`;
    nextDropBtn.hidden = false;
    show('result');
    track('game_complete', { result: 'win', best_combo: state.bestCombo, seconds: elapsed });
  }

  function loseGame() {
    cancelAnimationFrame(raf);
    const elapsed = Math.max(1, Math.round((performance.now() - state.startedAt) / 1000));
    $('resultTitle').textContent = 'SHORT CIRCUIT';
    $('resultSub').textContent = 'Core fried. Try again.';
    $('finalCore').textContent = `${Math.round(state.charge)}%`;
    $('finalCombo').textContent = `×${state.bestCombo}`;
    $('finalTime').textContent = `0:${String(elapsed).padStart(2, '0')}`;
    nextDropBtn.hidden = true;
    show('result');
    track('game_complete', { result: 'fail', charge: Math.round(state.charge), seconds: elapsed });
  }

  function pressStartHandler(e) {
    e.preventDefault();
    if (!state || state.holding) return;
    state.holding = true;
    pressStart = performance.now();
    holdBtn.classList.add('pressed');
    holdBtn.textContent = 'RELEASE';
    $('coreLabel').textContent = 'CHARGING';
  }

  function pressEndHandler(e) {
    e.preventDefault();
    if (!state || !state.holding) return;
    state.holding = false;
    holdBtn.classList.remove('pressed');
    holdBtn.textContent = 'HOLD TO CHARGE';
    $('coreLabel').textContent = 'HOLD';
    evaluateRelease();
  }

  playBtn.addEventListener('click', startGame);
  againBtn.addEventListener('click', () => { track('retry'); startGame(); });
  subscribeAgainBtn.addEventListener('click', () => { track('retry'); startGame(); });
  nextDropBtn.addEventListener('click', () => { show('subscribe'); track('email_view'); });

  ['pointerdown', 'touchstart'].forEach(evt => holdBtn.addEventListener(evt, pressStartHandler, { passive: false }));
  ['pointerup', 'pointercancel', 'touchend'].forEach(evt => holdBtn.addEventListener(evt, pressEndHandler, { passive: false }));

  subscribeForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = $('emailInput').value.trim();
    if (!email) return;
    $('subscribeSuccess').hidden = false;
    track('email_submit');
    // MVP prototype only: do not send/store email yet.
  });

  track('play_visit');
})();
