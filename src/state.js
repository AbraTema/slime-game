import { ROOMS } from './rooms.js';

// Persistent run state (survives room changes and respawns).
export const State = {
  reset() {
    this.maxHearts = 3;
    this.hearts = 3;
    this.crystals = 0;
    this.room = 0;
    this.spawn = null;           // {x, y} override for next room load
    this.checkpoint = { room: 0, x: null, y: null };
    this.defeated = new Set();   // enemy ids
    this.collected = new Set();  // placed crystal ids
    this.flags = new Set();      // activated flag ids
    this.hintShown = false;
    this.deaths = 0;
    this.bossDefeated = false;
  },

  get totalCrystals() {
    let n = 0;
    for (const r of ROOMS) for (const [t] of r.ents) {
      if (t === 'c' || t === 'g' || t === 'p') n += 1;
      if (t === 'v') n += 2;      // splits into 2 minis, 1 crystal each
      if (t === 'K') n += 6;      // king drops a golden shower
    }
    return n;
  },
};
State.reset();
