// Yandex Games SDK wrapper. Works without the SDK too (local dev / GitHub Pages).
import { Audio } from './audio.js';

export const YSDK = {
  sdk: null,
  lang: 'ru',
  readySent: false,
  listeners: new Set(),

  async init() {
    try {
      if (typeof window.YaGames === 'undefined') return;
      this.sdk = await Promise.race([
        window.YaGames.init(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('sdk timeout')), 5000)),
      ]);
      // Requirement 2.14: language auto-detection at start-up (the game is Russian-only for now).
      this.lang = this.sdk?.environment?.i18n?.lang || 'ru';
      this.sdk.on?.('game_api_pause', () => this.emit('pause'));
      this.sdk.on?.('game_api_resume', () => this.emit('resume'));
    } catch (e) {
      console.warn('[YSDK] not available:', e?.message || e);
      this.sdk = null;
    }
  },

  // Requirement 1.19.2: call when the player can start playing.
  ready() {
    if (this.readySent) return;
    this.readySent = true;
    try { this.sdk?.features?.LoadingAPI?.ready(); } catch (e) { /* ignore */ }
  },

  gameplayStart() { try { this.sdk?.features?.GameplayAPI?.start(); } catch (e) { /* ignore */ } },
  gameplayStop() { try { this.sdk?.features?.GameplayAPI?.stop(); } catch (e) { /* ignore */ } },

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit(ev) { this.listeners.forEach(fn => fn(ev)); },
};

// Requirement 1.3: sound stops when the page is hidden.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { Audio.suspend('hidden'); YSDK.emit('pause'); } else { Audio.resume('hidden'); YSDK.emit('resume'); }
});
window.addEventListener('blur', () => Audio.suspend('blur'));
window.addEventListener('focus', () => Audio.resume('blur'));
