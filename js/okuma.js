document.addEventListener("DOMContentLoaded", ()=>{

  const text = localStorage.getItem("savedText");
  const reader = document.getElementById("readerText");

  if(!text || text.trim().length < 10){
    reader.innerHTML = "<h2>Metin Bulunamadı</h2>";
    return;
  }

  loadText(text);
});

function goBack(){
  window.location.href = "metin.html";
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

document.addEventListener("mouseup", function(e){

  const selectedText = window.getSelection().toString().trim();

  // Eğer seçim yoksa butonu kaldır
  if(selectedText.length === 0){
    removeMeaningButton();
    return;
  }

  showMeaningButton(e.pageX, e.pageY, selectedText);
});


function showMeaningButton(x, y, word){

  removeMeaningButton(); // varsa eskiyi sil

  const button = document.createElement("button");
  button.id = "meaningBtn";
  button.textContent = "Anlamına Bak";

  button.style.position = "absolute";
  button.style.top = y + "px";
  button.style.left = x + "px";
  button.style.zIndex = 999;
  button.style.padding = "6px 10px";
  button.style.cursor = "pointer";

  button.onclick = function(e){

    e.stopPropagation(); // click event zincirini durdur
    removeMeaningButton(); // ÖNCE buton silinsin

    showTranslationPopup(word, x, y);

    window.getSelection().removeAllRanges();
  };

  document.body.appendChild(button);
}


function removeMeaningButton(){
  const oldBtn = document.getElementById("meaningBtn");
  if(oldBtn) oldBtn.remove();
}
async function translateWord(word){

  const cleanWord = word.replace(/[.,!?]/g, "");

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=tr&dt=t&q=${encodeURIComponent(cleanWord)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    const meaning = data[0][0][0];

    alert(cleanWord + " = " + meaning);

  } catch (error) {
    console.log("Çeviri hatası:", error);
  }
}
document.addEventListener("mouseup", function(e){

  const selectedText = window.getSelection().toString().trim();

  if(selectedText.length === 0){
    removeMeaningButton();
    return;
  }

  showMeaningButton(e.pageX, e.pageY, selectedText);
});
function showMeaningButton(x, y, word){

  removeMeaningButton();

  const button = document.createElement("button");
  button.id = "meaningBtn";
  button.textContent = "Anlamına Bak";

  button.style.position = "absolute";
  button.style.top = y + "px";
  button.style.left = x + "px";
  button.style.zIndex = 999;
  button.style.padding = "6px 12px";
  button.style.borderRadius = "8px";
  button.style.border = "none";
  button.style.cursor = "pointer";

  button.onclick = function(){
    showTranslationPopup(word, x, y);
    removeMeaningButton();
    window.getSelection().removeAllRanges();
  };

  document.body.appendChild(button);
}

function removeMeaningButton(){
  const oldBtn = document.getElementById("meaningBtn");
  if(oldBtn) oldBtn.remove();
}
async function showTranslationPopup(word, x, y){

  removeMeaningButton();
  removePopup();

  const cleanWord = word.replace(/[.,!?]/g, "");

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=tr&dt=t&q=${encodeURIComponent(cleanWord)}`;

  try{
    const response = await fetch(url);
    const data = await response.json();
    const meaning = data[0][0][0];

    const popup = document.createElement("div");
    popup.id = "translationPopup";

    popup.style.position = "absolute";
    popup.style.top = (y + 10) + "px";
    popup.style.left = x + "px";
    popup.style.zIndex = 1000;
    popup.style.background = "white";
    popup.style.padding = "15px";
    popup.style.borderRadius = "12px";
    popup.style.boxShadow = "0 5px 15px rgba(0,0,0,0.2)";
    popup.style.minWidth = "200px";

    popup.innerHTML = `
      <div style="font-weight:600; margin-bottom:8px;">${cleanWord}</div>
      <div style="margin-bottom:12px;">${meaning}</div>
      <button id="addToDictionaryBtn"
        style="padding:6px 10px;border:none;border-radius:8px;cursor:pointer;">
        Sözlüğe Ekle
      </button>
    `;

    document.body.appendChild(popup);

    document.getElementById("addToDictionaryBtn").onclick = function(e){
      e.stopPropagation();
      alert("Henüz aktif değil 🙂");
    };

    // ⚠️ ÖNEMLİ: Popup açıldıktan SONRA click listener ekliyoruz
    setTimeout(() => {
      document.addEventListener("click", function closePopup(event){
        if(!popup.contains(event.target)){
          popup.remove();
          document.removeEventListener("click", closePopup);
        }
      });
    }, 0);

  }catch(error){
    console.log("Çeviri hatası:", error);
  }
}

function removePopup(){
  const oldPopup = document.getElementById("translationPopup");
  if(oldPopup) oldPopup.remove();
}