/* =============================================
   Anasayfa UI
   ============================================= */

document.addEventListener("DOMContentLoaded", () => {

  const newTextBtn = document.getElementById("newTextBtn");
  const gecmisBtn  = document.getElementById("gecmisBtn");

  // logoutBtn artık loadNavbar() tarafından oluşturuluyor,
  // burada tekrar dinlemeye gerek yok

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

});