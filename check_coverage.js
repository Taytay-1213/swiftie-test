const fs = require('fs');
const c = fs.readFileSync('guess-tswift.html', 'utf-8');

// Extract SONG_DATABASE
const sm = c.match(/const SONG_DATABASE = \[([\s\S]*?)\];/);
const dbCode = 'var SONG_DATABASE; SONG_DATABASE = [' + sm[1] + '];';
eval(dbCode);

// Extract LYRICS_POOL
const lm = c.match(/const LYRICS_POOL = \[([\s\S]*?)\];/);
const raw = lm[1];
const lyricSongs = new Map(); // song -> era
const entryRegex = /\{\s*lyric\s*:\s*"([^"]*)"\s*,\s*song\s*:\s*"([^"]*)"\s*,\s*era\s*:\s*"([^"]*)"\s*,\s*hint\s*:\s*"([^"]*)"\s*\}/g;
let m;
while ((m = entryRegex.exec(raw)) !== null) {
  if (!lyricSongs.has(m[2])) {
    lyricSongs.set(m[2], m[3]);
  }
}

// Check each album
const albums = {};
SONG_DATABASE.forEach(s => {
  if (!albums[s.album]) albums[s.album] = { total: 0, covered: 0, missing: [] };
  albums[s.album].total++;
  if (lyricSongs.has(s.title)) {
    albums[s.album].covered++;
  } else {
    albums[s.album].missing.push(s.title);
  }
});

console.log('=== 各专辑歌词覆盖率 ===\n');
Object.entries(albums).forEach(([album, info]) => {
  const pct = Math.round((info.covered / info.total) * 100);
  const bar = '█'.repeat(Math.round(pct/5)) + '░'.repeat(Math.max(0, 20-Math.round(pct/5)));
  console.log(`${bar} ${pct}%  ${album} (${info.covered}/${info.total})`);
  if (info.missing.length > 0) {
    info.missing.forEach(t => console.log(`       ❌ ${t}`));
  }
  console.log();
});

// Songs in lyrics but not in song database
const allLyricSongs = new Set();
const entryRegex2 = /\{\s*lyric\s*:\s*"([^"]*)"\s*,\s*song\s*:\s*"([^"]*)"\s*,\s*era\s*:\s*"([^"]*)"\s*,\s*hint\s*:\s*"([^"]*)"\s*\}/g;
while ((m = entryRegex2.exec(raw)) !== null) {
  allLyricSongs.add(m[2]);
}

const dbSongs = new Set(SONG_DATABASE.map(s => s.title));
const extraSongs = [...allLyricSongs].filter(s => !dbSongs.has(s));
if (extraSongs.length > 0) {
  console.log('=== 歌词池中有但歌曲库中找不到的歌曲 ===');
  extraSongs.forEach(s => console.log(`  ❓ ${s}`));
}

console.log(`\n=== 总结 ===`);
console.log(`歌曲库总曲目: ${SONG_DATABASE.length}`);
console.log(`歌词池覆盖歌曲: ${allLyricSongs.size} 首`);
console.log(`歌词条目总数: ${(raw.match(/\{/g) || []).length}`);
