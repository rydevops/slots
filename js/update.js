// Version checking + service worker registration.
// Every time the app is opened (or brought back to the foreground) it fetches
// version.json straight from the network. If the deployed version differs from
// the one that is running, caches are cleared and the page reloads.
(function () {
  const meta = document.querySelector('meta[name="app-version"]');
  const APP_VERSION = meta ? meta.content : 'dev';
  const RELOAD_KEY = 'gem-royale-reloaded-for';
  let checking = false;
  let pendingVersion = null;

  async function fetchLatestVersion() {
    const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return data.version;
  }

  async function applyUpdate(version) {
    const busy = window.GemRoyale && window.GemRoyale.isBusy && window.GemRoyale.isBusy();
    if (busy) { pendingVersion = version; return; }   // wait until the reels stop
    sessionStorage.setItem(RELOAD_KEY, version);
    const overlay = document.getElementById('updating');
    if (overlay) overlay.hidden = false;
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update().catch(() => {});
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) { /* ignore */ }
    // A unique URL guarantees the browser can't hand back a stale cached index.html
    const url = location.pathname + '?v=' + encodeURIComponent(version) + location.hash;
    location.replace(url);
  }

  async function check(manual) {
    if (checking || !navigator.onLine) {
      if (manual) window.GemRoyale && window.GemRoyale.toast('You appear to be offline');
      return;
    }
    checking = true;
    try {
      const latest = await fetchLatestVersion();
      if (latest && latest !== APP_VERSION) {
        // Avoid reload loops if the CDN hasn't caught up yet
        if (!manual && sessionStorage.getItem(RELOAD_KEY) === latest) return;
        await applyUpdate(latest);
      } else if (manual) {
        window.GemRoyale && window.GemRoyale.toast('You have the latest version');
      }
    } catch (e) {
      if (manual) window.GemRoyale && window.GemRoyale.toast('Could not check for updates');
    } finally {
      checking = false;
    }
  }

  // Clean the ?v= query left by an update reload
  if (location.search.includes('v=')) {
    history.replaceState(null, '', location.pathname + location.hash);
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
    });
  }

  // On every open / resume
  check(false);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(false); });
  window.addEventListener('pageshow', e => { if (e.persisted) check(false); });
  window.addEventListener('online', () => check(false));
  setInterval(() => check(false), 15 * 60 * 1000);

  window.AppUpdate = {
    version: APP_VERSION,
    check: () => check(true),
    // called by the game once the reels are idle
    idle: () => { if (pendingVersion) { const v = pendingVersion; pendingVersion = null; applyUpdate(v); } },
  };
})();
