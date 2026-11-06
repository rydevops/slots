// Slots Gallery – UI / game loop shared by every machine.
// The current machine is `M` (an entry of MACHINES, below) and its math engine is `E`.
(function () {
  const $ = id => document.getElementById(id);
  // sound (js/audio.js); a no-op stand-in keeps the game working if it is missing
  const A = window.SlotAudio || { unlock() {}, scene() {}, sfx() {}, reels() {}, duck() {}, set() {}, settings: {} };
  let E = window.Engines['gem-royale'];
  let M = null;

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
    jackpotPool: 0,          // progressive jackpot pot (machines with a JACKPOT symbol)
    auto: false,
  };

  // ---------- persistence ----------
  // Credits are shared by every machine and live in the original Gem Royale key (so older
  // saves keep working). Each machine keeps its own bet and free-spin state under its own key.
  const SHARED_KEY = 'gem-royale-state-v1';
  const keyFor = id => id === 'gem-royale' ? SHARED_KEY : `${id}-state-v1`;
  const readKey = k => { try { return JSON.parse(localStorage.getItem(k) || 'null') || {}; } catch (e) { return {}; } };
  const writeKey = (k, o) => { try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) { /* ignore */ } };

  function load() {
    const shared = readKey(SHARED_KEY);
    state.credits = Number.isFinite(shared.credits) ? shared.credits : START_CREDITS;
    const s = readKey(keyFor(M.id));
    state.betIdx = Number.isInteger(s.betIdx) && s.betIdx >= 0 && s.betIdx < LINE_BETS.length ? s.betIdx : 0;
    state.freeSpins = Number.isInteger(s.freeSpins) ? s.freeSpins : 0;
    state.freeSpinTotal = Number.isInteger(s.freeSpinTotal) ? s.freeSpinTotal : 0;
    state.freeSpinWin = Number.isFinite(s.freeSpinWin) ? s.freeSpinWin : 0;
    state.jackpotPool = Number.isFinite(s.jackpotPool) && s.jackpotPool >= E.jackpotSeed ? s.jackpotPool : E.jackpotSeed;
  }
  function save() {
    if (!M) return;
    const own = { betIdx: state.betIdx, freeSpins: state.freeSpins, freeSpinTotal: state.freeSpinTotal, freeSpinWin: state.freeSpinWin };
    if (E.JACKPOT >= 0) own.jackpotPool = Math.round(state.jackpotPool * 100) / 100;
    if (M.id === 'gem-royale') writeKey(SHARED_KEY, Object.assign({ credits: state.credits }, own));
    else {
      writeKey(keyFor(M.id), own);
      writeKey(SHARED_KEY, Object.assign(readKey(SHARED_KEY), { credits: state.credits }));
    }
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
        A.sfx('reelStop', { reel: r });
      }));
    }
    A.reels(true);
    return Promise.all(promises).then(v => { A.reels(false); return v; });
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
    if (E.JACKPOT >= 0) $('jackpotAmt').textContent = fmt(Math.floor(state.jackpotPool));
    const fs = state.freeSpinTotal > 0;
    $('fsBar').hidden = !fs;
    if (fs) $('fsCount').textContent = `${state.freeSpinTotal - state.freeSpins} / ${state.freeSpinTotal}`;
    const lock = state.spinning || state.freeSpins > 0;
    $('btnMinus').disabled = lock || state.betIdx === 0;
    $('btnPlus').disabled = lock || state.betIdx === LINE_BETS.length - 1;
    $('btnSpin').classList.toggle('on', state.spinning || state.auto || state.freeSpins > 0);
    $('autoChip').hidden = !state.auto;
    $('machine').classList.toggle('spinning', state.spinning || state.auto || state.freeSpins > 0);
  }

  let countTimer = null;
  function countUp(target, ms = 900) {
    clearInterval(countTimer);
    const start = performance.now();
    const el = $('win');
    let ticks = 0;
    countTimer = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms);
      if (t < 1 && ticks++ % 3 === 0) A.sfx('coin');
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
    if (w.jackpot) return `JACKPOT! · ${fmt(w.amount)}`;
    if (w.line < 0) return `${w.count} × ${name}${w.symbol === E.SCATTER ? ' scatter' : ''} · ${fmt(w.amount)}`;
    return `Line ${w.line + 1} · ${w.count} × ${name} · ${fmt(w.amount)}`;
  }

  // Machine lights race for a few seconds on bigger wins (>= 5x the total bet)
  let celebrateTimer = null;
  function celebrate(ms = 3000) {
    const m = $('machine');
    m.classList.add('celebrate');
    clearTimeout(celebrateTimer);
    celebrateTimer = setTimeout(() => m.classList.remove('celebrate'), ms);
  }

  function presentWins(result) {
    clearPresentation();
    if (!result.wins.length) return;
    if (result.total >= 5 * totalBet()) celebrate();
    const x = result.total / totalBet();
    if (!result.jackpot && x < 15) A.sfx(x >= 3 ? 'winMedium' : 'winSmall');   // bigger wins get a fanfare below
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
    A.sfx('bigWin');
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

  // JACKPOT: 6-frame banner cycles while the amount counts up; tap to collect.
  function showJackpot(amount) {
    const ov = $('jackpotWin'), banner = $('jpBanner'), amt = $('jpAmount'), tap = $('jpTap');
    if (!banner.querySelector('img')) {
      M.art.jackpot.forEach((src, i) => {
        const img = document.createElement('img');
        img.src = assetUrl(src); img.alt = ''; img.draggable = false;
        banner.insertBefore(img, amt);
      });
    }
    const imgs = [...banner.querySelectorAll('img')];
    let f = 0;
    imgs.forEach((im, i) => im.classList.toggle('on', i === 0));
    const cycle = setInterval(() => { imgs[f].classList.remove('on'); f = (f + 1) % imgs.length; imgs[f].classList.add('on'); }, 380);
    tap.classList.remove('show');
    amt.textContent = '0';
    ov.hidden = false;
    A.sfx('jackpot');
    celebrate(9000);
    return new Promise(resolve => {
      const start = performance.now(), ms = 3000;
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / ms);
        amt.textContent = fmt(amount * (1 - Math.pow(1 - t, 3)));
        if (t < 1) { requestAnimationFrame(tick); return; }
        tap.classList.add('show');
        const done = () => { clearInterval(cycle); ov.hidden = true; ov.removeEventListener('click', done); clearTimeout(auto); resolve(); };
        const auto = setTimeout(done, state.auto ? 3500 : 15000);
        ov.addEventListener('click', done);
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
      A.sfx('noCredits');
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
    A.sfx('spin');
    state.spinning = true;
    state.lastWin = 0;
    if (isFree) state.freeSpins--;
    else {
      state.credits -= totalBet();
      // progressive jackpot: every paid bet feeds the pot
      if (E.JACKPOT >= 0) {
        state.jackpotPool = Math.round((state.jackpotPool + E.jackpotRate * totalBet()) * 100) / 100;   // keep to the cent: no float drift
        const d = $('dispJackpot'); d.classList.remove('grow'); void d.offsetWidth; d.classList.add('grow');
      }
    }
    updateHud();
    save();

    const grid = E.spinGrid();
    const result = E.evaluate(grid, lineBet(), { jackpotPool: state.jackpotPool });
    if (result.jackpot) state.jackpotPool = E.jackpotSeed;   // won: the pot restarts from the seed
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

    if (result.jackpot) await showJackpot(result.wins.find(w => w.jackpot).amount);
    else if (result.total > 0) await showBigWin(result.total);

    if (result.freeSpins > 0) {
      if (state.freeSpins === 0 && !isFree) { state.freeSpinTotal = 0; state.freeSpinWin = 0; }
      state.freeSpins += result.freeSpins;
      state.freeSpinTotal += result.freeSpins;
      save(); updateHud();
      toast(isFree ? `+${result.freeSpins} free spins!` : `${result.freeSpins} FREE SPINS!`, 2500);
      A.sfx('freeSpins');
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
    A.sfx('bet', { level: n });
    save(); updateHud();
  }

  function toggleAuto() {
    state.auto = !state.auto;
    updateHud();
    toast(state.auto ? 'Autoplay on — tap SPIN to stop' : 'Autoplay off');
    A.sfx(state.auto ? 'autoOn' : 'autoOff');
    if (state.auto && !state.spinning) spin();
  }

  // ---------- help / paytable ----------
  function buildHelp() {
    const lb = lineBet(), tb = totalBet();
    const body = $('helpBody');
    body.replaceChildren();
    const h = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };

    body.appendChild(h('p', `Payouts shown in credits for your current bet: ${lb} per line × ${E.LINES.length} lines = ${fmt(tb)} per spin. Change your bet to see the values update.`, 'muted'));

    const word = M.symbolWord;                      // 'gem' / 'symbol'
    const name = id => E.SYMBOLS[id].name;
    body.appendChild(h('h3', `Special ${word}s`));
    const feature = (sym, html) => {
      const f = h('div', null, 'feature'); f.appendChild(gemEl(sym, 3));
      const t = h('div'); t.innerHTML = html; f.appendChild(t); body.appendChild(f);
    };
    const wild = E.SYMBOLS[E.WILD], scat = E.SYMBOLS[E.SCATTER];
    const notSubbed = [name(E.SCATTER)].concat(E.JACKPOT >= 0 ? [name(E.JACKPOT)] : []).join(' and the ');
    feature(E.WILD, `<p><b>${wild.name.toUpperCase()} — WILD</b></p><p>Substitutes for every ${word} except the ${notSubbed}. Five ${wild.name}s on a line pay <b>${fmt(wild.pays[5] * lb)}</b> (4: ${fmt(wild.pays[4] * lb)}, 3: ${fmt(wild.pays[3] * lb)}).</p>`);
    feature(E.SCATTER, `<p><b>${scat.name.toUpperCase()} — SCATTER</b></p><p>Pays anywhere on the reels: 3 = <b>${fmt(scat.pays[3] * tb)}</b>, 4 = <b>${fmt(scat.pays[4] * tb)}</b>, 5 = <b>${fmt(scat.pays[5] * tb)}</b>.</p><p>Also awards <b>${E.FREE_SPINS[3]} / ${E.FREE_SPINS[4]} / ${E.FREE_SPINS[5]} free spins</b> for 3 / 4 / 5. Free spins can retrigger.</p>`);
    if (E.JACKPOT >= 0) {
      const jp = E.SYMBOLS[E.JACKPOT];
      feature(E.JACKPOT, `<p><b>JACKPOT</b></p><p>Pays anywhere on the reels: 3 = <b>${fmt(jp.pays[3] * tb)}</b>, 4 = <b>${fmt(jp.pays[4] * tb)}</b>.</p><p><b>${E.jackpotAt} or more win the PROGRESSIVE JACKPOT — currently ${fmt(Math.floor(state.jackpotPool))}</b>, shown on the machine.</p><p>The jackpot grows by ${Math.round(E.jackpotRate * 100)}% of every bet on this machine (${fmt(E.jackpotRate * tb)} per spin at your bet) and is paid in full whatever you bet. After it's won it restarts at ${fmt(E.jackpotSeed)}.</p>`);
    }

    body.appendChild(h('h3', `${word[0].toUpperCase() + word.slice(1)} payouts`));
    const grid = h('div', null, 'paygrid');
    const order = E.SYMBOLS.filter(s => !s.wild && !s.scatter && !s.jackpot).sort((a, b) => b.pays[5] - a.pays[5] || a.id - b.id);
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
      `Line wins pay left to right, starting on the leftmost reel, for 3 or more matching ${M.symbolWord}s in a row.`,
      'Only the highest win on each line is paid. Wins on different lines are added together.',
      'Scatter wins are multiplied by the total bet and added to line wins.',
      ...(E.JACKPOT >= 0 ? [`JACKPOT ${M.symbolWord}s anywhere on the reels pay too, and ${E.jackpotAt} or more win the progressive JACKPOT, which grows with every bet.`] : []),
      'Press and hold SPIN to start autoplay. Tap SPIN to stop it.',
      'Free play only: credits have no cash value and are shared by every machine. Run out and you are refilled to 2,000.',
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

  // One-time wiring of the shared game screen (buttons, dialogs, keys).
  function initOnce() {
    $('hintVer').textContent = 'v' + (window.AppUpdate ? window.AppUpdate.version : '?');

    // each machine button: <span.art> window > <span.frames> 4-frame strip (image set per machine)
    document.querySelectorAll('.mbtn').forEach((b, i) => {
      const art = document.createElement('span');
      art.className = 'art';
      const frames = document.createElement('span');
      frames.className = 'frames';
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
      b.addEventListener('pointerdown', () => {
        if (b.disabled) return;
        downAt = performance.now(); b.classList.add('pressed');
        if (b.id !== 'btnSpin') A.sfx('press');     // SPIN has its own sound
      });
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
    bind($('btnSound'), () => {
      const on = !(A.settings.music || A.settings.sfx);   // any sound on -> mute all; all off -> both on
      A.unlock(); A.set('music', on); A.set('sfx', on);
      syncSoundUi();
      toast(on ? 'Sound on' : 'Sound off');
    });
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
    document.addEventListener('keydown', e => { if (e.code === 'Space' && !$('app').hidden && !document.querySelector('dialog[open]')) { e.preventDefault(); onSpinTap(); } });
    // stop autoplay when the app is backgrounded
    document.addEventListener('visibilitychange', () => { if (document.hidden && state.auto) { state.auto = false; updateHud(); } });

  }

  window.GemRoyale = { isBusy: () => state.spinning || state.freeSpins > 0, toast };

  // ---------- machines ----------
  // Every slot machine in the gallery. Layout values are percentages of the machine artwork:
  // [left, top, width, height]. `art.aspect` is the artwork's width / height.
  const MACHINES = [
    {
      id: 'gem-royale', name: 'Gem Royale', tagline: 'Sparkling gems · 20 lines · free spins',
      thumb: 'assets/menu/gem-royale.webp', ready: true, symbolWord: 'gem',
      art: {
        aspect: 1184 / 1024,
        frames: [0, 1, 2, 3].map(i => `assets/machine-${i}.webp`),
        symbols: 'assets/gems.webp',
        btn: n => `assets/btn/${n}.webp`,
        bg: 'assets/bg.jpg',
      },
      layout: {
        reels: [23.14, 28.22, 55.32, 27.83],
        bet: [16.72, 62.99, 20.35, 4.88], bal: [39.78, 62.99, 22.30, 4.88], win: [64.86, 62.99, 20.27, 4.88],
        btnSettings: [13.77, 73.34, 5.91, 6.84], btnInfo: [22.13, 73.34, 5.91, 6.84], btnSound: [30.41, 73.93, 8.19, 5.66],
        btnSpin: [41.05, 70.12, 19.59, 14.45], btnMinus: [62.67, 73.93, 4.90, 5.66], btnPlus: [75.00, 73.93, 4.90, 5.66],
        btnFull: [82.52, 73.34, 5.91, 6.84],
      },
    },
    {
      id: 'unicorn-royale', name: 'Unicorn Royale', tagline: 'Unicorns, rainbows & a progressive JACKPOT',
      thumb: 'assets/menu/unicorn-royale.webp', ready: true, symbolWord: 'symbol',
      art: {
        aspect: 1184 / 1203,
        frames: [0, 1, 2, 3].map(i => `assets/unicorn/machine-${i}.webp`),
        symbols: 'assets/unicorn/symbols.webp',
        btn: n => `assets/unicorn/btn/${n}.webp`,
        bg: 'assets/unicorn/bg.jpg',
        jackpot: [0, 1, 2, 3, 4, 5].map(i => `assets/unicorn/jackpot-${i}.webp`),
      },
      layout: {
        reels: [18.92, 31.50, 61.91, 30.09],
        bet: [17.91, 67.66, 16.64, 5.24], bal: [40.03, 67.66, 19.17, 5.24], win: [64.70, 67.66, 17.15, 5.24],
        jackpot: [33.36, 26.93, 32.94, 2.74],
        btnSettings: [11.15, 76.81, 7.77, 7.65], btnInfo: [20.44, 76.81, 7.77, 7.65], btnSound: [29.56, 76.81, 7.77, 7.65],
        btnSpin: [39.27, 75.15, 21.11, 10.31], btnMinus: [62.58, 76.81, 7.77, 7.65], btnPlus: [71.71, 76.81, 7.77, 7.65],
        btnFull: [80.83, 76.81, 7.77, 7.65],
      },
    },
  ];

  // ---------- startup ----------
  // 1) Show the start screen as soon as its own artwork is loaded.
  // 2) Keep loading Gem Royale's artwork behind it.
  // 3) Tap -> machine menu -> pick a machine -> game (waiting for its artwork if needed).
  const ver = window.AppUpdate ? window.AppUpdate.version : '';
  const assetUrl = src => new URL(`${src}?v=${ver}`, document.baseURI).href;   // absolute: safe inside CSS vars
  const preload = srcs => Promise.all(srcs.map(src => new Promise(res => {
    const i = new Image(); i.onload = i.onerror = res; i.src = src;
  })));
  const BTN_NAMES = ['settings', 'info', 'sound', 'spin', 'minus', 'plus', 'full'];
  const machineImgs = m => [...m.art.frames, m.art.symbols, ...BTN_NAMES.map(m.art.btn)].map(assetUrl);
  const ready = {};
  const machineReady = m => (ready[m.id] = ready[m.id] || preload(machineImgs(m)));
  const startImgs = [0, 1, 2, 3].flatMap(i => [`assets/start/bg-${i}.webp?v=${ver}`, `assets/start/title-${i}.webp?v=${ver}`]);

  machineReady(MACHINES[0]);
  preload(MACHINES.map(m => assetUrl(m.thumb)));
  let started = false, wired = false;

  // Point the shared game screen at machine `m`: art, sprites, layout and math.
  function applyMachine(m) {
    M = m; E = window.Engines[m.id];
    const mach = $('machine');
    MACHINES.forEach(x => mach.classList.toggle(`m-${x.id}`, x === m));
    mach.style.setProperty('--ar', m.art.aspect.toFixed(5));
    document.querySelectorAll('#machineArt .mf').forEach((img, i) => { img.src = assetUrl(m.art.frames[i]); });
    document.documentElement.style.setProperty('--symSheet', `url("${assetUrl(m.art.symbols)}")`);
    document.body.style.backgroundImage = `url("${assetUrl(m.art.bg)}")`;
    const place = (el, r) => { if (!r) return; Object.assign(el.style, { left: r[0] + '%', top: r[1] + '%', width: r[2] + '%', height: r[3] + '%' }); };
    place(reelWindow, m.layout.reels);
    place($('dispBet'), m.layout.bet); place($('dispBal'), m.layout.bal); place($('dispWin'), m.layout.win);
    $('dispJackpot').hidden = !m.layout.jackpot;
    place($('dispJackpot'), m.layout.jackpot);
    document.querySelectorAll('.mbtn').forEach(b => {
      place(b, m.layout[b.id]);
      b.querySelector('.frames').style.backgroundImage = `url("${assetUrl(m.art.btn(b.dataset.sprite))}")`;
    });
    $('jpBanner').querySelectorAll('img').forEach(i => i.remove());
    if (m.art.jackpot) preload(m.art.jackpot.map(assetUrl));
    document.title = `${m.name} · Slots Gallery`;
  }

  function enterMachine(m) {
    applyMachine(m);
    load();
    state.grid = E.spinGrid();
    state.lastWin = 0;
    measure();
    for (let r = 0; r < E.REELS; r++) renderStatic(r, state.grid[r]);
    clearPresentation();
    updateHud();
    if (state.freeSpins > 0) setTimeout(spin, 800);     // resume unfinished free spins
  }

  function buildMenu() {
    const list = $('machineList');
    list.replaceChildren();
    MACHINES.forEach(m => {
      // the card is the machine's own artwork (with PLAY built in): tap anywhere on it to play
      const card = document.createElement('button');
      card.className = 'mn-card';
      card.dataset.machine = m.id;
      card.disabled = !m.ready;
      card.setAttribute('aria-label', m.ready ? `Play ${m.name}: ${m.tagline}` : `${m.name}, coming soon`);
      const img = document.createElement('img');
      img.src = assetUrl(m.thumb); img.alt = ''; img.draggable = false;
      const shine = document.createElement('span'); shine.className = 'shine';
      // sits over the art's PLAY pill; shows LOADING… / COMING SOON
      const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = m.ready ? '' : 'COMING SOON';
      card.append(img, shine, badge);
      card.addEventListener('click', () => { if (m.ready) openMachine(m.id); });
      list.appendChild(card);
    });
    $('menuVer').textContent = 'v' + (ver || '?');
  }

  function showMenu() {
    const menu = $('menuScreen');
    menu.hidden = false;
    menu.classList.remove('entering'); void menu.offsetWidth; menu.classList.add('entering');
    $('app').hidden = true;
  }

  let opening = false;
  async function openMachine(id) {
    const m = MACHINES.find(x => x.id === id);
    if (!m || !m.ready || opening) return;
    opening = true;
    A.unlock(); A.sfx('select');
    const card = document.querySelector(`.mn-card[data-machine="${id}"]`);
    const badge = card && card.querySelector('.badge');
    if (badge) { badge.textContent = 'LOADING…'; card.classList.add('loading'); }
    await machineReady(m);
    if (badge) { badge.textContent = ''; card.classList.remove('loading'); }
    if (!wired) { wired = true; initOnce(); }
    $('app').hidden = false;
    $('menuScreen').hidden = true;
    A.scene(m.id);
    enterMachine(m);
    opening = false;
  }
  // ---------- sound controls ----------
  function syncSoundUi() {
    const s = A.settings, any = s.music || s.sfx;
    const sb = $('btnSound'); if (sb) sb.classList.toggle('muted', !any);
    $('menuSound').textContent = any ? '🔊' : '🔇';
    $('menuSound').classList.toggle('off', !any);
    $('setMusic').checked = !!s.music; $('setSfx').checked = !!s.sfx;
    $('volMusic').value = Math.round((s.musicVol || 0) * 100); $('volSfx').value = Math.round((s.sfxVol || 0) * 100);
    $('startSound').textContent = any ? '🔊 Sound on · change it in Settings' : '🔇 Sound off · turn it on in Settings';
  }
  $('setMusic').addEventListener('change', e => { A.unlock(); A.set('music', e.target.checked); syncSoundUi(); });
  $('setSfx').addEventListener('change', e => { A.unlock(); A.set('sfx', e.target.checked); syncSoundUi(); A.sfx('tap'); });
  $('volMusic').addEventListener('input', e => { A.set('musicVol', e.target.value / 100); if (!A.settings.music) { A.set('music', true); syncSoundUi(); } });
  $('volSfx').addEventListener('input', e => { A.set('sfxVol', e.target.value / 100); if (!A.settings.sfx) { A.set('sfx', true); syncSoundUi(); } });
  $('volSfx').addEventListener('change', () => A.sfx('winSmall'));
  $('menuSound').addEventListener('click', e => {
    e.stopPropagation();
    const on = !(A.settings.music || A.settings.sfx);
    A.unlock(); A.set('music', on); A.set('sfx', on); syncSoundUi();
    if (on) A.sfx('tap');
  });
  syncSoundUi();

  // Leave the game for the menu (not mid-spin or during free spins)
  function backToMenu() {
    if (state.spinning || state.freeSpins > 0) { toast(state.freeSpins > 0 ? 'Finish your free spins first' : 'Wait for the reels to stop'); return; }
    if (state.auto) { state.auto = false; updateHud(); }
    document.querySelectorAll('dialog[open]').forEach(closeDialog);
    clearPresentation();
    A.sfx('back');
    A.scene('lobby');
    showMenu();
  }
  $('btnMenu').addEventListener('click', backToMenu);
  $('btnToMenu').addEventListener('click', backToMenu);

  function leaveStart() {
    if (started) return;
    started = true;
    const screen = $('startScreen');
    // the first tap is what lets iPhones play sound: start the lobby music here
    A.unlock(); A.scene('lobby'); A.sfx('start');
    showMenu();
    screen.classList.add('leaving');
    setTimeout(() => { screen.hidden = true; }, 500);
  }

  preload(startImgs).then(() => {
    const screen = $('startScreen');
    $('startVer').textContent = 'v' + (ver || '?');
    buildMenu();
    $('loading').hidden = true;
    screen.hidden = false;
    screen.addEventListener('click', leaveStart);
    document.addEventListener('keydown', function onKey(e) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        document.removeEventListener('keydown', onKey);
        leaveStart();
      }
    });
  });
})();
