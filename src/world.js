// Parses ASCII room maps and bakes each room into lit background layers.
import { hexToRgb, torchFrames, mushCanvas } from './art.js';
import { LEVELS } from './levels.js';

export const TILE = 16;
export const VIEW_W = 256;
export const VIEW_H = 144;
export const PARALLAX = 0.5;
export const PILLAR = 6; // visible width of the side walls in open rooms

export const PALETTE = {
  wall: '#3a2a22', brick: '#4e3a2d', mortar: '#2a1d17', stone: '#6a5243', stoneL: '#8a6e58',
  stoneD: '#47362c', moss: '#7fb83a', mossL: '#b6e05a', mossD: '#4f7d24', leaf: '#9ad84a',
  ambient: 0.5, light: '#ffb35c',
};

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function getRoom(level, room) { return LEVELS[level].rooms[room]; }

/** Parse a room map into a solid grid (0 air, 1 stone, 2 one-way) and entity list. */
export function parseRoom(room) {
  const rows = room.map.length, cols = room.map[0].length;
  const solid = [];
  const ents = [];
  room.map.forEach((line, y) => {
    solid.push([]);
    for (let x = 0; x < cols; x++) {
      const ch = line[x];
      solid[y].push(ch === '#' ? 1 : ch === '=' ? 2 : 0);
      if (ch !== '#' && ch !== '=' && ch !== '.') ents.push([ch, x, y]);
    }
  });
  return { rows, cols, W: cols * TILE, H: rows * TILE, solid, ents };
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

const cache = new Map();
export function getBaked(level, room) {
  const key = `${level}-${room}`;
  if (!cache.has(key)) cache.set(key, bakeRoom(getRoom(level, room), level * 10 + room));
  return cache.get(key);
}

/** Distant cave layer, seen through arches / the open tower (scrolls at PARALLAX speed).
 *  Returns the canvas plus positions of waterfalls and glowing crystals for animated overlays. */
const SKIES = {
  warm: { top: '#160b18', mid: '#2a1430', bot: '#4a2418', pillar: '#2e1a26', rim: '#5a2e3a' },
  crystal: { top: '#0a0a24', mid: '#1c0f3a', bot: '#0f3a3a', pillar: '#1a1638', rim: '#3a3a7a' },
};
const GEM = ['#5fe0ff', '#ff4ef0', '#b6ff4a', '#ffd84a', '#ff7a3a', '#a66bff'];

function shade(hex, k) {
  const v = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(v >> 16)},${f((v >> 8) & 255)},${f(v & 255)})`;
}

/** Little cluster of pointed crystal shards growing out of a rock lump. */
export function shardCluster(x, cx, cy, col, n, r, rock = '#2a1d17') {
  x.fillStyle = rock;
  x.fillRect(cx - n - 1, cy, n * 2 + 3, 2);
  x.fillRect(cx - n, cy + 2, n * 2 + 1, 1);
  for (let k = 0; k < n; k++) {
    const h = 3 + Math.floor(r() * 5), sx = cx - n + k * 2 + (k % 2);
    const lean = k === 0 ? -1 : k === n - 1 ? 1 : 0;
    for (let i = 0; i < h; i++) {
      const xx = sx + (i > h / 2 ? lean : 0);
      x.fillStyle = shade(col, 0.75); x.fillRect(xx + 1, cy - i, 1, 1);
      x.fillStyle = col; x.fillRect(xx, cy - i, 1, 1);
    }
    x.fillStyle = '#ffffff'; x.fillRect(sx + (h > 2 ? lean : 0), cy - h, 1, 1);
  }
}

function bakeFar(W, H, seed, sky = 'warm') {
  const r = rng(seed * 31 + 7);
  const S = SKIES[sky] ?? SKIES.warm;
  const fw = Math.ceil((W - VIEW_W) * PARALLAX + VIEW_W) + 2;
  const fh = Math.ceil((H - VIEW_H) * PARALLAX + VIEW_H) + 2;
  const c = document.createElement('canvas');
  c.width = fw; c.height = fh;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, fh);
  g.addColorStop(0, S.top); g.addColorStop(0.55, S.mid); g.addColorStop(1, S.bot);
  x.fillStyle = g;
  x.fillRect(0, 0, fw, fh);

  // big soft colour clouds
  for (let i = 0; i < Math.ceil(fw * fh / 6000); i++) {
    const cx = r() * fw, cy = r() * fh, rad = 20 + r() * 40, col = GEM[Math.floor(r() * GEM.length)];
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    rg.addColorStop(0, col + '30'); rg.addColorStop(1, col + '00');
    x.fillStyle = rg; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  // pillars with coloured rim light
  for (let px = Math.floor(r() * 30); px < fw; px += 30 + Math.floor(r() * 34)) {
    const w = 7 + Math.floor(r() * 9);
    x.fillStyle = S.pillar; x.fillRect(px, 0, w, fh);
    x.fillStyle = S.rim; x.fillRect(px, 0, 1, fh);
    for (let y = Math.floor(r() * 12); y < fh; y += 12) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px, y, w, 1); }
  }
  // stalactites + hanging roots
  for (let sx = 0; sx < fw; sx += 3 + Math.floor(r() * 5)) {
    const len = 3 + Math.floor(r() * 16);
    for (let i = 0; i < len; i++) { x.fillStyle = 'rgba(8,4,12,0.9)'; x.fillRect(sx, i, Math.max(1, Math.round(3 * (1 - i / len))), 1); }
  }
  // crystal clusters on little rock outcrops
  const crystals = [];
  for (let i = 0; i < Math.ceil(fw * fh / 3500); i++) {
    const cx = Math.floor(r() * fw), cy = Math.floor(r() * fh), col = GEM[Math.floor(r() * GEM.length)];
    shardCluster(x, cx, cy, col, 2 + Math.floor(r() * 3), r, '#140a14');
    crystals.push({ x: cx, y: cy - 3, color: parseInt(col.slice(1), 16) });
  }
  // waterfalls (animated in-game) with a pool glow
  const waterfalls = [];
  const nW = Math.max(1, Math.round(fw * fh / 40000));
  for (let i = 0; i < nW; i++) {
    const wx = 10 + Math.floor(r() * (fw - 30)), wy = Math.floor(r() * fh * 0.3), wh = Math.min(fh - wy, 60 + Math.floor(r() * 120)), ww = 4 + Math.floor(r() * 5);
    waterfalls.push({ x: wx, y: wy, w: ww, h: wh });
    const pg = x.createRadialGradient(wx + ww / 2, wy + wh, 0, wx + ww / 2, wy + wh, 18);
    pg.addColorStop(0, 'rgba(120,220,255,0.35)'); pg.addColorStop(1, 'rgba(120,220,255,0)');
    x.fillStyle = pg; x.fillRect(wx - 18, wy + wh - 18, ww + 36, 36);
  }
  return { canvas: c, crystals, waterfalls };
}

/** Bake the room: wall + tiles + greenery + props + lighting. Arches are see-through to the far layer. */
export function bakeRoom(room, seed) {
  const P = PALETTE;
  const { solid, ents, cols, rows, W, H } = parseRoom(room);
  const r = rng(1000 + seed * 77);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  const fill = (col, px, py, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const vary = (hex, v) => {
    const [R, G, B] = hexToRgb(hex);
    const k = Math.round((r() * 2 - 1) * v);
    return `rgb(${Math.max(0, R + k)},${Math.max(0, G + k)},${Math.max(0, B + k)})`;
  };
  const isS = (tx, ty) => ty >= 0 && ty < rows && tx >= 0 && tx < cols && solid[ty][tx] > 0;
  const open = !!room.open;
  // in open rooms the side walls are drawn as thin pillars (collision is trimmed to match)
  const isPillar = (tx, ty) => open && (tx === 0 || tx === cols - 1) && ty > 0 && ty < rows - 2;

  // back wall bricks (open rooms have no back wall)
  if (!open) fill(P.wall, 0, 0, W, H);
  for (let row = 0; !open && row * 8 < H; row++) {
    const y = row * 8, off = row % 2 ? 8 : 0;
    for (let bx = -16 + off; bx < W; bx += 16) {
      fill(vary(P.brick, 8), bx, y, 15, 7);
      fill(P.mortar, bx, y + 7, 16, 1);
      fill(P.mortar, bx + 15, y, 1, 8);
    }
  }

  // see-through arches/windows where there is open air
  const arches = [];
  const tries = open ? 0 : Math.ceil(cols * rows / 3);
  for (let i = 0; i < tries; i++) {
    const aw = 2 + Math.floor(r() * 2), ah = 3 + Math.floor(r() * 3);
    const tx = 1 + Math.floor(r() * (cols - aw - 2)), ty = 1 + Math.floor(r() * (rows - ah - 2));
    let ok = true;
    for (let yy = ty - 1; yy <= ty + ah && ok; yy++) for (let xx = tx - 1; xx <= tx + aw && ok; xx++) if (isS(xx, yy)) ok = false;
    for (const a of arches) if (Math.abs(a.tx - tx) < aw + 3 && Math.abs(a.ty - ty) < ah + 2) ok = false;
    if (!ok) continue;
    arches.push({ tx, ty, aw, ah });
    const px = tx * TILE + 2, py = ty * TILE, w = aw * TILE - 4, hh = ah * TILE;
    // stone rim
    fill('#2a1d17', px - 2, py + w / 2 - 2, w + 4, hh - w / 2 + 2);
    x.fillStyle = '#2a1d17'; x.beginPath(); x.ellipse(px + w / 2, py + w / 2, w / 2 + 2, w / 2 + 2, 0, Math.PI, 0); x.fill();
    x.save();
    x.globalCompositeOperation = 'destination-out';
    x.fillRect(px, py + w / 2, w, hh - w / 2);
    x.beginPath(); x.ellipse(px + w / 2, py + w / 2, w / 2, w / 2, 0, Math.PI, 0); x.fill();
    x.restore();
    // sill
    fill(P.stoneL, px - 2, py + hh - 1, w + 4, 1);
    fill(P.stoneD, px - 2, py + hh, w + 4, 2);
  }

  // ivy on walls
  for (let i = 0; !open && i < cols * rows / 8; i++) {
    const ix = Math.floor(r() * W), iy = Math.floor(r() * H);
    for (let k = 0; k < 6 + r() * 10; k++) fill(r() < 0.5 ? P.mossD : P.moss, ix + Math.round((r() * 2 - 1) * 5), iy + Math.round((r() * 2 - 1) * 3), 2, 1);
  }

  // glowing crystal veins in the walls + spots for wall banners
  const wallGems = [];
  const wallSpots = [];
  const airAround = (tx, ty) => { for (let yy = ty - 1; yy <= ty + 1; yy++) for (let xx = tx - 1; xx <= tx + 1; xx++) if (isS(xx, yy)) return false; return true; };
  const inArch = (px, py) => arches.some(a => px >= a.tx * TILE - 4 && px <= (a.tx + a.aw) * TILE + 4 && py >= a.ty * TILE - 4 && py <= (a.ty + a.ah) * TILE + 4);
  if (!open) {
    for (let i = 0; i < cols * rows / 12; i++) {
      const tx = 1 + Math.floor(r() * (cols - 2)), ty = 1 + Math.floor(r() * (rows - 3));
      const px = tx * TILE + 8, py = ty * TILE + 10;
      if (!airAround(tx, ty) || inArch(px, py)) continue;
      const col = GEM[Math.floor(r() * GEM.length)];
      shardCluster(x, px, py, col, 2 + Math.floor(r() * 2), r);
      wallGems.push({ x: px, y: py - 3, color: parseInt(col.slice(1), 16) });
    }
    for (let i = 0; i < cols / 4; i++) {
      const tx = 1 + Math.floor(r() * (cols - 2)), ty = 2 + Math.floor(r() * Math.max(1, rows - 6));
      const px = tx * TILE + 8, py = ty * TILE + 2;
      if (!airAround(tx, ty) || !airAround(tx, ty + 1) || inArch(px, py) || inArch(px, py + 14)) continue;
      if (wallSpots.some(([sx, sy]) => Math.abs(sx - px) < 40 && Math.abs(sy - py) < 30)) continue;
      fill('#1a1420', px - 1, py - 2, 3, 2); // nail
      wallSpots.push([px, py]);
    }
  }

  // tiles
  for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
    const v = solid[ty][tx];
    if (!v) continue;
    const px = tx * TILE, py = ty * TILE;
    if (isPillar(tx, ty)) {
      const ox = tx === 0 ? TILE - PILLAR : 0;
      fill(vary(P.stone, 4), px + ox, py, PILLAR, TILE);
      fill(P.stoneL, px + ox + (tx === 0 ? PILLAR - 1 : 0), py, 1, TILE);
      fill(P.stoneD, px + ox + (tx === 0 ? 0 : PILLAR - 1), py, 1, TILE);
      fill(P.stoneD, px + ox, py + 15, PILLAR, 1);
      if (r() < 0.5) fill(P.moss, px + ox + Math.floor(r() * PILLAR), py + Math.floor(r() * 14), 1, 2);
      continue;
    }
    if (v === 2) {
      // one-way ledge: thinner wooden-stone shelf
      fill(vary(P.stone, 5), px, py, TILE, 7);
      fill(P.stoneL, px, py, TILE, 1);
      fill(P.stoneD, px, py + 6, TILE, 1);
      if (!isS(tx - 1, ty) || solid[ty][tx - 1] !== 2) fill(P.stoneD, px, py, 1, 7);
      fill('#2a1d17', px + 3, py + 7, 2, 2); fill('#2a1d17', px + 11, py + 7, 2, 2); // brackets
    } else {
      fill(vary(P.stone, 5), px, py, TILE, TILE);
      fill(P.stoneL, px, py, TILE, 1); fill(P.stoneL, px, py, 1, TILE);
      fill(P.stoneD, px + 15, py, 1, TILE); fill(P.stoneD, px, py + 15, TILE, 1);
      if (r() < 0.35) { const cx = px + 3 + Math.floor(r() * 9), cy = py + 4 + Math.floor(r() * 8); fill(P.stoneD, cx, cy, 2, 1); fill(P.stoneD, cx + 2, cy + 1, 1, 1); }
    }
    if (!isS(tx, ty - 1) || isPillar(tx, ty - 1)) {
      for (let mx = px; mx < px + TILE; mx++) {
        fill(P.mossL, mx, py); fill(P.moss, mx, py + 1);
        if (r() < 0.6) fill(P.moss, mx, py + 2);
        if (r() < 0.2) fill(P.mossL, mx, py - 1);
      }
    }
  }

  // hanging greenery: under every solid/ledge tile with air below
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
  const vineAnchors = [];
  const undersides = [];
  for (let ty = 0; ty < rows - 1; ty++) for (let tx = 0; tx < cols; tx++) {
    if (!solid[ty][tx] || isS(tx, ty + 1) || isPillar(tx, ty)) continue;
    if (!isS(tx, ty + 2) && !isS(tx, ty + 3)) undersides.push([tx * TILE + 8, solid[ty][tx] === 2 ? ty * TILE + 7 : (ty + 1) * TILE]);
    const top = ty === 0 || solid[ty][tx] === 1 ? (ty + 1) * TILE : ty * TILE + 8;
    const maxLen = ty === 0 ? 30 : 14;
    for (let vx = tx * TILE + 1; vx < (tx + 1) * TILE; vx += 3 + Math.floor(r() * 3)) {
      if (r() < 0.7) { const len = 3 + Math.floor(r() * maxLen); vine(vx, top, len); vineAnchors.push([vx, top + len]); }
    }
    if (ty === 0) for (let k = 0; k < TILE; k += 2) fill(P.moss, tx * TILE + k + Math.floor(r() * 2), TILE + Math.floor(r() * 2), 1, 1);
  }
  // open rooms: hanging bridges get chains up into the dark
  if (open) for (let ty = 1; ty < rows; ty++) for (let tx = 1; tx < cols - 1; tx++) {
    if (solid[ty][tx] !== 2) continue;
    const edgeL = solid[ty][tx - 1] !== 2, edgeR = solid[ty][tx + 1] !== 2;
    for (const [e, cx] of [[edgeL, tx * TILE + 2], [edgeR, tx * TILE + 13]]) {
      if (!e) continue;
      for (let i = 1; i < 40; i++) {
        if (isS(Math.floor(cx / TILE), Math.floor((ty * TILE - i) / TILE))) break;
        x.globalAlpha = 1 - i / 40;
        fill(i % 3 === 0 ? '#2a2433' : '#6a6478', cx, ty * TILE - i);
      }
      x.globalAlpha = 1;
    }
  }
  // ledges drape over their edges
  for (let ty = 1; ty < rows; ty++) for (let tx = 1; tx < cols - 1; tx++) {
    if (!solid[ty][tx]) continue;
    if (!isS(tx + 1, ty) && !isS(tx + 1, ty - 1)) vine((tx + 1) * TILE, ty * TILE + 1, 5 + Math.floor(r() * 9));
    if (!isS(tx - 1, ty) && !isS(tx - 1, ty - 1)) vine(tx * TILE - 1, ty * TILE + 1, 5 + Math.floor(r() * 9));
  }

  // props
  const torches = [];
  const MUSH_COLORS = [['#ff9e4a', '#ffe2b8', 0xffa040], ['#5fe0ff', '#d8f6ff', 0x5fe0ff], ['#ff4ef0', '#ffd0fb', 0xff4ef0], ['#b6ff4a', '#f0ffd0', 0xb6ff4a]];
  const mushImgs = MUSH_COLORS.map(([cap, spot]) => mushCanvas(cap, spot));
  const torch = torchFrames().t0;
  const mushrooms = [];
  const lanterns = [];
  for (const [type, tx, ty] of ents) {
    if (type === 'T') { const px = tx * TILE + 6, py = ty * TILE + 4; x.drawImage(torch, px, py); torches.push([px + 2, py + 2]); }
    if (type === 'm') {
      const k = (tx * 7 + ty * 3) % MUSH_COLORS.length;
      const px = tx * TILE + 3, py = (ty + 1) * TILE - 8;
      x.drawImage(mushImgs[k], px, py);
      mushrooms.push([px + 4, py + 3, MUSH_COLORS[k][2]]);
    }
    if (type === 'L') {
      let ay = ty; while (ay > 0 && !isS(tx, ay - 1)) ay--;
      lanterns.push({ x: tx * TILE + 8, top: ay * TILE - (solid[ay - 1]?.[tx] === 2 ? 8 : 0), y: ty * TILE + 10 });
    }
  }

  // lighting (static sources baked; lanterns baked at rest + dynamic glow in-game)
  const img = x.getImageData(0, 0, W, H);
  const d = img.data;
  const lightMap = new Float32Array(W * H * 3);
  const [lr, lg, lb] = hexToRgb(P.light).map(v => v / 255);
  const sources = torches.map(([sx, sy]) => [sx, sy, 92, 1.25]);
  mushrooms.forEach(([sx, sy]) => sources.push([sx, sy, 20, 0.55]));
  if (open) undersides.forEach(([ux, uy], i) => { if (i % 3 === 0) sources.push([ux, uy + 10, 40, 0.5]); });
  wallGems.forEach(g => sources.push([g.x, g.y, 26, 0.45]));
  lanterns.forEach(l => sources.push([l.x, l.y, 70, 0.9]));
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    let R = P.ambient, Gc = P.ambient, B = P.ambient;
    for (const [sx, sy, rad, inten] of sources) {
      const dx = px - sx, dy = py - sy;
      if (dx > rad || dx < -rad || dy > rad || dy < -rad) continue;
      const f = 1 - Math.sqrt(dx * dx + dy * dy) / rad;
      if (f <= 0) continue;
      const k = Math.pow(f, 1.6) * inten;
      R += k * lr; Gc += k * lg; B += k * lb;
    }
    R = Math.round(R * 10) / 10; Gc = Math.round(Gc * 10) / 10; B = Math.round(B * 10) / 10;
    const i = py * W + px;
    lightMap[i * 3] = R; lightMap[i * 3 + 1] = Gc; lightMap[i * 3 + 2] = B;
    if (d[i * 4 + 3] === 0) continue;
    d[i * 4] = Math.min(255, d[i * 4] * R);
    d[i * 4 + 1] = Math.min(255, d[i * 4 + 1] * Gc);
    d[i * 4 + 2] = Math.min(255, d[i * 4 + 2] * B);
  }
  x.putImageData(img, 0, 0);
  for (const [sx, sy] of torches) x.drawImage(torch, 0, 0, 5, 5, sx - 2, sy - 2, 5, 5);

  const light = (px, py) => {
    px = Math.max(0, Math.min(W - 1, Math.round(px)));
    py = Math.max(0, Math.min(H - 1, Math.round(py)));
    const i = (py * W + px) * 3;
    return [lightMap[i], lightMap[i + 1], lightMap[i + 2]];
  };
  const far = bakeFar(W, H, seed, room.open ? 'crystal' : 'warm');
  return {
    canvas: c, far: far.canvas, farCrystals: far.crystals, waterfalls: far.waterfalls, light, torches, mushrooms, lanterns,
    arches, vineAnchors, undersides, wallGems, wallSpots, open, solid, ents, cols, rows, W, H,
  };
}
