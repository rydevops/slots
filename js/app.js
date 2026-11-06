// Gem Royale – UI / game loop
(function () {
  const E = window.Engine;
  const $ = id => document.getElementById(id);

  const LINE_BETS = [1, 2, 5, 10, 25, 50];
  const START_CREDITS = 2000;
  const STORE_KEY = 'gem-royale-state-v1';
  const LINE_COLORS = ['#ffd84a','#ff4d6d','#4dd2ff','#7dff8a','#ff9a3c','#c77dff','#ff66c4','#5eead4',
    '#fde047','#60a5fa','#f472b6','#a3e635','#fb923c','#38bdf8','#e879f9','#34d399','#facc15','#f87171','#818cf8','#2dd4bf'];

  const state = {
    credits: START_CREDITS,
    betIdx: 0,
    lastWin: 0,
    grid: E.spinGrid(),
    spinning: false,
    freeSpins: 0,
    freeSpinTotal: 0,
    freeSpinWin: 0,
    auto: false,
  };

  // ---------- persistence ----------
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (s) {
        if (Number.isFinite(s.credits)) state.credits = s.credits;
        if (Number.isInteger(s.betIdx) && s.betIdx >= 0 && s.betIdx < LINE_BETS.length) state.betIdx = s.betIdx;
        if (Number.isInteger(s.freeSpins)) state.freeSpins = s.freeSpins;
        if (Number.isInteger(s.freeSpinTotal)) state.freeSpinTotal = s.freeSpinTotal;
        if (Number.isFinite(s.freeSpinWin)) state.freeSpinWin = s.freeSpinWin;
      }
    } catch (e) { /* ignore */ }
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        credits: state.credits, betIdx: state.betIdx,
        freeSpins: state.freeSpins, freeSpinTotal: state.freeSpinTotal, freeSpinWin: state.freeSpinWin,
      }));
    } catch (e) { /* ignore */ }
  }

  const lineBet = () => LINE_BETS[state.betIdx];
  const totalBet = () => lineBet() * E.LINES.length;
  const fmt = n => Math.round(n).toLocaleString('en-US');

  // ---------- sprites ----------
  // .gem (window) > .gem-row (shifted to the symbol's row) > .gem-frames (stepped across frames)
  function gemEl(symbol, frame = 0) {
    const d = document.createElement('div');
    d.className = 'gem';
    const row = document.createElement('div');
    row.className = 'gem-row';
    row.style.transform = `translateY(${(-symbol * 100) / 15}%)`;
    const frames = document.createElement('div');
    frames.className = 'gem-frames';
    if (frame) frames.style.transform = `translateX(${-frame * 20}%)`;
    row.appendChild(frames);
    d.appendChild(row);
    return d;
  }
  function cellEl(symbol) {
    const c = document.createElement('div');
    c.className = 'cell';
    c.appendChild(gemEl(symbol));
    return c;
  }

  // ---------- reels ----------
  const reelWindow = $('reelWindow');
  const reels = Array.from(document.querySelectorAll('.reel'));
  const strips = reels.map(r => r.querySelector('.strip'));
  let cellH = 0;

  function measure() {
    cellH = reelWindow.clientHeight / E.ROWS;
    reelWindow.style.setProperty('--cellH', cellH + 'px');
  }

  function renderStatic(reelIdx, symbols) {
    const strip = strips[reelIdx];
    strip.replaceChildren(...symbols.map(cellEl));
    strip.style.transform = 'translateY(0)';
  }

  function cellAt(reel, row) { return strips[reel].children[row]; }

  let activeAnims = [];
  function spinReels(finalGrid, quick) {
    measure();
    const prev = state.grid;
    const promises = [];
    activeAnims = [];
    for (let r = 0; r < E.REELS; r++) {
      const filler = 14 + r * 5;
      const symbols = [...finalGrid[r]];
      for (let i = 0; i < filler; i++) symbols.push(E.randomSymbol());
      symbols.push(...prev[r]);
      const strip = strips[r];
      strip.replaceChildren(...symbols.map(cellEl));
      const distance = (symbols.length - E.ROWS) * cellH;
      const duration = quick ? 350 + r * 90 : 900 + r * 280;
      const anim = strip.animate(
        [
          { transform: `translateY(${-distance}px)`, offset: 0 },
          { transform: `translateY(${-distance + cellH * 0.35}px)`, offset: 0.06, easing: 'cubic-bezier(.4,0,.2,1)' },
          { transform: `translateY(${cellH * 0.12}px)`, offset: 0.9, easing: 'ease-out' },
          { transform: 'translateY(0px)', offset: 1 },
        ],
        { duration, easing: 'linear', fill: 'forwards' }
      );
      activeAnims.push(anim);
      promises.push(anim.finished.catch(() => {}).then(() => {
        anim.cancel();
        renderStatic(r, finalGrid[r]);
      }));
    }
    return Promise.all(promises);
  }

  function slamStop() {
    for (const a of activeAnims) {
      const dur = a.effect.getComputedTiming().duration;
      if (a.playState === 'running' && a.currentTime < dur - 180) a.currentTime = dur - 180;
    }
  }

  // ---------- HUD ----------
  function updateHud() {
    $('credits').textContent = fmt(state.credits);
    $('bet').textContent = state.freeSpins > 0 ? 'FREE' : fmt(totalBet());
    $('win').textContent = fmt(state.lastWin);
    const fs = state.freeSpinTotal > 0;
    $('fsBar').hidden = !fs;
    if (fs) $('fsCount').textContent = `${state.freeSpinTotal - state.freeSpins} / ${state.freeSpinTotal}`;
    const lock = state.spinning || state.freeSpins > 0;
    $('btnMinus').disabled = lock || state.betIdx === 0;
    $('btnPlus').disabled = lock || state.betIdx === LINE_BETS.length - 1;
    $('btnSpin').classList.toggle('on', state.spinning || state.auto || state.freeSpins > 0);
    $('autoChip').hidden = !state.auto;
  }

  let countTimer = null;
  function countUp(target, ms = 900) {
    clearInterval(countTimer);
    const start = performance.now();
    const el = $('win');
    countTimer = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms);
      el.textContent = fmt(target * (1 - Math.pow(1 - t, 3)));
      if (t >= 1) clearInterval(countTimer);
    }, 30);
  }

  let toastTimer = null;
  function toast(msg, ms = 2200) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  // ---------- win presentation ----------
  let presentTimer = null;
  const lineLayer = $('lineLayer');
  const SVGNS = 'http://www.w3.org/2000/svg';

  function clearPresentation() {
    clearTimeout(presentTimer);
    presentTimer = null;
    lineLayer.replaceChildren();
    reelWindow.classList.remove('dim');
    document.querySelectorAll('.cell.hit').forEach(c => c.classList.remove('hit'));
    $('winLabel').hidden = true;
    $('bigWin').hidden = true;
  }

  function drawLine(li) {
    const pts = E.LINES[li].map((row, reel) => `${reel * 100 + 50},${row * 100 + 50}`);
    pts.unshift(`0,${E.LINES[li][0] * 100 + 50}`);
    pts.push(`500,${E.LINES[li][4] * 100 + 50}`);
    const p = document.createElementNS(SVGNS, 'polyline');
    p.setAttribute('points', pts.join(' '));
    p.setAttribute('stroke', LINE_COLORS[li % LINE_COLORS.length]);
    lineLayer.appendChild(p);
  }

  function highlight(cells) {
    cells.forEach(([reel, row]) => { const c = cellAt(reel, row); if (c) c.classList.add('hit'); });
  }

  function winText(w) {
    const name = E.SYMBOLS[w.symbol].name;
    if (w.line < 0) return `${w.count} × ${name} scatter · ${fmt(w.amount)}`;
    return `Line ${w.line + 1} · ${w.count} × ${name} · ${fmt(w.amount)}`;
  }

  function presentWins(result) {
    clearPresentation();
    if (!result.wins.length) return;
    reelWindow.classList.add('dim');
    // 1) everything at once
    result.wins.forEach(w => { if (w.line >= 0) drawLine(w.line); highlight(w.cells); });
    const label = $('winLabel');
    label.textContent = `WIN ${fmt(result.total)}`;
    label.hidden = false;
    if (result.wins.length === 1 && !state.auto) { label.textContent = winText(result.wins[0]); return; }
    // 2) cycle each win
    let i = 0;
    const step = () => {
      const w = result.wins[i % result.wins.length];
      lineLayer.replaceChildren();
      document.querySelectorAll('.cell.hit').forEach(c => c.classList.remove('hit'));
      if (w.line >= 0) drawLine(w.line);
      highlight(w.cells);
      label.textContent = winText(w);
      i++;
      presentTimer = setTimeout(step, 1400);
    };
    presentTimer = setTimeout(step, 1500);
  }

  function showBigWin(amount) {
    const x = amount / totalBet();
    if (x < 15) return Promise.resolve();
    const bw = $('bigWin');
    bw.querySelector('.bw-title').textContent = x >= 100 ? 'EPIC WIN!' : x >= 40 ? 'MEGA WIN!' : 'BIG WIN!';
    const amt = bw.querySelector('.bw-amount');
    bw.hidden = false;
    return new Promise(resolve => {
      const start = performance.now(), ms = 1800;
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / ms);
        amt.textContent = fmt(amount * t);
        if (t < 1) requestAnimationFrame(tick);
        else setTimeout(() => { bw.hidden = true; resolve(); }, 1100);
      };
      tick();
    });
  }

  // ---------- spin ----------
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Tap on SPIN: spin / quick-stop / end autoplay
  function onSpinTap() {
    if (state.auto) { state.auto = false; updateHud(); slamStop(); toast('Autoplay off'); return; }
    spin();
  }

  async function spin() {
    if (state.spinning) { slamStop(); return; }
    const isFree = state.freeSpins > 0;
    if (!isFree && state.credits < totalBet()) {
      state.auto = false; updateHud();
      if (state.credits < LINE_BETS[0] * E.LINES.length) {
        toast('Out of credits — refilled to 2,000 for free!', 3000);
        state.credits = START_CREDITS; save(); updateHud();
      } else {
        toast('Not enough credits — lower your bet');
      }
      return;
    }

    clearPresentation();
    clearInterval(countTimer);
    state.spinning = true;
    state.lastWin = 0;
    if (isFree) state.freeSpins--;
    else state.credits -= totalBet();
    updateHud();
    save();

    const grid = E.spinGrid();
    const result = E.evaluate(grid, lineBet());
    await spinReels(grid);
    state.grid = grid;

    state.credits += result.total;
    state.lastWin = result.total;
    if (isFree) state.freeSpinWin += result.total;
    state.spinning = false;
    save();
    updateHud();
    if (result.total > 0) {
      countUp(result.total);
      const d = $('dispWin'); d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash');
    }
    presentWins(result);

    if (result.total > 0) await showBigWin(result.total);

    if (result.freeSpins > 0) {
      if (state.freeSpins === 0 && !isFree) { state.freeSpinTotal = 0; state.freeSpinWin = 0; }
      state.freeSpins += result.freeSpins;
      state.freeSpinTotal += result.freeSpins;
      save(); updateHud();
      toast(isFree ? `+${result.freeSpins} free spins!` : `${result.freeSpins} FREE SPINS!`, 2500);
      await sleep(2200);
    }

    if (isFree && state.freeSpins === 0) {
      toast(`Free spins won ${fmt(state.freeSpinWin)}`, 3200);
      state.freeSpinTotal = 0;
      save(); updateHud();
      await sleep(1800);
    }

    window.AppUpdate && window.AppUpdate.idle();

    // keep going for free spins / autoplay
    if (state.freeSpins > 0) {
      await sleep(result.total > 0 ? 1600 : 500);
      if (!state.spinning) spin();
    } else if (state.auto) {
      await sleep(result.total > 0 ? 1500 : 450);
      if (state.auto && !state.spinning) spin();
    }
  }

  function changeBet(d) {
    if (state.spinning || state.freeSpins > 0) return;
    const n = state.betIdx + d;
    if (n < 0 || n >= LINE_BETS.length) return;
    state.betIdx = n;
    save(); updateHud();
  }

  function toggleAuto() {
    state.auto = !state.auto;
    updateHud();
    toast(state.auto ? 'Autoplay on — tap SPIN to stop' : 'Autoplay off');
    if (state.auto && !state.spinning) spin();
  }

  // ---------- help / paytable ----------
  function buildHelp() {
    const lb = lineBet(), tb = totalBet();
    const body = $('helpBody');
    body.replaceChildren();
    const h = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };

    body.appendChild(h('p', `Payouts shown in credits for your current bet: ${lb} per line × ${E.LINES.length} lines = ${fmt(tb)} per spin. Change your bet to see the values update.`, 'muted'));

    body.appendChild(h('h3', 'Special gems'));
    const wild = E.SYMBOLS[E.WILD], scat = E.SYMBOLS[E.SCATTER];
    const f1 = h('div', null, 'feature'); f1.appendChild(gemEl(E.WILD, 3));
    const t1 = h('div');
    t1.innerHTML = `<p><b>DIAMOND — WILD</b></p><p>Substitutes for every gem except the Opal. Five Diamonds on a line pay <b>${fmt(wild.pays[5] * lb)}</b> (4: ${fmt(wild.pays[4] * lb)}, 3: ${fmt(wild.pays[3] * lb)}).</p>`;
    f1.appendChild(t1); body.appendChild(f1);
    const f2 = h('div', null, 'feature'); f2.appendChild(gemEl(E.SCATTER, 3));
    const t2 = h('div');
    t2.innerHTML = `<p><b>OPAL — SCATTER</b></p><p>Pays anywhere on the reels: 3 = <b>${fmt(scat.pays[3] * tb)}</b>, 4 = <b>${fmt(scat.pays[4] * tb)}</b>, 5 = <b>${fmt(scat.pays[5] * tb)}</b>.</p><p>Also awards <b>${E.FREE_SPINS[3]} / ${E.FREE_SPINS[4]} / ${E.FREE_SPINS[5]} free spins</b> for 3 / 4 / 5 Opals. Free spins can retrigger.</p>`;
    f2.appendChild(t2); body.appendChild(f2);

    body.appendChild(h('h3', 'Gem payouts'));
    const grid = h('div', null, 'paygrid');
    const order = E.SYMBOLS.filter(s => !s.wild && !s.scatter).sort((a, b) => b.pays[5] - a.pays[5] || a.id - b.id);
    order.forEach(s => {
      const p = h('div', null, 'pay');
      p.appendChild(gemEl(s.id));
      const info = h('div');
      info.appendChild(h('div', s.name, 'nm'));
      const tbl = document.createElement('table');
      [5, 4, 3].forEach(n => {
        const tr = document.createElement('tr');
        tr.appendChild(h('td', `${n}×`));
        tr.appendChild(h('td', fmt(s.pays[n] * lb)));
        tbl.appendChild(tr);
      });
      info.appendChild(tbl);
      p.appendChild(info);
      grid.appendChild(p);
    });
    body.appendChild(grid);

    body.appendChild(h('h3', `${E.LINES.length} paylines`));
    const lines = h('div', null, 'lines');
    E.LINES.forEach((line, i) => {
      const d = h('div', null, 'ln');
      let svg = `<svg viewBox="0 0 54 34">`;
      for (let x = 0; x < 5; x++) for (let y = 0; y < 3; y++) {
        svg += `<rect x="${2 + x * 10.4}" y="${2 + y * 10.4}" width="9" height="9" rx="2" class="${line[x] === y ? 'on' : ''}"/>`;
      }
      d.innerHTML = svg + '</svg>' + `Line ${i + 1}`;
      lines.appendChild(d);
    });
    body.appendChild(lines);

    body.appendChild(h('h3', 'How to play'));
    const ul = h('ul', null, 'rules');
    [
      'Use − / + to choose your line bet (1–50 per line). All 20 lines are always active; BET shows the total per spin.',
      'Tap SPIN to play. Tap it again while the reels are moving to stop them quickly.',
      'Line wins pay left to right, starting on the leftmost reel, for 3 or more matching gems in a row.',
      'Only the highest win on each line is paid. Wins on different lines are added together.',
      'Scatter wins are multiplied by the total bet and added to line wins.',
      'Press and hold SPIN to start autoplay. Tap SPIN to stop it.',
      'Free play only: credits have no cash value. Run out and you are refilled to 2,000.',
    ].forEach(t => ul.appendChild(h('li', t)));
    body.appendChild(ul);
  }

  function openDialog(d) {
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }
  function closeDialog(d) {
    if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
  }
  function openHelp() { buildHelp(); openDialog($('helpDlg')); $('helpBody').scrollTop = 0; }

  // ---------- wiring ----------
  function bind(el, fn) {
    el.addEventListener('click', e => { e.preventDefault(); fn(); });
  }

  function init() {
    $('hintVer').textContent = 'v' + (window.AppUpdate ? window.AppUpdate.version : '?');
    load();
    measure();
    for (let r = 0; r < E.REELS; r++) renderStatic(r, state.grid[r]);
    updateHud();

    // sprite strip for each machine button, with a staggered idle shimmer
    document.querySelectorAll('.mbtn').forEach((b, i) => {
      // <span.art> is the visible window, <span.frames> holds the 4-frame strip
      const art = document.createElement('span');
      art.className = 'art';
      const frames = document.createElement('span');
      frames.className = 'frames';
      frames.style.backgroundImage = `url("assets/btn/${b.dataset.sprite}.webp")`;
      art.appendChild(frames);
      b.appendChild(art);
      b.style.setProperty('--delay', `${(i * 0.55).toFixed(2)}s`);
      // press / release frame animation (works on iOS, where :active is unreliable)
      let downAt = 0;
      const release = () => {
        if (!b.classList.contains('pressed')) return;
        const wait = Math.max(0, 90 - (performance.now() - downAt));
        setTimeout(() => {
          b.classList.remove('pressed');
          b.classList.remove('tapped'); void b.offsetWidth; b.classList.add('tapped');
        }, wait);
      };
      b.addEventListener('pointerdown', () => { if (b.disabled) return; downAt = performance.now(); b.classList.add('pressed'); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, release));
      b.addEventListener('animationend', e => { if (e.animationName === 'btnTapFrames') b.classList.remove('tapped'); });
    });

    // SPIN: tap to spin, press-and-hold for autoplay
    const spinBtn = $('btnSpin');
    let holdTimer = null, held = false;
    spinBtn.addEventListener('pointerdown', () => {
      held = false;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => { held = true; if (!state.auto) toggleAuto(); }, 650);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => spinBtn.addEventListener(ev, () => clearTimeout(holdTimer)));
    spinBtn.addEventListener('contextmenu', e => e.preventDefault());
    spinBtn.addEventListener('click', e => { e.preventDefault(); if (held) { held = false; return; } onSpinTap(); });

    bind($('btnMinus'), () => changeBet(-1));
    bind($('btnPlus'), () => changeBet(1));
    bind($('btnInfo'), openHelp);
    bind($('btnSettings'), () => { $('verLbl').textContent = 'v' + (window.AppUpdate ? window.AppUpdate.version : '?'); openDialog($('settingsDlg')); });
    bind($('btnSound'), () => toast('Sound is coming in a future update'));
    bind($('btnFull'), () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
      if (standalone) toast('Already running full screen');
      else if (document.documentElement.requestFullscreen) {
        if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
      } else toast('Tap Share → Add to Home Screen for full screen', 3200);
    });
    bind($('btnRefill'), () => {
      if (state.spinning) return;
      state.credits = START_CREDITS; state.auto = false; save(); updateHud();
      closeDialog($('settingsDlg')); toast('Credits reset to 2,000');
    });
    bind($('btnUpdate'), () => { closeDialog($('settingsDlg')); window.AppUpdate && window.AppUpdate.check(); });

    document.querySelectorAll('dialog').forEach(d => {
      d.querySelectorAll('[data-close]').forEach(b => bind(b, () => closeDialog(d)));
      d.addEventListener('click', e => { if (e.target === d) closeDialog(d); }); // backdrop tap
    });

    window.addEventListener('resize', () => { if (!state.spinning) measure(); });
    document.addEventListener('keydown', e => { if (e.code === 'Space' && !document.querySelector('dialog[open]')) { e.preventDefault(); onSpinTap(); } });
    // stop autoplay when the app is backgrounded
    document.addEventListener('visibilitychange', () => { if (document.hidden && state.auto) { state.auto = false; updateHud(); } });

    // resume unfinished free spins
    if (state.freeSpins > 0) setTimeout(spin, 800);
  }

  window.GemRoyale = { isBusy: () => state.spinning || state.freeSpins > 0, toast };

  // wait for artwork before showing the machine
  const imgs = ['assets/machine.webp?v=' + (window.AppUpdate ? window.AppUpdate.version : ''), 'assets/gems.webp'];
  ['settings', 'info', 'sound', 'spin', 'minus', 'plus', 'full'].forEach(n => imgs.push(`assets/btn/${n}.webp`));
  Promise.all(imgs.map(src => new Promise(res => { const i = new Image(); i.onload = i.onerror = res; i.src = src; })))
    .then(() => {
      $('loading').hidden = true;
      $('app').hidden = false;
      init();
    });
})();
