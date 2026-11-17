// Moving ambience: swinging lanterns, fireflies, water drips, falling leaves, bats, light shafts.
// None of these affect gameplay; they make the dungeon feel alive.
import { TILE, PARALLAX } from '../world.js';
import { GEMS } from '../art.js';

const GEM_INT = GEMS.map(c => parseInt(c.slice(1), 16));

export function addLanterns(scene, bake, chainCanvas) {
  const items = [];
  for (const l of bake.lanterns) {
    const len = Math.max(4, l.y - l.top);
    const key = `chain_${len}`;
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, chainCanvas(len));
    const c = scene.add.container(l.x, l.top).setDepth(4);
    const variant = [['lantern', 0xffb35c], ['lantern_cyan', 0x5fe0ff], ['lantern', 0xffb35c], ['lantern_pink', 0xff4ef0]][(l.x + l.y) % 4];
    const chain = scene.add.image(0, 0, key).setOrigin(0.5, 0);
    const lamp = scene.add.image(0, len, variant[0]).setOrigin(0.5, 0.2);
    c.add([chain, lamp]);
    const glow = scene.add.image(l.x, l.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(5).setAlpha(0.32).setScale(1.3).setTint(variant[1]);
    const phase = Math.random() * Math.PI * 2;
    const amp = 0.18 + Math.random() * 0.1;
    items.push({ c, glow, len, phase, amp, speed: 1.4 + Math.random() * 0.5 });
  }
  return (t) => {
    for (const it of items) {
      const a = Math.sin(t / 1000 * it.speed + it.phase) * it.amp;
      it.c.rotation = a;
      it.glow.setPosition(it.c.x - Math.sin(a) * (it.len + 2), it.c.y + Math.cos(a) * (it.len + 2));
      it.glow.setAlpha(0.28 + Math.sin(t / 130 + it.phase) * 0.03);
    }
  };
}

export function addFireflies(scene, bake, n) {
  const flies = [];
  const cols = [0xd6ff6a, 0xfff2a0, 0x9dffd2];
  for (let i = 0; i < n; i++) {
    const bx = 16 + Math.random() * (bake.W - 32), by = 20 + Math.random() * (bake.H - 50);
    const dot = scene.add.image(bx, by, 'px').setTint(cols[i % 3]).setDepth(13);
    const halo = scene.add.image(bx, by, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(cols[i % 3]).setScale(0.18).setDepth(13);
    flies.push({ dot, halo, bx, by, p: Math.random() * 100, sx: 0.4 + Math.random() * 0.5, sy: 0.6 + Math.random() * 0.6 });
  }
  return (t) => {
    const s = t / 1000;
    for (const f of flies) {
      const x = f.bx + Math.sin(s * f.sx + f.p) * 18 + Math.sin(s * 2.3 + f.p) * 3;
      const y = f.by + Math.cos(s * f.sy + f.p) * 10;
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(s * 2.1 + f.p));
      f.dot.setPosition(Math.round(x), Math.round(y)).setAlpha(a);
      f.halo.setPosition(x, y).setAlpha(a * 0.6);
    }
  };
}

export function addDrips(scene, bake) {
  const sources = bake.ents.filter(([t]) => t === '~').map(([, tx, ty]) => ({ x: tx * TILE + 8, y: ty * TILE, t: Math.random() * 2 }));
  const drops = [];
  return (t, dt) => {
    for (const s of sources) {
      s.t -= dt;
      if (s.t <= 0) {
        s.t = 1.2 + Math.random() * 1.8;
        const x = s.x + Math.round((Math.random() - 0.5) * 10);
        drops.push({ img: scene.add.image(x, s.y + 2, 'px').setTint(0x9fe8ff).setDepth(6).setScale(1, 2), vy: 0 });
      }
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.vy += 420 * dt;
      d.img.y += d.vy * dt;
      if (scene.isSolidAt(d.img.x, d.img.y + 1) || d.img.y > bake.H) {
        const em = scene.add.particles(d.img.x, d.img.y - 1, 'px', {
          speedX: { min: -30, max: 30 }, speedY: { min: -50, max: -15 }, gravityY: 300, lifespan: 260, tint: 0x9fe8ff, emitting: false,
        }).setDepth(6);
        em.explode(4);
        scene.time.delayedCall(400, () => em.destroy());
        d.img.destroy();
        drops.splice(i, 1);
      }
    }
  };
}

export function addLeaves(scene, bake) {
  if (!bake.vineAnchors.length) return () => {};
  const em = scene.add.particles(0, 0, 'px2', {
    emitZone: { type: 'random', source: { getRandomPoint: (p) => { const a = Phaser.Utils.Array.GetRandom(bake.vineAnchors); p.x = a[0]; p.y = a[1]; return p; } } },
    speedX: { min: -8, max: 8 }, speedY: { min: 8, max: 18 }, lifespan: 4000, frequency: 450,
    tint: [0x9ad84a, 0x7fb83a, 0xb6e05a], rotate: { start: 0, end: 360 }, alpha: { start: 1, end: 0 }, scale: { start: 1, end: 0.5 },
  }).setDepth(6);
  return () => {};
}

export function addBats(scene, bake) {
  const bats = bake.ents.filter(([t]) => t === 'b').map(([, tx, ty]) => {
    const s = scene.add.sprite(tx * TILE + 8, ty * TILE + 8, 'bat_b0').play('bat').setDepth(3).setAlpha(0.9);
    return { s, x: tx * TILE + 8, y: ty * TILE + 8, p: Math.random() * 10, r: 26 + Math.random() * 20 };
  });
  return (t) => {
    const s = t / 1000;
    for (const b of bats) {
      const nx = b.x + Math.sin(s * 0.9 + b.p) * b.r;
      const ny = b.y + Math.sin(s * 1.8 + b.p) * 8;
      b.s.setFlipX(nx < b.s.x);
      b.s.setPosition(nx, ny);
    }
  };
}

export function addMushroomGlows(scene, bake) {
  for (const [x, y, tint] of bake.mushrooms) {
    const g = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint ?? 0xffa040).setScale(0.45).setDepth(5).setAlpha(0.25);
    scene.tweens.add({ targets: g, alpha: { from: 0.15, to: 0.4 }, scale: { from: 0.4, to: 0.55 }, duration: 1200 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}

export function addRays(scene, bake) {
  // god-rays through a few of the see-through arches
  bake.arches.slice(0, 4).forEach((a, i) => {
    const ray = scene.add.image(a.tx * TILE, a.ty * TILE, 'ray').setOrigin(0.2, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(1).setAlpha(0.5);
    scene.tweens.add({ targets: ray, alpha: { from: 0.25, to: 0.6 }, duration: 2400 + i * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  });
}

export function addDust(scene, bake) {
  scene.add.particles(0, 0, 'px', {
    x: { min: 0, max: bake.W }, y: { min: 10, max: bake.H - 20 }, lifespan: 5000, speedY: { min: -4, max: -1 }, speedX: { min: -3, max: 3 },
    alpha: { start: 0, end: 0, ease: (t) => Math.sin(t * Math.PI) * 0.7 }, tint: 0xffd9a0,
    frequency: Math.max(40, 30000 / (bake.W * bake.H / 1000)), quantity: 1,
  }).setDepth(5);
}

/** Waterfalls and glowing crystals in the far (parallax) layer. */
export function addFarLife(scene, bake) {
  const falls = bake.waterfalls.map(w => {
    const ts = scene.add.tileSprite(w.x, w.y, w.w, w.h, 'water').setOrigin(0, 0).setScrollFactor(PARALLAX).setDepth(-1.5).setAlpha(0.85);
    const foam = scene.add.image(w.x + w.w / 2, w.y + w.h, 'glow').setScrollFactor(PARALLAX).setBlendMode(Phaser.BlendModes.ADD).setTint(0x8fe8ff).setScale(0.5, 0.25).setDepth(-1.4).setAlpha(0.5);
    scene.tweens.add({ targets: foam, alpha: { from: 0.3, to: 0.6 }, duration: 300, yoyo: true, repeat: -1 });
    return { ts, speed: 40 + Math.random() * 30 };
  });
  for (const c of bake.farCrystals) {
    if (Math.random() < 0.5) continue;
    const g = scene.add.image(c.x, c.y, 'glow').setScrollFactor(PARALLAX).setBlendMode(Phaser.BlendModes.ADD).setTint(c.color).setScale(0.35).setDepth(-1.4).setAlpha(0.3);
    scene.tweens.add({ targets: g, alpha: { from: 0.12, to: 0.45 }, duration: 900 + Math.random() * 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 1000 });
  }
  return (t, dt) => { for (const f of falls) f.ts.tilePositionY -= f.speed * dt; };
}

/** Strings of colourful pennants that sway. */
export function addGarlands(scene, bake) {
  const lines = [];
  const rope = scene.add.graphics().setDepth(3);
  if (bake.open) {
    for (let y = 3 * TILE; y < bake.H - 3 * TILE; y += 5 * TILE + Math.floor(Math.random() * 2) * TILE) lines.push([10, y, bake.W - 10, y + Math.round((Math.random() - 0.5) * 20)]);
  } else {
    for (let x = 20; x < bake.W - 60; x += 90 + Math.floor(Math.random() * 60)) {
      const len = 60 + Math.random() * 40;
      lines.push([x, TILE + 4, Math.min(bake.W - 20, x + len), TILE + 4]);
    }
    // eye-level strings between wall hooks above the floor
    const floorY = (bake.rows - 2) * TILE;
    for (let x = 40; x < bake.W - 80; x += 120 + Math.floor(Math.random() * 80)) {
      const y = floorY - 52 - Math.floor(Math.random() * 20);
      const ok = !bake.solid[Math.floor(y / TILE)]?.slice(Math.floor(x / TILE), Math.floor((x + 70) / TILE) + 1).some(Boolean);
      if (ok) lines.push([x, y, x + 64 + Math.random() * 20, y + Math.round((Math.random() - 0.5) * 10)]);
    }
  }
  const garlands = lines.map(([x1, y1, x2, y2], gi) => {
    const n = Math.max(4, Math.floor((x2 - x1) / 9));
    const flags = [];
    for (let i = 1; i < n; i++) flags.push(scene.add.image(0, 0, `pennant_${(i + gi) % GEMS.length}`).setOrigin(0.5, 0).setDepth(3));
    return { x1, y1, x2, y2, n, flags, sag: 8 + (x2 - x1) * 0.06, p: Math.random() * 6 };
  });
  const still = bake.open; // tower garlands hang still
  const draw = (t) => {
    rope.clear();
    rope.lineStyle(1, 0x2a1d17, 1);
    const s = t / 1000;
    for (const g of garlands) {
      const sag = g.sag + (still ? 0 : Math.sin(s * 1.3 + g.p) * 2);
      const pt = (u) => [g.x1 + (g.x2 - g.x1) * u, g.y1 + (g.y2 - g.y1) * u + Math.sin(Math.PI * u) * sag];
      rope.beginPath();
      for (let i = 0; i <= 16; i++) { const [px, py] = pt(i / 16); if (i === 0) rope.moveTo(px, py); else rope.lineTo(px, py); }
      rope.strokePath();
      g.flags.forEach((f, i) => {
        const u = (i + 1) / g.n;
        const [px, py] = pt(u);
        f.setPosition(Math.round(px), Math.round(py));
        f.rotation = still ? 0 : Math.sin(s * 2.2 + i * 0.7 + g.p) * 0.25;
      });
    }
  };
  if (still) { draw(0); return () => {}; }
  return draw;
}

/** Things hanging from ceilings and ledges: glowing crystals and banners that swing. */
export function addHangers(scene, bake) {
  const items = [];
  for (const g of bake.wallGems) {
    const gl = scene.add.image(g.x, g.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(g.color).setScale(0.32).setAlpha(0.35).setDepth(3);
    scene.tweens.add({ targets: gl, alpha: { from: 0.18, to: 0.5 }, duration: 700 + Math.random() * 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.random() * 800 });
  }
  for (const [x, y] of bake.wallSpots) {
    const k = Math.floor(x / 16 + y / 16) % GEMS.length;
    items.push({ img: scene.add.image(x, y, `banner_${k}`).setOrigin(0.5, 0).setDepth(3), glow: null, x, y, p: Math.random() * 6, a: 0.07 });
  }
  const spots = bake.undersides.filter((_, i) => (i * 7) % (bake.open ? 3 : 4) === 0);
  for (const [x, y] of spots) {
    const k = Math.floor((x * 13 + y * 7) / 16) % GEMS.length;
    const isBanner = bake.open ? (x + y) % 3 === 0 : (x + y) % 2 === 0;
    const img = scene.add.image(x, y, isBanner ? `banner_${k}` : `hcrystal_${k}`).setOrigin(0.5, 0).setDepth(3);
    let glow = null;
    if (!isBanner) {
      glow = scene.add.image(x, y + 6, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(GEM_INT[k]).setScale(0.4).setAlpha(0.35).setDepth(3);
    }
    items.push({ img, glow, x, y, p: Math.random() * 6, a: isBanner ? 0.12 : 0.22 });
  }
  return (t) => {
    const s = t / 1000;
    for (const it of items) {
      const a = Math.sin(s * 1.6 + it.p) * it.a;
      it.img.rotation = a;
      if (it.glow) { it.glow.setPosition(it.x - Math.sin(a) * 6, it.y + 6); it.glow.setAlpha(0.28 + Math.sin(s * 3 + it.p) * 0.08); }
    }
  };
}
