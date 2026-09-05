(() => {
  const $ = id => document.getElementById(id);
  const shell = $('appShell');
  const game = $('game');
  const board = $('board');
  const wrap = board?.closest('.board-wrap');
  const feedback = $('feedback');
  const comboText = $('comboText');
  const mascotWrap = $('mascotWrap');
  if (!shell || !game || !board || !wrap || !feedback || !comboText) return;

  // Use the approved clean mascot cutout everywhere visible.
  document.querySelectorAll('.hero-img,.hud-mascot,.result-mascot').forEach(img => {
    img.src = './assets/gomba-game-cutout.svg';
  });

  // Cabinet ambience.
  if (!shell.querySelector('.g6-ambient')) {
    const amb = document.createElement('div');
    amb.className = 'g6-ambient';
    amb.innerHTML = '<i></i><i></i><i></i><i></i>';
    shell.prepend(amb);
  }

  // Replace older praise overlays with a single V0.6 layer.
  wrap.querySelectorAll('.g5-combo-burst,.g5-fx-layer').forEach(n => n.remove());
  const fx = document.createElement('div');
  fx.className = 'g6-fx';
  const praise = document.createElement('div');
  praise.className = 'g6-praise';
  praise.innerHTML = '<span class="word">AMAZING!</span><span class="combo">COMBO X3</span>';
  wrap.append(fx, praise);

  let audioCtx = null;
  let lastPraise = '';
  let lastSpeak = 0;

  function soundOn(){ return localStorage.getItem('gomba_overdrive_sound') !== '0'; }
  function ctx(){
    if (!soundOn()) return null;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    if (!audioCtx) audioCtx = new C();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
    return audioCtx;
  }
  function osc(freq, when, dur, type='sine', gain=.04, end=null){
    const c=ctx(); if(!c) return;
    const o=c.createOscillator(), g=c.createGain(), t=c.currentTime+when;
    o.type=type; o.frequency.setValueAtTime(freq,t);
    if(end) o.frequency.exponentialRampToValueAtTime(Math.max(30,end),t+dur);
    g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+dur+.03);
  }
  function noise(when=.0,dur=.14,gain=.055,center=1200){
    const c=ctx(); if(!c) return;
    const len=Math.max(1,Math.floor(c.sampleRate*dur));
    const b=c.createBuffer(1,len,c.sampleRate), d=b.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    const s=c.createBufferSource(), f=c.createBiquadFilter(), g=c.createGain(), t=c.currentTime+when;
    f.type='bandpass'; f.frequency.value=center; f.Q.value=.75; s.buffer=b;
    g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t+dur);
  }
  function thump(when=0,power=1){ osc(135,when,.18,'sine',.085*power,46); noise(when,.06,.028*power,500); }
  function sweep(when=.03,power=1){ osc(260,when,.23,'sawtooth',.028*power,980); noise(when,.17,.035*power,1900); }
  function sparkle(when=.08,power=1){ [1080,1420,1810,2260].forEach((f,i)=>osc(f,when+i*.035,.12,'sine',.022*power)); }
  function chord(notes,when=.02,power=1){ notes.forEach((f,i)=>osc(f,when+i*.055,.2,'triangle',.034*power)); }
  function rewardSfx(word){
    if(!soundOn()) return;
    const map={
      'NICE!':[620,790],
      'GREAT!':[520,720,960],
      'AMAZING!':[520,720,980,1320],
      'EXCELLENT!':[470,690,980,1370,1720],
      'UNSTOPPABLE!':[410,620,910,1270,1740],
      'OVERDRIVE!':[300,520,850,1280,1860]
    };
    const power=word==='OVERDRIVE!'?1.35:word==='UNSTOPPABLE!'?1.2:1;
    thump(0,power); sweep(.025,power); chord(map[word]||map['NICE!'],.04,power); sparkle(.12,power);
    if(word==='OVERDRIVE!'){
      osc(82,0,.55,'sawtooth',.06,42);
      noise(.12,.38,.075,850);
      osc(220,.18,.34,'square',.03,1120);
    }
  }
  function speak(word){
    if(!soundOn() || !('speechSynthesis' in window)) return;
    if(!['AMAZING!','EXCELLENT!','UNSTOPPABLE!','OVERDRIVE!'].includes(word)) return;
    const now=Date.now(); if(now-lastSpeak<850) return; lastSpeak=now;
    try{
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(word.replace('!',''));
      u.lang='en-US'; u.rate=1.02; u.pitch=word==='OVERDRIVE!'?.78:1.08; u.volume=.95;
      const voices=speechSynthesis.getVoices();
      const v=voices.find(x=>/^en/i.test(x.lang)&&/Samantha|Daniel|Aria|Google US English|Karen/i.test(x.name))||voices.find(x=>/^en/i.test(x.lang));
      if(v) u.voice=v;
      speechSynthesis.speak(u);
    }catch(_){ }
  }

  function combo(){ return parseInt((comboText.textContent||'0').replace(/\D/g,''),10)||0; }
  function praiseWord(raw){
    if(/OVERDRIVE/i.test(raw)) return 'OVERDRIVE!';
    const c=combo();
    if(c>=5) return 'UNSTOPPABLE!';
    if(c===4) return 'EXCELLENT!';
    if(c===3) return 'AMAZING!';
    if(c===2) return 'GREAT!';
    return raw || 'NICE!';
  }
  function spawnParticles(big=false){
    const r=board.getBoundingClientRect(), w=wrap.getBoundingClientRect();
    const cx=r.left-w.left+r.width/2, cy=r.top-w.top+r.height/2;
    const shards=big?34:20, sparks=big?28:14;
    for(let i=0;i<shards;i++){
      const p=document.createElement('i'); p.className='g6-shard';
      p.style.left=(cx+(Math.random()-.5)*r.width*.45)+'px'; p.style.top=(cy+(Math.random()-.5)*r.height*.18)+'px';
      p.style.setProperty('--dx',((Math.random()-.5)*(big?280:190))+'px');
      p.style.setProperty('--dy',((-50-Math.random()*(big?190:130)))+'px');
      p.style.setProperty('--rot',((Math.random()-.5)*900)+'deg'); fx.appendChild(p); setTimeout(()=>p.remove(),760);
    }
    for(let i=0;i<sparks;i++){
      const p=document.createElement('i'); p.className='g6-spark';
      p.style.left=(cx+(Math.random()-.5)*r.width*.55)+'px'; p.style.top=(cy+(Math.random()-.5)*r.height*.16)+'px';
      p.style.setProperty('--dx',((Math.random()-.5)*(big?330:220))+'px');
      p.style.setProperty('--dy',((-50-Math.random()*(big?220:150)))+'px');
      p.style.setProperty('--rot',((Math.random()-.5)*180)+'deg'); fx.appendChild(p); setTimeout(()=>p.remove(),620);
    }
  }
  function beams(){
    const cells=[...board.querySelectorAll('.cell.clearing')];
    if(!cells.length) return;
    const wr=wrap.getBoundingClientRect();
    const rows=new Map(), cols=new Map();
    cells.forEach(el=>{ rows.set(el.dataset.r,(rows.get(el.dataset.r)||0)+1); cols.set(el.dataset.c,(cols.get(el.dataset.c)||0)+1); });
    rows.forEach((n,r)=>{ if(n>=8){ const el=board.querySelector(`.cell[data-r="${r}"]`); if(el){const q=el.getBoundingClientRect(),b=document.createElement('i');b.className='g6-beam-h';b.style.top=(q.top-wr.top+q.height/2-4)+'px';fx.appendChild(b);setTimeout(()=>b.remove(),620);} } });
    cols.forEach((n,c)=>{ if(n>=8){ const el=board.querySelector(`.cell[data-c="${c}"]`); if(el){const q=el.getBoundingClientRect(),b=document.createElement('i');b.className='g6-beam-v';b.style.left=(q.left-wr.left+q.width/2-4)+'px';fx.appendChild(b);setTimeout(()=>b.remove(),620);} } });
  }
  function showPraise(word){
    const c=combo();
    praise.className='g6-praise';
    praise.querySelector('.word').textContent=word;
    praise.querySelector('.combo').textContent=word==='OVERDRIVE!'?'CORE 100% · OVERDRIVE':(c>1?`COMBO X${c}`:'CORE CHARGE');
    void praise.offsetWidth; praise.classList.add('show');
    shell.classList.remove('g6-hit','g6-overdrive'); void shell.offsetWidth;
    shell.classList.add(word==='OVERDRIVE!'?'g6-overdrive':'g6-hit');
    if(mascotWrap){ mascotWrap.classList.remove('reaction-amazing','reaction-excellent','reaction-unstoppable','reaction-overdrive'); mascotWrap.classList.add('reaction-'+word.replace(/!/g,'').toLowerCase()); }
    beams(); spawnParticles(word==='OVERDRIVE!'||c>=4); rewardSfx(word); speak(word);
    setTimeout(()=>{ shell.classList.remove('g6-hit','g6-overdrive'); if(mascotWrap) mascotWrap.className=mascotWrap.className.replace(/\breaction-\S+/g,'').trim(); },950);
  }

  new MutationObserver(()=>{
    const raw=(feedback.textContent||'').trim();
    if(!raw || raw===lastPraise) return;
    const word=praiseWord(raw); lastPraise=word; showPraise(word);
    setTimeout(()=>{ if((feedback.textContent||'').trim()!==raw) lastPraise=''; },1050);
  }).observe(feedback,{childList:true,characterData:true,subtree:true});

  new MutationObserver(()=>{ if(board.querySelector('.cell.clearing')) setTimeout(beams,8); }).observe(board,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  document.addEventListener('pointerdown',()=>{ctx(); if('speechSynthesis' in window) speechSynthesis.getVoices();},{once:true});
})();
