// Room layouts (16px tiles, 9 rows = 144px). Rooms are built from a compact description,
// then baked into one lit background canvas per room.
import { hexToRgb, torchFrames, mushCanvas } from './art.js';

export const TILE = 16;
export const ROWS = 9;

/*
 * floors:  [x0, x1]          solid rows 7-8 for tiles x0..x1 (gaps = pits)
 * plats:   [x0, x1, row]     one-way mossy ledges (16px thick)
 * walls:   [x, row0, row1]   solid column pieces
 * ents:    [type, x, row]    g/p/v slimes, c crystal, F flag, K king, m mushroom, T torch (bg)
 */
export const ROOMS = [
  {
    name: 'КОРИДОР',
    w: 44,
    floors: [[0, 43]],
    plats: [[16, 19, 5], [27, 31, 4]],
    walls: [],
    ents: [
      ['T', 3, 2], ['T', 13, 2], ['T', 24, 2], ['T', 35, 2],
      ['m', 6, 6], ['m', 22, 6], ['m', 29, 3], ['m', 40, 6],
      ['g', 11, 6], ['g', 22, 6], ['g', 36, 6],
      ['c', 9, 5], ['c', 17, 3], ['c', 18, 3], ['c', 29, 2], ['c', 33, 5],
    ],
    start: [2, 6],
    music: 'dungeon',
  },
  {
    name: 'МШИСТЫЕ УСТУПЫ',
    w: 64,
    floors: [[0, 21], [25, 39], [43, 63]],
    plats: [[8, 12, 5], [14, 17, 4], [19, 24, 3], [30, 35, 5], [41, 46, 4], [52, 55, 5]],
    walls: [],
    ents: [
      ['T', 3, 2], ['T', 15, 1], ['T', 27, 2], ['T', 38, 2], ['T', 49, 2], ['T', 60, 2],
      ['m', 5, 6], ['m', 33, 4], ['m', 58, 6], ['m', 44, 3],
      ['F', 2, 6],
      ['g', 6, 6], ['p', 10, 4], ['v', 16, 6], ['p', 29, 6], ['v', 33, 4], ['g', 43, 3],
      ['F', 37, 6],
      ['p', 50, 6], ['v', 54, 4], ['g', 57, 6], ['p', 60, 6],
      ['c', 10, 3], ['c', 15, 2], ['c', 21, 1], ['c', 23, 5], ['c', 24, 5], ['c', 32, 3],
      ['c', 42, 5], ['c', 43, 5], ['c', 45, 2], ['c', 53, 3],
    ],
    start: [2, 6],
    music: 'dungeon',
  },
  {
    name: 'ТРОННЫЙ ЗАЛ',
    w: 26,
    floors: [[0, 25]],
    plats: [[3, 6, 4], [19, 22, 4]],
    walls: [],
    ents: [
      ['T', 2, 2], ['T', 9, 1], ['T', 16, 1], ['T', 23, 2],
      ['m', 1, 6], ['m', 24, 6],
      ['F', 2, 6],
      ['K', 16, 6],
      ['c', 4, 2], ['c', 21, 2],
    ],
    start: [2, 6],
    music: 'boss',
    boss: true,
  },
];

export const PALETTE = {
  wall: '#3a2a22', brick: '#4e3a2d', mortar: '#2a1d17', stone: '#6a5243', stoneL: '#8a6e58',
  stoneD: '#47362c', moss: '#7fb83a', mossL: '#b6e05a', mossD: '#4f7d24', leaf: '#9ad84a',
  arch: '#24180f', ambient: 0.5, light: '#ffb35c',
};

// Deterministic RNG so each room always looks the same.
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Build solid grid + list of colliders for a room. */
export function buildGrid(room) {
  const W = room.w;
  const solid = Array.from({ length: ROWS }, () => new Array(W).fill(0)); // 0 empty, 1 solid, 2 one-way
  for (let x = 0; x < W; x++) solid[0][x] = 1; // ceiling
  for (let y = 0; y < ROWS; y++) { solid[y][0] = 1; solid[y][W - 1] = 1; } // side walls
  for (const [a, b] of room.floors) for (let x = a; x <= b; x++) { solid[7][x] = 1; solid[8][x] = 1; }
  for (const [a, b, r] of room.plats) for (let x = a; x <= b; x++) solid[r][x] = 2;
  for (const [x, r0, r1] of room.walls) for (let y = r0; y <= r1; y++) solid[y][x] = 1;
  // doorway in the right wall (rows 5-6), and in the left wall for rooms > 0
  solid[5][W - 1] = 0; solid[6][W - 1] = 0;
  // pits: open the floor all the way down
  return solid;
}

/** Merge horizontal runs into rectangles for physics. */
export function colliders(solid) {
  const rects = [];
  solid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const v = row[x];
      if (!v) { x++; continue; }
      let e = x;
      while (e + 1 < row.length && row[e + 1] === v) e++;
      rects.push({ x: x * TILE, y: y * TILE, w: (e - x + 1) * TILE, h: TILE, oneWay: v === 2 });
      x = e + 1;
    }
  });
  return rects;
}

/** Bake the room background with lighting. Returns { canvas, light(x,y)->[r,g,b] } */
export function bakeRoom(room, index) {
  const P = PALETTE;
  const W = room.w * TILE, H = ROWS * TILE;
  const solid = buildGrid(room);
  const r = rng(1000 + index * 77);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  const fill = (col, px, py, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const vary = (hex, v) => {
    const [R, G, B] = hexToRgb(hex);
    const k = Math.round((r() * 2 - 1) * v);
    return `rgb(${Math.max(0, R + k)},${Math.max(0, G + k)},${Math.max(0, B + k)})`;
  };

  // back wall bricks
  fill(P.wall, 0, 0, W, H);
  for (let row = 0; row * 8 < H; row++) {
    const y = row * 8, off = row % 2 ? 8 : 0;
    for (let bx = -16 + off; bx < W; bx += 16) {
      fill(vary(P.brick, 8), bx, y, 15, 7);
      fill(P.mortar, bx, y + 7, 16, 1);
      fill(P.mortar, bx + 15, y, 1, 8);
    }
  }
  // dark arches
  for (let ax = 40 + Math.floor(r() * 40); ax < W - 60; ax += 110 + Math.floor(r() * 60)) {
    fill(P.arch, ax, 60, 40, 52);
    x.fillStyle = P.arch;
    x.beginPath(); x.ellipse(ax + 20, 60, 20, 20, 0, Math.PI, 0); x.fill();
  }
  // ivy on walls
  for (let i = 0; i < room.w / 2; i++) {
    const ix = Math.floor(r() * W), iy = 20 + Math.floor(r() * 80);
    for (let k = 0; k < 6 + r() * 10; k++) fill(r() < 0.5 ? P.mossD : P.moss, ix + Math.round((r() * 2 - 1) * 5), iy + Math.round((r() * 2 - 1) * 3), 2, 1);
  }

  // stone tiles
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < room.w; tx++) {
    if (!solid[ty][tx]) continue;
    const px = tx * TILE, py = ty * TILE;
    fill(vary(P.stone, 5), px, py, TILE, TILE);
    fill(P.stoneL, px, py, TILE, 1); fill(P.stoneL, px, py, 1, TILE);
    fill(P.stoneD, px + 15, py, 1, TILE); fill(P.stoneD, px, py + 15, TILE, 1);
    if (r() < 0.35) { const cx = px + 3 + Math.floor(r() * 9), cy = py + 4 + Math.floor(r() * 8); fill(P.stoneD, cx, cy, 2, 1); fill(P.stoneD, cx + 2, cy + 1, 1, 1); }
    // mossy top where open air above
    if (ty > 0 && !solid[ty - 1][tx]) {
      for (let mx = px; mx < px + TILE; mx++) {
        fill(P.mossL, mx, py); fill(P.moss, mx, py + 1);
        if (r() < 0.6) fill(P.moss, mx, py + 2);
        if (r() < 0.2) fill(P.mossL, mx, py - 1);
      }
    }
  }

  // hanging greenery
  const vine = (vx, y0, len) => {
    const sway = r() < 0.5 ? -1 : 1;
    for (let i = 0; i < len; i++) {
      const xx = vx + (Math.floor(i / 4) % 2 ? sway : 0);
      fill(P.mossD, xx, y0 + i);
      if (i % 3 === 1) {
        const side = Math.floor(i / 3) % 2 ? 1 : -1;
        fill(P.leaf, xx + side, y0 + i);
        fill(P.moss, xx + side * 2, y0 + i - 1);
      }
    }
    fill(P.leaf, vx, y0 + len);
  };
  for (let vx = 2; vx < W; vx += 5 + Math.floor(r() * 3)) if (r() < 0.8) vine(vx, TILE, 6 + Math.floor(r() * 26));
  for (let cx = 0; cx < W; cx += 4) for (let k = 0; k < 1 + Math.floor(r() * 4); k++) fill(k < 2 ? P.moss : P.mossD, cx + Math.floor(r() * 4), TILE + k);
  for (const [a, b, row] of room.plats) {
    for (let vx = a * TILE + 1; vx < (b + 1) * TILE - 1; vx += 3) if (r() < 0.75) vine(vx, (row + 1) * TILE, 3 + Math.floor(r() * 12));
    vine(a * TILE - 1, row * TILE + 1, 6 + Math.floor(r() * 7));
    vine((b + 1) * TILE, row * TILE + 1, 6 + Math.floor(r() * 7));
  }
  // pit edges drape
  for (let tx = 1; tx < room.w - 1; tx++) {
    if (solid[7][tx] && !solid[7][tx + 1]) vine((tx + 1) * TILE, 7 * TILE + 1, 8 + Math.floor(r() * 10));
    if (solid[7][tx] && !solid[7][tx - 1]) vine(tx * TILE - 1, 7 * TILE + 1, 8 + Math.floor(r() * 10));
  }

  // props baked into the wall (torch sconces + mushrooms)
  const torches = [];
  const mush = mushCanvas();
  const torch = torchFrames().t0;
  for (const [type, tx, ty] of room.ents) {
    if (type === 'T') { const px = tx * TILE + 6, py = ty * TILE + 4; x.drawImage(torch, px, py); torches.push([px + 2, py + 2]); }
    if (type === 'm') x.drawImage(mush, tx * TILE + 3, (ty + 1) * TILE - 8);
  }

  // lighting
  const img = x.getImageData(0, 0, W, H);
  const d = img.data;
  const lightMap = new Float32Array(W * H * 3);
  const [lr, lg, lb] = hexToRgb(P.light).map(v => v / 255);
  const sources = torches.map(([sx, sy]) => [sx, sy, 92, 1.25]);
  for (const [type, tx, ty] of room.ents) if (type === 'm') sources.push([tx * TILE + 7, (ty + 1) * TILE - 5, 20, 0.5]);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    let R = P.ambient, Gc = P.ambient, B = P.ambient;
    for (const [sx, sy, rad, inten] of sources) {
      const dx = px - sx, dy = py - sy;
      if (Math.abs(dx) > rad || Math.abs(dy) > rad) continue;
      const f = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / rad);
      if (f <= 0) continue;
      const k = Math.pow(f, 1.6) * inten;
      R += k * lr; Gc += k * lg; B += k * lb;
    }
    R = Math.round(R * 10) / 10; Gc = Math.round(Gc * 10) / 10; B = Math.round(B * 10) / 10;
    const i = (py * W + px);
    lightMap[i * 3] = R; lightMap[i * 3 + 1] = Gc; lightMap[i * 3 + 2] = B;
    d[i * 4] = Math.min(255, d[i * 4] * R);
    d[i * 4 + 1] = Math.min(255, d[i * 4 + 1] * Gc);
    d[i * 4 + 2] = Math.min(255, d[i * 4 + 2] * B);
  }
  x.putImageData(img, 0, 0);
  // flames stay bright (emissive)
  for (const [sx, sy] of torches) x.drawImage(torch, 0, 0, 5, 5, sx - 2, sy - 2, 5, 5);

  const light = (px, py) => {
    px = Math.max(0, Math.min(W - 1, Math.round(px)));
    py = Math.max(0, Math.min(H - 1, Math.round(py)));
    const i = (py * W + px) * 3;
    return [lightMap[i], lightMap[i + 1], lightMap[i + 2]];
  };
  return { canvas: c, light, torches, solid };
}
