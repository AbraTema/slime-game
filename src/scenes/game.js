import { ROOMS, TILE, ROWS, bakeRoom, colliders } from '../rooms.js';
import { State } from '../state.js';
import { Audio } from '../audio.js';
import { YSDK } from '../sdk.js';
import { Knight } from '../entities/knight.js';
import { Slime } from '../entities/slimes.js';
import { KingSlime } from '../entities/king.js';

const baked = new Map();
export function getBaked(i) {
  if (!baked.has(i)) baked.set(i, bakeRoom(ROOMS[i], i));
  return baked.get(i);
}

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    const index = State.room;
    const room = ROOMS[index];
    this.room = room;
    this.roomIndex = index;
    const bake = getBaked(index);
    this.bake = bake;
    this.solid = bake.solid;
    const W = room.w * TILE, H = ROWS * TILE;
    this.W = W;
    this.leaving = false;
    this.enemies = [];

    // background
    const key = `room_${index}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, bake.canvas);
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    // torch flames + flicker glow
    for (const [sx, sy] of bake.torches) {
      this.add.sprite(sx - 2, sy - 2, 'torch_t0').setOrigin(0, 0).setDepth(2).play({ key: 'torch', startFrame: Phaser.Math.Between(0, 1) });
      const g = this.add.image(sx, sy, 'glow').setDepth(3).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.22).setScale(1.7);
      this.tweens.add({ targets: g, alpha: { from: 0.16, to: 0.27 }, scale: { from: 1.6, to: 1.8 }, duration: Phaser.Math.Between(180, 320), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // physics world
    this.physics.world.setBounds(0, 0, W, H + 200);
    this.solids = this.physics.add.staticGroup();
    for (const r of colliders(this.solid)) {
      const z = this.add.zone(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h);
      this.physics.add.existing(z, true);
      if (r.oneWay) { z.body.checkCollision.down = false; z.body.checkCollision.left = false; z.body.checkCollision.right = false; }
      this.solids.add(z);
    }

    // doors: decorative entrance on the left, exit on the right (not in boss room)
    if (index > 0) this.add.image(TILE / 2 + 1, 7 * TILE + 1, 'door_closed').setOrigin(0.5, 1).setDepth(4).setTint(0xb0a090);
    if (!room.boss) {
      this.exitDoor = this.add.image((room.w - 1) * TILE + 8, 7 * TILE + 1, 'door_closed').setOrigin(0.5, 1).setDepth(4);
    }

    // player
    let sx, sy;
    if (State.spawn) { ({ x: sx, y: sy } = State.spawn); State.spawn = null; } else { sx = room.start[0] * TILE + 8; sy = (room.start[1] + 1) * TILE; }
    this.knight = new Knight(this, sx, sy);
    this.physics.add.collider(this.knight, this.solids);

    // groups
    this.enemyGroup = this.physics.add.group({ runChildUpdate: false });
    this.physics.add.collider(this.enemyGroup, this.solids);
    this.loot = this.physics.add.group();
    this.physics.add.collider(this.loot, this.solids);
    this.physics.add.overlap(this.knight, this.loot, (k, item) => this.collect(item));
    this.physics.add.overlap(this.knight, this.enemyGroup, (k, e) => { if (!e.dead && !(e.state === 'sleep')) k.hurt(e.x); });
    this.waves = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.knight, this.waves, (k, w) => k.hurt(w.x));

    this.flags = [];
    for (const [type, tx, ty] of room.ents) this.spawnEntity(type, tx, ty);

    // camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(this.knight, true, 0.15, 0.15, 0, 8);
    cam.setDeadzone(24, 40);
    cam.fadeIn(350, 12, 8, 6);
    cam.setRoundPixels(true);

    // floating dust motes
    this.add.particles(0, 0, 'px', {
      x: { min: 0, max: W }, y: { min: 20, max: 110 }, lifespan: 5000, speedY: { min: -4, max: -1 }, speedX: { min: -3, max: 3 },
      alpha: { start: 0, end: 0, ease: (t) => Math.sin(t * Math.PI) * 0.7 }, tint: 0xffd9a0, frequency: 260, quantity: 1,
    }).setDepth(5);

    Audio.play(room.music);
    this.registry.set('room', { name: room.name, index });
    this.game.events.emit('room-enter', room.name, index);
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
    if (ty < 0 || ty >= ROWS || tx < 0 || tx >= this.room.w) return false;
    return this.solid[ty][tx] > 0;
  }

  entId(type, tx, ty) { return `${this.roomIndex}:${type}:${tx}:${ty}`; }

  spawnEntity(type, tx, ty) {
    const px = tx * TILE + 8, py = (ty + 1) * TILE;
    const id = this.entId(type, tx, ty);
    const colors = { g: 'green', p: 'pink', v: 'purple' };
    if (colors[type]) {
      if (State.defeated.has(id)) return;
      this.spawnSlime(px, py, colors[type], { id });
    } else if (type === 'c') {
      if (State.collected.has(id)) return;
      const colorList = ['green', 'pink', 'purple'];
      const color = colorList[(tx + ty) % 3];
      const c = this.loot.create(px, py - 8, `cr_${color}_c0`);
      c.body.setAllowGravity(false);
      c.body.setSize(5, 5);
      c.play(`cr_${color}`);
      c.lootType = 'crystal';
      c.lootId = id;
      c.setDepth(7);
      this.tweens.add({ targets: c, y: c.y - 2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (tx * 97) % 700 });
    } else if (type === 'F') {
      const active = State.flags.has(id);
      const f = this.add.sprite(px - 2, py + 1, active ? 'flag_up1' : 'flag_down').setOrigin(0.5, 1).setDepth(6);
      if (active) f.play('flag_wave');
      f.flagId = id;
      f.active_ = active;
      this.flags.push(f);
    } else if (type === 'K') {
      if (State.bossDefeated) { this.spawnChest(px, py); return; }
      const king = new KingSlime(this, px, py);
      this.king = king;
      this.enemies.push(king);
      this.enemyGroup.add(king);
      king.body.setMaxVelocityY(400);
    }
  }

  spawnSlime(x, y, color, opts = {}) {
    const s = new Slime(this, x, y, color, opts);
    this.enemies.push(s);
    this.enemyGroup.add(s);
    s.body.setMaxVelocityY(300);
    return s;
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

  spawnWave(x, dir) {
    const w = this.waves.create(x, 7 * TILE, 'wave').setOrigin(0.5, 1).setDepth(9);
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
    this.chestGlow = g;
  }

  openChest() {
    if (this.chestOpened) return;
    this.chestOpened = true;
    this.chest.setTexture('chest_open');
    this.burst(this.chest.x, this.chest.y - 8, 0xffd84a, 16);
    Audio.stop();
    Audio.sfx('victory');
    YSDK.gameplayStop();
    this.time.delayedCall(1100, () => {
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
    // remaining minis pop
    this.enemies.filter(e => e.active && e.kind === 'mini').forEach(e => e.pop(false));
    this.time.delayedCall(700, () => this.spawnChest(this.W / 2, 7 * TILE));
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
    this.knight.body.setVelocity(0, 0);
    this.knight.dead = true;
    this.cameras.main.fadeOut(350, 12, 8, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      State.room = Math.min(ROOMS.length - 1, this.roomIndex + 1);
      State.spawn = null;
      this.scene.restart();
    });
  }

  // ------------------------------------------------------------ loop
  applyLight(obj) {
    if (!obj.active || obj.flashing) return;
    const [r, g, b] = this.bake.light(obj.x, obj.y - 6);
    const fl = obj.lightFloor ?? 0.62; // acid slimes glow, so they darken less
    const ch = (v) => Math.round(Phaser.Math.Clamp(fl + (v - 0.5) * 0.55, fl, 1) * 255);
    obj.setTint(Phaser.Display.Color.GetColor(ch(r), ch(g), ch(b)));
  }

  update(time, delta) {
    const dt = delta / 1000;
    const k = this.knight;
    k.update(time, delta);
    this.applyLight(k);
    for (const e of this.enemies) {
      if (!e.active) continue;
      e.update(time, delta);
      this.applyLight(e);
      if (e.y > ROWS * TILE + 40) { e.dead = true; this.markDefeated(e); e.destroy(); }
    }
    this.enemies = this.enemies.filter(e => e.active);
    this.loot.getChildren().forEach(i => { if (i.pickDelay > 0) i.pickDelay -= dt; if (i.y > ROWS * TILE + 40) i.destroy(); });

    // pits
    if (!k.dead && k.y > ROWS * TILE + 24) k.fellInPit();

    // checkpoints
    for (const f of this.flags) {
      if (f.active_ || Math.abs(k.x - f.x) > 14 || Math.abs(k.y - f.y) > 20) continue;
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

    // exit door
    if (this.exitDoor && !k.dead) {
      const near = k.x > this.exitDoor.x - 40;
      if (near && this.exitDoor.texture.key !== 'door_open') { this.exitDoor.setTexture('door_open'); Audio.sfx('door'); }
      if (k.x > this.exitDoor.x - 6) this.exitRoom();
    }

    // boss wake-up
    if (this.king && this.king.state === 'sleep' && k.x > 7 * TILE) {
      this.king.wake();
      this.game.events.emit('boss-start', this.king.hp, this.king.maxHp);
    }
  }
}

