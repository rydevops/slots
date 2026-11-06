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
4. **Every change must increment the version number**, using semantic versioning (`MAJOR.MINOR.PATCH`) chosen by the kind of change:
   - **PATCH** (1.4.0 → 1.4.1): bug fixes and small tweaks with no new behaviour;
   - **MINOR** (1.4.0 → 1.5.0): new features, visible UI changes, new artwork or payout rebalancing;
   - **MAJOR** (1.4.0 → 2.0.0): big redesigns, or changes that reset or break saved player data.

   Bump it with `node tools/bump-version.js <patch|minor|major>`; it updates every place the version appears (see *Versioning and auto-update*). Never edit the version numbers by hand. Use one bump per PR: if a branch already has a bump and more changes are added, re-run with an explicit version (e.g. `node tools/bump-version.js 1.5.0`) instead of bumping twice.
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
| `tools/bump-version.js` | Bumps the version everywhere: `version.json`, the meta tag and `?v=` queries in `index.html`, and `VERSION` in `sw.js`. |
| `js/engine.js` | Game math only (no DOM): symbols, weights, payouts, 20 paylines, `spinGrid()`, `evaluate()`. Also loadable in Node for simulations. |
| `js/app.js` | UI and game loop: reel animation (Web Animations API), win presentation, free spins, autoplay, paytable builder, persistence. |
| `js/update.js` | Version check, service worker registration, update-reload logic. |
| `sw.js` | Service worker: offline cache (`gem-royale-<version>`), network-first with cache fallback. |
| `version.json` | `{ "version": "x.y.z" }`. This is the source of truth for the version; the app compares it with the version it is running. |
| `.nojekyll` | Stops GitHub's branch-based Pages build from running Jekyll over the repo. |
| `manifest.webmanifest` | PWA manifest. |
| `assets/machine.webp` | Machine artwork (1184×1024, cropped from the owner's 1536×1024 image). The screen area is transparent. |
| `assets/gems.webp` | Gem sprite sheet: 5 columns (animation frames) × 15 rows (gems), each cell 180×104. Rendered as `.gem` (window, overflow hidden) > `.gem-row` (500%×1500%, `translateY` to the gem's row) > `.gem-frames` (`translateX` steps through the frames on a win). |
| `assets/btn/<name>.webp` | Button sprite strips (names: `settings, info, sound, spin, minus, plus, full`). Each is 4 equal frames side by side, taken from the owner's button sheet: 0 = normal, 1 = bright sparkle, 2 = soft shine, 3 = magenta glow. Each frame has 28% padding on every side for its glow. |
| `assets/bg.jpg` | Blurred casino background for the page. |
| `icons/` | App icons (180 / 192 / 512). |

## Layout of the machine

- `#machine` keeps the artwork's aspect ratio (1184/1024) and is a CSS container (`container-type: inline-size`), so text inside uses `cqw` units.
- `#reelWindow` sits **under** `#machineImg`, filling the transparent screen hole: left 17.65%, top 27.54%, width 64.61%, height 31.64%.
- The `.disp` elements (BET / BALANCE / WIN) are positioned over the printed displays.
- The `.mbtn` buttons are positioned over the printed buttons. `app.js` adds `<span.art><span.frames>` inside each one. `.art` is the visible window (28% padding each side for the glow, overflow hidden), and `.frames` is the 4-frame strip (`width: 400%`). Animations pick a frame with `transform: translateX(0 / -25% / -50% / -75%)`:
  - idle: an occasional, staggered shimmer (`btnShimmer`); SPIN shimmers more often and gently "breathes";
  - `.pressed`: glow frame and sink in. JS adds it on pointerdown, because iOS doesn't reliably apply `:active`;
  - `.tapped`: a glow → sparkle → normal flash on release;
  - `.on`: SPIN pulses between glow and sparkle while spinning, in autoplay or during free spins;
  - disabled: dimmed frame 2, no animation.
- `::after` enlarges each button's touch target.
- If the machine artwork changes, re-measure these percentages. Coordinates are in the cropped 1184×1024 space: the original x minus 176.

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
- After changing weights or payouts, run `node tools/simulate.js`. Keep RTP between 101% and 106%, volatility around 2.0–2.5, and the bet-20 and bet-40 bust rates (from 2,000 credits) at or below 10%.
- Win presentation: all winning lines at once, then each win in turn. A win of 15× the bet or more shows BIG WIN, 40× MEGA WIN, and 100× EPIC WIN.
- Controls: tap SPIN to spin, tap again while the reels move to stop them quickly, and press-and-hold SPIN to start autoplay (tap SPIN to stop it). **i** opens the paytable, ⚙ opens settings (reset credits, check for updates, version), and the full-screen button shows a hint on iOS.
- State is saved in `localStorage` under the key `gem-royale-state-v1`.

Simulation: `node tools/simulate.js` prints RTP, hit rates and volatility, plus how often players run out of credits at each bet, starting from 2,000 and from 300 credits. Use `SPINS=200000 SESSIONS=500` for a quicker run. `tools/` is not deployed.

## Versioning and auto-update

- The version is a real semantic version stored in the repo: `version.json`, the `app-version` meta tag and the `?v=` queries in `index.html`, and `VERSION` in `sw.js`. Change it only with `node tools/bump-version.js`. The deploy workflow fails if these don't match.
- Settings (⚙) shows the version prominently, and it also appears at the end of the hint line under the machine.
- Each time the app opens, comes back to the foreground, or comes back online (and every 15 minutes), `update.js` fetches `version.json` with `cache: 'no-store'`. If that version differs from the running one, it clears all caches, updates the service worker and reloads via `?v=<version>`. During a spin or free spins, it waits until the game is idle (`AppUpdate.idle()`). A sessionStorage guard prevents reload loops.
- If the version isn't bumped, installed apps will not pick up the change. **When you add a new asset or script, also add it to `SHELL` in `sw.js`**, so it is cached for offline use.

## Testing

```
python3 -m http.server 8000      # from the repo root, then open http://localhost:8000
```
- To test the update flow, serve a copy of the site from a temp folder, open it, then run `node tools/bump-version.js patch` inside that copy and trigger a resume (a `visibilitychange` event). The page should reload showing the new version.
- Use Playwright with `devices['iPhone 14']`, `devices['iPhone 14 landscape']` and `devices['iPhone SE']`. Check that there are no page errors, the machine fits the screen, spin/bet/autoplay/help work, and nothing overflows horizontally.
