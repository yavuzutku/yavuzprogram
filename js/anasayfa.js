document.addEventListener("DOMContentLoaded", () => {

  const newTextBtn    = document.getElementById("newTextBtn");
  const gecmisBtn     = document.getElementById("gecmisBtn");
  const kelimelerBtn  = document.getElementById("kelimelerBtn");
  const kelimeEkleBtn = document.getElementById("kelimeEkleBtn");

  if (newTextBtn) {
    newTextBtn.addEventListener("click", () => {
      window.location.href = "metin.html";
    });
  }

  if (gecmisBtn) {
    gecmisBtn.addEventListener("click", () => {
      window.location.href = "gecmis.html";
    });
  }

  if (kelimelerBtn) {
    kelimelerBtn.addEventListener("click", () => {
      window.location.href = "kelimeler.html";
    });
  }

  if (kelimeEkleBtn) {
    kelimeEkleBtn.addEventListener("click", () => {
      window.location.href = "wordsadd.html";
    });
  }

});