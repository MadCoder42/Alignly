(async () => {
  const { api, hydrate, icon, getSettings, saveSettings, effectiveTheme, comboFromEvent } = Alignly;
  const $ = s => document.querySelector(s);
  const LABELS = { selToggle: 'Selection', pageToggle: 'Page',
                   resetAll: 'Reset all' };
  let S = await getSettings();

  function render() {
    const t = effectiveTheme(S);
    document.documentElement.dataset.theme = t;
    $('#theme').innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
    document.querySelectorAll('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.t === S.theme));
    ['showFloating', 'applyDirection', 'rememberSites'].forEach(k => $('#' + k).checked = S[k]);
    $('#keys').innerHTML = '';
    for (const k of Object.keys(LABELS)) {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<div>${LABELS[k]}</div>`;
      const inp = document.createElement('input');
      Object.assign(inp, { className: 'key', readOnly: true, value: S.shortcuts[k], placeholder: 'Not set' });
      const flash = () => { inp.classList.add('err'); setTimeout(() => inp.classList.remove('err'), 400); };
      const set = async v => { S.shortcuts = { ...S.shortcuts, [k]: v }; await saveSettings({ shortcuts: S.shortcuts }); inp.value = v; };
      inp.onkeydown = async e => {
        e.preventDefault();
        if (e.key === 'Escape') return inp.blur();
        if ((e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.altKey && !e.metaKey) return set('');
        const c = comboFromEvent(e);
        if (!c) return;
        if (!(e.ctrlKey || e.altKey || e.metaKey)) return flash();
        if (Object.entries(S.shortcuts).some(([n, v]) => v === c && n !== k)) return flash();
        await set(c); inp.blur();
      };
      row.appendChild(inp); $('#keys').appendChild(row);
    }
  }
  const save = async patch => { Object.assign(S, patch); await saveSettings(patch); render(); };

  hydrate();
  $('#theme').onclick = () => save({ theme: effectiveTheme(S) === 'dark' ? 'light' : 'dark' });
  document.querySelectorAll('#themeSeg button').forEach(b => b.onclick = () => save({ theme: b.dataset.t }));
  ['showFloating', 'applyDirection', 'rememberSites'].forEach(k => $('#' + k).onchange = e => save({ [k]: e.target.checked }));
  $('#reset').onclick = async () => { await api.storage.sync.remove('settings'); S = await getSettings(); render(); };
  $('#forget').onclick = async () => { await api.storage.local.remove('sites'); $('#forget').textContent = 'Saved sites cleared'; };
  render();
})();
