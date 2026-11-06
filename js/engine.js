// Gem Royale – game math (pure, no DOM). Usable in browser and Node.
(function (root) {
  // Sprite row index in assets/gems.webp → symbol definition
  const SYMBOLS = [
    { id: 0,  name: 'Emerald',     tier: 'high', pays: { 3: 35, 4: 60, 5: 150 }, w: 3 },
    { id: 1,  name: 'Ruby',        tier: 'high', pays: { 3: 30, 4: 50, 5: 120 }, w: 3 },
    { id: 2,  name: 'Diamond',     tier: 'wild', pays: { 3: 40, 4: 100, 5: 300 }, w: 12, wild: true },
    { id: 3,  name: 'Aquamarine',  tier: 'low',  pays: { 3: 11, 4: 13, 5: 30 }, w: 8 },
    { id: 4,  name: 'Tanzanite',   tier: 'low',  pays: { 3: 11, 4: 13, 5: 30 }, w: 8 },
    { id: 5,  name: 'Sapphire',    tier: 'high', pays: { 3: 22, 4: 35, 5: 100 }, w: 4 },
    { id: 6,  name: 'Amethyst',    tier: 'mid',  pays: { 3: 14, 4: 18, 5: 50 }, w: 5 },
    { id: 7,  name: 'Pink Heart',  tier: 'mid',  pays: { 3: 18, 4: 25, 5: 60 }, w: 5 },
    { id: 8,  name: 'Garnet',      tier: 'mid',  pays: { 3: 18, 4: 25, 5: 60 }, w: 5 },
    { id: 9,  name: 'Opal',        tier: 'scatter', pays: { 3: 2, 4: 5, 5: 20 }, w: 2, scatter: true },
    { id: 10, name: 'Citrine',     tier: 'low',  pays: { 3: 9, 4: 11, 5: 25 }, w: 9 },
    { id: 11, name: 'Fire Topaz',  tier: 'mid',  pays: { 3: 14, 4: 18, 5: 50 }, w: 5 },
    { id: 12, name: 'Peridot',     tier: 'low',  pays: { 3: 9, 4: 11, 5: 25 }, w: 9 },
    { id: 13, name: 'Blue Topaz',  tier: 'low',  pays: { 3: 6, 4: 9, 5: 20 }, w: 10 },
    { id: 14, name: 'Morganite',   tier: 'low',  pays: { 3: 6, 4: 9, 5: 20 }, w: 10 },
  ];
  const WILD = 2, SCATTER = 9;
  const FREE_SPINS = { 3: 8, 4: 12, 5: 20 };
  const REELS = 5, ROWS = 3;

  const LINES = [
    [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
    [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[1,0,1,2,1],
    [1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],[0,1,1,1,0],[2,1,1,1,2],
    [1,1,0,1,1],[1,1,2,1,1],[0,2,0,2,0],[2,0,2,0,2],[0,2,2,2,0],
  ];

  const TOTAL_W = SYMBOLS.reduce((s, x) => s + x.w, 0);

  function randomInt(n) {
    if (root.crypto && root.crypto.getRandomValues) {
      const a = new Uint32Array(1); root.crypto.getRandomValues(a);
      return a[0] % n;
    }
    return Math.floor(Math.random() * n);
  }
  function randomSymbol() {
    let r = randomInt(TOTAL_W);
    for (const s of SYMBOLS) { if (r < s.w) return s.id; r -= s.w; }
    return SYMBOLS[SYMBOLS.length - 1].id;
  }
  // grid[reel][row]
  function spinGrid() {
    const g = [];
    for (let r = 0; r < REELS; r++) {
      const col = [];
      for (let y = 0; y < ROWS; y++) col.push(randomSymbol());
      g.push(col);
    }
    return g;
  }

  function evaluate(grid, lineBet) {
    const wins = [];
    LINES.forEach((line, li) => {
      const syms = line.map((row, reel) => grid[reel][row]);
      if (syms[0] === SCATTER) return;
      // pure wild run
      let wildRun = 0;
      while (wildRun < REELS && syms[wildRun] === WILD) wildRun++;
      const wildPay = wildRun >= 3 ? SYMBOLS[WILD].pays[wildRun] : 0;
      // first non-wild symbol run
      const base = syms.find(s => s !== WILD);
      let run = 0, symPay = 0;
      if (base !== undefined && base !== SCATTER) {
        while (run < REELS && (syms[run] === base || syms[run] === WILD)) run++;
        symPay = run >= 3 ? SYMBOLS[base].pays[run] : 0;
      }
      let best = null;
      if (wildPay >= symPay && wildPay > 0) best = { symbol: WILD, count: wildRun, mult: wildPay };
      else if (symPay > 0) best = { symbol: base, count: run, mult: symPay };
      if (best) {
        wins.push({
          line: li, symbol: best.symbol, count: best.count,
          amount: best.mult * lineBet,
          cells: line.slice(0, best.count).map((row, reel) => [reel, row]),
        });
      }
    });
    // scatters anywhere
    const scat = [];
    grid.forEach((col, reel) => col.forEach((s, row) => { if (s === SCATTER) scat.push([reel, row]); }));
    let freeSpins = 0;
    const n = Math.min(scat.length, 5);
    if (n >= 3) {
      wins.push({
        line: -1, symbol: SCATTER, count: n,
        amount: SYMBOLS[SCATTER].pays[n] * lineBet * LINES.length,
        cells: scat,
      });
      freeSpins = FREE_SPINS[n];
    }
    const total = wins.reduce((s, w) => s + w.amount, 0);
    return { wins, total, freeSpins };
  }

  const api = { SYMBOLS, WILD, SCATTER, FREE_SPINS, LINES, REELS, ROWS, spinGrid, evaluate, randomSymbol };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof self !== 'undefined' ? self : globalThis);
