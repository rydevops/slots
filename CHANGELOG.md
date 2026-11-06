# Changelog

All notable changes to Gem Royale are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html):

- **MAJOR** — incompatible changes, e.g. a redesign or a change that resets or breaks saved player data;
- **MINOR** — backwards-compatible new features, visible UI changes, new artwork or payout rebalancing;
- **PATCH** — backwards-compatible bug fixes and small tweaks.

The version shown in the app's Settings matches the newest entry. Versions 1.0.0–1.3.0 were
released before numbering was added to the app and are recorded here retroactively.

## [1.12.0] - 2026-11-06

### Changed
- The game is now titled **Gambling Arena**. The start screen and machine menu use the new 4-frame animated title, which crossfades through its frames like the old one.
- App name updated to Gambling Arena: browser tab, home-screen name for new installs, accessibility labels and Settings text.

### Fixed
- In landscape, the "Sound on" line on the start screen overlapped the version number.

## [1.11.0] - 2026-11-06

### Changed
- Machine menu cards now use the supplied Gem Royale and Unicorn Royale artwork. The whole card, with its built-in PLAY button, is the tap target, rounded to match its gold border, with a soft light sweeping across it. "LOADING…" appears over the PLAY button while a machine loads.

### Removed
- The placeholder card frame, name, tagline, PLAY badge and NEW ribbon.

## [1.10.0] - 2026-11-06

### Added
- **Music and sound effects**, all generated live in the browser (Web Audio API), with no audio files.
  - **Music:** a lounge-jazz theme for the title screen and menu, a bright casino-swing theme with glassy bells for Gem Royale, and a dreamy harp-and-celesta theme for Unicorn Royale. Themes crossfade when you change screen.
  - **Sound effects:**
    - start chime, menu select/back, and button presses;
    - bet up/down (pitch follows the bet) and autoplay on/off;
    - spin whoosh, reel ticking and a thunk as each reel stops;
    - win jingles in each machine's own instrument (bells for Gem Royale, harp for Unicorn Royale) and coin ticks while wins count up;
    - BIG WIN fanfare, free-spins glissando, JACKPOT fanfare with a coin shower, and an out-of-credits buzz.
  - **Mixing:** music ducks under fanfares and pauses while the app is in the background.
- **Sound controls:**
  - the machine's 🔊 button mutes or unmutes everything (a red slash shows when muted);
  - a 🔊/🔇 button on the menu;
  - Music and Sound-effects switches with volume sliders in Settings.

  Choices are saved in `slots-audio-v1`.

### Changed
- iPhones only allow sound after a tap, so the lobby music starts on TAP TO START. Sound follows the iPhone's silent switch and mixes with other apps' audio.

## [1.9.0] - 2026-11-06

### Changed
- Unicorn Royale's JACKPOT is now a **progressive jackpot**. It starts at 10,000 credits, grows by 2% of every paid bet on the machine, is paid in full (whatever the bet) when 5 or more JACKPOT symbols land, then restarts at 10,000.
- The machine's JACKPOT plate shows the live pot and glints each time it grows. The pot is saved, so it keeps growing between sessions.
- The paytable explains how the jackpot grows and shows its current value.
- `tools/simulate.js` models the growing pot and reports the average jackpot and its share of the return. New `LINE_BET` option.

## [1.8.0] - 2026-11-06

### Added
- **Unicorn Royale is playable**: its own animated machine, buttons, 15 animated symbols and a 6-frame JACKPOT banner.
  - Rainbow is wild; Cloud Castle is the free-spins scatter (8 / 12 / 20 spins).
  - JACKPOT symbols pay anywhere: 3 = 2× and 4 = 10× the total bet; 5 or more win the JACKPOT (1,000× the total bet, shown on the machine's JACKPOT plate).
  - Tuned like Gem Royale: ~106% return, about half of spins win, and low bets rarely run out of credits. The jackpot lands about once in 20,000 spins.
- `MACHINE=<id>` option for `tools/simulate.js`.

### Changed
- One shared balance across all machines; each machine remembers its own bet and free spins. Existing Gem Royale saves carry over.
- The game screen is now driven by a per-machine config (art, layout, math), so new machines can be added without new screens.
- Paytable wording adapts to the machine (gems vs symbols, jackpot section).

### Fixed
- The offline cache list contained duplicate URLs, which can make the service worker cache nothing at all.

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
