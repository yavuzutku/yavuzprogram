import { capitalize } from "../utils/html.js";

export const ARTIKEL_COLORS = {
  der: { text: "#60c8f0", bg: "rgba(96,200,240,0.12)",  border: "rgba(96,200,240,0.25)"  },
  die: { text: "#f07068", bg: "rgba(240,112,104,0.10)", border: "rgba(240,112,104,0.25)" },
  das: { text: "#a064ff", bg: "rgba(160,100,255,0.10)", border: "rgba(160,100,255,0.25)" },
};

export const TYPE_MAP = {
  "Substantiv":   { label: "İsim",   tag: "isim"  },
  "Verb":         { label: "Fiil",   tag: "fiil"  },
  "Adjektiv":     { label: "Sıfat",  tag: "sıfat" },
  "Adverb":       { label: "Zarf",   tag: "zarf"  },
  "Präposition":  { label: "Edat",   tag: null    },
  "Konjunktion":  { label: "Bağlaç", tag: null    },
  "Pronomen":     { label: "Zamir",  tag: null    },
  "Interjektion": { label: "Ünlem",  tag: null    },
};

const _wikiCache = new Map();

export async function fetchWikiData(word) {
  const key = word.trim().toLowerCase();
  if (_wikiCache.has(key)) return _wikiCache.get(key);

  const empty = { 
    artikel: "", wordType: "", plural: "", 
    genitive: "", baseForm: "", autoTags: [] 
  };

  try {
    const cap    = capitalize(word);
    const params = new URLSearchParams({
      action: "parse", page: cap,
      prop: "wikitext", format: "json", origin: "*"
    });
    const res  = await fetch("https://de.wiktionary.org/w/api.php?" + params);
    const data = await res.json();
    const wt   = data?.parse?.wikitext?.["*"] || "";

    if (!wt) { _wikiCache.set(key, empty); return empty; }

    const result = _parseWikitext(wt, word);
    _wikiCache.set(key, result);
    return result;
  } catch {
    _wikiCache.set(key, empty);
    return empty;
  }
}

function _parseWikitext(wt, originalWord) {
  const result = { 
    artikel: "", wordType: "", plural: "", 
    genitive: "", baseForm: "", autoTags: [] 
  };

  const typeMatch = wt.match(/\{\{Wortart\|([^|}\n]+)/);
  if (!typeMatch) return result;

  const rawType  = typeMatch[1].trim();
  const typeInfo = TYPE_MAP[rawType] || { label: rawType, tag: null };
  result.wordType = typeInfo.label;
  if (typeInfo.tag) result.autoTags.push(typeInfo.tag);

  if (rawType === "Substantiv") {
    if      (/\|\s*Genus\s*=\s*m/i.test(wt)) result.artikel = "der";
    else if (/\|\s*Genus\s*=\s*[fp]/i.test(wt)) result.artikel = "die";
    else if (/\|\s*Genus\s*=\s*n/i.test(wt)) result.artikel = "das";

    const pMatch = wt.match(/\|\s*Nominativ Plural\s*=\s*([^\n|{}]+)/);
    if (pMatch) {
      const p = pMatch[1].trim().replace(/\[\[|\]\]/g, "");
      if (p && p !== "—" && p !== "-") result.plural = p;
    }

    const gMatch = wt.match(/\|\s*Genitiv Singular\s*=\s*([^\n|{}]+)/);
    if (gMatch) {
      const g = gMatch[1].trim().replace(/\[\[|\]\]/g, "");
      if (g && g !== "—" && g !== "-") result.genitive = g;
    }
  }

  if (rawType === "Verb") {
    const bMatch = wt.match(/\|\s*Grundform\s*=\s*([^\n|{}]+)/)
                || wt.match(/\|\s*Infinitiv\s*=\s*([^\n|{}]+)/);
    if (bMatch) {
      const b = bMatch[1].trim().replace(/\[\[|\]\]/g, "");
      if (b && b.toLowerCase() !== originalWord.toLowerCase()) result.baseForm = b;
    }
  }

  if (rawType === "Adjektiv") {
    const pMatch = wt.match(/\|\s*Positiv\s*=\s*([^\n|{}]+)/);
    if (pMatch) {
      const pos = pMatch[1].trim().replace(/\[\[|\]\]/g, "");
      if (pos && pos.toLowerCase() !== originalWord.toLowerCase()) result.baseForm = pos;
    }
  }

  return result;
}