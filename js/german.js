// Geriye dönük uyumluluk — eski import'lar bozulmasın
// İleride bu dosyayı tamamen silebilirsin

export { 
  fetchWikiData, 
  ARTIKEL_COLORS, 
  TYPE_MAP 
} from "../src/services/wiktionary.js";

export { 
  fetchTranslate 
} from "../src/services/translate.js";

export { 
  escapeHtml, 
  escapeRegex, 
  capitalize, 
  isSingleWord 
} from "../src/utils/html.js";

// Bu ikisi henüz taşınmadı, burada kalıyor
export function normalizeGermanWord(word, wikiData) {
  // ... aynı kod
}

export function artikelBadgeHtml(artikel, opts) {
  // ... aynı kod
}