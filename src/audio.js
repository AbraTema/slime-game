// Tiny chiptune engine on Web Audio: music + SFX are synthesised, nothing to download.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// note names -> midi
const N = {};
['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((name, i) => {
  for (let o = 1; o < 8; o++) N[name + o] = 12 * (o + 1) + i;
});

// Each track: bpm, steps per bar 8 (eighth notes), patterns of [lead, bass, arp] per step ('-' = rest)
const TRACKS = {
  dungeon: {
    bpm: 122,
    drums: 'groove',
    lead: ('E5 - G5 - A5 - G5 E5 | D5 - - - C5 - D5 - | E5 - G5 - A5 - C6 B5 | A5 - - - - - - - |' +
      'G5 - E5 - D5 - E5 G5 | A5 - G5 - E5 - D5 - | C5 - D5 - E5 - G5 - | E5 - - - - - - - ').split(/[\s|]+/).filter(Boolean),
    bass: ('C3 - - - G2 - - - | A2 - - - E2 - - - | F2 - - - C3 - - - | G2 - - - G2 - - - |' +
      'C3 - - - G2 - - - | A2 - - - E2 - - - | F2 - - - G2 - - - | C3 - - - - - - - ').split(/[\s|]+/).filter(Boolean),
    arp: [['C4', 'E4', 'G4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'],
      ['C4', 'E4', 'G4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['C4', 'E4', 'G4']],
  },
  tower: {
    bpm: 138,
    drums: 'drive',
    lead: ('D5 - F5 - A5 - F5 - | C5 - E5 - G5 - E5 - | A#4 - D5 - F5 - A5 - | A5 - G5 - E5 - C5 - |' +
      'D5 - A5 - D6 - A5 - | C6 - A5 - G5 - E5 - | F5 - E5 - D5 - C5 - | D5 - - - - - - - ').split(/[\s|]+/).filter(Boolean),
    bass: ('D3 - - D3 A2 - - - | C3 - - C3 G2 - - - | A#2 - - A#2 F2 - - - | A2 - - A2 E2 - - - |' +
      'D3 - - D3 A2 - - - | C3 - - C3 G2 - - - | A#2 - - - A2 - - - | D3 - - - D3 - - - ').split(/[\s|]+/).filter(Boolean),
    arp: [['D4', 'F4', 'A4'], ['C4', 'E4', 'G4'], ['A#3', 'D4', 'F4'], ['A3', 'C#4', 'E4'],
      ['D4', 'F4', 'A4'], ['C4', 'E4', 'G4'], ['A#3', 'D4', 'F4'], ['D4', 'F4', 'A4']],
  },
  boss: {
    bpm: 150,
    drums: 'drive',
    lead: ('A4 - C5 - E5 - C5 - | G4 - B4 - D5 - B4 - | F4 - A4 - C5 - A4 - | E4 - G#4 - B4 - E5 - |' +
      'A4 A4 C5 - E5 - A5 - | G5 - E5 - D5 - B4 - | C5 - D5 - E5 - F5 - | E5 - - - E4 - - - ').split(/[\s|]+/).filter(Boolean),
    bass: ('A2 - A2 - A2 - A2 - | G2 - G2 - G2 - G2 - | F2 - F2 - F2 - F2 - | E2 - E2 - E2 - E2 - |' +
      'A2 - A2 - A2 - A2 - | G2 - G2 - G2 - G2 - | F2 - F2 - G2 - G2 - | E2 - E2 - E2 - E2 - ').split(/[\s|]+/).filter(Boolean),
    arp: [['A3', 'C4', 'E4'], ['G3', 'B3', 'D4'], ['F3', 'A3', 'C4'], ['E3', 'G#3', 'B3'],
      ['A3', 'C4', 'E4'], ['G3', 'B3', 'D4'], ['F3', 'A3', 'C4'], ['E3', 'G#3', 'B3']],
  },
};

class Chip {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.track = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.suspendedBy = new Set();
    try { this.muted = localStorage.getItem('slime_muted') === '1'; } catch (e) { /* storage blocked */ }
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.32;
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.55;
      this.sfxBus.connect(this.master);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended' && this.suspendedBy.size === 0) this.ctx.resume();
  }

  // external pause reasons: 'hidden', 'pause', 'sdk'
  suspend(reason) {
    this.suspendedBy.add(reason);
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume(reason) {
    this.suspendedBy.delete(reason);
    if (this.ctx && this.suspendedBy.size === 0 && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('slime_muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.02);
  }

  tone({ freq, type = 'square', dur = 0.1, vol = 0.3, slide = 0, at = 0, bus = 'sfx', attack = 0.005 }) {
    if (!this.ctx) return;
    const t = (at || this.ctx.currentTime);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus === 'music' ? this.musicBus : this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseHit({ dur = 0.12, vol = 0.3, freq = 1200, q = 1, at = 0, type = 'bandpass', bus = 'sfx' }) {
    if (!this.ctx) return;
    const t = at || this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus === 'music' ? this.musicBus : this.sfxBus);
    s.start(t); s.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------ music
  play(name) {
    if (!this.ctx || this.track === TRACKS[name]) return;
    this.track = TRACKS[name];
    this.step = 0;
    this.lastBass = null;
    this.nextTime = this.ctx.currentTime + 0.08;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    this.track = null;
    clearInterval(this.timer);
    this.timer = null;
  }

  kick(t, vol = 0.5) {
    this.tone({ freq: 140, slide: 0.32, dur: 0.14, vol, type: 'sine', at: t, bus: 'music', attack: 0.002 });
  }

  snare(t, vol = 0.22) {
    this.noiseHit({ dur: 0.12, vol, freq: 2200, q: 0.6, at: t, type: 'highpass', bus: 'music' });
    this.tone({ freq: 190, slide: 0.6, dur: 0.07, vol: vol * 0.5, type: 'triangle', at: t, bus: 'music' });
  }

  hat(t, vol = 0.05) { this.noiseHit({ dur: 0.03, vol, freq: 8000, at: t, type: 'highpass', bus: 'music' }); }

  schedule() {
    if (!this.ctx || !this.track || this.ctx.state !== 'running') return;
    const tr = this.track;
    const stepDur = 60 / tr.bpm / 2;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const i = this.step % tr.lead.length;
      const t = this.nextTime;
      const lead = tr.lead[i];
      if (lead && lead !== '-') {
        let len = 1;
        while (tr.lead[(i + len) % tr.lead.length] === '-' && len < 4) len++;
        this.tone({ freq: NOTE(N[lead]), type: 'square', dur: stepDur * len * 0.85, vol: 0.085, at: t, bus: 'music', attack: 0.008 });
        this.tone({ freq: NOTE(N[lead]) * 1.005, type: 'triangle', dur: stepDur * len * 0.85, vol: 0.06, at: t, bus: 'music', attack: 0.008 });
      }
      // pulsing octave bass on every eighth
      const bass = tr.bass[i];
      if (bass && bass !== '-') this.lastBass = bass;
      if (this.lastBass) {
        const f = NOTE(N[this.lastBass]) * (i % 2 ? 2 : 1);
        this.tone({ freq: f, type: 'triangle', dur: stepDur * 0.9, vol: 0.2, at: t, bus: 'music' });
        this.tone({ freq: f, type: 'square', dur: stepDur * 0.5, vol: 0.03, at: t, bus: 'music' });
      }
      // sparkly arpeggio
      const chord = tr.arp[Math.floor(i / 8) % tr.arp.length];
      const an = chord[this.step % chord.length];
      this.tone({ freq: NOTE(N[an]) * 2, type: 'square', dur: stepDur * 0.45, vol: 0.028, at: t, bus: 'music' });
      // drums
      const b = i % 8;
      if (tr.drums === 'groove') {
        if (b === 0 || b === 3 || b === 5) this.kick(t, b === 0 ? 0.45 : 0.3);
        if (b === 4) this.snare(t);
        this.hat(t, b % 2 ? 0.05 : 0.025);
      } else if (tr.drums === 'drive') {
        if (b % 2 === 0) this.kick(t, b === 0 ? 0.5 : 0.35);
        if (b === 2 || b === 6) this.snare(t, 0.2);
        this.hat(t, b % 2 ? 0.06 : 0.03);
        if (i % 32 === 30 || i % 32 === 31) this.snare(t + stepDur / 2, 0.12);
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }

  // ------------------------------------------------------------ sfx
  sfx(name) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'jump': this.tone({ freq: 260, slide: 2.2, dur: 0.12, vol: 0.18 }); break;
      case 'slash': this.noiseHit({ dur: 0.09, vol: 0.25, freq: 3200, q: 0.8 }); this.tone({ freq: 900, slide: 0.5, dur: 0.07, vol: 0.06, type: 'sawtooth' }); break;
      case 'pop':
        this.tone({ freq: 520, slide: 2.5, dur: 0.08, vol: 0.22, type: 'sine' });
        this.tone({ freq: 880, slide: 0.4, dur: 0.12, vol: 0.12, type: 'triangle', at: t + 0.05 });
        break;
      case 'split': this.tone({ freq: 400, slide: 1.8, dur: 0.1, vol: 0.2, type: 'sine' }); this.tone({ freq: 600, slide: 1.8, dur: 0.1, vol: 0.15, type: 'sine', at: t + 0.06 }); break;
      case 'crystal':
        this.tone({ freq: NOTE(N.E6), dur: 0.08, vol: 0.12, type: 'triangle' });
        this.tone({ freq: NOTE(N.B6), dur: 0.14, vol: 0.12, type: 'triangle', at: t + 0.06 });
        break;
      case 'heart':
        [N.C5, N.E5, N.G5, N.C6].forEach((n, k) => this.tone({ freq: NOTE(n), dur: 0.1, vol: 0.12, type: 'triangle', at: t + k * 0.06 }));
        break;
      case 'hurt': this.tone({ freq: 330, slide: 0.4, dur: 0.25, vol: 0.2, type: 'square' }); break;
      case 'land': this.noiseHit({ dur: 0.05, vol: 0.08, freq: 400, q: 0.7 }); break;
      case 'checkpoint':
        [N.G4, N.C5, N.E5, N.G5].forEach((n, k) => this.tone({ freq: NOTE(n), dur: 0.12, vol: 0.13, type: 'square', at: t + k * 0.08 }));
        break;
      case 'door': this.tone({ freq: 110, slide: 0.7, dur: 0.35, vol: 0.2, type: 'triangle' }); this.noiseHit({ dur: 0.3, vol: 0.08, freq: 300 }); break;
      case 'bossLand': this.noiseHit({ dur: 0.35, vol: 0.5, freq: 160, q: 0.6, type: 'lowpass' }); this.tone({ freq: 70, slide: 0.5, dur: 0.3, vol: 0.35, type: 'sine' }); break;
      case 'bossHit': this.tone({ freq: 200, slide: 0.6, dur: 0.15, vol: 0.25, type: 'square' }); this.noiseHit({ dur: 0.08, vol: 0.2, freq: 2000 }); break;
      case 'fall': this.tone({ freq: 600, slide: 0.25, dur: 0.4, vol: 0.15, type: 'triangle' }); break;
      case 'clink':
        this.tone({ freq: 1800, dur: 0.06, vol: 0.14, type: 'square' });
        this.tone({ freq: 2400, slide: 0.8, dur: 0.12, vol: 0.1, type: 'triangle', at: t + 0.03 });
        break;
      case 'charge': this.tone({ freq: 180, slide: 3, dur: 0.55, vol: 0.08, type: 'sawtooth' }); break;
      case 'fireball': this.noiseHit({ dur: 0.25, vol: 0.18, freq: 900, q: 0.6, type: 'lowpass' }); this.tone({ freq: 300, slide: 0.5, dur: 0.2, vol: 0.1, type: 'square' }); break;
      case 'fizz': this.noiseHit({ dur: 0.15, vol: 0.15, freq: 3000, q: 0.5 }); break;
      case 'click': this.tone({ freq: 660, dur: 0.05, vol: 0.12, type: 'square' }); break;
      case 'victory':
        [N.C5, N.E5, N.G5, N.C6, N.G5, N.C6, N.E6].forEach((n, k) => this.tone({ freq: NOTE(n), dur: k === 6 ? 0.6 : 0.14, vol: 0.14, type: 'square', at: t + k * 0.11 }));
        break;
      default: break;
    }
  }
}

export const Audio = new Chip();
