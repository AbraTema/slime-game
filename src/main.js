import { YSDK } from './sdk.js';
import { State } from './state.js';
import { BootScene } from './scenes/boot.js';
import { TitleScene } from './scenes/title.js';
import { GameScene } from './scenes/game.js';
import { UIScene } from './scenes/ui.js';
import { VictoryScene } from './scenes/victory.js';
import { LevelSelectScene } from './scenes/levelselect.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 192,
  height: 108,
  backgroundColor: '#0c0806',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { y: 620 }, debug: false, tileBias: 8 } },
  input: { keyboard: true, mouse: true, touch: true },
  disableContextMenu: true,
  banner: false,
  scene: [BootScene, TitleScene, LevelSelectScene, GameScene, UIScene, VictoryScene],
};

YSDK.init().finally(() => {
  const game = new Phaser.Game(config);
  // debug hooks for automated smoke tests (tools/smoke.py)
  window.__game = game;
  window.__state = State;
  window.__setRoom = (i, level = State.level) => { State.level = level; State.room = i; State.spawn = null; game.scene.getScene('Game').scene.restart(); };
  window.__startLevel = (l) => { State.reset(l); game.scene.getScenes(true).forEach(sc => { if (sc.scene.key !== 'Game') sc.scene.stop(); }); game.scene.start('Game'); };
});
