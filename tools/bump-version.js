#!/usr/bin/env node
// Bump the app version everywhere it appears, following Semantic Versioning 2.0.0 (https://semver.org).
//
//   node tools/bump-version.js patch          # 1.6.0 -> 1.6.1   backwards-compatible bug fixes
//   node tools/bump-version.js minor          # 1.6.0 -> 1.7.0   new features / visible changes / rebalancing
//   node tools/bump-version.js major          # 1.6.0 -> 2.0.0   incompatible changes (e.g. saved data reset)
//   node tools/bump-version.js 1.7.0-beta.1   # set an explicit version (pre-release tags allowed)
//   node tools/bump-version.js --check        # only validate: semver format, all copies agree, changelog entry
//
// version.json is the source of truth. The script also rewrites the app-version meta tag and every ?v=
// cache-busting query in index.html, VERSION in sw.js (which renames the offline cache), and adds a
// "## [x.y.z] - YYYY-MM-DD" section to the top of CHANGELOG.md for you to fill in.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const file = f => path.join(root, f);

// Official SemVer 2.0.0 pattern (from semver.org).
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const esc = v => v.replace(/[.+]/g, m => '\\' + m);

const current = JSON.parse(fs.readFileSync(file('version.json'), 'utf8')).version;
const arg = process.argv[2];

function check(v) {
  const errors = [];
  if (!SEMVER.test(v)) errors.push(`"${v}" in version.json is not a valid semantic version (MAJOR.MINOR.PATCH)`);
  const html = fs.readFileSync(file('index.html'), 'utf8');
  if (!html.includes(`<meta name="app-version" content="${v}">`)) errors.push('index.html app-version meta does not match');
  const stale = (html.match(/\?v=[0-9A-Za-z.+-]+/g) || []).filter(q => q !== `?v=${v}`);
  if (stale.length) errors.push(`index.html has ?v= queries that are not ${v}: ${[...new Set(stale)].join(', ')}`);
  if (!fs.readFileSync(file('sw.js'), 'utf8').includes(`const VERSION = '${v}';`)) errors.push('sw.js VERSION does not match');
  const log = fs.existsSync(file('CHANGELOG.md')) ? fs.readFileSync(file('CHANGELOG.md'), 'utf8') : '';
  if (!new RegExp(`^## \\[${esc(v)}\\]`, 'm').test(log)) errors.push(`CHANGELOG.md has no "## [${v}]" section`);
  else {
    const section = log.slice(log.search(new RegExp(`^## \\[${esc(v)}\\]`, 'm'))).split(/^## \[/m)[1] || '';
    if (/TODO/.test(section)) errors.push(`CHANGELOG.md entry for ${v} still contains a TODO`);
  }
  return errors;
}

if (arg === '--check') {
  const errors = check(current);
  if (errors.length) { console.error(errors.map(e => '✗ ' + e).join('\n')); process.exit(1); }
  console.log(`✓ Version ${current} is valid semver and consistent everywhere`);
  process.exit(0);
}

let next;
if (arg && SEMVER.test(arg)) next = arg;
else {
  const m = current.match(SEMVER);
  if (!m) { console.error(`Current version "${current}" is not valid semver; pass an explicit version.`); process.exit(1); }
  const [maj, min, pat] = [m[1], m[2], m[3]].map(Number);
  if (arg === 'major') next = `${maj + 1}.0.0`;
  else if (arg === 'minor') next = `${maj}.${min + 1}.0`;
  else if (arg === 'patch') next = m[4] ? `${maj}.${min}.${pat}` : `${maj}.${min}.${pat + 1}`; // 1.6.0-beta.1 -> 1.6.0
  else { console.error('Usage: node tools/bump-version.js <major|minor|patch|x.y.z[-pre]|--check>'); process.exit(1); }
}

fs.writeFileSync(file('version.json'), JSON.stringify({ version: next }, null, 2) + '\n');

let html = fs.readFileSync(file('index.html'), 'utf8');
html = html.replace(/(<meta name="app-version" content=")[^"]*(")/, `$1${next}$2`)
           .replace(/\?v=[0-9A-Za-z.+-]+/g, `?v=${next}`);
fs.writeFileSync(file('index.html'), html);

let sw = fs.readFileSync(file('sw.js'), 'utf8');
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${next}';`);
fs.writeFileSync(file('sw.js'), sw);

// Changelog: add a section for the new version (once), above the newest existing one.
const logPath = file('CHANGELOG.md');
let log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '# Changelog\n\n';
if (!new RegExp(`^## \\[${esc(next)}\\]`, 'm').test(log)) {
  const today = new Date().toISOString().slice(0, 10);
  const entry = `## [${next}] - ${today}\n\n### Changed\n- TODO: describe this release\n\n`;
  const at = log.search(/^## \[/m);
  log = at === -1 ? log.trimEnd() + '\n\n' + entry : log.slice(0, at) + entry + log.slice(at);
  fs.writeFileSync(logPath, log);
}

console.log(`Version ${current} -> ${next}  (fill in the CHANGELOG.md entry)`);
