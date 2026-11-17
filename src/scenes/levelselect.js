import { LEVELS } from '../levels.js';
import { State } from '../state.js';
import { Audio } from '../audio.js';
import { YSDK } from '../sdk.js';
import { addText } from '../font.js';
import { getBaked } from '../world.js';
import { backdrop, pixelButton } from './title.js';

const PREVIEW = { w: 74, h: 40 };

export class LevelSelectScene extends Phaser.Scene {
  constructor() { super('LevelSelect'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    backdrop(this, 1, 0, 0, 300);
    this.add.rectangle(0, 0, W, H, 0x0c0806, 0.55).setOrigin(0);
    addText(this, W / 2, 10, 'ВЫБЕРИ УРОВЕНЬ', { scale: 1, color: '#ffd84a' });

    const stars = State.stars();
    this.cards = LEVELS.map((lv, i) => this.card(W / 2 + (i - (LEVELS.length - 1) / 2) * 88, 52, lv, i, stars[i] || 0));
    this.sel = 0;
    this.highlight();

    pixelButton(this, 22, H - 9, 'НАЗАД', () => this.back(), { color: 0x8a6e58, hover: 0xb08a6a, pulse: false });

    const kb = this.input.keyboard;
    kb.on('keydown-LEFT', () => { this.sel = (this.sel + LEVELS.length - 1) % LEVELS.length; this.highlight(); Audio.sfx('click'); });
    kb.on('keydown-RIGHT', () => { this.sel = (this.sel + 1) % LEVELS.length; this.highlight(); Audio.sfx('click'); });
    kb.on('keydown-A', () => kb.emit('keydown-LEFT'));
    kb.on('keydown-D', () => kb.emit('keydown-RIGHT'));
    kb.once('keydown-ENTER', () => this.start(this.sel));
    kb.once('keydown-SPACE', () => this.start(this.sel));
    kb.once('keydown-ESC', () => this.back());
    this.cameras.main.fadeIn(250, 12, 8, 6);
  }

  preview(i) {
    const key = `preview_${i}`;
    if (this.textures.exists(key)) return key;
    const bake = getBaked(i, 0);
    const start = bake.ents.find(([t]) => t === 'P');
    // level 1: look at the corridor; level 2: look up the tower from its middle
    const cx = i === 0 ? 150 : 0;
    const cy = i === 0 ? bake.H - 80 : Math.max(0, start[2] * 16 - 330);
    const c = document.createElement('canvas');
    c.width = PREVIEW.w; c.height = PREVIEW.h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(bake.far, -Math.round(cx * 0.5), -Math.round(cy * 0.5));
    x.drawImage(bake.canvas, -cx, -cy);
    this.textures.addCanvas(key, c);
    return key;
  }

  card(x, y, lv, i, starCount) {
    const c = this.add.container(x, y);
    const frame = this.add.rectangle(0, 0, PREVIEW.w + 6, PREVIEW.h + 30, 0x2a1d17).setStrokeStyle(1, 0x8a6e58);
    const img = this.add.image(0, -10, this.preview(i));
    const num = addText(this, -PREVIEW.w / 2 + 6, -10 - PREVIEW.h / 2 + 6, `${i + 1}`, { scale: 2, color: '#ffd84a' });
    const name = addText(this, 0, PREVIEW.h / 2 - 2, lv.name, { color: '#fff3d6' });
    c.add([frame, img, num, name]);
    for (let s = 0; s < 3; s++) c.add(this.add.image(-12 + s * 12, PREVIEW.h / 2 + 9, s < starCount ? 'star_full' : 'star_empty'));
    // living preview: a hopping slime on each card
    const sl = this.add.image(PREVIEW.w / 2 - 10, 6, `sl_${i === 0 ? 'green' : 'fire'}_normal`);
    c.add(sl);
    this.tweens.add({ targets: sl, y: 2, duration: 300, yoyo: true, repeat: -1, ease: 'Quad.easeOut', delay: i * 200 });
    c.setSize(PREVIEW.w + 6, PREVIEW.h + 30).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => { this.sel = i; this.highlight(); });
    c.on('pointerup', () => this.start(i));
    c.frame = frame;
    return c;
  }

  highlight() {
    this.cards.forEach((c, i) => {
      const on = i === this.sel;
      c.frame.setStrokeStyle(on ? 2 : 1, on ? 0xffd84a : 0x8a6e58);
      this.tweens.killTweensOf(c);
      this.tweens.add({ targets: c, scale: on ? 1.06 : 1, duration: 150 });
    });
  }

  start(i) {
    if (this.going) return;
    this.going = true;
    Audio.unlock();
    Audio.sfx('click');
    YSDK.gameplayStart();
    State.reset(i);
    this.cameras.main.fadeOut(250, 12, 8, 6);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
  }

  back() {
    if (this.going) return;
    this.going = true;
    this.scene.start('Title');
  }
}
