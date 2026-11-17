import * as Art from '../art.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    const reg = (k, c) => Art.registerCanvas(this, k, c);

    const kf = Art.knightFrames();
    Object.entries(kf).forEach(([k, c]) => reg(`k_${k}`, c));

    for (const color of Object.keys(Art.SLIME_COLORS)) {
      Object.entries(Art.slimeFrames(color)).forEach(([k, c]) => reg(`sl_${color}_${k}`, c));
      Object.entries(Art.slimeFrames(color, true)).forEach(([k, c]) => reg(`sl_${color}_mini_${k}`, c));
      const C = Art.SLIME_COLORS[color];
      Object.entries(Art.crystalFrames(C.x, C.L, C.ol)).forEach(([k, c]) => reg(`cr_${color}_${k}`, c));
    }
    Object.entries(Art.crystalFrames('#ffd84a', '#fff6c0', '#3a2010')).forEach(([k, c]) => reg(`cr_gold_${k}`, c));
    Object.entries(Art.kingFrames()).forEach(([k, c]) => reg(`king_${k}`, c));
    Object.entries(Art.torchFrames()).forEach(([k, c]) => reg(`torch_${k}`, c));
    Object.entries(Art.flagFrames()).forEach(([k, c]) => reg(`flag_${k}`, c));
    Object.entries(Art.doorFrames()).forEach(([k, c]) => reg(`door_${k}`, c));
    Object.entries(Art.chestFrames()).forEach(([k, c]) => reg(`chest_${k}`, c));
    reg('heart_full', Art.heartCanvas(true));
    reg('heart_empty', Art.heartCanvas(false));
    reg('wave', Art.waveCanvas());
    reg('star_full', Art.starCanvas(true));
    reg('star_empty', Art.starCanvas(false));
    reg('spk_on', Art.speakerCanvas(true));
    reg('spk_off', Art.speakerCanvas(false));
    reg('glow', Art.glowCanvas(64));
    reg('px', Art.pixelCanvas('#ffffff', 1));
    reg('px2', Art.pixelCanvas('#ffffff', 2));
    reg('slash', Art.slashCanvas());
    Object.entries(Art.fireballFrames()).forEach(([k, c]) => reg(`fireball_${k}`, c));
    Object.entries(Art.batFrames()).forEach(([k, c]) => reg(`bat_${k}`, c));
    reg('lantern', Art.lanternCanvas());
    reg('lantern_cyan', Art.lanternCanvas('#5fe0ff', '#e0fbff'));
    reg('lantern_pink', Art.lanternCanvas('#ff4ef0', '#ffe0fb'));
    reg('water', Art.waterCanvas());
    Art.GEMS.forEach((col, i) => {
      reg(`pennant_${i}`, Art.pennantCanvas(col));
      reg(`banner_${i}`, Art.bannerCanvas(col));
      reg(`hcrystal_${i}`, Art.hangCrystalCanvas(col));
    });
    reg('mover', Art.moverCanvas());
    reg('ray', Art.rayCanvas());
    reg('spark', Art.sparkCanvas());

    const a = this.anims;
    a.create({ key: 'k_idle', frames: [{ key: 'k_idle' }], frameRate: 1, repeat: -1 });
    a.create({ key: 'k_run', frames: ['k_run1', 'k_run2', 'k_run3', 'k_run2'].map(key => ({ key })), frameRate: 10, repeat: -1 });
    a.create({ key: 'torch', frames: [{ key: 'torch_t0' }, { key: 'torch_t1' }], frameRate: 6, repeat: -1 });
    a.create({ key: 'fireball', frames: [{ key: 'fireball_f0' }, { key: 'fireball_f1' }], frameRate: 10, repeat: -1 });
    a.create({ key: 'bat', frames: [{ key: 'bat_b0' }, { key: 'bat_b1' }], frameRate: 8, repeat: -1 });
    a.create({ key: 'flag_wave', frames: [{ key: 'flag_up1' }, { key: 'flag_up2' }], frameRate: 4, repeat: -1 });
    for (const color of [...Object.keys(Art.SLIME_COLORS), 'gold']) {
      a.create({ key: `cr_${color}`, frames: [{ key: `cr_${color}_c0` }, { key: `cr_${color}_c1` }], frameRate: 4, repeat: -1 });
    }

    this.scene.start('Title');
  }
}
