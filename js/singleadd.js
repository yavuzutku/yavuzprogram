import { auth, getWords, saveWord } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ── DOM ── */
const backBtn       = document.getElementById("backBtn");
const stepWord      = document.getElementById("stepWord");
const stepMeaning   = document.getElementById("stepMeaning");
const wordInput     = document.getElementById("wordInput");
const wordNextBtn   = document.getElementById("wordNextBtn");
const wordPreview   = document.getElementById("wordPreview");
const meaningInput  = document.getElementById("meaningInput");
const saveBtn       = document.getElementById("saveBtn");
const statusMsg     = document.getElementById("statusMsg");
const translateHint = document.getElementById("translateHint");
const hintText      = document.getElementById("hintText");
const tagChips      = document.getElementById("tagChips");

let currentUser = null;

/* ── AUTH ── */
onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

/* ── TAG CHİP TOGGLE ── */
tagChips.querySelectorAll(".tag-chip").forEach(chip => {
  chip.addEventListener("click", () => chip.classList.toggle("selected"));
});

function getSelectedTags(){
  return [...tagChips.querySelectorAll(".tag-chip.selected")]
    .map(c => c.dataset.tag);
}

function resetTags(){
  tagChips.querySelectorAll(".tag-chip")
    .forEach(c => c.classList.remove("selected"));
}

/* ── GERİ BUTONU ── */
backBtn.addEventListener("click", () => {
  window.location.href = "wordsadd.html";
});

/* ── URL'İ YAZARKEN GÜNCELLE ── */
wordInput.addEventListener("input", () => {
  const val = wordInput.value.trim();
  const newUrl = new URL(window.location.href);
  if(val.length > 0){
    newUrl.searchParams.set("word", val);
  } else {
    newUrl.searchParams.delete("word");
  }
  history.replaceState(null, "", newUrl.toString());
});

/* ── SAYFA AÇILIRKEN URL'DEN KELİMEYİ OKU ── */
window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const prefilledWord = params.get("word");
  if(prefilledWord){
    wordInput.value = prefilledWord;
  }
});

/* ── ADIM 1 → ADIM 2 GEÇİŞİ ── */
wordNextBtn.addEventListener("click", () => goToMeaningStep());
wordInput.addEventListener("keydown", (e) => {
  if(e.key === "Enter") goToMeaningStep();
});

function goToMeaningStep(){
  const word = wordInput.value.trim();

  if(!word){
    showStatus("Lütfen bir kelime gir.", "error");
    wordInput.focus();
    return;
  }

  wordPreview.textContent = word;
  stepWord.classList.add("hidden");
  stepMeaning.classList.remove("hidden");
  hideStatus();
  resetTags();

  hintText.textContent = "⏳ yükleniyor…";
  hintText.classList.remove("hint-error");
  translateHint.classList.remove("hidden");

  fetchTranslationHint(word);
  meaningInput.focus();
}

/* ── ÇEVİRİ ÖNERİSİ ── */
function fetchTranslationHint(word){
  fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=tr&dt=t&q=${encodeURIComponent(word)}`
  )
    .then(res => res.json())
    .then(data => {
      hintText.textContent = data[0][0][0];
    })
    .catch(() => {
      hintText.textContent = "çeviri alınamadı";
      hintText.classList.add("hint-error");
    });
}

/* ── KAYDET ── */
saveBtn.addEventListener("click", () => addWord());
meaningInput.addEventListener("keydown", (e) => {
  if(e.key === "Enter") addWord();
});

async function addWord(){
  const word    = wordInput.value.trim();
  const meaning = meaningInput.value.trim();
  const tags    = getSelectedTags();

  if(!meaning){
    showStatus("Lütfen bir anlam gir.", "error");
    meaningInput.focus();
    return;
  }

  if(!currentUser){
    showStatus("Oturum bulunamadı. Lütfen tekrar giriş yap.", "error");
    return;
  }

  saveBtn.disabled    = true;
  saveBtn.textContent = "Kontrol ediliyor…";

  try {
    /* Duplicate kontrolü */
    const existing = await getWords(currentUser.uid);
    const duplicate = existing.find(w =>
      w.word.toLowerCase().trim()    === word.toLowerCase().trim() &&
      w.meaning.toLowerCase().trim() === meaning.toLowerCase().trim()
    );

    if(duplicate){
      showStatus("⚠️ Bu kelime ve anlam zaten kayıtlı.", "error");
      saveBtn.disabled    = false;
      saveBtn.textContent = "Kelimeyi Ekle ✓";
      return;
    }

    /* Firebase'e kaydet — tags dahil */
    await saveWord(currentUser.uid, word, meaning, tags);

    const tagSummary = tags.length > 0
      ? ` [${tags.join(", ")}]`
      : "";
    showStatus(`✅ "${word}"${tagSummary} eklendi!`, "success");

    setTimeout(() => resetForm(), 1800);

  } catch(err){
    console.error(err);
    showStatus("Bir hata oluştu: " + err.message, "error");
    saveBtn.disabled    = false;
    saveBtn.textContent = "Kelimeyi Ekle ✓";
  }
}

/* ── FORM SIFIRLA ── */
function resetForm(){
  wordInput.value         = "";
  meaningInput.value      = "";
  wordPreview.textContent = "";
  hintText.textContent    = "";
  hintText.classList.remove("hint-error");
  translateHint.classList.add("hidden");

  stepMeaning.classList.add("hidden");
  stepWord.classList.remove("hidden");

  const newUrl = new URL(window.location.href);
  newUrl.searchParams.delete("word");
  history.replaceState(null, "", newUrl.toString());

  resetTags();
  hideStatus();
  saveBtn.disabled    = false;
  saveBtn.textContent = "Kelimeyi Ekle ✓";
  wordInput.focus();
}

/* ── YARDIMCI ── */
function showStatus(msg, type){
  statusMsg.textContent = msg;
  statusMsg.className   = `status-msg ${type}`;
  statusMsg.classList.remove("hidden");
}

function hideStatus(){
  statusMsg.classList.add("hidden");
  statusMsg.textContent = "";
  statusMsg.className   = "status-msg hidden";
}