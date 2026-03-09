import { getWords, deleteWord, updateWord, onAuthChange } from "./firebase.js";
import { renderTagChips, getSelectedTags, extractAllTags } from "./tag.js";

let allWords        = [];
let activeTagFilter = null;
let isRequestInProgress = false; // dosyanın en üstüne ekle
document.addEventListener("DOMContentLoaded", () => {

  const wordList       = document.getElementById("wordList");
  const emptyState     = document.getElementById("emptyState");
  const wordCountBadge = document.getElementById("wordCountBadge");
  const searchInput    = document.getElementById("searchInput");
  const filterTagList  = document.getElementById("filterTagList");

  onAuthChange(async (user) => {
    if(user) await loadWords(user.uid);
  });

  async function loadWords(userId){
    wordCountBadge.textContent = "Yükleniyor...";
    allWords = await getWords(userId);
    buildFilterSidebar();
    renderFiltered();
  }

  // =====================
  // FİLTRE SIDEBAR
  // =====================

  function buildFilterSidebar(){
    const tagMap = new Map();
    allWords.forEach(w => {
      if(Array.isArray(w.tags)){
        w.tags.forEach(t => tagMap.set(t, (tagMap.get(t) || 0) + 1));
      }
    });

    filterTagList.innerHTML = "";

    const allItem = document.createElement("button");
    allItem.className = "filter-tag-item all-item" + (activeTagFilter === null ? " active" : "");
    allItem.innerHTML = `
      <span>Tüm Kelimeler</span>
      <span class="filter-count-badge">${allWords.length}</span>
    `;
    allItem.addEventListener("click", () => {
      activeTagFilter = null;
      buildFilterSidebar();
      renderFiltered();
    });
    filterTagList.appendChild(allItem);

    if(tagMap.size > 0){
      const sorted = [...tagMap.entries()].sort((a, b) => b[1] - a[1]);
      sorted.forEach(([tag, count]) => {
        const item = document.createElement("button");
        item.className = "filter-tag-item" + (activeTagFilter === tag ? " active" : "");
        item.innerHTML = `<span>${tag}</span><span class="filter-count-badge">${count}</span>`;
        item.addEventListener("click", () => {
          activeTagFilter = (activeTagFilter === tag) ? null : tag;
          buildFilterSidebar();
          renderFiltered();
        });
        filterTagList.appendChild(item);
      });
    }

    const untagged = allWords.filter(w => !Array.isArray(w.tags) || w.tags.length === 0).length;
    if(untagged > 0){
      const sep = document.createElement("div");
      sep.style.cssText = "margin:10px 0 6px;border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;";
      const untaggedItem = document.createElement("button");
      untaggedItem.className = "filter-tag-item" + (activeTagFilter === "__untagged__" ? " active" : "");
      untaggedItem.innerHTML = `<span>Etiketsiz</span><span class="filter-count-badge">${untagged}</span>`;
      untaggedItem.addEventListener("click", () => {
        activeTagFilter = (activeTagFilter === "__untagged__") ? null : "__untagged__";
        buildFilterSidebar();
        renderFiltered();
      });
      filterTagList.appendChild(sep);
      filterTagList.appendChild(untaggedItem);
    }
  }

  function renderFiltered(){
    const q = searchInput.value.toLowerCase();
    let list = allWords;

    if(activeTagFilter === "__untagged__"){
      list = list.filter(w => !Array.isArray(w.tags) || w.tags.length === 0);
    } else if(activeTagFilter){
      list = list.filter(w => Array.isArray(w.tags) && w.tags.includes(activeTagFilter));
    }

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

      const hasTags = Array.isArray(item.tags) && item.tags.length > 0;
      const tagsHTML = `
        <div class="word-tags">
          ${hasTags ? item.tags.map(t => `<span class="word-tag-badge">${t}</span>`).join("") : ""}
          <button class="add-tag-inline" data-id="${item.id}">
            ${hasTags ? "+ etiket" : "+ etiket ekle"}
          </button>
        </div>
      `;

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
      // word-german'a tıklayınca örnek cümleler
      card.querySelector(".word-german").style.cursor = "pointer";
      card.querySelector(".word-german").addEventListener("click", (e) => {
        e.stopPropagation();
        openExampleModal(item.word, item.meaning);
      });
      card.querySelector(".add-tag-inline").addEventListener("click", () => {
        const userId = window.getUserId();
        if(!userId) return;
        openEditModal(userId, item, true);
      });

      card.querySelector(".word-delete-btn").addEventListener("click", async () => {
        const userId = window.getUserId();
        if(!userId) return;
        if(!confirm(`"${item.word}" silinsin mi?`)) return;
        await deleteWord(userId, item.id);
        allWords = allWords.filter(w => w.id !== item.id);
        buildFilterSidebar();
        renderFiltered();
      });

      card.querySelector(".word-edit-btn").addEventListener("click", () => {
        const userId = window.getUserId();
        if(!userId) return;
        openEditModal(userId, item, false);
      });

      wordList.appendChild(card);
    });
  }

  // =====================
  // DÜZENLEME MODALİ
  // =====================

  function openEditModal(userId, item, tagFocused = false){
    document.getElementById("editModalOverlay")?.remove();

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
        border-radius:20px;padding:28px 32px;width:380px;max-width:90vw;
        box-shadow:0 24px 60px rgba(0,0,0,0.7);
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <span style="font-size:16px;font-weight:600;color:#c9a84c;">
            ${tagFocused ? "🏷️ Etiket Ekle" : "✏️ Kelimeyi Düzenle"}
          </span>
          <button id="editModalClose" style="background:none;border:none;color:#666;font-size:18px;cursor:pointer;">✕</button>
        </div>

        ${!tagFocused ? `
          <label style="font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Kelime</label>
          <input id="editWordInput" value="${item.word}" style="
            width:100%;box-sizing:border-box;margin:6px 0 14px;
            background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
            border-radius:10px;color:white;font-size:15px;font-family:inherit;
            padding:11px 14px;outline:none;
          "/>
          <label style="font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Anlam</label>
          <input id="editMeaningInput" value="${item.meaning}" style="
            width:100%;box-sizing:border-box;margin:6px 0 14px;
            background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
            border-radius:10px;color:white;font-size:15px;font-family:inherit;
            padding:11px 14px;outline:none;
          "/>
        ` : `
          <div style="
            font-size:20px;font-weight:700;color:#e2e8f0;
            padding:12px 16px;background:rgba(255,255,255,0.04);
            border-radius:10px;margin-bottom:18px;
          ">${item.word} <span style="font-size:14px;font-weight:400;color:#c9a84c;">— ${item.meaning}</span></div>
        `}

        <label style="font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Etiketler</label>
        <div id="editTagChips" style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 22px;"></div>

        <div style="display:flex;gap:10px;">
          <button id="editCancelBtn" style="
            flex:1;padding:11px;background:rgba(255,255,255,0.05);
            border:1px solid rgba(255,255,255,0.1);border-radius:10px;
            color:#aaa;font-size:14px;font-family:inherit;cursor:pointer;
          ">İptal</button>
          <button id="editSaveBtn" style="
            flex:2;padding:11px;background:#c9a84c;border:none;
            border-radius:10px;color:#0a0a0f;font-size:14px;font-weight:700;
            font-family:inherit;cursor:pointer;
          ">Kaydet ✓</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // tag.js ile chip'leri render et — mevcut tag'ler seçili gelsin
    renderTagChips("editTagChips", item.tags || [], extractAllTags(allWords));


    const close = () => overlay.remove();
    overlay.querySelector("#editModalClose").addEventListener("click", close);
    overlay.querySelector("#editCancelBtn").addEventListener("click", close);
    overlay.addEventListener("click", e => { if(e.target === overlay) close(); });

    overlay.querySelector("#editSaveBtn").addEventListener("click", async () => {
      const newWord    = tagFocused ? item.word    : overlay.querySelector("#editWordInput").value.trim();
      const newMeaning = tagFocused ? item.meaning : overlay.querySelector("#editMeaningInput").value.trim();
      if(!newWord || !newMeaning) return;

      // tag.js'den seçili tag'leri al
      const newTags = getSelectedTags("editTagChips");

      const saveBtn = overlay.querySelector("#editSaveBtn");
      saveBtn.disabled    = true;
      saveBtn.textContent = "Kaydediliyor...";

      await updateWord(userId, item.id, { word: newWord, meaning: newMeaning, tags: newTags });

      item.word    = newWord;
      item.meaning = newMeaning;
      item.tags    = newTags;

      close();
      buildFilterSidebar();
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
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  }
  // =====================
  // ÖRNEK CÜMLE MODALİ
  // =====================

  async function openExampleModal(word, meaning) {
    document.getElementById("exampleModalOverlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "exampleModalOverlay";
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.65);
      backdrop-filter:blur(4px);z-index:10000;
      display:flex;align-items:center;justify-content:center;
      padding: 20px; box-sizing: border-box;
    `;

    overlay.innerHTML = `
      <div style="
        background:#1a1a26;border:1px solid rgba(201,168,76,0.3);
        border-radius:20px;padding:28px 32px;width:460px;max-width:100%;
        box-shadow:0 24px 60px rgba(0,0,0,0.7);
      ">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
          <div>
            <div style="font-size:20px;font-weight:700;color:#e2e8f0;">${word}</div>
            <div style="font-size:13px;color:#c9a84c;margin-top:3px;">${meaning}</div>
          </div>
          <button id="exampleModalClose" style="background:none;border:none;color:#666;font-size:18px;cursor:pointer;padding:0 0 0 12px;">✕</button>
        </div>

        <div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">
          💬 Örnek Cümleler
        </div>

        <div id="exampleSentences" style="display:flex;flex-direction:column;gap:10px;">
          <div style="
            padding:14px 16px;border-radius:12px;
            background:rgba(255,255,255,0.03);
            border:1px solid rgba(255,255,255,0.06);
            color:#888;font-size:14px;text-align:center;
          ">
            <span style="display:inline-block;animation:spin 1s linear infinite;">⏳</span> Yükleniyor...
          </div>
        </div>

        <div style="margin-top:18px;font-size:11px;color:#444;text-align:right;">
          Kelimeye tekrar tıklayarak yeni cümleler üretebilirsin
        </div>
      </div>
    `;

    // Spin animasyonu
    const style = document.createElement("style");
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);

    document.body.appendChild(overlay);

    overlay.querySelector("#exampleModalClose").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

    // API çağrısı
    const sentences = await fetchExampleSentences(word, meaning);
    const container = document.getElementById("exampleSentences");
    if (!container) return;

    container.innerHTML = sentences.map((s, i) => `
      <div style="
        padding:14px 16px;border-radius:12px;
        background:rgba(255,255,255,0.03);
        border:1px solid rgba(255,255,255,0.07);
        transition:0.2s;
      ">
        <div style="font-size:11px;color:#c9a84c;font-weight:700;margin-bottom:6px;">
          ${i + 1}. Cümle
        </div>
        <div style="font-size:14px;color:#e2e8f0;line-height:1.6;">${s.original}</div>
        <div style="font-size:13px;color:#888;margin-top:5px;font-style:italic;">${s.turkish}</div>
      </div>
    `).join("");
  }

  const exampleCache = new Map();
  let isRequestInProgress = false;

  async function fetchExampleSentences(word, meaning, retryCount = 0) {
    // Cache'de varsa direkt dön
    if (exampleCache.has(word)) return exampleCache.get(word);

    // Başka istek varsa bekle
    if (isRequestInProgress) {
      await new Promise(r => setTimeout(r, 1500));
      return fetchExampleSentences(word, meaning, retryCount);
    }

    isRequestInProgress = true;

    const GEMINI_API_KEY = "AIzaSyAuREkHAgZ07NBvl3daLHgxs-sZUoZl-t0";

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `"${word}" kelimesini (Türkçe anlamı: "${meaning}") kullanarak 2 farklı örnek cümle yaz.
                
  Cevabı SADECE şu JSON formatında ver, başka hiçbir şey yazma:
  [
    {"original": "Almanca cümle burada", "turkish": "Türkçe çevirisi burada"},
    {"original": "Almanca cümle burada", "turkish": "Türkçe çevirisi burada"}
  ]`
              }]
            }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 300 }
          })
        }
      );

      // 429 gelirse bekle ve tekrar dene (max 3 kez)
      if (response.status === 429) {
        if (retryCount < 3) {
          const waitSeconds = (retryCount + 1) * 2;

          const container = document.getElementById("exampleSentences");
          if (container) {
            container.innerHTML = `
              <div style="padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.03);
                border:1px solid rgba(255,255,255,0.06);color:#888;font-size:14px;text-align:center;">
                ⏳ Rate limit — ${waitSeconds} saniye bekleniyor...
              </div>`;
          }

          await new Promise(r => setTimeout(r, waitSeconds * 1000));
          return fetchExampleSentences(word, meaning, retryCount + 1);
        }
        return [{ original: "Günlük limit doldu.", turkish: "Birkaç dakika sonra tekrar dene." }];
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const result = JSON.parse(clean);

      exampleCache.set(word, result); // Cache'e kaydet
      return result;

    } catch (err) {
      return [{ original: "Hata oluştu.", turkish: "Lütfen tekrar deneyin." }];
    } finally {
      isRequestInProgress = false; // hata da olsa kilidi aç
    }
  }

});