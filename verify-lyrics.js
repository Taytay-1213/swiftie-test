/**
 * verify-lyrics.js — 用 taylor R 包官方歌词数据校验 guess-tswift.html 中的 LYRICS_POOL
 *
 * 使用方式: node verify-lyrics.js
 *
 * 数据来源: https://github.com/wjakethompson/taylor (Genius.com → taylor R 包)
 */

const fs = require('fs');
const path = require('path');

// ====================== 配置 ======================
const HTML_FILE = 'F:\\Users\\SZ\\Desktop\\guess\\guess-tswift.html';
const LYRICS_DIR = 'F:\\Users\\SZ\\Desktop\\guess\\taylor_lyrics\\taylor-main\\data-raw\\lyrics';

// 标准化函数：去标点、去空格、转小写
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[''']/g, "'")     // 统一引号
    .replace(/[^a-z0-9\s']/g, '')  // 去标点（保留单引号和空格）
    .replace(/\s+/g, ' ')
    .trim();
}

// ====================== 1. 从 HTML 提取 LYRICS_POOL ======================
function extractLyricsPool(html) {
  // 找到 const LYRICS_POOL = [ ... ];
  const match = html.match(/const\s+LYRICS_POOL\s*=\s*\[([\s\S]*?)\];/);
  if (!match) throw new Error('找不到 LYRICS_POOL');

  const pool = [];
  const re = /\{\s*lyric:\s*"([^"]*?)"\s*,\s*song:\s*"([^"]*?)"\s*,/g;
  let m;
  while ((m = re.exec(match[1])) !== null) {
    pool.push({ lyric: m[1], song: m[2] });
  }
  return pool;
}

// ====================== 2. 加载所有官方歌词 ======================
function loadOfficialLyrics() {
  const songs = new Map();
  let totalFiles = 0;

  function walkDir(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        walkDir(fullPath);
      } else if (item.name.endsWith('.txt')) {
        totalFiles++;
        const nameMatch = item.name.replace('.txt', '').match(/^\d+_(.+)$/);
        const songName = nameMatch ? nameMatch[1].replace(/-/g, ' ') : item.name.replace('.txt', '').replace(/-/g, ' ');

        const content = fs.readFileSync(fullPath, 'utf-8');
        const lyricsLines = content
          .split('\n')
          .filter(line => !line.startsWith('[') && line.trim().length > 0);
        const lyricsText = normalize(lyricsLines.join(' '));
        const lineTexts = lyricsLines.map(l => normalize(l));

        const key = normalize(songName);
        const entry = { name: songName, lyrics: lineTexts, fullText: lyricsText, file: item.name };
        songs.set(key, entry);

        // 别名：去特殊字符、无空格
        for (const alias of [
          key.replace(/[^a-z0-9\s]/g, '').trim(),
          key.replace(/\s+/g, ''),
        ]) {
          if (alias !== key && !songs.has(alias)) songs.set(alias, entry);
        }
      }
    }
  }

  walkDir(LYRICS_DIR);
  console.log(`📖 已加载 ${totalFiles} 首官方歌词`);
  return songs;
}

// ====================== 3. 查找歌曲的官方歌词 ======================
function findSong(officialSongs, songName) {
  const n = normalize(songName);
  const plain = n.replace(/[^a-z0-9\s]/g, '').trim();
  const condensed = n.replace(/\s+/g, '');
  const candidates = [n, plain, condensed, plain.replace(/\s+/g, '')];

  for (const c of candidates) {
    if (officialSongs.has(c)) return officialSongs.get(c);
  }

  // 尝试模糊匹配：歌曲名可能是 key 的子串或者 key 是歌曲名的子串
  let best = null, bestScore = 0;
  for (const [key, entry] of officialSongs) {
    // 检查包含关系（处理 "(Oh My My My)" 和 "-tv-ftv" 后缀）
    if (key.includes(plain) || plain.includes(key) || key.includes(condensed) || condensed.includes(key)) {
      const score = Math.min(key.length, plain.length) / Math.max(key.length, plain.length);
      if (score > bestScore) { bestScore = score; best = entry; }
    }
  }
  if (best && bestScore > 0.5) return best;

  // Levenshtein 模糊匹配
  for (const [key, entry] of officialSongs) {
    const score = levenshteinSimilarity(n, key);
    if (score > bestScore && score > 0.5) { bestScore = score; best = entry; }
  }
  return best;
}

// Levenshtein 相似度（0-1）
function levenshteinSimilarity(a, b) {
  if (a.length === 0) return b.length === 0 ? 1 : 0;
  if (b.length === 0) return 0;
  const matrix = Array.from({length: a.length + 1}, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i-1][j] + 1, matrix[i][j-1] + 1, matrix[i-1][j-1] + cost);
    }
  }
  return 1 - matrix[a.length][b.length] / Math.max(a.length, b.length);
}

// ====================== 4. 主要校验逻辑 ======================
function verify(htmlContent) {
  console.log('🔍 正在解析 LYRICS_POOL...');
  const pool = extractLyricsPool(htmlContent);
  console.log(`📝 找到 ${pool.length} 条歌词条目\n`);

  console.log('📖 正在加载官方歌词数据...');
  const officialSongs = loadOfficialLyrics();
  console.log(`🎵 官方数据含 ${officialSongs.size} 个歌曲索引\n`);

  const errors = [];
  const warnings = [];
  let checked = 0;

  for (const [idx, entry] of pool.entries()) {
    const lineNum = idx + 839; // LYRICS_POOL 起始行号
    const normLyric = normalize(entry.lyric);
    const songInfo = findSong(officialSongs, entry.song);
    checked++;

    if (!songInfo) {
      errors.push({
        line: lineNum,
        song: entry.song,
        lyric: entry.lyric,
        issue: `❌ 未找到歌曲 "${entry.song}" 的歌词文件`
      });
      continue;
    }

    // 策略 1：全文包含（多行匹配）
    if (songInfo.fullText.includes(normLyric)) {
      continue; // ✅ 完全匹配
    }

    // 策略 2：单行包含
    if (songInfo.lyrics.some(l => l.includes(normLyric))) {
      continue; // ✅ 单行匹配
    }

    // 策略 3：近似匹配（关键词覆盖率和编辑距离）
    const lyricWords = normLyric.split(/\s+/).filter(w => w.length > 2);
    const wordCount = lyricWords.length;

    // 3a: 分词匹配 - 每个词在全文中的出现情况
    const wordsInFull = lyricWords.filter(w => songInfo.fullText.includes(w)).length;
    if (wordCount >= 4 && wordsInFull >= wordCount - 1) {
      warnings.push({
        line: lineNum,
        song: entry.song,
        lyric: entry.lyric,
        issue: `⚠️  命中 ${wordsInFull}/${wordCount} 个关键词（近似）`,
        file: songInfo.file
      });
      continue;
    }
    if (wordCount >= 4 && wordsInFull >= Math.max(2, wordCount * 0.7)) {
      warnings.push({
        line: lineNum,
        song: entry.song,
        lyric: entry.lyric,
        issue: `⚠️  命中 ${wordsInFull}/${wordCount} 个关键词（需人工确认）`,
        file: songInfo.file
      });
      continue;
    }

    // 3b: 逐行匹配关键词
    const bestLine = songInfo.lyrics.reduce((best, l, i) => {
      const score = lyricWords.filter(w => l.includes(w)).length;
      return score > best.score ? { line: i, text: l, score } : best;
    }, { line: 0, text: '', score: 0 });

    if (bestLine.score >= Math.max(3, wordCount * 0.6)) {
      warnings.push({
        line: lineNum,
        song: entry.song,
        lyric: entry.lyric,
        issue: `⚠️  近似 (${bestLine.score}/${wordCount} 词匹配)`,
        officialLine: songInfo.lyrics[bestLine.line],
        file: songInfo.file
      });
      continue;
    }

    // 全部失败 → 报错
    errors.push({
      line: lineNum,
      song: entry.song,
      lyric: entry.lyric,
      issue: `❌ 歌词不匹配 "${entry.song}"`,
      officialLine: bestLine.text || '(无近似行)',
      file: songInfo.file
    });
  }

  // ====== 输出结果 ======
  console.log('='.repeat(60));
  console.log('📊 校验结果');
  console.log('='.repeat(60));
  const exact = checked - errors.length - warnings.length;
  console.log(`总条目: ${checked}`);
  console.log(`✅ 精确匹配: ${exact}`);
  console.log(`⚠️  近似匹配: ${warnings.length}`);
  console.log(`❌ 不匹配: ${errors.length}`);
  console.log('');

  if (warnings.length > 0) {
    console.log('⚠️⚠️⚠️ 近似匹配（可能需要检查）：');
    console.log('-'.repeat(60));
    for (const w of warnings) {
      console.log(`\n【第 ${w.line} 行】 "${w.lyric}"`);
      console.log(`  归属: ${w.song}`);
      console.log(`  问题: ${w.issue}`);
      if (w.officialLine) console.log(`  官方行: "${w.officialLine}"`);
    }
  }

  if (errors.length > 0) {
    console.log('\n❌❌❌ 不匹配（需要修复）：');
    console.log('-'.repeat(60));
    for (const e of errors) {
      console.log(`\n【第 ${e.line} 行】 "${e.lyric}"`);
      console.log(`  归属: ${e.song}`);
      console.log(`  问题: ${e.issue}`);
      if (e.officialLine) console.log(`  官方近似行: "${e.officialLine}"`);
    }
  }

  console.log('\n' + '='.repeat(60));
  return { errors, warnings, checked };
}

// ====================== 运行 ======================
try {
  console.log('🎵 Taylor Swift 歌词校验工具');
  console.log('='.repeat(60));

  // 检查歌词目录是否存在
  if (!fs.existsSync(LYRICS_DIR)) {
    console.error(`❌ 歌词目录不存在: ${LYRICS_DIR}`);
    console.log('请先解压歌词数据：unzip taylor-repo.zip "taylor-main/data-raw/lyrics/*/*" -d taylor_lyrics');
    process.exit(1);
  }

  const htmlContent = fs.readFileSync(HTML_FILE, 'utf-8');
  verify(htmlContent);
} catch (err) {
  console.error('❌ 错误:', err.message);
  process.exit(1);
}
