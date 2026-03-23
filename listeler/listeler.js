import { onAuthChange } from "../js/firebase.js";
import { getWords } from "../js/firebase.js";
import { getListeler, deleteListe, updateListe, saveListe } from "../js/listeler-firebase.js";
import { openListeModal } from "../src/components/listeModal.js";

/* ═══════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════ */
let allLists    = [];
let allWords    = [];
let currentUid  = null;

function esc(str) {
  return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function getMeanings(item) {
  if (Array.isArray(item.meanings) && item.meanings.length) return item.meanings;
  if (item.meaning) return [item.meaning];
  return [""];
}

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("tr-TR", { day:"2-digit", month:"short", year:"numeric" });
}

/* ═══════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  const listeGrid      = document.getElementById("listeGrid");
  const emptyState     = document.getElementById("emptyState");
  const loadingState   = document.getElementById("loadingState");
  const countBadge     = document.getElementById("listeCountBadge");
  const searchInput    = document.getElementById("listeSearch");
  const createBtn      = document.getElementById("createListHeaderBtn");
  const emptyCta       = document.getElementById("emptyCta");

  /* ─── Auth ─────────────────────────────────────────────── */
  onAuthChange(async (user) => {
    if (!user) return;
    currentUid = user.uid;
    await loadAll(user.uid);
  });

  async function loadAll(uid) {
    try {
      [allLists, allWords] = await Promise.all([getListeler(uid), getWords(uid)]);
      loadingState.style.display = "none";
      renderLists(allLists);
    } catch(err) {
      loadingState.innerHTML = `<span style="color:#e05252;font-size:13px">Yüklenemedi: ${esc(err.message)}</span>`;
    }
  }

  /* ─── Arama ─────────────────────────────────────────────── */
  searchInput?.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase().trim();
    const filtered = q ? allLists.filter(l => l.name.toLowerCase().includes(q) || (l.description||"").toLowerCase().includes(q)) : allLists;
    renderLists(filtered);
  });

  /* ─── Create butonları ──────────────────────────────────── */
  createBtn?.addEventListener("click", openCreate);
  emptyCta?.addEventListener("click", openCreate);

  function openCreate() {
    if (!currentUid) return;
    openListeModal({
      allWords,
      preSelectedIds: [],
      userId: currentUid,
      onSave: async ({ name, description, wordIds }) => {
        const id = await saveListe(currentUid, name, wordIds, description);
        allLists = await getListeler(currentUid);
        renderLists(allLists);
        showToast(`"${name}" listesi oluşturuldu!`, "success");
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  function renderLists(lists) {
    /* Kartları temizle (yükleme ve boş durum hariç) */
    [...listeGrid.querySelectorAll(".liste-card")].forEach(el => el.remove());

    const total = allLists.length;
    countBadge.textContent = total === 1 ? "1 liste" : `${total} liste`;

    if (!lists.length) {
      emptyState.style.display = total === 0 ? "block" : "none";
      /* Arama sonucu boş */
      if (total > 0 && !lists.length) {
        const noResult = document.createElement("div");
        noResult.className = "liste-no-result";
        noResult.textContent = "Bu aramaya uygun liste bulunamadı.";
        listeGrid.appendChild(noResult);
      }
      return;
    }
    emptyState.style.display = "none";

    lists.forEach((liste, idx) => {
      const card = buildListeCard(liste, idx);
      listeGrid.appendChild(card);
    });
  }

  /* ─── Liste kartı ────────────────────────────────────────── */
  function buildListeCard(liste, idx) {
    const card = document.createElement("article");
    card.className = "liste-card";
    card.style.animationDelay = (idx * 40) + "ms";
    card.setAttribute("role", "listitem");

    /* Kelime önizlemesi (ilk 5 kelime) */
    const previewWords = (liste.wordIds || [])
      .slice(0, 5)
      .map(id => allWords.find(w => w.id === id))
      .filter(Boolean);
    const remaining = (liste.wordIds?.length || 0) - previewWords.length;

    card.innerHTML = `
      <div class="liste-card-header">
        <div class="liste-card-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </div>
        <div class="liste-card-actions">
          <button class="liste-action-btn edit-btn" title="Listeyi düzenle" aria-label="Düzenle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="liste-action-btn delete-btn" title="Listeyi sil" aria-label="Sil">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>

      <h2 class="liste-card-name">${esc(liste.name)}</h2>
      ${liste.description ? `<p class="liste-card-desc">${esc(liste.description)}</p>` : ""}

      <div class="liste-card-meta">
        <span class="liste-word-count">${liste.wordCount || 0} kelime</span>
        <span class="liste-date">${formatDate(liste.created)}</span>
      </div>

      <div class="liste-preview-words">
        ${previewWords.map(w => `
          <span class="preview-word-chip">${esc(w.word)}</span>
        `).join("")}
        ${remaining > 0 ? `<span class="preview-word-chip preview-word-more">+${remaining}</span>` : ""}
      </div>

      <button class="liste-view-btn" data-id="${esc(liste.id)}">
        Kelimeleri Gör
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    `;

    /* ─── Event listeners ─────────────────────────── */
    card.querySelector(".edit-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openEditListe(liste);
    });

    card.querySelector(".delete-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`"${liste.name}" listesi silinsin mi?`)) return;
      try {
        await deleteListe(currentUid, liste.id);
        allLists = allLists.filter(l => l.id !== liste.id);
        card.style.opacity = "0"; card.style.transform = "scale(0.95)"; card.style.transition = "0.2s";
        setTimeout(() => renderLists(allLists), 220);
        showToast("Liste silindi.", "success");
      } catch(err) { alert("Silinemedi: " + err.message); }
    });

    card.querySelector(".liste-view-btn").addEventListener("click", () => {
      openListeViewModal(liste);
    });

    return card;
  }

  /* ─── Liste düzenleme ────────────────────────────────────── */
  function openEditListe(liste) {
    openListeModal({
      allWords,
      existingListe: liste,
      userId: currentUid,
      onSave: async ({ name, description, wordIds }) => {
        await updateListe(currentUid, liste.id, { name, description, wordIds, wordCount: wordIds.length });
        allLists = await getListeler(currentUid);
        renderLists(allLists);
        showToast("Liste güncellendi.", "success");
      }
    });
  }

  /* ─── Liste görüntüleme modalı ───────────────────────────── */
  function openListeViewModal(liste) {
    document.getElementById("__listeViewModal")?.remove();

    const words = (liste.wordIds || [])
      .map(id => allWords.find(w => w.id === id))
      .filter(Boolean);

    const overlay = document.createElement("div");
    overlay.id = "__listeViewModal";
    overlay.className = "lv-overlay";

    overlay.innerHTML = `
      <div class="lv-box" role="dialog" aria-modal="true" aria-labelledby="lvTitle">
        <div class="lv-header">
          <div>
            <h2 class="lv-title" id="lvTitle">${esc(liste.name)}</h2>
            ${liste.description ? `<p class="lv-desc">${esc(liste.description)}</p>` : ""}
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
            <span class="lv-count">${words.length} kelime</span>
            <button class="lv-close" id="lvClose" aria-label="Kapat">×</button>
          </div>
        </div>

        <div class="lv-search-wrap">
          <svg style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#374151;pointer-events:none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="lvSearch" class="lv-search" placeholder="Kelime ara…" autocomplete="off"/>
        </div>

        <div class="lv-word-list" id="lvWordList">
          ${renderLvWords(words, "")}
        </div>

        <div class="lv-footer">
          <button class="lv-edit-btn" id="lvEditBtn">Listeyi Düzenle</button>
          <button class="lv-close-btn" id="lvCloseBtn">Kapat</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    /* Search */
    overlay.querySelector("#lvSearch").addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = q ? words.filter(w => w.word.toLowerCase().includes(q) || getMeanings(w).join(" ").toLowerCase().includes(q)) : words;
      overlay.querySelector("#lvWordList").innerHTML = renderLvWords(filtered, q);
    });

    /* Buttons */
    const close = () => overlay.remove();
    overlay.querySelector("#lvClose").addEventListener("click", close);
    overlay.querySelector("#lvCloseBtn").addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    overlay.querySelector("#lvEditBtn").addEventListener("click", () => { close(); openEditListe(liste); });
    document.addEventListener("keydown", function h(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", h); }
    });

    setTimeout(() => overlay.querySelector("#lvClose")?.focus(), 60);
  }

  function renderLvWords(words, query) {
    if (!words.length) return `<div class="lv-empty">Kelime bulunamadı.</div>`;

    return words.map(w => {
      const art = w.word.match(/^(der|die|das)\s/i)?.[1]?.toLowerCase();
      const tags = Array.isArray(w.tags) ? w.tags : [];
      const levelTags = ["A1","A2","B1","B2","C1","C2"];

      const highlightWord = query
        ? esc(w.word).replace(new RegExp(`(${esc(query)})`, "gi"), `<mark>$1</mark>`)
        : esc(w.word);

      return `
        <div class="lv-word-row">
          <div class="lv-word-left">
            ${art ? `<span class="lv-artikel ${art}">${art}</span>` : ""}
            <div class="lv-word-info">
              <div class="lv-word-de">${highlightWord}</div>
              <div class="lv-word-tr">${esc(getMeanings(w)[0])}</div>
            </div>
          </div>
          <div class="lv-word-tags">
            ${tags.slice(0,3).map(t => `<span class="lv-tag ${levelTags.includes(t)?t:""}">${esc(t)}</span>`).join("")}
          </div>
        </div>
      `;
    }).join("");
  }
});

/* ── Toast ──────────────────────────────────────────────── */
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    ${type === "success"
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`}
    <span>${String(message).replace(/&/g,"&amp;").replace(/</g,"&lt;")}</span>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 300); }, 3200);
}

/* ── Liste view modal stilleri ──────────────────────────── */
(function injectLvStyles() {
  const s = document.createElement("style");
  s.textContent = `
  .lv-overlay {
    position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);
    z-index:20000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;
  }
  .lv-box {
    background:#111118;border:1px solid rgba(255,255,255,0.1);border-radius:18px;
    width:560px;max-width:100%;max-height:88vh;display:flex;flex-direction:column;
    box-shadow:0 40px 100px rgba(0,0,0,0.85);overflow:hidden;
    animation:lmSlideUp 0.22s cubic-bezier(0.16,1,0.3,1);
  }
  .lv-header { padding:22px 22px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-shrink:0; }
  .lv-title { font-family:'DM Serif Display',Georgia,serif;font-size:20px;font-weight:400;color:#f1ece0;margin:0 0 4px; }
  .lv-desc { font-size:13px;color:#6b7280;margin:0; }
  .lv-count { font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.2);color:#b8922e;white-space:nowrap; }
  .lv-close { background:none;border:1px solid rgba(255,255,255,0.08);border-radius:8px;width:30px;height:30px;color:#4b5563;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:0.15s; }
  .lv-close:hover { color:#9ca3af;border-color:rgba(255,255,255,0.18); }
  .lv-search-wrap { position:relative;padding:14px 22px 8px;flex-shrink:0; }
  .lv-search { width:100%;box-sizing:border-box;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);border-radius:9px;color:#e5e7eb;font-size:13px;font-family:inherit;padding:8px 12px 8px 34px;outline:none;transition:border-color 0.18s; }
  .lv-search:focus { border-color:rgba(201,168,76,0.3); }
  .lv-search::placeholder { color:#374151; }
  .lv-word-list { flex:1;overflow-y:auto;padding:0 22px;display:flex;flex-direction:column;gap:4px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.08) transparent; }
  .lv-word-list::-webkit-scrollbar { width:4px; }
  .lv-word-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08);border-radius:2px; }
  .lv-empty { text-align:center;padding:32px 0;color:#374151;font-size:13px; }
  .lv-word-row { display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border-radius:9px;border:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02);transition:0.15s; }
  .lv-word-row:hover { background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.08); }
  .lv-word-left { display:flex;align-items:center;gap:8px;min-width:0;flex:1; }
  .lv-artikel { font-size:10px;font-weight:700;letter-spacing:0.04em;padding:2px 6px;border-radius:4px;flex-shrink:0; }
  .lv-artikel.der { background:rgba(59,130,246,0.1);color:#60a5fa;border:1px solid rgba(59,130,246,0.18); }
  .lv-artikel.die { background:rgba(236,72,153,0.1);color:#f472b6;border:1px solid rgba(236,72,153,0.18); }
  .lv-artikel.das { background:rgba(16,185,129,0.1);color:#34d399;border:1px solid rgba(16,185,129,0.18); }
  .lv-word-info { min-width:0; }
  .lv-word-de { font-family:'DM Serif Display',Georgia,serif;font-size:14px;color:#f1ece0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
  .lv-word-de mark { background:rgba(201,168,76,0.2);color:#c9a84c;border-radius:2px;padding:0 1px; }
  .lv-word-tr { font-size:12px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
  .lv-word-tags { display:flex;gap:3px;flex-wrap:wrap;flex-shrink:0; }
  .lv-tag { padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;letter-spacing:0.02em;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);color:#4b5563; }
  .lv-tag.A1 { background:rgba(16,185,129,0.08);border-color:rgba(16,185,129,0.18);color:#34d399; }
  .lv-tag.A2 { background:rgba(59,130,246,0.08);border-color:rgba(59,130,246,0.18);color:#60a5fa; }
  .lv-tag.B1 { background:rgba(201,168,76,0.08);border-color:rgba(201,168,76,0.18);color:#c9a84c; }
  .lv-tag.B2 { background:rgba(236,72,153,0.08);border-color:rgba(236,72,153,0.18);color:#f472b6; }
  .lv-footer { padding:14px 22px;border-top:1px solid rgba(255,255,255,0.05);display:flex;gap:8px;flex-shrink:0; }
  .lv-edit-btn { flex:1;padding:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#6b7280;font-size:13px;font-family:inherit;cursor:pointer;transition:0.15s; }
  .lv-edit-btn:hover { color:#9ca3af;background:rgba(255,255,255,0.07); }
  .lv-close-btn { flex:1;padding:10px;background:#c9a84c;border:none;border-radius:10px;color:#0c0c12;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;transition:background 0.15s; }
  .lv-close-btn:hover { background:#d4b055; }
  `;
  document.head.appendChild(s);
})();