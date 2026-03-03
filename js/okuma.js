document.addEventListener("DOMContentLoaded", ()=>{

  const text = localStorage.getItem("savedText");
  const reader = document.getElementById("readerText");

  if(!text || text.trim().length < 10){
    reader.innerHTML = "<h2>Metin Bulunamadı</h2>";
    return;
  }

  reader.innerText = text;
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
  currentSize -= 2;
  document.getElementById("readerText").style.fontSize = currentSize + "px";
}

function toggleDark(){
  document.body.classList.toggle("light-mode");
}

function alignLeft(){
  document.getElementById("readerText").style.textAlign = "left";
}

function alignCenter(){
  document.getElementById("readerText").style.textAlign = "center";
}

function changeFont(){
  const fonts = ["Inter","Georgia","Roboto","Playfair Display"];
  const random = fonts[Math.floor(Math.random()*fonts.length)];
  document.getElementById("readerText").style.fontFamily = random;
}