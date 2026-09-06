(() => {
  const api = {
    ready: false,
    lineClear() {},
    combo() {},
    overdrive() {},
    corePulse() {},
    mascotReact() {},
    setActive() {},
    syncCore() {}
  };
  window.GombaFX = api;
  if (typeof Phaser === 'undefined') return;

  const SIZE = 8;
  let scene = null;
  let game = null;
  let active = false;
  let corePct = 0;

  function hostEl() { return document.getElementById('gombaFxHost'); }
  function shellEl() { return document.getElementById('appShell'); }
  function boardEl() { return document.getElementById('board'); }
  function mascotEl() { return document.getElementById('mascotWrap'); }

  function localRect(el) {
    const host = hostEl();
    if (!host || !el) return null;
    const a = host.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height, cx: b.left - a.left + b.width / 2, cy: b.top - a.top + b.height / 2 };
  }

  function boardMap() {
    const board = boardEl();
    const br = localRect(board);
    if (!board || !br) return null;
    const cells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const el = board.querySelector(`[data-r="${r}"][data-c="${c}"]`);
        const q = localRect(el);
        if (q) cells.push({ r, c, ...q });
      }
    }
    return { board: br, cells };
  }

  function cellAt(map, r, c) {
    return map.cells.find((k) => k.r === r && k.c === c) || null;
  }

  class FxScene extends Phaser.Scene {
    create() {
      this.makeTextures();
      this.makeLayers();
      this.makeParticles();
      this.makePraise();
      this.makeAmbience();
      this.scale.on('resize', () => this.fitHost());
      this.fitHost();
      scene = this;
      api.ready = true;
    }

    fitHost() {
      const host = hostEl();
      if (!host || !this.scale) return;
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      if (this.scale.width !== w || this.scale.height !== h) this.scale.resize(w, h);
    }

    makeTextures() {
      const spark = this.add.graphics();
      spark.fillStyle(0xfff3b0, 1);
      spark.fillRoundedRect(5, 0, 6, 22, 3);
      spark.fillStyle(0xff7a00, 0.95);
      spark.fillRoundedRect(6, 2, 4, 18, 2);
      spark.generateTexture('fx-spark', 16, 22);
      spark.destroy();

      const shard = this.add.graphics();
      shard.fillStyle(0xff8500, 1);
      shard.fillTriangle(8, 0, 16, 18, 0, 14);
      shard.fillStyle(0xffe08a, 0.85);
      shard.fillTriangle(8, 2, 12, 12, 5, 11);
      shard.generateTexture('fx-shard', 16, 18);
      shard.destroy();

      const ember = this.add.graphics();
      ember.fillStyle(0xff9d00, 1);
      ember.fillCircle(6, 6, 6);
      ember.fillStyle(0xfff1a0, 0.85);
      ember.fillCircle(5, 5, 3);
      ember.generateTexture('fx-ember', 12, 12);
      ember.destroy();

      const hot = this.add.graphics();
      hot.fillStyle(0xfff4c2, 1);
      hot.fillRoundedRect(0, 0, 48, 48, 6);
      hot.fillStyle(0xffe08a, 1);
      hot.fillRoundedRect(4, 4, 40, 40, 4);
      hot.lineStyle(2, 0xffffff, 1);
      hot.strokeRoundedRect(1, 1, 46, 46, 6);
      hot.generateTexture('fx-hot', 48, 48);
      hot.destroy();

      const beamH = this.add.graphics();
      beamH.fillStyle(0xff4b00, 0.18);
      beamH.fillRect(0, 0, 256, 24);
      beamH.fillStyle(0xff9d00, 0.6);
      beamH.fillRect(0, 6, 256, 12);
      beamH.fillStyle(0xfff4c2, 1);
      beamH.fillRect(0, 9, 256, 6);
      beamH.fillStyle(0xffffff, 1);
      beamH.fillRect(0, 10, 256, 3);
      beamH.generateTexture('fx-beam-h', 256, 24);
      beamH.destroy();

      const beamV = this.add.graphics();
      beamV.fillStyle(0xff4b00, 0.18);
      beamV.fillRect(0, 0, 24, 256);
      beamV.fillStyle(0xff9d00, 0.6);
      beamV.fillRect(6, 0, 12, 256);
      beamV.fillStyle(0xfff4c2, 1);
      beamV.fillRect(9, 0, 6, 256);
      beamV.fillStyle(0xffffff, 1);
      beamV.fillRect(10, 0, 3, 256);
      beamV.generateTexture('fx-beam-v', 24, 256);
      beamV.destroy();

      const boom = this.add.graphics();
      boom.fillStyle(0xff3b00, 0.2);
      boom.fillCircle(80, 80, 80);
      boom.fillStyle(0xff7a00, 0.5);
      boom.fillCircle(80, 80, 48);
      boom.fillStyle(0xffe08a, 0.9);
      boom.fillCircle(80, 80, 26);
      boom.fillStyle(0xffffff, 1);
      boom.fillCircle(80, 80, 10);
      boom.generateTexture('fx-cross', 160, 160);
      boom.destroy();

      const wave = this.add.graphics();
      wave.lineStyle(10, 0xff6a00, 0.85);
      wave.strokeCircle(80, 80, 62);
      wave.lineStyle(4, 0xfff1a0, 0.7);
      wave.strokeCircle(80, 80, 70);
      wave.generateTexture('fx-wave', 160, 160);
      wave.destroy();

      const haze = this.add.graphics();
      haze.fillStyle(0xff6a00, 0.16);
      haze.fillEllipse(80, 24, 160, 48);
      haze.generateTexture('fx-haze', 160, 48);
      haze.destroy();

      const halo = this.add.graphics();
      halo.lineStyle(10, 0xff6a00, 0.55);
      halo.strokeCircle(48, 48, 36);
      halo.lineStyle(4, 0xffc43d, 0.45);
      halo.strokeCircle(48, 48, 42);
      halo.generateTexture('fx-halo', 96, 96);
      halo.destroy();
    }

    makeLayers() {
      this.edge = this.add.rectangle(0, 0, 10, 10).setStrokeStyle(3, 0xff6a00, 0.22).setOrigin(0).setFillStyle(0x000000, 0);
      this.haze = this.add.image(0, 0, 'fx-haze').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.18);
      this.flash = this.add.rectangle(0, 0, 10, 10, 0xfff4c2, 0).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(18);
      this.dark = this.add.rectangle(0, 0, 10, 10, 0x000000, 0).setOrigin(0).setDepth(16);
      this.halo = this.add.image(0, 0, 'fx-halo').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(4);
    }

    makeParticles() {
      this.sparks = this.add.particles(0, 0, 'fx-spark', {
        speed: { min: 120, max: 380 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 320, max: 680 },
        scale: { start: 1, end: 0.08 },
        alpha: { start: 1, end: 0 },
        rotate: { min: 0, max: 360 },
        gravityY: 80,
        blendMode: 'ADD',
        emitting: false,
        maxAliveParticles: 70
      }).setDepth(12);
      this.shards = this.add.particles(0, 0, 'fx-shard', {
        speed: { min: 80, max: 300 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 380, max: 760 },
        scale: { start: 0.95, end: 0.15 },
        alpha: { start: 1, end: 0 },
        rotate: { min: -160, max: 200 },
        gravityY: 210,
        emitting: false,
        maxAliveParticles: 50
      }).setDepth(12);
      this.embers = this.add.particles(0, 0, 'fx-ember', {
        speed: { min: 16, max: 70 },
        lifespan: { min: 600, max: 1300 },
        scale: { start: 0.65, end: 0.05 },
        alpha: { start: 0.8, end: 0 },
        gravityY: -24,
        blendMode: 'ADD',
        emitting: false,
        maxAliveParticles: 40
      }).setDepth(11);
      this.toCore = this.add.particles(0, 0, 'fx-ember', {
        lifespan: 700,
        scale: { start: 0.55, end: 0.08 },
        alpha: { start: 0.9, end: 0 },
        blendMode: 'ADD',
        emitting: false,
        maxAliveParticles: 24
      }).setDepth(11);
      this.idleZone = new Phaser.Geom.Rectangle(0, 0, 10, 10);
      this.idleEmbers = this.add.particles(0, 0, 'fx-ember', {
        emitZone: { type: 'random', source: this.idleZone },
        frequency: 240,
        quantity: 1,
        speedY: { min: -22, max: -6 },
        speedX: { min: -10, max: 10 },
        lifespan: 1400,
        scale: { start: 0.28, end: 0.04 },
        alpha: { start: 0.35, end: 0 },
        blendMode: 'ADD',
        emitting: false,
        maxAliveParticles: 18
      }).setDepth(5);
    }

    makePraise() {
      this.praise = this.add.container(0, 0).setDepth(22).setAlpha(0);
      this.praiseBar = this.add.rectangle(0, 8, 300, 5, 0xfff4c2, 1).setBlendMode(Phaser.BlendModes.ADD);
      this.praiseWord = this.add.text(0, -20, 'AMAZING!', {
        fontFamily: 'Impact, Arial Black, Arial',
        fontSize: '64px',
        fontStyle: 'italic',
        color: '#fff8dc',
        stroke: '#4a1200',
        strokeThickness: 12,
        shadow: { offsetX: 0, offsetY: 3, color: '#ff6a00', blur: 18, stroke: true, fill: true }
      }).setOrigin(0.5);
      this.praisePlate = this.add.rectangle(0, 42, 170, 34, 0x120800, 0.95).setStrokeStyle(3, 0xff8b00);
      this.praiseSub = this.add.text(0, 42, 'COMBO X4', {
        fontFamily: 'Impact, Arial Black, Arial',
        fontSize: '18px',
        color: '#ffc63f'
      }).setOrigin(0.5);
      this.praise.add([this.praiseBar, this.praisePlate, this.praiseWord, this.praiseSub]);
      try {
        this.praiseWord.enableFilters();
        this.praiseWord.filters.external.addGlow(0xff6a00, 4, 0, 1.1, false, 8, 10);
      } catch (_) {}
    }

    makeAmbience() {
      this.tweens.add({ targets: this.edge, alpha: { from: 0.18, to: 0.55 }, duration: 1800, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: this.haze, alpha: { from: 0.08, to: 0.28 }, x: '+=40', duration: 4200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.time.addEvent({
        delay: 720,
        loop: true,
        callback: () => {
          if (!active) return;
          const map = boardMap();
          if (!map) return;
          const filled = [...boardEl().querySelectorAll('.cell.filled')];
          const pick = filled[Math.floor(Math.random() * Math.max(1, filled.length))];
          const q = localRect(pick || boardEl());
          if (q) this.sparks.explode(2, q.cx, q.cy);
          if (Math.random() < 0.35) this.arcNearMascot();
        }
      });
    }

    syncLayout() {
      const host = hostEl();
      const map = boardMap();
      const mascot = localRect(mascotEl());
      if (!host) return map;
      const w = host.clientWidth;
      const h = host.clientHeight;
      this.edge.setPosition(5, 5).setSize(w - 10, h - 10);
      this.flash.setSize(w, h);
      this.dark.setSize(w, h);
      if (map) {
        this.haze.setPosition(map.board.cx, map.board.cy);
        this.haze.setDisplaySize(map.board.w * 1.05, 64);
        this.idleZone.setTo(map.board.x, map.board.y, map.board.w, map.board.h);
      }
      if (mascot) {
        this.halo.setPosition(mascot.cx, mascot.cy);
        this.halo.setDisplaySize(mascot.w * 1.35, mascot.h * 1.35);
      }
      this.halo.setAlpha(active ? 0.18 + corePct * 0.006 : 0);
      this.edge.setVisible(active);
      this.haze.setVisible(active);
      this.praise.setVisible(active);
      if (active) this.idleEmbers.start();
      else this.idleEmbers.stop();
      return map;
    }

    heatCells(map, rows, cols) {
      const marks = [];
      rows.forEach((r) => {
        for (let c = 0; c < SIZE; c++) {
          const cell = cellAt(map, r, c);
          if (cell) marks.push(cell);
        }
      });
      cols.forEach((c) => {
        for (let r = 0; r < SIZE; r++) {
          const cell = cellAt(map, r, c);
          if (cell) marks.push(cell);
        }
      });
      marks.forEach((cell) => {
        const img = this.add.image(cell.cx, cell.cy, 'fx-hot')
          .setDisplaySize(cell.w, cell.h)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(9);
        this.tweens.add({ targets: img, alpha: 0, delay: 220, duration: 220, onComplete: () => img.destroy() });
      });
    }

    beamRow(map, r, fat) {
      const a = cellAt(map, r, 0);
      const b = cellAt(map, r, 7);
      if (!a || !b) return;
      const img = this.add.image((a.cx + b.cx) / 2, a.cy, 'fx-beam-h')
        .setDisplaySize(map.board.w * 1.06, fat ? 26 : 14)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.08, 1)
        .setDepth(10);
      this.tweens.add({ targets: img, scaleX: 1, duration: 90, ease: 'Cubic.Out' });
      this.tweens.add({ targets: img, alpha: 0, delay: 360, duration: 220, onComplete: () => img.destroy() });
      this.sparks.explode(fat ? 10 : 7, a.cx, a.cy);
      this.sparks.explode(fat ? 10 : 7, b.cx, b.cy);
    }

    beamCol(map, c, fat) {
      const a = cellAt(map, 0, c);
      const b = cellAt(map, 7, c);
      if (!a || !b) return;
      const img = this.add.image(a.cx, (a.cy + b.cy) / 2, 'fx-beam-v')
        .setDisplaySize(fat ? 26 : 14, map.board.h * 1.06)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(1, 0.08)
        .setDepth(10);
      this.tweens.add({ targets: img, scaleY: 1, duration: 90, ease: 'Cubic.Out' });
      this.tweens.add({ targets: img, alpha: 0, delay: 360, duration: 220, onComplete: () => img.destroy() });
      this.sparks.explode(fat ? 10 : 7, a.cx, a.cy);
      this.sparks.explode(fat ? 10 : 7, b.cx, b.cy);
    }

    bolt(x0, y0, x1, y1, fat) {
      const g = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(14);
      const segs = 10;
      const pts = [];
      const vertical = Math.abs(x1 - x0) < Math.abs(y1 - y0);
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        pts.push({
          x: x0 + (x1 - x0) * t + (vertical ? (Math.random() - 0.5) * (fat ? 30 : 16) : 0),
          y: y0 + (y1 - y0) * t + (vertical ? 0 : (Math.random() - 0.5) * (fat ? 30 : 16))
        });
      }
      g.lineStyle(fat ? 12 : 7, 0xff6a00, 0.5);
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach((p) => g.lineTo(p.x, p.y)); g.strokePath();
      g.lineStyle(fat ? 5 : 3, 0xfff4c2, 1);
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach((p) => g.lineTo(p.x, p.y)); g.strokePath();
      this.tweens.add({ targets: g, alpha: 0, delay: 140, duration: 240, onComplete: () => g.destroy() });
    }

    blast(x, y, dense) {
      const cross = this.add.image(x, y, 'fx-cross').setBlendMode(Phaser.BlendModes.ADD).setScale(0.18).setDepth(13);
      this.tweens.add({
        targets: cross,
        scale: dense ? 2.2 : 1.55,
        alpha: 0,
        duration: dense ? 560 : 420,
        ease: 'Cubic.Out',
        onComplete: () => cross.destroy()
      });
      this.sparks.explode(dense ? 48 : 28, x, y);
      this.shards.explode(dense ? 26 : 16, x, y);
      this.embers.explode(dense ? 18 : 10, x, y);
    }

    shockwave(x, y) {
      const wave = this.add.image(x, y, 'fx-wave').setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setDepth(12);
      this.tweens.add({ targets: wave, scale: 2.4, alpha: 0, duration: 480, ease: 'Cubic.Out', onComplete: () => wave.destroy() });
    }

    suckToCore(map) {
      const mascot = localRect(mascotEl());
      if (!mascot) return;
      for (let i = 0; i < 10; i++) {
        const sx = map.board.x + map.board.w * (0.15 + Math.random() * 0.7);
        const sy = map.board.y + map.board.h * (0.2 + Math.random() * 0.6);
        const bit = this.add.image(sx, sy, 'fx-ember').setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setDepth(11);
        this.tweens.add({
          targets: bit,
          x: mascot.cx,
          y: mascot.cy,
          scale: 0.08,
          alpha: 0,
          duration: 640,
          ease: 'Cubic.In',
          onComplete: () => bit.destroy()
        });
      }
    }

    boardFlash(strong) {
      this.flash.setFillStyle(strong ? 0xffffff : 0xfff4c2, 1);
      this.flash.setAlpha(strong ? 0.72 : 0.42);
      this.tweens.add({ targets: this.flash, alpha: 0, duration: strong ? 200 : 150 });
    }

    slam(word, plate, hold) {
      const map = boardMap();
      if (map) this.praise.setPosition(map.board.cx, map.board.cy);
      this.praiseWord.setText(word);
      this.praiseSub.setText(plate);
      this.praiseWord.setFontSize(word.length > 10 ? 52 : 64);
      this.praise.setAlpha(1).setScale(0.24);
      this.sparks.explode(12, this.praise.x, this.praise.y);
      this.tweens.killTweensOf(this.praise);
      this.tweens.add({
        targets: this.praise,
        scale: 1.14,
        duration: 130,
        ease: 'Back.Out',
        onComplete: () => {
          this.tweens.add({
            targets: this.praise,
            scale: 0.98,
            duration: 70,
            onComplete: () => {
              this.tweens.add({ targets: this.praise, alpha: 0, scale: 1.04, delay: hold, duration: 180 });
            }
          });
        }
      });
    }

    arcNearMascot() {
      const mascot = localRect(mascotEl());
      if (!mascot) return;
      const a = mascot.cx + (Math.random() - 0.5) * mascot.w;
      const b = mascot.cy + (Math.random() - 0.5) * mascot.h;
      this.bolt(a, mascot.cy - mascot.h * 0.4, b, mascot.cy + mascot.h * 0.35, false);
    }

    playLineClear(lines, extra) {
      if (!active) return;
      const map = this.syncLayout();
      if (!map) return;
      const rows = lines.rows || [];
      const cols = lines.cols || [];
      const fat = !!(extra && extra.combo >= 3);
      this.heatCells(map, rows, cols);
      rows.forEach((r) => {
        this.beamRow(map, r, fat);
        const left = cellAt(map, r, 0);
        const right = cellAt(map, r, 7);
        if (left && right) this.bolt(left.x, left.cy, right.x + right.w, right.cy, fat);
      });
      cols.forEach((c) => {
        this.beamCol(map, c, fat);
        const top = cellAt(map, 0, c);
        const bot = cellAt(map, 7, c);
        if (top && bot) this.bolt(top.cx, top.y, bot.cx, bot.y + bot.h, fat);
      });
      if (rows.length && cols.length) {
        const hit = cellAt(map, rows[0], cols[0]);
        if (hit) this.blast(hit.cx, hit.cy, true);
      } else {
        const r = rows[0];
        const c = cols[0];
        const mid = r != null ? cellAt(map, r, 3) : cellAt(map, 3, c);
        if (mid) this.blast(mid.cx, mid.cy, false);
      }
      this.boardFlash(false);
      this.suckToCore(map);
      this.cameras.main.shake(180, 0.008);
    }

    playCombo(word, combo) {
      if (!active) return;
      this.syncLayout();
      const plate = combo > 1 ? `COMBO X${combo}` : 'LINE CLEAR';
      this.slam(word, plate, combo >= 4 ? 620 : 480);
    }

    playOverdrive() {
      if (!active) return;
      const map = this.syncLayout();
      if (!map) return;
      this.dark.setAlpha(0.55);
      this.tweens.add({ targets: this.dark, alpha: 0, delay: 120, duration: 160 });
      this.time.delayedCall(180, () => {
        const now = boardMap() || map;
        this.bolt(now.board.x, now.board.cy, now.board.x + now.board.w, now.board.cy, true);
        this.bolt(now.board.cx, now.board.y, now.board.cx, now.board.y + now.board.h, true);
        this.time.delayedCall(40, () => {
          this.bolt(now.board.x, now.board.cy, now.board.x + now.board.w, now.board.cy, true);
          this.bolt(now.board.cx, now.board.y, now.board.cx, now.board.y + now.board.h, true);
        });
        this.beamRow(now, 3, true);
        this.beamCol(now, 3, true);
        this.blast(now.board.cx, now.board.cy, true);
        this.shockwave(now.board.cx, now.board.cy);
        this.boardFlash(true);
        this.cameras.main.shake(280, 0.016);
        this.slam('OVERDRIVE!', 'CORE 100%', 420);
        this.suckToCore(now);
      });
    }
  }

  function boot() {
    const host = hostEl();
    if (!host) return;
    try {
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'gombaFxHost',
        transparent: true,
        backgroundColor: '#00000000',
        width: host.clientWidth || 390,
        height: host.clientHeight || 640,
        antialias: true,
        audio: { noAudio: true },
        scale: { mode: Phaser.Scale.RESIZE, parent: 'gombaFxHost' },
        scene: FxScene
      });
    } catch (err) {
      api.ready = false;
      console.warn('[GombaFX] Phaser init failed', err);
    }
  }

  api.lineClear = (lines, extra) => { if (scene && api.ready) scene.playLineClear(lines || { rows: [], cols: [] }, extra || {}); };
  api.combo = (word, combo) => { if (scene && api.ready) scene.playCombo(word || 'NICE!', combo || 1); };
  api.overdrive = () => { if (scene && api.ready) scene.playOverdrive(); };
  api.corePulse = (pct) => { corePct = pct || 0; if (scene) scene.syncLayout(); };
  api.mascotReact = () => { if (scene && api.ready && active) { scene.arcNearMascot(); scene.halo.setAlpha(0.55); scene.tweens.add({ targets: scene.halo, alpha: 0.18 + corePct * 0.006, duration: 280 }); } };
  api.setActive = (on) => { active = !!on; if (scene) scene.syncLayout(); };
  api.syncCore = (pct) => { corePct = pct || 0; if (scene) scene.syncLayout(); };

  window.addEventListener('resize', () => { if (scene) scene.fitHost(); });
  window.addEventListener('orientationchange', () => setTimeout(() => { if (scene) scene.fitHost(); }, 180));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
