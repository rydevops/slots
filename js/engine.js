// Slots Gallery – game math for every machine (pure, no DOM). Usable in browser and Node.
//
//   Engines['gem-royale'], Engines['unicorn-royale']   – one engine per machine
//   Engine                                             – Gem Royale (kept for older tools)
//
// Each machine definition lists its symbols in sprite-sheet row order. Special symbols:
//   wild    – substitutes on paylines for every symbol except scatter/jackpot
//   scatter – pays anywhere (× total bet) and awards free spins
//   jackpot – pays anywhere (× total bet); `jackpotAt` or more of them wins the PROGRESSIVE JACKPOT:
//             a pot that starts at `jackpotSeed` and grows by `jackpotRate` × every paid bet.
//             The app keeps the pot and passes it to evaluate() as { jackpotPool }.
(function (root) {
  const LINES = [
    [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
    [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[1,0,1,2,1],
    [1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],[0,1,1,1,0],[2,1,1,1,2],
    [1,1,0,1,1],[1,1,2,1,1],[0,2,0,2,0],[2,0,2,0,2],[0,2,2,2,0],
  ];
  const REELS = 5, ROWS = 3;

  const DEFS = {
    'gem-royale': {
      SYMBOLS: [
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
      ],
      FREE_SPINS: { 3: 8, 4: 12, 5: 20 },
    },
    'unicorn-royale': {
      SYMBOLS: [
        { id: 0,  name: 'White Unicorn',  tier: 'high', pays: { 3: 35, 4: 60, 5: 150 }, w: 3 },
        { id: 1,  name: 'Pink Unicorn',   tier: 'high', pays: { 3: 30, 4: 50, 5: 120 }, w: 3 },
        { id: 2,  name: 'Pegasus',        tier: 'high', pays: { 3: 22, 4: 35, 5: 100 }, w: 4 },
        { id: 3,  name: 'Rainbow',        tier: 'wild', pays: { 3: 40, 4: 100, 5: 300 }, w: 11, wild: true },
        { id: 4,  name: 'Golden Horn',    tier: 'mid',  pays: { 3: 18, 4: 25, 5: 60 }, w: 5 },
        { id: 5,  name: 'Crystal Heart',  tier: 'mid',  pays: { 3: 18, 4: 25, 5: 60 }, w: 5 },
        { id: 6,  name: 'Silver Moon',    tier: 'mid',  pays: { 3: 14, 4: 18, 5: 50 }, w: 5 },
        { id: 7,  name: 'Gold Star',      tier: 'mid',  pays: { 3: 14, 4: 18, 5: 50 }, w: 5 },
        { id: 8,  name: 'Crystals',       tier: 'low',  pays: { 3: 11, 4: 13, 5: 30 }, w: 8 },
        { id: 9,  name: 'Cloud Castle',   tier: 'scatter', pays: { 3: 2, 4: 5, 5: 20 }, w: 2, scatter: true },
        { id: 10, name: 'Rose',           tier: 'low',  pays: { 3: 11, 4: 13, 5: 30 }, w: 8 },
        { id: 11, name: 'Horseshoe',      tier: 'low',  pays: { 3: 10, 4: 11, 5: 25 }, w: 9 },
        { id: 12, name: 'Crown',          tier: 'low',  pays: { 3: 10, 4: 11, 5: 25 }, w: 12 },
        { id: 13, name: 'Rainbow Potion', tier: 'low',  pays: { 3: 7, 4: 9, 5: 20 }, w: 14 },
        { id: 14, name: 'Jackpot',        tier: 'jackpot', pays: { 3: 2, 4: 10 }, w: 3, jackpot: true },
      ],
      FREE_SPINS: { 3: 8, 4: 12, 5: 20 },
      jackpotAt: 5,          // this many JACKPOT symbols anywhere wins the progressive jackpot
      jackpotSeed: 10000,    // the pot starts (and restarts after a win) at this many credits
      jackpotRate: 0.02,     // each paid spin adds this share of its total bet to the pot
    },
  };

  function randomInt(n) {
    if (root.crypto && root.crypto.getRandomValues) {
      const a = new Uint32Array(1); root.crypto.getRandomValues(a);
      return a[0] % n;
    }
    return Math.floor(Math.random() * n);
  }

  function create(id, def) {
    const SYMBOLS = def.SYMBOLS;
    const find = key => { const s = SYMBOLS.find(x => x[key]); return s ? s.id : -1; };
    const WILD = find('wild'), SCATTER = find('scatter'), JACKPOT = find('jackpot');
    const FREE_SPINS = def.FREE_SPINS;
    const TOTAL_W = SYMBOLS.reduce((s, x) => s + x.w, 0);
    const special = s => s === SCATTER || s === JACKPOT;

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

    // Symbols that pay anywhere: [[reel,row], ...]
    function cellsOf(grid, sym) {
      const out = [];
      grid.forEach((col, reel) => col.forEach((s, row) => { if (s === sym) out.push([reel, row]); }));
      return out;
    }

    // opts.jackpotPool: current progressive pot (defaults to the seed)
    function evaluate(grid, lineBet, opts = {}) {
      const wins = [];
      const totalBet = lineBet * LINES.length;
      LINES.forEach((line, li) => {
        const syms = line.map((row, reel) => grid[reel][row]);
        if (special(syms[0])) return;
        // pure wild run
        let wildRun = 0;
        while (wildRun < REELS && syms[wildRun] === WILD) wildRun++;
        const wildPay = wildRun >= 3 ? SYMBOLS[WILD].pays[wildRun] : 0;
        // first non-wild symbol run
        const base = syms.find(s => s !== WILD);
        let run = 0, symPay = 0;
        if (base !== undefined && !special(base)) {
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

      // scatters anywhere: pay × total bet + free spins
      let freeSpins = 0;
      if (SCATTER >= 0) {
        const scat = cellsOf(grid, SCATTER);
        const n = Math.min(scat.length, 5);
        if (n >= 3) {
          wins.push({ line: -1, symbol: SCATTER, count: n, amount: SYMBOLS[SCATTER].pays[n] * totalBet, cells: scat });
          freeSpins = FREE_SPINS[n];
        }
      }

      // jackpot symbols anywhere: small/big prizes, or the JACKPOT
      let jackpot = false;
      if (JACKPOT >= 0) {
        const jp = cellsOf(grid, JACKPOT);
        const n = jp.length;
        if (n >= def.jackpotAt) {
          jackpot = true;
          const pot = Math.floor(opts.jackpotPool != null ? opts.jackpotPool : def.jackpotSeed);
          wins.push({ line: -1, symbol: JACKPOT, count: n, amount: pot, cells: jp, jackpot: true });
        } else if (SYMBOLS[JACKPOT].pays[n]) {
          wins.push({ line: -1, symbol: JACKPOT, count: n, amount: SYMBOLS[JACKPOT].pays[n] * totalBet, cells: jp });
        }
      }

      const total = wins.reduce((s, w) => s + w.amount, 0);
      return { wins, total, freeSpins, jackpot };
    }

    return {
      id, SYMBOLS, WILD, SCATTER, JACKPOT, FREE_SPINS, LINES, REELS, ROWS,
      jackpotAt: def.jackpotAt || 0, jackpotSeed: def.jackpotSeed || 0, jackpotRate: def.jackpotRate || 0,
      spinGrid, evaluate, randomSymbol,
    };
  }

  const Engines = {};
  for (const [id, def] of Object.entries(DEFS)) Engines[id] = create(id, def);
  const api = Object.assign({}, Engines['gem-royale'], { Engines });   // `Engine` = Gem Royale

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Engine = api; root.Engines = Engines; }
})(typeof self !== 'undefined' ? self : globalThis);
