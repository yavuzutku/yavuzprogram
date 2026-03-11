import { getWords, deleteWord, updateWord, onAuthChange } from "./firebase.js";
import { renderTagChips, getSelectedTags, extractAllTags } from "./tag.js";

let allWords        = [];
let activeTagFilter = null;
const exampleCache  = new Map();

/* ============================
   GÜVENLİK: HTML ESCAPE
   Kullanıcıdan gelen her veriyi
   innerHTML'e koymadan önce
   mutlaka bu fonksiyondan geçir.
============================= */
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ── Kelime sayısı ─────────────────────────────────────────────────────────── */
function wordCount(text) {
  return text.trim().split(/\s+/).length;
}

/* ── Wikitext temizleyici ───────────────────────────────────────────────────── */
function cleanWikitext(text) {
  return text
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\}\}/g, "")
    .replace(/\{\{/g, "")
    .replace(/'{2,3}/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/[„""‟«»'']/g, "")
    .replace(/\s*[A-ZÄÖÜ][^.!?]*\d{4}\s*\.?\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* ── Wiktionary'den örnek cümleler ─────────────────────────────────────────── */
async function fetchFromWiktionary(word) {
  const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
  const params = new URLSearchParams({
    action: "parse", page: capitalized, prop: "wikitext", format: "json", origin: "*"
  });
  const res  = await fetch("https://de.wiktionary.org/w/api.php?" + params);
  const data = await res.json();
  const wikitext = data?.parse?.wikitext?.["*"] || "";

  const lines = wikitext.split("\n");
  const sentences = [];
  let inBeispiele = false;

  for (const line of lines) {
    if (line.includes("Beispiele}}") || line.includes("Beispiele:")) {
      inBeispiele = true; continue;
    }
    if (inBeispiele && line.match(/^\s*:?\{\{(Herkunft|Synonyme|Übersetzungen|Wortbildungen|Bedeutungen|Redewendungen)/)) {
      inBeispiele = false; continue;
    }
    if (inBeispiele && line.trim()) {
      const match = line.match(/^::?\[\d+\]\s*(.+)/);
      if (match) {
        const text = cleanWikitext(match[1]);
        if (text.length > 10 && wordCount(text) > 5) sentences.push(text);
      }
    }
  }

  return sentences
    .sort((a, b) => wordCount(a) - wordCount(b))
    .slice(0, 2)
    .map(s => ({ original: s, turkish: null }));
}

/* ── Tatoeba'dan örnek cümleler ─────────────────────────────────────────────── */
async function fetchFromTatoeba(word) {
  const url = `https://api.tatoeba.org/v1/sentences?q=${encodeURIComponent(word)}&lang=deu&min_length=6`;
  const res  = await fetch(url);
  const data = await res.json();

  if (!data.data || data.data.length === 0) return [];

  return data.data
    .filter(s => wordCount(s.text) > 5)
    .sort((a, b) => wordCount(a.text) - wordCount(b.text))
    .slice(0, 2)
    .map(s => ({ original: s.text, turkish: null }));
}

/* ── Ana fetch: Wiktionary → Tatoeba ──────────────────────────────────────── */
async function fetchExampleSentences(word) {
  if (exampleCache.has(word)) return exampleCache.get(word);

  let sentences = [];

  try { sentences = await fetchFromWiktionary(word); } catch (_) {}

  if (sentences.length < 2) {
    try {
      const tatoeba = await fetchFromTatoeba(word);
      const needed = 2 - sentences.length;
      sentences = [...sentences, ...tatoeba.slice(0, needed)];
    } catch (_) {}
  }

  if (sentences.length === 0) {
    sentences = [{ original: "Cümle bulunamadı.", turkish: "Bu kelime için örnek yok." }];
  }

  exampleCache.set(word, sentences);
  return sentences;
}

/* ════════════════════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {

  const wordList       = document.getElementById("wordList");
  const emptyState     = document.getElementById("emptyState");
  const wordCountBadge = document.getElementById("wordCountBadge");
  const searchInput    = document.getElementById("searchInput");
  const filterTagList  = document.getElementById("filterTagList");

  /* ── Hata gösterici ────────────────────────────────────────────────────── */
  function showError(msg) {
    wordCountBadge.textContent = "Hata";
    wordList.innerHTML = `
      <div style="
        padding:24px;border-radius:12px;
        background:rgba(224,82,82,0.08);
        border:1px solid rgba(224,82,82,0.2);
        color:#e05252;font-size:14px;text-align:center;
      ">⚠️ ${escapeHtml(msg)}</div>
    `;
  }

  onAuthChange(async (user) => {
    if (user) await loadWords(user.uid);
  });

  async function loadWords(userId) {
    wordCountBadge.textContent = "Yükleniyor...";
    try {
      allWords = await getWords(userId);
      buildFilterSidebar();
      renderFiltered();
    } catch (err) {
      showError(err.message);
    }
  }

  /* ── Filtre Sidebar ──────────────────────────────────────────────────────── */

  function buildFilterSidebar() {
    const tagMap = new Map();
    allWords.forEach(w => {
      if (Array.isArray(w.tags)) w.tags.forEach(t => tagMap.set(t, (tagMap.get(t) || 0) + 1));
    });

    filterTagList.innerHTML = "";

    const allItem = document.createElement("button");
    allItem.className = "filter-tag-item all-item" + (activeTagFilter === null ? " active" : "");
    allItem.innerHTML = `<span>Tüm Kelimeler</span><span class="filter-count-badge">${allWords.length}</span>`;
    allItem.addEventListener("click", () => { activeTagFilter = null; buildFilterSidebar(); renderFiltered(); });
    filterTagList.appendChild(allItem);

    if (tagMap.size > 0) {
      [...tagMap.entries()].sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
        const item = document.createElement("button");
        item.className = "filter-tag-item" + (activeTagFilter === tag ? " active" : "");
        // escapeHtml: tag kullanıcı girdisidir
        item.innerHTML = `<span>${escapeHtml(tag)}</span><span class="filter-count-badge">${count}</span>`;
        item.addEventListener("click", () => {
          activeTagFilter = (activeTagFilter === tag) ? null : tag;
          buildFilterSidebar(); renderFiltered();
        });
        filterTagList.appendChild(item);
      });
    }

    const untagged = allWords.filter(w => !Array.isArray(w.tags) || w.tags.length === 0).length;
    if (untagged > 0) {
      const sep = document.createElement("div");
      sep.style.cssText = "margin:10px 0 6px;border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;";
      const untaggedItem = document.createElement("button");
      untaggedItem.className = "filter-tag-item" + (activeTagFilter === "__untagged__" ? " active" : "");
      untaggedItem.innerHTML = `<span>Etiketsiz</span><span class="filter-count-badge">${untagged}</span>`;
      untaggedItem.addEventListener("click", () => {
        activeTagFilter = (activeTagFilter === "__untagged__") ? null : "__untagged__";
        buildFilterSidebar(); renderFiltered();
      });
      filterTagList.appendChild(sep);
      filterTagList.appendChild(untaggedItem);
    }
  }

  function renderFiltered() {
    const q = searchInput.value.toLowerCase();
    let list = allWords;

    if (activeTagFilter === "__untagged__") {
      list = list.filter(w => !Array.isArray(w.tags) || w.tags.length === 0);
    } else if (activeTagFilter) {
      list = list.filter(w => Array.isArray(w.tags) && w.tags.includes(activeTagFilter));
    }

    if (q) list = list.filter(w =>
      w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)
    );

    render(list);
  }

  /* ── Render ──────────────────────────────────────────────────────────────── */

  function render(list) {
    [...wordList.querySelectorAll(".word-card")].forEach(el => el.remove());
    wordCountBadge.textContent = allWords.length + " kelime";

    if (list.length === 0) { emptyState.style.display = "block"; return; }
    emptyState.style.display = "none";

    list.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "word-card";
      card.style.animationDelay = (idx * 30) + "ms";

      /* ── Üst satır: kelime + anlam ── */
      const leftDiv = document.createElement("div");
      leftDiv.className = "word-left";

      const germanEl = document.createElement("div");
      germanEl.className = "word-german";
      germanEl.textContent = item.word;           // ← textContent: güvenli
      germanEl.style.cursor = "pointer";
      germanEl.title = "Örnek cümleleri gör";
      germanEl.addEventListener("click", (e) => {
        e.stopPropagation();
        openExampleModal(item.word, item.meaning);
      });

      const turkishEl = document.createElement("div");
      turkishEl.className = "word-turkish";
      turkishEl.textContent = item.meaning;       // ← textContent: güvenli

      /* ── Etiket satırı ── */
      const tagsDiv = document.createElement("div");
      tagsDiv.className = "word-tags";

      const hasTags = Array.isArray(item.tags) && item.tags.length > 0;
      if (hasTags) {
        item.tags.forEach(t => {
          const badge = document.createElement("span");
          badge.className = "word-tag-badge";
          badge.textContent = t;                  // ← textContent: güvenli
          tagsDiv.appendChild(badge);
        });
      }

      const addTagBtn = document.createElement("button");
      addTagBtn.className = "add-tag-inline";
      addTagBtn.dataset.id = item.id;
      addTagBtn.textContent = hasTags ? "+ etiket" : "+ etiket ekle";
      addTagBtn.addEventListener("click", () => {
        const userId = window.getUserId();
        if (!userId) return;
        openEditModal(userId, item, true);
      });
      tagsDiv.appendChild(addTagBtn);

      const dateEl = document.createElement("div");
      dateEl.className = "word-date";
      dateEl.textContent = formatDate(item.date);  // ← textContent: güvenli

      leftDiv.appendChild(germanEl);
      leftDiv.appendChild(turkishEl);
      leftDiv.appendChild(tagsDiv);
      leftDiv.appendChild(dateEl);

      /* ── Sağ: butonlar ── */
      const rightDiv = document.createElement("div");
      rightDiv.className = "word-right";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "word-delete-btn";
      deleteBtn.textContent = "🗑 Sil";
      deleteBtn.addEventListener("click", async () => {
        const userId = window.getUserId();
        if (!userId) return;
        if (!confirm(`"${item.word}" silinsin mi?`)) return;
        try {
          await deleteWord(userId, item.id);
          allWords = allWords.filter(w => w.id !== item.id);
          buildFilterSidebar(); renderFiltered();
        } catch (err) {
          alert("Silme hatası: " + err.message);
        }
      });

      const editBtn = document.createElement("button");
      editBtn.className = "word-edit-btn";
      editBtn.textContent = "✏️ Düzenle";
      editBtn.addEventListener("click", () => {
        const userId = window.getUserId();
        if (!userId) return;
        openEditModal(userId, item, false);
      });

      rightDiv.appendChild(deleteBtn);
      rightDiv.appendChild(editBtn);

      card.appendChild(leftDiv);
      card.appendChild(rightDiv);
      wordList.appendChild(card);
    });
  }

  /* ── Düzenleme Modali ──────────────────────────────────────────────────────
     ÖNEMLİ: input.value ile değer set ediyoruz, innerHTML'e kullanıcı verisi
     asla doğrudan yazılmıyor.
  ─────────────────────────────────────────────────────────────────────────── */

  function openEditModal(userId, item, tagFocused = false) {
    document.getElementById("editModalOverlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "editModalOverlay";
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.65);
      backdrop-filter:blur(4px);z-index:10000;
      display:flex;align-items:center;justify-content:center;
    `;

    /* Modal iskeletini statik HTML ile kur — kullanıcı verisi YOK */
    overlay.innerHTML = `
      <div style="
        background:#1a1a26;border:1px solid rgba(201,168,76,0.3);
        border-radius:20px;padding:28px 32px;width:380px;max-width:90vw;
        box-shadow:0 24px 60px rgba(0,0,0,0.7);
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <span id="_modalTitle" style="font-size:16px;font-weight:600;color:#c9a84c;"></span>
          <button id="editModalClose" style="background:none;border:none;color:#666;font-size:18px;cursor:pointer;">✕</button>
        </div>

        <div id="_wordFields">
          <label style="font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Kelime</label>
          <input id="editWordInput" style="
            width:100%;box-sizing:border-box;margin:6px 0 14px;
            background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
            border-radius:10px;color:white;font-size:15px;font-family:inherit;
            padding:11px 14px;outline:none;
          "/>
          <label style="font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Anlam</label>
          <input id="editMeaningInput" style="
            width:100%;box-sizing:border-box;margin:6px 0 14px;
            background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
            border-radius:10px;color:white;font-size:15px;font-family:inherit;
            padding:11px 14px;outline:none;
          "/>
        </div>

        <div id="_tagPreview" style="display:none;">
          <div id="_tagPreviewWord" style="
            font-size:20px;font-weight:700;color:#e2e8f0;
            padding:12px 16px;background:rgba(255,255,255,0.04);
            border-radius:10px;margin-bottom:18px;
          "></div>
        </div>

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

    /* Kullanıcı verisini DOM'a güvenli şekilde set et */
    overlay.querySelector("#_modalTitle").textContent =
      tagFocused ? "🏷️ Etiket Ekle" : "✏️ Kelimeyi Düzenle";

    if (tagFocused) {
      overlay.querySelector("#_wordFields").style.display = "none";
      const preview = overlay.querySelector("#_tagPreview");
      preview.style.display = "block";
      /* Kullanıcı verisi: textContent ile — innerHTML değil */
      const wordSpan = document.createElement("span");
      wordSpan.textContent = item.word;
      const meaningSpan = document.createElement("span");
      meaningSpan.style.cssText = "font-size:14px;font-weight:400;color:#c9a84c;margin-left:8px;";
      meaningSpan.textContent = "— " + item.meaning;
      const previewWord = overlay.querySelector("#_tagPreviewWord");
      previewWord.appendChild(wordSpan);
      previewWord.appendChild(meaningSpan);
    } else {
      overlay.querySelector("#_tagPreview").style.display = "none";
      /* .value ile set etmek tamamen güvenlidir */
      overlay.querySelector("#editWordInput").value    = item.word;
      overlay.querySelector("#editMeaningInput").value = item.meaning;
    }

    renderTagChips("editTagChips", item.tags || [], extractAllTags(allWords));

    const close = () => overlay.remove();
    overlay.querySelector("#editModalClose").addEventListener("click", close);
    overlay.querySelector("#editCancelBtn").addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

    overlay.querySelector("#editSaveBtn").addEventListener("click", async () => {
      const newWord    = tagFocused ? item.word    : overlay.querySelector("#editWordInput").value.trim();
      const newMeaning = tagFocused ? item.meaning : overlay.querySelector("#editMeaningInput").value.trim();
      if (!newWord || !newMeaning) return;

      const newTags = getSelectedTags("editTagChips");
      const saveBtn = overlay.querySelector("#editSaveBtn");
      saveBtn.disabled    = true;
      saveBtn.textContent = "Kaydediliyor...";

      try {
        await updateWord(userId, item.id, { word: newWord, meaning: newMeaning, tags: newTags });
        item.word    = newWord;
        item.meaning = newMeaning;
        item.tags    = newTags;
        close();
        buildFilterSidebar();
        renderFiltered();
      } catch (err) {
        saveBtn.disabled    = false;
        saveBtn.textContent = "Kaydet ✓";
        alert("Güncelleme hatası: " + err.message);
      }
    });
  }

  /* ── Arama ───────────────────────────────────────────────────────────────── */

  searchInput.addEventListener("input", renderFiltered);

  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  }

  /* ── Örnek Cümle Modali ──────────────────────────────────────────────────── */

  async function openExampleModal(word, meaning) {
    document.getElementById("exampleModalOverlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "exampleModalOverlay";
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.65);
      backdrop-filter:blur(4px);z-index:10000;
      display:flex;align-items:center;justify-content:center;
      padding:20px;box-sizing:border-box;
    `;

    /* İskelet — kullanıcı verisi YOK */
    overlay.innerHTML = `
      <div style="
        background:#1a1a26;border:1px solid rgba(201,168,76,0.3);
        border-radius:20px;padding:28px 32px;width:480px;max-width:100%;
        box-shadow:0 24px 60px rgba(0,0,0,0.7);
      ">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
          <div>
            <div id="_exWord" style="font-size:20px;font-weight:700;color:#e2e8f0;"></div>
            <div id="_exMeaning" style="font-size:13px;color:#c9a84c;margin-top:3px;"></div>
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
          ">⏳ Yükleniyor...</div>
        </div>

        <div style="margin-top:14px;font-size:11px;color:#3a3a3a;text-align:right;">
          Kaynak: Wiktionary · Tatoeba
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    /* Kullanıcı verisi: textContent ile */
    overlay.querySelector("#_exWord").textContent    = word;
    overlay.querySelector("#_exMeaning").textContent = meaning;

    overlay.querySelector("#exampleModalClose").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

    const sentences = await fetchExampleSentences(word);
    const container = document.getElementById("exampleSentences");
    if (!container) return;

    /* Cümleler dış kaynaklardan gelir — yine de escapeHtml ile güvende tut */
    container.innerHTML = sentences.map((s, i) => `
      <div style="
        padding:14px 16px;border-radius:12px;
        background:rgba(255,255,255,0.03);
        border:1px solid rgba(255,255,255,0.07);
      ">
        <div style="font-size:11px;color:#c9a84c;font-weight:700;margin-bottom:6px;">${i + 1}. Cümle</div>
        <div style="font-size:15px;color:#e2e8f0;line-height:1.6;">${escapeHtml(s.original)}</div>
      </div>
    `).join("");
  }

});