(() => {
  const $ = id => document.getElementById(id);
  const shell = $('appShell');
  const game = $('game');
  const board = $('board');
  const wrap = board?.closest('.board-wrap');
  const feedback = $('feedback');
  const comboText = $('comboText');
  if (!shell || !game || !board || !wrap || !feedback || !comboText) return;

  // Brandplate like the approved visual direction.
  if (!game.querySelector('.game-brandplate')) {
    const plate = document.createElement('div');
    plate.className = 'game-brandplate';
    plate.innerHTML = '<span>GOMBA</span><strong>OVERDRIVE</strong><i>⚡</i>';
    const hud = game.querySelector('.top-hud');
    hud?.parentNode?.insertBefore(plate, hud);
  }

  const fxLayer = document.createElement('div');
  fxLayer.className = 'g5-fx-layer';
  wrap.appendChild(fxLayer);

  const comboBurst = document.createElement('div');
  comboBurst.className = 'g5-combo-burst';
  comboBurst.innerHTML = '<span class="word">AMAZING!</span><span class="combo">COMBO X3</span>';
  wrap.appendChild(comboBurst);

  let audioCtx = null;
  let lastPraise = '';
  let lastSpeakAt = 0;
  let beamTimer = null;

  function soundEnabled(){ return localStorage.getItem('gomba_overdrive_sound') !== '0'; }
  function ctx(){
    if (!soundEnabled()) return null;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    if (!audioCtx) audioCtx = new C();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
    return audioCtx;
  }
  function tone(freq, start=0, dur=.12, type='sine', vol=.04, endFreq=null){
    const c = ctx(); if (!c) return;
    const o = c.createOscillator(); const g = c.createGain(); const t = c.currentTime + start;
    o.type = type; o.frequency.setValueAtTime(freq,t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+dur+.02);
  }
  function noise(start=0,dur=.18,vol=.05,high=1600){
    const c = ctx(); if (!c) return;
    const length = Math.max(1,Math.floor(c.sampleRate*dur));
    const b = c.createBuffer(1,length,c.sampleRate); const d = b.getChannelData(0);
    for(let i=0;i<length;i++) d[i]=(Math.random()*2-1)*(1-i/length);
    const s = c.createBufferSource(); const f = c.createBiquadFilter(); const g = c.createGain();
    s.buffer=b; f.type='bandpass'; f.frequency.value=high; f.Q.value=.7;
    const t=c.currentTime+start; g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t+dur);
  }
  function kick(start=0){ tone(150,start,.16,'sine',.09,48); noise(start,.07,.025,650); }
  function chime(notes, base=.045){ notes.forEach((n,i)=>tone(n,i*.065,.18,'triangle',base)); }
  function sparkle(start=.04){ [1200,1550,1900,2300].forEach((n,i)=>tone(n,start+i*.035,.11,'sine',.025)); }
  function bigReward(kind){
    if (!soundEnabled()) return;
    const map={
      'NICE!':[620,780],
      'GREAT!':[520,720,940],
      'AMAZING!':[520,700,920,1200],
      'EXCELLENT!':[480,680,940,1280,1540],
      'UNSTOPPABLE!':[420,620,880,1180,1560],
      'OVERDRIVE!':[300,520,820,1220,1680]
    };
    kick(0); noise(.02,.22,kind==='OVERDRIVE!'?.08:.055,kind==='OVERDRIVE!'?900:1300);
    chime(map[kind]||map['NICE!'],kind==='OVERDRIVE!'?.055:.042);
    sparkle(kind==='OVERDRIVE!'?.18:.1);
    if (kind==='OVERDRIVE!'){ tone(95,0,.48,'sawtooth',.05,42); tone(240,.15,.28,'square',.03,760); }
  }

  function maybeSpeak(text){
    if (!soundEnabled() || !('speechSynthesis' in window)) return;
    if (!['AMAZING!','EXCELLENT!','UNSTOPPABLE!','OVERDRIVE!'].includes(text)) return;
    const now=Date.now(); if (now-lastSpeakAt<900) return; lastSpeakAt=now;
    try{
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text.replace('!',''));
      u.lang='en-US'; u.rate=1.05; u.pitch=text==='OVERDRIVE!'?.82:1.12; u.volume=.82;
      const voices=speechSynthesis.getVoices();
      const preferred=voices.find(v=>/Samantha|Daniel|Google US English|Microsoft Aria|Karen/i.test(v.name) && /^en/i.test(v.lang)) || voices.find(v=>/^en/i.test(v.lang));
      if(preferred) u.voice=preferred;
      speechSynthesis.speak(u);
    }catch(_){ }
  }

  function praiseFor(raw){
    const combo=parseInt((comboText.textContent||'0').replace(/\D/g,''),10)||0;
    if (/OVERDRIVE/i.test(raw)) return 'OVERDRIVE!';
    if (combo>=5) return 'UNSTOPPABLE!';
    if (combo===4) return 'EXCELLENT!';
    if (combo===3) return 'AMAZING!';
    if (combo===2) return 'GREAT!';
    return raw || 'NICE!';
  }
  function showBurst(word){
    const combo=parseInt((comboText.textContent||'0').replace(/\D/g,''),10)||0;
    comboBurst.className='g5-combo-burst';
    comboBurst.querySelector('.word').textContent=word;
    comboBurst.querySelector('.combo').textContent=word==='OVERDRIVE!'?'CORE 100% · POWER BURST':(combo>1?`COMBO X${combo}`:'CORE CHARGE');
    comboBurst.classList.add(word.toLowerCase().replace(/!/g,''),'show');
    shell.classList.remove('g5-impact','g5-overdrive'); void shell.offsetWidth;
    shell.classList.add(word==='OVERDRIVE!'?'g5-overdrive':'g5-impact');
    setTimeout(()=>shell.classList.remove('g5-impact','g5-overdrive'),900);
    bigReward(word); maybeSpeak(word); spawnDebris(word==='OVERDRIVE!'?28:16);
  }

  function spawnDebris(count){
    const r=board.getBoundingClientRect(); const w=wrap.getBoundingClientRect();
    for(let i=0;i<count;i++){
      const p=document.createElement('i'); p.className='g5-debris';
      p.style.left=(r.left-w.left+r.width*(.18+Math.random()*.64))+'px';
      p.style.top=(r.top-w.top+r.height*(.30+Math.random()*.45))+'px';
      p.style.setProperty('--dx',((Math.random()-.5)*170)+'px');
      p.style.setProperty('--dy',(-45-Math.random()*120)+'px');
      p.style.setProperty('--rot',((Math.random()-.5)*760)+'deg');
      fxLayer.appendChild(p); setTimeout(()=>p.remove(),780);
    }
  }

  function makeBeam(type,pos,size){
    const b=document.createElement('div'); b.className='g5-line-blast '+type;
    if(type==='h'){b.style.left='0px';b.style.width='100%';b.style.top=pos+'px'}
    else {b.style.top='0px';b.style.height='100%';b.style.left=pos+'px'}
    fxLayer.appendChild(b); setTimeout(()=>b.remove(),620);
  }
  function scanClears(){
    clearTimeout(beamTimer); beamTimer=setTimeout(()=>{
      const cells=[...board.querySelectorAll('.cell.clearing')]; if(!cells.length) return;
      const br=board.getBoundingClientRect(); const wr=wrap.getBoundingClientRect();
      const rows=new Map(), cols=new Map();
      cells.forEach(c=>{const r=c.dataset.r,co=c.dataset.c;rows.set(r,(rows.get(r)||0)+1);cols.set(co,(cols.get(co)||0)+1)});
      rows.forEach((n,r)=>{if(n>=8){const c=board.querySelector(`.cell[data-r="${r}"]`);if(c){const q=c.getBoundingClientRect();makeBeam('h',q.top-wr.top+q.height/2,br.width)}}});
      cols.forEach((n,cx)=>{if(n>=8){const c=board.querySelector(`.cell[data-c="${cx}"]`);if(c){const q=c.getBoundingClientRect();makeBeam('v',q.left-wr.left+q.width/2,br.height)}}});
    },10);
  }

  const fObs=new MutationObserver(()=>{
    const raw=(feedback.textContent||'').trim();
    if(!raw || raw===lastPraise) return;
    const word=praiseFor(raw); lastPraise=word; showBurst(word);
    setTimeout(()=>{ if((feedback.textContent||'').trim()!==raw) lastPraise=''; },1050);
  });
  fObs.observe(feedback,{childList:true,characterData:true,subtree:true});
  new MutationObserver(scanClears).observe(board,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});

  // Make the mascot artwork feel integrated without modifying the registered image pixels.
  document.querySelectorAll('.hero-wrap,.mascot-wrap,.result-hero').forEach(box=>{
    if(!box.querySelector('.g5-reactor-label')){
      const l=document.createElement('span'); l.className='g5-reactor-label'; l.textContent=box.classList.contains('hero-wrap')?'CORE CHAMBER':'CORE LINK'; box.appendChild(l);
    }
  });
  const style=document.createElement('style');
  style.textContent='.g5-reactor-label{position:absolute;z-index:9;left:10px;bottom:7px;padding:2px 5px;background:rgba(4,4,4,.72);border:1px solid rgba(255,90,0,.25);color:#c47a43;font-size:7px;font-weight:900;letter-spacing:.16em;pointer-events:none}.hero-wrap .g5-reactor-label{right:10px;left:auto}';
  document.head.appendChild(style);

  document.addEventListener('pointerdown',()=>{ctx(); if('speechSynthesis'in window) speechSynthesis.getVoices();},{once:true});
})();
