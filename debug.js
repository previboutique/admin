// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// debug.js — utilitaires de diagnostic. Affiche les erreurs à l'écran (utile en
// production : l'utilisateur n'a pas de console accessible facilement).

const DEBUG = {
  actif: location.search.includes('debug=1'),
  panel: null,

  init() {
    this.panel = document.getElementById('debug-panel');
    if (this.actif && this.panel) this.panel.style.display = 'block';
    window.addEventListener('error', (e) => this.log('ERREUR JS', e.message, e.filename + ':' + e.lineno));
    window.addEventListener('unhandledrejection', (e) => this.log('PROMESSE REJETÉE', e.reason?.message || e.reason));
  },

  log(...args) {
    console.log('[DEBUG]', ...args);
    if (!this.panel) return;
    const ligne = document.createElement('div');
    ligne.textContent = new Date().toLocaleTimeString() + ' — ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    this.panel.appendChild(ligne);
    this.panel.scrollTop = this.panel.scrollHeight;
    if (this.actif) this.panel.style.display = 'block';
  },

  erreur(contexte, err) {
    console.error('[ERREUR]', contexte, err);
    this.log('ERREUR', contexte, err?.message || err);
  }
};

DEBUG.init();
