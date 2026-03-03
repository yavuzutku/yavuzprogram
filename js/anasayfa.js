document.addEventListener("DOMContentLoaded", ()=>{

  const logoutBtn = document.getElementById("logoutBtn");
  const newTextBtn = document.getElementById("newTextBtn");

  logoutBtn.addEventListener("click", ()=>{
    localStorage.removeItem("userToken");
    window.location.href = "index.html";
  });

  newTextBtn.addEventListener("click", ()=>{
    window.location.href = "metin.html";
  });

});