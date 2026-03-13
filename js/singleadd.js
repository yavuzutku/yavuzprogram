import { auth, getWords, saveWord } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { renderTagChips, getSelectedTags, extractAllTags } from "./tag.js";

/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
let currentUser      = null;
let allExistingWords = [];
let wikiData         = null;   // Wiktionary'den gelen zengin veri
let debounceTimer    = null;

/* ══════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════ */
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    allExistingWords = await getWords(user.uid).catch(() => []);
  }
});

/* ══════════════════════════════════════════════
   DOM REFS
══════════════════════════════════════════════ */
const backBtn        = document.getElementById("backBtn");
const stepWord       = document.getElementById("stepWord");
const stepMeaning    = document.getElementById("stepMeaning");
const wordInput      = document.getElementById("wordInput");
const wordNextBtn    = document.getElementById("wordNextBtn");
const wordPreview    = document.getElementById("wordPreview");
const meaningInput   = document.getElementById("meaningInput");
const saveBtn        = document.getElementById("saveBtn");
const statusMsg      = document.getElementById("statusMsg");
const translateHint  = document.getElementById("translateHint");
const hintText       = document.getElementById("hintText");
const altHints       = document.getElementById("altHints");

// Yeni: zengin öneri kartı (adım 1'de gösterilir)
const wikiCard       = document.getElementById("wikiCard");
const wikiArtikel    = document.getElementById("wikiArtikel");
const wikiWordType   = document.getElementById("wikiWordType");
const wikiBaseForm   = document.getElementById("wikiBaseForm");
const wikiBaseWrap   = document.getElementById("wikiBaseWrap");
const wikiLoading    = document.getElementById("wikiLoading");
const applyBaseForm  = document.getElementById("applyBaseForm");

/* ── Geri butonu ── */
backBtn.addEventListener("click", () => {
  window.location.href = "../wordsadd/";
});

/* ══════════════════════════════════════════════
   URL SYNC
══════════════════════════════════════════════ */
wordInput.addEventListener("input", () => {
  const val = wordInput.value.trim();
  const url = new URL(window.location.href);
  val ? url.searchParams.set("word", val) : url.searchParams.delete("word");
  history.replaceState(null, "", url.toString());

  // Debounce: 500ms sonra Wiktionary'ye sor
  clearTimeout(debounceTimer);
  hideWikiCard();
  wikiData = null;

  if (val.length >= 2) {
    debounceTimer = setTimeout(() => fetchWikiEnrichment(val), 500);
  }
});

/* ══════════════════════════════════════════════
   SAYFA AÇILIRKEN URL'DEN OKU
══════════════════════════════════════════════ */
window.addEventListener("DOMContentLoaded", () => {
  const params           = new URLSearchParams(window.location.search);
  const prefilledWord    = params.get("word");
  const prefilledMeaning = params.get("meaning");

  if (prefilledWord) {
    wordInput.value = prefilledWord;
    fetchWikiEnrichment(prefilledWord);
  }

  if (prefilledWord && prefilledMeaning) {
    goToMeaningStep();
    meaningInput.value = prefilledMeaning;
  }
});

/* ══════════════════════════════════════════════
   WİKTİONARY ZENGİNLEŞTİRME (Adım 1'de çalışır)
══════════════════════════════════════════════ */
async function fetchWikiEnrichment(word) {
  wikiLoading.style.display = "flex";
  wikiCard.style.display    = "none";

  try {
    const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
    const params = new URLSearchParams({
      action: "parse", page: capitalized,
      prop: "wikitext", format: "json", origin: "*"
    });
    const res  = await fetch("https://de.wiktionary.org/w/api.php?" + params);
    const data = await res.json();
    const wt   = data?.parse?.wikitext?.["*"] || "";

    if (!wt) {
      wikiLoading.style.display = "none";
      return;
    }

    const result = parseWikitext(wt, word);
    if (!result.found) {
      wikiLoading.style.display = "none";
      return;
    }

    wikiData = result;
    renderWikiCard(result, word);

  } catch {
    // Sessizce geç - zorunlu değil
  } finally {
    wikiLoading.style.display = "none";
  }
}

function parseWikitext(wt, originalWord) {
  const result = {
    found:    false,
    artikel:  "",
    wordType: "",
    baseForm: "",   // gehe → gehen, schöner → schön
    plural:   "",
    genitive: "",
    autoTags: [],
  };

  // Kelime türü
  const typeMatch = wt.match(/\{\{Wortart\|([^|}\n]+)/);
  if (!typeMatch) return result;
  result.found = true;

  const rawType = typeMatch[1].trim();
  const typeMap = {
    "Substantiv":   { label: "İsim",        tag: "isim" },
    "Verb":         { label: "Fiil",         tag: "fiil" },
    "Adjektiv":     { label: "Sıfat",        tag: "sıfat" },
    "Adverb":       { label: "Zarf",         tag: "zarf" },
    "Präposition":  { label: "Edat",         tag: null },
    "Konjunktion":  { label: "Bağlaç",       tag: null },
    "Pronomen":     { label: "Zamir",        tag: null },
    "Interjektion": { label: "Ünlem",        tag: null },
  };
  const typeInfo    = typeMap[rawType] || { label: rawType, tag: null };
  result.wordType   = typeInfo.label;
  if (typeInfo.tag) result.autoTags.push(typeInfo.tag);

  // Artikel (isimler için)
  if (rawType === "Substantiv") {
    const genusMatch = wt.match(/\|\s*Genus\s*=\s*([a-z]+)/i);
    if (genusMatch) {
      const g = genusMatch[1];
      if (g === "m") result.artikel = "der";
      else if (g === "f" || g === "p") result.artikel = "die";
      else if (g === "n") result.artikel = "das";
    }

    // Çoğul
    const pMatch = wt.match(/\|\s*Nominativ Plural\s*=\s*([^\n|{}]+)/);
    if (pMatch) {
      const p = pMatch[1].trim().replace(/\[\[|\]\]/g, "");
      if (p && p !== "—" && p !== "-") result.plural = p;
    }

    // Genitif
    const gMatch = wt.match(/\|\s*Genitiv Singular\s*=\s*([^\n|{}]+)/);
    if (gMatch) {
      const g = gMatch[1].trim().replace(/\[\[|\]\]/g, "");
      if (g && g !== "—" && g !== "-") result.genitive = g;
    }
  }

  // Fiil: temel form (Grundform = infinitiv)
  if (rawType === "Verb") {
    // Eğer girilmiş kelime ile infinitiv farklıysa göster
    // Wiktionary'de "Grundform" veya "Verb" tablosunda infinitiv zaten sayfa başlığı
    // Ama çekimli form girilmişse, sayfa "Grundform = gehen" içerir
    const baseMatch = wt.match(/\|\s*Grundform\s*=\s*([^\n|{}]+)/);
    if (baseMatch) {
      const base = baseMatch[1].trim().replace(/\[\[|\]\]/g, "");
      if (base && base.toLowerCase() !== originalWord.toLowerCase()) {
        result.baseForm = base;
      }
    }

    // Alternatif: infinitiv için "Infinitiv" field
    const infMatch = wt.match(/\|\s*Infinitiv\s*=\s*([^\n|{}]+)/);
    if (!result.baseForm && infMatch) {
      const inf = infMatch[1].trim().replace(/\[\[|\]\]/g, "");
      if (inf && inf.toLowerCase() !== originalWord.toLowerCase()) {
        result.baseForm = inf;
      }
    }
  }

  // Sıfat: temel form (Komparativ/Superlativ girilmişse)
  if (rawType === "Adjektiv") {
    const posMatch = wt.match(/\|\s*Positiv\s*=\s*([^\n|{}]+)/);
    if (posMatch) {
      const pos = posMatch[1].trim().replace(/\[\[|\]\]/g, "");
      if (pos && pos.toLowerCase() !== originalWord.toLowerCase()) {
        result.baseForm = pos;
      }
    }
  }

  return result;
}

function renderWikiCard(data, word) {
  // Artikel badge
  if (data.artikel) {
    wikiArtikel.textContent = data.artikel;
    wikiArtikel.className   = "wiki-artikel wiki-artikel--" + data.artikel;
    wikiArtikel.style.display = "inline-flex";
  } else {
    wikiArtikel.style.display = "none";
  }

  // Kelime türü
  if (data.wordType) {
    wikiWordType.textContent  = data.wordType;
    wikiWordType.style.display = "inline-flex";
  } else {
    wikiWordType.style.display = "none";
  }

  // Temel form önerisi (gehe → gehen)
  if (data.baseForm) {
    wikiBaseForm.textContent   = data.baseForm;
    wikiBaseWrap.style.display = "flex";
  } else {
    wikiBaseWrap.style.display = "none";
  }

  // Ek bilgi
  const metaParts = [];
  if (data.plural)   metaParts.push(`Çoğul: <em>${escapeHtml(data.plural)}</em>`);
  if (data.genitive) metaParts.push(`Genitif: <em>${escapeHtml(data.genitive)}</em>`);
  const extraEl = document.getElementById("wikiExtra");
  if (extraEl) {
    extraEl.innerHTML  = metaParts.join(" · ");
    extraEl.style.display = metaParts.length ? "block" : "none";
  }

  wikiCard.style.display = "flex";
}

function hideWikiCard() {
  wikiCard.style.display    = "none";
  wikiLoading.style.display = "none";
}

// "Temel formu kullan" butonu
applyBaseForm?.addEventListener("click", () => {
  if (wikiData?.baseForm) {
    wordInput.value = wikiData.baseForm;
    const url = new URL(window.location.href);
    url.searchParams.set("word", wikiData.baseForm);
    history.replaceState(null, "", url.toString());
    // Yeni kelime için tekrar sorgula
    fetchWikiEnrichment(wikiData.baseForm);
  }
});

/* ══════════════════════════════════════════════
   ADIM 1 → ADIM 2 GEÇİŞİ
══════════════════════════════════════════════ */
wordNextBtn.addEventListener("click", () => goToMeaningStep());
wordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") goToMeaningStep();
});

function goToMeaningStep() {
  const word = wordInput.value.trim();

  if (!word) {
    showStatus("Lütfen bir kelime gir.", "error");
    wordInput.focus();
    return;
  }

  // Kelime önizleme: artikel varsa başına ekle
  const displayWord = (wikiData?.artikel)
    ? `${wikiData.artikel} ${word.charAt(0).toUpperCase() + word.slice(1)}`
    : word;
  wordPreview.innerHTML = wikiData?.artikel
    ? `<span class="preview-artikel preview-artikel--${wikiData.artikel}">${wikiData.artikel}</span> ${escapeHtml(word.charAt(0).toUpperCase() + word.slice(1))}`
    : escapeHtml(word);

  stepWord.classList.add("hidden");
  stepMeaning.classList.remove("hidden");
  hideStatus();

  // Etiket chip'leri — otomatik seçilenler wikiData'dan
  const autoSelected = wikiData?.autoTags || [];
  renderTagChips("tagChips", autoSelected, extractAllTags(allExistingWords));

  // Çeviri önerisi + alternatifler
  hintText.textContent = "⏳ yükleniyor…";
  hintText.classList.remove("hint-error");
  translateHint.classList.remove("hidden");
  if (altHints) altHints.innerHTML = "";

  fetchTranslationHint(word);
  meaningInput.focus();
}

/* ══════════════════════════════════════════════
   ÇEVİRİ ÖNERİSİ + ALTERNATİFLER
══════════════════════════════════════════════ */
async function fetchTranslationHint(word) {
  try {
    const url  = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=tr&dt=t&dt=at&q=${encodeURIComponent(word)}`;
    const res  = await fetch(url);
    const data = await res.json();

    // Ana çeviri
    const main = data[0]?.map(t => t?.[0]).filter(Boolean).join("") || "—";
    hintText.textContent = main;

    // Anlam alanına otomatik doldur (boşsa)
    if (!meaningInput.value.trim()) {
      meaningInput.value = main;
    }

    // Alternatif anlamlar (dt=at → data[5])
    if (altHints && data[5]) {
      const alts = [];
      data[5].forEach(entry => {
        entry?.[2]?.forEach(item => {
          const w = item?.[0];
          if (w && w !== main) alts.push(w);
        });
      });

      if (alts.length > 0) {
        const label = document.createElement("span");
        label.className   = "alt-hints-label";
        label.textContent = "Diğer anlamlar:";
        altHints.appendChild(label);

        alts.slice(0, 6).forEach(alt => {
          const chip = document.createElement("button");
          chip.type      = "button";
          chip.className = "alt-hint-chip";
          chip.textContent = alt;
          chip.addEventListener("click", () => {
            meaningInput.value = alt;
            meaningInput.focus();
          });
          altHints.appendChild(chip);
        });
        altHints.style.display = "flex";
      }
    }

  } catch {
    hintText.textContent = "çeviri alınamadı";
    hintText.classList.add("hint-error");
  }
}

/* ══════════════════════════════════════════════
   KAYDET
══════════════════════════════════════════════ */
saveBtn.addEventListener("click",  () => addWord());
meaningInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addWord();
});

async function addWord() {
  let word      = wordInput.value.trim();
  const meaning = meaningInput.value.trim();
  const tags    = getSelectedTags("tagChips");

  if (!meaning) {
    showStatus("Lütfen bir anlam gir.", "error");
    meaningInput.focus();
    return;
  }

  if (!currentUser) {
    showStatus("Oturum bulunamadı. Lütfen tekrar giriş yap.", "error");
    return;
  }

  // Akıllı kelime normalleştirme:
  // İsim ise → büyük harf + artikel ekle (eğer zaten yoksa)
  if (wikiData?.artikel && !word.toLowerCase().startsWith(wikiData.artikel.toLowerCase())) {
    word = `${wikiData.artikel} ${word.charAt(0).toUpperCase() + word.slice(1)}`;
    wordInput.value = word;
  } else if (wikiData?.wordType === "İsim" && !wikiData.artikel) {
    word = word.charAt(0).toUpperCase() + word.slice(1);
    wordInput.value = word;
  }

  saveBtn.disabled    = true;
  saveBtn.textContent = "Kontrol ediliyor…";

  try {
    const existing  = await getWords(currentUser.uid);
    const duplicate = existing.find(w =>
      w.word.toLowerCase().trim()    === word.toLowerCase().trim() &&
      w.meaning.toLowerCase().trim() === meaning.toLowerCase().trim()
    );

    if (duplicate) {
      showStatus("⚠️ Bu kelime ve anlam zaten kayıtlı.", "error");
      saveBtn.disabled    = false;
      saveBtn.textContent = "Kelimeyi Ekle ✓";
      return;
    }

    await saveWord(currentUser.uid, word, meaning, tags);

    const tagSummary = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
    showStatus(`✅ "${word}"${tagSummary} eklendi!`, "success");

    setTimeout(() => resetForm(), 1800);

  } catch (err) {
    console.error(err);
    showStatus("Bir hata oluştu: " + err.message, "error");
    saveBtn.disabled    = false;
    saveBtn.textContent = "Kelimeyi Ekle ✓";
  }
}

/* ══════════════════════════════════════════════
   FORM SIFIRLA
══════════════════════════════════════════════ */
function resetForm() {
  wordInput.value         = "";
  meaningInput.value      = "";
  wordPreview.innerHTML   = "";
  hintText.textContent    = "";
  hintText.classList.remove("hint-error");
  translateHint.classList.add("hidden");
  if (altHints) { altHints.innerHTML = ""; altHints.style.display = "none"; }

  wikiData = null;
  hideWikiCard();

  stepMeaning.classList.add("hidden");
  stepWord.classList.remove("hidden");

  const url = new URL(window.location.href);
  url.searchParams.delete("word");
  history.replaceState(null, "", url.toString());

  hideStatus();
  saveBtn.disabled    = false;
  saveBtn.textContent = "Kelimeyi Ekle ✓";
  wordInput.focus();
}

/* ══════════════════════════════════════════════
   YARDIMCI
══════════════════════════════════════════════ */
function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className   = `status-msg ${type}`;
  statusMsg.classList.remove("hidden");
}

function hideStatus() {
  statusMsg.classList.add("hidden");
  statusMsg.textContent = "";
  statusMsg.className   = "status-msg hidden";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}