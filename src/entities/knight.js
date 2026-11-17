import { Audio } from '../audio.js';
import { State } from '../state.js';

const RUN = 85;
const ACCEL_GROUND = 900;
const ACCEL_AIR = 650;
const JUMP_V = 250;
const COYOTE = 0.09;
const BUFFER = 0.12;
const MAX_FALL = 320;

/**
 * Attack base class. New mechanics (stomp, dash, magic) plug in by subclassing and
 * registering in Knight.attacks + an input binding in Knight.handleAttacks().
 */
export class Attack {
  constructor(knight) { this.knight = knight; this.scene = knight.scene; this.busy = false; this.cooldown = 0; }
  canStart() { return !this.busy && this.cooldown <= 0; }
  start() {}
  update(dt) { this.cooldown = Math.max(0, this.cooldown - dt); }
  cancel() { this.busy = false; }
}

export class SwordAttack extends Attack {
  constructor(knight) {
    super(knight);
    this.phase = null;
    this.t = 0;
    this.hitThisSwing = new Set();
  }

  start() {
    if (!this.canStart()) return false;
    this.busy = true;
    this.phase = 'windup';
    this.t = 0.06;
    this.hitThisSwing.clear();
    this.knight.setTexture('k_windup');
    return true;
  }

  hitbox() {
    const k = this.knight, b = k.body;
    const w = 20, h = 18;
    const x = k.facing > 0 ? b.right - 2 : b.left - w + 2;
    return new Phaser.Geom.Rectangle(x, b.top - 3, w, h);
  }

  update(dt) {
    super.update(dt);
    if (!this.busy) return;
    this.t -= dt;
    if (this.phase === 'strike') this.applyHits();
    if (this.t > 0) return;
    if (this.phase === 'windup') {
      this.phase = 'strike';
      this.t = 0.14;
      this.knight.setTexture('k_strike');
      Audio.sfx('slash');
      this.spawnSlash();
      this.applyHits();
    } else if (this.phase === 'strike') {
      this.phase = 'recover';
      this.t = 0.05;
    } else {
      this.busy = false;
      this.phase = null;
      this.cooldown = 0.12;
    }
  }

  spawnSlash() {
    const k = this.knight;
    const fx = this.scene.add.image(k.x + k.facing * 14, k.y - 9, 'slash').setDepth(k.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
    fx.setFlipX(k.facing < 0);
    this.scene.tweens.add({ targets: fx, alpha: 0, x: fx.x + k.facing * 4, duration: 160, onComplete: () => fx.destroy() });
  }

  applyHits() {
    const box = this.hitbox();
    for (const e of this.scene.enemies) {
      if (!e.active || this.hitThisSwing.has(e)) continue;
      const eb = e.body;
      if (!eb) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(box, new Phaser.Geom.Rectangle(eb.x, eb.y, eb.width, eb.height))) {
        this.hitThisSwing.add(e);
        e.hit?.(this.knight.facing, 1);
      }
    }
  }
}

export class Knight extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'k_idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.body.setSize(8, 15).setOffset(12, 4);
    this.body.setMaxVelocityY(MAX_FALL);
    this.setDepth(10);
    this.facing = 1;
    this.coyote = 0;
    this.buffer = 0;
    this.invuln = 0;
    this.stun = 0;
    this.wasGround = false;
    this.lastSafe = { x, y };
    this.dead = false;
    this.attacks = { sword: new SwordAttack(this) };

    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = scene.input.keyboard.addKeys({
      left: K.LEFT, right: K.RIGHT, a: K.A, d: K.D,
      up: K.UP, w: K.W, space: K.SPACE, x: K.X, j: K.J, z: K.Z, k: K.K,
    });
    // event-driven presses so even very short taps are never lost
    this.queued = { jump: false, attack: false };
    const kb = scene.input.keyboard;
    ['SPACE', 'UP', 'W', 'X', 'J', 'Z', 'K'].forEach(c => kb.removeAllListeners(`keydown-${c}`));
    ['SPACE', 'UP', 'W'].forEach(c => kb.on(`keydown-${c}`, (e) => { if (!e.repeat) this.queued.jump = true; }));
    ['X', 'J', 'Z', 'K'].forEach(c => kb.on(`keydown-${c}`, (e) => { if (!e.repeat) this.queued.attack = true; }));
  }

  get onGround() { return this.body.blocked.down || this.body.touching.down; }

  readInput() {
    const k = this.keys;
    const left = k.left.isDown || k.a.isDown;
    const right = k.right.isDown || k.d.isDown;
    const jumpDown = k.space.isDown || k.up.isDown || k.w.isDown;
    const jumpPressed = this.queued.jump;
    const attackPressed = this.queued.attack;
    this.queued.jump = false;
    this.queued.attack = false;
    return { dir: (right ? 1 : 0) - (left ? 1 : 0), jumpDown, jumpPressed, attackPressed };
  }

  handleAttacks(inp, dt) {
    if (inp.attackPressed && this.stun <= 0) {
      if (this.attacks.sword.start()) this.scene.events.emit('player-acted');
    }
    for (const a of Object.values(this.attacks)) a.update(dt);
  }

  get attacking() { return Object.values(this.attacks).some(a => a.busy); }

  update(time, deltaMs) {
    if (this.dead) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const inp = this.readInput();
    const ground = this.onGround;

    this.coyote = ground ? COYOTE : this.coyote - dt;
    this.buffer = inp.jumpPressed ? BUFFER : this.buffer - dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.stun = Math.max(0, this.stun - dt);

    if (ground && !this.wasGround && this.body.velocity.y >= 0) Audio.sfx('land');
    this.wasGround = ground;

    if (this.stun <= 0) {
      const target = inp.dir * RUN;
      const acc = (ground ? ACCEL_GROUND : ACCEL_AIR) * dt;
      const vx = this.body.velocity.x;
      this.body.setVelocityX(vx + Phaser.Math.Clamp(target - vx, -acc, acc));
      if (inp.dir !== 0 && !this.attacking) this.facing = inp.dir;

      if (this.buffer > 0 && this.coyote > 0) {
        this.body.setVelocityY(-JUMP_V);
        this.buffer = 0;
        this.coyote = 0;
        Audio.sfx('jump');
        this.scene.events.emit('player-acted');
      }
      if (!inp.jumpDown && this.body.velocity.y < -90) this.body.setVelocityY(this.body.velocity.y * 0.55);
      if (inp.dir !== 0) this.scene.events.emit('player-acted');
    }

    this.handleAttacks(inp, dt);
    this.setFlipX(this.facing < 0);

    if (!this.attacking) {
      if (!ground) this.anims.stop(), this.setTexture(this.body.velocity.y < 0 ? 'k_jump' : 'k_fall');
      else if (Math.abs(this.body.velocity.x) > 12) this.anims.play('k_run', true);
      else this.anims.play('k_idle', true);
    } else {
      this.anims.stop();
    }

    // remember a safe spot to return to after falling into a pit
    if (ground && this.scene.isSolidAt(this.body.left + 1, this.body.bottom + 2) && this.scene.isSolidAt(this.body.right - 1, this.body.bottom + 2)) {
      this.lastSafe.x = this.x; this.lastSafe.y = this.y;
    }

    if (this.invuln > 0) this.setAlpha(Math.floor(this.invuln * 14) % 2 ? 0.35 : 1);
    else this.setAlpha(1);
  }

  hurt(fromX, amount = 1) {
    if (this.invuln > 0 || this.dead) return;
    State.hearts = Math.max(0, State.hearts - amount);
    this.scene.events.emit('hearts');
    Audio.sfx('hurt');
    this.scene.cameras.main.shake(120, 0.006);
    this.scene.flash(this, 80);
    if (State.hearts <= 0) { this.scene.onDeath(); return; }
    this.invuln = 1.3;
    this.stun = 0.22;
    const dir = Math.sign(this.x - fromX) || -this.facing;
    this.body.setVelocity(dir * 120, -150);
    Object.values(this.attacks).forEach(a => a.cancel());
  }

  fellInPit() {
    if (this.dead) return;
    Audio.sfx('fall');
    State.hearts = Math.max(0, State.hearts - 1);
    this.scene.events.emit('hearts');
    if (State.hearts <= 0) { this.scene.onDeath(); return; }
    this.setPosition(this.lastSafe.x, this.lastSafe.y - 2);
    this.body.reset(this.lastSafe.x, this.lastSafe.y - 2);
    this.invuln = 1.3;
  }
}
