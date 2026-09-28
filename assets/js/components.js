/* Interactive components — auto-initialised from HTML attributes.
   Everything a viewer does is saved only in their own browser (localStorage). */
(function () {
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var page = location.pathname;
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- kid mode ---------- */
  var html = document.documentElement;
  var modeBtn = document.getElementById('modeBtn');
  function setMode(kid) {
    if (kid) html.setAttribute('data-mode', 'kid'); else html.removeAttribute('data-mode');
    store.set('mode', kid ? 'kid' : 'parent');
    if (modeBtn) modeBtn.setAttribute('aria-pressed', kid ? 'true' : 'false');
  }
  setMode(html.getAttribute('data-mode') === 'kid');
  if (modeBtn) modeBtn.addEventListener('click', function () { setMode(html.getAttribute('data-mode') !== 'kid'); });

  /* ---------- mascot "새싹이" ---------- */
  var MASCOT = {
    root: '<ellipse cx="50" cy="88" rx="30" ry="7" fill="#c98a3c" opacity=".35"/><g class="m-bob"><ellipse cx="50" cy="66" rx="24" ry="22" fill="#e9b872"/><path d="M50 46 C50 34 50 30 50 26" stroke="#4cb050" stroke-width="4" stroke-linecap="round"/><path d="M50 32 C40 22 30 26 30 26 C34 36 44 36 50 32Z" fill="#6ccf5f"/><path d="M50 30 C60 18 72 22 72 22 C68 34 56 34 50 30Z" fill="#4cb050"/>',
    stem: '<ellipse cx="50" cy="90" rx="30" ry="6" fill="#4cb050" opacity=".3"/><g class="m-bob"><rect x="30" y="62" width="40" height="26" rx="8" fill="#e98b5a"/><rect x="26" y="56" width="48" height="10" rx="5" fill="#f2a477"/><path d="M50 58 V30" stroke="#3f9e44" stroke-width="5" stroke-linecap="round"/><ellipse cx="38" cy="36" rx="14" ry="9" fill="#6ccf5f" transform="rotate(-25 38 36)"/><ellipse cx="62" cy="28" rx="14" ry="9" fill="#4cb050" transform="rotate(25 62 28)"/>',
    branch: '<ellipse cx="50" cy="91" rx="30" ry="6" fill="#2aa7c9" opacity=".25"/><g class="m-bob"><rect x="45" y="56" width="10" height="34" rx="4" fill="#b07a45"/><circle cx="50" cy="40" r="26" fill="#4cb050"/><circle cx="34" cy="48" r="14" fill="#6ccf5f"/><circle cx="67" cy="46" r="14" fill="#3f9e44"/>',
    fruit: '<ellipse cx="50" cy="91" rx="32" ry="6" fill="#ff7a45" opacity=".25"/><g class="m-bob"><rect x="45" y="56" width="10" height="34" rx="4" fill="#9a6538"/><circle cx="50" cy="38" r="28" fill="#3f9e44"/><circle cx="32" cy="48" r="15" fill="#4cb050"/><circle cx="68" cy="46" r="15" fill="#4cb050"/><circle cx="38" cy="30" r="5" fill="#ff6b4a"/><circle cx="62" cy="36" r="5" fill="#ff6b4a"/><circle cx="48" cy="52" r="5" fill="#ffb13d"/>'
  };
  var FACE = '<circle cx="42" cy="70" r="3" fill="#2a2c52"/><circle cx="58" cy="70" r="3" fill="#2a2c52"/><path d="M44 77 Q50 82 56 77" stroke="#2a2c52" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="36" cy="76" r="3.5" fill="#ff8f8f" opacity=".6"/><circle cx="64" cy="76" r="3.5" fill="#ff8f8f" opacity=".6"/></g>';
  var FACE_TREE = '<circle cx="43" cy="42" r="3" fill="#2a2c52"/><circle cx="57" cy="42" r="3" fill="#2a2c52"/><path d="M45 49 Q50 54 55 49" stroke="#2a2c52" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="37" cy="48" r="3.5" fill="#ff8f8f" opacity=".6"/><circle cx="63" cy="48" r="3.5" fill="#ff8f8f" opacity=".6"/></g>';
  $$('.mascot').forEach(function (m) {
    var st = m.getAttribute('data-stage') || 'stem';
    var face = (st === 'branch' || st === 'fruit') ? FACE_TREE : FACE;
    m.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true">' + (MASCOT[st] || MASCOT.stem) + face + '</svg>';
  });

  /* ---------- tabs: <div class="tabs" data-tabs> .tab-list>button + .tab-panel ---------- */
  $$('[data-tabs]').forEach(function (t, ti) {
    var btns = $$('.tab-list > button', t), panels = $$(':scope > .tab-panel', t);
    var key = 'tab:' + page + ':' + (t.id || ti);
    function show(i) {
      btns.forEach(function (b, j) { b.setAttribute('aria-selected', i === j ? 'true' : 'false'); b.setAttribute('role', 'tab'); b.tabIndex = i === j ? 0 : -1; });
      panels.forEach(function (p, j) { p.hidden = i !== j; p.setAttribute('role', 'tabpanel'); });
      store.set(key, i);
    }
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { show(i); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          var n = (i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length;
          show(n); btns[n].focus();
        }
      });
    });
    var start = +(store.get(key) || 0);
    show(start < btns.length ? start : 0);
  });

  /* ---------- checklists (persist + progress) ---------- */
  $$('ul.checklist').forEach(function (ul, ui) {
    var boxes = $$('input[type=checkbox]', ul);
    var prog = ul.previousElementSibling && ul.previousElementSibling.classList.contains('check-progress') ? ul.previousElementSibling : null;
    function upd() {
      if (!prog) return;
      var n = boxes.filter(function (b) { return b.checked; }).length;
      var bar = prog.querySelector('.meter > i'); if (bar) bar.style.setProperty('--v', boxes.length ? n / boxes.length * 100 : 0);
      var t = prog.querySelector('.count'); if (t) t.textContent = n + ' / ' + boxes.length;
    }
    boxes.forEach(function (box, n) {
      var key = 'chk:' + page + ':' + (ul.id || ui) + ':' + n;
      var st = store.get(key);
      if (st !== null) box.checked = st === '1';
      box.addEventListener('change', function () { store.set(key, box.checked ? '1' : '0'); upd(); });
    });
    upd();
  });

  /* ---------- filters: .filters[data-filter-group=x] button[data-filter=tag] ; [data-filter-target=x] > [data-tags] ---------- */
  $$('.filters[data-filter-group]').forEach(function (bar) {
    var g = bar.getAttribute('data-filter-group');
    var target = document.querySelector('[data-filter-target="' + g + '"]');
    if (!target) return;
    var btns = $$('button[data-filter]', bar);
    var multiDim = bar.hasAttribute('data-dim');
    function apply() {
      // all filter bars for this group combine (AND across bars)
      var active = $$('.filters[data-filter-group="' + g + '"] button.is-on').map(function (b) { return b.getAttribute('data-filter'); }).filter(function (f) { return f !== 'all'; });
      var shown = 0;
      $$(':scope > [data-tags]', target).forEach(function (el) {
        var tags = ' ' + el.getAttribute('data-tags') + ' ';
        var ok = active.every(function (f) { return tags.indexOf(' ' + f + ' ') > -1; });
        el.classList.toggle('is-hidden', !ok);
        if (ok) shown++;
      });
      var empty = target.querySelector('.filter-empty');
      if (empty) empty.hidden = shown > 0;
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        apply();
      });
    });
    if (!bar.querySelector('.is-on') && btns[0]) btns[0].classList.add('is-on');
    apply();
  });

  /* ---------- flip cards ---------- */
  $$('.flip').forEach(function (f) {
    if (!f.querySelector('.flip-inner')) {
      var inner = document.createElement('span'); inner.className = 'flip-inner';
      while (f.firstChild) inner.appendChild(f.firstChild);
      f.appendChild(inner);
    }
    f.addEventListener('click', function () { f.classList.toggle('is-flipped'); });
  });

  /* ---------- quiz: .quiz[data-answer=index] .quiz-opt ; .quiz-fb[data-ok][data-no] ---------- */
  $$('.quiz').forEach(function (q) {
    var ans = +q.getAttribute('data-answer');
    var opts = $$('.quiz-opt', q), fb = q.querySelector('.quiz-fb');
    opts.forEach(function (o, i) {
      o.addEventListener('click', function () {
        if (q.classList.contains('is-done')) return;
        if (i === ans) {
          o.classList.add('is-right'); q.classList.add('is-done');
          if (fb) { fb.className = 'quiz-fb ok'; fb.textContent = fb.getAttribute('data-ok') || '정답이에요!'; }
        } else {
          o.classList.add('is-wrong');
          setTimeout(function () { o.classList.remove('is-wrong'); }, 600);
          if (fb) { fb.className = 'quiz-fb no'; fb.textContent = fb.getAttribute('data-no') || '다시 한 번 생각해 볼까?'; }
        }
      });
    });
  });

  /* ---------- stamps: .stamps[data-key] .stamp[data-id] ; [data-stamp-count=key] ---------- */
  $$('.stamps[data-key]').forEach(function (s) {
    var key = 'stamp:' + s.getAttribute('data-key');
    var on = {}; try { on = JSON.parse(store.get(key) || '{}'); } catch (e) {}
    var stamps = $$('.stamp', s);
    function count() {
      var n = stamps.filter(function (x) { return x.classList.contains('is-on'); }).length;
      $$('[data-stamp-count="' + s.getAttribute('data-key') + '"]').forEach(function (c) { c.textContent = n + ' / ' + stamps.length; });
    }
    stamps.forEach(function (st) {
      var id = st.getAttribute('data-id');
      if (on[id]) st.classList.add('is-on');
      st.setAttribute('aria-pressed', !!on[id]);
      st.addEventListener('click', function () {
        on[id] = !on[id]; st.classList.toggle('is-on', on[id]); st.setAttribute('aria-pressed', on[id]);
        store.set(key, JSON.stringify(on)); count();
      });
    });
    count();
  });

  /* ---------- memo fields: .memo[data-key] ---------- */
  $$('.memo[data-key]').forEach(function (m) {
    var key = 'memo:' + m.getAttribute('data-key');
    var v = store.get(key); if (v !== null) m.value = v;
    var hint = m.nextElementSibling && m.nextElementSibling.classList.contains('saved-hint') ? m.nextElementSibling : null;
    var timer;
    m.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { store.set(key, m.value); if (hint) hint.textContent = '이 브라우저에 저장됨 · ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); }, 400);
    });
  });

  /* ---------- selfcheck: .selfcheck checkboxes → .selfcheck-result > [data-min] ---------- */
  $$('.selfcheck').forEach(function (sc, si) {
    var boxes = $$('input[type=checkbox]', sc);
    var res = sc.querySelector('.selfcheck-result');
    var score = sc.querySelector('.selfcheck-score');
    function upd() {
      var n = boxes.filter(function (b) { return b.checked; }).length;
      if (score) score.textContent = n + ' / ' + boxes.length;
      if (!res) return;
      var best = null;
      $$('[data-min]', res).forEach(function (p) { p.classList.remove('is-on'); if (n >= +p.getAttribute('data-min')) best = p; });
      if (best) best.classList.add('is-on');
    }
    boxes.forEach(function (b, i) {
      var key = 'sc:' + page + ':' + (sc.id || si) + ':' + i;
      if (!sc.hasAttribute('data-nosave')) {
        var st = store.get(key); if (st !== null) b.checked = st === '1';
        b.addEventListener('change', function () { store.set(key, b.checked ? '1' : '0'); });
      }
      b.addEventListener('change', upd);
    });
    upd();
  });

  /* ---------- diagram focus: .dg[data-interactive] [data-node=id][data-deps="a b"], [data-edge="a>b"] ---------- */
  $$('.dg[data-interactive]').forEach(function (dg) {
    var nodes = $$('[data-node]', dg), edges = $$('[data-edge]', dg);
    var byId = {}; nodes.forEach(function (n) { byId[n.getAttribute('data-node')] = n; });
    function chain(id, seen) {
      if (seen[id]) return; seen[id] = 1;
      var n = byId[id]; if (!n) return;
      (n.getAttribute('data-deps') || '').split(/\s+/).filter(Boolean).forEach(function (d) { chain(d, seen); });
    }
    function focus(id) {
      var seen = {}; chain(id, seen);
      // also forward: nodes that depend on id (one level)
      nodes.forEach(function (n) {
        var deps = ' ' + (n.getAttribute('data-deps') || '') + ' ';
        if (deps.indexOf(' ' + id + ' ') > -1) seen[n.getAttribute('data-node')] = 1;
      });
      dg.classList.add('is-focus');
      nodes.forEach(function (n) { var k = n.getAttribute('data-node'); n.classList.toggle('is-hi', !!seen[k]); n.classList.toggle('is-me', k === id); });
      edges.forEach(function (e) { var p = e.getAttribute('data-edge').split('>'); e.classList.toggle('is-hi', !!(seen[p[0]] && seen[p[1]])); });
      var info = dg.querySelector('.dg-info');
      if (info) { var n = byId[id]; info.innerHTML = n.getAttribute('data-info') || ''; }
    }
    function clear() { dg.classList.remove('is-focus'); nodes.forEach(function (n) { n.classList.remove('is-hi', 'is-me'); }); edges.forEach(function (e) { e.classList.remove('is-hi'); }); }
    nodes.forEach(function (n) {
      n.setAttribute('tabindex', '0');
      n.addEventListener('mouseenter', function () { focus(n.getAttribute('data-node')); });
      n.addEventListener('focus', function () { focus(n.getAttribute('data-node')); });
      n.addEventListener('click', function (e) { e.stopPropagation(); focus(n.getAttribute('data-node')); });
    });
    dg.addEventListener('mouseleave', function () { if (!dg.querySelector('.dg-info')) clear(); });
    document.addEventListener('click', function (e) { if (!dg.contains(e.target)) clear(); });
  });

  /* ---------- deep links: #id opens the tab panel(s) and accordion(s) containing it ---------- */
  function openHash() {
    var id = decodeURIComponent((location.hash || '').slice(1));
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    var node = el;
    while (node && node !== document.body) {
      if (node.classList && node.classList.contains('tab-panel') && node.hidden) {
        var tabs = node.parentElement, panels = $$(':scope > .tab-panel', tabs), idx = panels.indexOf(node);
        var btn = $$('.tab-list > button', tabs)[idx];
        if (btn) btn.click();
      }
      if (node.tagName === 'DETAILS' && !node.open && !node.classList.contains('lesson')) node.open = true;
      node = node.parentElement;
    }
    if (el.tagName === 'DETAILS') el.open = true;
    el.classList.add('is-target');
    setTimeout(function () { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60);
    setTimeout(function () { el.classList.remove('is-target'); }, 2600);
  }
  window.addEventListener('hashchange', openHash);
  setTimeout(openHash, 0);

  /* ---------- "current grade" personalisation: [data-kid-year] shows each child's grade in a given year ---------- */
  // Children: 첫째 2026 초2, 둘째 2026 초1. Grade index 1..12 = 초1..고3.
  var KIDS = [{ name: '첫째', g2026: 2 }, { name: '둘째', g2026: 1 }];
  var GR = ['', '초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
  $$('[data-grade-now]').forEach(function (el) {
    var y = new Date().getFullYear() + (new Date().getMonth() < 2 ? -1 : 0);
    el.textContent = KIDS.map(function (k) { var g = k.g2026 + (y - 2026); return k.name + ' ' + (GR[g] || (g > 12 ? '졸업' : '')); }).join(' · ');
  });
})();
