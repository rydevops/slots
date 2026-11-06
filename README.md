# Gem Royale

A free-play, 5-reel × 3-row, 20-line gem slot machine built as an installable PWA for iPhone.

## Play on iPhone
1. Open the GitHub Pages URL in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Launch **Gem Royale** from the home screen (runs full screen, works offline).

## Deploying
Pushing to `main` runs `.github/workflows/pages.yml`, which copies the site to `_site/`,
replaces every `__BUILD__` placeholder with a unique build id (timestamp + commit) and publishes it.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Auto-update
Every time the app opens or returns to the foreground, `js/update.js` fetches `version.json`
with `cache: no-store`. If the deployed build id differs from the running one it clears the
service-worker caches and reloads into the new version (waiting until the reels stop if a spin
or free spins are in progress). Settings (⚙ on the machine) also has a manual “Check for updates”.

## Game rules
- Diamond = Wild (substitutes for all but Opal). Opal = Scatter: pays anywhere and awards free spins.
- Line bets 1–50 per line, 20 fixed lines. Paytable is in-game via the **i** button.
- Tap SPIN to play, tap again to quick-stop; press and hold SPIN for autoplay.
- Theoretical return is ~96–98% (simulated with `js/engine.js`).

## Run locally
```
python3 -m http.server 8000
```
then open http://localhost:8000.
