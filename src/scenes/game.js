import { LEVELS } from '../levels.js';
import { TILE, PARALLAX, PILLAR, colliders, getBaked, getRoom } from '../world.js';
import { State } from '../state.js';
import { Audio } from '../audio.js';
import { YSDK } from '../sdk.js';
import { chainCanvas } from '../art.js';
import { Knight } from '../entities/knight.js';
import { Slime } from '../entities/slimes.js';
import { KingSlime } from '../entities/king.js';
import * as Decor from '../entities/decor.js';

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    const L = State.level, index = State.room;
    const level = LEVELS[L];
    const room = getRoom(L, index);
    this.level = level;
    this.room = room;
    this.roomIndex = index;
    const bake = getBaked(L, index);
    this.bake = bake;
    this.solid = bake.solid;
    const { W, H } = bake;
    this.W = W; this.H = H;
    this.leaving = false;
    this.chestOpened = false;
    this.king = null;
    this.chest = null;
    this.enemies = [];
    this.tickers = [];

    // layers: far cave (parallax) -> lit room -> props
    const fk = `far_${L}_${index}`, rk = `room_${L}_${index}`;
    if (!this.textures.exists(fk)) this.textures.addCanvas(fk, bake.far);
    if (!this.textures.exists(rk)) this.textures.addCanvas(rk, bake.canvas);
    this.add.image(0, 0, fk).setOrigin(0, 0).setScrollFactor(PARALLAX).setDepth(-2);
    this.add.image(0, 0, rk).setOrigin(0, 0).setDepth(0);
    Decor.addRays(this, bake);

    for (const [sx, sy] of bake.torches) {
      this.add.sprite(sx - 2, sy - 2, 'torch_t0').setOrigin(0, 0).setDepth(2).play({ key: 'torch', startFrame: Phaser.Math.Between(0, 1) });
      const g = this.add.image(sx, sy, 'glow').setDepth(3).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.22).setScale(1.7);
      this.tweens.add({ targets: g, alpha: { from: 0.16, to: 0.27 }, scale: { from: 1.6, to: 1.8 }, duration: Phaser.Math.Between(180, 320), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.tickers.push(Decor.addFarLife(this, bake));
    this.tickers.push(Decor.addGarlands(this, bake));
    this.tickers.push(Decor.addHangers(this, bake));
    this.tickers.push(Decor.addLanterns(this, bake, chainCanvas));
    this.tickers.push(Decor.addFireflies(this, bake, Math.round(W * H / (bake.open ? 4000 : 7000))));
    this.tickers.push(Decor.addDrips(this, bake));
    this.tickers.push(Decor.addLeaves(this, bake));
    this.tickers.push(Decor.addBats(this, bake));
    Decor.addMushroomGlows(this, bake);
    Decor.addDust(this, bake);

    // physics
    this.physics.world.setBounds(0, 0, W, H + 200);
    this.solids = this.physics.add.staticGroup();
    for (const r of colliders(this.solid)) {
      if (bake.open && r.w === TILE && r.y > 0 && r.y < (bake.rows - 2) * TILE) {
        if (r.x === 0) { r.x = TILE - PILLAR; r.w = PILLAR; } else if (r.x === W - TILE) { r.w = PILLAR; }
      }
      const h = r.oneWay ? 7 : r.h;
      const z = this.add.zone(r.x + r.w / 2, r.y + h / 2, r.w, h);
      this.physics.add.existing(z, true);
      if (r.oneWay) { z.body.checkCollision.down = false; z.body.checkCollision.left = false; z.body.checkCollision.right = false; }
      this.solids.add(z);
    }

    // player
    const start = bake.ents.find(([t]) => t === 'P');
    let sx = start[1] * TILE + 8, sy = (start[2] + 1) * TILE;
    if (State.spawn) { ({ x: sx, y: sy } = State.spawn); State.spawn = null; }
    if (index > 0 || L > 0) this.add.image(start[1] * TILE + 8, (start[2] + 1) * TILE + 1, 'door_closed').setOrigin(0.5, 1).setDepth(4).setTint(0xb0a090);
    this.knight = new Knight(this, sx, sy);
    this.physics.add.collider(this.knight, this.solids);

    // groups
    this.enemyGroup = this.physics.add.group();
    this.physics.add.collider(this.enemyGroup, this.solids);
    this.loot = this.physics.add.group();
    this.physics.add.collider(this.loot, this.solids);
    this.physics.add.overlap(this.knight, this.loot, (k, item) => this.collect(item));
    this.physics.add.overlap(this.knight, this.enemyGroup, (k, e) => {
      if (e.dead || e.state === 'sleep') return;
      k.hurt(e.x, 1, e.guard ? { knock: 170, vy: -130, stun: 0.3 } : {});
    });
    this.waves = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.knight, this.waves, (k, w) => k.hurt(w.x));
    this.fireballs = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.knight, this.fireballs, (k, f) => {
      if (!f.active || k.invuln > 0 || k.dead) return;
      // fireballs knock you clean off the ledge
      k.hurt(f.x, 1, { dir: Math.sign(f.body.velocity.x) || 1, knock: 190, vy: -110, stun: 0.4 });
      f.pop(true);
    });
    this.movers = this.physics.add.group({ allowGravity: false, immovable: true });
    this.physics.add.collider(this.knight, this.movers);
    this.physics.add.collider(this.loot, this.movers);

    this.flags = [];
    this.exitDoor = null;
    for (const [type, tx, ty] of bake.ents) this.spawnEntity(type, tx, ty);

    // camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(this.knight, true, 0.15, 0.15, 0, 6);
    cam.setDeadzone(18, 22);
    cam.fadeIn(350, 12, 8, 6);
    cam.setRoundPixels(true);

    Audio.play(room.music);
    this.registry.set('room', { name: room.name, index, level: L });
    this.game.events.emit('room-enter', room.name, index, L);
    this.events.on('hearts', () => this.game.events.emit('hearts'));
    this.events.on('boss-hp', (hp, max) => this.game.events.emit('boss-hp', hp, max));
    this.events.on('player-acted', () => this.game.events.emit('player-acted'));
    this.game.events.emit('hearts');
    this.game.events.emit('crystals');

    if (!this.scene.isActive('UI')) this.scene.launch('UI');
    else this.scene.bringToTop('UI');
  }

  // ------------------------------------------------------------ helpers
  isSolidAt(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (ty < 0 || ty >= this.bake.rows || tx < 0 || tx >= this.bake.cols) return false;
    return this.solid[ty][tx] > 0;
  }

  entId(type, tx, ty) { return `${State.level}:${this.roomIndex}:${type}:${tx}:${ty}`; }

  spawnEntity(type, tx, ty) {
    const px = tx * TILE + 8, py = (ty + 1) * TILE;
    const id = this.entId(type, tx, ty);
    const colors = { g: 'green', p: 'pink', v: 'purple', f: 'fire' };
    if (colors[type]) {
      if (State.defeated.has(id)) return;
      const face = type === 'f' ? (this.isSolidAt(px - TILE, py - 8) ? 1 : -1) : 1;
      this.spawnSlime(px, py, colors[type], { id, guard: !!this.level.guardSlimes, face });
    } else if (type === 'c' || type === 'h') {
      if (State.collected.has(id)) return;
      const colorList = ['green', 'pink', 'purple'];
      const color = colorList[(tx + ty) % 3];
      const c = this.loot.create(px, py - 8, type === 'c' ? `cr_${color}_c0` : 'heart_full');
      c.body.setAllowGravity(false);
      c.body.setSize(5, 5);
      if (type === 'c') c.play(`cr_${color}`);
      c.lootType = type === 'c' ? 'crystal' : 'heart';
      c.lootId = id;
      c.setDepth(7);
      this.tweens.add({ targets: c, y: c.y - 2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (tx * 97) % 700 });
      if (type === 'c') {
        const g = this.add.image(px, py - 8, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(0.22).setAlpha(0.35).setDepth(6);
        c.once('destroy', () => g.destroy());
      }
    } else if (type === 'F') {
      const active = State.flags.has(id);
      const f = this.add.sprite(px - 2, py + 1, active ? 'flag_up1' : 'flag_down').setOrigin(0.5, 1).setDepth(6);
      if (active) f.play('flag_wave');
      f.flagId = id;
      f.active_ = active;
      this.flags.push(f);
    } else if (type === 'D') {
      this.exitDoor = this.add.image(px, py + 1, 'door_closed').setOrigin(0.5, 1).setDepth(4);
      const g = this.add.image(px, py - 12, 'glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.18).setScale(0.9).setDepth(3);
      this.tweens.add({ targets: g, alpha: 0.32, duration: 900, yoyo: true, repeat: -1 });
    } else if (type === 'K') {
      if (State.bossDefeated) { this.spawnChest(px, py); return; }
      const king = new KingSlime(this, px, py);
      this.king = king;
      this.enemies.push(king);
      this.enemyGroup.add(king);
      king.body.setMaxVelocityY(400);
    } else if (type === 'M' || type === 'E') {
      const cfg = this.room.movers?.[type] ?? { range: 64, speed: 26 };
      const m = this.movers.create(tx * TILE + 16, ty * TILE + 4, 'mover');
      m.body.setAllowGravity(false).setImmovable(true);
      m.body.checkCollision.down = false; m.body.checkCollision.left = false; m.body.checkCollision.right = false;
      m.body.setFriction(1, 1);
      m.axis = type === 'M' ? 'x' : 'y';
      m.home = { x: m.x, y: m.y };
      m.range = cfg.range;
      m.speed = cfg.speed;
      m.dir = 1;
      m.setDepth(6);
    }
  }

  spawnSlime(x, y, color, opts = {}) {
    const s = new Slime(this, x, y, color, opts);
    this.enemies.push(s);
    this.enemyGroup.add(s);
    s.body.setMaxVelocityY(300);
    return s;
  }

  spawnFireball(x, y, dir) {
    this.fireballCount = (this.fireballCount || 0) + 1;
    const f = this.fireballs.create(x, y, 'fireball_f0').play('fireball').setDepth(11);
    f.body.setSize(5, 5).setOffset(2, 2);
    f.setVelocityX(dir * 58);
    f.setFlipX(dir < 0);
    const g = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff7a1a).setScale(0.45).setAlpha(0.6).setDepth(10);
    f.glow = g;
    f.pop = (hitKnight) => {
      if (!f.active) return;
      Audio.sfx('fizz');
      this.burst(f.x, f.y, 0xff8a1e, hitKnight ? 10 : 6);
      g.destroy();
      f.destroy();
    };
    Audio.sfx('fireball');
  }

  markDefeated(e) {
    if (e.id) State.defeated.add(e.id);
    this.enemies = this.enemies.filter(x => x !== e);
  }

  burst(x, y, tint, n = 8) {
    const em = this.add.particles(x, y, 'px2', {
      speed: { min: 40, max: 110 }, angle: { min: 200, max: 340 }, gravityY: 300, lifespan: { min: 300, max: 600 },
      scale: { start: 1, end: 0.5 }, tint, emitting: false,
    }).setDepth(12);
    em.explode(n);
    this.time.delayedCall(800, () => em.destroy());
  }

  spark(x, y) {
    const s = this.add.image(x, y, 'spark').setDepth(14).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: s, scale: { from: 2, to: 0.5 }, alpha: 0, angle: 45, duration: 220, onComplete: () => s.destroy() });
    this.burst(x, y, 0xffffff, 5);
  }

  dust(x, y, n = 8) {
    const em = this.add.particles(x, y - 1, 'px2', {
      speedX: { min: -70, max: 70 }, speedY: { min: -30, max: -5 }, lifespan: 400, tint: 0xc9b29a, alpha: { start: 0.8, end: 0 }, emitting: false,
    }).setDepth(12);
    em.explode(n);
    this.time.delayedCall(600, () => em.destroy());
  }

  flash(obj, ms = 80) {
    obj.flashing = true;
    obj.setTintFill(0xffffff);
    this.time.delayedCall(ms, () => { if (obj.active) { obj.flashing = false; obj.clearTint(); } });
  }

  dropLoot(x, y, color) {
    const c = this.loot.create(x, y, `cr_${color}_c0`);
    c.play(`cr_${color}`);
    c.lootType = 'crystal';
    c.setDepth(7);
    c.body.setSize(5, 5).setBounce(0.45).setDrag(40, 0).setVelocity(Phaser.Math.Between(-30, 30), -140);
    c.pickDelay = 0.25;
    if (State.hearts < State.maxHearts && Math.random() < 0.2) {
      const h = this.loot.create(x, y, 'heart_full');
      h.lootType = 'heart';
      h.setDepth(7);
      h.body.setSize(7, 6).setBounce(0.4).setDrag(40, 0).setVelocity(Phaser.Math.Between(-40, 40), -160);
      h.pickDelay = 0.3;
    }
  }

  collect(item) {
    if (!item.active || (item.pickDelay ?? 0) > 0) return;
    if (item.lootType === 'crystal') {
      State.crystals++;
      if (item.lootId) State.collected.add(item.lootId);
      Audio.sfx('crystal');
      this.game.events.emit('crystals');
      this.sparkle(item.x, item.y);
    } else if (item.lootType === 'heart') {
      if (State.hearts >= State.maxHearts) return;
      State.hearts++;
      if (item.lootId) State.collected.add(item.lootId);
      Audio.sfx('heart');
      this.game.events.emit('hearts');
      this.sparkle(item.x, item.y);
    }
    item.destroy();
  }

  sparkle(x, y) {
    const em = this.add.particles(x, y, 'px', {
      speed: { min: 20, max: 60 }, lifespan: 300, tint: [0xffffff, 0xfff2a0], emitting: false,
    }).setDepth(12);
    em.explode(8);
    this.time.delayedCall(400, () => em.destroy());
  }

  spawnWave(x, dir, y) {
    const w = this.waves.create(x, y, 'wave').setOrigin(0.5, 1).setDepth(9);
    w.body.setSize(6, 5).setOffset(1, 1);
    w.setVelocityX(dir * 95);
    w.setFlipX(dir < 0);
    this.tweens.add({ targets: w, scaleY: { from: 0.6, to: 1.2 }, duration: 120, yoyo: true, repeat: -1 });
    this.time.delayedCall(2600, () => w.destroy());
  }

  spawnChest(x, y) {
    this.chest = this.physics.add.image(x, y - 40, 'chest_closed').setOrigin(0.5, 1).setDepth(7);
    this.chest.body.setSize(14, 8);
    this.physics.add.collider(this.chest, this.solids);
    this.physics.add.overlap(this.knight, this.chest, () => this.openChest());
    const g = this.add.image(x, y - 6, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(6).setAlpha(0.35);
    this.tweens.add({ targets: g, alpha: 0.15, duration: 600, yoyo: true, repeat: -1 });
  }

  openChest() {
    if (this.chestOpened) return;
    this.chestOpened = true;
    this.chest.setTexture('chest_open');
    this.burst(this.chest.x, this.chest.y - 8, 0xffd84a, 16);
    this.finishLevel(1100);
  }

  finishLevel(delay = 600) {
    Audio.stop();
    Audio.sfx('victory');
    YSDK.gameplayStop();
    this.knight.dead = true;
    this.knight.body.setVelocity(0, 0);
    this.time.delayedCall(delay, () => {
      this.scene.pause();
      this.scene.launch('Victory');
    });
  }

  onBossDefeated(x, y) {
    State.bossDefeated = true;
    this.game.events.emit('boss-hp', 0, 1);
    for (let i = 0; i < 6; i++) {
      const c = this.loot.create(x, y - 10, 'cr_gold_c0');
      c.play('cr_gold');
      c.lootType = 'crystal';
      c.setDepth(7);
      c.body.setSize(5, 5).setBounce(0.5).setDrag(30, 0).setVelocity(Phaser.Math.Between(-90, 90), Phaser.Math.Between(-220, -150));
      c.pickDelay = 0.4;
    }
    this.enemies.filter(e => e.active && e.kind === 'mini').forEach(e => e.pop(false));
    this.time.delayedCall(700, () => this.spawnChest(this.W / 2, y));
  }

  onDeath() {
    if (this.knight.dead) return;
    this.knight.dead = true;
    State.deaths++;
    this.knight.body.setVelocity(0, -160);
    this.knight.body.checkCollision.none = true;
    this.game.events.emit('death');
    this.time.delayedCall(900, () => {
      this.cameras.main.fadeOut(400, 12, 8, 6);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        State.hearts = State.maxHearts;
        State.room = State.checkpoint.room;
        State.spawn = State.checkpoint.x !== null ? { x: State.checkpoint.x, y: State.checkpoint.y } : null;
        this.scene.restart();
      });
    });
  }

  exitRoom() {
    if (this.leaving) return;
    this.leaving = true;
    Audio.sfx('door');
    const last = this.roomIndex >= this.level.rooms.length - 1;
    if (last) { this.finishLevel(500); return; }
    this.knight.body.setVelocity(0, 0);
    this.knight.dead = true;
    this.cameras.main.fadeOut(350, 12, 8, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      State.room = this.roomIndex + 1;
      State.spawn = null;
      this.scene.restart();
    });
  }

  // ------------------------------------------------------------ loop
  applyLight(obj) {
    if (!obj.active || obj.flashing) return;
    const [r, g, b] = this.bake.light(obj.x, obj.y - 5);
    const fl = obj.lightFloor ?? 0.66;
    const ch = (v) => Math.round(Phaser.Math.Clamp(fl + (v - 0.5) * 0.55, fl, 1) * 255);
    obj.setTint(Phaser.Display.Color.GetColor(ch(r), ch(g), ch(b)));
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    const k = this.knight;

    for (const m of this.movers.getChildren()) {
      const off = m.axis === 'x' ? m.x - m.home.x : m.home.y - m.y;
      if (off >= m.range) m.dir = -1; else if (off <= 0) m.dir = 1;
      if (m.axis === 'x') m.body.setVelocity(m.dir * m.speed, 0);
      else m.body.setVelocity(0, -m.dir * m.speed);
    }

    k.update(time, delta);
    this.applyLight(k);
    for (const e of this.enemies) {
      if (!e.active) continue;
      e.update(time, delta);
      this.applyLight(e);
      if (e.y > this.H + 40) { e.dead = true; this.markDefeated(e); e.destroy(); }
    }
    this.enemies = this.enemies.filter(e => e.active);
    this.loot.getChildren().forEach(i => { if (i.pickDelay > 0) i.pickDelay -= dt; if (i.y > this.H + 40) i.destroy(); });
    for (const f of this.fireballs.getChildren()) {
      if (!f.active) continue;
      f.glow.setPosition(f.x, f.y);
      if (this.isSolidAt(f.x + Math.sign(f.body.velocity.x) * 3, f.y)) f.pop(false);
    }
    for (const t of this.tickers) t(time, dt);

    if (!k.dead && k.y > this.H + 24) k.fellInPit();

    for (const f of this.flags) {
      if (f.active_ || Math.abs(k.x - f.x) > 20 || Math.abs(k.y - f.y) > 18) continue;
      f.active_ = true;
      f.play('flag_wave');
      State.flags.add(f.flagId);
      State.checkpoint = { room: this.roomIndex, x: f.x + 6, y: f.y };
      State.hearts = State.maxHearts;
      Audio.sfx('checkpoint');
      this.sparkle(f.x + 3, f.y - 18);
      this.game.events.emit('hearts');
      this.game.events.emit('checkpoint');
    }

    if (this.exitDoor && !k.dead && !this.leaving) {
      const d = this.exitDoor;
      const near = Math.abs(k.x - d.x) < 40 && Math.abs(k.y - d.y) < 24;
      if (near && d.texture.key !== 'door_open') { d.setTexture('door_open'); Audio.sfx('door'); }
      if (Math.abs(k.x - d.x) < 5 && Math.abs(k.y - d.y) < 10) this.exitRoom();
    }

    if (this.king && this.king.state === 'sleep' && Math.abs(k.x - this.king.x) < 6 * TILE) {
      this.king.wake();
      this.game.events.emit('boss-start', this.king.hp, this.king.maxHp);
    }
  }
}
