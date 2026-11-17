import { LEVELS } from './levels.js';

const STARS_KEY = 'slime_stars_v1';

// Persistent run state (survives room changes and respawns).
export const State = {
  reset(level = this.level ?? 0) {
    this.level = level;
    this.maxHearts = 3;
    this.hearts = 3;
    this.crystals = 0;
    this.room = 0;
    this.spawn = null;           // {x, y} override for next room load
    this.checkpoint = { room: 0, x: null, y: null };
    this.defeated = new Set();   // enemy ids
    this.collected = new Set();  // placed crystal / heart ids
    this.flags = new Set();      // activated flag ids
    this.hintShown = false;
    this.deaths = 0;
    this.bossDefeated = false;
  },

  get levelData() { return LEVELS[this.level]; },

  get totalCrystals() {
    let n = 0;
    for (const r of LEVELS[this.level].rooms) for (const line of r.map) for (const t of line) {
      if (t === 'c' || t === 'g' || t === 'p' || t === 'f') n += 1;
      if (t === 'v') n += 2;      // splits into 2 minis, 1 crystal each
      if (t === 'K') n += 6;      // king drops a golden shower
    }
    return n;
  },

  stars() {
    try { return JSON.parse(localStorage.getItem(STARS_KEY) || '{}'); } catch (e) { return {}; }
  },

  saveStars(level, n) {
    const s = this.stars();
    s[level] = Math.max(s[level] || 0, n);
    try { localStorage.setItem(STARS_KEY, JSON.stringify(s)); } catch (e) { /* storage blocked */ }
  },
};
State.reset(0);
