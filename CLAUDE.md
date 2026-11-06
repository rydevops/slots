# Gem Royale — CLAUDE.md

Gem Royale is a free-play gem slot machine. It is built as a PWA (Progressive Web App) that the owner installs on an iPhone from GitHub Pages (Safari → Share → Add to Home Screen). Credits have no cash value.

## Rules

1. **Every new request goes on a new branch created from the latest `main`.**
   ```
   git fetch origin main
   git checkout -b <short-descriptive-branch-name> origin/main
   ```
   Never commit directly to `main`, and never reuse a branch whose PR has already been merged.
2. **Once the branch has the changes committed and pushed, open a pull request into `main`.** In the PR description, say what changed and how it was tested.
3. Before opening the PR, run the game locally and check it in an emulated iPhone (see *Testing*). Report any test that failed or was skipped.
4. **Every change must increment the version number, following [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)** (`MAJOR.MINOR.PATCH`, optionally with a pre-release tag such as `1.7.0-beta.1`). Pick the part by the kind of change:
   - **PATCH** (1.6.0 → 1.6.1): backwards-compatible bug fixes and small tweaks with no new behaviour;
   - **MINOR** (1.6.0 → 1.7.0): backwards-compatible new features, visible UI changes, new artwork or payout rebalancing; resets PATCH to 0;
   - **MAJOR** (1.6.0 → 2.0.0): incompatible changes, e.g. big redesigns or changes that reset or break saved player data (such as changing the `localStorage` key or format); resets MINOR and PATCH to 0.

   Bump it with `node tools/bump-version.js <patch|minor|major>`; it updates every place the version appears and adds a `## [x.y.z] - date` section to `CHANGELOG.md`. **Replace that section's TODO with what changed**, in Keep a Changelog style (`### Added / Changed / Fixed / Removed`). Never edit the version numbers by hand. Use one bump per PR: if a branch already has a bump and more changes are added, edit that changelog entry instead of bumping again. If the kind of change grows (e.g. a patch becomes a feature), re-run with an explicit version (e.g. `node tools/bump-version.js 1.7.0`). Run `node tools/bump-version.js --check` before pushing; the deploy runs the same check.
5. **Always include the new version number in the chat response** to the owner (e.g. "Version: 1.4.0 → 1.5.0"), and put it in the PR title or description too, so the owner can match it with what Settings shows in the app.
6. Do not add sound until the owner asks for it. The 🔊 button only shows a "coming soon" toast.

## Tech stack

- Plain HTML, CSS and vanilla JavaScript. There is no framework, bundler, `package.json` or build step.
- Hosted on GitHub Pages and deployed by `.github/workflows/pages.yml` on every push to `main`. The repo's Pages source should be set to **GitHub Actions**. If it is left on "Deploy from a branch", GitHub also runs its own "pages build and deployment" on every push. That publishes the raw repo files, so the site still works because the version numbers are real values in the files, but two deploys race on every push.
- iOS Safari does not reliably animate `background-position` / `background-position-x`. Step through sprite frames with `transform: translateX(...)` on an inner element instead (see the buttons and gems).
- Target device: iPhone Safari in standalone (home-screen) mode, portrait first. Landscape and desktop also work.

## File layout

| Path | Purpose |
|------|---------|
| `index.html` | Page shell: machine, reel window, displays, sprite buttons, help and settings dialogs. Holds `<meta name="app-version" content="x.y.z">` and the `?v=x.y.z` cache-busting queries. |
| `css/style.css` | All styling. Overlay positions are percentages of the machine artwork. |
| `tools/simulate.js` | Payout and bankroll simulator for `js/engine.js` (not deployed). |
| `tools/bump-version.js` | Bumps the version everywhere (`version.json`, the meta tag and `?v=` queries in `index.html`, `VERSION` in `sw.js`) and adds a `CHANGELOG.md` section. `--check` validates the SemVer 2.0.0 format, that all copies agree, and that the release has a filled-in changelog entry (used by the deploy workflow). |
| `CHANGELOG.md` | Release notes for every version, in Keep a Changelog format, newest first. |
| `js/engine.js` | Game math only (no DOM). `DEFS` holds each machine's symbols, weights, payouts and specials; `Engines[id]` is its engine (`spinGrid()`, `evaluate()`), and `Engine` is Gem Royale for older tools. Loadable in Node for simulations. |
| `js/app.js` | UI and game loop shared by every machine: `MACHINES` config (art + layout), `applyMachine()`/`enterMachine()`, reel animation, win presentation, JACKPOT overlay, free spins, autoplay, paytable builder, persistence. |
| `js/update.js` | Version check, service worker registration, update-reload logic. |
| `sw.js` | Service worker: offline cache (`gem-royale-<version>`), network-first with cache fallback. |
| `version.json` | `{ "version": "x.y.z" }`. This is the source of truth for the version; the app compares it with the version it is running. |
| `.nojekyll` | Stops GitHub's branch-based Pages build from running Jekyll over the repo. |
| `manifest.webmanifest` | PWA manifest. |
| `assets/machine-0..3.webp` | The 4 machine animation frames from the owner's 2×2 frame sheet (0 = normal, 1 = cyan glow + lit title, 2 = strong cyan glow, 3 = bright). Each frame is registered to frame 0 (offsets +639.5/+596 px; same scale), clipped to its own quadrant, and scaled about 1.79× onto a 1184×1024 transparent canvas. The screen hole is transparent. The source art is about half the resolution of the old single machine image, so it is slightly soft; ask the owner for higher-resolution frames if that matters. |
| `assets/gems.webp` | Gem sprite sheet: 5 columns (animation frames) × 15 rows (gems), each cell 180×104. Rendered as `.gem` (window, overflow hidden) > `.gem-row` (500%×1500%, `translateY` to the gem's row) > `.gem-frames` (`translateX` steps through the frames on a win). |
| `assets/btn/<name>.webp` | Button sprite strips (names: `settings, info, sound, spin, minus, plus, full`). Each is 4 equal frames side by side, taken from the owner's button sheet: 0 = normal, 1 = bright sparkle, 2 = soft shine, 3 = magenta glow. Each frame has 28% padding on every side for its glow. |
| `assets/unicorn/machine-0..3.webp` | Unicorn Royale machine frames (1184×1203), from the owner's 2×2 sheet (exact 627 px pitch), scaled ~1.94×. |
| `assets/unicorn/btn/<name>.webp` | Unicorn Royale button strips, the same 4-frame format as Gem Royale's (0 normal, 1 bright, 2 dark/pressed, 3 rainbow glow). |
| `assets/unicorn/symbols.webp` | Unicorn Royale symbol sheet in the same 5×15, 180×104-cell format as `gems.webp`. The source sheet had an opaque pastel background, so each symbol was cut out: outline from edge energy on the calm frames 0 and 4, reused for all frames, then background colour keyed out near the edges. A faint tinted fringe remains on some symbols; transparent-background art from the owner would fix it. |
| `assets/unicorn/jackpot-0..5.webp` | The 6-frame JACKPOT banner (768×341 each). The amount is drawn over its purple plate (left 35.8%, top 76.8%, width 28.4%, height 11.4%). |
| `assets/unicorn/bg.jpg` | Blurred page background for Unicorn Royale. |
| `assets/start/bg-0..3.webp` | Start-screen background frames (832×466 each), cut from the owner's 2×2 casino sheet (tile origins (0,0), (836,0), (0,471), (836,471)). |
| `assets/start/title-0..3.webp` | "Slots Gallery" title frames (1149×370 each), cut from the owner's 4-row title sheet (frame tops at y = 20, 363, 704, 1047). Each frame is clipped to its own band, and glow is kept only near the artwork, so stray glow noise on the sheet is dropped. |
| `assets/menu/<machine-id>.webp` | Menu card thumbnails (frame 0 of each machine, with its screen hole filled dark). |
| `assets/bg.jpg` | Blurred casino background for the page. |
| `icons/` | App icons (180 / 192 / 512). |

## Start screen

- `#startScreen` (fixed, above the game) is the first thing shown. Its background and title each crossfade through their 4 frames, reusing the `mf1/mf2/mf3` keyframes (background 4.8 s, title 2.4 s). The title drops in, then gently floats. **TAP TO START** flashes, and the version is shown at the bottom.
- Startup (end of `app.js`): the start screen appears as soon as its 8 images load, while the game artwork keeps loading behind it (`gameReady`). Tapping anywhere (or pressing Space/Enter) calls `startGame()`. That shows "Loading…" if the game artwork isn't ready yet, then reveals `#app`, runs `init()` and fades the start screen out.
- The start screen shows on every launch, including after an update reload.

## Machine menu

- Flow: start screen → `#menuScreen` (machine select) → game (`#app`). The ‹ MENU button in the game and "Back to machine menu" in Settings go back. Leaving is blocked mid-spin and during free spins, and turns autoplay off.
- `MACHINES` in `app.js` lists every machine: `id`, `name`, `tagline`, `thumb`, `ready`, `symbolWord` ('gem'/'symbol', used in the paytable), `art` (aspect, 4 frames, symbol sheet, button strips, page bg, optional 6 jackpot frames) and `layout` ([left, top, width, height] percentages for `reels`, `bet`, `bal`, `win`, optional `jackpot` plate, and every `btn*`). `ready: false` shows a dimmed "COMING SOON" card.
- `openMachine(id)` waits for that machine's art, then `enterMachine()` → `applyMachine()` points the one shared game screen at it (`--ar`, `--symSheet`, frame and button images, element positions, `#machine.m-<id>` class) and loads its saved state.
- **Adding a machine:** add its math to `DEFS` in `engine.js`, tune it with `MACHINE=<id> node tools/simulate.js`, cut its art into the same formats, measure its layout, add a `MACHINES` entry, a menu thumbnail and `sw.js` cache entries.
- The menu is a **placeholder design**: it reuses the start-screen background and title. The owner will supply menu artwork later.

## Layout of the machine

- `#machine` keeps the artwork's aspect ratio (1184/1024) and is a CSS container (`container-type: inline-size`), so text inside uses `cqw` units.
- `#machineArt` holds the 4 frame `<img>`s. Frame 0 is always visible; frames 1–3 crossfade over it in turn (0 → 1 → 2 → 3 → 0), using opacity keyframes `mf1/mf2/mf3`. The cycle length is `--mfDur`: 4.8s idle, 1.6s while `#machine.spinning` (spinning, autoplay or free spins), and 0.8s during `#machine.celebrate` (3 s after a win of 5× the bet or more). Reduce Motion slows it to 12s. A mask fades out the bottom of the cabinet, where the art is cut off.
- `#reelWindow` sits **under** `#machineArt`, filling the transparent screen hole: left 23.14%, top 28.22%, width 55.32%, height 27.83%.
- The `.disp` elements (BET / BALANCE / WIN) are positioned over the printed displays (inline styles in `index.html`; text is `3.3cqw`).
- The `.mbtn` buttons are positioned over the printed buttons. `app.js` adds `<span.art><span.frames>` inside each one. `.art` is the visible window (28% padding each side for the glow, overflow hidden), and `.frames` is the 4-frame strip (`width: 400%`). Animations pick a frame with `transform: translateX(0 / -25% / -50% / -75%)`:
  - idle: an occasional, staggered shimmer (`btnShimmer`); SPIN shimmers more often and gently "breathes";
  - `.pressed`: glow frame and sink in. JS adds it on pointerdown, because iOS doesn't reliably apply `:active`;
  - `.tapped`: a glow → sparkle → normal flash on release;
  - `.on`: SPIN pulses between glow and sparkle while spinning, in autoplay or during free spins;
  - disabled: dimmed frame 2, no animation.
- `::after` enlarges each button's touch target.
- If the machine artwork changes, re-measure the screen, display and button percentages on the 1184×1024 canvas: find the alpha-0 hole, and the dark display boxes and button rings by scanning pixel rows and columns. Then compare a screenshot with the sprite buttons hidden against one with them shown.

## Game rules and math

- 5 reels × 3 rows, 20 fixed paylines (`Engine.LINES`). Line wins pay left to right from reel 1, for 3 or more in a row; only the best win per line is paid.
- **Diamond (id 2) is Wild**: it substitutes for every gem except the Opal, and also has its own payouts.
- **Opal (id 9) is Scatter**: it pays anywhere, multiplied by the total bet (3/4/5 = 2×/5×/20×), and awards 8/12/20 free spins, which can retrigger.
- Line bets are `[1, 2, 5, 10, 25, 50]`; total bet = line bet × 20. The player starts with 2,000 credits and is refilled for free at 0.
- Each cell is drawn independently using the symbol weights `w` (there are no reel strips).
- **Tuning target: a forgiving, low-volatility free-play game.** The owner wants players to win often and only run out of credits when they bet big on a small balance. The current table measures:
  - RTP (return to player) of about 103%, with about 49% of paid spins winning something and about 30% paying back at least the total bet; volatility is about 2.0 (standard deviation per spin, in total bets).
  - Starting at 2,000 credits, players run out within 300 spins about 0% of the time at bet 20, about 7% at bet 40, and about 46% at bet 100. Bets of 200 or more are meant to stay risky.
- The Diamond's weight (`w: 12`) is the main lever for how often spins win, because it substitutes on every line. The 3-of-a-kind payouts carry most of the return; 4- and 5-of-a-kind are kept modest to keep volatility down.
- After changing weights or payouts, run `node tools/simulate.js` (add `MACHINE=unicorn-royale` for Unicorn Royale). Keep RTP between 101% and 106%, volatility around 2.0–2.5, and the bet-20 and bet-40 bust rates (from 2,000 credits) at or below 10%.
- Win presentation: all winning lines at once, then each win in turn. A win of 15× the bet or more shows BIG WIN, 40× MEGA WIN, and 100× EPIC WIN.
- Controls: tap SPIN to spin, tap again while the reels move to stop them quickly, and press-and-hold SPIN to start autoplay (tap SPIN to stop it). **i** opens the paytable, ⚙ opens settings (reset credits, check for updates, version), and the full-screen button shows a hint on iOS.
- State: credits are **shared by every machine** and stored in `gem-royale-state-v1` (the original key, so old saves still work). Each machine's bet and free spins live in its own key: Gem Royale's in `gem-royale-state-v1`, others in `<id>-state-v1`.

### Unicorn Royale
- Same reels, lines, bets and free-spin rules as Gem Royale. **Rainbow (id 3) is wild; Cloud Castle (id 9) is the scatter.**
- **JACKPOT (id 14)** pays anywhere and is not substituted by the wild: 3 = 2×, 4 = 10× the total bet. `jackpotAt` (5) or more win the **progressive jackpot**:
  - the pot starts at `jackpotSeed` (10,000) and every *paid* spin adds `jackpotRate` (2%) of its total bet (free spins add nothing);
  - a win pays the **whole pot, whatever the bet**, then the pot restarts at the seed;
  - the pot lives in `state.jackpotPool`, is saved as `jackpotPool` in `unicorn-royale-state-v1` (rounded to the cent to avoid float drift), and is passed to `evaluate(grid, lineBet, { jackpotPool })`;
  - the machine's JACKPOT plate shows the live pot (it glints on each bet), and a win plays the 6-frame banner overlay (tap to collect).
- Measured (`MACHINE=unicorn-royale LINE_BET=<n> node tools/simulate.js`): a jackpot about every 14,000–16,000 spins; average pot ≈ 15k at bet 20, 39k at bet 100, 335k at bet 1,000. RTP ≈ 107% / 104% / 103% at bet 20 / 100 / 1,000 (the jackpot is 6% / 3% / 2% of it, since the fixed seed matters more at small bets). ~49% of spins win, ~32% pay back the bet. Bust rates from 2,000 credits: 0% / 8–9% / 48% at bet 20 / 40 / 100. Keep these when retuning.

Simulation: `node tools/simulate.js` (options `MACHINE`, `LINE_BET`, `SPINS`, `SESSIONS`) prints RTP, hit rates and volatility, plus how often players run out of credits at each bet, starting from 2,000 and from 300 credits. Use `SPINS=200000 SESSIONS=500` for a quicker run. `tools/` is not deployed.

## Versioning and auto-update

- The version is a real semantic version stored in the repo: `version.json`, the `app-version` meta tag and the `?v=` queries in `index.html`, and `VERSION` in `sw.js`. Change it only with `node tools/bump-version.js`. The deploy workflow fails if these don't match.
- Settings (⚙) shows the version prominently. It also appears at the end of the hint line under the machine and at the bottom of the start screen.
- `CHANGELOG.md` records every release. The deploy fails if the current version has no changelog section, or if that section still contains `TODO`.
- Each time the app opens, comes back to the foreground, or comes back online (and every 15 minutes), `update.js` fetches `version.json` with `cache: 'no-store'`. If that version differs from the running one, it clears all caches, updates the service worker and reloads via `?v=<version>`. During a spin or free spins, it waits until the game is idle (`AppUpdate.idle()`). A sessionStorage guard prevents reload loops.
- If the version isn't bumped, installed apps will not pick up the change. **When you add a new asset or script, also add it to `SHELL` in `sw.js`**, so it is cached for offline use.

## Testing

```
python3 -m http.server 8000      # from the repo root, then open http://localhost:8000
```
- To test the update flow, serve a copy of the site from a temp folder, open it, then run `node tools/bump-version.js patch` inside that copy and trigger a resume (a `visibilitychange` event). The page should reload to the start screen showing the new version.
- Tests must tap through the start screen (wait for `#startScreen:not([hidden])`, click it), then pick a machine in the menu (`.mn-card[data-machine="<id>"]`) before the game controls exist. Test **both** machines.
- To force a result, replace that machine's `Engines[id].spinGrid` in the page with one that returns a fixed grid once (e.g. five JACKPOT symbols to see the jackpot overlay).
- `sw.js` de-duplicates `SHELL` before `cache.addAll()`; duplicate requests make `addAll` reject and nothing gets cached.
- Use Playwright with `devices['iPhone 14']`, `devices['iPhone 14 landscape']` and `devices['iPhone SE']`. Check that there are no page errors, the machine fits the screen, spin/bet/autoplay/help work, and nothing overflows horizontally.
