// Procedural pixel art: every sprite is drawn from tiny grids at runtime (no image files).
// Palette chars are mapped per sprite. '.' = transparent. Outline is added automatically.

export const INK = '#1a1420';
export const GEMS = ['#ff3b5c', '#ffd84a', '#5fe0ff', '#b6ff4a', '#ff4ef0', '#ff8a2a'];

export function hexToRgb(h) {
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d', { willReadFrequently: true });
  return c;
}

// Draw grid into a canvas of size (cw,ch) with grid top-left at (ox,oy), then 1px outline.
export function gridCanvas(rows, pal, opts = {}) {
  const gw = Math.max(...rows.map(r => r.length));
  const gh = rows.length;
  const cw = opts.w ?? gw + 2;
  const chh = opts.h ?? gh + 2;
  const ox = opts.ox ?? 1;
  const oy = opts.oy ?? 1;
  const c = makeCanvas(cw, chh);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const img = ctx.createImageData(cw, chh);
  const d = img.data;
  const set = (x, y, rgb, a = 255) => {
    if (x < 0 || y < 0 || x >= cw || y >= chh) return;
    const i = (y * cw + x) * 4;
    d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = a;
  };
  const cache = {};
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      set(ox + x, oy + y, cache[col] ??= hexToRgb(col), opts.alpha?.[ch] ?? 255);
    }
  });
  if (opts.outline !== false) {
    const ol = hexToRgb(opts.ol ?? INK);
    const olA = opts.olAlpha ?? 255;
    const alpha = new Uint8Array(cw * chh);
    for (let i = 0; i < cw * chh; i++) alpha[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
      if (alpha[y * cw + x]) continue;
      const n = (x > 0 && alpha[y * cw + x - 1]) || (x < cw - 1 && alpha[y * cw + x + 1]) ||
        (y > 0 && alpha[(y - 1) * cw + x]) || (y < chh - 1 && alpha[(y + 1) * cw + x]);
      if (n) set(x, y, ol, olA);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ------------------------------------------------------------------ knight (10 px tall)
// Grid column 3 is the body centre -> canvas x=12, so flipX keeps the body in place.
const HEAD = [
  '..pp',
  '.Lsss',
  '.Lsvw',
  '..dd',
];
const ARMS = [
  'caLsa.h...b.',
  'caLsagbbbb..',
  'c.BB..hee...',
];
const LEGS = {
  stand: ['..L.s', '..L.s', '..g.g'],
  run1: ['..L.s.', '.L...s', '.g...g'],
  run2: ['..Ls..', '..Ls..', '..gg..'],
  run3: ['..Ls..', '.L..s.', 'g...g.'],
  jump: ['..L.s', '..g.g', '.....'],
  fall: ['.L..s.', '.g...g', '......'],
};
const WINDUP = [
  '..pp.....b',
  '.Lsss...be',
  '.Lsvw..be.',
  '..dd..h...',
  'caLsag....',
  'caLs......',
  'c.BB......',
];
const STRIKE_ARMS = [
  'caLs....h....b',
  'caLsaaaghbbbbe',
  'c.BB....hee...',
];

export const KNIGHT_PAL = {
  p: '#ff3b30', L: '#ffffff', s: '#c3ccd8', d: '#7d8899', v: '#232032', w: '#7ff6ff',
  c: '#3d6fd6', h: '#ffd84a', b: '#ffffff', e: '#9fd4ff', B: '#8a5a2a', g: '#55607a', a: '#aab4c4',
};

export const KNIGHT_FRAME = { w: 24, h: 12, ox: 9, oy: 1 }; // grid col 3 -> x 12

function knightFrame(rows) {
  return gridCanvas(rows, KNIGHT_PAL, { w: KNIGHT_FRAME.w, h: KNIGHT_FRAME.h, ox: KNIGHT_FRAME.ox, oy: KNIGHT_FRAME.oy });
}

export function knightFrames() {
  const f = {};
  const body = (legs, arms = ARMS) => knightFrame([...HEAD, ...arms, ...LEGS[legs]]);
  for (const k of Object.keys(LEGS)) f[k === 'stand' ? 'idle' : k] = body(k);
  f.windup = knightFrame([...WINDUP, ...LEGS.stand]);
  f.strike = knightFrame([...HEAD, ...STRIKE_ARMS, ...LEGS.stand]);
  return f;
}

// ------------------------------------------------------------------ slimes
// acid colours; bodies are drawn semi-transparent (see SLIME_ALPHA)
export const SLIME_COLORS = {
  green: { x: '#8dff1c', L: '#efffb8', D: '#3fd400', ol: '#1f5a00', glow: 0x9dff2a },
  pink: { x: '#ff2ee6', L: '#ffd0fb', D: '#d000b8', ol: '#5a0050', glow: 0xff4ef0 },
  purple: { x: '#a43dff', L: '#ead2ff', D: '#7000ea', ol: '#33006e', glow: 0xb45cff },
  fire: { x: '#ff6a00', L: '#fff08a', D: '#e02800', ol: '#5a1000', glow: 0xff7a1a },
};
const SLIME_ALPHA = { x: 165, D: 205, L: 235, e: 255, m: 255 };
const SLIME = {
  normal: ['....x.....', '...xxxx...', '..xLxxxx..', '.xLxxxxxx.', '.xxexxexx.', 'xxxexxexxx', 'xxxxmmxxxx', 'DDDDDDDDDD'],
  squash: ['.....x......', '..xLxxxxxx..', '.xLxxxxxxxx.', 'xxxxexxexxxx', 'xxxxexxexxxx', 'xxxxxmmxxxxx', 'DDDDDDDDDDDD'],
  stretch: ['...x....', '..xxx...', '.xLxxx..', '.xLxxxx.', 'xLxxxxxx', 'xxexxexx', 'xxexxexx', 'xxxxxxxx', 'xxxmmxxx', 'DDDDDDDD'],
};
const MINI = {
  normal: ['..xx..', '.xLxx.', 'xexxex', 'DDDDDD'],
  squash: ['..xxxx..', 'xLexxexx', 'DDDDDDDD'],
  stretch: ['..x..', '.xLx.', 'xexex', 'xxxxx', 'DDDDD'],
};
export const SLIME_FRAME = { w: 14, h: 12 };
export const MINI_FRAME = { w: 10, h: 8 };

function bottomCentered(rows, pal, fw, fh, ol, extra = {}) {
  const gw = Math.max(...rows.map(r => r.length));
  const ox = Math.floor((fw - gw) / 2);
  const oy = fh - 1 - rows.length;
  return gridCanvas(rows, pal, { w: fw, h: fh, ox, oy, ol, ...extra });
}

export function slimeFrames(color, mini = false) {
  const c = SLIME_COLORS[color];
  const pal = { x: c.x, L: c.L, D: c.D, e: '#1b1022', m: '#1b1022' };
  const set = mini ? MINI : SLIME;
  const F = mini ? MINI_FRAME : SLIME_FRAME;
  return Object.fromEntries(Object.entries(set).map(([k, rows]) => [k, bottomCentered(rows, pal, F.w, F.h, c.ol, { alpha: SLIME_ALPHA, olAlpha: 220 })]));
}

// ------------------------------------------------------------------ king slime (procedural dome)
export const KING_FRAME = { w: 40, h: 32 };

function kingCanvas(W, H) {
  const F = KING_FRAME;
  const c = makeCanvas(F.w, F.h);
  const ctx = c.getContext('2d');
  const ox = Math.floor((F.w - W) / 2);
  const oy = F.h - 1 - H;
  const bands = ['#ffd84a', '#ffc23a', '#f5a524', '#d9801a'];
  const body = [];
  // dome = top half of an ellipse, flattened bottom
  const cx = (W - 1) / 2, ry = H - 4, rx = W / 2;
  for (let y = 0; y < H; y++) {
    body.push([]);
    for (let x = 0; x < W; x++) {
      const dy = (H - 1 - y) / (ry + 0.5), dx = (x - cx) / rx;
      body[y].push(y >= 4 && dx * dx + dy * dy <= 1.02);
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!body[y][x]) continue;
    const band = bands[Math.min(3, Math.floor(Math.max(0, y - 4) * 4 / Math.max(1, H - 4)))];
    ctx.fillStyle = band;
    ctx.fillRect(ox + x, oy + y, 1, 1);
  }
  const P = (x, y, col, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(ox + x, oy + y, w, h); };
  // highlight
  const top = body.findIndex(r => r.some(Boolean));
  P(Math.round(W * 0.18), top + 3, '#fff6d6', 2, 2);
  // crown
  const cxI = Math.round(cx);
  const crownY = top - 4;
  ctx.fillStyle = '#ffe066';
  ctx.fillRect(ox + cxI - 4, oy + crownY + 1, 9, 4);
  [[-4, 0], [-2, 1], [0, 0], [2, 1], [4, 0]].forEach(([dx, dy]) => P(cxI + dx, crownY + dy, '#ffe066'));
  P(cxI, crownY + 2, '#e2463f');
  P(cxI - 3, crownY + 3, '#3d6fd6');
  P(cxI + 3, crownY + 3, '#3fa76a');
  // face
  const ey = top + Math.max(3, Math.round((H - top) * 0.3));
  const eyeDx = Math.max(3, Math.round(W * 0.15));
  for (const ex of [cxI - eyeDx - 1, cxI + eyeDx]) {
    P(ex, ey, '#1b1022', 2, 3);
    P(ex, ey, '#ffffff');
  }
  P(cxI - eyeDx - 2, ey - 1, '#1b1022');
  P(cxI + eyeDx + 2, ey - 1, '#1b1022');
  P(cxI - 2, ey + 4, '#1b1022', 4, 1);
  // outline
  const img = ctx.getImageData(0, 0, F.w, F.h);
  const d = img.data;
  const a = (x, y) => x >= 0 && y >= 0 && x < F.w && y < F.h && d[(y * F.w + x) * 4 + 3] > 0;
  const ol = hexToRgb('#3a2010');
  const pts = [];
  for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) {
    if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) pts.push([x, y]);
  }
  pts.forEach(([x, y]) => { const i = (y * F.w + x) * 4; d[i] = ol[0]; d[i + 1] = ol[1]; d[i + 2] = ol[2]; d[i + 3] = 255; });
  ctx.putImageData(img, 0, 0);
  return c;
}

export function kingFrames() {
  return { normal: kingCanvas(30, 19), squash: kingCanvas(34, 15), stretch: kingCanvas(24, 23) };
}

// ------------------------------------------------------------------ props
export function crystalFrames(base, light, ol) {
  const pal = { x: base, L: light };
  return {
    c0: gridCanvas(['..x..', '.xLx.', 'xLxxx', '.xxx.', '..x..'], pal, { w: 7, h: 7, ol }),
    c1: gridCanvas(['.x.', 'xLx', 'xxx', 'xxx', '.x.'], pal, { w: 7, h: 7, ox: 2, ol }),
  };
}

export function heartCanvas(full = true) {
  return gridCanvas(['.rr.rr.', 'rwrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
    { r: full ? '#ff4d5e' : '#5a3a44', w: full ? '#ffd0d6' : '#6a4a54' });
}

export function torchFrames() {
  const pal = { o: '#ff8a1e', y: '#ffe27a', w: '#fffbe0', m: '#8a8f99', t: '#6b4a2a' };
  return {
    t0: gridCanvas(['.o.', 'oyo', 'oyo', '.w.', 'mmm', '.t.', '.t.', '.t.'], pal),
    t1: gridCanvas(['o..', '.yo', 'oyo', '.w.', 'mmm', '.t.', '.t.', '.t.'], pal),
  };
}

export function flagFrames() {
  const pal = { p: '#c9a46a', f: '#3d6fd6', F: '#6d97f0', g: '#6b6470', k: '#7a5a3a' };
  const pole = ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'kk'];
  const down = ['p....', 'p....', 'p....', 'p....', 'p....', 'pg...', 'pgg..', 'pgg..', 'pg...', 'p....', 'p....', 'kk...'];
  const up1 = ['pfff.', 'pFfff', 'pffff', 'pff..', ...pole.slice(4).map(s => s.padEnd(5, '.'))];
  const up2 = ['pff..', 'pFfff', 'pfff.', 'pfff.', ...pole.slice(4).map(s => s.padEnd(5, '.'))];
  return { down: gridCanvas(down, pal), up1: gridCanvas(up1, pal), up2: gridCanvas(up2, pal) };
}

export function mushCanvas(cap = '#ff9e4a', spot = '#ffe2b8') {
  return gridCanvas(['.ccc....', 'ccwcc...', 'ccccc.cc', '..s..cwc', '..s...s.', '..s...s.'], { c: cap, w: spot, s: '#efe2c8' });
}

export function doorFrames() {
  // 16x28 arched wooden door
  const W = 16, H = 28;
  const draw = (open) => {
    const c = makeCanvas(W + 2, H + 2);
    const x = c.getContext('2d');
    const P = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px + 1, py + 1, w, h); };
    // stone arch frame
    P(0, 4, W, H - 4, '#5a4434');
    P(2, 2, W - 4, 2, '#5a4434');
    P(4, 0, W - 8, 2, '#5a4434');
    // opening
    if (open) {
      P(2, 5, W - 4, H - 5, '#120a06');
      P(4, 3, W - 8, 2, '#120a06');
      P(3, H - 6, W - 6, 6, '#2a160c');
      P(5, H - 3, W - 10, 3, '#ffb35c');
    } else {
      P(2, 5, W - 4, H - 5, '#8a5a32');
      P(4, 3, W - 8, 2, '#8a5a32');
      for (const px of [5, 8, 11]) P(px, 4, 1, H - 4, '#6a4224');
      P(2, 9, W - 4, 2, '#4a4650');
      P(2, H - 8, W - 4, 2, '#4a4650');
      P(10, 15, 2, 3, '#f2c14e');
      P(3, 5, 1, H - 6, '#a87444');
    }
    // outline
    const img = x.getImageData(0, 0, W + 2, H + 2), d = img.data, CW = W + 2, CH = H + 2;
    const a = (px, py) => px >= 0 && py >= 0 && px < CW && py < CH && d[(py * CW + px) * 4 + 3] > 0;
    const pts = [];
    for (let py = 0; py < CH; py++) for (let px = 0; px < CW; px++)
      if (!a(px, py) && (a(px - 1, py) || a(px + 1, py) || a(px, py - 1) || a(px, py + 1))) pts.push([px, py]);
    pts.forEach(([px, py]) => { const i = (py * CW + px) * 4; d[i] = 26; d[i + 1] = 20; d[i + 2] = 32; d[i + 3] = 255; });
    x.putImageData(img, 0, 0);
    return c;
  };
  return { closed: draw(false), open: draw(true) };
}

export function chestFrames() {
  const pal = { w: '#8a5a32', W: '#a87444', d: '#5a3a1e', g: '#ffd84a', G: '#fff2a0', k: '#1b1022', y: '#ffe27a' };
  return {
    closed: gridCanvas([
      '.wwwwwwwwwwww.', 'wWWWWWWWWWWWWw', 'wwwwwwwwwwwwww', 'gggggggGgggggg',
      'wwwwwwgkgwwwww', 'wWwwwwgggwwwww', 'wwwwwwwwwwwwww', 'dddddddddddddd'], pal),
    open: gridCanvas([
      '.wwwwwwwwwwww.', 'wddddddddddddw', 'gggggggggggggg', 'gyyGyyyyGyyyyg',
      'wwwwwwgggwwwww', 'wWwwwwwwwwwwww', 'wwwwwwwwwwwwww', 'dddddddddddddd'], pal),
  };
}

export function waveCanvas() {
  return gridCanvas(['..yy..', '.yYYy.', 'yYwwYy', 'yYYYYy'], { y: '#f5a524', Y: '#ffd84a', w: '#fff6c0' }, { ol: '#3a2010' });
}

export function starCanvas(full) {
  return gridCanvas(['...s...', '..sSs..', 'sssSsss', '.sSSSs.', '.ss.ss.', 's.....s'],
    full ? { s: '#ffd84a', S: '#fff2a0' } : { s: '#4a3a3a', S: '#5a4848' });
}

export function speakerCanvas(on) {
  const pal = { w: '#fff3d6', r: '#ff6b6b' };
  return on
    ? gridCanvas(['..w....', '.ww..w.', 'www.w.w', 'www.w.w', '.ww..w.', '..w....'], pal)
    : gridCanvas(['..w....', '.ww.r.r', 'www..r.', 'www.r.r', '.ww....', '..w....'], pal);
}

export function glowCanvas(size = 64, color = [255, 179, 92]) {
  const c = makeCanvas(size, size);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${color},0.9)`);
  g.addColorStop(0.4, `rgba(${color},0.35)`);
  g.addColorStop(1, `rgba(${color},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return c;
}

export function pixelCanvas(col = '#ffffff', s = 1) {
  const c = makeCanvas(s, s);
  const x = c.getContext('2d');
  x.fillStyle = col;
  x.fillRect(0, 0, s, s);
  return c;
}

export function slashCanvas() {
  // crescent swoosh, 16x12
  const c = makeCanvas(16, 12);
  const x = c.getContext('2d');
  for (let a = -70; a <= 60; a += 3) {
    const r = (a + 70) / 130;
    for (let t = 0; t < 2; t++) {
      const rad = 9 - t;
      const px = Math.round(3 + Math.cos(a * Math.PI / 180) * rad);
      const py = Math.round(6 + Math.sin(a * Math.PI / 180) * rad * 0.7);
      x.fillStyle = t === 0 ? `rgba(255,255,255,${0.95 * (0.4 + r * 0.6)})` : `rgba(160,220,255,${0.6 * r})`;
      x.fillRect(px, py, 1, 1);
    }
  }
  return c;
}

export function registerCanvas(scene, key, canvas) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

// ------------------------------------------------------------------ level-2 / moving things
export function fireballFrames() {
  const pal = { o: '#ff5a00', y: '#ffd23a', w: '#fffbe0' };
  const opt = { w: 9, h: 9, ox: 2, oy: 2, ol: '#5a1000' };
  return {
    f0: gridCanvas(['..o..', '.oyo.', 'oywyo', '.oyo.', '..o..'], pal, opt),
    f1: gridCanvas(['.o.o.', 'oyyo.', 'oywyo', '.oyyo', '.o.o.'], pal, opt),
  };
}

export function lanternCanvas(glass = '#ffcf5a', core = '#fff6d0') {
  return gridCanvas(['..k..', '.kkk.', 'kyyyk', 'kywyk', 'kyyyk', '.kkk.'], { k: '#3a3446', y: glass, w: core });
}

export function waterCanvas() {
  // 8x16 tileable falling-water strip (scrolls vertically in game)
  const c = makeCanvas(8, 16);
  const x = c.getContext('2d');
  const cols = ['rgba(140,230,255,0.55)', 'rgba(90,190,255,0.45)', 'rgba(220,250,255,0.75)'];
  for (let px = 0; px < 8; px++) for (let py = 0; py < 16; py++) {
    const k = (px * 5 + py * 3 + (px % 3) * 7) % 11;
    x.fillStyle = k < 2 ? cols[2] : k < 6 ? cols[0] : cols[1];
    x.fillRect(px, py, 1, 1);
  }
  return c;
}

export function pennantCanvas(color) {
  return gridCanvas(['xxxxx', 'xLxxx', '.xxx.', '.xx..', '..x..'], { x: color, L: '#ffffff' }, { ol: '#1a1420' });
}

export function bannerCanvas(color, trim = '#ffd84a') {
  return gridCanvas([
    'ttttttt', 'xxxxxxx', 'xxxyxxx', 'xxyyyxx', 'xxxyxxx', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', 'tx.x.xt', 'x.....x',
  ], { t: trim, x: color, y: trim }, { ol: '#1a1420' });
}

export function hangCrystalCanvas(color) {
  return gridCanvas(['..k..', '..k..', '.xLx.', 'xxLxx', 'xLxxx', '.xxx.', '.xx..', '..x..'], { k: '#3a3446', x: color, L: '#ffffff' }, { ol: '#1a1420' });
}

export function chainCanvas(len) {
  const c = makeCanvas(1, len);
  const x = c.getContext('2d');
  for (let i = 0; i < len; i++) { x.fillStyle = i % 3 === 2 ? '#2a2433' : '#6a6478'; x.fillRect(0, i, 1, 1); }
  return c;
}

export function batFrames() {
  const pal = { k: '#2a1d2a', r: '#ff4a4a' };
  return {
    b0: gridCanvas(['k.....k', 'kk.k.kk', '.krkrk.', '..k.k..'], pal, { outline: false }),
    b1: gridCanvas(['.......', '..krk..', 'kkkkkkk', 'k.k.k.k'], pal, { outline: false }),
  };
}

export function moverCanvas() {
  // 32x8 wooden raft with iron bands and moss
  const W = 32, H = 8;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  const P = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  P(0, 0, W, H, '#1a1420');
  P(1, 1, W - 2, H - 2, '#8a5a32');
  for (let i = 4; i < W - 2; i += 6) P(i, 1, 1, H - 2, '#6a4224');
  P(1, 1, W - 2, 1, '#b6e05a');
  P(1, 2, W - 2, 1, '#7fb83a');
  P(3, 3, 2, 3, '#4a4650'); P(W - 5, 3, 2, 3, '#4a4650');
  P(1, H - 2, W - 2, 1, '#5a3a1e');
  return c;
}

export function rayCanvas(w = 40, h = 120) {
  // soft diagonal light shaft for ADD blending
  const c = makeCanvas(w + h / 2, h);
  const x = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const off = (h - y) / 2;
    const g = x.createLinearGradient(off, 0, off + w, 0);
    const a = 0.22 * (1 - y / h);
    g.addColorStop(0, 'rgba(255,200,120,0)');
    g.addColorStop(0.5, `rgba(255,200,120,${a})`);
    g.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = g;
    x.fillRect(off, y, w, 1);
  }
  return c;
}

export function sparkCanvas() {
  return gridCanvas(['.w.', 'www', '.w.'], { w: '#ffffff' }, { outline: false });
}
