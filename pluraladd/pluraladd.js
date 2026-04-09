/* ═══════════════════════════════════════════════════════════
   pluraladd.js  —  AlmancaPratik Çoklu Kelime Ekleme
   ═══════════════════════════════════════════════════════════ */

import { auth, getWords, saveWord } from "../js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { fetchTranslate, normalizeGermanWord } from "../js/german.js";
import { renderTagChips, getSelectedTags, extractAllTags } from "../js/tag.js";
/* ─── STATE ─────────────────────────────────────────────── */
let currentUser   = null;
let existingWords = [];
let entries       = [];
let uidCounter    = 0;
let isTranslating = false;
let currentFilter = 'all';

/* ─── AUTH ──────────────────────────────────────────────── */
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    existingWords = await getWords(user.uid).catch(() => []);
    if (entries.length) reCheckDuplicates();
  }
});

/* ═══════════════════════════════════════════════════════════
   GLOBAL PATTERN ANALYZER
   ─────────────────────────────────────────────────────────
   Tüm satırları tarar → baskın ayracı istatistiksel olarak
   tespit eder → parse modunu belirler.
   ═══════════════════════════════════════════════════════════ */

const CANDIDATES = [
  { id: 'tab',  re: /\t/,              name: 'tab', label: 'Tab (tablo)' },
  { id: 'eq',   re: /={1,3}/,          name: '=',   label: 'Eşittir (=)' },
  { id: 'arr',  re: /(?:→|->|=>|⟶|➔|➜|⇒|⟹|➡)/, name: '→', label: 'Ok (→)' },
  { id: 'pipe', re: /\|/,              name: '|',   label: 'Pipe (|)' },
  { id: 'semi', re: /;/,               name: ';',   label: 'Noktalı virgül (;)' },
  { id: 'dco',  re: /::/,              name: '::',  label: 'Çift iki nokta (::)' },
  { id: 'dash', re: /\s[-–—]+\s/,      name: '–',   label: 'Tire ( - )' },
  { id: 'sl',   re: /\//,              name: '/',   label: 'Eğik çizgi (/)' },
  { id: 'co',   re: /:/,               name: ':',   label: 'İki nokta (:)' },
  { id: 'com',  re: /,/,               name: ',',   label: 'Virgül (,)' },
  { id: 'kw',   re: /\b(?:bedeutet|heißt|means|yani)\b/i, name: 'kw', label: 'Anahtar kelime' },
  { id: 'dsp',  re: / {2,}/,           name: '··',  label: 'Çift boşluk' },
];

/** Sayı prefix ve liste işaretlerini temizle */
function normLine(line) {
  return line
    .replace(/^\s*\d+[\t .):·\-]+/, '')
    .replace(/^[•\*◦▸▹›»·#☐☑✓✗✕]\s*/, '')
    .trim();
}

function countTabs(line) { return (line.match(/\t/g) || []).length; }

/** Tab sütun sayısını bul */
function dominantTabCols(lines) {
  const counts = {};
  lines.forEach(l => {
    const c = countTabs(l) + 1;
    counts[c] = (counts[c] || 0) + 1;
  });
  return parseInt(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
}

/**
 * ANA ANALİZ FONKSİYONU
 * rawLines: ham satır dizisi
 * → { mode, sep, name, label, tabCols, coverage, stats }
 */
export function analyzePattern(rawLines) {
  const lines = rawLines.map(l => l.replace(/\r/g, '')).filter(l => l.trim());
  if (!lines.length) return { mode: 'empty', sep: null, name: null, label: 'Boş', coverage: 0, stats: {} };

  const total = lines.length;

  /* 1. Tab tablo? */
  const tabLines = lines.filter(l => l.includes('\t'));
  const tabRatio = tabLines.length / total;
  if (tabRatio >= 0.6) {
    const colCount = dominantTabCols(tabLines);
    return {
      mode: 'tab-table', sep: 'tab', name: 'tab',
      label: `Tab · ${colCount} sütun`,
      tabCols: colCount, coverage: tabRatio,
      stats: { tab: { count: tabLines.length, ratio: tabRatio } },
    };
  }

  /* 2. Her aday için sayım */
  const stats = {};
  for (const cand of CANDIDATES) {
    if (cand.id === 'tab') continue;
    let count = 0;
    for (const line of lines) {
      const norm = normLine(line);
      if (norm && cand.re.test(norm)) count++;
    }
    stats[cand.id] = { count, ratio: count / total };
  }

  /* 3. Eşik %60 üzeri en yüksek → baskın ayraç */
  const best = CANDIDATES
    .filter(c => c.id !== 'tab')
    .map(c => ({ ...c, ...(stats[c.id] || { count: 0, ratio: 0 }) }))
    .sort((a, b) => b.count - a.count)[0];

  if (best && best.ratio >= 0.6) {
    return {
      mode: 'separator', sep: best.id, name: best.name,
      label: best.label, tabCols: null,
      coverage: best.ratio, stats,
    };
  }

  /* 4. Tek sütun (tüm satırlar düz kelime) */
  const noPairLines = lines.filter(l => {
    const n = normLine(l);
    return n && !CANDIDATES.some(c => c.re.test(n));
  });
  if (noPairLines.length / total >= 0.8) {
    return {
      mode: 'single-col', sep: null, name: '?',
      label: 'Tek sütun (sadece Almanca)',
      tabCols: null, coverage: noPairLines.length / total, stats,
    };
  }

  /* 5. Karışık */
  return {
    mode: 'mixed', sep: best?.id || null, name: best?.name || '?',
    label: `Karışık (baskın: ${best?.label || '?'})`,
    tabCols: null, coverage: best?.ratio || 0, stats,
  };
}

/* ═══════════════════════════════════════════════════════════
   GENEL TEMİZLEYİCİLER
   ═══════════════════════════════════════════════════════════ */


const ARTICLE_RE = /^(der|die|das|ein|eine)\s+/i;

/* ─── 1. ADIM: Markdown / Biçimlendirme Soy ─────────────── */
function stripFormatting(s) {
  if (!s) return '';

  // Bold+Italic: ***text*** veya ___text___
  s = s.replace(/\*{3}([^*]+?)\*{3}/g, '$1');
  s = s.replace(/_{3}([^_]+?)_{3}/g, '$1');

  // Bold: **text** veya __text__
  s = s.replace(/\*{2}([^*]+?)\*{2}/g, '$1');
  s = s.replace(/_{2}([^_]+?)_{2}/g, '$1');

  // Italic: *text* (ama ** değil)
  s = s.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '$1');

  // Italic: _text_ (kelime içi _ değil, sadece sınırlarda)
  s = s.replace(/(?<![a-zA-Z0-9äöüÄÖÜß])_([^_\n]+?)_(?![a-zA-Z0-9äöüÄÖÜß])/g, '$1');

  // Strikethrough: ~~text~~
  s = s.replace(/~~([^~]+?)~~/g, '$1');

  // Code: `text` veya ``text``
  s = s.replace(/``([^`]+?)``/g, '$1');
  s = s.replace(/`([^`]+?)`/g, '$1');

  // HTML etiketleri: <b>text</b> <strong>text</strong> <i>text</i> vb.
  s = s.replace(/<\/?(b|strong|i|em|u|s|del|ins|mark|span|code|tt)[^>]*>/gi, '');
  // Diğer HTML etiketleri de temizle
  s = s.replace(/<[^>]{0,80}>/g, '');

  // HTML entity'leri
  s = s.replace(/&amp;/g,  '&')
       .replace(/&lt;/g,   '<')
       .replace(/&gt;/g,   '>')
       .replace(/&quot;/g, '"')
       .replace(/&apos;/g, "'")
       .replace(/&nbsp;/g, ' ')
       .replace(/&#8203;/g, '')  // zero-width space
       .replace(/&#x?\d+;/g, '') // diğer entity'ler
       .replace(/&[a-z]{2,8};/g, ''); // named entity'ler

  return s;
}

/* ─── 2. ADIM: Liste İşaretleri / Numara Prefix ─────────── */
function stripMarker(line) {
  if (!line) return '';
  return line
    // Numaralı listeler: "1." "2)" "3:" "4·" "(5)" "[6]" vs.
    .replace(/^\s*\(?(\d{1,3}|[a-z])[.):\-·\]]+\s*/i, '')
    // Roma rakamları: "I." "II)" "III:" vs.
    .replace(/^\s*(?:x{0,3}(?:ix|iv|v?i{0,3}))[.):\-]+\s*/i, '')
    // Bullet karakterleri
    .replace(/^[•·▸▹▶►→⇒✓✗✕✘☐☑✔◦‣⁃∙⊹◉○●◆◇▪▫□■]\s*/u, '')
    // Tire/çizgi bullet: "- item" "– item" "— item"
    .replace(/^[-–—]\s+/, '')
    // Yıldız bullet: "* item" (ama **bold** değil)
    .replace(/^\*\s+(?!\*)/, '')
    // Artı/kare bullet: "+ item" "# item"
    .replace(/^[+#]\s+/, '')
    .trim();
}

/* ─── 3. ADIM: Dekoratif Emoji / Sembol Prefix/Suffix ───── */
function stripDecorative(s) {
  if (!s) return '';

  // Başlangıçtaki emoji blokları (Unicode emoji ranges)
  s = s.replace(/^(?:[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FEFF}\u{1FA00}-\u{1FAFF}]\s*)+/gu, '');

  // Sondaki emoji blokları
  s = s.replace(/(?:\s*[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FEFF}\u{1FA00}-\u{1FAFF}])+$/gu, '');

  // Dekoratif semboller başta: ★ ☆ ✦ ✧ ♦ ♠ ♣ ♥ ◆ ▲ ▼ ◉
  s = s.replace(/^[★☆✦✧♦♠♣♥♤♡♢♧◆◇▲△▼▽◉●◎⊕⊗✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❀❁❂❃❄❅❆❇❈❉❊❋\u25A0-\u25FF]\s*/u, '');

  // Dekoratif semboller sonda (noktalama hariç)
  s = s.replace(/\s*[★☆✦✧♦♠♣♥♤♡♢♧◆◇▲△▼▽◉●◎⊕⊗✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❀❁❂❃❄❅❆❇❈❉❊❋]$/u, '');

  return s;
}

/* ─── 4. ADIM: Tırnak İşaretleri Soy ───────────────────── */
function stripQuotes(s) {
  if (!s) return '';
  // Eşleşen tırnak çiftlerini kaldır (içeride bırak)
  const pairs = [
    ['"',  '"'],  // straight double
    ["'",  "'"],  // straight single
    ['\u201C', '\u201D'], // "curved double"
    ['\u2018', '\u2019'], // 'curved single'
    ['\u201E', '\u201C'], // „German low"
    ['\u00AB', '\u00BB'], // «guillemets»
    ['\u2039', '\u203A'], // ‹single guillemets›
    ['«',  '»'],
    ['„',  '"'],
    ['❝',  '❞'],
    ['❛',  '❜'],
    ['`',  '`'],
    ['´',  '´'],
  ];
  for (const [open, close] of pairs) {
    const oe = open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ce = close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${oe}(.+?)${ce}$`);
    const m = s.match(re);
    if (m && m[1].trim()) { s = m[1].trim(); break; }
  }
  // Simetrik tek/çift tırnak başta ve sonda
  s = s.replace(/^(['"´`])\1*(.+?)\1+$/, '$2');
  return s.trim();
}

/* ─── 5. ADIM: Notasyon / Açıklama Temizleme ────────────── */
function stripAnnotations(s) {
  if (!s) return '';

  // Köşeli parantez açıklamalar: [Pl.] [veraltet] [ugs.] [A2] [B1] vb.
  // Ama [der Hund] gibi Almanca olanları bırak (büyük harf + kısa)
  s = s.replace(/\s*\[(?!(?:der|die|das|ein|eine)\s)[^\]]{1,40}\]/gi, '');

  // Curly brace notlar: {formal} {ugs} {dated}
  s = s.replace(/\s*\{[^}]{1,60}\}/g, '');

  // Parantez içi dil etiketleri: (tr) (de) (en) (fr) (formal) (ugs.)
  s = s.replace(/\s*\((?:tr|de|en|fr|es|it|formal|ugs\.?|inf\.?|Pl\.?|Sg\.?|n\.?|m\.?|f\.?|nt\.?)\)/gi, '');

  // Seviye etiketleri: (A1) (B2) (C1)
  s = s.replace(/\s*\([ABC][12]\)/gi, '');

  // Alman dilbilgisi notları parantez içinde, ama kısa: (r) (e) (s) (der/die)
  // Bunları genellikle bırakalım çünkü belirsizlik var

  return s;
}

/* ─── 6. ADIM: Sondaki Noktalama Temizle ────────────────── */
function stripTrailingPunct(s) {
  if (!s) return '';
  // Nokta, virgül, noktalı virgül, iki nokta, ünlem, soru işareti — sonda
  // Ama "..." (üç nokta) gibi özellikli şeylere dikkat et
  s = s.replace(/[,;:!?。、]+$/, '');
  // Tekli nokta (kısaltma noktası değilse) — 2+ harf sonra nokta
  s = s.replace(/(?<=[a-zA-ZäöüÄÖÜß]{2,})\.$/, '');
  return s.trim();
}

/* ─── 7. ADIM: Whitespace Normalize ─────────────────────── */
function normalizeSpaces(s) {
  if (!s) return '';
  // Birden fazla boşluğu teke indir
  s = s.replace(/[ \t]+/g, ' ');
  // Sıfır genişlikli karakterleri kaldır
  s = s.replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '');
  // Satır sonu varsa boşluğa çevir
  s = s.replace(/[\r\n]+/g, ' ');
  return s.trim();
}

/* ─── 8. ADIM: Özel Durum Düzeltmeleri ──────────────────── */
function fixSpecialCases(s) {
  if (!s) return '';

  // "- " ile başlayan (tire+boşluk) liste artığı
  s = s.replace(/^[-–—]\s+/, '');

  // Parantez içindeyse çıkar: "(Haus)" → "Haus"
  const parenAll = s.match(/^\((.+)\)$/);
  if (parenAll && parenAll[1].trim()) s = parenAll[1].trim();

  // Köşeli parantez içindeyse çıkar: "[Haus]" → "Haus"
  const bracketAll = s.match(/^\[(.+)\]$/);
  if (bracketAll && bracketAll[1].trim()) s = bracketAll[1].trim();

  // Çift boşluk tekrar temizle (annotation temizliği sonrası)
  s = s.replace(/\s{2,}/g, ' ');

  return s.trim();
}

/* ═══════════════════════════════════════════════════════════
   ANA TEMİZLEYİCİ — Tüm adımları sırayla uygular
   ═══════════════════════════════════════════════════════════ */
function cleanPart(s) {
  if (!s) return '';
  s = String(s);

  s = normalizeSpaces(s);      // önce whitespace normalize
  s = stripFormatting(s);      // **bold** *italic* `code` HTML
  s = stripMarker(s);          // 1. 2) • - * # bullet'ları
  s = stripDecorative(s);      // emoji, ★, ♦ gibi dekoratifler
  s = stripAnnotations(s);     // [Pl.] {ugs.} (A1) notlar
  s = stripQuotes(s);          // "tırnak" 'temizleme'
  s = stripTrailingPunct(s);   // sondaki , ; : ! ?
  s = fixSpecialCases(s);      // (parantez) [köşeli] artıklar
  s = normalizeSpaces(s);      // son kez whitespace

  return s.trim();
}

/* ─── Yardımcılar (değişmedi) ────────────────────────────── */
/* ─── Dil Tespiti — KESİN karakterlere göre ─────────────── */

/** Sadece Türkçe'ye özgü harfler (Almanca'da YOKTUR) */
function hasTurkishSpecific(s) {
  return /[şğıçŞĞİÇ]/.test(s);
}

/** Sadece Almanca'ya özgü güçlü işaretler */
function hasGermanSpecific(s) {
  return /ß/.test(s) || ARTICLE_RE.test(s);
}

function looksLikeTurkish(s) {
  if (!s) return false;
  // SADECE Türkçe'ye özgü karakterler — ü/ö/ä yeterli değil!
  // auf, in, liegen gibi Almanca kelimeler de küçük harfle başlar
  return hasTurkishSpecific(s);
}

function looksLikeGerman(s) {
  if (!s) return false;
  if (/ß/.test(s)) return true;                          // ß = %100 Almanca
  if (ARTICLE_RE.test(s)) return true;                   // der/die/das ile başlıyor
  if (/^[A-ZÜÖÄ]/.test(s) && !hasTurkishSpecific(s)) return true; // büyük harf + Türkçe yok
  return false;
}

function maybeSwap(de, tr) {
  if (!de || !tr) return { de, tr };
  // Sadece SOL tarafta KESİN Türkçe karakter varsa VE
  // sağ taraf Almanca görünüyorsa yer değiştir
  if (hasTurkishSpecific(de) && (hasGermanSpecific(tr) || /^[A-ZÜÖÄ]/.test(tr))) {
    return { de: tr, tr: de };
  }
  return { de, tr };
}

/* ═══════════════════════════════════════════════════════════
   TAB TABLO PARSER
   ═══════════════════════════════════════════════════════════ */
function parseTabTable(lines, colCount) {
  const results = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split('\t').map(c => c.trim());
    let de, tr;

    if (colCount >= 3) {
      /* İlk sütun rakam ya da boşsa sıra numarasıdır */
      const firstIsNum = /^\d*$/.test(cols[0]);
      de = cleanPart(cols[firstIsNum ? 1 : 0] || '');
      tr = cleanPart(cols[firstIsNum ? 2 : 1] || '');
    } else {
      de = cleanPart(cols[0] || '');
      tr = cleanPart(cols[1] || '');
    }

    if (!de) continue;
    const r = maybeSwap(de, tr);
    results.push(makeEntry(r.de, r.tr, 'tab'));
  }
  return results;
}

/* ═══════════════════════════════════════════════════════════
   BASKIL AYRAÇ İLE TOPLU PARSE
   ═══════════════════════════════════════════════════════════ */
function sepIdToRe(id) {
  const map = {
    eq:   /\s*={1,3}\s*/,
    arr:  /\s*(?:→|->|=>|⟶|➔|➜|⇒|⟹|➡)\s*/,
    pipe: /\s*\|\s*/,
    semi: /\s*;\s*/,
    dco:  /\s*::\s*/,
    dash: /\s+[-–—]+\s+/,
    sl:   /\s*\/\s*/,
    co:   /\s*:\s*/,
    com:  /\s*,\s*/,
    kw:   /\s+(?:bedeutet|heißt|means|yani|d\.h\.|i\.e\.)\s+/i,
    dsp:  /[ \t]{2,}/,
  };
  return map[id] || null;
}

function splitBySep(line, sepRe) {
  const stripped = stripMarker(line);
  if (!stripped) return null;
  const m = stripped.match(sepRe);
  if (!m || m.index === 0) return null;
  const de = cleanPart(stripped.slice(0, m.index));
  const tr = cleanPart(stripped.slice(m.index + m[0].length));
  if (!de) return null;
  return { de, tr };
}

function parseWithSep(lines, sepId, sepName) {
  const sepRe = sepIdToRe(sepId);
  if (!sepRe) return [];
  const results = [];
  for (const line of lines) {
    if (!line.trim()) continue;

    /* Noktalı virgülle ayrılmış çoklu çift */
    const multi = trySemiMulti(line, sepRe, sepName);
    if (multi) { multi.forEach(e => results.push(e)); continue; }

    const parsed = splitBySep(line, sepRe);
    if (!parsed) {
      const norm = cleanPart(stripMarker(line));
      if (norm) results.push(makeEntry(norm, '', '?'));
      continue;
    }
    const r = maybeSwap(parsed.de, parsed.tr);
    results.push(makeEntry(r.de, r.tr, sepName));
  }
  return results;
}

/** "A=b; C=d" → iki entry */
function trySemiMulti(line, sepRe, sepName) {
  if (!line.includes(';')) return null;
  const parts = line.split(';').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const parsed = parts.map(p => splitBySep(p, sepRe)).filter(Boolean);
  if (parsed.length !== parts.length || !parsed.every(p => p.tr)) return null;
  return parsed.map(p => { const r = maybeSwap(p.de, p.tr); return makeEntry(r.de, r.tr, sepName); });
}

/* ═══════════════════════════════════════════════════════════
   KARIŞIK MOD — Satır-satır, her satırın ayracını bul
   ═══════════════════════════════════════════════════════════ */
const SEPS_ORDERED = [
  { re: /\s*={1,3}\s*/,                 name: '='   },
  { re: /\s*(?:→|->|=>|⟶|➔|➜|⇒|⟹|➡)\s*/, name: '→' },
  { re: /\s*[≈~≃≡]\s*/,                name: '≈'   },
  { re: /\s*\|\s*/,                     name: '|'   },
  { re: /\t+/,                          name: 'tab' },
  { re: /\s*;\s*/,                      name: ';'   },
  { re: /\s*::\s*/,                     name: '::'  },
  { re: /\s+[-–—]+\s+/,                 name: '–'   },
  { re: /\s+(?:bedeutet|heißt|means|yani|d\.h\.|i\.e\.)\s+/i, name: 'kw' },
  { re: /\s*:\s*/,                      name: ':'   },
];



function tryQuoted(line) {
  const b = line.match(/^(["'„\u201c\u201d❝`])(.+?)\1\s*[=:→\-|]?\s*(["'„\u201c\u201d❝`])(.+?)\3\s*$/);
  if (b) { const de = b[2].trim(), tr = b[4].trim(); if (de && tr) return { de, tr }; }
  const r = line.match(/^(.+?)\s*[=:→\-|]\s*(["'„\u201c\u201d❝`])(.+?)\2\s*$/);
  if (r) { const de = r[1].trim(), tr = r[3].trim(); if (de && tr) return { de, tr }; }
  const l = line.match(/^(["'„\u201c\u201d❝`])(.+?)\1\s*[=:→\-|]\s*(.+)$/);
  if (l) { const de = l[2].trim(), tr = l[3].trim(); if (de && tr) return { de, tr }; }
  return null;
}

function tryBracket(line) {
  const ep = line.match(/^(.+?)\s*[(\[<«]\s*(.+?)\s*[)\]>»]\s*$/);
  if (ep) {
    const de = ep[1].trim(), tr = ep[2].trim();
    if (de && tr && (looksLikeTurkish(tr) || (!looksLikeGerman(tr) && tr.length < 30)))
      return { de, tr, method: '<>' };
  }
  const sp = line.match(/^[(\[<«]\s*(.+?)\s*[)\]>»]\s+(.+)$/);
  if (sp) { const de = sp[1].trim(), tr = sp[2].trim(); if (de && tr) return { de, tr, method: '<>' }; }
  return null;
}

function trySlash(line) {
  if (/\b(?:der|die|das)\s*\/\s*(?:der|die|das)\b/i.test(line)) return null;
  if ((line.match(/\//g) || []).length !== 1) return null;
  const m = line.match(/^([^\/]+)\s*\/\s*([^\/]+)$/);
  if (!m) return null;
  const de = m[1].trim(), tr = m[2].trim();
  if (!de || !tr || de.split(/\s+/).length > 5 || tr.split(/\s+/).length > 5) return null;
  return { de, tr };
}

function tryDblSpace(line) {
  const m = line.match(/^(\S+(?:\s\S+)*?)\s{2,}(\S+(?:\s\S+)*)$/);
  return m ? { de: m[1].trim(), tr: m[2].trim() } : null;
}

function parseSingleLine(line) {
  if (!line.trim()) return null;

 

  const q = tryQuoted(line);
  if (q) { const r = maybeSwap(cleanPart(q.de), cleanPart(q.tr)); return { de: r.de, tr: r.tr, method: '""' }; }

  for (const sep of SEPS_ORDERED) {
    const m = line.match(sep.re);
    if (!m || m.index === 0) continue;
    if (sep.name === ':' && /^\d{1,2}:\d{2}/.test(line)) continue;
    if (sep.name === ':' && line.includes('://')) continue;
    const de = cleanPart(line.slice(0, m.index));
    const tr = cleanPart(line.slice(m.index + m[0].length));
    if (!de) continue;
    const r = maybeSwap(de, tr);
    return { de: r.de, tr: r.tr, method: sep.name };
  }

  const br = tryBracket(line);
  if (br) { const r = maybeSwap(cleanPart(br.de), cleanPart(br.tr)); return { de: r.de, tr: r.tr, method: br.method }; }

  const sl = trySlash(line);
  if (sl) { const r = maybeSwap(cleanPart(sl.de), cleanPart(sl.tr)); return { de: r.de, tr: r.tr, method: '/' }; }

  const ci = line.indexOf(',');
  if (ci > 0) {
    const de = cleanPart(line.slice(0, ci)), tr = cleanPart(line.slice(ci + 1));
    if (de && tr && looksLikeTurkish(tr)) { const r = maybeSwap(de, tr); return { de: r.de, tr: r.tr, method: ',' }; }
  }

  const ds = tryDblSpace(line);
  if (ds) { const r = maybeSwap(cleanPart(ds.de), cleanPart(ds.tr)); return { de: r.de, tr: r.tr, method: '··' }; }

  const cleaned = cleanPart(line);
  if (cleaned) return { de: cleaned, tr: '', method: '?' };
  return null;
}

function parseLine(raw) {
  return parseSingleLine(stripMarker(raw.trim()));
}

/* ═══════════════════════════════════════════════════════════
   İKİ BLOK MODU
   ═══════════════════════════════════════════════════════════ */
function tryTwoBlockMode(raw) {
  const dividerRe = /^[-=_*~#]{3,}\s*$/m;
  if (dividerRe.test(raw)) {
    const parts = raw.split(dividerRe);
    const deLines = parts[0].trim().split(/\r?\n/).map(l => cleanPart(stripMarker(l))).filter(Boolean);
    const trLines = parts.slice(1).join('\n').trim().split(/\r?\n/).map(l => cleanPart(stripMarker(l))).filter(Boolean);
    if (deLines.length > 0 && deLines.length === trLines.length)
      return deLines.map((de, i) => makeEntry(de, trLines[i], 'blok'));
  }

  if (/\n{3,}/.test(raw)) {
    const blocks = raw.split(/\n{3,}/).map(b => b.trim()).filter(Boolean);
    if (blocks.length === 2) {
      const deLines = blocks[0].split(/\r?\n/).map(l => cleanPart(stripMarker(l))).filter(Boolean);
      const trLines = blocks[1].split(/\r?\n/).map(l => cleanPart(stripMarker(l))).filter(Boolean);
      if (deLines.length > 0 && deLines.length === trLines.length)
        return deLines.map((de, i) => makeEntry(de, trLines[i], 'blok'));
    }
  }

  const allLines = raw.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (allLines.length >= 4 && allLines.length % 2 === 0) {
    const half    = allLines.length / 2;
    const topHalf = allLines.slice(0, half);
    const botHalf = allLines.slice(half);
    const topGerman  = topHalf.every(l => !parseLine(l)?.tr && /^[A-ZÜÖÄ]/.test(stripMarker(l)));
    const botTurkish = botHalf.every(l => looksLikeTurkish(stripMarker(l)));
    if (topGerman && botTurkish)
      return topHalf.map((de, i) => makeEntry(cleanPart(stripMarker(de)), cleanPart(stripMarker(botHalf[i])), 'blok'));
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════
   ANA GİRDİ PARSE FONKSİYONU
   ═══════════════════════════════════════════════════════════ */

export let lastAnalysis = null;

export function parseInput(raw) {
  if (!raw.trim()) return [];

  /* İki-blok önce dene */
  const twoBlock = tryTwoBlockMode(raw);
  if (twoBlock) return twoBlock;

  const rawLines = raw.split(/\r?\n/);
  const analysis = analyzePattern(rawLines);
  lastAnalysis   = analysis;

  /* Tab tablo */
  if (analysis.mode === 'tab-table') {
    return parseTabTable(rawLines.filter(l => l.trim()), analysis.tabCols);
  }

  /* Baskın ayraç */
  if (analysis.mode === 'separator' && analysis.sep) {
    return parseWithSep(rawLines.filter(l => l.trim()), analysis.sep, analysis.name);
  }

  /* Fallback: satır-satır karışık */
  const results = [];
  for (const line of rawLines) {
    if (!line.trim()) continue;
    /* Noktalı virgüllü çoklu çift */
    if (line.includes(';') && /[=→\-:|]/.test(line)) {
      const parts  = line.split(';').map(p => p.trim()).filter(Boolean);
      const parsed = parts.map(p => parseLine(p)).filter(Boolean);
      if (parsed.length > 1 && parsed.every(p => p.tr)) {
        parsed.forEach(p => results.push(makeEntry(p.de, p.tr, p.method)));
        continue;
      }
    }
    const p = parseLine(line);
    if (p) results.push(makeEntry(p.de, p.tr, p.method));
  }
  return results;
}

/* ─── Entry fabrikası ────────────────────────────────────── */
function makeEntry(de, tr, method) {
  return { id: uidCounter++, de: (de||'').trim(), tr: (tr||'').trim(), method, selected: true, status: 'new', translating: false };
}

/* ─── Duplicate check ────────────────────────────────────── */
function reCheckDuplicates() {
  entries = entries.map(e => ({
    ...e,
    status: e.status === 'saved' ? 'saved' : isDuplicate(e.de) ? 'duplicate' : 'new',
  }));
  renderTable();
  updateBar();
}

function isDuplicate(de) {
  if (!de) return false;
  return existingWords.some(w => (w.word||'').toLowerCase().trim() === de.toLowerCase().trim());
}

/* ═══════════════════════════════════════════════════════════
   OTO-ÇEVİRİ
   ═══════════════════════════════════════════════════════════ */
async function autoTranslateMissing() {
  if (isTranslating) return;
  const missing = entries.filter(e => e.selected && !e.tr && e.status !== 'saved');
  if (!missing.length) { showToast("Eksik çeviri yok!", "ok"); return; }

  isTranslating = true;
  const btn = document.getElementById("btnAutoTranslate");
  if (btn) { btn.disabled = true; btn.textContent = "Çevriliyor…"; }

  const progWrap = document.getElementById("translateProgress");
  const progBar  = document.getElementById("translateBar");
  const progText = document.getElementById("translateText");
  if (progWrap) progWrap.style.display = "flex";

  let done = 0;
  for (const entry of missing) {
    const live = entries.find(e => e.id === entry.id);
    if (!live || !live.selected) { done++; continue; }
    live.translating = true;
    updateRowTranslating(live.id, true);
    try {
      const { main } = await fetchTranslate(live.de);
      live.tr = main || '';
      live.translating = false;
      updateRowTranslating(live.id, false, main);
    } catch {
      live.translating = false;
      updateRowTranslating(live.id, false);
    }
    done++;
    if (progBar)  progBar.style.width = Math.round((done / missing.length) * 100) + '%';
    if (progText) progText.textContent = `${done} / ${missing.length}`;
    await sleep(220);
  }

  isTranslating = false;
  if (btn) { btn.disabled = false; btn.textContent = "Eksikleri Otomatik Çevir"; }
  if (progWrap) setTimeout(() => { progWrap.style.display = "none"; }, 1200);
  updateBar();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function updateRowTranslating(id, loading, value) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (!row) return;
  const inp = row.querySelector('.tr-input');
  if (!inp) return;
  if (loading) { inp.placeholder = "çevriliyor…"; inp.disabled = true; row.classList.add('row--translating'); }
  else { inp.disabled = false; inp.placeholder = "Türkçe anlam…"; row.classList.remove('row--translating'); if (value !== undefined) inp.value = value; }
}

/* ═══════════════════════════════════════════════════════════
   KAYDET
   ═══════════════════════════════════════════════════════════ */
async function saveSelected() {
  if (!currentUser) { showToast("Lütfen giriş yapın!", "err"); return; }
  const toSave = entries.filter(e => e.selected && e.de && e.tr && e.status !== 'saved');
  if (!toSave.length) { showToast("Kaydedilecek kelime yok!", "err"); return; }

  const tags = getSelectedTags('bulkTagChips');
  const btn  = document.getElementById("btnSave");
  if (btn) { btn.disabled = true; btn.textContent = "Kaydediliyor…"; }

  let saved = 0, skipped = 0, errors = 0;

  const results = await Promise.allSettled(
    toSave.map(async entry => {
      const normalizedDe = normalizeGermanWord(entry.de, null);
      const meanings = entry.tr.split(',').map(m => m.trim()).filter(Boolean);
      const primaryMeaning = meanings[0] || entry.tr.trim();
      const dup = existingWords.find(w =>
        (w.word||'').toLowerCase().trim() === normalizedDe.toLowerCase().trim() &&
        (w.meaning||'').toLowerCase().trim() === primaryMeaning.toLowerCase().trim()
      );
      if (dup) { entry.status = 'duplicate'; return { type: 'skip', entry }; }
      await saveWord(currentUser.uid, normalizedDe, primaryMeaning, tags, meanings);
      entry.status = 'saved';
      existingWords.push({ word: normalizedDe, meaning: primaryMeaning });
      return { type: 'ok', entry, normalizedDe };
    })
  );

  results.forEach(r => {
    if (r.status === 'fulfilled') {
      const { type, entry } = r.value;
      if (type === 'ok')   { updateRowStatus(entry.id, 'saved');     saved++;   }
      if (type === 'skip') { updateRowStatus(entry.id, 'duplicate'); skipped++; }
    } else {
      const entry = toSave[results.indexOf(r)];
      if (entry) { entry.status = 'error'; updateRowStatus(entry.id, 'error'); errors++; }
    }
  });

  if (btn) { btn.disabled = false; btn.textContent = `Seçilileri Kaydet (${getSelectCount()})`; }
  showSummary(saved, skipped, errors);
  updateBar();
}

function updateRowStatus(id, status) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (!row) return;
  row.dataset.status = status;
  const badge = row.querySelector('.status-badge');
  if (badge) { badge.className = `status-badge status-badge--${status}`; badge.textContent = STATUS_LABELS[status]||status; }
}

const STATUS_LABELS = { new: 'Yeni', duplicate: 'Mevcut', saved: 'Kaydedildi', error: 'Hata' };
const METHOD_LABELS = {
  '=':'=','→':'→','≈':'≈','–':'–',':':':','::':'::',';':';','|':'|',',':',','/':'/',
  '··':'··','()':'()','<>':'<>','""':'""','tab':'⇥','kw':'kw','Q/A':'Q/A','?':'?','blok':'☰',
};

/* ═══════════════════════════════════════════════════════════
   RENDER
   ═══════════════════════════════════════════════════════════ */
function renderTable() {
  const tbody = document.getElementById("entryTbody");
  if (!tbody) return;
  tbody.innerHTML = '';

  entries.forEach(e => {
    const tr = document.createElement('tr');
    tr.dataset.id = e.id; tr.dataset.status = e.status;
    tr.className = e.selected ? '' : 'row--deselected';
    tr.innerHTML = `
      <td class="td-check"><label class="cb-wrap"><input type="checkbox" class="row-check" ${e.selected?'checked':''}><span class="cb-box"></span></label></td>
      <td class="td-de"><input class="cell-input de-input" value="${escHtml(e.de)}" placeholder="Almanca kelime…" spellcheck="false"></td>
      <td class="td-arrow"><span class="method-badge">${METHOD_LABELS[e.method]||e.method}</span></td>
      <td class="td-tr"><input class="cell-input tr-input" value="${escHtml(e.tr)}" placeholder="anlam1, anlam2, …" spellcheck="false"></td>
      <td class="td-status"><span class="status-badge status-badge--${e.status}">${STATUS_LABELS[e.status]}</span></td>
      <td class="td-del"><button class="del-btn" title="Sil">✕</button></td>
    `;

    tr.querySelector('.row-check').addEventListener('change', ev => {
      const entry = entries.find(x => x.id === e.id);
      if (entry) entry.selected = ev.target.checked;
      tr.classList.toggle('row--deselected', !ev.target.checked);
      updateBar();
    });
    tr.querySelector('.de-input').addEventListener('input', ev => {
      const entry = entries.find(x => x.id === e.id);
      if (entry) { entry.de = ev.target.value; entry.status = isDuplicate(entry.de) ? 'duplicate' : 'new'; updateRowStatus(e.id, entry.status); }
      updateBar();
    });
    tr.querySelector('.tr-input').addEventListener('input', ev => {
      const entry = entries.find(x => x.id === e.id);
      if (entry) entry.tr = ev.target.value;
      updateBar();
    });
    tr.querySelector('.del-btn').addEventListener('click', () => {
      entries = entries.filter(x => x.id !== e.id); tr.remove(); updateBar();
    });
    tbody.appendChild(tr);
  });
  updateBar();
}

function updateBar() {
  setText('barTotal',   entries.length);
  setText('barSel',     entries.filter(e => e.selected).length);
  setText('barMissing', entries.filter(e => e.selected && !e.tr).length);
  setText('barDup',     entries.filter(e => e.status === 'duplicate').length);
  setText('barSaved',   entries.filter(e => e.status === 'saved').length);

  const saveBtn = document.getElementById("btnSave");
  if (saveBtn) saveBtn.textContent = `Seçilileri Kaydet (${getSelectCount()})`;

  const missingTr = entries.filter(e => e.selected && !e.tr).length;
  const transBtn  = document.getElementById("btnAutoTranslate");
  if (transBtn) transBtn.textContent = `Eksikleri Otomatik Çevir${missingTr ? ` (${missingTr})` : ''}`;
  // Filtre sayaçlarını güncelle
  const fCounts = {
    all:       entries.length,
    new:       entries.filter(e => e.status === 'new').length,
    missing:   entries.filter(e => !e.tr).length,
    duplicate: entries.filter(e => e.status === 'duplicate').length,
  };
  for (const [key, val] of Object.entries(fCounts)) {
    const el = document.getElementById(`fCount-${key}`);
    if (el) el.textContent = val;
  }
  applyFilter();
}
function applyFilter() {
  const rows = document.querySelectorAll('#entryTbody tr[data-id]');
  rows.forEach(row => {
    const id     = parseInt(row.dataset.id);
    const entry  = entries.find(e => e.id === id);
    if (!entry) return;
    let show = false;
    if (currentFilter === 'all')       show = true;
    if (currentFilter === 'new')       show = entry.status === 'new';
    if (currentFilter === 'missing')   show = !entry.tr;
    if (currentFilter === 'duplicate') show = entry.status === 'duplicate';
    row.style.display = show ? '' : 'none';
  });
}
function getSelectCount() {
  return entries.filter(e => e.selected && e.de && e.tr && e.status !== 'saved').length;
}

function showSummary(saved, skipped, errors) {
  const el = document.getElementById("saveSummary");
  if (!el) return;
  let html = `<span class="sum-item sum-ok">✓ ${saved} kelime kaydedildi</span>`;
  if (skipped) html += `<span class="sum-item sum-warn">⚠ ${skipped} zaten mevcuttu</span>`;
  if (errors)  html += `<span class="sum-item sum-err">✕ ${errors} hata</span>`;
  el.innerHTML = html; el.style.display = 'flex';
  setTimeout(() => el.classList.add('sum--visible'), 10);
}

function showPhase(n) {
  document.querySelectorAll('.phase').forEach((el, i) => el.classList.toggle('phase--active', i + 1 === n));
}

/* ═══════════════════════════════════════════════════════════
   PREVIEW MODAL
   ═══════════════════════════════════════════════════════════ */
const MODE_ICONS  = { 'tab-table':'📊', 'separator':'✂️', 'single-col':'📝', 'mixed':'🔀', 'empty':'❌' };
const MODE_COLORS = {
  'tab-table':  { bg:'rgba(96,200,240,.12)',  fg:'#60c8f0', border:'rgba(96,200,240,.25)' },
  'separator':  { bg:'rgba(79,214,156,.10)',  fg:'#4fd69c', border:'rgba(79,214,156,.22)' },
  'single-col': { bg:'rgba(255,210,80,.10)',  fg:'#ffd250', border:'rgba(255,210,80,.22)' },
  'mixed':      { bg:'rgba(201,168,76,.10)',  fg:'#c9a84c', border:'rgba(201,168,76,.22)' },
};

function buildAnalysisBadge(analysis) {
  if (!analysis || analysis.mode === 'empty') return '';
  const c   = MODE_COLORS[analysis.mode] || MODE_COLORS['mixed'];
  const pct = Math.round((analysis.coverage || 0) * 100);
  return `
    <div class="pv-analysis">
      <span class="pv-analysis-pill" style="background:${c.bg};color:${c.fg};border:1px solid ${c.border}">
        ${MODE_ICONS[analysis.mode]||'🔍'} <strong>${escHtml(analysis.label)}</strong>
      </span>
      ${pct > 0 ? `<span class="pv-analysis-cov" style="color:${c.fg}">%${pct} uyum</span>` : ''}
    </div>`;
}

function openPreviewModal(parsed) {
  const modal = document.getElementById('previewModal');
  const body  = document.getElementById('previewBody');
  if (!modal || !body) return;
  body.innerHTML = '';

  body.insertAdjacentHTML('beforeend', buildAnalysisBadge(lastAnalysis));

  parsed.forEach(e => {
    const isDup = isDuplicate(e.de);
    const noTr  = !e.tr;
    const row   = document.createElement('div');
    row.className = 'pv-row';

    let sc, sl;
    if (isDup)     { sc = 'pv-status--dup';  sl = 'Mevcut';    }
    else if (noTr) { sc = 'pv-status--miss'; sl = 'Çevirisiz'; }
    else           { sc = 'pv-status--new';  sl = 'Yeni';      }

    row.innerHTML = `
      <span class="pv-de">${escHtml(e.de)}</span>
      <span class="pv-sep">→</span>
      <span class="pv-tr${noTr?' pv-tr--empty':''}">${noTr?'çeviri yok':escHtml(e.tr)}</span>
      <span class="pv-status ${sc}">${sl}</span>`;
    body.appendChild(row);
  });

  const total = parsed.length;
  const dups  = parsed.filter(e => isDuplicate(e.de)).length;
  const miss  = parsed.filter(e => !e.tr).length;
  const yeni  = total - dups;

  const sum = document.createElement('div');
  sum.className = 'pv-summary';
  sum.innerHTML = `
    <span class="pv-sum-chip" style="background:rgba(79,214,156,.1);color:#4fd69c;border:1px solid rgba(79,214,156,.2)">${yeni} yeni</span>
    ${dups?`<span class="pv-sum-chip" style="background:rgba(96,200,240,.1);color:#60c8f0;border:1px solid rgba(96,200,240,.2)">${dups} mevcut</span>`:''}
    ${miss?`<span class="pv-sum-chip" style="background:rgba(255,210,80,.1);color:#ffd250;border:1px solid rgba(255,210,80,.2)">${miss} çevirisiz</span>`:''}`;
  body.appendChild(sum);

  modal.classList.add('open');
  document.getElementById('previewConfirm').onclick = () => {
    closePreviewModal(); entries = parsed; reCheckDuplicates(); renderTable(); showPhase(2);
    renderTagChips('bulkTagChips', [], extractAllTags(existingWords));
  };
}

function closePreviewModal() {
  document.getElementById('previewModal')?.classList.remove('open');
}

/* ═══════════════════════════════════════════════════════════
   ANA KONTROL
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  const textarea  = document.getElementById('inputArea');
  const parseBtn  = document.getElementById('btnParse');
  const charCount = document.getElementById('inputCharCount');
  const lineCount = document.getElementById('inputLineCount');
  const detBadge  = document.getElementById('detectedFormat');
  // Filtre butonları
  document.getElementById('filterRow')?.addEventListener('click', e => {
    const btn = e.target.closest('.wa-filter-btn');
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    document.querySelectorAll('.wa-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
    applyFilter();
  });

  document.getElementById('previewClose')?.addEventListener('click', closePreviewModal);
  document.getElementById('previewCancel')?.addEventListener('click', closePreviewModal);
  document.getElementById('previewBackdrop')?.addEventListener('click', closePreviewModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePreviewModal(); });

  /* Canlı format tespiti — 400ms debounce */
  let liveTimer = null;
  textarea?.addEventListener('input', () => {
    const val   = textarea.value;
    const lines = val.split('\n').filter(l => l.trim()).length;
    if (charCount) charCount.textContent = val.length;
    if (lineCount) lineCount.textContent = lines + ' satır';

    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => {
      if (!val.trim() || !detBadge) return;
      const an = analyzePattern(val.split('\n'));
      const c  = MODE_COLORS[an.mode] || MODE_COLORS['mixed'];
      const pct = Math.round((an.coverage||0)*100);
      detBadge.textContent = `${MODE_ICONS[an.mode]||'🔍'} ${an.label}${pct>0?' · %'+pct+' uyum':''}`;
      detBadge.style.color        = c.fg;
      detBadge.style.background   = c.bg;
      detBadge.style.borderColor  = c.border;
      detBadge.style.display      = 'inline-flex';
    }, 400);
  });

  parseBtn?.addEventListener('click', () => {
    const raw = textarea?.value || '';
    if (!raw.trim()) { showToast("Liste boş!", "err"); return; }
    const parsed = parseInput(raw);
    if (!parsed.length) { showToast("Kelime bulunamadı!", "err"); return; }
    openPreviewModal(parsed);

    document.getElementById("btnSelectAll")?.addEventListener('click', () => {
      entries.forEach(e => e.selected = true);
      document.querySelectorAll('.row-check').forEach(cb => cb.checked = true);
      document.querySelectorAll('tr[data-id]').forEach(r => r.classList.remove('row--deselected'));
      updateBar();
    });
    document.getElementById("btnSelectNone")?.addEventListener('click', () => {
      entries.forEach(e => e.selected = false);
      document.querySelectorAll('.row-check').forEach(cb => cb.checked = false);
      document.querySelectorAll('tr[data-id]').forEach(r => r.classList.add('row--deselected'));
      updateBar();
    });
    document.getElementById("btnSelectNew")?.addEventListener('click', () => {
      entries.forEach(e => { e.selected = e.status !== 'duplicate'; });
      document.querySelectorAll('tr[data-id]').forEach(row => {
        const id = parseInt(row.dataset.id);
        const e  = entries.find(x => x.id === id);
        const cb = row.querySelector('.row-check');
        if (cb) cb.checked = e?.selected || false;
        row.classList.toggle('row--deselected', !e?.selected);
      });
      updateBar();
    });
  });

  document.getElementById("btnAutoTranslate")?.addEventListener('click', autoTranslateMissing);
  document.getElementById("btnSave")?.addEventListener('click', saveSelected);
  document.getElementById("btnBackToInput")?.addEventListener('click', () => {
    entries = []; uidCounter = 0; showPhase(1);
    const sum = document.getElementById("saveSummary");
    if (sum) { sum.style.display = 'none'; sum.classList.remove('sum--visible'); }
  });
  document.getElementById("goSingleAdd")?.addEventListener('click', () => {
    window.location.href = '../singleadd/';
  });
});

/* ─── Yardımcılar ────────────────────────────────────────── */
function escHtml(s) {
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function showToast(msg, type = '') {
  let toast = document.getElementById('_toast');
  if (!toast) { toast = document.createElement('div'); toast.id='_toast'; toast.className='wa-toast'; document.body.appendChild(toast); }
  toast.textContent = msg;
  toast.className   = `wa-toast wa-toast--show${type?' wa-toast--'+type:''}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('wa-toast--show'), 2800);
}