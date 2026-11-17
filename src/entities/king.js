import { Audio } from '../audio.js';

const MAX_HP = 7;

/** Golden King Slime: jumps at the knight, lands with shockwaves, summons minis. */
export class KingSlime extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'king_normal');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.body.setSize(28, 13).setOffset(6, 19);
    this.setDepth(9);
    this.isBoss = true;
    this.hp = MAX_HP;
    this.maxHp = MAX_HP;
    this.state = 'sleep';
    this.timer = 0;
    this.landings = 0;
    this.invuln = 0;
    this.dead = false;
  }

  wake() {
    if (this.state !== 'sleep') return;
    this.state = 'idle';
    this.timer = 1.4;
  }

  update(time, deltaMs) {
    if (this.dead || !this.body) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    this.timer -= dt;
    this.invuln = Math.max(0, this.invuln - dt);
    const ground = this.body.blocked.down;
    const k = this.scene.knight;

    switch (this.state) {
      case 'sleep':
        this.setTexture(Math.floor(time / 600) % 2 ? 'king_normal' : 'king_squash');
        break;
      case 'idle':
        this.body.setVelocityX(0);
        this.setTexture(Math.floor(time / 250) % 2 ? 'king_normal' : 'king_squash');
        if (this.timer <= 0) { this.state = 'prep'; this.timer = 0.4; this.setTexture('king_squash'); }
        break;
      case 'prep':
        if (this.timer <= 0) {
          const dx = Phaser.Math.Clamp(k.x - this.x, -120, 120);
          this.body.setVelocity(dx / 0.85, -265);
          this.state = 'air';
          this.setTexture('king_stretch');
        }
        break;
      case 'air':
        if (ground && this.body.velocity.y >= 0) this.land();
        break;
      case 'land':
        if (this.timer <= 0) { this.state = 'idle'; this.timer = this.hp <= 3 ? 0.8 : 1.2; }
        break;
      default: break;
    }
  }

  land() {
    this.state = 'land';
    this.timer = 0.3;
    this.body.setVelocityX(0);
    this.setTexture('king_squash');
    this.landings++;
    Audio.sfx('bossLand');
    this.scene.cameras.main.shake(180, 0.012);
    this.scene.dust(this.x, this.y, 12);
    this.scene.spawnWave(this.x - 12, -1);
    this.scene.spawnWave(this.x + 12, 1);
    if (this.landings % 2 === 0) this.scene.time.delayedCall(250, () => this.summon());
  }

  summon() {
    if (this.dead) return;
    const alive = this.scene.enemies.filter(e => e.active && e.kind === 'mini').length;
    if (alive >= 3) return;
    for (const s of [-1, 1]) {
      const m = this.scene.spawnSlime(this.x + s * 8, this.y - 16, 'purple', { mini: true });
      m.body.setVelocity(s * 70, -160);
      m.dir = s;
    }
    Audio.sfx('split');
  }

  hit(dir) {
    if (this.dead || this.invuln > 0 || this.state === 'sleep') return;
    this.hp -= 1;
    this.invuln = 0.45;
    Audio.sfx('bossHit');
    this.scene.flash(this, 90);
    this.scene.burst(this.x, this.y - 10, 0xffd84a, 6);
    this.scene.events.emit('boss-hp', this.hp, this.maxHp);
    if (this.state === 'idle') this.timer = Math.min(this.timer, 0.3);
    if (this.hp <= 0) this.die();
  }

  die() {
    this.dead = true;
    this.body.enable = false;
    this.scene.cameras.main.shake(400, 0.015);
    this.scene.tweens.add({
      targets: this, scaleX: 1.4, scaleY: 0.4, alpha: 0, duration: 450, ease: 'Quad.easeIn',
      onComplete: () => { this.scene.onBossDefeated(this.x, this.y); this.destroy(); },
    });
    Audio.sfx('pop');
  }
}
