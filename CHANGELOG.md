# Changelog

All notable changes to Gem Royale are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html):

- **MAJOR** — incompatible changes, e.g. a redesign or a change that resets or breaks saved player data;
- **MINOR** — backwards-compatible new features, visible UI changes, new artwork or payout rebalancing;
- **PATCH** — backwards-compatible bug fixes and small tweaks.

The version shown in the app's Settings matches the newest entry. Versions 1.0.0–1.3.0 were
released before numbering was added to the app and are recorded here retroactively.

## [1.7.0] - 2026-11-06

### Added
- Machine select menu (placeholder design) between the start screen and the game, listing every machine in the gallery: Gem Royale (playable) and Unicorn Royale (coming soon).
- ‹ MENU button in the game and "Back to machine menu" in Settings. Leaving is blocked mid-spin and during free spins, and turns autoplay off.

## [1.6.0] - 2026-11-06

### Added
- "Slots Gallery" start screen: animated casino background and animated title (four frames each), with a flashing TAP TO START. The game loads behind it.
- `CHANGELOG.md`, formal Semantic Versioning 2.0.0 rules, and a deploy check that validates the version format, that all copies agree, and that the release has a changelog entry.

## [1.5.0] - 2026-11-06

### Added
- Animated machine: the four supplied machine frames crossfade in a cycle, faster while spinning and on wins.

### Changed
- Reel window, displays and buttons re-positioned for the new machine artwork.

## [1.4.0] - 2026-11-06

### Added
- Version number shown in Settings and under the machine.
- `tools/bump-version.js` and the rule to bump the version on every change.

### Fixed
- Button and gem animations now run on iOS Safari (frames stepped with transforms instead of `background-position`).
- Deploys publish a real version number, so the update check works with either Pages deploy route.

## [1.3.0] - 2026-11-06

### Changed
- Payouts rebalanced: wins are more frequent, and players rarely run out of credits at low bets (~103% return).

## [1.2.0] - 2026-11-06

### Added
- Animated machine buttons using the supplied button frames.

## [1.1.0] - 2026-11-06

### Changed
- New machine artwork with BET / BALANCE / WIN displays and sprite buttons; hold SPIN for autoplay.

## [1.0.0] - 2026-11-06

### Added
- First release: 5×3, 20-line gem slot as an installable iPhone PWA, with paytable, free spins, autoplay and auto-update.
