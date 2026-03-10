document.addEventListener("DOMContentLoaded", () => {

  const newTextBtn    = document.getElementById("newTextBtn");
  const gecmisBtn     = document.getElementById("gecmisBtn");
  const kelimelerBtn  = document.getElementById("kelimelerBtn");
  const kelimeEkleBtn = document.getElementById("kelimeEkleBtn");
  const artikelBtn    = document.getElementById("artikelBtn");
  const cumlebulBtn   = document.getElementById("cumlebulBtn");
  const sponsorBtn    = document.getElementById("sponsorBtn");
  const quizBtn = document.getElementById("quizBtn");
  
  if (quizBtn) quizBtn.addEventListener("click", () => window.location.href = "../quiz/");
  if (newTextBtn)    newTextBtn.addEventListener("click",    () => window.location.href = "../metin/");
  if (gecmisBtn)     gecmisBtn.addEventListener("click",     () => window.location.href = "../gecmis/");
  if (kelimelerBtn)  kelimelerBtn.addEventListener("click",  () => window.location.href = "../kelimeler/");
  if (kelimeEkleBtn) kelimeEkleBtn.addEventListener("click", () => window.location.href = "../wordsadd/");
  if (artikelBtn)    artikelBtn.addEventListener("click",    () => window.location.href = "../artikel/");
  if (cumlebulBtn)   cumlebulBtn.addEventListener("click",   () => window.location.href = "../cumlebul/");
  if (sponsorBtn)    sponsorBtn.addEventListener("click",    () => window.location.href = "../sponsorlar/");

});