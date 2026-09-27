(function () {
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------- theme ---------- */
  var root = document.documentElement;
  var saved = store.get('theme');
  if (saved) root.setAttribute('data-theme', saved);
  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var cur = root.getAttribute('data-theme') ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    store.set('theme', next);
  });

  /* ---------- sidebar ---------- */
  document.querySelectorAll('.nav-toggle').forEach(function (b) {
    b.addEventListener('click', function () {
      var li = b.closest('.nav-sec');
      li.classList.toggle('is-open');
      b.setAttribute('aria-expanded', li.classList.contains('is-open'));
    });
  });
  var body = document.body;
  var menuBtn = document.getElementById('menuBtn');
  var scrim = document.getElementById('scrim');
  if (menuBtn) menuBtn.addEventListener('click', function () { body.classList.toggle('nav-open'); });
  if (scrim) scrim.addEventListener('click', function () { body.classList.remove('nav-open'); });
  var active = document.querySelector('.nav .is-active');
  if (active) active.scrollIntoView({ block: 'center' });

  /* ---------- search ---------- */
  var input = document.getElementById('searchInput');
  var box = document.getElementById('searchResults');
  if (!input || !box) return;
  var index = null, sel = -1;

  function load() {
    if (index) return Promise.resolve(index);
    return fetch(input.getAttribute('data-index')).then(function (r) { return r.json(); })
      .then(function (d) { index = d; return d; });
  }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hl(s, q) {
    var out = esc(s);
    q.forEach(function (w) {
      if (!w) return;
      out = out.split(esc(w)).join('<mark>' + esc(w) + '</mark>');
    });
    return out;
  }
  function run() {
    var q = input.value.trim().toLowerCase();
    if (!q) { box.classList.remove('is-open'); return; }
    load().then(function (d) {
      var words = q.split(/\s+/);
      var res = d.map(function (p) {
        var t = p.t.toLowerCase(), c = p.c.toLowerCase(), score = 0;
        for (var i = 0; i < words.length; i++) {
          var w = words[i];
          var inT = t.indexOf(w) > -1, inC = c.indexOf(w) > -1;
          if (!inT && !inC) return null;
          score += (inT ? 10 : 0) + (inC ? 1 : 0);
        }
        return { p: p, score: score };
      }).filter(Boolean).sort(function (a, b) { return b.score - a.score; }).slice(0, 8);

      sel = -1;
      if (!res.length) { box.innerHTML = '<div class="search-empty">"' + esc(q) + '"에 대한 결과가 없어요.</div>'; box.classList.add('is-open'); return; }
      box.innerHTML = res.map(function (r) {
        var c = r.p.c, i = c.toLowerCase().indexOf(words[0]);
        var start = Math.max(0, i - 30);
        var snip = (start > 0 ? '…' : '') + c.slice(start, start + 110) + '…';
        return '<a href="' + r.p.u + '"><b>' + hl(r.p.t, words) + '</b>' +
          (r.p.s ? '<small>' + esc(r.p.s) + '</small>' : '') +
          (i > -1 ? '<p>' + hl(snip, words) + '</p>' : '') + '</a>';
      }).join('');
      box.classList.add('is-open');
    });
  }
  input.addEventListener('input', run);
  input.addEventListener('focus', function () { load(); if (input.value) run(); });
  input.addEventListener('keydown', function (e) {
    var items = box.querySelectorAll('a');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach(function (a, i) { a.classList.toggle('is-sel', i === sel); });
    } else if (e.key === 'Enter' && items.length) {
      location.href = items[Math.max(sel, 0)].href;
    } else if (e.key === 'Escape') {
      box.classList.remove('is-open'); input.blur();
    }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.search')) box.classList.remove('is-open'); });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault(); input.focus();
    }
  });
})();
