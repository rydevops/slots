#!/usr/bin/env node
// Bump the app version everywhere it appears.
//
//   node tools/bump-version.js patch   # 1.4.0 -> 1.4.1  (bug fixes only)
//   node tools/bump-version.js minor   # 1.4.0 -> 1.5.0  (new features / visible changes / rebalancing)
//   node tools/bump-version.js major   # 1.4.0 -> 2.0.0  (big redesigns or changes that reset saved data)
//   node tools/bump-version.js 1.6.2   # set an explicit version
//
// version.json is the source of truth. The script also rewrites the app-version meta tag and every
// ?v= cache-busting query in index.html, and VERSION in sw.js (which renames the offline cache).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const file = f => path.join(root, f);

const current = JSON.parse(fs.readFileSync(file('version.json'), 'utf8')).version;
const arg = process.argv[2];
let next;
if (/^\d+\.\d+\.\d+$/.test(arg || '')) next = arg;
else {
  const [maj, min, pat] = current.split('.').map(Number);
  if (arg === 'major') next = `${maj + 1}.0.0`;
  else if (arg === 'minor') next = `${maj}.${min + 1}.0`;
  else if (arg === 'patch') next = `${maj}.${min}.${pat + 1}`;
  else { console.error('Usage: node tools/bump-version.js <major|minor|patch|x.y.z>'); process.exit(1); }
}

fs.writeFileSync(file('version.json'), JSON.stringify({ version: next }, null, 2) + '\n');

let html = fs.readFileSync(file('index.html'), 'utf8');
html = html.replace(/(<meta name="app-version" content=")[^"]*(")/, `$1${next}$2`)
           .replace(/\?v=[0-9A-Za-z._-]+/g, `?v=${next}`);
fs.writeFileSync(file('index.html'), html);

let sw = fs.readFileSync(file('sw.js'), 'utf8');
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${next}';`);
fs.writeFileSync(file('sw.js'), sw);

console.log(`Version ${current} -> ${next}`);
