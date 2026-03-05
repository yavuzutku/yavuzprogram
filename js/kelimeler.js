import { getWords, deleteWord, onAuthChange} from "./firebase.js";

let allWords = [];

document.addEventListener("DOMContentLoaded", () => {

  const wordList       = document.getElementById("wordList");
  const emptyState     = document.getElementById("emptyState");
  const wordCountBadge = document.getElementById("wordCountBadge");
  const searchInput    = document.getElementById("searchInput");

  onAuthChange(async (user) => {
    if(user){
      await loadWords(user.uid);
    }
  });

  async function loadWords(userId){
    wordCountBadge.textContent = "Yükleniyor...";
    allWords = await getWords(userId);
    render(allWords);
  }

  function render(list){

    [...wordList.querySelectorAll(".word-card")].forEach(el => el.remove());

    wordCountBadge.textContent = allWords.length + " kelime";

    if(list.length === 0){
      emptyState.style.display = "block";
      return;
    }
    emptyState.style.display = "none";

    list.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "word-card";
      card.style.animationDelay = (idx * 30) + "ms";
      card.innerHTML = `
        <div class="word-left">
          <div class="word-german">${item.word}</div>
          <div class="word-turkish">${item.meaning}</div>
          <div class="word-date">${formatDate(item.date)}</div>
        </div>
        <div class="word-right">
          <button class="word-delete-btn" data-id="${item.id}">🗑 Sil</button>
          <button class="word-edit-btn" data-id="${item.id}">✏️ Düzenle</button>

        </div>
      `;

      card.querySelector(".word-delete-btn").addEventListener("click", async () => {
        const userId = window.getUserId();
        if(!userId) return;
        if(!confirm(`"${item.word}" silinsin mi?`)) return;

        await deleteWord(userId, item.id);
        allWords = allWords.filter(w => w.id !== item.id);
        render(allWords);
      });
      card.querySelector(".word-edit-btn").addEventListener("click", () => {
        const userId = window.getUserId();
        if (!userId) return;

        const newWord    = prompt("Yeni kelime:", item.word);
        if (newWord === null) return;
        const newMeaning = prompt("Yeni anlam:", item.meaning);
        if (newMeaning === null) return;

        import("./firebase.js").then(({ updateWord }) => {
          updateWord(userId, item.id, {
            word: newWord.trim(),
            meaning: newMeaning.trim()
          }).then(() => {
            item.word    = newWord.trim();
            item.meaning = newMeaning.trim();
            render(allWords);
          });
        });
      });
      wordList.appendChild(card);
    });
  }

  function formatDate(iso){
    if(!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit", month: "long", year: "numeric"
    });
  }

  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allWords.filter(w =>
      w.word.toLowerCase().includes(q) ||
      w.meaning.toLowerCase().includes(q)
    );
    render(filtered);
  });
});