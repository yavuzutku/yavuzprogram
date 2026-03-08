import { getWords, deleteWord, updateWord, onAuthChange } from "./firebase.js";

let allWords        = [];
let activeTagFilter = null; // null = Tümü

document.addEventListener("DOMContentLoaded", () => {

  const wordList       = document.getElementById("wordList");
  const emptyState     = document.getElementById("emptyState");
  const wordCountBadge = document.getElementById("wordCountBadge");
  const searchInput    = document.getElementById("searchInput");
  const filterBar      = document.getElementById("filterBar");

  onAuthChange(async (user) => {
    if(user){
      await loadWords(user.uid);
    }
  });

  async function loadWords(userId){
    wordCountBadge.textContent = "Yükleniyor...";
    allWords = await getWords(userId);
    buildFilterBar();
    renderFiltered();
  }

  // =====================
  // FİLTRE BAR
  // =====================

  function buildFilterBar(){
    // Tüm kelimelerdeki unique tag'leri topla
    const tagSet = new Set();
    allWords.forEach(w => {
      if(Array.isArray(w.tags)) w.tags.forEach(t => tagSet.add(t));
    });

    filterBar.innerHTML = "";

    // Eğer hiç tag yoksa bar'ı gizle
    if(tagSet.size === 0){
      filterBar.style.display = "none";
      return;
    }
    filterBar.style.display = "flex";

    // "Tümü" chip
    const allChip = document.createElement("button");
    allChip.className = "filter-chip" + (activeTagFilter === null ? " active" : "");
    allChip.textContent = "Tümü";
    allChip.addEventListener("click", () => {
      activeTagFilter = null;
      buildFilterBar();
      renderFiltered();
    });
    filterBar.appendChild(allChip);

    // Her tag için chip
    tagSet.forEach(tag => {
      const chip = document.createElement("button");
      chip.className = "filter-chip" + (activeTagFilter === tag ? " active" : "");
      chip.textContent = tag;
      chip.addEventListener("click", () => {
        activeTagFilter = (activeTagFilter === tag) ? null : tag;
        buildFilterBar();
        renderFiltered();
      });
      filterBar.appendChild(chip);
    });
  }

  function renderFiltered(){
    const q = searchInput.value.toLowerCase();

    let list = allWords;

    // Tag filtresi
    if(activeTagFilter){
      list = list.filter(w =>
        Array.isArray(w.tags) && w.tags.includes(activeTagFilter)
      );
    }

    // Arama filtresi
    if(q){
      list = list.filter(w =>
        w.word.toLowerCase().includes(q) ||
        w.meaning.toLowerCase().includes(q)
      );
    }

    render(list);
  }

  // =====================
  // RENDER
  // =====================

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

      // Tag rozetleri
      const tagsHTML = (Array.isArray(item.tags) && item.tags.length > 0)
        ? `<div class="word-tags">${item.tags.map(t => `<span class="word-tag-badge">${t}</span>`).join("")}</div>`
        : "";

      card.innerHTML = `
        <div class="word-left">
          <div class="word-german">${item.word}</div>
          <div class="word-turkish">${item.meaning}</div>
          ${tagsHTML}
          <div class="word-date">${formatDate(item.date)}</div>
        </div>
        <div class="word-right">
          <button class="word-delete-btn" data-id="${item.id}">🗑 Sil</button>
          <button class="word-edit-btn"   data-id="${item.id}">✏️ Düzenle</button>
        </div>
      `;

      // SİL
      card.querySelector(".word-delete-btn").addEventListener("click", async () => {
        const userId = window.getUserId();
        if(!userId) return;
        if(!confirm(`"${item.word}" silinsin mi?`)) return;
        await deleteWord(userId, item.id);
        allWords = allWords.filter(w => w.id !== item.id);
        buildFilterBar();
        renderFiltered();
      });

      // DÜZENLE
      card.querySelector(".word-edit-btn").addEventListener("click", () => {
        const userId = window.getUserId();
        if(!userId) return;
        openEditModal(userId, item);
      });

      wordList.appendChild(card);
    });
  }

  // =====================
  // DÜZENLEME MODALİ
  // =====================

  const TAG_OPTIONS = ["fiil","isim","sıfat","zarf","B1","B2","seyahat","iş"];

  function openEditModal(userId, item){
    // Eski modal varsa temizle
    document.getElementById("editModalOverlay")?.remove();

    const currentTags = Array.isArray(item.tags) ? [...item.tags] : [];

    const chipsHTML = TAG_OPTIONS.map(tag => {
      const sel = currentTags.includes(tag);
      return `<button
        type="button"
        class="tag-chip${sel ? " selected" : ""}"
        data-tag="${tag}"
      >${tag}</button>`;
    }).join("");

    const overlay = document.createElement("div");
    overlay.id = "editModalOverlay";
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.65);
      backdrop-filter:blur(4px);z-index:10000;
      display:flex;align-items:center;justify-content:center;
    `;
    overlay.innerHTML = `
      <div style="
        background:#1a1a26;border:1px solid rgba(201,168,76,0.3);
        border-radius:20px;padding:28px 32px;width:360px;max-width:90vw;
        box-shadow:0 24px 60px rgba(0,0,0,0.7);
        animation: modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1);
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <span style="font-size:16px;font-weight:600;color:#c9a84c;">✏️ Kelimeyi Düzenle</span>
          <button id="editModalClose" style="background:none;border:none;color:#666;font-size:18px;cursor:pointer;">✕</button>
        </div>

        <label style="font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Kelime</label>
        <input id="editWordInput" value="${item.word}" style="
          width:100%;box-sizing:border-box;margin:6px 0 14px;
          background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
          border-radius:10px;color:white;font-size:15px;font-family:inherit;
          padding:11px 14px;outline:none;transition:0.2s;
        "/>

        <label style="font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Anlam</label>
        <input id="editMeaningInput" value="${item.meaning}" style="
          width:100%;box-sizing:border-box;margin:6px 0 14px;
          background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
          border-radius:10px;color:white;font-size:15px;font-family:inherit;
          padding:11px 14px;outline:none;transition:0.2s;
        "/>

        <label style="font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Etiketler</label>
        <div id="editTagChips" style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 20px;">
          ${chipsHTML}
        </div>

        <div style="display:flex;gap:10px;">
          <button id="editCancelBtn" style="
            flex:1;padding:11px;background:rgba(255,255,255,0.05);
            border:1px solid rgba(255,255,255,0.1);border-radius:10px;
            color:#aaa;font-size:14px;font-family:inherit;cursor:pointer;transition:0.2s;
          ">İptal</button>
          <button id="editSaveBtn" style="
            flex:2;padding:11px;background:#c9a84c;border:none;
            border-radius:10px;color:#0a0a0f;font-size:14px;font-weight:700;
            font-family:inherit;cursor:pointer;transition:0.2s;
          ">Kaydet ✓</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Tag chip toggle
    overlay.querySelectorAll("#editTagChips .tag-chip").forEach(chip => {
      chip.addEventListener("click", () => chip.classList.toggle("selected"));
    });

    const close = () => overlay.remove();
    overlay.querySelector("#editModalClose").addEventListener("click", close);
    overlay.querySelector("#editCancelBtn").addEventListener("click", close);
    overlay.addEventListener("click", e => { if(e.target === overlay) close(); });

    overlay.querySelector("#editSaveBtn").addEventListener("click", async () => {
      const newWord    = overlay.querySelector("#editWordInput").value.trim();
      const newMeaning = overlay.querySelector("#editMeaningInput").value.trim();
      if(!newWord || !newMeaning) return;

      const newTags = [...overlay.querySelectorAll("#editTagChips .tag-chip.selected")]
        .map(c => c.dataset.tag);

      const saveBtn = overlay.querySelector("#editSaveBtn");
      saveBtn.disabled    = true;
      saveBtn.textContent = "Kaydediliyor...";

      await updateWord(userId, item.id, {
        word:    newWord,
        meaning: newMeaning,
        tags:    newTags
      });

      item.word    = newWord;
      item.meaning = newMeaning;
      item.tags    = newTags;

      close();
      buildFilterBar();
      renderFiltered();
    });
  }

  // =====================
  // ARAMA
  // =====================

  searchInput.addEventListener("input", renderFiltered);

  function formatDate(iso){
    if(!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit", month: "long", year: "numeric"
    });
  }
});