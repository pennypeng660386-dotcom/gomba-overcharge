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

      /* 3D rectangular glowing orange/gold shards (concept art) */
      const shard = this.add.graphics();
      shard.fillStyle(0xff3a00, 1);
      shard.fillRoundedRect(0, 4, 18, 12, 2);
      shard.fillStyle(0xff8500, 1);
      shard.fillRoundedRect(1, 3, 16, 10, 2);
      shard.fillStyle(0xffe08a, 1);
      shard.fillRoundedRect(2, 3, 14, 4, 1);
      shard.fillStyle(0xfff8d0, 0.95);
      shard.fillRect(3, 4, 10, 1.5);
      shard.fillStyle(0xb82000, 0.9);
      shard.fillRect(1, 12, 16, 3);
      shard.generateTexture('fx-shard', 18, 16);
      shard.destroy();

      const shard2 = this.add.graphics();
      shard2.fillStyle(0xff5200, 1);
      shard2.fillRoundedRect(0, 2, 12, 20, 2);
      shard2.fillStyle(0xffc43d, 1);
      shard2.fillRoundedRect(1, 2, 10, 7, 1);
      shard2.fillStyle(0xfff6c8, 0.9);
      shard2.fillRect(2, 3, 7, 2);
      shard2.fillStyle(0xc43000, 1);
      shard2.fillRect(1, 18, 10, 3);
      shard2.generateTexture('fx-shard-tall', 12, 22);
      shard2.destroy();

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
      beamH.fillStyle(0xff4b00, 0.22);
      beamH.fillRect(0, 0, 256, 40);
      beamH.fillStyle(0xff9d00, 0.65);
      beamH.fillRect(0, 8, 256, 24);
      beamH.fillStyle(0xfff4c2, 1);
      beamH.fillRect(0, 14, 256, 12);
      beamH.fillStyle(0xffffff, 1);
      beamH.fillRect(0, 17, 256, 6);
      beamH.generateTexture('fx-beam-h', 256, 40);
      beamH.destroy();

      /* Intense vertical white-hot energy beam */
      const beamV = this.add.graphics();
      beamV.fillStyle(0xff3b00, 0.28);
      beamV.fillRect(0, 0, 48, 256);
      beamV.fillStyle(0xff7a00, 0.7);
      beamV.fillRect(8, 0, 32, 256);
      beamV.fillStyle(0xffe08a, 1);
      beamV.fillRect(14, 0, 20, 256);
      beamV.fillStyle(0xffffff, 1);
      beamV.fillRect(18, 0, 12, 256);
      beamV.fillStyle(0xffffff, 1);
      beamV.fillRect(21, 0, 6, 256);
      beamV.generateTexture('fx-beam-v', 48, 256);
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
        speed: { min: 140, max: 460 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 280, max: 720 },
        scale: { start: 1.15, end: 0.06 },
        alpha: { start: 1, end: 0 },
        rotate: { min: 0, max: 360 },
        gravityY: 60,
        blendMode: 'ADD',
        emitting: false,
        maxAliveParticles: 100
      }).setDepth(12);
      this.shards = this.add.particles(0, 0, 'fx-shard', {
        speed: { min: 110, max: 420 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 420, max: 900 },
        scale: { start: 1.15, end: 0.2 },
        alpha: { start: 1, end: 0 },
        rotate: { min: -220, max: 260 },
        gravityY: 260,
        emitting: false,
        maxAliveParticles: 80
      }).setDepth(12);
      this.shardsTall = this.add.particles(0, 0, 'fx-shard-tall', {
        speed: { min: 90, max: 360 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 400, max: 860 },
        scale: { start: 1.05, end: 0.18 },
        alpha: { start: 1, end: 0 },
        rotate: { min: -180, max: 220 },
        gravityY: 240,
        blendMode: 'ADD',
        emitting: false,
        maxAliveParticles: 40
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
      this.praiseBar = this.add.rectangle(0, 10, 340, 8, 0xffffff, 1).setBlendMode(Phaser.BlendModes.ADD);
      this.praiseWord = this.add.text(0, -22, 'AMAZING!', {
        fontFamily: 'Impact, Arial Black, Arial',
        fontSize: '74px',
        fontStyle: 'italic bold',
        color: '#ffc020',
        stroke: '#160600',
        strokeThickness: 16,
        shadow: { offsetX: 0, offsetY: 4, color: '#ff5a00', blur: 28, stroke: true, fill: true }
      }).setOrigin(0.5).setAngle(-2);
      this.praisePlate = this.add.rectangle(0, 46, 188, 36, 0x0a0500, 0.96).setStrokeStyle(3.5, 0xff9a28);
      this.praiseSub = this.add.text(0, 46, 'COMBO X4', {
        fontFamily: 'Impact, Arial Black, Arial',
        fontSize: '19px',
        color: '#ffe066',
        stroke: '#2a1000',
        strokeThickness: 2
      }).setOrigin(0.5);
      this.praise.add([this.praiseBar, this.praisePlate, this.praiseWord, this.praiseSub]);
      try {
        this.praiseWord.enableFilters();
        this.praiseWord.filters.external.addGlow(0xff6a00, 8, 0, 1.35, false, 12, 16);
        this.praiseWord.filters.external.addGlow(0xffb000, 3, 0, 0.9, false, 6, 8);
      } catch (_) {}
      try {
        this.praisePlate.enableFilters();
        this.praisePlate.filters.external.addGlow(0xff8a00, 4, 0, 1.1, false, 8, 10);
      } catch (_) {}
    }

    makeAmbience() {
      /* V0.9.22 Phase A — no persistent board particles/arcs; FX only on clear/combo */
      this.edge.setAlpha(0);
      this.haze.setAlpha(0);
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
      /* V0.9.22 — quieter mascot halo; react/combo still bumps via mascotReact */
      this.halo.setAlpha(active ? 0.06 + corePct * 0.002 : 0);
      this.edge.setVisible(active);
      this.haze.setVisible(active);
      this.praise.setVisible(active);
      /* V0.9.22 — idle embers stay off (R1 clarity) */
      this.idleEmbers.stop();
      this.edge.setAlpha(0);
      this.haze.setAlpha(0);
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
        .setDisplaySize(map.board.w * 0.98, fat ? 28 : 16)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.08, 1)
        .setDepth(10);
      this.tweens.add({ targets: img, scaleX: 1, duration: 90, ease: 'Cubic.Out' });
      this.tweens.add({ targets: img, alpha: 0, delay: 400, duration: 240, onComplete: () => img.destroy() });
      this.sparks.explode(fat ? 12 : 8, a.cx, a.cy);
      this.sparks.explode(fat ? 12 : 8, b.cx, b.cy);
    }

    beamCol(map, c, fat) {
      const a = cellAt(map, 0, c);
      const b = cellAt(map, 7, c);
      if (!a || !b) return;
      const img = this.add.image(a.cx, (a.cy + b.cy) / 2, 'fx-beam-v')
        .setDisplaySize(fat ? 34 : 18, map.board.h * 0.98)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(1, 0.08)
        .setDepth(10);
      this.tweens.add({ targets: img, scaleY: 1, duration: 90, ease: 'Cubic.Out' });
      this.tweens.add({ targets: img, alpha: 0, delay: 420, duration: 260, onComplete: () => img.destroy() });
      this.sparks.explode(fat ? 14 : 8, a.cx, a.cy);
      this.sparks.explode(fat ? 14 : 8, b.cx, b.cy);
    }

    bolt(x0, y0, x1, y1, fat) {
      const g = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(14);
      const segs = fat ? 14 : 11;
      const pts = [];
      const vertical = Math.abs(x1 - x0) < Math.abs(y1 - y0);
      const jag = fat ? 42 : 22;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const edge = (i === 0 || i === segs) ? 0 : 1;
        pts.push({
          x: x0 + (x1 - x0) * t + (vertical ? (Math.random() - 0.5) * jag * edge : (Math.random() - 0.5) * jag * 0.25 * edge),
          y: y0 + (y1 - y0) * t + (vertical ? (Math.random() - 0.5) * jag * 0.25 * edge : (Math.random() - 0.5) * jag * edge)
        });
      }
      g.lineStyle(fat ? 11 : 6, 0xff4b00, 0.4);
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach((p) => g.lineTo(p.x, p.y)); g.strokePath();
      g.lineStyle(fat ? 6 : 3.5, 0xff9a20, 0.8);
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach((p) => g.lineTo(p.x, p.y)); g.strokePath();
      g.lineStyle(fat ? 4 : 2.5, 0xffffff, 1);
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y); pts.slice(1).forEach((p) => g.lineTo(p.x, p.y)); g.strokePath();
      this.tweens.add({ targets: g, alpha: 0, delay: 160, duration: 280, onComplete: () => g.destroy() });
    }

    blast(x, y, dense) {
      const cross = this.add.image(x, y, 'fx-cross').setBlendMode(Phaser.BlendModes.ADD).setScale(0.22).setDepth(13);
      this.tweens.add({
        targets: cross,
        scale: dense ? 3.1 : 2.0,
        alpha: 0,
        duration: dense ? 680 : 480,
        ease: 'Cubic.Out',
        onComplete: () => cross.destroy()
      });
      this.sparks.explode(dense ? 110 : 48, x, y);
      this.shards.explode(dense ? 64 : 30, x, y);
      if (this.shardsTall) this.shardsTall.explode(dense ? 36 : 16, x, y);
      this.embers.explode(dense ? 40 : 16, x, y);
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
      /* V0.9.21 — softer flash so DOM praise stays readable (not muddy white wash) */
      this.flash.setFillStyle(strong ? 0xfff0c0 : 0xffe8a0, 1);
      this.flash.setAlpha(strong ? 0.38 : 0.22);
      this.tweens.add({ targets: this.flash, alpha: 0, duration: strong ? 220 : 160 });
    }

    slam(word, plate, hold) {
      const map = boardMap();
      const cx = map ? map.board.cx : this.praise.x;
      const cy = map ? map.board.cy : this.praise.y;
      if (map) this.praise.setPosition(cx, cy);
      this.praiseWord.setText(word);
      this.praiseSub.setText(plate);
      this.praiseWord.setFontSize(word.length > 10 ? 58 : 76);
      this.praiseWord.setColor(word.length > 8 ? '#ffb020' : '#ffc020');
      const plateW = Math.max(170, 24 + plate.length * 12);
      this.praisePlate.setSize(plateW, 36);
      /* DOM #praise owns concept gradient AMAZING! + orange pill; Phaser = energy FX */
      /* DOM #praise owns readable badge; Phaser praise stays hidden to avoid muddy double text */
      this.praise.setAlpha(0).setScale(0.16);
      /* V0.9.20 — particles inside board; soft inset so bolts aren't hard-sheared at L/R */
      if (map) {
        const inset = Math.min(34, map.board.w * 0.09);
        const left = map.board.x + inset;
        const right = map.board.x + map.board.w - inset;
        const top = map.board.y + inset;
        const bot = map.board.y + map.board.h - inset;
        /* keep beams away from outer chrome — skin owns side lightning */
        this.beamCol(map, 3, false);
        this.beamRow(map, 3, false);
        const core = this.add.image(cx, cy, 'fx-beam-v')
          .setDisplaySize(40, map.board.h * 0.82)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0.78)
          .setDepth(11);
        this.tweens.add({ targets: core, alpha: 0, delay: 180, duration: 260, onComplete: () => core.destroy() });
        const crossH = this.add.image(cx, cy, 'fx-beam-h')
          .setDisplaySize(map.board.w * 0.78, 24)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0.72)
          .setDepth(11);
        this.tweens.add({ targets: crossH, alpha: 0, delay: 160, duration: 240, onComplete: () => crossH.destroy() });
        /* short bolts stay inside soft inset — no rectangular shear at board rim */
        this.bolt(cx, cy, left, cy + (Math.random() - 0.5) * 12, false);
        this.bolt(cx, cy, right, cy + (Math.random() - 0.5) * 12, false);
        this.bolt(cx, cy, cx + (Math.random() - 0.5) * 20, top, false);
        this.bolt(cx, cy, cx + (Math.random() - 0.5) * 20, bot, false);
        this.blast(cx, cy, false);
        this.sparks.explode(32, cx, cy);
        this.shards.explode(14, cx, cy);
        this.embers.explode(12, cx, cy);
        this.boardFlash(false);
        this.cameras.main.shake(120, 0.007);
      } else {
        this.sparks.explode(24, cx, cy);
      }
      this.tweens.killTweensOf(this.praise);
      this.tweens.add({
        targets: this.praise,
        scale: 1.22,
        duration: 140,
        ease: 'Back.Out',
        onComplete: () => {
          this.tweens.add({
            targets: this.praise,
            scale: 0.96,
            duration: 70,
            onComplete: () => {
              this.tweens.add({ targets: this.praise, alpha: 0, scale: 1.08, delay: hold, duration: 200 });
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
        const left = cellAt(map, r, 1);
        const right = cellAt(map, r, 6);
        if (left && right) this.bolt(left.x, left.cy, right.x + right.w, right.cy, fat);
      });
      cols.forEach((c) => {
        this.beamCol(map, c, fat);
        const top = cellAt(map, 1, c);
        const bot = cellAt(map, 6, c);
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
      this.slam(word, plate, combo >= 4 ? 420 : combo >= 2 ? 320 : 260);
      if (combo >= 3) this.arcNearMascot();
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
