globalThis.Alignly = (() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const DEFAULTS = {
    theme: 'auto',            // auto | light | dark
    showFloating: true,       // mini toolbar after selecting text
    rememberSites: true,      // remember page alignment per website
    shortcuts: {
      selToggle: 'Alt+Shift+S',   // flip selection left <-> right
      pageToggle: 'Alt+Shift+E',  // flip whole page left <-> right
      resetAll: 'Alt+Shift+D'     // undo everything on this page
    }
  };
  const P = {
    left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
    right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.8-6.1M4 4v4.5h4.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'
  };
  const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
  const hydrate = (r = document) => r.querySelectorAll('[data-i]').forEach(e => e.insertAdjacentHTML('afterbegin', icon(e.dataset.i)));

  async function getSettings() {
    const { settings = {} } = await api.storage.sync.get('settings');
    return { ...DEFAULTS, ...settings, shortcuts: Object.fromEntries(Object.keys(DEFAULTS.shortcuts).map(k => [k, (settings.shortcuts || {})[k] ?? DEFAULTS.shortcuts[k]])) };
  }
  async function saveSettings(patch) {
    const s = await getSettings();
    await api.storage.sync.set({ settings: { ...s, ...patch } });
  }
  const effectiveTheme = s => s.theme === 'auto'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : s.theme;

  function comboFromEvent(e) {
    const c = e.code || '';
    if (/^(Control|Shift|Alt|Meta|OS)/.test(c)) return null;
    const key = c.startsWith('Key') ? c.slice(3) : c.startsWith('Digit') ? c.slice(5) : c;
    return [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Meta', key].filter(Boolean).join('+');
  }
  return { api, DEFAULTS, icon, hydrate, getSettings, saveSettings, effectiveTheme, comboFromEvent };
})();
