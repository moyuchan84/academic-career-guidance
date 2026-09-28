/* ============================================================
   Learning games engine — "아이와 해 보기"
   Usage:
   <div class="game" data-game="TYPE" data-id="unique-on-page">
     <script type="application/json" class="game-data">{ ...config... }</script>
   </div>
   Types: choice sort order match drill fraction clock placevalue coins
          spell hangul rhythm robot grid angle color timer binary
   Scores are saved only in this browser (localStorage).
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- helpers ---------------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(cls, text, onClick) {
    var b = el('button', cls, text);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function rnd(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function shake(node) { if (!node) return; node.classList.remove('g-shake'); void node.offsetWidth; node.classList.add('g-shake'); }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  /* ---------------- sound ---------------- */
  var actx = null;
  function soundOn() { return store('game-sound') !== 'off'; }
  function tone(freq, dur, type, when, vol) {
    if (!soundOn()) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      var t0 = actx.currentTime + (when || 0);
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.18, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) {}
  }
  function sfxOk() { tone(660, 0.12, 'triangle'); tone(990, 0.18, 'triangle', 0.1); }
  function sfxNo() { tone(220, 0.18, 'square', 0, 0.08); }
  function sfxWin() { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.2, 'triangle', i * 0.11); }); }
  function click(accent, when) { tone(accent ? 1500 : 1000, 0.05, 'square', when || 0, 0.12); }

  /* ---------------- speech ---------------- */
  var voices = [];
  function loadVoices() { try { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch (e) { voices = []; } }
  if (window.speechSynthesis) { loadVoices(); try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {} }
  function hasVoice(lang) {
    if (!window.speechSynthesis) return false;
    if (!voices.length) loadVoices();
    if (!voices.length) return true; // unknown yet — try anyway
    var p = (lang || 'ko-KR').slice(0, 2).toLowerCase();
    return voices.some(function (v) { return (v.lang || '').toLowerCase().indexOf(p) === 0; });
  }
  function say(text, lang, rate) {
    if (!window.speechSynthesis || !text) return false;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lang || 'ko-KR'; u.rate = rate || 0.85;
      var p = u.lang.slice(0, 2).toLowerCase();
      var v = voices.filter(function (x) { return (x.lang || '').toLowerCase().indexOf(p) === 0; })[0];
      if (v) u.voice = v;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }
  function speakBtn(text, lang, label) {
    return btn('g-btn g-say', label || '🔊 듣기', function () { say(text, lang); });
  }

  /* ---------------- confetti ---------------- */
  function celebrate(box) {
    var bits = ['🎉', '⭐', '🌱', '✨', '🍀', '🎈'];
    for (var i = 0; i < 18; i++) {
      var s = el('span', 'g-confetti', pick(bits));
      s.style.left = rnd(4, 94) + '%';
      s.style.animationDelay = (Math.random() * 0.4) + 's';
      s.style.fontSize = rnd(16, 28) + 'px';
      box.appendChild(s);
      (function (n) { setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 1900); })(s);
    }
  }

  /* ---------------- Korean number words ---------------- */
  var KD = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  function koNum(n) {
    if (n === 0) return '영';
    var out = '', units = ['', '십', '백', '천'];
    function four(x) {
      var s = '', ds = String(x).split('').reverse();
      for (var i = ds.length - 1; i >= 0; i--) {
        var d = +ds[i]; if (!d) continue;
        s += (d === 1 && i > 0 ? '' : KD[d]) + units[i];
      }
      return s;
    }
    var man = Math.floor(n / 10000), rest = n % 10000;
    if (man) out += (man === 1 ? '' : four(man)) + '만';
    out += four(rest);
    return out;
  }
  function won(n) { return n.toLocaleString('ko-KR') + '원'; }

  /* ============================================================
     Game scaffold
     ============================================================ */
  var DEFAULT_TITLE = {
    choice: '퀴즈', sort: '분류하기', order: '순서 맞추기', match: '짝 맞추기', drill: '계산 도전',
    fraction: '분수 막대', clock: '시계 놀이', placevalue: '수 모형', coins: '동전 놀이', spell: '받아쓰기',
    hangul: '글자 만들기', rhythm: '리듬 따라 치기', robot: '로봇 코딩', grid: '넓이·둘레 그리기',
    angle: '각도 놀이', color: '색 섞기', timer: '운동 타이머', binary: '이진수 카드'
  };

  function mount(root, idx) {
    if (root.getAttribute('data-ready')) return;
    root.setAttribute('data-ready', '1');
    var type = root.getAttribute('data-game');
    var id = root.getAttribute('data-id') || (type + '-' + idx);
    var cfg = {};
    var dataEl = root.querySelector('script.game-data');
    try { cfg = dataEl ? JSON.parse(dataEl.textContent) : {}; } catch (e) {
      root.appendChild(el('p', 'g-error', '게임 설정을 읽지 못했어요: ' + e.message));
      return;
    }
    root.innerHTML = '';
    root.classList.add('g-type-' + type);

    var key = 'game:' + location.pathname + ':' + id;
    var top = el('div', 'g-top');
    var title = el('div', 'g-title', cfg.title || DEFAULT_TITLE[type] || '게임');
    var right = el('div', 'g-right');
    var bestEl = el('span', 'g-best');
    var mute = btn('g-icon', soundOn() ? '🔔' : '🔕', function () {
      store('game-sound', soundOn() ? 'off' : 'on');
      document.querySelectorAll('.game .g-icon').forEach(function (b) { b.textContent = soundOn() ? '🔔' : '🔕'; });
    });
    mute.title = '소리 켜기/끄기';
    right.appendChild(bestEl); right.appendChild(mute);
    top.appendChild(title); top.appendChild(right);
    root.appendChild(top);
    if (cfg.help) {
      var help = el('p', 'g-help', cfg.help);
      root.appendChild(help);
    }
    var body = el('div', 'g-body');
    var foot = el('div', 'g-foot');
    var msg = el('span', 'g-msg');
    var reset = btn('g-btn ghost', '↺ 처음부터');
    foot.appendChild(msg); foot.appendChild(reset);
    root.appendChild(body); root.appendChild(foot);

    function showBest() {
      var b = null; try { b = JSON.parse(store(key) || 'null'); } catch (e) {}
      if (!b) { bestEl.textContent = ''; return; }
      bestEl.textContent = b.time != null ? '최고 ' + b.time + '초' : '최고 ' + b.score + '/' + b.total;
    }
    showBest();

    var g = {
      root: root, cfg: cfg, body: body, id: id,
      msg: function (t, kind) { msg.textContent = t || ''; msg.className = 'g-msg' + (kind ? ' is-' + kind : ''); },
      ok: function (t) { sfxOk(); g.msg(t || pick(['딩동댕!', '맞았어!', '좋아!', '잘했어!']), 'ok'); },
      no: function (t, node) { sfxNo(); shake(node); g.msg(t || '다시 해 볼까?', 'no'); },
      finish: function (r) {
        var prev = null; try { prev = JSON.parse(store(key) || 'null'); } catch (e) {}
        var better = !prev || (r.time != null ? (prev.time == null || r.time < prev.time) : r.score / r.total > prev.score / prev.total);
        if (better) store(key, JSON.stringify(r));
        showBest();
        var ratio = r.total ? r.score / r.total : 1;
        var end = el('div', 'g-end');
        end.appendChild(el('div', 'g-end-big', ratio >= 0.8 ? '🎉' : ratio >= 0.5 ? '👍' : '🌱'));
        var line = r.time != null ? r.time + '초 만에 끝냈어요!' : (r.label || ('첫 번에 ' + r.score + ' / ' + r.total + ' 맞혔어요'));
        end.appendChild(el('p', 'g-end-t', line));
        end.appendChild(el('p', 'g-end-s', better && prev ? '새 기록이에요!' : ratio >= 0.8 ? '정말 잘했어요!' : '다시 하면 더 잘할 수 있어요.'));
        end.appendChild(btn('g-btn', '한 번 더', function () { start(); }));
        body.innerHTML = ''; body.appendChild(end);
        g.msg('');
        if (ratio >= 0.8) { sfxWin(); celebrate(root); }
      },
      progress: function (i, n) {
        var p = el('div', 'g-prog');
        for (var k = 0; k < n; k++) p.appendChild(el('i', k < i ? 'is-done' : k === i ? 'is-now' : ''));
        return p;
      }
    };
    function start() { body.innerHTML = ''; g.msg(''); try { (TYPES[type] || unknown)(g); } catch (e) { body.appendChild(el('p', 'g-error', '게임을 시작하지 못했어요: ' + e.message)); } }
    reset.addEventListener('click', start);
    start();
  }
  function unknown(g) { g.body.appendChild(el('p', 'g-error', '알 수 없는 게임 종류예요.')); }

  /* ============================================================
     TYPES
     ============================================================ */
  var TYPES = {};

  /* ---- choice: {items:[{q, options:[], answer, say?, lang?, big?, why?}], shuffle?, autoSay?} ---- */
  TYPES.choice = function (g) {
    var items = g.cfg.shuffle === false ? g.cfg.items.slice() : shuffle(g.cfg.items.slice());
    var i = 0, first = 0;
    function show() {
      if (i >= items.length) return g.finish({ score: first, total: items.length });
      var it = items[i], tried = false;
      g.body.innerHTML = '';
      g.body.appendChild(g.progress(i, items.length));
      if (it.big) g.body.appendChild(el('div', 'g-big', it.big));
      var qrow = el('div', 'g-qrow');
      qrow.appendChild(el('div', 'g-q', it.q));
      if (it.say) { qrow.appendChild(speakBtn(it.say, it.lang || g.cfg.lang)); if (g.cfg.autoSay) setTimeout(function () { say(it.say, it.lang || g.cfg.lang); }, 250); }
      g.body.appendChild(qrow);
      var opts = it.options.map(function (t, k) { return { t: t, ok: k === it.answer }; });
      if (g.cfg.shuffleOptions !== false && !it.keepOrder) shuffle(opts);
      var grid = el('div', 'g-opts');
      opts.forEach(function (o) {
        var b = btn('g-opt', String(o.t), function () {
          if (grid.getAttribute('data-done')) return;
          if (o.ok) {
            grid.setAttribute('data-done', '1'); b.classList.add('is-right');
            if (!tried) first++;
            g.ok(it.okMsg);
            setTimeout(function () { i++; show(); }, 750);
          } else { tried = true; b.classList.add('is-wrong'); g.no(it.why, b); }
        });
        grid.appendChild(b);
      });
      g.body.appendChild(grid);
    }
    show();
  };

  /* ---- sort: {buckets:[..], items:[{t, b, why?}]} ---- */
  TYPES.sort = function (g) {
    var items = shuffle(g.cfg.items.map(function (x, k) { return { t: x.t, b: x.b, why: x.why, k: k }; }));
    var sel = null, placed = 0, firstOk = 0, missed = {};
    var pool = el('div', 'g-pool');
    var zones = el('div', 'g-buckets');
    g.body.appendChild(el('p', 'g-hint', '카드를 누르고, 들어갈 상자를 눌러요. (끌어다 놓아도 돼요)'));
    g.body.appendChild(pool); g.body.appendChild(zones);
    var chips = items.map(function (it) {
      var c = btn('g-chip', it.t, function () {
        if (c.classList.contains('is-placed')) return;
        chips.forEach(function (x) { x.classList.remove('is-sel'); });
        if (sel === it) { sel = null; return; }
        sel = it; c.classList.add('is-sel');
      });
      c.draggable = true;
      c.addEventListener('dragstart', function (e) { sel = it; try { e.dataTransfer.setData('text/plain', String(it.k)); } catch (x) {} });
      it.node = c; pool.appendChild(c); return c;
    });
    g.cfg.buckets.forEach(function (name, bi) {
      var z = el('div', 'g-bucket');
      z.appendChild(el('div', 'g-bucket-t', name));
      var inner = el('div', 'g-bucket-in'); z.appendChild(inner);
      function drop() {
        if (!sel) { g.msg('먼저 카드를 골라요'); return; }
        var it = sel;
        if (it.b === bi) {
          it.node.classList.remove('is-sel'); it.node.classList.add('is-placed');
          inner.appendChild(it.node); placed++; if (!missed[it.k]) firstOk++;
          sel = null; g.ok();
          if (placed === items.length) setTimeout(function () { g.finish({ score: firstOk, total: items.length }); }, 700);
        } else { missed[it.k] = 1; g.no(it.why || '이 상자가 아닌 것 같아. 다시 생각해 볼까?', z); }
      }
      z.addEventListener('click', function (e) { if (e.target.closest('.g-chip')) return; drop(); });
      z.addEventListener('dragover', function (e) { e.preventDefault(); z.classList.add('is-over'); });
      z.addEventListener('dragleave', function () { z.classList.remove('is-over'); });
      z.addEventListener('drop', function (e) { e.preventDefault(); z.classList.remove('is-over'); drop(); });
      zones.appendChild(z);
    });
  };

  /* ---- order: {items:[in correct order], prompt?} ---- */
  TYPES.order = function (g) {
    var items = g.cfg.items.slice(), next = 0, mistakes = 0;
    if (g.cfg.prompt) g.body.appendChild(el('p', 'g-q', g.cfg.prompt));
    g.body.appendChild(el('p', 'g-hint', '처음부터 차례대로 눌러요.'));
    var slots = el('ol', 'g-slots');
    items.forEach(function () { slots.appendChild(el('li', 'g-slot')); });
    var pool = el('div', 'g-pool');
    shuffle(items.map(function (t, k) { return { t: t, k: k }; })).forEach(function (it) {
      var c = btn('g-chip', it.t, function () {
        if (c.classList.contains('is-placed')) return;
        if (it.k === next || it.t === items[next]) {
          c.classList.add('is-placed');
          var s = slots.children[next]; s.textContent = it.t; s.classList.add('is-filled');
          next++; g.ok(next === items.length ? '다 맞췄어!' : ' ');
          if (next === items.length) setTimeout(function () { g.finish({ score: Math.max(0, items.length - mistakes), total: items.length }); }, 700);
        } else { mistakes++; g.no((g.cfg.hint || '그다음이 아니야.') , c); }
      });
      pool.appendChild(c);
    });
    g.body.appendChild(slots); g.body.appendChild(pool);
  };

  /* ---- match: {pairs:[[a,b],...], mode?:'columns'|'memory', lang?, sayLeft?} ---- */
  TYPES.match = function (g) {
    var pairs = g.cfg.pairs, done = 0, moves = 0;
    if (g.cfg.mode === 'memory') {
      var cards = [];
      pairs.forEach(function (p, k) { cards.push({ t: p[0], k: k }); cards.push({ t: p[1], k: k }); });
      shuffle(cards);
      var grid = el('div', 'g-memory'), open = [];
      cards.forEach(function (c) {
        var b = btn('g-card', '');
        b.appendChild(el('span', 'g-card-back', '?'));
        b.appendChild(el('span', 'g-card-face', c.t));
        b.addEventListener('click', function () {
          if (b.classList.contains('is-open') || open.length === 2) return;
          b.classList.add('is-open'); open.push({ b: b, c: c });
          if (open.length === 2) {
            moves++;
            if (open[0].c.k === open[1].c.k) {
              open.forEach(function (o) { o.b.classList.add('is-done'); }); open = []; done++; g.ok();
              if (done === pairs.length) setTimeout(function () { g.finish({ score: pairs.length, total: pairs.length, label: moves + '번 만에 모두 찾았어요' }); }, 700);
            } else {
              sfxNo();
              setTimeout(function () { open.forEach(function (o) { o.b.classList.remove('is-open'); }); open = []; }, 850);
            }
          }
        });
        grid.appendChild(b);
      });
      g.body.appendChild(grid);
      return;
    }
    var left = el('div', 'g-col'), right = el('div', 'g-col'), selL = null, selR = null, miss = 0;
    var wrap = el('div', 'g-match'); wrap.appendChild(left); wrap.appendChild(right);
    g.body.appendChild(el('p', 'g-hint', '왼쪽과 오른쪽에서 짝을 하나씩 눌러요.'));
    function tryPair() {
      if (!selL || !selR) return;
      if (selL.k === selR.k) {
        var hue = (done * 57) % 360;
        [selL.b, selR.b].forEach(function (b) { b.classList.remove('is-sel'); b.classList.add('is-done'); b.style.setProperty('--h', hue); b.disabled = true; });
        done++; g.ok();
        if (done === pairs.length) setTimeout(function () { g.finish({ score: Math.max(0, pairs.length - miss), total: pairs.length }); }, 700);
      } else { miss++; g.no('짝이 아니야', selR.b); selL.b.classList.remove('is-sel'); selR.b.classList.remove('is-sel'); }
      selL = selR = null;
    }
    shuffle(pairs.map(function (p, k) { return { t: p[0], k: k }; })).forEach(function (it) {
      var b = btn('g-chip wide', it.t, function () {
        if (g.cfg.sayLeft) say(it.t, g.cfg.lang);
        if (selL) selL.b.classList.remove('is-sel'); selL = { k: it.k, b: b }; b.classList.add('is-sel'); tryPair();
      });
      left.appendChild(b);
    });
    shuffle(pairs.map(function (p, k) { return { t: p[1], k: k }; })).forEach(function (it) {
      var b = btn('g-chip wide', it.t, function () {
        if (selR) selR.b.classList.remove('is-sel'); selR = { k: it.k, b: b }; b.classList.add('is-sel'); tryPair();
      });
      right.appendChild(b);
    });
    g.body.appendChild(wrap);
  };

  /* ---- numpad helper ---- */
  function numpad(onKey) {
    var pad = el('div', 'g-pad');
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '확인'].forEach(function (k) {
      pad.appendChild(btn('g-key' + (k === '확인' ? ' is-go' : ''), k, function () { onKey(k); }));
    });
    return pad;
  }

  /* ---- drill: {op:'add'|'sub'|'mul'|'div'|'divr'|'mix', a:[min,max], b:[min,max], dan?:[..], count?, noCarry?, noBorrow?}  divr = 나머지 있는 나눗셈 (a = 몫 범위) ---- */
  TYPES.drill = function (g) {
    var c = g.cfg, n = c.count || 10;
    function digitsOk(a, b, fn) { var x = String(a).split('').reverse(), y = String(b).split('').reverse(); for (var i = 0; i < Math.max(x.length, y.length); i++) { if (!fn(+(x[i] || 0), +(y[i] || 0))) return false; } return true; }
    function gen() {
      var op = c.op === 'mix' ? pick(['add', 'sub', 'mul', 'div']) : c.op;
      var A = c.a || [1, 9], B = c.b || [1, 9], a, b, ans, t = 0;
      do {
        t++;
        if (op === 'mul') { a = c.dan ? pick(c.dan) : rnd(A[0], A[1]); b = rnd(B[0], B[1]); ans = a * b; }
        else if (op === 'div') { b = c.dan ? pick(c.dan) : rnd(B[0], B[1]); var q = rnd(A[0], A[1]); a = b * q; ans = q; }
        else if (op === 'divr') { b = c.dan ? pick(c.dan) : rnd(Math.max(2, B[0]), B[1]); var q2 = rnd(A[0], A[1]), r2 = rnd(c.allowZero ? 0 : 1, b - 1); a = b * q2 + r2; ans = q2; var rem = r2; }
        else { a = rnd(A[0], A[1]); b = rnd(B[0], B[1]); if (op === 'sub' && b > a) { var s = a; a = b; b = s; } ans = op === 'add' ? a + b : a - b; }
        var ok = true;
        if (op === 'add' && c.noCarry) ok = digitsOk(a, b, function (x, y) { return x + y < 10; });
        if (op === 'add' && c.carry) ok = !digitsOk(a, b, function (x, y) { return x + y < 10; });
        if (op === 'sub' && c.noBorrow) ok = digitsOk(a, b, function (x, y) { return x >= y; });
        if (op === 'sub' && c.borrow) ok = !digitsOk(a, b, function (x, y) { return x >= y; });
      } while (!ok && t < 200);
      return { a: a, b: b, ans: ans, rem: op === 'divr' ? rem : null, sym: { add: '+', sub: '−', mul: '×', div: '÷', divr: '÷' }[op] };
    }
    var startBtn = btn('g-btn big', '▶ 시작!', go);
    g.body.appendChild(el('p', 'g-q', n + '문제를 얼마나 빨리 풀 수 있을까?'));
    g.body.appendChild(startBtn);
    function go() {
      var i = 0, miss = 0, t0 = Date.now(), cur = gen(), val = '', part = 0, qv = '';
      g.body.innerHTML = '';
      var prog = el('div'); var qd = el('div', 'g-eq'); var timer = el('div', 'g-timer', '0초');
      g.body.appendChild(prog); g.body.appendChild(timer); g.body.appendChild(qd);
      var tick = setInterval(function () { if (!document.body.contains(timer)) return clearInterval(tick); timer.textContent = Math.round((Date.now() - t0) / 1000) + '초'; }, 500);
      function render() { prog.innerHTML = ''; prog.appendChild(g.progress(i, n)); qd.textContent = cur.rem == null ? cur.a + ' ' + cur.sym + ' ' + cur.b + ' = ' + (val || '?') : cur.a + ' ÷ ' + cur.b + ' = 몫 ' + (part ? qv : (val || '?')) + ' · 나머지 ' + (part ? (val || '?') : '?'); }
      function key(k) {
        if (k === '⌫') val = val.slice(0, -1);
        else if (k === '확인') {
          if (!val) return;
          if (cur.rem != null && part === 0) { if (+val === cur.ans) { part = 1; qv = val; val = ''; g.msg('이제 나머지!'); } else { miss++; val = ''; g.no('몫을 다시 생각해 봐', qd); } render(); return; }
          if (+val === (cur.rem != null ? cur.rem : cur.ans)) { g.ok(' '); i++; val = ''; part = 0; qv = ''; if (i >= n) { clearInterval(tick); return g.finish({ score: n - Math.min(n, miss), total: n, time: miss ? undefined : Math.round((Date.now() - t0) / 1000), label: Math.round((Date.now() - t0) / 1000) + '초 · 틀린 횟수 ' + miss }); } cur = gen(); }
          else { miss++; val = ''; g.no('다시!', qd); }
        } else if (val.length < 6) val += k;
        render();
      }
      g.body.appendChild(numpad(key));
      g.root.onkeydown = function (e) { if (/^[0-9]$/.test(e.key)) key(e.key); else if (e.key === 'Backspace') key('⌫'); else if (e.key === 'Enter') key('확인'); };
      g.root.tabIndex = 0; g.root.focus({ preventScroll: true });
      render();
    }
  };

  /* ---- fraction: {mode:'shade'|'compare'|'equal', tasks:[...]} ---- */
  function fracHTML(n, d) { var f = el('span', 'g-frac'); f.appendChild(el('span', 'g-frac-n', String(n))); f.appendChild(el('span', 'g-frac-d', String(d))); return f; }
  function fracBar(d, shaded, clickable, onChange) {
    var bar = el('div', 'g-fbar'), count = 0;
    for (var k = 0; k < d; k++) {
      (function () {
        var cell = el('button', 'g-fcell'); cell.type = 'button';
        if (k < (shaded || 0)) { cell.classList.add('is-on'); count++; }
        if (clickable) cell.addEventListener('click', function () { cell.classList.toggle('is-on'); count += cell.classList.contains('is-on') ? 1 : -1; if (onChange) onChange(count); });
        else cell.disabled = true;
        bar.appendChild(cell);
      })();
    }
    bar.getCount = function () { return count; };
    return bar;
  }
  TYPES.fraction = function (g) {
    var tasks = g.cfg.tasks, mode = g.cfg.mode || 'shade', i = 0, first = 0;
    function show() {
      if (i >= tasks.length) return g.finish({ score: first, total: tasks.length });
      var t = tasks[i], tried = false;
      g.body.innerHTML = ''; g.body.appendChild(g.progress(i, tasks.length));
      var q = el('div', 'g-q');
      function next(ok) { if (ok) { if (!tried) first++; g.ok(); setTimeout(function () { i++; show(); }, 750); } }
      if (mode === 'compare') {
        q.appendChild(document.createTextNode('어느 쪽이 더 클까?'));
        g.body.appendChild(q);
        var row = el('div', 'g-fcmp');
        [t.a, t.b].forEach(function (f) { var col = el('div', 'g-fcol'); col.appendChild(fracHTML(f[0], f[1])); col.appendChild(fracBar(f[1], f[0], false)); row.appendChild(col); });
        g.body.appendChild(row);
        var v = t.a[0] * t.b[1] - t.b[0] * t.a[1], right = v > 0 ? '>' : v < 0 ? '<' : '=';
        var opts = el('div', 'g-opts three');
        ['<', '=', '>'].forEach(function (s) {
          var b = btn('g-opt big', s, function () { if (s === right) { b.classList.add('is-right'); next(true); } else { tried = true; g.no('막대의 칠해진 길이를 비교해 봐', b); } });
          opts.appendChild(b);
        });
        g.body.appendChild(opts);
        return;
      }
      var d = mode === 'equal' ? t.to : t.d;
      if (mode === 'equal') { q.appendChild(fracHTML(t.from[0], t.from[1])); q.appendChild(document.createTextNode(' 과(와) 크기가 같게 ' + d + '조각 막대를 칠해 봐')); }
      else { q.appendChild(fracHTML(t.n, t.d)); q.appendChild(document.createTextNode(' 만큼 칠해 봐')); }
      g.body.appendChild(q);
      if (mode === 'equal') { var ref = fracBar(t.from[1], t.from[0], false); ref.classList.add('is-ref'); g.body.appendChild(ref); }
      var nb = mode === 'equal' ? 1 : (t.bars || Math.max(1, Math.ceil(t.n / t.d)));
      var barsList = []; for (var bi = 0; bi < nb; bi++) { var fb = fracBar(d, 0, true); barsList.push(fb); g.body.appendChild(fb); }
      var bar = { getCount: function () { return barsList.reduce(function (s2, x) { return s2 + x.getCount(); }, 0); } };
      if (nb > 1) g.body.appendChild(el('p', 'g-hint', '막대 하나가 1이에요. 1보다 큰 분수는 막대를 여러 개 써요.'));
      var chk = btn('g-btn', '확인', function () {
        var c = bar.getCount();
        var ok = mode === 'equal' ? c * t.from[1] === t.from[0] * d : c === t.n;
        if (ok) next(true);
        else { tried = true; g.no(mode === 'equal' ? '위 막대와 칠해진 길이가 같아야 해' : '분모 ' + t.d + '은(는) 전체를 ' + t.d + '조각으로 나눈 것, 분자 ' + t.n + '은(는) 그중 칠할 조각 수야', barsList[0]); }
      });
      g.body.appendChild(chk);
    }
    show();
  };

  /* ---- clock: {mode:'set'|'read', tasks:['3:00','7:30'], step?} ---- */
  function clockSVG() {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg'); s.setAttribute('viewBox', '0 0 200 200'); s.setAttribute('class', 'g-clock');
    var face = document.createElementNS(ns, 'circle'); face.setAttribute('cx', 100); face.setAttribute('cy', 100); face.setAttribute('r', 92); face.setAttribute('class', 'g-clock-face'); s.appendChild(face);
    for (var k = 0; k < 60; k++) {
      var a = k * 6 * Math.PI / 180, r1 = k % 5 ? 84 : 78;
      var l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', 100 + Math.sin(a) * r1); l.setAttribute('y1', 100 - Math.cos(a) * r1);
      l.setAttribute('x2', 100 + Math.sin(a) * 88); l.setAttribute('y2', 100 - Math.cos(a) * 88);
      l.setAttribute('class', k % 5 ? 'g-tick' : 'g-tick big'); s.appendChild(l);
      if (!(k % 5)) {
        var tx = document.createElementNS(ns, 'text'); var hr = k / 5 || 12;
        tx.setAttribute('x', 100 + Math.sin(a) * 64); tx.setAttribute('y', 100 - Math.cos(a) * 64 + 6);
        tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('class', 'g-clock-num'); tx.textContent = hr; s.appendChild(tx);
      }
    }
    var hh = document.createElementNS(ns, 'line'); hh.setAttribute('class', 'g-hand-h');
    var mh = document.createElementNS(ns, 'line'); mh.setAttribute('class', 'g-hand-m');
    [hh, mh].forEach(function (h) { h.setAttribute('x1', 100); h.setAttribute('y1', 100); s.appendChild(h); });
    var dot = document.createElementNS(ns, 'circle'); dot.setAttribute('cx', 100); dot.setAttribute('cy', 100); dot.setAttribute('r', 5); dot.setAttribute('class', 'g-clock-dot'); s.appendChild(dot);
    s.set = function (h, m) {
      var ha = ((h % 12) + m / 60) * 30 * Math.PI / 180, ma = m * 6 * Math.PI / 180;
      hh.setAttribute('x2', 100 + Math.sin(ha) * 46); hh.setAttribute('y2', 100 - Math.cos(ha) * 46);
      mh.setAttribute('x2', 100 + Math.sin(ma) * 70); mh.setAttribute('y2', 100 - Math.cos(ma) * 70);
    };
    return s;
  }
  function parseT(s) { var p = String(s).split(':'); return { h: +p[0], m: +(p[1] || 0) }; }
  function fmtT(h, m) { h = ((h - 1) % 12 + 12) % 12 + 1; return h + '시' + (m ? ' ' + m + '분' : ''); }
  TYPES.clock = function (g) {
    var tasks = g.cfg.tasks, mode = g.cfg.mode || 'set', step = g.cfg.step || 5, i = 0, first = 0;
    function show() {
      if (i >= tasks.length) return g.finish({ score: first, total: tasks.length });
      var t = parseT(tasks[i]), tried = false;
      g.body.innerHTML = ''; g.body.appendChild(g.progress(i, tasks.length));
      var svg = clockSVG();
      function done() { if (!tried) first++; g.ok(); setTimeout(function () { i++; show(); }, 800); }
      if (mode === 'read') {
        svg.set(t.h, t.m);
        g.body.appendChild(el('div', 'g-q', '몇 시 몇 분일까?'));
        g.body.appendChild(svg);
        var right = fmtT(t.h, t.m), set = {}; set[right] = 1;
        var cand = [fmtT(t.h + 1, t.m), fmtT(t.h - 1, t.m), fmtT(t.m / 5 || 12, t.h * 5 % 60), fmtT(t.h, (t.m + 5) % 60), fmtT(t.h, (t.m + 55) % 60)];
        var opts = [right];
        cand.forEach(function (c) { if (!set[c] && opts.length < 4) { set[c] = 1; opts.push(c); } });
        var grid = el('div', 'g-opts');
        shuffle(opts).forEach(function (o) {
          var b = btn('g-opt', o, function () { if (o === right) { b.classList.add('is-right'); done(); } else { tried = true; g.no('짧은바늘은 "시", 긴바늘은 "분"이야', b); } });
          grid.appendChild(b);
        });
        g.body.appendChild(grid);
        return;
      }
      var h = 12, m = 0;
      g.body.appendChild(el('div', 'g-q', fmtT(t.h, t.m) + '을 만들어 봐'));
      svg.set(h, m); g.body.appendChild(svg);
      var ctr = el('div', 'g-clock-ctl');
      function upd() { svg.set(h, m); }
      ctr.appendChild(btn('g-btn ghost', '◀ 시', function () { h = h === 1 ? 12 : h - 1; upd(); }));
      ctr.appendChild(btn('g-btn ghost', '시 ▶', function () { h = h === 12 ? 1 : h + 1; upd(); }));
      ctr.appendChild(btn('g-btn ghost', '◀ 분', function () { m = (m - step + 60) % 60; upd(); }));
      ctr.appendChild(btn('g-btn ghost', '분 ▶', function () { m = (m + step) % 60; upd(); }));
      g.body.appendChild(ctr);
      g.body.appendChild(btn('g-btn', '확인', function () {
        if (h % 12 === t.h % 12 && m === t.m) done();
        else { tried = true; g.no('지금은 ' + fmtT(h, m) + '이야. 짧은바늘과 긴바늘을 다시 봐', svg); }
      }));
    }
    show();
  };

  /* ---- placevalue: {tasks:[325, 140], words?:true} ---- */
  TYPES.placevalue = function (g) {
    var tasks = g.cfg.tasks, i = 0, first = 0;
    var maxT = Math.max.apply(null, tasks);
    var cols = maxT >= 1000 ? [1000, 100, 10, 1] : maxT >= 100 ? [100, 10, 1] : [10, 1];
    var names = { 1000: '천', 100: '백', 10: '십', 1: '일' };
    function show() {
      if (i >= tasks.length) return g.finish({ score: first, total: tasks.length });
      var target = tasks[i], tried = false, cnt = {};
      cols.forEach(function (v) { cnt[v] = 0; });
      g.body.innerHTML = ''; g.body.appendChild(g.progress(i, tasks.length));
      var q = el('div', 'g-q', (g.cfg.words ? koNum(target) : target) + ' 을(를) 수 모형으로 만들어 봐');
      g.body.appendChild(q);
      if (g.cfg.words) g.body.appendChild(speakBtn(koNum(target)));
      var board = el('div', 'g-pv');
      var views = {};
      cols.forEach(function (v) {
        var col = el('div', 'g-pv-col');
        col.appendChild(el('div', 'g-pv-t', names[v] + ' 모형'));
        var view = el('div', 'g-pv-view v' + v); views[v] = view; col.appendChild(view);
        var ctl = el('div', 'g-pv-ctl');
        ctl.appendChild(btn('g-btn ghost sm', '−', function () { if (cnt[v] > 0) { cnt[v]--; draw(); } }));
        ctl.appendChild(btn('g-btn ghost sm', '+', function () { if (cnt[v] < 19) { cnt[v]++; draw(); } }));
        col.appendChild(ctl);
        if (v !== cols[0]) col.appendChild(btn('g-btn ghost sm g-pv-ex', '10개 묶기 ↑', function () { if (cnt[v] >= 10) { cnt[v] -= 10; cnt[v * 10]++; draw(); g.msg('10개를 묶어서 ' + names[v * 10] + ' 모형 1개로 바꿨어!', 'ok'); } else g.msg('10개가 있어야 묶을 수 있어'); }));
        board.appendChild(col);
      });
      function draw() { cols.forEach(function (v) { var w = views[v]; w.innerHTML = ''; for (var k = 0; k < cnt[v]; k++) w.appendChild(el('i', 'b' + v)); }); }
      g.body.appendChild(board);
      g.body.appendChild(btn('g-btn', '확인', function () {
        var sum = cols.reduce(function (s, v) { return s + v * cnt[v]; }, 0);
        if (sum === target) {
          if (!tried) first++;
          var over = cols.some(function (v) { return v !== cols[0] && cnt[v] >= 10; });
          g.ok(over ? '맞았어! 10개짜리는 윗자리 모형 1개로 바꿀 수도 있어' : null);
          setTimeout(function () { i++; show(); }, over ? 1600 : 800);
        } else { tried = true; g.no('지금 만든 수는 ' + sum + '이야', board); }
      }));
    }
    show();
  };

  /* ---- coins: {tasks:[750, {t:'🍦 아이스크림', p:1200}], coins?:[10,50,100,500,1000,5000]} ---- */
  TYPES.coins = function (g) {
    var tasks = g.cfg.tasks, coins = g.cfg.coins || [10, 50, 100, 500, 1000], i = 0, first = 0;
    function minCoins(n) { var c = 0, cs = coins.slice().sort(function (a, b) { return b - a; }); cs.forEach(function (v) { c += Math.floor(n / v); n %= v; }); return n ? Infinity : c; }
    function show() {
      if (i >= tasks.length) return g.finish({ score: first, total: tasks.length });
      var t = tasks[i], price = typeof t === 'number' ? t : t.p, label = typeof t === 'number' ? won(t) : t.t + ' ' + won(t.p);
      var tray = [], tried = false;
      g.body.innerHTML = ''; g.body.appendChild(g.progress(i, tasks.length));
      g.body.appendChild(el('div', 'g-q', label + '을(를) 내 볼까?'));
      var trayEl = el('div', 'g-tray');
      var sumEl = el('div', 'g-sum', '');
      function draw() {
        trayEl.innerHTML = '';
        if (!tray.length) trayEl.appendChild(el('span', 'g-hint', '아래 돈을 눌러 여기에 놓아요'));
        tray.forEach(function (v, k) { trayEl.appendChild(btn('g-coin c' + v, v >= 1000 ? v / 1000 + '천' : String(v), function () { tray.splice(k, 1); draw(); })); });
        sumEl.textContent = '';
      }
      var bank = el('div', 'g-bank');
      coins.forEach(function (v) { bank.appendChild(btn('g-coin c' + v, v >= 1000 ? v / 1000 + '천' : String(v), function () { if (tray.length < 30) { tray.push(v); draw(); } })); });
      g.body.appendChild(trayEl); g.body.appendChild(sumEl); g.body.appendChild(bank);
      var row = el('div', 'g-row');
      row.appendChild(btn('g-btn ghost', '합계 보기', function () { sumEl.textContent = '지금 ' + won(tray.reduce(function (s, v) { return s + v; }, 0)); }));
      row.appendChild(btn('g-btn', '확인', function () {
        var s = tray.reduce(function (a, v) { return a + v; }, 0);
        if (s === price) {
          if (!tried) first++;
          var best = minCoins(price);
          g.ok(tray.length > best ? '맞았어! 돈 ' + best + '개로도 낼 수 있어. 찾아볼래?' : '딱 맞고, 가장 적은 개수야!');
          setTimeout(function () { i++; show(); }, 1500);
        } else { tried = true; g.no(s > price ? '너무 많이 냈어' : '조금 모자라', trayEl); }
      }));
      g.body.appendChild(row);
      draw();
    }
    show();
  };

  /* ---- spell: {lang?:'ko-KR'|'en-US', words:['나무', {w:'학교', hint:'🏫'}], ignoreSpace?} ---- */
  TYPES.spell = function (g) {
    var lang = g.cfg.lang || 'ko-KR', words = shuffle(g.cfg.words.map(function (w) { return typeof w === 'string' ? { w: w } : w; })), i = 0, first = 0;
    var voiceOk = hasVoice(lang);
    function norm(s) { s = String(s).trim().replace(/[.!?,]/g, ''); if (g.cfg.ignoreSpace) s = s.replace(/\s+/g, ''); else s = s.replace(/\s+/g, ' '); return lang.indexOf('en') === 0 ? s.toLowerCase() : s; }
    function show() {
      if (i >= words.length) return g.finish({ score: first, total: words.length });
      var w = words[i], wrong = 0;
      g.body.innerHTML = ''; g.body.appendChild(g.progress(i, words.length));
      if (w.hint) g.body.appendChild(el('div', 'g-big', w.hint));
      var row = el('div', 'g-row');
      row.appendChild(btn('g-btn', '🔊 듣기', function () { say(w.w, lang); }));
      row.appendChild(btn('g-btn ghost', '🐢 천천히', function () { say(w.w, lang, 0.55); }));
      var peek = btn('g-btn ghost', '👀 부모용 보기', null);
      var peekT = el('span', 'g-peek', w.w);
      peek.addEventListener('pointerdown', function () { peekT.classList.add('is-on'); });
      ['pointerup', 'pointerleave'].forEach(function (e) { peek.addEventListener(e, function () { peekT.classList.remove('is-on'); }); });
      row.appendChild(peek); row.appendChild(peekT);
      g.body.appendChild(row);
      if (!voiceOk) g.body.appendChild(el('p', 'g-hint', '이 기기에서 소리가 안 나오면 엄마 아빠가 "부모용 보기"를 눌러 읽어 주세요.'));
      var inp = el('input', 'g-input'); inp.type = 'text'; inp.autocomplete = 'off'; inp.setAttribute('autocapitalize', 'off'); inp.setAttribute('spellcheck', 'false');
      inp.placeholder = '들은 대로 써 봐';
      g.body.appendChild(inp);
      function check() {
        if (!inp.value.trim()) return;
        if (norm(inp.value) === norm(w.w)) { if (!wrong) first++; g.ok(); setTimeout(function () { i++; show(); }, 800); }
        else { wrong++; g.no(wrong >= 2 ? '정답: ' + w.w + ' (어디가 달랐는지 비교해 봐)' : '한 번 더 들어 볼까?', inp); }
      }
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) check(); });
      g.body.appendChild(btn('g-btn', '확인', check));
      setTimeout(function () { say(w.w, lang); }, 300);
    }
    show();
  };

  /* ---- hangul: {targets:[{w:'나무', pic:'🌳'}]} ---- */
  var CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  var JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
  var JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  function decomp(ch) { var c = ch.charCodeAt(0) - 0xAC00; if (c < 0 || c > 11171) return null; return { cho: Math.floor(c / 588), jung: Math.floor((c % 588) / 28), jong: c % 28 }; }
  function comp(a, b, c) { return String.fromCharCode(0xAC00 + (a * 21 + b) * 28 + c); }
  TYPES.hangul = function (g) {
    var targets = g.cfg.targets.map(function (t) { return typeof t === 'string' ? { w: t } : t; }), i = 0, first = 0;
    var baseCho = [0, 2, 3, 5, 6, 7, 9, 11, 12, 14, 15, 16, 17, 18];
    var baseJung = [0, 2, 4, 6, 8, 12, 13, 17, 18, 20];
    var baseJong = [0, 1, 4, 7, 8, 16, 17, 19, 21];
    function show() {
      if (i >= targets.length) return g.finish({ score: first, total: targets.length });
      var t = targets[i], syl = t.w.split(''), si = 0, tried = false, cur = { cho: -1, jung: -1, jong: 0 };
      var needCho = baseCho.slice(), needJung = baseJung.slice(), needJong = baseJong.slice();
      syl.forEach(function (s) { var d = decomp(s); if (!d) return; if (needCho.indexOf(d.cho) < 0) needCho.push(d.cho); if (needJung.indexOf(d.jung) < 0) needJung.push(d.jung); if (needJong.indexOf(d.jong) < 0) needJong.push(d.jong); });
      needCho.sort(function (a, b) { return a - b; }); needJung.sort(function (a, b) { return a - b; }); needJong.sort(function (a, b) { return a - b; });
      g.body.innerHTML = ''; g.body.appendChild(g.progress(i, targets.length));
      var head = el('div', 'g-row');
      if (t.pic) head.appendChild(el('span', 'g-big inline', t.pic));
      head.appendChild(btn('g-btn', '🔊 들어 보기', function () { say(t.w); }));
      g.body.appendChild(head);
      var slots = el('div', 'g-hslots');
      syl.forEach(function () { slots.appendChild(el('span', 'g-hslot')); });
      g.body.appendChild(slots);
      var preview = el('div', 'g-hprev', '?');
      g.body.appendChild(preview);
      function upd() {
        var bits = [];
        if (cur.cho >= 0 && cur.jung >= 0) preview.textContent = comp(cur.cho, cur.jung, cur.jong);
        else { if (cur.cho >= 0) bits.push(CHO[cur.cho]); if (cur.jung >= 0) bits.push(JUNG[cur.jung]); preview.textContent = bits.join(' + ') || '?'; }
        [].forEach.call(g.body.querySelectorAll('.g-jamo'), function (b) { b.classList.toggle('is-sel', +b.getAttribute('data-v') === cur[b.getAttribute('data-k')]); });
      }
      function rowOf(label, list, arr, k) {
        var r = el('div', 'g-jrow'); r.appendChild(el('span', 'g-jlab', label));
        list.forEach(function (v) { var b = btn('g-jamo', arr[v] || '없음', function () { cur[k] = v; upd(); }); b.setAttribute('data-v', v); b.setAttribute('data-k', k); r.appendChild(b); });
        return r;
      }
      g.body.appendChild(rowOf('첫소리', needCho, CHO, 'cho'));
      g.body.appendChild(rowOf('가운데', needJung, JUNG, 'jung'));
      g.body.appendChild(rowOf('받침', needJong, JONG, 'jong'));
      g.body.appendChild(btn('g-btn', '글자 넣기', function () {
        if (cur.cho < 0 || cur.jung < 0) { g.msg('첫소리와 가운데 소리를 골라요'); return; }
        var made = comp(cur.cho, cur.jung, cur.jong);
        if (made === syl[si]) {
          slots.children[si].textContent = made; slots.children[si].classList.add('is-filled'); si++;
          cur = { cho: -1, jung: -1, jong: 0 }; upd();
          if (si === syl.length) { if (!tried) first++; g.ok(t.w + '!'); say(t.w); setTimeout(function () { i++; show(); }, 1200); }
          else g.ok(' ');
        } else { tried = true; g.no(made + '(이)가 됐어. 소리를 다시 들어 볼까?', preview); }
      }));
      upd();
    }
    show();
  };

  /* ---- rhythm: {bpm?:80, patterns:[[1,1,0.5,0.5,1]], tolerance?:0.28}  negative = rest ---- */
  TYPES.rhythm = function (g) {
    var bpm = g.cfg.bpm || 80, beat = 60 / bpm, pats = g.cfg.patterns, i = 0, passed = 0, tol = g.cfg.tolerance || 0.28;
    var SYM = { 1: '♩', 0.5: '♪', 2: '♩ ─', 1.5: '♩.', 0.25: '♬', 3: '♩ ─ ─', 4: '𝅝' };
    function show() {
      if (i >= pats.length) return g.finish({ score: passed, total: pats.length });
      var p = pats[i];
      g.body.innerHTML = ''; g.body.appendChild(g.progress(i, pats.length));
      var line = el('div', 'g-rline');
      p.forEach(function (d) { var n = el('span', 'g-rnote' + (d < 0 ? ' rest' : ''), d < 0 ? '쉼' : (SYM[d] || '♩')); n.style.flexGrow = Math.abs(d); line.appendChild(n); });
      g.body.appendChild(line);
      var onsets = [], tt = 0; p.forEach(function (d) { if (d > 0) onsets.push(tt); tt += Math.abs(d); });
      var row = el('div', 'g-row');
      row.appendChild(btn('g-btn', '▶ 들어 보기', function () {
        for (var k = 0; k < 4; k++) click(k === 0, k * beat);
        var nodes = line.children, t2 = 0;
        p.forEach(function (d, k) {
          var when = 4 * beat + t2 * beat;
          if (d > 0) tone(880, 0.09, 'square', when, 0.14);
          (function (n, w) { setTimeout(function () { n.classList.add('is-play'); setTimeout(function () { n.classList.remove('is-play'); }, 180); }, w * 1000); })(nodes[k], when);
          t2 += Math.abs(d);
        });
        g.msg('"하나, 둘, 셋, 넷" 다음에 리듬이 나와요');
      }));
      g.body.appendChild(row);
      var taps = [];
      var pad = btn('g-pad-big', '🥁 여기를 두드려요', function () {
        var now = performance.now() / 1000;
        taps.push(now); tone(660, 0.06, 'triangle', 0, 0.12); pad.classList.add('is-hit'); setTimeout(function () { pad.classList.remove('is-hit'); }, 90);
        if (taps.length === onsets.length) judge();
      });
      g.body.appendChild(pad);
      function judge() {
        var res = el('div', 'g-rres'), okAll = true;
        onsets.forEach(function (o, k) {
          var actual = (taps[k] - taps[0]) / beat + onsets[0], err = Math.abs(actual - o), ok = err <= tol;
          if (!ok) okAll = false;
          res.appendChild(el('i', ok ? 'ok' : 'no'));
        });
        g.body.appendChild(res);
        if (okAll) { passed++; g.ok('박자가 딱 맞았어!'); setTimeout(function () { i++; show(); }, 1200); }
        else { g.no('빨간 점이 박자가 어긋난 곳이야. 다시 해 볼까?', pad); setTimeout(function () { taps = []; if (res.parentNode) res.parentNode.removeChild(res); }, 1400); }
      }
      g.body.appendChild(btn('g-btn ghost sm', '건너뛰기 →', function () { i++; show(); }));
    }
    show();
  };

  /* ---- robot: {levels:[{size:5, start:[0,4,'N'], goal:[4,0], walls:[[1,1]]}], repeat?:true} ---- */
  TYPES.robot = function (g) {
    var levels = g.cfg.levels, li = 0, cleared = 0;
    var DIRS = ['N', 'E', 'S', 'W'], DX = { N: 0, E: 1, S: 0, W: -1 }, DY = { N: -1, E: 0, S: 1, W: 0 }, ROT = { N: 0, E: 90, S: 180, W: 270 };
    function show() {
      if (li >= levels.length) return g.finish({ score: cleared, total: levels.length, label: levels.length + '단계 모두 통과!' });
      var L = levels[li], n = L.size || 5, prog = [], running = false;
      var walls = {}; (L.walls || []).forEach(function (w) { walls[w[0] + ',' + w[1]] = 1; });
      g.body.innerHTML = ''; g.body.appendChild(g.progress(li, levels.length));
      g.body.appendChild(el('p', 'g-q', (L.say || '로봇을 🏁 까지 보내 줘!')));
      var grid = el('div', 'g-rgrid'); grid.style.gridTemplateColumns = 'repeat(' + n + ', 1fr)';
      var cells = [];
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        var c = el('div', 'g-rcell' + (walls[x + ',' + y] ? ' wall' : ''));
        if (x === L.goal[0] && y === L.goal[1]) c.textContent = '🏁';
        grid.appendChild(c); cells.push(c);
      }
      var bot = el('div', 'g-bot', '🤖');
      grid.appendChild(bot);
      var st;
      function place(s) { bot.style.left = (s.x * 100 / n) + '%'; bot.style.top = (s.y * 100 / n) + '%'; bot.style.width = bot.style.height = (100 / n) + '%'; bot.style.transform = 'rotate(' + ROT[s.d] + 'deg)'; }
      function reset() { st = { x: L.start[0], y: L.start[1], d: L.start[2] || 'N' }; place(st); }
      reset();
      g.body.appendChild(grid);
      var strip = el('div', 'g-prog-strip');
      function drawProg() {
        strip.innerHTML = '';
        if (!prog.length) strip.appendChild(el('span', 'g-hint', '아래 명령 블록을 눌러 순서대로 쌓아요'));
        prog.forEach(function (p, k) { var b = btn('g-block ' + p.c, (p.c === 'f' ? '⬆ 앞으로' : p.c === 'l' ? '↰ 왼쪽' : '↱ 오른쪽') + (p.n > 1 ? ' ×' + p.n : ''), function () { if (!running) { prog.splice(k, 1); drawProg(); } }); strip.appendChild(b); });
      }
      g.body.appendChild(strip);
      var blocks = el('div', 'g-row');
      [['f', '⬆ 앞으로'], ['l', '↰ 왼쪽으로 돌기'], ['r', '↱ 오른쪽으로 돌기']].forEach(function (b) { blocks.appendChild(btn('g-block ' + b[0], b[1], function () { if (!running && prog.length < 24) { prog.push({ c: b[0], n: 1 }); drawProg(); } })); });
      if (g.cfg.repeat) blocks.appendChild(btn('g-block rep', '🔁 마지막 블록 반복', function () { if (prog.length && !running) { var p = prog[prog.length - 1]; p.n = p.n >= 4 ? 1 : p.n + 1; drawProg(); } }));
      g.body.appendChild(blocks);
      var ctl = el('div', 'g-row');
      ctl.appendChild(btn('g-btn', '▶ 실행', run));
      ctl.appendChild(btn('g-btn ghost', '⌫ 하나 지우기', function () { if (!running) { prog.pop(); drawProg(); } }));
      ctl.appendChild(btn('g-btn ghost', '⟲ 로봇 제자리', function () { if (!running) { reset(); g.msg(''); } }));
      g.body.appendChild(ctl);
      drawProg();
      function run() {
        if (running || !prog.length) return;
        running = true; reset();
        var steps = []; prog.forEach(function (p, k) { for (var r = 0; r < p.n; r++) steps.push({ c: p.c, k: k }); });
        var s = 0;
        function stepFn() {
          [].forEach.call(strip.children, function (b) { b.classList.remove('is-run'); });
          if (s >= steps.length) {
            running = false;
            if (st.x === L.goal[0] && st.y === L.goal[1]) { cleared++; g.ok('도착! 프로그램 성공!'); setTimeout(function () { li++; show(); }, 1100); }
            else g.no('아직 도착하지 않았어. 어느 블록을 고치면 될까? (디버깅!)', grid);
            return;
          }
          var cmd = steps[s]; if (strip.children[cmd.k]) strip.children[cmd.k].classList.add('is-run');
          if (cmd.c === 'f') {
            var nx = st.x + DX[st.d], ny = st.y + DY[st.d];
            if (nx < 0 || ny < 0 || nx >= n || ny >= n || walls[nx + ',' + ny]) { running = false; g.no('앗, 부딪혔어! ' + (cmd.k + 1) + '번째 블록을 살펴볼까?', grid); return; }
            st.x = nx; st.y = ny;
          } else { var di = DIRS.indexOf(st.d); st.d = DIRS[(di + (cmd.c === 'r' ? 1 : 3)) % 4]; }
          place(st); s++; setTimeout(stepFn, 420);
        }
        stepFn();
      }
    }
    show();
  };

  /* ---- grid: {size?:10, tasks:[{type:'area', n:12}, {type:'perimeter', n:14}]} ---- */
  TYPES.grid = function (g) {
    var n = g.cfg.size || 10, tasks = g.cfg.tasks, i = 0, first = 0;
    function show() {
      if (i >= tasks.length) return g.finish({ score: first, total: tasks.length });
      var t = tasks[i], tried = false, a = null, b = null, dragging = false;
      g.body.innerHTML = ''; g.body.appendChild(g.progress(i, tasks.length));
      g.body.appendChild(el('div', 'g-q', t.type === 'perimeter' ? '둘레가 ' + t.n + 'cm인 직사각형을 그려 봐' : '넓이가 ' + t.n + '㎠인 직사각형을 그려 봐'));
      g.body.appendChild(el('p', 'g-hint', '모눈 한 칸은 가로·세로 1cm예요. 한 칸에서 시작해 끌어서 그려요.'));
      var grid = el('div', 'g-mgrid'); grid.style.gridTemplateColumns = 'repeat(' + n + ', 1fr)';
      var cells = [];
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) { var c = el('div', 'g-mcell'); c.setAttribute('data-x', x); c.setAttribute('data-y', y); grid.appendChild(c); cells.push(c); }
      var info = el('div', 'g-sum', '');
      function cellAt(e) { var r = grid.getBoundingClientRect(); var x = Math.floor((e.clientX - r.left) / r.width * n), y = Math.floor((e.clientY - r.top) / r.height * n); return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) }; }
      function paint() {
        if (!a || !b) return;
        var x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
        cells.forEach(function (c) { var x = +c.getAttribute('data-x'), y = +c.getAttribute('data-y'); c.classList.toggle('is-on', x >= x0 && x <= x1 && y >= y0 && y <= y1); });
        info.textContent = '가로 ' + (x1 - x0 + 1) + '칸 · 세로 ' + (y1 - y0 + 1) + '칸';
      }
      grid.addEventListener('pointerdown', function (e) { e.preventDefault(); dragging = true; a = b = cellAt(e); try { grid.setPointerCapture(e.pointerId); } catch (x) {} paint(); });
      grid.addEventListener('pointermove', function (e) { if (dragging) { b = cellAt(e); paint(); } });
      grid.addEventListener('pointerup', function () { dragging = false; });
      g.body.appendChild(grid); g.body.appendChild(info);
      g.body.appendChild(btn('g-btn', '확인', function () {
        if (!a || !b) return g.msg('먼저 직사각형을 그려요');
        var w = Math.abs(a.x - b.x) + 1, h = Math.abs(a.y - b.y) + 1, area = w * h, per = 2 * (w + h);
        var ok = t.type === 'perimeter' ? per === t.n : area === t.n;
        if (ok) { if (!tried) first++; g.ok('가로 ' + w + ' × 세로 ' + h + ' → 넓이 ' + area + '㎠, 둘레 ' + per + 'cm'); setTimeout(function () { i++; show(); }, 1700); }
        else { tried = true; g.no('지금은 넓이 ' + area + '㎠, 둘레 ' + per + 'cm야', grid); }
      }));
    }
    show();
  };

  /* ---- angle: {mode:'classify'|'estimate', count?:8} ---- */
  TYPES.angle = function (g) {
    var mode = g.cfg.mode || 'classify', n = g.cfg.count || 8, i = 0, first = 0;
    function draw(deg) {
      var ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'); s.setAttribute('viewBox', '0 0 240 150'); s.setAttribute('class', 'g-angle');
      var cx = 40, cy = 130, r = 170, rad = deg * Math.PI / 180;
      var l1 = document.createElementNS(ns, 'line'); l1.setAttribute('x1', cx); l1.setAttribute('y1', cy); l1.setAttribute('x2', cx + r); l1.setAttribute('y2', cy);
      var l2 = document.createElementNS(ns, 'line'); l2.setAttribute('x1', cx); l2.setAttribute('y1', cy); l2.setAttribute('x2', cx + Math.cos(rad) * 110); l2.setAttribute('y2', cy - Math.sin(rad) * 110);
      var arc = document.createElementNS(ns, 'path'); var ar = 30;
      arc.setAttribute('d', 'M' + (cx + ar) + ' ' + cy + ' A' + ar + ' ' + ar + ' 0 ' + (deg > 180 ? 1 : 0) + ' 0 ' + (cx + Math.cos(rad) * ar) + ' ' + (cy - Math.sin(rad) * ar));
      arc.setAttribute('class', 'g-arc');
      [l1, l2].forEach(function (l) { l.setAttribute('class', 'g-ray'); s.appendChild(l); }); s.appendChild(arc);
      if (deg === 90) { var sq = document.createElementNS(ns, 'path'); sq.setAttribute('d', 'M' + (cx + 14) + ' ' + cy + ' V' + (cy - 14) + ' H' + cx); sq.setAttribute('class', 'g-arc'); s.appendChild(sq); }
      return s;
    }
    function show() {
      if (i >= n) return g.finish({ score: first, total: n });
      var tried = false, deg, right, opts;
      if (mode === 'estimate') {
        deg = pick([30, 45, 60, 90, 120, 135, 150]);
        right = deg + '°'; var others = shuffle([30, 45, 60, 90, 120, 135, 150, 180].filter(function (d) { return d !== deg && Math.abs(d - deg) >= 25; })).slice(0, 3);
        opts = shuffle([right].concat(others.map(function (d) { return d + '°'; })));
      } else {
        deg = Math.random() < 0.25 ? 90 : Math.random() < 0.5 ? rnd(15, 80) : rnd(100, 170);
        right = deg < 90 ? '예각' : deg === 90 ? '직각' : '둔각'; opts = ['예각', '직각', '둔각'];
      }
      g.body.innerHTML = ''; g.body.appendChild(g.progress(i, n));
      g.body.appendChild(el('div', 'g-q', mode === 'estimate' ? '이 각은 대략 몇 도일까?' : '이 각의 이름은?'));
      g.body.appendChild(draw(deg));
      var grid = el('div', 'g-opts' + (opts.length === 3 ? ' three' : ''));
      opts.forEach(function (o) {
        var b = btn('g-opt', o, function () {
          if (o === right) { b.classList.add('is-right'); if (!tried) first++; g.ok(mode === 'classify' ? deg + '°라서 ' + right + '이야' : null); setTimeout(function () { i++; show(); }, 1000); }
          else { tried = true; g.no(mode === 'classify' ? '직각(90°)보다 작으면 예각, 크면 둔각' : '직각(90°)과 비교해 봐', b); }
        });
        grid.appendChild(b);
      });
      g.body.appendChild(grid);
    }
    show();
  };

  /* ---- color: {tasks?:['주황','초록','보라'] } (free play if no tasks) ---- */
  var PAINT = { '빨강': '#e53935', '노랑': '#fdd835', '파랑': '#1e5fd6', '흰색': '#ffffff', '검정': '#222222' };
  var MIX = {
    '노랑+빨강': ['주황', '#fb8c00'], '노랑+파랑': ['초록', '#2e9d4a'], '빨강+파랑': ['보라', '#8e24aa'],
    '빨강+흰색': ['분홍', '#f48fb1'], '파랑+흰색': ['하늘색', '#81d4fa'], '노랑+흰색': ['연노랑', '#fff59d'],
    '검정+빨강': ['어두운 빨강', '#8b1a1a'], '검정+파랑': ['남색', '#1a2a6c'], '검정+노랑': ['올리브색', '#7d7a1c'],
    '검정+흰색': ['회색', '#9e9e9e']
  };
  TYPES.color = function (g) {
    var tasks = g.cfg.tasks || [], i = 0, first = 0;
    function show() {
      if (tasks.length && i >= tasks.length) return g.finish({ score: first, total: tasks.length });
      var target = tasks[i], dish = [], tried = false;
      g.body.innerHTML = '';
      if (tasks.length) { g.body.appendChild(g.progress(i, tasks.length)); g.body.appendChild(el('div', 'g-q', target + ' 색을 만들어 볼까? 물감 두 가지를 골라요')); }
      else g.body.appendChild(el('div', 'g-q', '물감 두 가지를 섞으면 무슨 색이 될까?'));
      var swatch = el('div', 'g-swatch'), name = el('div', 'g-sum', '');
      function mix() {
        if (!dish.length) { swatch.style.background = 'var(--paper-2)'; name.textContent = '접시가 비어 있어요'; return null; }
        if (dish.length === 1) { swatch.style.background = PAINT[dish[0]]; name.textContent = dish[0]; return dish[0]; }
        if (dish[0] === dish[1]) { swatch.style.background = PAINT[dish[0]]; name.textContent = dish[0]; return dish[0]; }
        var k = dish.slice().sort().join('+'), r = MIX[k];
        if (r) { swatch.style.background = r[1]; name.textContent = dish.join(' + ') + ' = ' + r[0]; return r[0]; }
        return null;
      }
      var dishEl = el('div', 'g-row');
      function drawDish() { dishEl.innerHTML = ''; dish.forEach(function (c, k) { var b = btn('g-paint sm', c, function () { dish.splice(k, 1); drawDish(); }); b.style.setProperty('--pc', PAINT[c]); dishEl.appendChild(b); }); mix(); }
      var pal = el('div', 'g-row');
      Object.keys(PAINT).forEach(function (c) { var b = btn('g-paint', c, function () { if (dish.length >= 2) dish.shift(); dish.push(c); drawDish(); }); b.style.setProperty('--pc', PAINT[c]); pal.appendChild(b); });
      g.body.appendChild(pal); g.body.appendChild(el('p', 'g-hint', '팔레트 접시 (누르면 빼기)')); g.body.appendChild(dishEl);
      g.body.appendChild(swatch); g.body.appendChild(name);
      if (tasks.length) g.body.appendChild(btn('g-btn', '확인', function () {
        var got = mix();
        if (got === target) { if (!tried) first++; g.ok(); setTimeout(function () { i++; show(); }, 1000); }
        else { tried = true; g.no(got ? got + '이(가) 나왔어. 다른 조합을 찾아볼까?' : '두 가지 물감을 골라 봐', swatch); }
      }));
      drawDish();
    }
    show();
  };

  /* ---- timer: {rounds?:1, warmup?:[..], steps:[{t:'모아뛰기', s:30, emoji:'🪢'}, {t:'쉬기', s:15}], cooldown?:[..]}  (only steps repeat) ---- */
  TYPES.timer = function (g) {
    var steps = g.cfg.steps, rounds = g.cfg.rounds || 1, warm = g.cfg.warmup || [], cool = g.cfg.cooldown || [];
    var list = el('ol', 'g-tlist');
    warm.concat(steps, cool).forEach(function (s) { list.appendChild(el('li', '', (s.emoji ? s.emoji + ' ' : '') + s.t + ' · ' + s.s + '초')); });
    g.body.appendChild(list);
    if (rounds > 1) g.body.appendChild(el('p', 'g-hint', (warm.length || cool.length ? '본 운동을 ' : '') + rounds + '바퀴 반복해요'));
    var face = el('div', 'g-tface'), label = el('div', 'g-q', ''), bar = el('div', 'meter'), fill = el('i');
    bar.appendChild(fill);
    var go = btn('g-btn big', '▶ 시작', start);
    g.body.appendChild(go);
    var timerId = null;
    function start() {
      go.remove(); g.body.appendChild(label); g.body.appendChild(face); g.body.appendChild(bar);
      var seq = warm.map(function (s) { return { s: s }; }); for (var r = 0; r < rounds; r++) steps.forEach(function (s) { seq.push({ s: s, r: r + 1 }); }); cool.forEach(function (s) { seq.push({ s: s }); });
      var k = 0;
      var stop = btn('g-btn ghost', '■ 멈추기', function () { clearInterval(timerId); g.msg('멈췄어요'); stop.remove(); });
      g.body.appendChild(stop);
      function runStep() {
        if (k >= seq.length) { clearInterval(timerId); stop.remove(); return g.finish({ score: 1, total: 1, label: '끝까지 해냈어요! 물 한 잔 마시자 💧' }); }
        var s = seq[k].s, rr = seq[k].r, left = s.s;
        label.textContent = (s.emoji ? s.emoji + ' ' : '') + s.t + (rounds > 1 && rr ? ' (' + rr + '/' + rounds + '바퀴)' : '');
        say(s.t); tone(880, 0.15, 'triangle');
        face.textContent = left;
        fill.style.setProperty('--v', 100);
        clearInterval(timerId);
        timerId = setInterval(function () {
          if (!document.body.contains(face)) return clearInterval(timerId);
          left--; face.textContent = left; fill.style.setProperty('--v', left / s.s * 100);
          if (left <= 3 && left > 0) click(false);
          if (left <= 0) { k++; runStep(); }
        }, 1000);
      }
      runStep();
    }
  };

  /* ---- binary: {tasks:[5, 12, 21], bits?:5} ---- */
  TYPES.binary = function (g) {
    var bits = g.cfg.bits || 5, tasks = g.cfg.tasks, i = 0, first = 0;
    function show() {
      if (i >= tasks.length) return g.finish({ score: first, total: tasks.length });
      var target = tasks[i], tried = false, on = [];
      g.body.innerHTML = ''; g.body.appendChild(g.progress(i, tasks.length));
      g.body.appendChild(el('div', 'g-q', '카드를 뒤집어 점을 ' + target + '개 만들어 봐'));
      var row = el('div', 'g-bin'), code = el('div', 'g-sum', '');
      for (var k = bits - 1; k >= 0; k--) {
        (function (v) {
          var c = btn('g-bcard', '');
          var dots = el('span', 'g-bdots'); for (var d = 0; d < v; d++) dots.appendChild(el('i'));
          c.appendChild(dots); c.appendChild(el('span', 'g-bval', String(v)));
          c.addEventListener('click', function () { c.classList.toggle('is-on'); var idx = on.indexOf(v); if (idx >= 0) on.splice(idx, 1); else on.push(v); upd(); });
          c.setAttribute('data-v', v);
          row.appendChild(c);
        })(Math.pow(2, k));
      }
      function upd() { var s = ''; [].forEach.call(row.children, function (c) { s += c.classList.contains('is-on') ? '1' : '0'; }); code.textContent = '이진수: ' + s; }
      g.body.appendChild(row); g.body.appendChild(code);
      g.body.appendChild(btn('g-btn', '확인', function () {
        var sum = on.reduce(function (a, v) { return a + v; }, 0);
        if (sum === target) { if (!tried) first++; g.ok(target + ' = ' + code.textContent.replace('이진수: ', '') + ' (이진수)'); setTimeout(function () { i++; show(); }, 1400); }
        else { tried = true; g.no('지금 점은 ' + sum + '개야', row); }
      }));
      upd();
    }
    show();
  };

  /* ---------------- init ---------------- */
  // Lazy-mount: only games that are actually displayed (pages hold many games inside closed
  // accordions / hidden tabs). Re-scan whenever an accordion opens or a tab changes.
  function init(root) {
    var list = (root || document).querySelectorAll('.game[data-game]:not([data-ready])');
    for (var k = 0; k < list.length; k++) {
      if (list[k].offsetParent !== null || list[k].getClientRects().length) mount(list[k], k);
    }
  }
  var pending = null;
  function rescan() { clearTimeout(pending); pending = setTimeout(function () { init(); }, 30); }
  document.addEventListener('toggle', rescan, true);
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.tab-list, summary, [data-kid-toggle], .mode-btn')) rescan(); }, true);
  window.addEventListener('hashchange', rescan);
  window.LearningGames = { init: init, types: Object.keys(TYPES), koNum: koNum };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); }); else init();
})();
