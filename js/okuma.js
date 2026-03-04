document.addEventListener("DOMContentLoaded", ()=>{

  const text = sessionStorage.getItem("savedText");
  const reader = document.getElementById("readerText");

  if(!text || text.trim().length < 10){
    reader.innerHTML = "<h2>Metin Bulunamadı</h2>";
    return;
  }

  loadText(text);
  createTranslateUI();
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

  readerText.addEventListener("mouseup", function(e){
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
    const rect = range.getBoundingClientRect();
    if(!rect || rect.width === 0){
      btn.style.display = "none";
      return;
    }
    popup.style.display = "none";
    btn.style.display = "block";
    btn.style.top  = (window.scrollY + rect.bottom + 8) + "px";
    btn.style.left = (window.scrollX + rect.left) + "px";
  });

  document.addEventListener("mousedown", function(e){
    if(
      !readerText.contains(e.target) &&
      !btn.contains(e.target) &&
      !popup.contains(e.target)
    ){
      btn.style.display   = "none";
      popup.style.display = "none";
      window.getSelection().removeAllRanges();
      selectedWordGlobal = "";
    }
  });
}

function openMiniTranslate(){
  const btn   = document.getElementById("floatingMeaningBtn");
  const popup = document.getElementById("miniTranslatePopup");
  btn.style.display = "none";
  popup.style.display = "block";
  popup.style.top  = btn.style.top;
  popup.style.left = btn.style.left;
  popup.innerHTML  = "⏳ Çevriliyor...";
  fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=tr&dt=t&q=${encodeURIComponent(selectedWordGlobal)}`)
    .then(res => res.json())
    .then(data => {
      const translated = data[0][0][0];
      popup.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-weight:700; color:#3b82f6; font-size:15px;">${selectedWordGlobal}</span>
          <button onclick="closeMiniTranslate()" style="background:none;border:none;cursor:pointer;font-size:16px;color:#94a3b8;">✕</button>
        </div>
        <div style="color:#334155;">${translated}</div>
      `;
    })
    .catch(() => {
      popup.innerHTML = `<span style="color:red;">Çeviri başarısız oldu.</span>`;
    });
}

function closeMiniTranslate(){
  document.getElementById("miniTranslatePopup").style.display = "none";
  selectedWordGlobal = "";
}