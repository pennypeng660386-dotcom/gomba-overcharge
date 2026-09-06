(() => {
  const SIZE = 8;
  const SAVE_KEY = 'gomba_overdrive_save';
  const SOUND_KEY = 'gomba_overdrive_sound';
  const CONTACT_KEY = 'gomba_contact_submitted';
  const CONTACT_AT = 'gomba_contact_submitted_at';
  const CONTACT_IP = 'gomba_contact_ip';

  const EASY = [
    [[0,0]], [[0,0],[0,1]], [[0,0],[1,0]],
    [[0,0],[0,1],[0,2]], [[0,0],[1,0],[2,0]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[1,0],[1,1]], [[0,0],[0,1],[1,0]]
  ];
  const LATER = [
    [[0,0],[1,0],[2,0],[2,1]],
    [[0,1],[1,0],[1,1],[1,2]],
    [[0,0],[0,1],[0,2],[0,3]],
    [[0,0],[1,0],[2,0],[3,0]],
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[1,0],[1,1],[2,1]]
  ];

  const $ = id => document.getElementById(id);
  const screens = { landing:$('landing'), game:$('game'), result:$('result'), cta:$('cta') };
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

  function track(name, extra={}) { console.log('[GOMBA_EVENT]', name, { ts:Date.now(), ...extra }); }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  function loadSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      return {
        bestScore:d.bestScore||0, bestCombo:d.bestCombo||0, totalGames:d.totalGames||0,
        totalOverdrives:d.totalOverdrives||0, highestStage:d.highestStage||1
      };
    } catch (_) {
      return { bestScore:0,bestCombo:0,totalGames:0,totalOverdrives:0,highestStage:1 };
    }
  }
  function persist() { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }

  function contactSubmitted() { return localStorage.getItem(CONTACT_KEY) === '1'; }
  function markContactSubmitted(ip='') {
    localStorage.setItem(CONTACT_KEY,'1');
    localStorage.setItem(CONTACT_AT,new Date().toISOString());
    if (ip) localStorage.setItem(CONTACT_IP,ip);
  }
  async function readPublicIp() {
    if (navigator.onLine === false) return '';
    try {
      const r = await fetch('https://api.ipify.org?format=json',{cache:'no-store'});
      const d = await r.json();
      return d?.ip ? String(d.ip) : '';
    } catch (_) { return ''; }
  }
  async function sameContactIp() {
    const saved = localStorage.getItem(CONTACT_IP);
    if (!saved) return false;
    const now = await readPublicIp();
    return !!(now && now === saved);
  }
  function buildContactPayload(email, phone) {
    return {
      email:email||undefined, phone:phone||undefined, source:'GOMBA_GAME',
      score:state?.score||0, best_combo:state?.bestCombo||0,
      stage:state?.stage||1, overdrives:state?.overdrives||0,
      timestamp:new Date().toISOString()
    };
  }
  function submitContactLead(payload) { console.log('[GOMBA_CONTACT]', payload); }

  function ensureAudio() {
    if (!soundOn) return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
    return audioCtx;
  }
  function tone(freq, when=0, dur=.1, type='sine', vol=.04, end=0) {
    const c=ensureAudio(); if(!c) return;
    const t=c.currentTime+when, o=c.createOscillator(), g=c.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t);
    if(end) o.frequency.exponentialRampToValueAtTime(Math.max(30,end),t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+dur+.03);
  }
  function noise(when=0,dur=.08,vol=.04,center=1200) {
    const c=ensureAudio(); if(!c) return;
    const len=Math.max(1,Math.floor(c.sampleRate*dur));
    const b=c.createBuffer(1,len,c.sampleRate), data=b.getChannelData(0);
    for(let i=0;i<len;i++) data[i]=(Math.random()*2-1)*(1-i/len);
    const s=c.createBufferSource(), f=c.createBiquadFilter(), g=c.createGain(), t=c.currentTime+when;
    s.buffer=b; f.type='bandpass'; f.frequency.value=center; f.Q.value=.8;
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t+dur);
  }
  function click() { noise(0,.035,.028,2200); tone(180,0,.06,'triangle',.035,70); }
  function speak(word) {
    if(!soundOn || !('speechSynthesis' in window)) return;
    if(!['AMAZING!','EXCELLENT!','UNSTOPPABLE!','OVERDRIVE!'].includes(word)) return;
    const now=Date.now(); if(now-lastSpeak<850) return; lastSpeak=now;
    try {
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(word.replace('!',''));
      u.lang='en-US'; u.rate=1.02; u.pitch=word==='OVERDRIVE!'?.78:1.08; u.volume=.95;
      const voices=speechSynthesis.getVoices();
      u.voice=voices.find(v=>/^en/i.test(v.lang)&&/Samantha|Daniel|Aria|Google US English|Karen/i.test(v.name)) || voices.find(v=>/^en/i.test(v.lang)) || null;
      speechSynthesis.speak(u);
    } catch(_){}
  }
  function rewardSfx(word) {
    if(!soundOn) return;
    const sets={
      'NICE!':[420,620], 'GREAT!':[500,720,930],
      'AMAZING!':[500,700,960,1280],
      'EXCELLENT!':[460,680,980,1320,1680],
      'UNSTOPPABLE!':[400,620,900,1260,1740]
    };
    if(word==='OVERDRIVE!') {
      tone(68,0,.58,'sawtooth',.075,34); noise(.02,.16,.07,430); noise(.14,.38,.075,900);
      [240,520,920,1460,1900].forEach((f,i)=>tone(f,.12+i*.09,.24,i<2?'square':'triangle',.04));
      return;
    }
    tone(word==='EXCELLENT!'||word==='UNSTOPPABLE!'?105:145,0,.15,'sine',.075,48);
    noise(.01,.1,.045,word==='AMAZING!'?1800:1100);
    (sets[word]||sets['NICE!']).forEach((f,i)=>tone(f,.045+i*.07,.17,'triangle',.04));
    [1200,1650,2150].forEach((f,i)=>tone(f,.16+i*.035,.09,'sine',.018));
  }
  function sfx(kind, word='') {
    if(!soundOn) return;
    if(kind==='tap') click();
    else if(kind==='place'){ click(); tone(235,.01,.085,'triangle',.045,86); }
    else if(kind==='invalid') tone(120,0,.15,'sawtooth',.045);
    else if(kind==='clear'||kind==='combo'){ rewardSfx(word||'NICE!'); if(kind==='combo') speak(word); }
    else if(kind==='overdrive'){ rewardSfx('OVERDRIVE!'); speak('OVERDRIVE!'); }
    else if(kind==='over'){ tone(315,0,.12,'sawtooth',.05); tone(175,.08,.24,'triangle',.05); }
    else if(kind==='stage'){ tone(500,0,.08,'triangle',.05); tone(760,.08,.14,'triangle',.05); }
  }

  function syncSoundBtn(){ $('soundBtn').textContent=soundOn?'SOUND ON':'SOUND OFF'; $('soundBtn').setAttribute('aria-pressed',soundOn?'true':'false'); }
  function syncOffline(){ $('statusLeft').textContent=navigator.onLine===false?'OFFLINE MODE':'⚡ ENERGY GRID'; }
  function show(name){ Object.values(screens).forEach(s=>s.classList.remove('active')); screens[name].classList.add('active'); window.scrollTo(0,0); }

  function emptyBoard(){ return Array.from({length:SIZE},()=>Array(SIZE).fill(0)); }
  function cloneCells(c){ return c.map(([r,col])=>[r,col]); }
  function pieceSize(cells){ let maxR=0,maxC=0; for(const[r,c]of cells){maxR=Math.max(maxR,r);maxC=Math.max(maxC,c);} return {rows:maxR+1,cols:maxC+1}; }
  function rotateCells(cells){
    const {rows}=pieceSize(cells); const n=cells.map(([r,c])=>[c,rows-1-r]);
    const mr=Math.min(...n.map(p=>p[0])), mc=Math.min(...n.map(p=>p[1]));
    return n.map(([r,c])=>[r-mr,c-mc]);
  }
  function canPlace(board,cells,r0,c0){
    for(const[r,c]of cells){const rr=r0+r,cc=c0+c;if(rr<0||rr>=SIZE||cc<0||cc>=SIZE||board[rr][cc])return false;} return true;
  }
  function fitsAnywhere(board,cells){ for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(canPlace(board,cells,r,c))return true; return false; }
  function fitsWithRotations(board,cells){ let cur=cloneCells(cells); for(let i=0;i<4;i++){if(fitsAnywhere(board,cur))return true;cur=rotateCells(cur);} return false; }
  function pickShape(board,stage){
    const pool=stage>=3?EASY.concat(LATER):EASY;
    for(let i=0;i<12;i++){const c=cloneCells(pool[Math.floor(Math.random()*pool.length)]);if(fitsWithRotations(board,c))return c;}
    return cloneCells(EASY.find(s=>fitsWithRotations(board,s))||EASY[0]);
  }
  function fillTray(){ state.tray=[0,1,2].map(()=>pickShape(state.board,state.stage)); }
  function anyPieceFits(){ return state.tray.some(p=>p&&fitsWithRotations(state.board,p)); }

  function renderBoard(preview){
    let html='';
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      let cls='cell';
      if(state.board[r][c]) cls+=' filled';
      if(preview?.map[r+','+c]) cls+=preview.ok?' preview-ok':' preview-bad';
      if(state.clearing?.has(r+','+c)) cls+=' clearing';
      html+=`<div class="${cls}" data-r="${r}" data-c="${c}"></div>`;
    }
    boardEl.innerHTML=html;
  }
  function renderPieceGrid(cells,miniClass){
    const {rows,cols}=pieceSize(cells), set=new Set(cells.map(([r,c])=>r+','+c));
    let html=`<div class="piece-grid" style="grid-template-columns:repeat(${cols},auto)">`;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)html+=set.has(r+','+c)?`<i class="${miniClass}" data-pr="${r}" data-pc="${c}"></i>`:`<i class="${miniClass}" data-pr="${r}" data-pc="${c}" style="visibility:hidden"></i>`;
    return html+'</div>';
  }
  function renderTray(){
    trayEl.innerHTML=state.tray.map((p,i)=>!p?'<div class="piece used"></div>':`<div class="piece" data-tray="${i}"><button type="button" class="rotate" data-rotate="${i}" aria-label="Rotate">↻</button>${renderPieceGrid(p,'mini')}</div>`).join('');
  }
  function updateHud(){
    $('scoreText').textContent=state.score; $('bestText').textContent=Math.max(save.bestScore,state.score);
    $('comboText').textContent=`×${state.combo}`; $('stageText').textContent=state.stage;
    $('coreText').textContent=`${Math.round(state.core)}%`; $('coreFill').style.width=`${state.core}%`;
    $('coreGlow').style.opacity=String(.2+state.core*.007); $('mascotWrap').classList.toggle('charged',state.core>=70);
  }
  function flashMsg(t){$('feedback').textContent=t;clearTimeout(flashMsg.t);flashMsg.t=setTimeout(()=>$('feedback').textContent='',850);}
  function cheerFor(n,combo){ if(combo>=5)return['UNSTOPPABLE!','unstoppable']; if(combo===4)return['EXCELLENT!','excellent']; if(combo===3)return['AMAZING!','amazing']; if(combo===2||n>=2)return['GREAT!','great']; return['NICE!','nice']; }
  function reactMascot(kind){
    const el=$('mascotWrap'); el.className='mascot-chamber'+(state?.core>=70?' charged':''); if(!kind)return;
    el.classList.add('react-'+kind); if(kind!=='gameover'){clearTimeout(reactMascot.t);reactMascot.t=setTimeout(()=>el.classList.remove('react-'+kind),950);}
  }
  function shake(ms=200){shell.classList.remove('shaking');void shell.offsetWidth;shell.classList.add('shaking');setTimeout(()=>shell.classList.remove('shaking'),ms);}
  function flashScreen(){const e=$('fxFlash');e.classList.remove('on');void e.offsetWidth;e.classList.add('on');setTimeout(()=>e.classList.remove('on'),300);}
  function showPraise(word,combo){
    const e=$('praise'); $('praiseWord').textContent=word; $('praisePlate').textContent=word==='OVERDRIVE!'?'CORE 100%':combo>1?`COMBO X${combo}`:'LINE CLEAR';
    e.hidden=false; void e.offsetWidth; clearTimeout(showPraise.t); showPraise.t=setTimeout(()=>e.hidden=true,1100);
  }
  function powerFrame(big=false){ shell.classList.remove('power-hit','power-max'); void shell.offsetWidth; shell.classList.add(big?'power-max':'power-hit'); setTimeout(()=>shell.classList.remove('power-hit','power-max'),big?1000:650); }

  function fireBeams(lines,explode=false){
    const lr=fxLayer.getBoundingClientRect();
    lines.rows.forEach(r=>{const cell=boardEl.querySelector(`[data-r="${r}"][data-c="0"]`);if(!cell)return;const q=cell.getBoundingClientRect();const b=document.createElement('i');b.className='beam row';b.style.top=(q.top-lr.top+q.height/2)+'px';fxLayer.appendChild(b);setTimeout(()=>b.remove(),650);});
    lines.cols.forEach(c=>{const cell=boardEl.querySelector(`[data-r="0"][data-c="${c}"]`);if(!cell)return;const q=cell.getBoundingClientRect();const b=document.createElement('i');b.className='beam col';b.style.left=(q.left-lr.left+q.width/2)+'px';fxLayer.appendChild(b);setTimeout(()=>b.remove(),650);});
    if(explode||(lines.rows.length&&lines.cols.length)){const x=document.createElement('i');x.className='beam cross';fxLayer.appendChild(x);setTimeout(()=>x.remove(),760);}
  }
  function spawnDebris(big=false){
    const lr=fxLayer.getBoundingClientRect(), br=boardEl.getBoundingClientRect(), cx=br.left-lr.left+br.width/2, cy=br.top-lr.top+br.height/2;
    const shards=big?46:28, sparks=big?38:22;
    for(let i=0;i<shards;i++){const p=document.createElement('i');p.className='shard';p.style.left=(cx+(Math.random()-.5)*br.width*.65)+'px';p.style.top=(cy+(Math.random()-.5)*br.height*.35)+'px';p.style.setProperty('--dx',((Math.random()-.5)*(big?360:240))+'px');p.style.setProperty('--dy',((-50-Math.random()*(big?240:170)))+'px');fxLayer.appendChild(p);setTimeout(()=>p.remove(),760);}
    for(let i=0;i<sparks;i++){const p=document.createElement('i');p.className='spark';p.style.left=(cx+(Math.random()-.5)*br.width*.7)+'px';p.style.top=(cy+(Math.random()-.5)*br.height*.32)+'px';p.style.setProperty('--dx',((Math.random()-.5)*(big?420:290))+'px');p.style.setProperty('--dy',((-50-Math.random()*(big?260:190)))+'px');fxLayer.appendChild(p);setTimeout(()=>p.remove(),820);}
  }
  function spawnCoreBits(){
    const lr=fxLayer.getBoundingClientRect(),br=boardEl.getBoundingClientRect(),core=$('mascotWrap').getBoundingClientRect();
    const tx=core.left-lr.left+core.width/2,ty=core.top-lr.top+core.height/2;
    for(let i=0;i<14;i++){const p=document.createElement('i'),sx=br.left-lr.left+br.width*(.15+Math.random()*.7),sy=br.top-lr.top+br.height*(.2+Math.random()*.6);p.className='core-bit';p.style.left=sx+'px';p.style.top=sy+'px';p.style.setProperty('--tx',(tx-sx)+'px');p.style.setProperty('--ty',(ty-sy)+'px');fxLayer.appendChild(p);setTimeout(()=>p.remove(),850);}
  }
  function playClearFx(lines,n,combo,word,kind){ showPraise(word,combo);reactMascot(kind);fireBeams(lines,n>=2||combo>=3);flashScreen();spawnDebris(n>=2||combo>=3);spawnCoreBits();powerFrame(combo>=4);shake(combo>=4?320:250);flashMsg(word);sfx(combo>=2||n>=2?'combo':'clear',word); }

  function showStageBanner(n){const e=$('stageBanner');$('stageBannerNum').textContent=`STAGE ${n}`;e.hidden=false;sfx('stage');setTimeout(()=>e.hidden=true,1000);}
  function checkStage(){const next=Math.max(1+Math.floor(state.score/500),1+state.overdrives);if(next>state.stage){state.stage=next;if(next>save.highestStage){save.highestStage=next;persist();}updateHud();showStageBanner(next);}}

  function startGame(){
    ensureAudio(); if('speechSynthesis'in window)speechSynthesis.getVoices();
    state={board:emptyBoard(),tray:[null,null,null],score:0,combo:0,bestCombo:0,core:0,stage:1,overdrives:0,clearing:null};
    busy=false;fillTray();hintEl.classList.toggle('gone',sessionStorage.getItem('gomba_hint_seen')==='1');$('mascotWrap').className='mascot-chamber';$('coreFill').classList.remove('hot');shell.classList.remove('overdrive-dark');renderBoard();renderTray();updateHud();syncOffline();show('game');track('game_start');
  }
  function findPreview(r0,c0,cells){const map={};let ok=true;for(const[r,c]of cells){const rr=r0+r,cc=c0+c;map[rr+','+cc]=true;if(rr<0||rr>=SIZE||cc<0||cc>=SIZE||state.board[rr][cc])ok=false;}return{r0,c0,map,ok};}
  function linesToClear(board){const rows=[],cols=[];for(let r=0;r<SIZE;r++)if(board[r].every(Boolean))rows.push(r);for(let c=0;c<SIZE;c++){let full=true;for(let r=0;r<SIZE;r++)if(!board[r][c]){full=false;break;}if(full)cols.push(c);}return{rows,cols};}
  function applyClears(board,lines){const marks=new Set();lines.rows.forEach(r=>{for(let c=0;c<SIZE;c++)marks.add(r+','+c)});lines.cols.forEach(c=>{for(let r=0;r<SIZE;r++)marks.add(r+','+c)});marks.forEach(k=>{const[r,c]=k.split(',').map(Number);board[r][c]=0;});return marks;}
  function pickOverdriveTarget(board){let best={type:'row',index:0,count:-1};for(let r=0;r<SIZE;r++){const count=board[r].reduce((n,v)=>n+(v?1:0),0);if(count>best.count)best={type:'row',index:r,count};}for(let c=0;c<SIZE;c++){let count=0;for(let r=0;r<SIZE;r++)if(board[r][c])count++;if(count>best.count)best={type:'col',index:c,count};}return best;}
  async function triggerOverdrive(){
    const target=pickOverdriveTarget(state.board), lines={rows:[],cols:[]}; if(target.type==='row')lines.rows.push(target.index);else lines.cols.push(target.index);
    const marks=applyClears(state.board,lines);state.score+=150+target.count*8;state.overdrives++;save.totalOverdrives++;state.core=0;persist();
    await wait(100);shell.classList.add('overdrive-dark');$('coreFill').classList.add('hot');reactMascot('overdrive');state.clearing=marks;renderBoard();updateHud();
    fireBeams({rows:[target.type==='row'?target.index:3],cols:[target.type==='col'?target.index:3]},true);flashScreen();spawnDebris(true);spawnCoreBits();powerFrame(true);shake(360);showPraise('OVERDRIVE!',state.combo);flashMsg('OVERDRIVE!');sfx('overdrive');checkStage();track('overdrive',{stage:state.stage,target});
    await wait(950);state.clearing=null;$('coreFill').classList.remove('hot');shell.classList.remove('overdrive-dark');renderBoard();updateHud();if(state.overdrives===3)maybeShowCta('overdrive3');
  }
  async function afterPlace(cells){
    busy=true;state.score+=cells.length*5;const lines=linesToClear(state.board),n=lines.rows.length+lines.cols.length;
    if(n){state.combo++;state.bestCombo=Math.max(state.bestCombo,state.combo);state.score+=n*50+Math.max(0,n-1)*25+(state.combo>1?state.combo*10:0);state.core=Math.min(100,state.core+n*20);const marks=applyClears(state.board,lines);state.clearing=marks;const[text,kind]=cheerFor(n,state.combo);renderBoard();updateHud();playClearFx(lines,n,state.combo,text,kind);track('line_clear',{lines:n,combo:state.combo});checkStage();await wait(470);state.clearing=null;renderBoard();if(state.core>=100)await triggerOverdrive();else updateHud();finishTurn();}
    else{state.combo=0;updateHud();renderBoard();checkStage();finishTurn();}
    busy=false;
  }
  function finishTurn(){if(state.tray.every(p=>!p))fillTray();renderTray();updateHud();if(!anyPieceFits())endGame();}
  function endGame(){const isBest=state.score>save.bestScore;if(isBest)save.bestScore=state.score;if(state.bestCombo>save.bestCombo)save.bestCombo=state.bestCombo;save.totalGames++;persist();reactMascot('gameover');$('newBest').hidden=!isBest;$('finalScore').textContent=state.score;$('finalBest').textContent=save.bestScore;$('finalOver').textContent=state.overdrives;$('finalCombo').textContent=`×${state.bestCombo}`;$('finalStage').textContent=state.stage;sfx('over');show('result');track('game_over',{score:state.score,overdrives:state.overdrives,stage:state.stage});if(state.score>=250||state.overdrives>=1||state.bestCombo>=3)maybeShowCta('gameover');}

  async function maybeShowCta(reason){if(contactSubmitted()||ctaShown)return;if(await sameContactIp()){markContactSubmitted(localStorage.getItem(CONTACT_IP));return;}ctaShown=true;afterCta=reason==='overdrive3'?'game':'result';$('ctaOffline').hidden=navigator.onLine!==false;$('ctaForm').hidden=false;$('ctaThanks').hidden=true;track('contact_cta_view',{reason});if(reason==='overdrive3')show('cta');else setTimeout(()=>{if(screens.result.classList.contains('active'))show('cta')},700);}
  function goHome(){drag=null;busy=false;ghostEl.hidden=true;state=null;show('landing');}
  function rotateTray(index){if(!state||drag||!state.tray[index])return;state.tray[index]=rotateCells(state.tray[index]);renderTray();}

  // V0.7.4: one local boardMachine coordinate system. Ghost and preview share the same r0/c0.
  function boardMetrics(){
    const machine=$('boardMachine');
    const a=boardEl.querySelector('[data-r="0"][data-c="0"]');
    const x=boardEl.querySelector('[data-r="0"][data-c="1"]');
    const y=boardEl.querySelector('[data-r="1"][data-c="0"]');
    if(!machine||!a||!x||!y)return null;
    const mr=machine.getBoundingClientRect(),qa=a.getBoundingClientRect(),qx=x.getBoundingClientRect(),qy=y.getBoundingClientRect(),br=boardEl.getBoundingClientRect();
    return {
      machine:mr, board:br,
      cellW:qa.width, cellH:qa.height,
      stepX:qx.left-qa.left, stepY:qy.top-qa.top,
      originX:qa.left-mr.left-machine.clientLeft, originY:qa.top-mr.top-machine.clientTop,
      gapX:Math.max(0,qx.left-qa.right), gapY:Math.max(0,qy.top-qa.bottom)
    };
  }
  function defaultGrab(cells){
    const {rows,cols}=pieceSize(cells), cr=(rows-1)/2, cc=(cols-1)/2;
    return cells.slice().sort((a,b)=>((a[0]-cr)**2+(a[1]-cc)**2)-((b[0]-cr)**2+(b[1]-cc)**2))[0] || [0,0];
  }
  function pointGrab(e,slot,cells){
    const mini=e.target.closest('.mini');
    if(mini&&slot.contains(mini)){
      const r=Number(mini.dataset.pr),c=Number(mini.dataset.pc);
      if(cells.some(([rr,cc])=>rr===r&&cc===c))return {r,c};
    }
    const [r,c]=defaultGrab(cells); return {r,c};
  }
  function snapFromPointer(clientX,clientY,grab,m){
    if(!m)return null;
    const machine=$('boardMachine');
    const mr=machine.getBoundingClientRect(), br=boardEl.getBoundingClientRect();
    const localX=clientX-mr.left-machine.clientLeft, localY=clientY-mr.top-machine.clientTop;
    const hitC=Math.floor((localX-m.originX)/m.stepX);
    const hitR=Math.floor((localY-m.originY)/m.stepY);
    const c0=hitC-grab.c, r0=hitR-grab.r;
    const left=m.originX+c0*m.stepX, top=m.originY+r0*m.stepY;
    const inside=clientX>=br.left&&clientX<=br.right&&clientY>=br.top&&clientY<=br.bottom;
    return {r0,c0,left,top,m,inside};
  }
  function paintGhost(cells,m){
    ghostEl.innerHTML=renderPieceGrid(cells,'mini');
    const g=ghostEl.querySelector('.piece-grid'); if(!g)return;
    g.style.gap=`${m.gapY}px ${m.gapX}px`;
    g.querySelectorAll('.mini').forEach(el=>{el.style.width=m.cellW+'px';el.style.height=m.cellH+'px';});
  }
  function updateDragAt(clientX,clientY){
    if(!drag)return null;
    const pos=snapFromPointer(clientX,clientY,drag.grab,drag.m); if(!pos)return null;
    if(!drag.painted){paintGhost(drag.cells,pos.m);drag.painted=true;}
    ghostEl.style.left=pos.left+'px';ghostEl.style.top=pos.top+'px';
    const preview=pos.inside?findPreview(pos.r0,pos.c0,drag.cells):{r0:pos.r0,c0:pos.c0,map:{},ok:false};
    drag.preview=preview; drag.last={clientX,clientY}; renderBoard(preview); ghostEl.classList.toggle('valid',preview.ok);ghostEl.classList.toggle('invalid',!preview.ok);return preview;
  }
  function onPointerDown(e){
    if(!state||busy)return;
    const rot=e.target.closest('[data-rotate]');if(rot){e.preventDefault();e.stopPropagation();rotateTray(Number(rot.dataset.rotate));sfx('tap');return;}
    const slot=e.target.closest('[data-tray]');if(!slot)return;
    const index=Number(slot.dataset.tray),piece=state.tray[index];if(!piece)return;
    e.preventDefault();try{slot.setPointerCapture?.(e.pointerId);}catch(_){}
    renderBoard();
    drag={index,cells:cloneCells(piece),grab:pointGrab(e,slot,piece),painted:false,preview:null,last:null,m:boardMetrics()};
    ghostEl.hidden=false;updateDragAt(e.clientX,e.clientY);
  }
  function onPointerMove(e){if(!drag)return;e.preventDefault();updateDragAt(e.clientX,e.clientY);}
  function onPointerUp(e){
    if(!drag)return;e.preventDefault();
    // Recalculate at the release coordinate so placement never uses a stale preview frame.
    updateDragAt(e.clientX,e.clientY);
    const current=drag,preview=current.preview;drag=null;ghostEl.hidden=true;ghostEl.innerHTML='';ghostEl.classList.remove('valid','invalid');
    if(preview?.ok){current.cells.forEach(([r,c])=>state.board[preview.r0+r][preview.c0+c]=1);state.tray[current.index]=null;hintEl.classList.add('gone');sessionStorage.setItem('gomba_hint_seen','1');sfx('place');track('piece_place',{cells:current.cells.length,r:preview.r0,c:preview.c0});afterPlace(current.cells);}
    else{sfx('invalid');renderBoard();renderTray();}
  }

  trayEl.addEventListener('pointerdown',onPointerDown,{passive:false});
  window.addEventListener('pointermove',onPointerMove,{passive:false});
  window.addEventListener('pointerup',onPointerUp,{passive:false});
  window.addEventListener('pointercancel',onPointerUp,{passive:false});
  window.addEventListener('online',syncOffline);window.addEventListener('offline',syncOffline);

  function tapThen(fn){return()=>{sfx('tap');fn();};}
  $('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;localStorage.setItem(SOUND_KEY,soundOn?'1':'0');syncSoundBtn();if(soundOn){ensureAudio();sfx('tap');}else if('speechSynthesis'in window)speechSynthesis.cancel();});
  $('playBtn').addEventListener('click',tapThen(startGame));$('againBtn').addEventListener('click',tapThen(()=>{track('retry');startGame();}));$('backHomeBtn').addEventListener('click',tapThen(goHome));$('gameClose').addEventListener('click',tapThen(goHome));$('resultClose').addEventListener('click',tapThen(goHome));$('ctaClose').addEventListener('click',tapThen(goHome));$('ctaHome').addEventListener('click',tapThen(goHome));
  $('ctaKeep').addEventListener('click',tapThen(()=>{if(afterCta==='game'&&state)show('game');else if(state)show('result');else show('landing');}));
  $('ctaForm').addEventListener('submit',e=>{e.preventDefault();const email=$('ctaEmail').value.trim(),phone=$('ctaPhone').value.trim(),emailOk=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),phoneOk=phone.replace(/\D/g,'').length>=6;if(!emailOk&&!phoneOk)return;submitContactLead(buildContactPayload(emailOk?email:'',phoneOk?phone:''));markContactSubmitted();readPublicIp().then(ip=>{if(ip)localStorage.setItem(CONTACT_IP,ip)});sfx('tap');$('ctaForm').hidden=true;$('ctaThanks').hidden=false;$('ctaEmail').value='';$('ctaPhone').value='';});

  if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  syncSoundBtn();syncOffline();$('bestText').textContent=save.bestScore;track('play_visit');

  window.addEventListener('gomba-qa',async ev=>{if(!state)return;const d=ev.detail||{};if(d.overdrive){state.core=100;await triggerOverdrive();return;}if(d.cta){ctaShown=false;await maybeShowCta(d.reason||'gameover');return;}if(d.rows||d.cols){const lines={rows:d.rows||[],cols:d.cols||[]};lines.rows.forEach(r=>{for(let c=0;c<SIZE;c++)state.board[r][c]=1});lines.cols.forEach(c=>{for(let r=0;r<SIZE;r++)state.board[r][c]=1});state.combo=d.combo||3;state.core=Math.min(100,state.core+20);const marks=applyClears(state.board,lines);state.clearing=marks;const[text,kind]=cheerFor(lines.rows.length+lines.cols.length,state.combo);renderBoard();updateHud();playClearFx(lines,lines.rows.length+lines.cols.length,state.combo,text,kind);await wait(470);state.clearing=null;renderBoard();}});
})();
