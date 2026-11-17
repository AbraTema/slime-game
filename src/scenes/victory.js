import { LEVELS } from '../levels.js';
import { State } from '../state.js';
import { Audio } from '../audio.js';
import { YSDK } from '../sdk.js';
import { addText } from '../font.js';
import { pixelButton } from './title.js';

export class VictoryScene extends Phaser.Scene {
  constructor() { super('Victory'); }

  create() {
    this.scene.stop('UI');
    this.going = false;
    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(0, 0, W, H, 0x0c0806, 0.72).setOrigin(0);
    const panel = this.add.container(W / 2, H / 2);
    panel.add(this.add.rectangle(0, 2, 176, 96, 0x0c0806));
    panel.add(this.add.rectangle(0, 0, 176, 96, 0x2a1d17).setStrokeStyle(1, 0xffc23a));
    panel.add(addText(this, 0, -36, 'ПОБЕДА!', { scale: 2, color: '#ffd84a' }));

    const total = State.totalCrystals;
    const got = Math.min(State.crystals, total);
    const ratio = got / total;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.5 ? 2 : 1;
    State.saveStars(State.level, stars);
    for (let i = 0; i < 3; i++) {
      const s = this.add.image(-18 + i * 18, -15, 'star_empty').setScale(2);
      panel.add(s);
      if (i < stars) {
        this.time.delayedCall(400 + i * 300, () => {
          s.setTexture('star_full');
          this.tweens.add({ targets: s, scale: { from: 3.2, to: 2 }, duration: 250, ease: 'Back.easeOut' });
          Audio.sfx('crystal');
        });
      }
    }
    panel.add(this.add.sprite(-22, 6, 'cr_gold_c0').play('cr_gold'));
    panel.add(addText(this, -14, 6, `${got} / ${total}`, { origin: [0, 0.5] }));

    const hasNext = State.level + 1 < LEVELS.length;
    const btns = [['МЕНЮ', () => this.menu()], ['ЗАНОВО', () => this.again()]];
    if (hasNext) btns.push(['ДАЛЬШЕ', () => this.next()]);
    const xs = hasNext ? [-58, 0, 58] : [-32, 32];
    btns.forEach(([label, fn], i) => panel.add(pixelButton(this, xs[i], 32, label, fn, { pulse: i === btns.length - 1 })));
    this.input.keyboard.once('keydown-ENTER', () => (hasNext ? this.next() : this.again()));
    this.input.keyboard.once('keydown-ESC', () => this.menu());

    panel.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' });
  }

  go(fn) {
    if (this.going) return;
    this.going = true;
    Audio.sfx('click');
    fn();
  }

  again() { this.go(() => { State.reset(State.level); YSDK.gameplayStart(); this.scene.stop('Game'); this.scene.start('Game'); }); }

  next() { this.go(() => { State.reset(State.level + 1); YSDK.gameplayStart(); this.scene.stop('Game'); this.scene.start('Game'); }); }

  menu() { this.go(() => { this.scene.stop('Game'); Audio.play('dungeon'); this.scene.start('LevelSelect'); }); }
}
