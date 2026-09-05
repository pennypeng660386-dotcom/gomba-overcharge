(() => {
  const $ = id => document.getElementById(id);
  const shell = $('appShell');
  const mascot = $('mascotWrap');
  const feedback = $('feedback');
  const coreTrack = document.querySelector('.core-track');
  const coreText = $('coreText');
  const board = $('board');
  if (!shell || !mascot || !feedback || !coreTrack || !coreText || !board) return;

  // Replace broken registered SVG references with the existing approved raster asset.
  document.querySelectorAll('img[src$="gomba-registered.svg"]').forEach(img => {
    img.src = './assets/gomba.png';
  });
  document.querySelectorAll('link[href$="gomba-registered.svg"]').forEach(link => {
    link.href = './assets/gomba.png';
  });

  const speech = document.createElement('div');
  speech.className = 'mascot-speech';
  mascot.appendChild(speech);

  let lastFeedback = '';
  let reactionTimer = null;
  let audioCtx = null;

  function soundEnabled() {
    return localStorage.getItem('gomba_overdrive_sound') !== '0';
  }
  function ensureAudio() {
    if (!soundEnabled()) return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }
  function tone(freq, start, dur, type='triangle', vol=.035) {
    const ctx = ensureAudio(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + start;
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(.001, t + dur);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(t); osc.stop(t + dur);
  }
  function rewardSound(kind) {
    if (!soundEnabled()) return;
    if (kind === 'NICE!') { tone(620,0,.08); tone(760,.06,.09); }
    else if (kind === 'GREAT!') { tone(560,0,.08); tone(720,.07,.09); tone(900,.14,.12); }
    else if (kind === 'AWESOME!') { tone(520,0,.07); tone(700,.06,.08); tone(900,.12,.1); }
    else if (kind === 'AMAZING!') { tone(540,0,.07); tone(720,.06,.08); tone(960,.12,.1); tone(1200,.19,.13); }
    else if (kind === 'EXCELLENT!') { tone(480,0,.07,'triangle',.04); tone(680,.055,.08,'triangle',.04); tone(920,.11,.1,'triangle',.045); tone(1280,.18,.15,'sine',.05); }
    else if (kind === 'UNSTOPPABLE!') { tone(380,0,.08,'sawtooth',.035); tone(620,.06,.08); tone(880,.12,.09); tone(1180,.18,.12); tone(1480,.25,.16,'sine',.05); }
    else if (kind === 'OVERDRIVE!') { tone(180,0,.16,'sawtooth',.05); tone(320,.08,.14,'square',.04); tone(620,.18,.12); tone(980,.28,.14); tone(1480,.38,.2,'sine',.055); }
  }
  function reactionFor(text) {
    if (text.includes('OVERDRIVE')) return 'overdrive';
    if (text.includes('UNSTOPPABLE')) return 'unstoppable';
    if (text.includes('EXCELLENT')) return 'excellent';
    if (text.includes('AMAZING')) return 'amazing';
    if (text.includes('AWESOME') || text.includes('GREAT')) return 'great';
    return 'nice';
  }
  function speechFor(text) {
    const map = {
      'NICE!':'GOOD HIT ⚡','GREAT!':'KEEP IT HOT!','AWESOME!':'CORE LOVES THAT!','AMAZING!':'THAT’S ENERGY!','EXCELLENT!':'FULL POWER!','UNSTOPPABLE!':'YOU’RE COOKING!','OVERDRIVE!':'LET IT RIP! ⚡'
    };
    return map[text] || 'KEEP GOING!';
  }
  function react(text) {
    const kind = reactionFor(text);
    mascot.className = mascot.className.replace(/\breaction-\S+/g,'').trim();
    void mascot.offsetWidth;
    mascot.classList.add('reaction-' + kind);
    shell.classList.remove('reward-shake','reward-blast');
    void shell.offsetWidth;
    shell.classList.add(kind === 'overdrive' || kind === 'unstoppable' ? 'reward-blast' : 'reward-shake');
    speech.textContent = speechFor(text);
    speech.classList.remove('show'); void speech.offsetWidth; speech.classList.add('show');
    rewardSound(text);
    clearTimeout(reactionTimer);
    reactionTimer = setTimeout(() => {
      mascot.className = mascot.className.replace(/\breaction-\S+/g,'').trim();
      shell.classList.remove('reward-shake','reward-blast');
    }, 950);
  }

  const feedbackObserver = new MutationObserver(() => {
    const text = (feedback.textContent || '').trim();
    if (!text || text === lastFeedback) return;
    // Upgrade the existing ladder without changing game rules.
    let upgraded = text;
    const combo = parseInt(($('comboText')?.textContent || '0').replace(/\D/g,''),10) || 0;
    if (text === 'AMAZING!' && combo >= 4) upgraded = 'EXCELLENT!';
    if ((text === 'GREAT!' || text === 'AMAZING!') && combo >= 5) upgraded = 'UNSTOPPABLE!';
    if (upgraded !== text) {
      feedback.textContent = upgraded;
      feedback.className = `feedback show ${upgraded.replace(/!/g,'').toLowerCase()}`;
    }
    lastFeedback = upgraded;
    react(upgraded);
    setTimeout(() => { if ((feedback.textContent || '').trim() !== upgraded) lastFeedback = ''; }, 900);
  });
  feedbackObserver.observe(feedback,{childList:true,characterData:true,subtree:true});

  let lastCore = 0;
  const coreObserver = new MutationObserver(() => {
    const val = parseInt((coreText.textContent || '0').replace(/\D/g,''),10) || 0;
    coreTrack.classList.toggle('core-hot', val >= 50);
    coreTrack.classList.toggle('core-critical', val >= 90 && val < 100);
    if (val > lastCore) {
      coreTrack.classList.remove('core-pulse'); void coreTrack.offsetWidth; coreTrack.classList.add('core-pulse');
      const b = board.getBoundingClientRect(); const c = coreTrack.getBoundingClientRect();
      for (let i=0;i<Math.min(7,2+Math.ceil((val-lastCore)/10));i++) {
        const p = document.createElement('i'); p.className='energy-particle';
        const x = b.left + b.width*(.25+Math.random()*.5); const y = b.top + b.height*(.35+Math.random()*.45);
        p.style.left=x+'px';p.style.top=y+'px';p.style.setProperty('--dx',(c.left+c.width/2-x)+'px');p.style.setProperty('--dy',(c.top+c.height/2-y)+'px');
        document.body.appendChild(p); setTimeout(()=>p.remove(),700);
      }
    }
    lastCore = val;
  });
  coreObserver.observe(coreText,{childList:true,characterData:true,subtree:true});

  const stageSub = document.querySelector('#stageBanner span');
  const stageNum = $('stageBannerNum');
  if (stageSub && stageNum) {
    new MutationObserver(() => {
      const n = parseInt((stageNum.textContent||'1').replace(/\D/g,''),10) || 1;
      stageSub.textContent = n === 2 ? 'POWER RISING' : n === 3 ? 'HIGH VOLTAGE' : n === 4 ? 'CORE HOT' : n >= 5 ? 'OVERLOAD ZONE' : 'POWER RISING';
    }).observe(stageNum,{childList:true,characterData:true,subtree:true});
  }

  document.addEventListener('pointerdown', ensureAudio, {once:true});
})();
