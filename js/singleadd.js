import { auth, getWords, saveWord } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ── DOM ── */
const backBtn      = document.getElementById("backBtn");
const stepWord     = document.getElementById("stepWord");
const stepMeaning  = document.getElementById("stepMeaning");
const wordInput    = document.getElementById("wordInput");
const wordNextBtn  = document.getElementById("wordNextBtn");
const wordPreview  = document.getElementById("wordPreview");
const meaningInput = document.getElementById("meaningInput");
const saveBtn      = document.getElementById("saveBtn");
const statusMsg    = document.getElementById("statusMsg");

let currentUser = null;

/* ── AUTH ── */
onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

/* ── GERİ BUTONU ── */
backBtn.addEventListener("click", () => {
  window.location.href = "wordsadd.html";
});

/* ── URL'İ YAZARKEN GÜNCELLE (Google Translate tarzı) ── */
wordInput.addEventListener("input", () => {
  const val = wordInput.value.trim();

  if (val.length > 0) {
    // URL'yi güncelle — sayfa yenilenmez, sadece adres çubuğu değişir
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("word", val);
    history.replaceState(null, "", newUrl.toString());
  } else {
    // Kelime boşsa parametreyi temizle
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete("word");
    history.replaceState(null, "", newUrl.toString());
  }
});

/* ── SAYFA AÇILIRKEN URL'DEN KELİMEYİ OKU ── */
// Chrome extension veya başka bir yerden ?word=Hund ile açılırsa otomatik doldur
window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const prefilledWord = params.get("word");
  if (prefilledWord) {
    wordInput.value = prefilledWord;
  }
});

/* ── ADIM 1 → ADIM 2 GEÇİŞİ ── */
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

  // Kelimeyi önizleme olarak göster
  wordPreview.textContent = `"${word}"`;

  // Geçişi yap
  stepWord.classList.add("hidden");
  stepMeaning.classList.remove("hidden");
  hideStatus();
  meaningInput.focus();
}

/* ── KAYDET ── */
saveBtn.addEventListener("click", () => addWord());
meaningInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addWord();
});

async function addWord() {
  const word    = wordInput.value.trim();
  const meaning = meaningInput.value.trim();

  if (!meaning) {
    showStatus("Lütfen bir anlam gir.", "error");
    meaningInput.focus();
    return;
  }

  if (!currentUser) {
    showStatus("Oturum bulunamadı. Lütfen tekrar giriş yap.", "error");
    return;
  }

  // Buton kilitlensin, çift tıklama önlenir
  saveBtn.disabled = true;
  saveBtn.textContent = "Kontrol ediliyor…";

  try {
    /* Duplicate kontrolü */
    const existing = await getWords(currentUser.uid);
    const normalizedWord    = word.toLowerCase().trim();
    const normalizedMeaning = meaning.toLowerCase().trim();

    const duplicate = existing.find(
      (w) =>
        w.word.toLowerCase().trim()    === normalizedWord &&
        w.meaning.toLowerCase().trim() === normalizedMeaning
    );

    if (duplicate) {
      showStatus("⚠️ Bu kelime ve anlam zaten kayıtlı.", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = "Kelimeyi Ekle ✓";
      return;
    }

    /* Firebase'e kaydet */
    await saveWord(currentUser.uid, word, meaning);

    showStatus("✅ Kelime başarıyla eklendi!", "success");

    // Formu sıfırla — yeni kelime girilmesine izin ver
    setTimeout(() => {
      resetForm();
    }, 1800);

  } catch (err) {
    console.error(err);
    showStatus("Bir hata oluştu: " + err.message, "error");
    saveBtn.disabled = false;
    saveBtn.textContent = "Kelimeyi Ekle ✓";
  }
}

/* ── FORM SIFIRLA ── */
function resetForm() {
  wordInput.value    = "";
  meaningInput.value = "";
  wordPreview.textContent = "";

  stepMeaning.classList.add("hidden");
  stepWord.classList.remove("hidden");

  // URL'den word parametresini temizle
  const newUrl = new URL(window.location.href);
  newUrl.searchParams.delete("word");
  history.replaceState(null, "", newUrl.toString());

  hideStatus();
  saveBtn.disabled = false;
  saveBtn.textContent = "Kelimeyi Ekle ✓";
  wordInput.focus();
}

/* ── YARDIMCI: DURUM MESAJI ── */
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