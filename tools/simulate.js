// Payout simulator for js/engine.js. Not deployed (the Pages workflow only copies the site files).
//
//   node tools/simulate.js            # 1,000,000 spins + bankroll sessions
//   SPINS=200000 SESSIONS=500 node tools/simulate.js
//   MACHINE=unicorn-royale node tools/simulate.js   # any id from js/engine.js (default gem-royale)
//
// Reports:
//   RTP        – total paid / total bet (free spins included)
//   any win    – share of paid spins that win anything
//   win >= bet – share of paid spins that pay back at least the total bet
//   volatility – standard deviation of a spin's result, in units of total bet
//   bankroll   – for each line bet, starting at 2,000 and at 300 credits, how often a player
//                runs out within 300 spins, and the median balance at the end
const MACHINE = process.env.MACHINE || 'gem-royale';
const E = require('../js/engine.js').Engines[MACHINE];
if (!E) { console.error(`Unknown machine "${MACHINE}"`); process.exit(1); }
let jackpots = 0;

const SPINS = +process.env.SPINS || 1e6;
const SESSIONS = +process.env.SESSIONS || 1000;
const LINE_BETS = [1, 2, 5, 10, 25, 50];
const LINES = E.LINES.length;

function paidSpin(lineBet) { // one paid spin plus any free spins it triggers
  let r = E.evaluate(E.spinGrid(), lineBet), won = r.total, fs = r.freeSpins;
  if (r.jackpot) jackpots++;
  while (fs-- > 0) { const q = E.evaluate(E.spinGrid(), lineBet); won += q.total; fs += q.freeSpins; }
  return won;
}

let bet = 0, won = 0, hit = 0, even = 0, sq = 0;
for (let i = 0; i < SPINS; i++) {
  const w = paidSpin(1);
  bet += LINES; won += w; if (w > 0) hit++; if (w >= LINES) even++; sq += (w / LINES) ** 2;
}
const rtp = won / bet;
const pct = x => (x * 100).toFixed(1) + '%';
console.log(`Machine: ${MACHINE}`);
if (E.JACKPOT >= 0) console.log(`Jackpots: ${jackpots} in ${SPINS} spins (about 1 in ${jackpots ? Math.round(SPINS / jackpots) : '∞'})`);
console.log(`RTP ${pct(rtp)}   any win ${pct(hit / SPINS)}   win >= bet ${pct(even / SPINS)}   volatility ${Math.sqrt(sq / SPINS - rtp * rtp).toFixed(2)}`);

for (const start of [2000, 300]) {
  console.log(`\nStarting with ${start} credits, up to 300 spins:`);
  for (const lb of LINE_BETS) {
    const total = lb * LINES, ends = []; let busted = 0;
    for (let t = 0; t < SESSIONS; t++) {
      let c = start;
      for (let s = 0; s < 300 && c >= total; s++) c += paidSpin(lb) - total;
      if (c < total) busted++;
      ends.push(c);
    }
    ends.sort((a, b) => a - b);
    console.log(`  bet ${String(total).padStart(4)} (line ${String(lb).padStart(2)}): ran out ${pct(busted / SESSIONS).padStart(6)}   median end ${ends[ends.length >> 1]}`);
  }
}
