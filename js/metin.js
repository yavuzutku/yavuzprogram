document.addEventListener("DOMContentLoaded", () => {
    const readBtn = document.getElementById("goReadBtn");

        if(readBtn){
        readBtn.addEventListener("click", ()=>{

            const text = document.getElementById("textArea").innerText.trim();

            if(text.length < 10){
            alert("Metin boş! Önce metin ekle.");
            return;
            }

            localStorage.setItem("savedText", text);

            window.location.href = "okuma.html";
        });
    }
});