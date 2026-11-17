import { State } from '../state.js';
import { Audio } from '../audio.js';
import { YSDK } from '../sdk.js';
import { addText, setPixelText } from '../font.js';
import { pixelButton } from './title.js';

export class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    ['keydown-ESC', 'keydown-P', 'keydown-M'].forEach(e => this.input.keyboard.removeAllListeners(e));
    this.paused = false;
    this.hint = null;
    this.hintClosing = false;
    this.hearts = [0, 1, 2].map(i => this.add.image(4 + i * 9, 4, 'heart_full').setOrigin(0, 0));
    this.crIcon = this.add.sprite(W - 28, 4, 'cr_gold_c0').setOrigin(0, 0).play('cr_gold');
    this.crText = addText(this, W - 20, 4, '', { origin: [0, 0] });

    this.spk = this.add.image(W - 8, H - 7, Audio.muted ? 'spk_off' : 'spk_on').setInteractive({ useHandCursor: true });
    this.spk.on('pointerdown', () => this.toggleSound());
    this.input.keyboard.on('keydown-M', () => this.toggleSound());

    // boss bar
    this.bossBar = this.add.container(W / 2, 20).setVisible(false);
    this.bossFill = this.add.rectangle(-36, 0, 72, 4, 0xffc23a).setOrigin(0, 0.5);
    this.bossBar.add([
      this.add.rectangle(0, 0, 74, 6, 0x1a1420),
      this.add.rectangle(0, 0, 72, 4, 0x4a2a1a),
      this.bossFill,
      addText(this, 0, -8, 'КОРОЛЬ-СЛАЙМ', { color: '#ffd84a' }),
    ]);

    this.banner = addText(this, W / 2, 24, '', { color: '#ffe2b8' }).setAlpha(0);
    this.tip = addText(this, W / 2, 34, '', { color: '#9dff6a' }).setAlpha(0);

    // pause overlay with buttons
    this.pauseLayer = this.add.container(0, 0).setVisible(false).setDepth(50);
    this.pauseLayer.add(this.add.rectangle(0, 0, W, H, 0x0c0806, 0.72).setOrigin(0));
    this.pauseLayer.add(addText(this, W / 2, H / 2 - 22, 'ПАУЗА', { scale: 2, color: '#ffd84a' }));
    this.pauseLayer.add(pixelButton(this, W / 2, H / 2 + 2, 'ПРОДОЛЖИТЬ', () => this.togglePause(false), { pulse: false }));
    this.pauseLayer.add(pixelButton(this, W / 2, H / 2 + 20, 'К УРОВНЯМ', () => this.toMenu(), { color: 0x8a6e58, hover: 0xb08a6a, pulse: false }));
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard.on('keydown-P', () => this.togglePause());

    this.deathText = addText(this, W / 2, H / 2 - 8, 'ПОПРОБУЙ ЕЩЁ!', { scale: 2, color: '#ffe2b8' }).setAlpha(0);

    const ge = this.game.events;
    const handlers = {
      hearts: () => this.refreshHearts(),
      crystals: () => this.refreshCrystals(),
      'room-enter': (name, idx, lvl) => this.onRoom(name, idx, lvl),
      'boss-start': (hp, max) => { this.bossBar.setVisible(true); this.setBoss(hp, max); this.showBanner('КОРОЛЬ ПРОСНУЛСЯ!'); },
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
    if (room) this.onRoom(room.name, room.index, room.level);
  }

  refreshHearts() {
    this.hearts.forEach((h, i) => h.setTexture(i < State.hearts ? 'heart_full' : 'heart_empty'));
  }

  refreshCrystals() {
    setPixelText(this.crText, `${State.crystals}`);
    this.tweens.add({ targets: this.crIcon, scale: { from: 1.5, to: 1 }, duration: 200 });
  }

  setBoss(hp, max) {
    this.bossFill.width = Math.max(0, 72 * hp / max);
    if (hp <= 0) this.time.delayedCall(400, () => this.bossBar.setVisible(false));
  }

  onRoom(name, idx, lvl) {
    this.bossBar.setVisible(false);
    this.showBanner(name);
    if (idx > 0 || lvl > 0) this.closeHint();
    if (lvl === 0 && idx === 0 && !State.hintShown) this.showHint();
    if (lvl === 1 && idx === 0 && !State.hintShown) {
      State.hintShown = true;
      this.showTips(['ПОДНИМАЙСЯ НАВЕРХ!', 'БЕЙ СЛАЙМОВ СТОЯ НА ПОЛУ!', 'ОГНЕННЫЕ ШАРЫ СБИВАЮТ!', 'ШАР МОЖНО РАЗРУБИТЬ МЕЧОМ']);
    }
  }

  showBanner(text) {
    setPixelText(this.banner, text);
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(0);
    this.tweens.add({ targets: this.banner, alpha: 1, duration: 300, yoyo: true, hold: 1300 });
  }

  showTips(list) {
    list.forEach((t, i) => this.time.delayedCall(2200 + i * 2600, () => {
      setPixelText(this.tip, t);
      this.tweens.killTweensOf(this.tip);
      this.tip.setAlpha(0);
      this.tweens.add({ targets: this.tip, alpha: 1, duration: 250, yoyo: true, hold: 1800 });
    }));
  }

  // Controls hint with key-cap pictures, pinned to the bottom of the screen
  showHint() {
    State.hintShown = true;
    const W = this.scale.width, H = this.scale.height;
    const c = this.add.container(W / 2, H - 10).setAlpha(0);
    c.add(this.add.rectangle(0, 0, 178, 15, 0x1a1420, 0.8).setStrokeStyle(1, 0x8a6e58));
    const key = (x, label, w = 9) => {
      c.add(this.add.rectangle(x, 1, w, 10, 0x0c0806));
      c.add(this.add.rectangle(x, 0, w, 10, 0xe8dcc8).setStrokeStyle(1, 0x5a4434));
      if (label) c.add(addText(this, x, 0, label, { color: '#2a1d17', outline: null }));
    };
    key(-81, '←'); key(-71, '→');
    c.add(addText(this, -64, 0, 'ХОДИТЬ', { origin: [0, 0.5] }));
    key(-11, '', 22);
    c.add(addText(this, 2, 0, 'ПРЫЖОК', { origin: [0, 0.5] }));
    key(50, 'X');
    c.add(addText(this, 57, 0, 'МЕЧ', { origin: [0, 0.5] }));
    this.hint = c;
    this.hintAge = 0;
    this.hintActs = 0;
    this.tweens.add({ targets: c, alpha: 1, duration: 400, delay: 600 });
  }

  dismissHint() {
    if (!this.hint || this.hintClosing) return;
    this.hintActs++;
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
    this.paused = typeof force === 'boolean' ? force : !this.paused;
    this.pauseLayer.setVisible(this.paused);
    if (this.paused) { this.scene.pause('Game'); Audio.suspend('pause'); YSDK.gameplayStop(); } else { this.scene.resume('Game'); Audio.resume('pause'); YSDK.gameplayStart(); }
  }

  toMenu() {
    Audio.resume('pause');
    YSDK.gameplayStop();
    this.scene.stop('Game');
    Audio.stop();
    Audio.play('dungeon');
    this.scene.start('LevelSelect');
  }
}
