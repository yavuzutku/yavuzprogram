// ================================
// WIKTIONARY PARSER PRO v3 - FULL FIX
// ================================

// Safe capitalize (TR i problemi yok)
function safeCapitalize(w) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// Cache limitli
const _wikiCache = new Map();
const MAX_CACHE = 500;
function setCache(key, value) {
  if (_wikiCache.size > MAX_CACHE) {
    const firstKey = _wikiCache.keys().next().value;
    _wikiCache.delete(firstKey);
  }
  _wikiCache.set(key, value);
}

// Artikel renkleri
export const ARTIKEL_COLORS = {
  der: { text: "#60c8f0", bg: "rgba(96,200,240,0.12)",  border: "rgba(96,200,240,0.25)" },
  die: { text: "#f07068", bg: "rgba(240,112,104,0.10)", border: "rgba(240,112,104,0.25)" },
  das: { text: "#a064ff", bg: "rgba(160,100,255,0.10)", border: "rgba(160,100,255,0.25)" },
};

// TYPE_MAP genişletilmiş
export const TYPE_MAP = {
  "Substantiv": { label: "İsim", tag: "isim" },
  "Verb": { label: "Fiil", tag: "fiil" },
  "Hilfsverb": { label: "Yardımcı Fiil", tag: "fiil" },
  "Modalverb": { label: "Modal Fiil", tag: "fiil" },
  "Adjektiv": { label: "Sıfat", tag: "sıfat" },
  "Adverb": { label: "Zarf", tag: "zarf" },
  "Konjugierte Form": { label: "Çekimli Form", tag: "fiil" },
  "Deklinierte Form": { label: "Çekimlenmiş Form", tag: null },
  "Partizip II": { label: "Partizip II", tag: "fiil" },
  "Präposition": { label: "Edat", tag: null },
  "Konjunktion": { label: "Bağlaç", tag: null },
  "Pronomen": { label: "Zamir", tag: null },
  "Interjektion": { label: "Ünlem", tag: null },
  "Artikel": { label: "Artikel", tag: null },
  "Numerale": { label: "Sayı", tag: null },
  "Partikel": { label: "Partikül", tag: null },
};

// ================================
// FETCH
// ================================
export async function fetchWikiData(word) {
  const key = word.trim().toLowerCase();
  if (_wikiCache.has(key)) return _wikiCache.get(key);

  const empty = { artikel:"", wordType:"", plural:"", genitive:"", baseForm:"", autoTags:[] };

  const variants = [ word.trim(), word.trim().toLowerCase(), safeCapitalize(word) ];
  const seen = new Set();

  for (const variant of variants) {
    if (seen.has(variant)) continue;
    seen.add(variant);

    try {
      const params = new URLSearchParams({
        action: "parse", page: variant, prop: "wikitext", format: "json", origin: "*"
      });
      const res = await fetch("https://de.wiktionary.org/w/api.php?" + params);
      const data = await res.json();
      if (data.error) continue;

      const wt = data?.parse?.wikitext?.["*"] || "";
      if (!wt) continue;

      const parsed = parseWikitext(wt, word);
      setCache(key, parsed);
      return parsed;

    } catch (err) {
      console.warn("Wiki fetch error:", variant, err);
    }
  }

  setCache(key, empty);
  return empty;
}

// ================================
// CORE PARSER
// ================================
function parseWikitext(wt, originalWord) {
  const result = { artikel:"", wordType:"", plural:"", genitive:"", baseForm:"", autoTags:[] };

  // 1️⃣ Grundformverweis (önce)
  const gf = findGrundform(wt);
  if (gf && gf.toLowerCase() !== originalWord.toLowerCase()) {
    result.baseForm = gf;
    result.wordType = "Çekimli Form";
    result.autoTags.push("fiil","lemma");
    return result;
  }

  // 2️⃣ Wortart
  const typeMatch = wt.match(/\{\{Wortart\|([^|}\n]+)/);
  if (!typeMatch) return result;
  const rawType = typeMatch[1].trim();
  const typeInfo = TYPE_MAP[rawType] || { label: rawType, tag: null };
  result.wordType = typeInfo.label;
  if (typeInfo.tag) result.autoTags.push(typeInfo.tag);

  // 3️⃣ Substantiv
  if (rawType === "Substantiv") {
    if      (/\|\s*Genus\s*=\s*m/i.test(wt)) result.artikel = "der";
    else if (/\|\s*Genus\s*=\s*[fp]/i.test(wt)) result.artikel = "die";
    else if (/\|\s*Genus\s*=\s*n/i.test(wt)) result.artikel = "das";

    result.plural   = extractField(wt,"Nominativ Plural");
    result.genitive = extractField(wt,"Genitiv Singular");
  }

  // 4️⃣ Verb (infinitiv ve lemma güvenli)
  if (rawType.includes("Verb") && !result.baseForm) {
    const inf = extractField(wt,"Infinitiv");
    if (isValidLemma(inf, originalWord)) result.baseForm = inf;
  }

  // 5️⃣ Adjektiv
  if (rawType === "Adjektiv") {
    const pos = extractField(wt,"Positiv");
    if (isValidLemma(pos, originalWord)) result.baseForm = pos;
  }

  return result;
}

// ================================
// HELPERS
// ================================
function findGrundform(wt) {
  const lines = wt.split("\n");
  for (const line of lines) {
    const m = line.match(/\{\{Grundformverweis[^|]*\|([^|}]+)/i);
    if (m) return clean(m[1]);
  }
  return null;
}

function extractField(wt, field) {
  const m = wt.match(new RegExp(`\\|\\s*${field}\\s*=?\\s*([^\\n|{}]+)`));
  if (!m) return "";
  return clean(m[1]).split(",")[0];
}

function clean(str) {
  return str.replace(/\[\[|\]\]/g,"").trim();
}

// Lemma doğrulama (artık regn gibi kırpmaları yapmaz)
function isValidLemma(candidate, original) {
  if (!candidate) return false;
  const c = candidate.toLowerCase();
  const o = original.toLowerCase();
  // sadece whitespace, pipe veya 2 harf altı değil
  return c !== o && !c.includes(" ") && !c.includes("|") && c.length > 2;
}