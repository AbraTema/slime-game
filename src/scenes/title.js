import { Audio } from '../audio.js';
import { YSDK } from '../sdk.js';
import { State } from '../state.js';
import { addText } from '../font.js';
import { getBaked } from './game.js';

export function pixelButton(scene, x, y, label, onClick) {
  const c = scene.add.container(x, y);
  const t = addText(scene, 0, 0, label, { scale: 1, color: '#2a1d17', outline: null });
  const w = t.width + 16, h = 15;
  const shadow = scene.add.rectangle(0, 2, w, h, 0x0c0806);
  const body = scene.add.rectangle(0, 0, w, h, 0xffc23a).setStrokeStyle(1, 0x3a2010);
  const shine = scene.add.rectangle(0, -h / 2 + 2, w - 4, 2, 0xffe27a);
  c.add([shadow, body, shine, t]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerover', () => body.setFillStyle(0xffd84a));
  c.on('pointerout', () => body.setFillStyle(0xffc23a));
  c.on('pointerdown', () => { c.y += 1; });
  c.on('pointerup', () => { c.y -= 1; onClick(); });
  scene.tweens.add({ targets: c, scale: { from: 1, to: 1.06 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return c;
}

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    const bake = getBaked(0);
    if (!this.textures.exists('room_0')) this.textures.addCanvas('room_0', bake.canvas);
    this.add.image(-8, 0, 'room_0').setOrigin(0, 0);
    for (const [sx, sy] of bake.torches) {
      if (sx > W + 8) continue;
      this.add.sprite(sx - 10, sy - 2, 'torch_t0').setOrigin(0, 0).play('torch');
      const g = this.add.image(sx - 8, sy, 'glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.22).setScale(1.7);
      this.tweens.add({ targets: g, alpha: { from: 0.16, to: 0.27 }, duration: 260, yoyo: true, repeat: -1 });
    }
    this.add.rectangle(0, 0, W, H, 0x0c0806, 0.35).setOrigin(0);

    // characters
    const k = this.add.image(W / 2 - 50, 112, 'k_strike').setOrigin(0.5, 1).setTint(0xfff0dd);
    this.tweens.add({ targets: k, y: 111, duration: 500, yoyo: true, repeat: -1 });
    [['green', 26], ['pink', 46], ['purple', 66]].forEach(([c, dx], i) => {
      const s = this.add.image(W / 2 + dx - 10, 112, `sl_${c}_normal`).setOrigin(0.5, 1);
      this.time.addEvent({ delay: 450, loop: true, startAt: i * 150, callback: () => {
        s.setTexture(`sl_${c}_squash`);
        this.time.delayedCall(120, () => s.setTexture(`sl_${c}_stretch`));
        this.tweens.add({ targets: s, y: 104, duration: 160, yoyo: true, delay: 120, onComplete: () => s.setTexture(`sl_${c}_normal`) });
      } });
    });

    addText(this, W / 2, 26, 'РЫЦАРЬ', { scale: 3, color: '#ffd84a' });
    addText(this, W / 2, 50, 'И СЛАЙМЫ', { scale: 2, color: '#b6e05a' });

    const start = () => {
      if (this.starting) return;
      this.starting = true;
      Audio.unlock();
      Audio.sfx('click');
      YSDK.gameplayStart();
      State.reset();
      this.cameras.main.fadeOut(300, 12, 8, 6);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
    };
    pixelButton(this, W / 2, 78, 'ИГРАТЬ', start);
    this.input.keyboard.once('keydown-ENTER', start);
    this.input.keyboard.once('keydown-SPACE', start);

    // Requirement 1.19.2: the player can start now.
    YSDK.ready();
  }
}
