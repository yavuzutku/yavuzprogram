function format(cmd){
  document.execCommand(cmd,false,null);
}

function changeFont(font){
  document.execCommand("fontName", false, font);
}

function changeColor(color){
  document.execCommand("foreColor", false, color);
}

function highlight(color){
  document.execCommand("hiliteColor", false, color);
}

function alignText(alignment){
  document.execCommand(
    "justify" + alignment.charAt(0).toUpperCase() + alignment.slice(1)
  );
}

function changeSize(dir){
  let area = document.getElementById("textArea");
  let size = window.getComputedStyle(area).fontSize;
  size = parseFloat(size);
  area.style.fontSize = (size + dir*2) + "px";
}

/* EVENT BAĞLAMA (Inline onclick kullanmıyoruz artık) */

document.addEventListener("DOMContentLoaded", () => {

  document.querySelectorAll("[data-cmd]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      format(btn.dataset.cmd);
    });
  });

  document.querySelectorAll("[data-align]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      alignText(btn.dataset.align);
    });
  });

  document.getElementById("fontSelector")
    .addEventListener("change", e=>{
      changeFont(e.target.value);
    });

  document.getElementById("textColor")
    .addEventListener("change", e=>{
      changeColor(e.target.value);
    });

  document.getElementById("highlightColor")
    .addEventListener("change", e=>{
      highlight(e.target.value);
    });

  document.getElementById("increaseSize")
    .addEventListener("click", ()=> changeSize(1));

  document.getElementById("decreaseSize")
    .addEventListener("click", ()=> changeSize(-1));

});