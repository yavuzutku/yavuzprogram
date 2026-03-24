import { getWords, deleteWord, updateWord, onAuthChange } from "../js/firebase.js";
import { showLemmaHintOnce } from '../src/components/lemmaHint.js';
import { renderTagChips, getSelectedTags, extractAllTags, getAutoLevel } from "../js/tag.js";
import { fetchWikiData } from "../src/services/wiktionary.js";
import { saveListe, getListeler } from "../js/listeler-firebase.js";
import { openListeModal } from "../src/components/listeModal.js";

/* ═══════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════ */
let allWords        = [];
let allLists        = [];

let activeTagFilter = null;
let sortMode        = "newest";   // newest | oldest | az | za | level
let viewMode        = "list";     // list | grid
let selectMode      = false;
let selectedIds     = new Set();
let currentUserId   = null;
const exampleCache  = new Map();

/* ─── HTML escape ───────────────────────────────────────── */
function esc(str) {
  return String(str ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

/* ─── Çoklu anlam yardımcıları ──────────────────────────── */
function getMeanings(item) {
  if (Array.isArray(item.meanings) && item.meanings.length > 0) return item.meanings;
  if (item.meaning) return [item.meaning];
  return [""];
}
function primaryMeaning(item)  { return getMeanings(item)[0] || ""; }
function extraMeanings(item)   { return getMeanings(item).slice(1); }

/* ─── Artikel tespiti ───────────────────────────────────── */
function extractArtikel(word) {
  const m = String(word).match(/^(der|die|das)\s/i);
  return m ? m[1].toLowerCase() : null;
}

/* ─── Kelime sayısı ─────────────────────────────────────── */
function wordCount(t) { return t.trim().split(/\s+/).length; }

/* ─── Sıralama ──────────────────────────────────────────── */
const LEVEL_ORDER = { A1:1, A2:2, B1:3, B2:4, C1:5, C2:6 };
function applySort(list) {
  const arr = [...list];
  switch (sortMode) {
    case "oldest": return arr.sort((a,b) => (a.created||0) - (b.created||0));
    case "az":     return arr.sort((a,b) => a.word.localeCompare(b.word, "de"));
    case "za":     return arr.sort((a,b) => b.word.localeCompare(a.word, "de"));
    case "level": {
      return arr.sort((a,b) => {
        const al = (Array.isArray(a.tags) ? a.tags : []).find(t => LEVEL_ORDER[t]);
        const bl = (Array.isArray(b.tags) ? b.tags : []).find(t => LEVEL_ORDER[t]);
        return (LEVEL_ORDER[al]||99) - (LEVEL_ORDER[bl]||99);
      });
    }
    default: return arr.sort((a,b) => (b.created||0) - (a.created||0));
  }
}

/* ─── Wikitext temizleyici ──────────────────────────────── */
function cleanWikitext(text) {
  return text
    .replace(/\{\{[^{}]*\}\}/g,"").replace(/\}\}/g,"").replace(/\{\{/g,"")
    .replace(/'{2,3}/g,"")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g,"$1")
    .replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ")
    .replace(/[„""‟«»'']/g,"")
    .replace(/\s*[A-ZÄÖÜ][^.!?]*\d{4}\s*\.?\s*$/,"")
    .replace(/\[\d+\]/g, '')
    .replace(/\s{2,}/g," ").trim();
}

/* ─── Örnek cümleler ────────────────────────────────────── */
async function fetchFromWiktionary(word) {
  const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
  const attempts = word === capitalized ? [word] : [word, capitalized];
  let wikitext = null;
  for (const title of attempts) {
    const params = new URLSearchParams({ action:"parse", page:title, prop:"wikitext", format:"json", origin:"*" });
    const data = await (await fetch("https://de.wiktionary.org/w/api.php?"+params)).json();
    if (!data.error) { wikitext = data?.parse?.wikitext?.["*"] || null; }
    if (wikitext) break;
  }
  if (!wikitext) return [];

  wikitext = wikitext
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '');

  const lines = wikitext.split('\n');
  const sents = [];
  let inB = false;
  const SECTION_END = /^\{\{(Herkunft|Synonyme|Übersetzungen|Wortbildungen|Bedeutungen|Redewendungen|Charakteristische|Oberbegriffe|Unterbegriffe|Gegenwörter|Sprichwörter|Referenzen|Abgeleitete|Verkleinerungsformen|Steigerungsformen|Leerzeile|Quellen)/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\{\{Beispiele/.test(trimmed) || /^={2,}\s*Beispiele\s*={2,}/.test(trimmed)) { inB = true; continue; }
    if (inB) {
      if (SECTION_END.test(trimmed) || /^={2,}/.test(trimmed)) { inB = false; continue; }
      if (trimmed) {
        const m = line.match(/^:+\s*(?:\[\d+\]\s*)?(.+)/);
        if (m) {
          let text = m[1]
            .replace(/\{\{[^{}]*\}\}/g,'').replace(/\{\{[^{}]*\}\}/g,'')
            .replace(/\}\}/g,'').replace(/\{\{/g,'').replace(/'{2,3}/g,'')
            .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g,'$1')
            .replace(/<[^>]+>/g,'').replace(/\[\d+\]/g,'').replace(/&nbsp;/g,' ')
            .replace(/[„""\u201C\u201D\u201E\u00AB\u00BB'']/g,'')
            .replace(/\s*[A-ZÄÖÜ][^.!?]*\d{4}\s*\.?\s*$/,'')
            .replace(/\s{2,}/g,' ').trim();
          if (text.length > 10) sents.push(text);
        }
      }
    }
  }
  return sents.sort((a,b) => wordCount(a) - wordCount(b)).slice(0,3).map(s => ({ original: s }));
}

async function fetchFromTatoeba(word) {
  const params = new URLSearchParams({ from:'deu', query:word, orphans:'no', unapproved:'no', sort:'relevance' });
  const data = await (await fetch(`https://tatoeba.org/eng/api_v0/search?${params}`)).json();
  const raw = data?.results ?? data?.data ?? [];
  return raw
    .map(s => s.text ?? s)
    .filter(t => typeof t === 'string' && t.trim().length > 0 && wordCount(t) > 4 && wordCount(t) < 30)
    .slice(0,3).map(t => ({ original: t }));
}

async function fetchExampleSentences(word) {
  if (exampleCache.has(word)) return exampleCache.get(word);
  let sents = [];
  try { sents = await fetchFromWiktionary(word); } catch(_) {}
  if (sents.length < 3) {
    try { const t = await fetchFromTatoeba(word); sents = [...sents, ...t.slice(0,3-sents.length)]; } catch(_) {}
  }
  if (!sents.length) sents = [{ original: "Bu kelime için örnek cümle bulunamadı." }];
  exampleCache.set(word, sents);
  return sents;
}

/* ═══════════════════════════════════════════════════════════
   TOOLBAR & BULK BAR INJECTION
   ═══════════════════════════════════════════════════════════ */
function injectToolbar() {
  const existing = document.getElementById("wordToolbar");
  if (existing) return;

  const contentLayout = document.querySelector(".content-layout");
  if (!contentLayout) return;

  /* Sort + View + Actions toolbar */
  const toolbar = document.createElement("div");
  toolbar.id = "wordToolbar";
  toolbar.className = "word-toolbar";
  toolbar.innerHTML = `
    <div class="toolbar-left">
      <div class="sort-group" role="group" aria-label="Sıralama">
        <button class="sort-btn active" data-sort="newest" title="En yeni önce">En Yeni</button>
        <button class="sort-btn" data-sort="oldest" title="En eski önce">En Eski</button>
        <button class="sort-btn" data-sort="az" title="A'dan Z'ye">A → Z</button>
        <button class="sort-btn" data-sort="za" title="Z'den A'ya">Z → A</button>
        <button class="sort-btn" data-sort="level" title="Seviyeye göre">Seviye</button>
      </div>
    </div>
    <div class="toolbar-right">
      <button class="view-toggle-btn" id="viewToggle" title="Grid / Liste görünümü" aria-label="Görünüm değiştir">
        <svg id="viewIconList" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        <svg id="viewIconGrid" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      </button>
      <button class="select-mode-btn" id="selectModeBtn" title="Kelime seç">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        Seç
      </button>
      <button class="create-list-btn" id="createListBtn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        Liste Oluştur
      </button>
    </div>
  `;
  contentLayout.parentNode.insertBefore(toolbar, contentLayout);

  /* Stats bar */
  const stats = document.createElement("div");
  stats.id = "statsBar";
  stats.className = "stats-bar";
  contentLayout.parentNode.insertBefore(stats, contentLayout);

  /* Sort buttons */
  toolbar.querySelectorAll(".sort-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      sortMode = btn.dataset.sort;
      toolbar.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderFiltered();
    });
  });

  /* View toggle */
  const viewToggle = toolbar.querySelector("#viewToggle");
  viewToggle.addEventListener("click", () => {
    viewMode = viewMode === "list" ? "grid" : "list";
    updateViewToggleIcon();
    const wl = document.getElementById("wordList");
    if (wl) wl.className = viewMode === "grid" ? "word-list word-list--grid" : "word-list";
    renderFiltered();
  });
  updateViewToggleIcon();

  /* Select mode */
  toolbar.querySelector("#selectModeBtn").addEventListener("click", toggleSelectMode);

  /* Create list (without pre-selection) */
  toolbar.querySelector("#createListBtn").addEventListener("click", () => {
    if (!currentUserId) return;
    openListeModal({
      allWords,
      preSelectedIds: [],
      userId: currentUserId,
      onSave: async ({ name, description, wordIds }) => {
        await saveListe(currentUserId, name, wordIds, description);
        showToast(`"${name}" listesi oluşturuldu!`, "success");
      }
    });
  });
}

function updateViewToggleIcon() {
  const listIcon = document.getElementById("viewIconList");
  const gridIcon = document.getElementById("viewIconGrid");
  if (!listIcon || !gridIcon) return;
  if (viewMode === "grid") {
    listIcon.style.display = "block";
    gridIcon.style.display = "none";
  } else {
    listIcon.style.display = "none";
    gridIcon.style.display = "block";
  }
}

/* ── Bulk action bar ────────────────────────────────────── */
function injectBulkBar() {
  if (document.getElementById("bulkBar")) return;
  const bar = document.createElement("div");
  bar.id = "bulkBar";
  bar.className = "bulk-bar";
  bar.style.display = "none";
  bar.innerHTML = `
    <div class="bulk-left">
      <span class="bulk-count"><span id="bulkCount">0</span> kelime seçildi</span>
      <button class="bulk-select-all-btn" id="bulkSelAll">Tümünü Seç</button>
    </div>
    <div class="bulk-right">
      <button class="bulk-list-btn" id="bulkListBtn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        Listele
      </button>
      <button class="bulk-delete-btn" id="bulkDeleteBtn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        Sil
      </button>
      <button class="bulk-cancel-btn" id="bulkCancel">İptal</button>
    </div>
  `;
  document.querySelector(".page-wrapper")?.appendChild(bar);

  bar.querySelector("#bulkSelAll").addEventListener("click", () => {
    const filtered = getFilteredList();
    const allSelected = filtered.every(w => selectedIds.has(w.id));
    filtered.forEach(w => allSelected ? selectedIds.delete(w.id) : selectedIds.add(w.id));
    renderFiltered();
    updateBulkBar();
  });

  bar.querySelector("#bulkListBtn").addEventListener("click", () => {
    if (!currentUserId || !selectedIds.size) return;
    openListeModal({
      allWords,
      preSelectedIds: [...selectedIds],
      userId: currentUserId,
      onSave: async ({ name, description, wordIds }) => {
        await saveListe(currentUserId, name, wordIds, description);
        showToast(`"${name}" listesi oluşturuldu!`, "success");
        exitSelectMode();
      }
    });
  });
  bar.querySelector("#bulkDeleteBtn").addEventListener("click", async () => {
    if (!currentUserId || !selectedIds.size) return;
    const count = selectedIds.size;
    if (!confirm(`Seçili ${count} kelime silinsin mi? Bu işlem geri alınamaz.`)) return;
    const ids = [...selectedIds];
    try {
      for (const id of ids) {
        await deleteWord(currentUserId, id);
        allWords = allWords.filter(w => w.id !== id);
      }
      exitSelectMode();
      buildFilterSidebar();
      renderFiltered();
      showToast(`${count} kelime silindi.`, "success");
    } catch(err) {
      alert("Silme hatası: " + err.message);
    }
  });
  bar.querySelector("#bulkCancel").addEventListener("click", exitSelectMode);
}

function updateBulkBar() {
  const bar = document.getElementById("bulkBar");
  const countEl = document.getElementById("bulkCount");
  if (!bar || !countEl) return;
  countEl.textContent = selectedIds.size;

  const filtered = getFilteredList();
  const allSelected = filtered.length > 0 && filtered.every(w => selectedIds.has(w.id));
  const selAllBtn = bar.querySelector("#bulkSelAll");
  if (selAllBtn) selAllBtn.textContent = allSelected ? "Seçimi Kaldır" : "Tümünü Seç";

  if (selectMode) bar.style.display = "flex";
}

function toggleSelectMode() {
  selectMode = !selectMode;
  if (!selectMode) { selectedIds.clear(); }
  const btn = document.getElementById("selectModeBtn");
  if (btn) {
    btn.classList.toggle("active", selectMode);
    btn.querySelector("span") && (btn.querySelector("span").textContent = selectMode ? "Vazgeç" : "Seç");
  }
  const bar = document.getElementById("bulkBar");
  if (bar) bar.style.display = selectMode ? "flex" : "none";
  renderFiltered();
}

function exitSelectMode() {
  selectMode = false;
  selectedIds.clear();
  const btn = document.getElementById("selectModeBtn");
  if (btn) btn.classList.remove("active");
  const bar = document.getElementById("bulkBar");
  if (bar) bar.style.display = "none";
  renderFiltered();
}

/* ── Stats bar ──────────────────────────────────────────── */
function updateStats(filtered) {
  const bar = document.getElementById("statsBar");
  if (!bar) return;
  if (!allWords.length) { bar.style.display = "none"; return; }
  bar.style.display = "flex";

  const total = allWords.length;
  const shown = filtered.length;

  bar.innerHTML = shown < total
    ? `<span class="stats-shown">${shown} kelime gösteriliyor</span><span class="stats-sep">·</span><span class="stats-total">${total} toplam</span>`
    : `<span class="stats-total">${total} kelime</span>`;
}

/* ═══════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {

  const wordList       = document.getElementById("wordList");
  const emptyState     = document.getElementById("emptyState");
  const wordCountBadge = document.getElementById("wordCountBadge");
  const searchInput    = document.getElementById("searchInput");
  const searchClear    = document.getElementById("searchClear");
  const filterTagList  = document.getElementById("filterTagList");

  /* Toolbar + bulk bar */
  injectToolbar();
  injectBulkBar();
  showSkeleton();

  /* ─── Arama temizle butonu ────────────────────────── */
  searchInput?.addEventListener("input", () => {
    searchClear.style.display = searchInput.value ? "flex" : "none";
    renderFiltered();
  });
  searchClear?.addEventListener("click", () => {
    searchInput.value = "";
    searchClear.style.display = "none";
    renderFiltered();
    searchInput.focus();
  });

  /* ─── Auth ──────────────────────────────────────── */
  onAuthChange(async (user) => {
    if (user) {
      currentUserId = user.uid;
      window.getUserId = () => user.uid;
      await loadWords(user.uid);
    }
  });

  async function loadWords(userId) {
    wordCountBadge.textContent = "—";
    showSkeleton();
    try {
      [allWords, allLists] = await Promise.all([
        getWords(userId),
        getListeler(userId).catch(() => [])
      ]);
      buildFilterSidebar();
      renderFiltered();
      enrichTagsInBackground(userId);
    } catch (err) {
      wordList.innerHTML = `<div style="padding:20px;color:#e05252;font-size:14px;text-align:center;">Kelimeler yüklenemedi: ${esc(err.message)}</div>`;
    }
  }
  
  async function enrichTagsInBackground(userId) {
    const levelTags = new Set(['A1','A2','B1','B2']);
    const typeTags  = new Set(['isim','fiil','sıfat','zarf']);

    for (const w of allWords) {
      const currentTags = Array.isArray(w.tags) ? w.tags : [];
      const hasLevel = currentTags.some(t => levelTags.has(t));
      const hasType  = currentTags.some(t => typeTags.has(t));
      let newTags = [...currentTags];
      let changed = false;

      if (!hasLevel) {
        const auto = getAutoLevel(w.word);
        if (auto) { newTags.push(auto); changed = true; }
      }
      if (!hasType) {
        try {
          const wiki = await fetchWikiData(w.word);
          if (wiki?.autoTags?.length) {
            wiki.autoTags
              .filter(t => typeTags.has(t))
              .forEach(t => { if (!newTags.includes(t)) { newTags.push(t); changed = true; } });
          }
        } catch(_) {}
      }
      if (changed) {
        try { await updateWord(userId, w.id, { tags: newTags }); w.tags = newTags; } catch(_) {}
      }
      await new Promise(r => setTimeout(r, 150));
    }
    buildFilterSidebar();
    renderFiltered();
  }

  /* ─── Filtre Sidebar ────────────────────────────── */
  function buildFilterSidebar() {
    const tagMap = new Map();
    allWords.forEach(w => {
      if (Array.isArray(w.tags)) w.tags.forEach(t => tagMap.set(t, (tagMap.get(t)||0)+1));
    });

    filterTagList.innerHTML = "";

    const allItem = document.createElement("button");
    allItem.className = "filter-tag-item all-item" + (activeTagFilter === null ? " active" : "");
    allItem.setAttribute("aria-pressed", activeTagFilter === null);
    allItem.innerHTML = `<span>Tüm Kelimeler</span><span class="filter-count-badge">${allWords.length}</span>`;
    allItem.addEventListener("click", () => { activeTagFilter = null; buildFilterSidebar(); renderFiltered(); });
    filterTagList.appendChild(allItem);

    [...tagMap.entries()].sort((a,b)=>b[1]-a[1]).forEach(([tag, count]) => {
      const row = document.createElement("div");
      row.className = "filter-tag-row";

      const item = document.createElement("button");
      item.className = "filter-tag-item" + (activeTagFilter === tag ? " active" : "");
      item.setAttribute("aria-pressed", activeTagFilter === tag);
      item.innerHTML = `<span>${esc(tag)}</span><span class="filter-count-badge">${count}</span>`;
      item.addEventListener("click", () => {
        activeTagFilter = (activeTagFilter === tag) ? null : tag;
        buildFilterSidebar(); renderFiltered();
      });

      const addToListBtn = document.createElement("button");
      addToListBtn.className = "filter-tag-list-btn";
      addToListBtn.title = `"${tag}" etiketli kelimeleri listeye ekle`;
      addToListBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
      addToListBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!currentUserId) return;
        const tagWords = allWords.filter(w => Array.isArray(w.tags) && w.tags.includes(tag));
        if (!tagWords.length) { showToast("Bu etikette kelime yok.", "error"); return; }
        openListeModal({
          allWords,
          preSelectedIds: tagWords.map(w => w.id),
          userId: currentUserId,
          onSave: async ({ name, description, wordIds }) => {
            await saveListe(currentUserId, name, wordIds, description);
            allLists = await getListeler(currentUserId).catch(() => allLists);
            buildFilterSidebar();
            showToast(`"${name}" listesi oluşturuldu!`, "success");
          }
        });
      });

      row.appendChild(item);
      row.appendChild(addToListBtn);
      filterTagList.appendChild(row);
    });

    const untagged = allWords.filter(w => !Array.isArray(w.tags)||!w.tags.length).length;
    if (untagged > 0) {
      const sep = document.createElement("div");
      sep.style.cssText = "margin:8px 0 5px;border-top:1px solid rgba(255,255,255,0.05);padding-top:8px;";
      const ui = document.createElement("button");
      ui.className = "filter-tag-item" + (activeTagFilter === "__untagged__" ? " active" : "");
      ui.innerHTML = `<span>Etiketsiz</span><span class="filter-count-badge">${untagged}</span>`;
      ui.addEventListener("click", () => {
        activeTagFilter = (activeTagFilter === "__untagged__") ? null : "__untagged__";
        buildFilterSidebar(); renderFiltered();
      });
      filterTagList.appendChild(sep);
      filterTagList.appendChild(ui);
    }

    /* Listelerim bağlantısı */
    const sep2 = document.createElement("div");
    sep2.style.cssText = "margin:10px 0 6px;border-top:1px solid rgba(255,255,255,0.05);padding-top:8px;";
    filterTagList.appendChild(sep2);

    const listelerHeader = document.createElement("div");
    listelerHeader.className = "sidebar-section-title";
    listelerHeader.innerHTML = `
      <span>Listelerim</span>
      <a href="../listeler/" class="sidebar-listeler-all">Tümü →</a>
    `;
    filterTagList.appendChild(listelerHeader);

    if (!allLists.length) {
      const noList = document.createElement("div");
      noList.className = "sidebar-no-list";
      noList.textContent = "Henüz liste yok";
      filterTagList.appendChild(noList);
    } else {
      allLists.slice(0, 5).forEach(liste => {
        const item = document.createElement("a");
        item.href = "../listeler/";
        item.className = "sidebar-liste-item";
        item.innerHTML = `
          <span class="sidebar-liste-name">${esc(liste.name)}</span>
          <span class="sidebar-liste-count">${liste.wordCount || 0}</span>
        `;
        filterTagList.appendChild(item);
      });
      if (allLists.length > 5) {
        const more = document.createElement("a");
        more.href = "../listeler/";
        more.className = "sidebar-liste-more";
        more.textContent = `+${allLists.length - 5} liste daha`;
        filterTagList.appendChild(more);
      }
    }
  }

  function getFilteredList() {
    const q = (searchInput?.value||"").toLowerCase();
    let list = allWords;
    if (activeTagFilter === "__untagged__") {
      list = list.filter(w => !Array.isArray(w.tags)||!w.tags.length);
    } else if (activeTagFilter) {
      list = list.filter(w => Array.isArray(w.tags) && w.tags.includes(activeTagFilter));
    }
    if (q) list = list.filter(w => {
      const allM = getMeanings(w).join(" ").toLowerCase();
      return w.word.toLowerCase().includes(q) || allM.includes(q);
    });
    return list;
  }

  window.getFilteredList = getFilteredList;  /* bulk bar erişimi için */

  function renderFiltered() {
    const filtered = applySort(getFilteredList());
    updateStats(filtered);
    updateBulkBar();
    render(filtered);
  }
  function showSkeleton() {
    [...wordList.querySelectorAll(".word-card, .skeleton-card")].forEach(el => el.remove());
    emptyState.style.display = "none";
    wordList.className = "word-list";
    for (let i = 0; i < 5; i++) {
      const el = document.createElement("div");
      el.className = "skeleton-card";
      el.style.animationDelay = (i * 80) + "ms";
      el.innerHTML = `
        <div class="skeleton-inner">
          <div class="skeleton-line sk-word"></div>
          <div class="skeleton-line sk-meaning"></div>
          <div class="skeleton-footer">
            <div class="skeleton-line sk-tag"></div>
            <div class="skeleton-line sk-tag"></div>
            <div class="skeleton-line sk-tag"></div>
          </div>
        </div>
      `;
      wordList.appendChild(el);
    }
  }
  /* ═══════════════════════════════════════
     RENDER
     ═══════════════════════════════════════ */
  function render(list) {
    [...wordList.querySelectorAll(".word-card, .skeleton-card")].forEach(el => el.remove());

    const total = allWords.length;
    wordCountBadge.textContent = total === 1 ? "1 kelime" : `${total} kelime`;

    /* Grid/list class */
    wordList.className = viewMode === "grid" ? "word-list word-list--grid" : "word-list";

    if (!list.length) { emptyState.style.display = "block"; return; }
    emptyState.style.display = "none";

    const userId = currentUserId;

    list.forEach((item, idx) => {
      const card = viewMode === "grid"
        ? buildGridCard(item, idx, userId)
        : buildCard(item, idx, userId);
      wordList.appendChild(card);
    });
  }

  /* ─── Grid kartı (kompakt) ──────────────────────── */
  function buildGridCard(item, idx, userId) {
    const card = document.createElement("article");
    card.className = "word-card word-card--grid";
    card.style.animationDelay = (idx * 18) + "ms";
    if (selectMode) card.classList.add("select-mode");
    if (selectedIds.has(item.id)) card.classList.add("selected");

    const artikel = extractArtikel(item.word);
    if (artikel) card.classList.add(`artikel-${artikel}`);

    const tags = Array.isArray(item.tags) ? item.tags : [];
    const levelTag = tags.find(t => ["A1","A2","B1","B2","C1","C2"].includes(t));

    card.innerHTML = `
      <div class="grid-card-inner">
        ${selectMode ? `<div class="grid-checkbox ${selectedIds.has(item.id)?"checked":""}">
          <svg width="9" height="9" viewBox="0 0 12 10" fill="none">
            <polyline points="1,5 4.5,8.5 11,1" stroke="#0c0c12" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>` : ""}
        <div class="grid-top">
          ${artikel ? `<span class="artikel-badge ${artikel}">${artikel}</span>` : ""}
          ${levelTag ? `<span class="grid-level-badge">${levelTag}</span>` : ""}
        </div>
        <div class="grid-word">${esc(item.word)}</div>
        <div class="grid-meaning">${esc(primaryMeaning(item))}</div>
        ${tags.filter(t=>!["A1","A2","B1","B2","C1","C2"].includes(t)).slice(0,2).map(t=>`<span class="word-tag-badge" style="margin:2px 2px 0 0">${esc(t)}</span>`).join("")}
        <div class="grid-actions">
          <button class="grid-btn example-btn" title="Örnek cümle">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button class="grid-btn edit-btn" title="Düzenle">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="grid-btn delete-btn" title="Sil">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    `;

    /* Select mode click */
    if (selectMode) {
      card.addEventListener("click", () => {
        if (selectedIds.has(item.id)) selectedIds.delete(item.id);
        else selectedIds.add(item.id);
        card.classList.toggle("selected", selectedIds.has(item.id));
        const cb = card.querySelector(".grid-checkbox");
        if (cb) cb.classList.toggle("checked", selectedIds.has(item.id));
        updateBulkBar();
      });
    } else {
      card.querySelector(".example-btn")?.addEventListener("click", () => openExampleModal(item.word, primaryMeaning(item)));
      card.querySelector(".edit-btn")?.addEventListener("click", () => userId && openEditModal(userId, item, "word"));
      card.querySelector(".delete-btn")?.addEventListener("click", async () => {
        if (!userId) return;
        if (!confirm(`"${item.word}" silinsin mi?`)) return;
        try {
          await deleteWord(userId, item.id);
          allWords = allWords.filter(w => w.id !== item.id);
          card.style.opacity = "0"; card.style.transform = "scale(0.95)"; card.style.transition = "0.2s";
          setTimeout(() => { buildFilterSidebar(); renderFiltered(); }, 200);
        } catch(err) { alert("Silme hatası: " + err.message); }
      });
      card.addEventListener("dblclick", () => openExampleModal(item.word, primaryMeaning(item)));
    }

    return card;
  }

  /* ─── Liste kartı ─────────────────────────────────── */
  function buildCard(item, idx, userId) {
    const card = document.createElement("article");
    card.className = "word-card";
    card.style.animationDelay = (idx * 25) + "ms";
    card.setAttribute("role", "listitem");
    card.setAttribute("aria-label", `${item.word}: ${primaryMeaning(item)}`);
    if (selectMode) card.classList.add("select-mode");
    if (selectedIds.has(item.id)) card.classList.add("selected");

    const artikel = extractArtikel(item.word);
    if (artikel) card.classList.add(`artikel-${artikel}`);

    const inner = document.createElement("div");
    inner.className = "card-inner";

    /* Select checkbox */
    if (selectMode) {
      const checkbox = document.createElement("div");
      checkbox.className = "card-checkbox" + (selectedIds.has(item.id) ? " checked" : "");
      checkbox.innerHTML = `<svg width="10" height="10" viewBox="0 0 12 10" fill="none"><polyline points="1,5 4.5,8.5 11,1" stroke="#0c0c12" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      inner.appendChild(checkbox);

      card.addEventListener("click", () => {
        if (selectedIds.has(item.id)) selectedIds.delete(item.id);
        else selectedIds.add(item.id);
        card.classList.toggle("selected", selectedIds.has(item.id));
        checkbox.classList.toggle("checked", selectedIds.has(item.id));
        updateBulkBar();
      });
    }

    /* ── Sol: içerik ── */
    const body = document.createElement("div");
    body.className = "card-body";

    const headline = document.createElement("div");
    headline.className = "word-headline";

    if (artikel) {
      const badge = document.createElement("span");
      badge.className = `artikel-badge ${artikel}`;
      badge.textContent = artikel;
      headline.appendChild(badge);
    }

    const germanEl = document.createElement("span");
    germanEl.className = "word-german";
    germanEl.textContent = item.word;
    germanEl.title = "Çift tıkla düzenle · Tek tıkla örnek cümleleri gör";
    germanEl.setAttribute("tabindex", "0");

    if (!selectMode) {
      germanEl.addEventListener("click", () => openExampleModal(item.word, primaryMeaning(item)));
      germanEl.addEventListener("dblclick", (e) => { e.stopPropagation(); if (!userId) return; startWordEdit(germanEl, item, userId); });
      germanEl.addEventListener("keydown", e => {
        if (e.key === "Enter" && !germanEl.isContentEditable) { e.preventDefault(); openExampleModal(item.word, primaryMeaning(item)); }
      });
    }
    headline.appendChild(germanEl);
    body.appendChild(headline);

    const meaningsRow = document.createElement("div");
    meaningsRow.className = "meanings-row";
    if (!selectMode) buildMeaningPills(meaningsRow, item, userId);
    else {
      const pill = document.createElement("span");
      pill.className = "meaning-pill primary";
      pill.textContent = primaryMeaning(item);
      meaningsRow.appendChild(pill);
    }
    body.appendChild(meaningsRow);

    const footer = document.createElement("div");
    footer.className = "card-footer";
    const tagsDiv = buildTagsRow(item, userId);
    footer.appendChild(tagsDiv);

    if (item.date) {
      const dateEl = document.createElement("span");
      dateEl.className = "word-date";
      dateEl.textContent = formatDate(item.date);
      footer.appendChild(dateEl);
    }
    body.appendChild(footer);
    inner.appendChild(body);

    /* ── Sağ: aksiyon butonları (sadece normal modda) ── */
    if (!selectMode) {
      const actions = document.createElement("div");
      actions.className = "card-actions";

      const editBtn = document.createElement("button");
      editBtn.className = "card-btn"; editBtn.title = "Kelimeyi düzenle";
      editBtn.setAttribute("aria-label", `${item.word} kelimesini düzenle`);
      editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
      editBtn.addEventListener("click", () => userId && openEditModal(userId, item, "word"));
      actions.appendChild(editBtn);

      const exBtn = document.createElement("button");
      exBtn.className = "card-btn example"; exBtn.title = "Örnek cümleler";
      exBtn.setAttribute("aria-label", `${item.word} için örnek cümleler`);
      exBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
      exBtn.addEventListener("click", () => openExampleModal(item.word, primaryMeaning(item)));
      actions.appendChild(exBtn);

      const tagBtn = document.createElement("button");
      tagBtn.className = "card-btn"; tagBtn.title = "Etiket düzenle";
      tagBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;
      tagBtn.addEventListener("click", () => userId && openEditModal(userId, item, "tags"));
      actions.appendChild(tagBtn);

      const delBtn = document.createElement("button");
      delBtn.className = "card-btn delete"; delBtn.title = "Sil";
      delBtn.setAttribute("aria-label", `${item.word} kelimesini sil`);
      delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
      delBtn.addEventListener("click", async () => {
        if (!userId) return;
        if (!confirm(`"${item.word}" silinsin mi?`)) return;
        try {
          await deleteWord(userId, item.id);
          allWords = allWords.filter(w => w.id !== item.id);
          card.style.opacity = "0"; card.style.transform = "translateY(-4px)"; card.style.transition = "opacity 0.2s, transform 0.2s";
          setTimeout(() => { buildFilterSidebar(); renderFiltered(); }, 200);
        } catch (err) { alert("Silme hatası: " + err.message); }
      });
      actions.appendChild(delBtn);
      inner.appendChild(actions);
    }

    card.appendChild(inner);
    return card;
  }

  /* ── Anlam pilleri ─────────────────────────────────── */
  function buildMeaningPills(container, item, userId) {
    container.innerHTML = "";
    const meanings = getMeanings(item);
    meanings.forEach((m, i) => {
      const pill = createMeaningPill(m, i === 0 ? "primary" : "secondary", item, i, userId, container);
      container.appendChild(pill);
    });

    const addBtn = document.createElement("button");
    addBtn.className = "add-meaning-btn";
    addBtn.setAttribute("aria-label", "Yeni anlam ekle");
    addBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> anlam ekle`;
    addBtn.addEventListener("click", () => { if (!userId) return; startNewMeaningInput(container, item, userId, addBtn); });
    container.appendChild(addBtn);
  }

  function createMeaningPill(meaning, type, item, meaningIndex, userId, container) {
    const pill = document.createElement("span");
    pill.className = `meaning-pill ${type}`;
    pill.setAttribute("tabindex","0"); pill.title = "Tıkla: düzenle";
    pill.setAttribute("role","button");
    pill.appendChild(document.createTextNode(meaning));

    const meanings = getMeanings(item);
    if (meanings.length > 1) {
      const delBtn = document.createElement("button");
      delBtn.className = "meaning-pill-del"; delBtn.innerHTML = "×"; delBtn.title = "Bu anlamı kaldır";
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!userId) return;
        const updated = getMeanings(item).filter((_,i) => i !== meaningIndex);
        if (!updated.length) return;
        try {
          await updateWord(userId, item.id, { meanings: updated, meaning: updated[0] });
          item.meanings = updated; item.meaning = updated[0];
          buildMeaningPills(container, item, userId);
        } catch(err) { alert("Güncelleme hatası: " + err.message); }
      });
      pill.appendChild(delBtn);
    }

    const startEdit = () => {
      if (!userId) return;
      pill.classList.add("editing");
      const input = document.createElement("input");
      input.value = meaning;
      pill.innerHTML = ""; pill.appendChild(input);
      input.focus(); input.select();

      const save = async () => {
        const val = input.value.trim();
        pill.classList.remove("editing");
        if (!val || val === meaning) { buildMeaningPills(container, item, userId); return; }
        const updated = getMeanings(item).slice();
        updated[meaningIndex] = val;
        try {
          await updateWord(userId, item.id, { meanings: updated, meaning: updated[0] });
          item.meanings = updated; item.meaning = updated[0];
        } catch(err) { alert("Güncelleme hatası: " + err.message); }
        buildMeaningPills(container, item, userId);
      };

      input.addEventListener("blur", save);
      input.addEventListener("keydown", e => {
        if (e.key === "Enter")  { e.preventDefault(); input.removeEventListener("blur", save); save(); }
        if (e.key === "Escape") { pill.classList.remove("editing"); buildMeaningPills(container, item, userId); }
      });
    };

    pill.addEventListener("click", startEdit);
    pill.addEventListener("keydown", e => { if (e.key==="Enter"||e.key===" ") { e.preventDefault(); startEdit(); } });
    return pill;
  }

  function startNewMeaningInput(container, item, userId, addBtn) {
    addBtn.style.display = "none";
    const tempPill = document.createElement("span");
    tempPill.className = "meaning-pill secondary editing";
    const input = document.createElement("input");
    input.placeholder = "yeni anlam…";
    tempPill.appendChild(input);
    container.insertBefore(tempPill, addBtn);
    input.focus();

    const cancel = () => { tempPill.remove(); addBtn.style.display = ""; };
    const save = async () => {
      const val = input.value.trim();
      if (!val) { cancel(); return; }
      const updated = [...getMeanings(item), val];
      try {
        await updateWord(userId, item.id, { meanings: updated, meaning: updated[0] });
        item.meanings = updated; item.meaning = updated[0];
      } catch(err) { alert("Güncelleme hatası: " + err.message); }
      buildMeaningPills(container, item, userId);
    };

    input.addEventListener("blur", save);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter")  { e.preventDefault(); input.removeEventListener("blur", save); save(); }
      if (e.key === "Escape") { input.removeEventListener("blur", save); cancel(); }
    });
  }

  /* ── Kelime inline düzenleme ─────────────────────── */
  function startWordEdit(el, item, userId) {
    const original = item.word;
    el.contentEditable = "true"; el.textContent = original; el.focus();
    const range = document.createRange();
    range.selectNodeContents(el); range.collapse(false);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);

    const save = async () => {
      el.contentEditable = "false";
      const val = el.textContent.trim();
      if (!val || val === original) { el.textContent = original; return; }
      try {
        await updateWord(userId, item.id, { word: val });
        item.word = val; el.textContent = val;
        const card = el.closest(".word-card");
        const newArt = extractArtikel(val);
        card?.classList.remove("artikel-der","artikel-die","artikel-das");
        if (newArt) card?.classList.add(`artikel-${newArt}`);
        const badge = card?.querySelector(".artikel-badge");
        if (badge) { badge.textContent = newArt || ""; badge.className = `artikel-badge ${newArt||""}`; }
      } catch(err) { el.textContent = original; alert("Güncelleme hatası: " + err.message); }
    };

    el.addEventListener("blur", save, { once: true });
    el.addEventListener("keydown", e => {
      if (e.key === "Enter")  { e.preventDefault(); el.removeEventListener("blur", save); save(); }
      if (e.key === "Escape") { el.removeEventListener("blur", save); el.contentEditable = "false"; el.textContent = original; }
    }, { once: true });
  }

  /* ── Etiket satırı ────────────────────────────────── */
  function buildTagsRow(item, userId) {
    const tagsDiv = document.createElement("div");
    tagsDiv.className = "word-tags";
    const hasTags = Array.isArray(item.tags) && item.tags.length > 0;
    if (hasTags) {
      item.tags.forEach(t => {
        const badge = document.createElement("span");
        badge.className = "word-tag-badge";
        badge.textContent = t;
        tagsDiv.appendChild(badge);
      });
    }
    if (!selectMode) {
      const addTagBtn = document.createElement("button");
      addTagBtn.className = "add-tag-inline";
      addTagBtn.textContent = hasTags ? "+ etiket" : "+ etiket ekle";
      addTagBtn.addEventListener("click", () => userId && openEditModal(userId, item, "tags"));
      tagsDiv.appendChild(addTagBtn);
    }
    return tagsDiv;
  }

  /* ── Düzenleme modalı ─────────────────────────────── */
  function openEditModal(userId, item, mode = "tags") {
    document.getElementById("editModalOverlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "editModalOverlay";
    overlay.className = "edit-modal-overlay";

    overlay.innerHTML = `
      <div class="edit-modal-box" role="dialog" aria-modal="true" aria-labelledby="editModalTitle">
        <div class="edit-modal-header">
          <h2 class="edit-modal-title" id="editModalTitle">${mode === "word" ? "Kelimeyi Düzenle" : "Etiket Düzenle"}</h2>
          <button id="editModalClose" class="edit-modal-close" aria-label="Kapat">×</button>
        </div>
        <div class="edit-modal-word-preview" id="_previewWord"></div>
        ${mode === "word" ? `
          <label class="edit-label">Almanca Kelime</label>
          <input id="editWordInput" class="edit-input" style="margin-bottom:14px" spellcheck="false"/>
          <label class="edit-label">Ana Anlam</label>
          <input id="editMeaningInput" class="edit-input" style="margin-bottom:14px" spellcheck="false"/>
        ` : ""}
        <label class="edit-label" style="margin-top:4px">Etiketler</label>
        <div id="editTagChips" class="edit-tag-chips"></div>
        <div class="edit-modal-actions">
          <button id="editCancelBtn" class="edit-cancel-btn">İptal</button>
          <button id="editSaveBtn"   class="edit-save-btn">Kaydet</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector("#_previewWord").innerHTML = `${esc(item.word)}<span class="preview-meaning">— ${esc(primaryMeaning(item))}</span>`;
    if (mode === "word") {
      overlay.querySelector("#editWordInput").value    = item.word;
      overlay.querySelector("#editMeaningInput").value = primaryMeaning(item);
    }
    renderTagChips("editTagChips", item.tags || [], extractAllTags(allWords));

    const close = () => overlay.remove();
    overlay.querySelector("#editModalClose").addEventListener("click", close);
    overlay.querySelector("#editCancelBtn").addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function handler(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", handler); }
    });

    overlay.querySelector("#editSaveBtn").addEventListener("click", async () => {
      const btn = overlay.querySelector("#editSaveBtn");
      if (mode === "word") {
        const newWord    = overlay.querySelector("#editWordInput")?.value.trim();
        const newMeaning = overlay.querySelector("#editMeaningInput")?.value.trim();
        if (!newWord || !newMeaning) return;
        const updatedMeanings = getMeanings(item).slice(); updatedMeanings[0] = newMeaning;
        const newTags = getSelectedTags("editTagChips");
        btn.disabled = true; btn.textContent = "Kaydediliyor…";
        try {
          await updateWord(userId, item.id, { word: newWord, meanings: updatedMeanings, meaning: newMeaning, tags: newTags });
          item.word = newWord; item.meanings = updatedMeanings; item.meaning = newMeaning; item.tags = newTags;
          close(); buildFilterSidebar(); renderFiltered();
        } catch(err) { btn.disabled = false; btn.textContent = "Kaydet"; alert(err.message); }
        return;
      }
      const newTags = getSelectedTags("editTagChips");
      btn.disabled = true; btn.textContent = "Kaydediliyor…";
      try {
        await updateWord(userId, item.id, { tags: newTags });
        item.tags = newTags; close(); buildFilterSidebar(); renderFiltered();
      } catch(err) { btn.disabled = false; btn.textContent = "Kaydet"; alert("Güncelleme hatası: " + err.message); }
    });

    setTimeout(() => overlay.querySelector("#editModalClose")?.focus(), 60);
  }

  /* ── Örnek cümle modalı ──────────────────────────── */
  async function openExampleModal(word, meaning) {
    document.getElementById("exampleModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "exampleModalOverlay";
    overlay.className = "edit-modal-overlay";
    overlay.innerHTML = `
      <div class="example-modal-box" role="dialog" aria-modal="true" aria-labelledby="exModalWord">
        <div class="edit-modal-header">
          <div>
            <div class="example-modal-word" id="exModalWord"></div>
            <div class="example-modal-meaning" id="exModalMeaning"></div>
          </div>
          <button id="exModalClose" class="edit-modal-close" aria-label="Kapat">×</button>
        </div>
        <div class="example-source-label">Örnek Cümleler</div>
        <div id="exampleSentences">
          <div class="example-item" style="text-align:center;color:#4b5563;font-size:13px;">Yükleniyor…</div>
        </div>
        <div style="margin-top:12px;font-size:10px;color:#374151;text-align:right;letter-spacing:0.04em;">KAYNAK: WIKTIONARY · TATOEBA</div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector("#exModalWord").textContent    = word;
    overlay.querySelector("#exModalMeaning").textContent = meaning;

    const close = () => overlay.remove();
    overlay.querySelector("#exModalClose").addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function h(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", h); }
    });

    setTimeout(() => overlay.querySelector("#exModalClose")?.focus(), 60);

    const bareWord = word.replace(/^(der|die|das|ein|eine)\s+/i,"").trim();
    const sents = await fetchExampleSentences(bareWord);
    const container = document.getElementById("exampleSentences");
    if (!container) return;

    container.innerHTML = sents.map((s, i) => {
      const highlighted = esc(s.original).replace(
        new RegExp(`(${esc(bareWord)}|${esc(bareWord.toLowerCase())})`, "gi"),
        `<strong>$1</strong>`
      );
      return `<div class="example-item">
        <div class="example-de">${highlighted}</div>
        <div class="example-meta">${i + 1}. örnek</div>
      </div>`;
    }).join("");
  }

  /* ─── Yardımcılar ────────────────────────────────── */
  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("tr-TR", { day:"2-digit", month:"short", year:"numeric" });
  }

  window.renderFiltered = renderFiltered;
});

/* ── Toast bildirimi ────────────────────────────────────── */
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    ${type === "success"
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
    }
    <span>${esc(message)}</span>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
