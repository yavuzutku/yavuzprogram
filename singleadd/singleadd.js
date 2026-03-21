import { auth, getWords, saveWordOrAddMeaning } from "../js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { renderTagChips, getSelectedTags, extractAllTags, getAutoLevel } from "../js/tag.js";
import {
  fetchWikiData, fetchTranslate, normalizeGermanWord,
  artikelBadgeHtml, capitalize, escapeHtml, ARTIKEL_COLORS
} from "../js/german.js";

/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
let currentUser      = null;
let allExistingWords = [];
let wikiData         = null;
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

const wikiCard       = document.getElementById("wikiCard");
const wikiArtikel    = document.getElementById("wikiArtikel");
const wikiWordType   = document.getElementById("wikiWordType");
const wikiBaseForm   = document.getElementById("wikiBaseForm");
const wikiBaseWrap   = document.getElementById("wikiBaseWrap");
const wikiLoading    = document.getElementById("wikiLoading");
const applyBaseForm  = document.getElementById("applyBaseForm");

/* ── Geri ── */
backBtn.addEventListener("click", () => { window.location.href = "../wordsadd/"; });

/* ══════════════════════════════════════════════
   URL SYNC
══════════════════════════════════════════════ */
wordInput.addEventListener("input", () => {
  const val = wordInput.value.trim();
  const url = new URL(window.location.href);
  val ? url.searchParams.set("word", val) : url.searchParams.delete("word");
  history.replaceState(null, "", url.toString());

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
   WİKTİONARY
══════════════════════════════════════════════ */
async function fetchWikiEnrichment(word) {
  wikiLoading.style.display = "flex";
  wikiCard.style.display    = "none";
  try {
    const result = await fetchWikiData(word);
    if (!result.wordType) { wikiLoading.style.display = "none"; return; }
    wikiData = result;
    renderWikiCard(result, word);
  } catch { /* sessizce */ }
  finally { wikiLoading.style.display = "none"; }
}

function renderWikiCard(data, word) {
  if (data.artikel) {
    wikiArtikel.textContent  = data.artikel;
    wikiArtikel.className    = "wiki-artikel wiki-artikel--" + data.artikel;
    wikiArtikel.style.display = "inline-flex";
  } else {
    wikiArtikel.style.display = "none";
  }
  wikiWordType.textContent   = data.wordType || "";
  wikiWordType.style.display = data.wordType ? "inline-flex" : "none";

  if (data.baseForm) {
    wikiBaseForm.textContent   = data.baseForm;
    wikiBaseWrap.style.display = "flex";
  } else {
    wikiBaseWrap.style.display = "none";
  }

  const metaParts = [];
  if (data.plural)   metaParts.push(`Çoğul: <em>${escapeHtml(data.plural)}</em>`);
  if (data.genitive) metaParts.push(`Genitif: <em>${escapeHtml(data.genitive)}</em>`);
  const extraEl = document.getElementById("wikiExtra");
  if (extraEl) {
    extraEl.innerHTML     = metaParts.join(" · ");
    extraEl.style.display = metaParts.length ? "block" : "none";
  }
  wikiCard.style.display = "flex";
}

function hideWikiCard() {
  wikiCard.style.display    = "none";
  wikiLoading.style.display = "none";
}

applyBaseForm?.addEventListener("click", () => {
  if (wikiData?.baseForm) {
    wordInput.value = wikiData.baseForm;
    const url = new URL(window.location.href);
    url.searchParams.set("word", wikiData.baseForm);
    history.replaceState(null, "", url.toString());
    fetchWikiEnrichment(wikiData.baseForm);
  }
});

/* ══════════════════════════════════════════════
   ADIM 1 → 2
══════════════════════════════════════════════ */
wordNextBtn.addEventListener("click", () => goToMeaningStep());
wordInput.addEventListener("keydown", e => { if (e.key === "Enter") goToMeaningStep(); });

function goToMeaningStep() {
  const word = wordInput.value.trim();
  if (!word) { showStatus("Lütfen bir kelime gir.", "error"); wordInput.focus(); return; }

  wordPreview.innerHTML = wikiData?.artikel
    ? `<span class="preview-artikel preview-artikel--${wikiData.artikel}">${wikiData.artikel}</span> ${escapeHtml(word.charAt(0).toUpperCase() + word.slice(1))}`
    : escapeHtml(word);

  stepWord.classList.add("hidden");
  stepMeaning.classList.remove("hidden");
  hideStatus();

  const autoSelected = [...(wikiData?.autoTags || [])];
  const _lvl = getAutoLevel(word);
  if (_lvl && !autoSelected.includes(_lvl)) autoSelected.push(_lvl);
  renderTagChips("tagChips", autoSelected, extractAllTags(allExistingWords));

  hintText.textContent = "⏳ yükleniyor…";
  hintText.classList.remove("hint-error");
  translateHint.classList.remove("hidden");
  if (altHints) altHints.innerHTML = "";

  fetchTranslationHint(word);
  meaningInput.focus();
}

async function fetchTranslationHint(word) {
  try {
    const { main, alts } = await fetchTranslate(word);
    hintText.textContent = main;
    if (!meaningInput.value.trim()) meaningInput.value = main;

    if (altHints && alts.length > 0) {
      const label = document.createElement("span");
      label.className   = "alt-hints-label";
      label.textContent = "Diğer anlamlar:";
      altHints.appendChild(label);
      alts.slice(0, 6).forEach(alt => {
        const chip = document.createElement("button");
        chip.type      = "button";
        chip.className = "alt-hint-chip";
        chip.textContent = alt;
        chip.addEventListener("click", () => { meaningInput.value = alt; meaningInput.focus(); });
        altHints.appendChild(chip);
      });
      altHints.style.display = "flex";
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
meaningInput.addEventListener("keydown", e => { if (e.key === "Enter") addWord(); });

async function addWord() {
  let word      = wordInput.value.trim();
  const meaning = meaningInput.value.trim();
  const tags    = getSelectedTags("tagChips");

  if (!meaning) { showStatus("Lütfen bir anlam gir.", "error"); meaningInput.focus(); return; }
  if (!currentUser) { showStatus("Oturum bulunamadı. Lütfen tekrar giriş yap.", "error"); return; }

  word = normalizeGermanWord(word, wikiData);
  wordInput.value = word;

  saveBtn.disabled    = true;
  saveBtn.textContent = "Kaydediliyor…";

  try {
    const result = await saveWordOrAddMeaning(currentUser.uid, word, meaning, tags);

    if (result.already) {
      /* Kelime ve anlam zaten kayıtlı */
      showStatus(`⚠️ "${result.word}" için "${result.meaning}" zaten kayıtlı.`, "error");
      saveBtn.disabled    = false;
      saveBtn.textContent = "Kelimeyi Ekle ✓";
      return;
    }

    /* Başarılı mesaj — merge mi yeni kayıt mı? */
    const tagSummary = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
    const msg = result.merged
      ? `✅ "${result.word}" kelimesine "${result.meaning}" eklendi!${tagSummary}`
      : `✅ "${result.word}"${tagSummary} eklendi!`;

    showStatus(msg, "success");
    allExistingWords = await getWords(currentUser.uid).catch(() => allExistingWords);
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
  wordInput.value       = "";
  meaningInput.value    = "";
  wordPreview.innerHTML = "";
  hintText.textContent  = "";
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