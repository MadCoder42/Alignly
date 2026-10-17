(async () => {
  const { api, hydrate, icon, getSettings, saveSettings, effectiveTheme } = Alignly;
  const $ = s => document.querySelector(s), hint = $('#hint');
  let S = await getSettings();
  const paint = () => {
    const t = effectiveTheme(S);
    document.documentElement.dataset.theme = t;
    $('#theme').innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
  };
  hydrate(); paint();
  $('#theme').onclick = async () => {
    S.theme = effectiveTheme(S) === 'dark' ? 'light' : 'dark';
    await saveSettings({ theme: S.theme }); paint();
  };
  $('#opts').onclick = () => { api.runtime.openOptionsPage(); close(); };

  document.querySelectorAll('[data-dir=toggle]').forEach(b => b.title = S.shortcuts[b.dataset.scope === 'sel' ? 'selToggle' : 'pageToggle'] || '');
  $('#reset').title = S.shortcuts.resetAll || '';

  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  const send = m => api.tabs.sendMessage(tab.id, m).catch(() => null);
  const mark = p => document.querySelectorAll('#page button').forEach(b => b.classList.toggle('on', b.dataset.dir === p));

  const st = await send({ type: 'state' });
  if (!st) {
    document.querySelectorAll('button[data-scope],#reset').forEach(b => b.disabled = true);
    hint.textContent = "Alignly can't run on this page (browser and store pages are off-limits).";
    return;
  }
  mark(st.page);
  document.querySelectorAll('[data-scope]').forEach(b => b.onclick = async () => {
    const r = await send({ type: b.dataset.scope, dir: b.dataset.dir });
    if (b.dataset.scope === 'page') mark(r && r.page);
    else hint.textContent = r && r.ok ? 'Applied to the selected text.' : 'Select some text on the page first.';
  });
  $('#reset').onclick = async () => { await send({ type: 'resetAll' }); mark('none'); hint.textContent = 'Everything is back to default.'; };
})();
