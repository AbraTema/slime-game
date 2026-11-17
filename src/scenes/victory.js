import { State } from '../state.js';
import { Audio } from '../audio.js';
import { YSDK } from '../sdk.js';
import { addText } from '../font.js';
import { pixelButton } from './title.js';

export class VictoryScene extends Phaser.Scene {
  constructor() { super('Victory'); }

  create() {
    this.scene.stop('UI');
    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(0, 0, W, H, 0x0c0806, 0.72).setOrigin(0);
    const panel = this.add.container(W / 2, H / 2);
    panel.add(this.add.rectangle(0, 2, 170, 112, 0x0c0806));
    panel.add(this.add.rectangle(0, 0, 170, 112, 0x2a1d17).setStrokeStyle(1, 0xffc23a));
    panel.add(addText(this, 0, -40, 'ПОБЕДА!', { scale: 3, color: '#ffd84a' }));

    const total = State.totalCrystals;
    const got = Math.min(State.crystals, total);
    const ratio = got / total;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.5 ? 2 : 1;
    for (let i = 0; i < 3; i++) {
      const s = this.add.image(-22 + i * 22, -14, 'star_empty').setScale(2);
      panel.add(s);
      if (i < stars) {
        this.time.delayedCall(400 + i * 300, () => {
          s.setTexture('star_full');
          this.tweens.add({ targets: s, scale: { from: 3.2, to: 2 }, duration: 250, ease: 'Back.easeOut' });
          Audio.sfx('crystal');
        });
      }
    }
    const cr = this.add.sprite(-26, 10, 'cr_gold_c0').play('cr_gold');
    panel.add(cr);
    panel.add(addText(this, -18, 10, `${got} / ${total}`, { origin: [0, 0.5] }));
    panel.add(pixelButton(this, 0, 36, 'ЕЩЁ РАЗ', () => this.again()));
    this.input.keyboard.once('keydown-ENTER', () => this.again());

    panel.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' });
  }

  again() {
    if (this.going) return;
    this.going = true;
    Audio.sfx('click');
    State.reset();
    YSDK.gameplayStart();
    this.scene.stop('Game');
    this.scene.start('Game');
  }
}
