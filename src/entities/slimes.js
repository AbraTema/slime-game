import { Audio } from '../audio.js';
import { SLIME_COLORS } from '../art.js';

/**
 * Slime behaviours:
 *  green  - crawls back and forth, turns at walls and ledges
 *  pink   - waits, then hops toward the knight
 *  purple - crawls slowly; when hit, splits into two minis
 *  mini   - small fast crawler
 */
export class Slime extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, color, { mini = false, id = null, guard = false, face = 1 } = {}) {
    const base = mini ? `sl_${color}_mini` : `sl_${color}`;
    super(scene, x, y, `${base}_normal`);
    this.base = base;
    this.color = color;
    this.mini = mini;
    this.kind = mini ? 'mini' : color;
    this.id = id;
    this.guard = guard && !mini;   // level 2: can only be hit while the knight stands on ground
    this.face = face;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    if (mini) this.body.setSize(6, 4).setOffset(2, 4);
    else this.body.setSize(10, 7).setOffset(2, 5);
    this.setDepth(8);
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.hp = 1;
    this.dead = false;
    this.timer = 0.5 + Math.random() * 1.2;
    this.state = 'move';
    this.speed = { green: 16, purple: 11, mini: 26, pink: 0, fire: 0 }[this.kind];
    this.animT = Math.random();
    this.lightFloor = 0.9;
    // soft acid glow under the jelly
    this.glow = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(SLIME_COLORS[color].glow).setAlpha(mini ? 0.22 : 0.3).setScale(mini ? 0.3 : 0.45).setDepth(7);
    this.once('destroy', () => this.glow.destroy());
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (this.glow) this.glow.setPosition(this.x, this.y - (this.mini ? 3 : 5));
  }

  look(name) { this.setTexture(`${this.base}_${name}`); }

  update(time, deltaMs) {
    if (this.dead || !this.body) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const ground = this.body.blocked.down;
    const k = this.scene.knight;

    if (this.kind === 'pink') return this.updatePink(dt, ground, k);
    if (this.kind === 'fire') return this.updateFire(dt, k);

    // crawling: wobble frames and edge/wall turning
    this.animT += dt * (this.kind === 'mini' ? 9 : 6);
    const cycle = ['normal', 'squash', 'normal', 'stretch'];
    if (ground) this.look(cycle[Math.floor(this.animT) % 4]);
    if (ground) {
      const aheadX = this.x + this.dir * (this.body.width / 2 + 2);
      const noFloor = !this.scene.isSolidAt(aheadX, this.body.bottom + 2);
      const wall = this.dir < 0 ? this.body.blocked.left : this.body.blocked.right;
      let speed = this.speed;
      // guards rush at a knight who comes close on their level
      if (this.guard && k && !k.dead && Math.abs(k.x - this.x) < 44 && Math.abs(k.y - this.y) < 14) {
        const want = Math.sign(k.x - this.x) || this.dir;
        const aheadOk = this.scene.isSolidAt(this.x + want * (this.body.width / 2 + 2), this.body.bottom + 2);
        if (aheadOk) { this.dir = want; speed = 34; }
      }
      if (noFloor || wall) this.dir *= -1;
      // move in little pulses so it reads as "squishing along"
      const pulse = (Math.floor(this.animT) % 4) === 1 ? 0.3 : 1;
      this.body.setVelocityX(this.dir * speed * pulse);
    }
  }

  updatePink(dt, ground, k) {
    this.timer -= dt;
    if (!ground) { this.look('stretch'); return; }
    if (this.state === 'air') {
      this.state = 'land';
      this.timer = 0.12;
      this.body.setVelocityX(0);
      this.look('squash');
      return;
    }
    if (this.state === 'land' && this.timer <= 0) { this.state = 'idle'; this.timer = 0.9 + Math.random() * 0.9; }
    if (this.state === 'idle' || this.state === 'move') {
      this.body.setVelocityX(0);
      this.look(Math.floor(this.scene.time.now / 400) % 2 ? 'normal' : 'squash');
      if (this.timer <= 0) { this.state = 'prep'; this.timer = 0.2; this.look('squash'); }
    }
    if (this.state === 'prep' && this.timer <= 0) {
      const dx = k.x - this.x, dy = k.y - this.y;
      const near = Math.abs(dx) < 110 && Math.abs(dy) < 56;
      this.dir = near ? Math.sign(dx) || 1 : (Math.random() < 0.5 ? -1 : 1);
      const ahead = this.scene.isSolidAt(this.x + this.dir * 20, this.body.bottom + 2);
      const vx = near || ahead ? this.dir * (near ? 55 : 25) : 0;
      this.body.setVelocity(vx, near ? -175 : -120);
      this.state = 'air';
      this.look('stretch');
    }
  }

  updateFire(dt, k) {
    this.body.setVelocityX(0);
    this.setFlipX(this.face < 0);
    const inRange = k && !k.dead && Math.abs(k.y - this.y) < 80 && Math.abs(k.x - this.x) < 220;
    if (this.state === 'move' || this.state === 'idle') {
      this.state = 'idle';
      this.look(Math.floor(this.scene.time.now / 300) % 2 ? 'normal' : 'squash');
      if (this.timer <= 0 && inRange) { this.state = 'charge'; this.timer = 0.6; Audio.sfx('charge'); }
      this.timer -= dt;
      this.glow.setAlpha(0.3);
    } else if (this.state === 'charge') {
      this.timer -= dt;
      this.look(Math.floor(this.timer * 20) % 2 ? 'stretch' : 'squash');
      this.glow.setAlpha(0.3 + (0.6 - this.timer) * 0.9);
      if (this.timer <= 0) {
        this.scene.spawnFireball(this.x + this.face * 7, this.y - 5, this.face);
        this.look('squash');
        this.state = 'idle';
        this.timer = 2.0 + Math.random() * 0.8;
      }
    }
  }

  hit(dir, dmg = 1, opts = {}) {
    if (this.dead) return;
    if (this.guard && opts.airborne) {
      // deflected! the slime bounces the knight off
      Audio.sfx('clink');
      this.scene.spark(this.x - dir * 4, this.y - 5);
      this.look('stretch');
      opts.knight?.hurt(this.x, 1, { dir: -dir, knock: 170, vy: -120, stun: 0.35 });
      return;
    }
    this.hp -= 1;
    if (this.hp > 0) return;
    if (this.kind === 'purple') return this.split(dir);
    this.pop(true);
  }

  split(dir) {
    this.dead = true;
    Audio.sfx('split');
    this.scene.burst(this.x, this.y - 4, SLIME_COLORS.purple.glow, 6);
    for (const s of [-1, 1]) {
      const m = this.scene.spawnSlime(this.x + s * 3, this.y - 2, 'purple', { mini: true });
      m.body.setVelocity(s * 60 + dir * 20, -130);
      m.dir = s;
    }
    this.scene.markDefeated(this);
    this.destroy();
  }

  pop(drop) {
    this.dead = true;
    Audio.sfx('pop');
    this.scene.burst(this.x, this.y - 3, SLIME_COLORS[this.color].glow, this.mini ? 6 : 10);
    if (drop) this.scene.dropLoot(this.x, this.y - 6, this.color);
    this.scene.markDefeated(this);
    this.destroy();
  }
}
