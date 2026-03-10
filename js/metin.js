import { saveMetin, onAuthChange } from "./firebase.js";

document.addEventListener("DOMContentLoaded", () => {

  const editor  = document.getElementById("textArea");
  const readBtn = document.getElementById("goReadBtn");

  if(!editor) return;

  // ✅ Extension'dan gelen ?text= parametresini oku
  const urlParams = new URLSearchParams(window.location.search);
  const urlText   = urlParams.get('text');
  if (urlText && urlText.trim().length > 0) {
    editor.innerText = urlText.trim();
    window.history.replaceState({}, '', window.location.pathname);
  } else {
    // Okuma sayfasından geri dönüldüyse metni geri yükle
    const savedText = sessionStorage.getItem("savedText");
    if (savedText) { editor.innerText = savedText; }
  }

  editor.addEventListener("paste", (e) => {
    e.preventDefault();
    const text    = (e.clipboardData || window.clipboardData).getData("text");
    const cleaned = text.replace(/\s+/g, " ").trim();
    document.execCommand("insertText", false, cleaned);
  });

  if(readBtn){
    readBtn.addEventListener("click", async () => {

      const text = editor.innerText.trim();

      if(text.length < 1){
        alert("Metin boş!");
        return;
      }

      const userId = window.getUserId();
      if(!userId){
        alert("Oturum bulunamadı, lütfen tekrar giriş yapın.");
        window.location.href = "../";
        return;
      }

      try{
        await saveMetin(userId, text);
      }catch(err){
        console.error("Kayıt hatası:", err);
      }

      // ✅ metin.html'den gelindi bilgisini yaz
      sessionStorage.setItem("savedText", text);
      sessionStorage.setItem("returnPage", "metin.html");
      window.location.href = "../okuma/";
    });
  }
});