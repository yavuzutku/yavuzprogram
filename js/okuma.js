document.addEventListener("DOMContentLoaded", ()=>{

  const text = localStorage.getItem("savedText");
  const reader = document.getElementById("readerText");

  if(!text || text.trim().length < 10){
    reader.innerHTML = "<h2>Metin Bulunamadı</h2>";
    return;
  }

  reader.innerText = text;

  initReaderControls();
});

function goBack(){
  window.location.href = "metin.html";
}

/* =========================
   READER CONTROLS
========================= */

function initReaderControls(){

  createToolbar();
}

/* Toolbar Oluştur */

function createToolbar(){

  const toolbar = document.createElement("div");
  toolbar.className = "reader-toolbar";

  toolbar.innerHTML = `
    <button onclick="increaseFont()">A+</button>
    <button onclick="decreaseFont()">A-</button>

    <button onclick="toggleDark()">🌙</button>

    <button onclick="alignLeft()">⬅</button>
    <button onclick="alignCenter()">⬜</button>

    <button onclick="changeFont()">Font</button>
  `;

  document.body.appendChild(toolbar);
}

/* =========================
   FONT SIZE
========================= */

let currentSize = 20;

function increaseFont(){
  currentSize += 2;
  document.getElementById("readerText").style.fontSize = currentSize + "px";
}

function decreaseFont(){
  currentSize -= 2;
  document.getElementById("readerText").style.fontSize = currentSize + "px";
}

/* =========================
   ALIGN
========================= */

function alignLeft(){
  document.getElementById("readerText").style.textAlign = "left";
}

function alignCenter(){
  document.getElementById("readerText").style.textAlign = "center";
}

/* =========================
   DARK MODE
========================= */

function toggleDark(){
  document.body.classList.toggle("light-mode");
}

/* =========================
   FONT CHANGE
========================= */

function changeFont(){

  const fonts = ["Inter","Georgia","Roboto","Playfair Display"];

  let random = fonts[Math.floor(Math.random()*fonts.length)];

  document.getElementById("readerText").style.fontFamily = random;
}