import { saveWord } from "./firebase.js";

document.addEventListener("DOMContentLoaded", ()=>{

  const text = sessionStorage.getItem("savedText");
  const reader = document.getElementById("readerText");

  if(!text || text.trim().length < 1){
    reader.innerHTML = "<h2>Metin Bulunamadı</h2>";
    return;
  }

  loadText(text);
  createTranslateUI();

  document.getElementById("modalMeaningInput")
    .addEventListener("keydown", (e) => {
      if(e.key === "Enter") saveWordFromModal();
    });
});

function goBack(){
  const returnPage = sessionStorage.getItem("returnPage") || "metin.html";
  sessionStorage.removeItem("returnPage");
  window.location.href = returnPage;
}

let currentSize = 20;

function increaseFont(){
  currentSize += 2;
  document.getElementById("readerText").style.fontSize = currentSize + "px";
}

function decreaseFont(){
  currentSize = Math.max(12, currentSize - 2);
  document.getElementById("readerText").style.fontSize = currentSize + "px";
}

function toggleDark(){
  document.body.classList.toggle("light-mode");
}

const readerText = document.getElementById("readerText");

function loadText(text) {
  readerText.innerText = text;
}

window.goBack            = goBack;
window.increaseFont      = increaseFont;
window.decreaseFont      = decreaseFont;
window.toggleDark        = toggleDark;
window.openAddWordModal  = openAddWordModal;
window.closeAddWordModal = closeAddWordModal;
window.saveWordFromModal = saveWordFromModal;
window.closeMiniTranslate = closeMiniTranslate;


// =====================
// ÇEVIRI POPUP SİSTEMİ
// =====================

let selectedWordGlobal = "";

function createTranslateUI(){

  const btn = document.createElement("button");
  btn.id = "floatingMeaningBtn";
  btn.innerText = "💬 Anlam";
  btn.style.cssText = `
    display: none;
    position: absolute;
    z-index: 9999;
    padding: 6px 12px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  `;
  btn.onclick = openMiniTranslate;
  document.body.appendChild(btn);

  const popup = document.createElement("div");
  popup.id = "miniTranslatePopup";
  popup.style.cssText = `
    display: none;
    position: absolute;
    z-index: 9999;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 14px;
    min-width: 180px;
    max-width: 260px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    font-size: 14px;
    color: #1e293b;
  `;
  document.body.appendChild(popup);

  readerText.addEventListener("mouseup", function(){
    const selectionObj = window.getSelection();
    if(!selectionObj || selectionObj.rangeCount === 0){
      btn.style.display = "none";
      return;
    }
    let selection = selectionObj.toString().trim();
    selection = selection.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    if(selection.length === 0){
      btn.style.display = "none";
      return;
    }
    selectedWordGlobal = selection;
    const range = selectionObj.getRangeAt(0);
    const rect  = range.getBoundingClientRect();
    if(!rect || rect.width === 0){
      btn.style.display = "none";
      return;
    }
    popup.style.display = "none";
    btn.style.display   = "block";
    btn.style.top  = (window.scrollY + rect.bottom + 8) + "px";
    btn.style.left = (window.scrollX + rect.left) + "px";
  });

  document.addEventListener("mousedown", function(e){
    // Sol toolbar ve modalı mousedown istisnasına ekle
    // böylece "Kelime Ekle" butonuna basınca seçim kaybolmaz
    const leftToolbar    = document.querySelector(".left-toolbar");
    const wordModalOverlay = document.getElementById("wordModalOverlay");

    const clickedInside =
      readerText.contains(e.target)     ||
      btn.contains(e.target)            ||
      popup.contains(e.target)          ||
      (leftToolbar && leftToolbar.contains(e.target))  ||
      (wordModalOverlay && wordModalOverlay.contains(e.target));

    if(!clickedInside){
      btn.style.display   = "none";
      popup.style.display = "none";
      window.getSelection().removeAllRanges();
      selectedWordGlobal  = "";
    }
  });
}

// openMiniTranslate fonksiyonunu TAM OLARAK bununla değiştir:

function openMiniTranslate(){
  const btn   = document.getElementById("floatingMeaningBtn");
  const popup = document.getElementById("miniTranslatePopup");
  btn.style.display   = "none";
  popup.style.display = "block";
  popup.style.top  = btn.style.top;
  popup.style.left = btn.style.left;
  popup.innerHTML  = "⏳ Çevriliyor...";

  fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=tr&dt=t&q=${encodeURIComponent(selectedWordGlobal)}`)
    .then(res => res.json())
    .then(data => {
      const translated = data[0][0][0];
      // Çeviriyi global'e kaydet, saveWordFromPopup'ta kullanmak için
      window._lastTranslated = translated;

      popup.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-weight:700;color:#3b82f6;font-size:15px;">${selectedWordGlobal}</span>
          <button onclick="closeMiniTranslate()" style="background:none;border:none;cursor:pointer;font-size:16px;color:#94a3b8;">✕</button>
        </div>
        <div style="color:#334155;margin-bottom:10px;">${translated}</div>
        <button 
          id="popupSaveBtn"
          onclick="saveWordFromPopup()"
          style="
            width:100%;
            padding:7px 0;
            background:#3b82f6;
            color:white;
            border:none;
            border-radius:8px;
            font-size:13px;
            font-weight:600;
            cursor:pointer;
            transition:0.2s;
          "
        >➕ Sözlüğe Ekle</button>
      `;
    })
    .catch(() => {
      popup.innerHTML = `<span style="color:red;">Çeviri başarısız oldu.</span>`;
    });
}


// Bu yeni fonksiyonu da ekle (saveWordFromModal'ın hemen altına):

async function saveWordFromPopup(){
  const word    = selectedWordGlobal;
  const meaning = window._lastTranslated;

  if(!word || !meaning){
    showToast("❌ Kelime veya çeviri bulunamadı.", true);
    return;
  }

  const btn = document.getElementById("popupSaveBtn");
  if(btn){
    btn.disabled     = true;
    btn.textContent  = "Kaydediliyor...";
  }

  try {
    const userId = window.getUserId();
    if(!userId) throw new Error("Oturum yok");

    await saveWord(userId, word, meaning);
    closeMiniTranslate();
    selectedWordGlobal       = "";
    window._lastTranslated   = "";
    showToast("✅ Kelime kaydedildi!");

  } catch(err){
    console.error("Kelime kayıt hatası:", err);
    showToast("❌ Kayıt başarısız.", true);
    if(btn){
      btn.disabled    = false;
      btn.textContent = "➕ Sözlüğe Ekle";
    }
  }
}

// window'a da ekle (dosyanın sonundaki window.xxx = xxx bloğuna):
window.saveWordFromPopup = saveWordFromPopup;

function closeMiniTranslate(){
  document.getElementById("miniTranslatePopup").style.display = "none";
  selectedWordGlobal = "";
}


// =====================
// KELİME EKLEME
// =====================

function openAddWordModal(){
  if(!selectedWordGlobal){
    alert("Önce metinden bir kelime seç.");
    return;
  }
  document.getElementById("modalWordDisplay").textContent = selectedWordGlobal;
  document.getElementById("modalMeaningInput").value      = "";
  document.getElementById("wordModalOverlay").classList.add("active");
  setTimeout(() => document.getElementById("modalMeaningInput").focus(), 100);
}

function closeAddWordModal(){
  document.getElementById("wordModalOverlay").classList.remove("active");
}

async function saveWordFromModal(){
  const meaning = document.getElementById("modalMeaningInput").value.trim();
  if(!meaning){
    document.getElementById("modalMeaningInput").focus();
    return;
  }

  const saveBtn = document.querySelector(".word-modal-save");
  saveBtn.disabled    = true;
  saveBtn.textContent = "Kaydediliyor...";

  try {
    const userId = window.getUserId();
    if(!userId) throw new Error("Oturum yok");

    await saveWord(userId, selectedWordGlobal, meaning);

    closeAddWordModal();
    selectedWordGlobal = "";
    showToast("✅ Kelime kaydedildi!");

  } catch(err) {
    console.error("Kelime kayıt hatası:", err);
    showToast("❌ Kayıt başarısız.", true);
  } finally {
    saveBtn.disabled    = false;
    saveBtn.textContent = "Kaydet ✓";
  }
}

function showToast(msg, isError = false){
  const toast = document.createElement("div");
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: ${isError ? "#ef4444" : "#22c55e"};
    color: white;
    padding: 10px 22px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    z-index: 99999;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}