import { getWords, deleteWord, updateWord, onAuthChange } from "../js/firebase.js";
import { showLemmaHintOnce } from '../src/components/lemmaHint.js';
import { renderTagChips, getSelectedTags, extractAllTags } from "../js/tag.js";

/* ═══════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════ */
let allWords        = [];
let activeTagFilter = null;
const exampleCache  = new Map();

/* ─── HTML escape ──────────────────────────────────────── */
function esc(str) {
  return String(str ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

/* ─── Çoklu anlam yardımcıları ─────────────────────────── */
function getMeanings(item) {
  if (Array.isArray(item.meanings) && item.meanings.length > 0) return item.meanings;
  if (item.meaning) return [item.meaning];
  return [""];
}

function primaryMeaning(item)  { return getMeanings(item)[0] || ""; }
function extraMeanings(item)   { return getMeanings(item).slice(1); }

/* ─── Artikel tespiti ──────────────────────────────────── */
function extractArtikel(word) {
  const m = String(word).match(/^(der|die|das)\s/i);
  return m ? m[1].toLowerCase() : null;
}

/* ─── Kelime sayısı ────────────────────────────────────── */
function wordCount(t) { return t.trim().split(/\s+/).length; }

/* ─── Wikitext temizleyici ─────────────────────────────── */
function cleanWikitext(text) {
  return text
    .replace(/\{\{[^{}]*\}\}/g,"").replace(/\}\}/g,"").replace(/\{\{/g,"")
    .replace(/'{2,3}/g,"")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g,"$1")
    .replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ")
    .replace(/[„""‟«»'']/g,"")
    .replace(/\s*[A-ZÄÖÜ][^.!?]*\d{4}\s*\.?\s*$/,"")
    .replace(/\s{2,}/g," ").trim();
}

/* ─── Örnek cümleler ───────────────────────────────────── */
async function fetchFromWiktionary(word) {
  const cap  = word.charAt(0).toUpperCase() + word.slice(1);
  const params = new URLSearchParams({ action:"parse", page:cap, prop:"wikitext", format:"json", origin:"*" });
  const data   = await (await fetch("https://de.wiktionary.org/w/api.php?"+params)).json();
  const wt     = data?.parse?.wikitext?.["*"] || "";
  const sents  = [];
  let inB      = false;
  for (const line of wt.split("\n")) {
    if (line.includes("Beispiele}}") || line.includes("Beispiele:")) { inB = true; continue; }
    if (inB && line.match(/^\s*:?\{\{(Herkunft|Synonyme|Übersetzungen|Wortbildungen|Bedeutungen|Redewendungen)/)) { inB = false; continue; }
    if (inB && line.trim()) {
      const m = line.match(/^::?\[\d+\]\s*(.+)/);
      if (m) { const t = cleanWikitext(m[1]); if (t.length>10 && wordCount(t)>5) sents.push(t); }
    }
  }
  return sents.sort((a,b)=>wordCount(a)-wordCount(b)).slice(0,2).map(s=>({original:s}));
}

async function fetchFromTatoeba(word) {
  const data = await (await fetch(`https://api.tatoeba.org/v1/sentences?q=${encodeURIComponent(word)}&lang=deu`)).json();
  // fetchFromTatoeba fonksiyonunda, filter satırını değiştir:
  return (data.data||[])
    .filter(s => wordCount(s.text) > 4 && wordCount(s.text) < 30)  // makul aralık
    .sort((a,b) => wordCount(a.text) - wordCount(b.text))
    .slice(0,3)   // 2 → 3
    .map(s=>({original:s.text}));}

async function fetchExampleSentences(word) {
  if (exampleCache.has(word)) return exampleCache.get(word);
  let sents = [];
  try { sents = await fetchFromWiktionary(word); } catch(_) {}
  if (sents.length < 2) {
    try { const t = await fetchFromTatoeba(word); sents = [...sents, ...t.slice(0,2-sents.length)]; } catch(_) {}
  }
  if (!sents.length) sents = [{ original: "Bu kelime için örnek cümle bulunamadı." }];
  exampleCache.set(word, sents);
  return sents;
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

  /* ─── Arama temizle butonu ─────────────────────────── */
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

  /* ─── Auth ─────────────────────────────────────────── */
  onAuthChange(async (user) => {
    if (user) await loadWords(user.uid);
  });

  async function loadWords(userId) {
    wordCountBadge.textContent = "—";
    try {
      allWords = await getWords(userId);
      buildFilterSidebar();
      renderFiltered();
    } catch (err) {
      wordList.innerHTML = `<div style="padding:20px;color:#e05252;font-size:14px;text-align:center;">Kelimeler yüklenemedi: ${esc(err.message)}</div>`;
    }
  }

  /* ─── Filtre Sidebar ─────────────────────────────── */
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
      const item = document.createElement("button");
      item.className = "filter-tag-item" + (activeTagFilter === tag ? " active" : "");
      item.setAttribute("aria-pressed", activeTagFilter === tag);
      item.innerHTML = `<span>${esc(tag)}</span><span class="filter-count-badge">${count}</span>`;
      item.addEventListener("click", () => {
        activeTagFilter = (activeTagFilter === tag) ? null : tag;
        buildFilterSidebar(); renderFiltered();
      });
      filterTagList.appendChild(item);
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
  }

  function renderFiltered() {
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
    render(list);
  }

  /* ═══════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════ */
  function render(list) {
    [...wordList.querySelectorAll(".word-card")].forEach(el => el.remove());

    const total = allWords.length;
    wordCountBadge.textContent = total === 1 ? "1 kelime" : `${total} kelime`;

    if (!list.length) { emptyState.style.display = "block"; return; }
    emptyState.style.display = "none";

    const userId = window.getUserId?.();

    list.forEach((item, idx) => {
      const card = buildCard(item, idx, userId);
      wordList.appendChild(card);
    });
  }

  /* ─── Kart oluşturucu ─────────────────────────────── */
  function buildCard(item, idx, userId) {
    const card = document.createElement("article");
    card.className = "word-card";
    card.style.animationDelay = (idx * 25) + "ms";
    card.setAttribute("role", "listitem");
    card.setAttribute("aria-label", `${item.word}: ${primaryMeaning(item)}`);

    const artikel = extractArtikel(item.word);
    if (artikel) card.classList.add(`artikel-${artikel}`);

    /* ── İç wrapper ── */
    const inner = document.createElement("div");
    inner.className = "card-inner";

    /* ── Sol: içerik ── */
    const body = document.createElement("div");
    body.className = "card-body";

    /* Başlık satırı: artikel badge + kelime */
    const headline = document.createElement("div");
    headline.className = "word-headline";

    if (artikel) {
      const badge = document.createElement("span");
      badge.className = `artikel-badge ${artikel}`;
      badge.textContent = artikel;
      headline.appendChild(badge);
    }

    /* Almanca kelime — çift tıkla inline düzenle */
    const germanEl = document.createElement("span");
    germanEl.className = "word-german";
    germanEl.textContent = item.word;
    germanEl.title = "Çift tıkla düzenle · Tek tıkla örnek cümleleri gör";
    germanEl.setAttribute("tabindex", "0");

    germanEl.addEventListener("click", () => openExampleModal(item.word, primaryMeaning(item)));
    germanEl.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (!userId) return;
      startWordEdit(germanEl, item, userId);
    });
    germanEl.addEventListener("keydown", e => {
      if (e.key === "Enter" && !germanEl.isContentEditable) {
        e.preventDefault();
        openExampleModal(item.word, primaryMeaning(item));
      }
    });
    headline.appendChild(germanEl);
    body.appendChild(headline);

    /* Anlamlar satırı */
    const meaningsRow = document.createElement("div");
    meaningsRow.className = "meanings-row";
    buildMeaningPills(meaningsRow, item, userId);
    body.appendChild(meaningsRow);

    /* Footer: etiketler + tarih */
    const footer = document.createElement("div");
    footer.className = "card-footer";

    const tagsDiv = buildTagsRow(item, userId);
    footer.appendChild(tagsDiv);

    if (item.date) {
      const dateEl = document.createElement("span");
      dateEl.className = "word-date";
      dateEl.textContent = formatDate(item.date);
      dateEl.setAttribute("aria-label", `Eklenme tarihi: ${formatDate(item.date)}`);
      footer.appendChild(dateEl);
    }

    body.appendChild(footer);
    inner.appendChild(body);

    /* ── Sağ: aksiyon butonları ── */
    const actions = document.createElement("div");
    actions.className = "card-actions";
    /* Düzenle butonu — tüm alanları düzenlemek için modal açar */
    const editBtn = document.createElement("button");
    editBtn.className = "card-btn";
    editBtn.title = "Kelimeyi düzenle";
    editBtn.setAttribute("aria-label", `${item.word} kelimesini düzenle`);
    editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    editBtn.addEventListener("click", () => userId && openEditModal(userId, item, "word"));
    actions.appendChild(editBtn);
    /* Örnek buton */
    const exBtn = document.createElement("button");
    exBtn.className = "card-btn example";
    exBtn.title = "Örnek cümleler";
    exBtn.setAttribute("aria-label", `${item.word} için örnek cümleler`);
    exBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    exBtn.addEventListener("click", () => openExampleModal(item.word, primaryMeaning(item)));
    actions.appendChild(exBtn);

    /* Etiket butonu */
    const tagBtn = document.createElement("button");
    tagBtn.className = "card-btn";
    tagBtn.title = "Etiket düzenle";
    tagBtn.setAttribute("aria-label", "Etiket düzenle");
    tagBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;
    tagBtn.addEventListener("click", () => userId && openEditModal(userId, item, "tags"));
    actions.appendChild(tagBtn);

    /* Sil butonu */
    const delBtn = document.createElement("button");
    delBtn.className = "card-btn delete";
    delBtn.title = "Sil";
    delBtn.setAttribute("aria-label", `${item.word} kelimesini sil`);
    delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
    delBtn.addEventListener("click", async () => {
      if (!userId) return;
      if (!confirm(`"${item.word}" silinsin mi?`)) return;
      try {
        await deleteWord(userId, item.id);
        allWords = allWords.filter(w => w.id !== item.id);
        card.style.opacity = "0";
        card.style.transform = "translateY(-4px)";
        card.style.transition = "opacity 0.2s, transform 0.2s";
        setTimeout(() => { buildFilterSidebar(); renderFiltered(); }, 200);
      } catch (err) { alert("Silme hatası: " + err.message); }
    });
    actions.appendChild(delBtn);

    inner.appendChild(actions);
    card.appendChild(inner);
    return card;
  }

  /* ═══════════════════════════════════════════════════
     ANLAM PİLL'LERİ + INLINE DÜZENLEME
     ═══════════════════════════════════════════════════ */
  function buildMeaningPills(container, item, userId) {
    container.innerHTML = "";
    const meanings = getMeanings(item);

    meanings.forEach((m, i) => {
      const pill = createMeaningPill(m, i === 0 ? "primary" : "secondary", item, i, userId, container);
      container.appendChild(pill);
    });

    /* Anlam ekle butonu */
    const addBtn = document.createElement("button");
    addBtn.className = "add-meaning-btn";
    addBtn.setAttribute("aria-label", "Yeni anlam ekle");
    addBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> anlam ekle`;
    addBtn.addEventListener("click", () => {
      if (!userId) return;
      startNewMeaningInput(container, item, userId, addBtn);
    });
    container.appendChild(addBtn);
  }

  function createMeaningPill(meaning, type, item, meaningIndex, userId, container) {
    const pill = document.createElement("span");
    pill.className = `meaning-pill ${type}`;
    pill.setAttribute("tabindex", "0");
    pill.title = "Tıkla: düzenle";
    pill.setAttribute("role", "button");
    pill.setAttribute("aria-label", `Anlam ${meaningIndex + 1}: ${meaning}. Düzenlemek için tıkla.`);

    const textNode = document.createTextNode(meaning);
    pill.appendChild(textNode);

    /* Sil butonu (primary dışında ve birden fazla anlam varsa) */
    const meanings = getMeanings(item);
    if (meanings.length > 1) {
      const delBtn = document.createElement("button");
      delBtn.className = "meaning-pill-del";
      delBtn.innerHTML = "×";
      delBtn.title = "Bu anlamı kaldır";
      delBtn.setAttribute("aria-label", `"${meaning}" anlamını kaldır`);
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!userId) return;
        const updated = getMeanings(item).filter((_, i) => i !== meaningIndex);
        if (!updated.length) return;
        try {
          await updateWord(userId, item.id, { meanings: updated, meaning: updated[0] });
          item.meanings = updated;
          item.meaning  = updated[0];
          buildMeaningPills(container, item, userId);
        } catch(err) { alert("Güncelleme hatası: " + err.message); }
      });
      pill.appendChild(delBtn);
    }

    /* Inline düzenleme */
    const startEdit = () => {
      if (!userId) return;
      pill.classList.add("editing");
      const input = document.createElement("input");
      input.value = meaning;
      input.setAttribute("aria-label", "Anlamı düzenle");
      /* Mevcut içeriği input ile değiştir */
      pill.innerHTML = "";
      pill.appendChild(input);
      input.focus();
      input.select();

      const save = async () => {
        const val = input.value.trim();
        pill.classList.remove("editing");
        if (!val || val === meaning) {
          buildMeaningPills(container, item, userId);
          return;
        }
        const updated = getMeanings(item).slice();
        updated[meaningIndex] = val;
        try {
          await updateWord(userId, item.id, { meanings: updated, meaning: updated[0] });
          item.meanings = updated;
          item.meaning  = updated[0];
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
    pill.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startEdit(); }
    });

    return pill;
  }

  function startNewMeaningInput(container, item, userId, addBtn) {
    /* Geçici giriş alanı */
    addBtn.style.display = "none";

    const tempPill = document.createElement("span");
    tempPill.className = "meaning-pill secondary editing";

    const input = document.createElement("input");
    input.placeholder = "yeni anlam…";
    input.setAttribute("aria-label", "Yeni anlam gir");
    tempPill.appendChild(input);
    container.insertBefore(tempPill, addBtn);
    input.focus();

    const cancel = () => {
      tempPill.remove();
      addBtn.style.display = "";
    };

    const save = async () => {
      const val = input.value.trim();
      if (!val) { cancel(); return; }
      const updated = [...getMeanings(item), val];
      try {
        await updateWord(userId, item.id, { meanings: updated, meaning: updated[0] });
        item.meanings = updated;
        item.meaning  = updated[0];
      } catch(err) { alert("Güncelleme hatası: " + err.message); }
      buildMeaningPills(container, item, userId);
    };

    input.addEventListener("blur", save);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter")  { e.preventDefault(); input.removeEventListener("blur", save); save(); }
      if (e.key === "Escape") { input.removeEventListener("blur", save); cancel(); }
    });
  }

  /* ═══════════════════════════════════════════════════
     ALMANCA KELİME INLINE DÜZENLEME
     ═══════════════════════════════════════════════════ */
  function startWordEdit(el, item, userId) {
    const original = item.word;
    el.contentEditable = "true";
    el.textContent = original;
    el.focus();

    /* Cursor sona al */
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const save = async () => {
      el.contentEditable = "false";
      const val = el.textContent.trim();
      if (!val || val === original) { el.textContent = original; return; }
      try {
        await updateWord(userId, item.id, { word: val });
        item.word = val;
        el.textContent = val;
        /* Artikel badge'i güncelle */
        const card   = el.closest(".word-card");
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

  /* ═══════════════════════════════════════════════════
     ETİKET SATIRI
     ═══════════════════════════════════════════════════ */
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
    const addTagBtn = document.createElement("button");
    addTagBtn.className = "add-tag-inline";
    addTagBtn.textContent = hasTags ? "+ etiket" : "+ etiket ekle";
    addTagBtn.setAttribute("aria-label", hasTags ? "Etiket ekle" : "İlk etiketi ekle");
    addTagBtn.addEventListener("click", () => userId && openEditModal(userId, item, "tags"));
    tagsDiv.appendChild(addTagBtn);
    return tagsDiv;
  }

  /* ═══════════════════════════════════════════════════
     DÜZENLEME MODALİ — "tags" modu
     (Anlamlar inline düzenleniyor; modal sadece etiketler için)
     ═══════════════════════════════════════════════════ */
  function openEditModal(userId, item, mode = "tags") {
    document.getElementById("editModalOverlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "editModalOverlay";
    overlay.className = "edit-modal-overlay";

    overlay.innerHTML = `
      <div class="edit-modal-box" role="dialog" aria-modal="true" aria-labelledby="editModalTitle">

        <div class="edit-modal-header">
          <h2 class="edit-modal-title" id="editModalTitle">
            ${mode === "word" ? "Kelimeyi Düzenle" : "Etiket Düzenle"}
          </h2>
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

    /* Önizleme */
    overlay.querySelector("#_previewWord").innerHTML = `${esc(item.word)}<span class="preview-meaning">— ${esc(primaryMeaning(item))}</span>`;
    if (mode === "word") {
      overlay.querySelector("#editWordInput").value    = item.word;
      overlay.querySelector("#editMeaningInput").value = primaryMeaning(item);
    }
    renderTagChips("editTagChips", item.tags || [], extractAllTags(allWords));

    const close = () => { overlay.remove(); };
    overlay.querySelector("#editModalClose").addEventListener("click", close);
    overlay.querySelector("#editCancelBtn").addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function handler(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", handler); }
    });

    overlay.querySelector("#editSaveBtn").addEventListener("click", async () => {
      const btn     = overlay.querySelector("#editSaveBtn");
      if (mode === "word") {
        const newWord    = overlay.querySelector("#editWordInput")?.value.trim();
        const newMeaning = overlay.querySelector("#editMeaningInput")?.value.trim();
        if (!newWord || !newMeaning) return;
        const updatedMeanings = getMeanings(item).slice();
        updatedMeanings[0]    = newMeaning;
        const newTags         = getSelectedTags("editTagChips");
        btn.disabled    = true; btn.textContent = "Kaydediliyor…";
        try {
          await updateWord(userId, item.id, { word: newWord, meanings: updatedMeanings, meaning: newMeaning, tags: newTags });
          item.word = newWord; item.meanings = updatedMeanings; item.meaning = newMeaning; item.tags = newTags;
          close(); buildFilterSidebar(); renderFiltered();
        } catch(err) { btn.disabled = false; btn.textContent = "Kaydet"; alert(err.message); }
        return; // tags moduna düşmesin
      }
      const newTags = getSelectedTags("editTagChips");
      
      btn.disabled    = true;
      btn.textContent = "Kaydediliyor…";
      try {
        await updateWord(userId, item.id, { tags: newTags });
        item.tags = newTags;
        close();
        buildFilterSidebar();
        renderFiltered();
      } catch (err) {
        btn.disabled    = false;
        btn.textContent = "Kaydet";
        alert("Güncelleme hatası: " + err.message);
      }
    });

    /* Focus trap */
    setTimeout(() => overlay.querySelector("#editModalClose")?.focus(), 60);
  }

  /* ═══════════════════════════════════════════════════
     ÖRNEK CÜMLE MODALİ
     ═══════════════════════════════════════════════════ */
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

    const sents = await fetchExampleSentences(word);
    const container = document.getElementById("exampleSentences");
    if (!container) return;

    /* Vurgulama regex */
    const regex = new RegExp(
      `(${word.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}|${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`,
      "g"
    );

    container.innerHTML = sents.map((s, i) => {
      const highlighted = esc(s.original).replace(
        new RegExp(`(${esc(word)}|${esc(word.toLowerCase())})`, "gi"),
        `<strong>$1</strong>`
      );
      return `<div class="example-item">
        <div class="example-de">${highlighted}</div>
        <div class="example-meta">${i + 1}. örnek</div>
      </div>`;
    }).join("");
  }

  /* ─── Yardımcı ──────────────────────────────────── */
  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("tr-TR", { day:"2-digit", month:"short", year:"numeric" });
  }

});