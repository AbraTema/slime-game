import { State } from '../state.js';
import { Audio } from '../audio.js';
import { YSDK } from '../sdk.js';
import { addText, setPixelText } from '../font.js';

export class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    ['keydown-ESC', 'keydown-P', 'keydown-M'].forEach(e => this.input.keyboard.removeAllListeners(e));
    this.paused = false;
    this.hearts = [0, 1, 2].map(i => this.add.image(5 + i * 9, 5, 'heart_full').setOrigin(0, 0));
    this.crIcon = this.add.sprite(W - 34, 5, 'cr_gold_c0').setOrigin(0, 0).play('cr_gold');
    this.crText = addText(this, W - 26, 5, '', { origin: [0, 0] });

    this.spk = this.add.image(W - 10, H - 9, Audio.muted ? 'spk_off' : 'spk_on').setInteractive({ useHandCursor: true });
    this.spk.on('pointerdown', () => this.toggleSound());
    this.input.keyboard.on('keydown-M', () => this.toggleSound());

    // boss bar
    this.bossBar = this.add.container(W / 2, 14).setVisible(false);
    const back = this.add.rectangle(0, 0, 82, 6, 0x1a1420).setOrigin(0.5);
    const frame = this.add.rectangle(0, 0, 80, 4, 0x4a2a1a).setOrigin(0.5);
    this.bossFill = this.add.rectangle(-40, 0, 80, 4, 0xffc23a).setOrigin(0, 0.5);
    this.bossName = addText(this, 0, -9, 'КОРОЛЬ-СЛАЙМ', { color: '#ffd84a' });
    this.bossBar.add([back, frame, this.bossFill, this.bossName]);

    // room banner
    this.banner = addText(this, W / 2, 34, '', { scale: 1, color: '#ffe2b8' }).setAlpha(0);

    // pause overlay
    this.pauseLayer = this.add.container(0, 0).setVisible(false).setDepth(50);
    this.pauseLayer.add(this.add.rectangle(0, 0, W, H, 0x0c0806, 0.7).setOrigin(0));
    this.pauseLayer.add(addText(this, W / 2, H / 2 - 10, 'ПАУЗА', { scale: 2, color: '#ffd84a' }));
    this.pauseLayer.add(addText(this, W / 2, H / 2 + 10, 'ESC - ПРОДОЛЖИТЬ', { color: '#fff3d6' }));
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard.on('keydown-P', () => this.togglePause());

    this.deathText = addText(this, W / 2, H / 2 - 8, 'ПОПРОБУЙ ЕЩЁ!', { scale: 2, color: '#ffe2b8' }).setAlpha(0);

    this.hint = null;

    const ge = this.game.events;
    const handlers = {
      hearts: () => this.refreshHearts(),
      crystals: () => this.refreshCrystals(),
      'room-enter': (name, idx) => this.onRoom(name, idx),
      'boss-start': (hp, max) => { this.bossBar.setVisible(true); this.setBoss(hp, max); this.showBanner('КОРОЛЬ-СЛАЙМ ПРОСНУЛСЯ!'); },
      'boss-hp': (hp, max) => this.setBoss(hp, max),
      death: () => this.tweens.add({ targets: this.deathText, alpha: 1, duration: 300, yoyo: true, hold: 700 }),
      checkpoint: () => this.showBanner('ФЛАЖОК! СЕРДЕЧКИ ПОЛНЫЕ'),
      'player-acted': () => this.dismissHint(),
    };
    Object.entries(handlers).forEach(([e, fn]) => ge.on(e, fn));
    this.events.once('shutdown', () => Object.entries(handlers).forEach(([e, fn]) => ge.off(e, fn)));

    this.unsub = YSDK.on((ev) => {
      if (ev === 'pause' && !this.paused && this.scene.isActive('Game')) this.togglePause(true);
    });
    this.events.once('shutdown', () => this.unsub());

    this.refreshHearts();
    this.refreshCrystals();
    const room = this.registry.get('room');
    if (room) this.onRoom(room.name, room.index);
  }

  refreshHearts() {
    this.hearts.forEach((h, i) => h.setTexture(i < State.hearts ? 'heart_full' : 'heart_empty'));
  }

  refreshCrystals() {
    setPixelText(this.crText, `${State.crystals}`);
    this.tweens.add({ targets: this.crIcon, scale: { from: 1.5, to: 1 }, duration: 200 });
  }

  setBoss(hp, max) {
    this.bossFill.width = Math.max(0, 80 * hp / max);
    if (hp <= 0) this.time.delayedCall(400, () => this.bossBar.setVisible(false));
  }

  onRoom(name, idx) {
    this.bossBar.setVisible(false);
    this.showBanner(name);
    if (idx === 0 && !State.hintShown) this.showHint();
  }

  showBanner(text) {
    setPixelText(this.banner, text);
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(0);
    this.tweens.add({ targets: this.banner, alpha: 1, duration: 300, yoyo: true, hold: 1300 });
  }

  // Controls hint with key-cap pictures
  showHint() {
    State.hintShown = true;
    const W = this.scale.width, H = this.scale.height;
    // sits on the stone floor, below the knight's feet (floor top is y=112)
    const c = this.add.container(W / 2, H - 15).setAlpha(0);
    c.add(this.add.rectangle(0, 0, 226, 27, 0x1a1420, 0.78).setStrokeStyle(1, 0x8a6e58));
    const key = (x, y, label, w = 11) => {
      c.add(this.add.rectangle(x, y + 1, w, 10, 0x0c0806));
      c.add(this.add.rectangle(x, y, w, 10, 0xe8dcc8).setStrokeStyle(1, 0x5a4434));
      c.add(addText(this, x, y, label, { color: '#2a1d17', outline: null }));
    };
    key(-98, -6, '←'); key(-86, -6, '→');
    key(-98, 7, 'A'); key(-86, 7, 'D');
    c.add(addText(this, -77, 0, 'ХОДИТЬ', { origin: [0, 0.5] }));
    key(-6, -6, 'ПРОБЕЛ', 40); key(-6, 7, 'W');
    c.add(addText(this, 17, 0, 'ПРЫЖОК', { origin: [0, 0.5] }));
    key(66, -6, 'X'); key(66, 7, 'J');
    c.add(addText(this, 75, 0, 'МЕЧ', { origin: [0, 0.5] }));
    this.hint = c;
    this.hintAge = 0;
    this.tweens.add({ targets: c, alpha: 1, duration: 400, delay: 600 });
  }

  dismissHint() {
    if (!this.hint || this.hintClosing) return;
    this.hintActs = (this.hintActs || 0) + 1;
    if (this.hintActs < 40 || this.hintAge < 4) return;
    this.closeHint();
  }

  closeHint() {
    if (!this.hint || this.hintClosing) return;
    this.hintClosing = true;
    const h = this.hint;
    this.tweens.add({ targets: h, alpha: 0, duration: 500, onComplete: () => { h.destroy(); this.hint = null; this.hintClosing = false; } });
  }

  update(time, delta) {
    if (this.hint) { this.hintAge += delta / 1000; if (this.hintAge > 12) this.closeHint(); }
  }

  toggleSound() {
    Audio.setMuted(!Audio.muted);
    this.spk.setTexture(Audio.muted ? 'spk_off' : 'spk_on');
  }

  togglePause(force) {
    if (!this.scene.isActive('Game') && !this.paused) return;
    this.paused = force === true ? true : !this.paused;
    this.pauseLayer.setVisible(this.paused);
    if (this.paused) { this.scene.pause('Game'); Audio.suspend('pause'); YSDK.gameplayStop(); } else { this.scene.resume('Game'); Audio.resume('pause'); YSDK.gameplayStart(); }
  }
}
