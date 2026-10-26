(() => {
  if (window.__alignly) return;
  window.__alignly = true;
  const { api, getSettings, comboFromEvent, effectiveTheme, icon } = Alignly;
  const root = document.documentElement;
  const TXT = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th,dt,dd,figcaption,caption,summary,label,textarea,input:not([type]),input[type=text],input[type=search],input[type=email],input[type=url]';
  const MARK = '[data-alignly-t]';   // blocks that directly contain text (found by the scanner below)
  const BOX = 'body,div,section,article,main,aside,header,footer,nav,span,a';
  const SKIP = 'script,style,noscript,pre,code,kbd,samp,svg,canvas,template,option,alignly-bar';
  let S, barHost, barEl, barTarget, obs, raf, queue = new Set();

  const style = document.createElement('style');
  style.id = 'alignly-css';
  (document.head || root).appendChild(style);

  function css() {
    const out = [], dirs = [['right', 'rtl'], ['left', 'ltr']];
    const rules = v => {
      const d = v === 'right' ? 'rtl' : 'ltr';
      return [`text-align:${v}!important;`, `direction:${d}!important;`];
    };
    for (const [v] of dirs) {   // whole page: text elements only, layout boxes are untouched
      const [ta, di] = rules(v);
      out.push(`html[data-alignly-page="${v}"] :is(${TXT},${MARK}){${ta}${di}}`);
    }
    for (const [v] of dirs) {   // selected section: last and more specific, so it wins over the page rule
      const [ta, di] = rules(v);
      const E = `html [data-alignly="${v}"][data-alignly="${v}"]`;
      out.push(`${E}{${ta}${di}}`, `${E} :is(${TXT},pre,${MARK}){${ta}${di}}`, `${E} :is(${BOX}){${ta}}`);
    }
    style.textContent = out.join('\n');
  }

  function blockOf(node) {
    let el = node.nodeType === 1 ? node : node.parentElement;
    while (el && el !== root) {
      const d = getComputedStyle(el).display;
      if (d !== 'inline' && d !== 'contents') return el;
      el = el.parentElement;
    }
    return document.body;
  }
  function getTarget() {
    const a = document.activeElement;
    if (a && /^(TEXTAREA|INPUT)$/.test(a.tagName) && a.selectionStart !== a.selectionEnd) return a;
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    return blockOf(sel.getRangeAt(0).commonAncestorContainer);
  }
  function sideOf(el) {   // which side the text currently sits on
    const cs = getComputedStyle(el), ta = cs.textAlign, rtl = cs.direction === 'rtl';
    return (ta === 'right' || ta === '-webkit-right' || (ta === 'start' && rtl) || (ta === 'end' && !rtl) || (ta === 'justify' && rtl)) ? 'right' : 'left';
  }

  // ---- text scanner: marks only blocks that hold real text ----
  function markParent(p) {
    if (!p || p.closest(SKIP)) return;
    let b = blockOf(p);
    if (!b || b === document.body) b = p;
    b.setAttribute('data-alignly-t', '');
  }
  function scan(n) {
    if (n.nodeType === 3) return void (n.nodeValue.trim() && markParent(n.parentElement));
    if (n.nodeType !== 1) return;
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT, { acceptNode: t => t.nodeValue.trim() ? 1 : 2 });
    const seen = new Set();
    for (let t; (t = w.nextNode());) {
      const p = t.parentElement;
      if (p && !seen.has(p)) { seen.add(p); markParent(p); }
    }
  }
  function startMark() {
    if (obs) return;
    scan(root);
    obs = new MutationObserver(ms => {
      ms.forEach(m => m.addedNodes.forEach(n => queue.add(n)));
      raf = raf || requestAnimationFrame(() => {
        raf = 0; queue.forEach(n => n.isConnected && scan(n)); queue.clear();
      });
    });
    obs.observe(root, { childList: true, subtree: true });
  }
  function stopMark() {
    if (obs) obs.disconnect();
    obs = null; queue.clear();
    document.querySelectorAll(MARK).forEach(e => e.removeAttribute('data-alignly-t'));
  }

  // ---- actions ----
  async function saveSite(dir) {
    if (window !== top || !S.rememberSites) return;
    const { sites = {} } = await api.storage.local.get('sites');
    dir === 'reset' ? delete sites[location.hostname] : (sites[location.hostname] = dir);
    await api.storage.local.set({ sites });
  }
  function setPage(dir) {
    if (dir === 'toggle') dir = (root.getAttribute('data-alignly-page') || sideOf(document.body || root)) === 'right' ? 'left' : 'right';
    root.setAttribute('data-alignly-page', dir);
    startMark();
    saveSite(dir);
  }
  function setSel(dir, el = getTarget()) {
    if (!el) return false;
    if (dir === 'toggle') dir = sideOf(el) === 'right' ? 'left' : 'right';
    dir === 'reset' ? el.removeAttribute('data-alignly') : el.setAttribute('data-alignly', dir);
    return true;
  }
  function resetAll() {
    root.removeAttribute('data-alignly-page');
    stopMark();
    document.querySelectorAll('[data-alignly]').forEach(e => e.removeAttribute('data-alignly'));
    saveSite('reset');
    hideBar();
  }

  // ---- floating mini toolbar (shadow DOM so page CSS can't touch it) ----
  function ensureBar() {
    if (barHost) return;
    barHost = document.createElement('alignly-bar');
    barHost.style.cssText = 'all:initial;position:fixed;top:0;left:0;z-index:2147483647;display:none';
    const sh = barHost.attachShadow({ mode: 'closed' });
    const names = { left: 'Align left', right: 'Align right', reset: 'Reset' };
    sh.innerHTML = `<style>
      .bar{display:flex;gap:2px;padding:4px;border-radius:12px;background:#fff;color:#1b1e2b;border:1px solid #e3e5ee;box-shadow:0 6px 24px rgba(20,24,50,.18);font:13px system-ui}
      .bar.dark{background:#1b1e2a;color:#eceefa;border-color:#2c3044;box-shadow:0 6px 24px rgba(0,0,0,.5)}
      button{all:unset;box-sizing:border-box;width:30px;height:30px;display:grid;place-items:center;border-radius:8px;cursor:pointer}
      button:hover{background:rgba(99,102,241,.16);color:#6366f1}.dark button:hover{color:#a5acff}
      button:focus-visible{outline:2px solid #6366f1}
      svg{width:18px;height:18px}</style>
      <div class="bar">${Object.keys(names).map(d => `<button data-d="${d}" title="${names[d]}" aria-label="${names[d]}">${icon(d)}</button>`).join('')}</div>`;
    barEl = sh.querySelector('.bar');
    barEl.addEventListener('mousedown', e => e.preventDefault());
    barEl.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b) setSel(b.dataset.d, barTarget);
    });
    root.appendChild(barHost);
  }
  const hideBar = () => { if (barHost) barHost.style.display = 'none'; };
  function showBar() {
    const t = S && S.showFloating && getTarget();
    if (!t) return hideBar();
    ensureBar();
    barTarget = t;
    barEl.classList.toggle('dark', effectiveTheme(S) === 'dark');
    barHost.style.display = 'block';
    const sel = getSelection();
    let r = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : t.getBoundingClientRect();
    if (!r.width && !r.height) r = t.getBoundingClientRect();
    const w = barEl.offsetWidth || 112;
    let y = r.top - 46;
    if (y < 8) y = r.bottom + 8;
    const x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    barHost.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  }
  addEventListener('mouseup', e => { if (e.target !== barHost) setTimeout(showBar, 10); }, true);
  addEventListener('keyup', e => { if (e.shiftKey || e.key === 'Shift') setTimeout(showBar, 10); }, true);
  addEventListener('mousedown', e => { if (e.target !== barHost) hideBar(); }, true);
  addEventListener('scroll', hideBar, true);

  // ---- keyboard shortcuts ----
  addEventListener('keydown', e => {
    if (!S) return;
    const c = comboFromEvent(e);
    if (!c) return;
    const k = S.shortcuts, map = {
      [k.selToggle]: () => setSel('toggle'),
      [k.pageToggle]: () => setPage('toggle'),
      [k.resetAll]: resetAll
    };
    if (map[c]) { e.preventDefault(); e.stopPropagation(); map[c](); }
  }, true);

  // ---- messages from the popup ----
  api.runtime.onMessage.addListener((m, _s, reply) => {
    if (m.type === 'page') { setPage(m.dir); reply({ ok: true, page: root.getAttribute('data-alignly-page') }); }
    else if (m.type === 'sel') reply({ ok: setSel(m.dir) });
    else if (m.type === 'resetAll') { resetAll(); reply({ ok: true }); }
    else if (m.type === 'state') reply({ page: root.getAttribute('data-alignly-page') || 'none', hasSelection: !!getTarget() });
  });

  api.storage.onChanged.addListener(async () => { S = await getSettings(); css(); });
  (async () => {
    S = await getSettings();
    css();
    if (window === top && S.rememberSites) {
      const { sites = {} } = await api.storage.local.get('sites');
      const v = sites[location.hostname];
      if (v === 'left' || v === 'right') { root.setAttribute('data-alignly-page', v); startMark(); }
    }
  })();
})();
