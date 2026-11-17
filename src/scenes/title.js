import { Audio } from '../audio.js';
import { YSDK } from '../sdk.js';
import { addText } from '../font.js';
import { getBaked, PARALLAX } from '../world.js';

export function pixelButton(scene, x, y, label, onClick, { color = 0xffc23a, hover = 0xffd84a, pulse = true } = {}) {
  const c = scene.add.container(x, y);
  const t = addText(scene, 0, 0, label, { scale: 1, color: '#2a1d17', outline: null });
  const w = t.width + 12, h = 13;
  const shadow = scene.add.rectangle(0, 2, w, h, 0x0c0806);
  const body = scene.add.rectangle(0, 0, w, h, color).setStrokeStyle(1, 0x3a2010);
  const shine = scene.add.rectangle(0, -h / 2 + 2, w - 4, 1, 0xfff2b0);
  c.add([shadow, body, shine, t]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerover', () => body.setFillStyle(hover));
  c.on('pointerout', () => body.setFillStyle(color));
  c.on('pointerdown', () => { c.y += 1; });
  c.on('pointerup', () => { c.y -= 1; onClick(); });
  if (pulse) scene.tweens.add({ targets: c, scale: { from: 1, to: 1.06 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return c;
}

/** Shared animated backdrop: a lit slice of the first room with parallax drift. */
export function backdrop(scene, level = 0, room = 0, focusX = 0, focusY = null) {
  const W = scene.scale.width, H = scene.scale.height;
  const bake = getBaked(level, room);
  const fk = `far_${level}_${room}`, rk = `room_${level}_${room}`;
  if (!scene.textures.exists(fk)) scene.textures.addCanvas(fk, bake.far);
  if (!scene.textures.exists(rk)) scene.textures.addCanvas(rk, bake.canvas);
  const fy = focusY ?? bake.H - H;
  const far = scene.add.image(-focusX * PARALLAX, -fy * PARALLAX, fk).setOrigin(0, 0);
  const near = scene.add.image(-focusX, -fy, rk).setOrigin(0, 0);
  for (const [sx, sy] of bake.torches) {
    const x = sx - focusX, y = sy - fy;
    if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
    scene.add.sprite(x - 2, y - 2, 'torch_t0').setOrigin(0, 0).play('torch');
    const g = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.22).setScale(1.7);
    scene.tweens.add({ targets: g, alpha: { from: 0.16, to: 0.27 }, duration: 260, yoyo: true, repeat: -1 });
  }
  // fireflies
  for (let i = 0; i < 14; i++) {
    const f = scene.add.image(Math.random() * W, 10 + Math.random() * (H - 30), 'px').setTint([0xd6ff6a, 0xfff2a0, 0x9dffd2][i % 3]);
    scene.tweens.add({ targets: f, x: f.x + Phaser.Math.Between(-20, 20), y: f.y + Phaser.Math.Between(-10, 10), alpha: { from: 0.2, to: 1 }, duration: Phaser.Math.Between(1200, 2400), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  scene.tweens.add({ targets: far, x: far.x - 6, duration: 6000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return { far, near, bake };
}

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    backdrop(this, 0, 0, 0);
    this.add.rectangle(0, 0, W, H, 0x0c0806, 0.35).setOrigin(0);

    // characters
    const k = this.add.image(W / 2 - 42, H - 32, 'k_strike').setOrigin(0.5, 1).setTint(0xfff0dd);
    this.tweens.add({ targets: k, y: k.y - 1, duration: 500, yoyo: true, repeat: -1 });
    [['green', 0], ['pink', 14], ['purple', 28], ['fire', 42]].forEach(([c, dx], i) => {
      const s = this.add.image(W / 2 + dx - 8, H - 32, `sl_${c}_normal`).setOrigin(0.5, 1);
      this.time.addEvent({ delay: 500, loop: true, startAt: i * 120, callback: () => {
        s.setTexture(`sl_${c}_squash`);
        this.time.delayedCall(110, () => s.setTexture(`sl_${c}_stretch`));
        this.tweens.add({ targets: s, y: s.y - 7, duration: 160, yoyo: true, delay: 110, onComplete: () => s.setTexture(`sl_${c}_normal`) });
      } });
    });

    const t1 = addText(this, W / 2, 18, 'РЫЦАРЬ', { scale: 3, color: '#ffd84a' });
    const t2 = addText(this, W / 2, 38, 'И СЛАЙМЫ', { scale: 2, color: '#b6e05a' });
    this.tweens.add({ targets: [t1, t2], y: '-=2', duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const start = () => {
      if (this.starting) return;
      this.starting = true;
      Audio.unlock();
      Audio.sfx('click');
      Audio.play('dungeon');
      this.cameras.main.fadeOut(250, 12, 8, 6);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('LevelSelect'));
    };
    pixelButton(this, W / 2, 58, 'ИГРАТЬ', start);
    this.input.keyboard.once('keydown-ENTER', start);
    this.input.keyboard.once('keydown-SPACE', start);
    this.cameras.main.fadeIn(300, 12, 8, 6);

    // Requirement 1.19.2: the player can start now.
    YSDK.ready();
  }
}
