import { auth, saveWordOrAddMeaning, getWords } from "../js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { renderTagChips, getSelectedTags, extractAllTags, getAutoLevel } from "../js/tag.js";
import {
  fetchWikiData, fetchTranslate, normalizeGermanWord,
  artikelBadgeHtml, capitalize, escapeHtml, escapeRegex,
  isSingleWord, ARTIKEL_COLORS
} from "../js/german.js";
import { showAuthGate, isLoggedIn } from '../src/components/authGate.js';
import { showLemmaHintOnce } from '../src/components/lemmaHint.js';

/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
let currentUser     = null;
let allWords        = [];
let currentLang     = "de-tr";   // "de-tr" veya "tr-de"
let lastTranslation = null;      // { source, target, sl, tl }
let lastWikiData    = null;      // { artikel, wordType, plural, genitive, autoTags }
let exampleCache    = new Map();
let historyVisible  = false;

const HISTORY_KEY = "ceviri_history";
const MAX_HISTORY = 20;

/* ══════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════ */
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    allWords = await getWords(user.uid).catch(() => []);
  }
});

/* ══════════════════════════════════════════════
   DOM REFS
══════════════════════════════════════════════ */
const sourceInput      = document.getElementById("sourceInput");
const charCount        = document.getElementById("charCount");
const clearBtn         = document.getElementById("clearBtn");
const translateBtn     = document.getElementById("translateBtn");
const translateBtnText = document.getElementById("translateBtnText");
const resultWrap       = document.getElementById("resultWrap");
const resultMain       = document.getElementById("resultMain");
const altTranslations  = document.getElementById("altTranslations");
const altChips         = document.getElementById("altChips");
const errorWrap        = document.getElementById("errorWrap");
const errorMsg         = document.getElementById("errorMsg");
const loadingWrap      = document.getElementById("loadingWrap");
const copyBtn          = document.getElementById("copyBtn");
const speakBtn         = document.getElementById("speakBtn");
const saveWordBtn      = document.getElementById("saveWordBtn");

const detailEmpty      = document.getElementById("detailEmpty");
const detailContent    = document.getElementById("detailContent");
const detailLoading    = document.getElementById("detailLoading");
const wordArtikel      = document.getElementById("wordArtikel");
const wordDisplay      = document.getElementById("wordDisplay");
const wordMeta         = document.getElementById("wordMeta");
const examplesSection  = document.getElementById("examplesSection");
const examplesList     = document.getElementById("examplesList");
const wiktionaryLink   = document.getElementById("wiktionaryLink");

const langDeBtn        = document.getElementById("langDeBtn");
const langTrBtn        = document.getElementById("langTrBtn");
const langSwapBtn      = document.getElementById("langSwapBtn");

const historyToggleBtn = document.getElementById("historyToggleBtn");
const historyPanel     = document.getElementById("historyPanel");
const historyList      = document.getElementById("historyList");
const clearHistoryBtn  = document.getElementById("clearHistoryBtn");

const saveModal        = document.getElementById("saveModal");
const modalClose       = document.getElementById("modalClose");
const modalCancelBtn   = document.getElementById("modalCancelBtn");
const modalSaveBtn     = document.getElementById("modalSaveBtn");
const modalWord        = document.getElementById("modalWord");
const modalMeaning     = document.getElementById("modalMeaning");
const modalTagChips    = document.getElementById("modalTagChips");
const modalStatus      = document.getElementById("modalStatus");

/* ══════════════════════════════════════════════
   KARAKTEr SAYACI
══════════════════════════════════════════════ */
sourceInput.addEventListener("input", () => {
  const len = sourceInput.value.length;
  charCount.textContent = `${len} / 500`;
  charCount.style.color = len > 450 ? "var(--rose)" : "var(--text-muted)";
});

/* ══════════════════════════════════════════════
   TEMİZLE
══════════════════════════════════════════════ */
clearBtn.addEventListener("click", () => {
  sourceInput.value = "";
  charCount.textContent = "0 / 500";
  hideResult();
  hideError();
  resetDetailPanel();
  lastTranslation = null;
  lastWikiData    = null;
  sourceInput.focus();
});

/* ══════════════════════════════════════════════
   DİL SEÇİCİ
══════════════════════════════════════════════ */
langDeBtn.addEventListener("click", () => setLang("de-tr"));
langTrBtn.addEventListener("click", () => setLang("tr-de"));

langSwapBtn.addEventListener("click", () => {
  const newLang = currentLang === "de-tr" ? "tr-de" : "de-tr";
  // Kaynak ve hedefi yer değiştir
  if (lastTranslation) {
    sourceInput.value = lastTranslation.target;
  }
  setLang(newLang);
  if (sourceInput.value.trim()) translate();
});

function setLang(dir) {
  currentLang = dir;
  langDeBtn.classList.toggle("active", dir === "de-tr");
  langTrBtn.classList.toggle("active", dir === "tr-de");
  sourceInput.placeholder = dir === "de-tr"
    ? "Çevirmek istediğin Almanca kelimeyi veya cümleyi yaz…"
    : "Çevirmek istediğin Türkçe kelimeyi yaz…";
}

/* ══════════════════════════════════════════════
   ENTER ile çevir
══════════════════════════════════════════════ */
sourceInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    translate();
  }
});

translateBtn.addEventListener("click", translate);

/* ══════════════════════════════════════════════
   ANA ÇEVİRİ FONKSİYONU
══════════════════════════════════════════════ */
async function translate() {
  const text = sourceInput.value.trim();
  if (!text) {
    sourceInput.focus();
    return;
  }

  const [sl, tl] = currentLang.split("-");

  setLoading(true);
  hideResult();
  hideError();
  resetDetailPanel();
  saveWordBtn.classList.remove("saved");
  saveWordBtn.textContent = "";
  saveWordBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Sözlüğe Ekle`;

  try {
    // 1) Ana çeviri + alternatifler — german.js fetchTranslate
    const { main: mainTranslation, alts } = await fetchTranslate(text, { sl, tl });
    lastTranslation = { source: text, target: mainTranslation, sl, tl };

    resultMain.textContent   = mainTranslation;
    resultWrap.style.display = "block";
    speakBtn.style.display = "flex";
    if (alts.length > 0) {
      altChips.innerHTML = "";
      alts.slice(0, 8).forEach(alt => {
        const chip = document.createElement("button");
        chip.className = "alt-chip";
        chip.textContent = alt;
        chip.addEventListener("click", () => {
          resultMain.textContent = alt;
          lastTranslation.target = alt;
        });
        altChips.appendChild(chip);
      });
      altTranslations.style.display = "block";
    } else {
      altTranslations.style.display = "none";
    }

    addToHistory(text, mainTranslation, sl, tl);

    // 2) Detay paneli — sadece Almanca kelimeler için Wiktionary
    if (sl === "de" && isSingleWord(text)) {
      loadWordDetails(text, mainTranslation);
    } else if (tl === "de" && isSingleWord(mainTranslation)) {
      loadWordDetails(mainTranslation, text);
    } else {
      lastWikiData = null;
      showDetailEmpty();
    }

  } catch (err) {
    showError(err.message || "Bir hata oluştu. İnternet bağlantını kontrol et.");
    resetDetailPanel();
  } finally {
    setLoading(false);
  }
}


/* ══════════════════════════════════════════════
   DETAY PANELİ — Wiktionary + Tatoeba
══════════════════════════════════════════════ */
async function loadWordDetails(deWord, trMeaning) {
  detailEmpty.style.display   = "none";
  detailContent.style.display = "none";
  detailLoading.style.display = "flex";

  try {
    const [artikelInfo, examples] = await Promise.all([
      fetchWikiData(deWord),          // ← german.js
      fetchExamples(deWord),
    ]);

    // lastWikiData'yı güncelle (modal için)
    const tagMap = {
      "İsim": "isim", "Fiil": "fiil", "Sıfat": "sıfat", "Zarf": "zarf"
    };
    lastWikiData = {
      ...artikelInfo,
      autoTags: tagMap[artikelInfo.wordType] ? [tagMap[artikelInfo.wordType]] : [],
    };

    // Artikel
    const artikel = artikelInfo.artikel;
    wordArtikel.textContent = artikel || "";
    wordArtikel.className   = "word-artikel " + (artikel ? artikel.toLowerCase() : "");
    wordDisplay.textContent = deWord;

    // Meta bilgi
    const metaParts = [];
    if (artikelInfo.wordType) metaParts.push(`<span>📝 ${artikelInfo.wordType}</span>`);
    if (artikelInfo.plural)   metaParts.push(`<span>🔢 Çoğul: <em>${artikelInfo.plural}</em></span>`);
    if (artikelInfo.genitive) metaParts.push(`<span>📌 Genitif: <em>${artikelInfo.genitive}</em></span>`);
    wordMeta.innerHTML = metaParts.join("") || "";

    // Örnek cümleler
    if (examples.length > 0) {
      examplesList.innerHTML = "";
      const searchedWord = deWord.toLowerCase();

      // Her örnek için Türkçe çevirisini al
      const withTranslations = await Promise.all(
        examples.slice(0, 4).map(async (ex) => {
          let tr = null;
          try {
            const { main } = await fetchTranslate(ex.original);   // ← german.js
            tr = main !== "—" ? main : null;
          } catch { /* sessizce geç */ }
          return { ...ex, turkish: tr };
        })
      );

      withTranslations.forEach(ex => {
        const item = document.createElement("div");
        item.className = "example-item";

        // Kelimeyi vurgula
        const highlighted = ex.original.replace(
          new RegExp(`(${escapeRegex(deWord)}|${escapeRegex(deWord.toLowerCase())}|${escapeRegex(capitalize(deWord))})`, "g"),
          "<strong>$1</strong>"
        );

        item.innerHTML = `
          <div class="example-de">${highlighted}</div>
          ${ex.turkish ? `<div class="example-tr">${escapeHtml(ex.turkish)}</div>` : ""}
          ${ex.source   ? `<div class="example-source">${ex.source}</div>` : ""}
        `;
        examplesList.appendChild(item);
      });

      examplesSection.style.display = "flex";
    } else {
      examplesSection.style.display = "none";
    }

    // Wiktionary linki
    const wikiWord = capitalize(deWord);
    wiktionaryLink.href = `https://de.wiktionary.org/wiki/${encodeURIComponent(wikiWord)}`;
    wiktionaryLink.style.display = "inline-flex";

    detailContent.style.display = "flex";

  } catch {
    showDetailEmpty();
  } finally {
    detailLoading.style.display = "none";
  }
}



/* ── Wiktionary + Tatoeba örnek cümleler ── */
async function fetchExamples(word) {
  if (exampleCache.has(word)) return exampleCache.get(word);

  const results = [];

  try {
    // Wiktionary
    const capitalized = capitalize(word);
    const params = new URLSearchParams({
      action: "parse", page: capitalized,
      prop: "wikitext", format: "json", origin: "*"
    });
    const res  = await fetch("https://de.wiktionary.org/w/api.php?" + params);
    const data = await res.json();
    const wikitext = data?.parse?.wikitext?.["*"] || "";

    const lines = wikitext.split("\n");
    let inBeispiele = false;

    for (const line of lines) {
      if (line.includes("Beispiele}}") || line.includes("Beispiele:")) { inBeispiele = true; continue; }
      if (inBeispiele && line.match(/^\s*:?\{\{(Herkunft|Synonyme|Übersetzungen|Wortbildungen|Bedeutungen|Redewendungen)/)) { inBeispiele = false; continue; }
      if (inBeispiele && line.trim()) {
        const match = line.match(/^::?\[\d+\]\s*(.+)/);
        if (match) {
          const cleaned = cleanWikitext(match[1]);
          if (cleaned.length > 10 && cleaned.split(/\s+/).length > 4) {
            results.push({ original: cleaned, source: "Wiktionary" });
          }
        }
      }
      if (results.length >= 3) break;
    }
  } catch { /* sessizce devam */ }

  // Tatoeba (yeterliyse atla)
  if (results.length < 3) {
    try {
      const url = `https://api.tatoeba.org/v1/sentences?q=${encodeURIComponent(word)}&lang=deu&min_length=6`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data.data) {
        data.data
          .filter(s => s.text.split(/\s+/).length > 4)
          .sort((a, b) => a.text.length - b.text.length)
          .slice(0, 3 - results.length)
          .forEach(s => results.push({ original: s.text, source: "Tatoeba" }));
      }
    } catch { /* sessizce devam */ }
  }

  exampleCache.set(word, results);
  return results;
}

/* ══════════════════════════════════════════════
   GEÇMİŞ
══════════════════════════════════════════════ */
function addToHistory(source, target, sl, tl) {
  let history = loadHistory();
  // Aynı çeviri varsa öne al
  history = history.filter(h => !(h.source === source && h.sl === sl));
  history.unshift({ source, target, sl, tl, time: Date.now() });
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  saveHistory(history);
  if (historyVisible) renderHistory();
}

function loadHistory() {
  try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function saveHistory(arr) {
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
}

function renderHistory() {
  const history = loadHistory();
  if (history.length === 0) {
    historyList.innerHTML = `<div class="history-empty">Henüz çeviri yapılmadı.</div>`;
    return;
  }
  historyList.innerHTML = "";
  history.forEach(item => {
    const el = document.createElement("div");
    el.className = "history-item";
    el.innerHTML = `
      <span class="history-item-src">${escapeHtml(item.source)}</span>
      <span class="history-item-arrow">→</span>
      <span class="history-item-tgt">${escapeHtml(item.target)}</span>
    `;
    el.addEventListener("click", () => {
      sourceInput.value = item.source;
      setLang(`${item.sl}-${item.tl}`);
      translate();
      historyList.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    historyList.appendChild(el);
  });
}

historyToggleBtn.addEventListener("click", () => {
  historyVisible = !historyVisible;
  historyPanel.style.display = historyVisible ? "block" : "none";
  historyToggleBtn.classList.toggle("active", historyVisible);
  if (historyVisible) renderHistory();
});

clearHistoryBtn.addEventListener("click", () => {
  sessionStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

/* ══════════════════════════════════════════════
   KOPYALA
══════════════════════════════════════════════ */
copyBtn.addEventListener("click", async () => {
  const text = resultMain.textContent;
  if (!text || text === "—") return;
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    copyBtn.style.color = "var(--green)";
    setTimeout(() => {
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      copyBtn.style.color = "";
    }, 1500);
  } catch { /* clipboard erişimi yok */ }
});
/* ══════════════════════════════════════════════
   TELAFFUZ
══════════════════════════════════════════════ */
speakBtn.addEventListener("click", () => {
  if (!lastTranslation || !window.speechSynthesis) return;

  const isDeResult = lastTranslation.tl === "de";
  const text = isDeResult ? lastTranslation.target : lastTranslation.source;
  const lang = isDeResult ? "de-DE" : "de-DE"; // detay paneli her zaman Almancayı seslendirsin

  // Hangisi Almanca ise onu seslendir
  const deText = lastTranslation.sl === "de" ? lastTranslation.source : lastTranslation.target;
  const trText = lastTranslation.sl === "de" ? lastTranslation.target : lastTranslation.source;

  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(deText);
  utt.lang = "de-DE";
  utt.rate = 0.88;

  speakBtn.style.color = "var(--gold)";
  utt.onend = () => { speakBtn.style.color = ""; };
  utt.onerror = () => { speakBtn.style.color = ""; };

  window.speechSynthesis.speak(utt);
});
/* ══════════════════════════════════════════════
   SÖZLÜĞE EKLE — MODAL
══════════════════════════════════════════════ */
saveWordBtn.addEventListener("click", () => {
  if (!lastTranslation) return;
  if (!isLoggedIn()) {
    showAuthGate({
      title: 'Sözlüğüne eklemek için giriş yap',
      desc: 'Çevirdiğin kelimeleri kişisel sözlüğüne kaydetmek için ücretsiz hesabına giriş yap.'
    });
    return;
  }
  const deWordRaw = lastTranslation.sl === "de"
    ? lastTranslation.source
    : lastTranslation.target;
  const trWord = lastTranslation.sl === "de"
    ? lastTranslation.target
    : lastTranslation.source;

  const deWord   = normalizeGermanWord(deWordRaw, lastWikiData);  // ← german.js
  const autoTags = lastWikiData?.autoTags || [];

  modalWord.value    = deWord;
  const ceviriMountEl = document.getElementById('ceviriLemmaMount');
    if (ceviriMountEl) {
      showLemmaHintOnce({
        word: deWord,
        mountEl: ceviriMountEl,
        onApply: (lemma) => {
          modalWord.value = lemma;
          ceviriMountEl.innerHTML = '';
        }
      });
    }
  modalMeaning.value = trWord;

  const _cevLvl = getAutoLevel(deWordRaw);
  const _cevTags = [...autoTags];
  if (_cevLvl && !_cevTags.includes(_cevLvl)) _cevTags.push(_cevLvl);
  renderTagChips("modalTagChips", _cevTags, extractAllTags(allWords));
    hideModalStatus();
    saveModal.style.display = "flex";
    modalWord.focus();
  });

modalClose.addEventListener("click",    closeModal);
modalCancelBtn.addEventListener("click", closeModal);
saveModal.addEventListener("click", (e) => {
  if (e.target === saveModal) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && saveModal.style.display === "flex") closeModal();
});

function closeModal() {
  saveModal.style.display = "none";
  hideModalStatus();
}

modalSaveBtn.addEventListener("click", saveToVocabulary);
modalMeaning.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveToVocabulary();
});

async function saveToVocabulary() {
  const word    = modalWord.value.trim();
  const meaning = modalMeaning.value.trim();
  const tags    = getSelectedTags("modalTagChips");
 
  if (!word)    { showModalStatus("Kelime boş olamaz.", "error"); modalWord.focus();    return; }
  if (!meaning) { showModalStatus("Anlam boş olamaz.", "error");  modalMeaning.focus(); return; }
  if (!currentUser) { showModalStatus("Oturum bulunamadı. Lütfen tekrar giriş yap.", "error"); return; }
 
  modalSaveBtn.disabled    = true;
  modalSaveBtn.textContent = "Kaydediliyor…";
 
  try {
    const result = await saveWordOrAddMeaning(currentUser.uid, word, meaning, tags);
 
    /* Lokal listeyi güncelle */
    allWords = await getWords(currentUser.uid).catch(() => allWords);
 
    if (result.already) {
      showModalStatus(`⚠️ "${result.word}" için bu anlam zaten kayıtlı.`, "error");
      modalSaveBtn.disabled = false;
      modalSaveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Kaydet`;
      return;
    }
 
    /* Başarılı mesaj */
    const msg = result.merged
      ? `✅ "${result.word}" kelimesine "${result.meaning}" eklendi!`
      : `✅ "${result.word}" sözlüğüne eklendi!`;
    showModalStatus(msg, "success");
 
    /* Butonu güncelle */
    saveWordBtn.classList.add("saved");
    saveWordBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Eklendi`;
 
    setTimeout(closeModal, 1600);
 
  } catch (err) {
    showModalStatus("Hata: " + err.message, "error");
    modalSaveBtn.disabled = false;
    modalSaveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Kaydet`;
  }
}
 

/* ══════════════════════════════════════════════
   YARDIMCI FONKSİYONLAR
══════════════════════════════════════════════ */
function setLoading(on) {
  loadingWrap.style.display  = on ? "flex" : "none";
  translateBtn.disabled      = on;
  translateBtnText.textContent = on ? "Çevriliyor…" : "Çevir";
}

function hideResult() {
  resultWrap.style.display = "none";
  speakBtn.style.display   = "none";
}
function hideError()  { errorWrap.style.display  = "none"; }

function showError(msg) {
  errorMsg.textContent    = msg;
  errorWrap.style.display = "block";
}

function resetDetailPanel() {
  detailEmpty.style.display   = "flex";
  detailContent.style.display = "none";
  detailLoading.style.display = "none";
}

function showDetailEmpty() {
  detailEmpty.style.display   = "flex";
  detailContent.style.display = "none";
  detailLoading.style.display = "none";
}

function showModalStatus(msg, type) {
  modalStatus.textContent  = msg;
  modalStatus.className    = `modal-status ${type}`;
  modalStatus.style.display = "block";
}

function hideModalStatus() {
  modalStatus.style.display = "none";
  modalStatus.textContent   = "";
}




function cleanWikitext(text) {
  return text
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\}\}/g, "").replace(/\{\{/g, "")
    .replace(/'{2,3}/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/[„""‟«»'']/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}