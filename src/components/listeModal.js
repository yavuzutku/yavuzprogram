/**
 * listeModal.js
 * Liste oluşturma / düzenleme modalı.
 *
 * Kullanım:
 *   import { openListeModal } from '../src/components/listeModal.js';
 *
 *   openListeModal({
 *     allWords,
 *     preSelectedIds: [...],   // opsiyonel
 *     existingListe: { id, name, description, wordIds }, // düzenleme modu
 *     userId,
 *     onSave: async ({ name, description, wordIds }) => { ... }
 *   });
 */

function esc(str) {
  return String(str ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function getMeanings(item) {
  if (Array.isArray(item.meanings) && item.meanings.length) return item.meanings;
  if (item.meaning) return [item.meaning];
  return [""];
}

function extractArtikel(word) {
  const m = String(word).match(/^(der|die|das)\s/i);
  return m ? m[1].toLowerCase() : null;
}

/* ─── Stil enjeksiyonu (bir kez) ─────────────────────── */
let styleInjected = false;
function injectStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const s = document.createElement("style");
  s.textContent = `
  .lm-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(8px);
    z-index: 20000;
    display: flex; align-items: center; justify-content: center;
    padding: 16px; box-sizing: border-box;
    animation: lmFadeIn 0.18s ease;
  }
  @keyframes lmFadeIn { from { opacity:0 } to { opacity:1 } }

  .lm-box {
    background: #111118;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 18px;
    width: 560px; max-width: 100%;
    max-height: 88vh;
    display: flex; flex-direction: column;
    box-shadow: 0 40px 100px rgba(0,0,0,0.85);
    animation: lmSlideUp 0.22s cubic-bezier(0.16,1,0.3,1);
    overflow: hidden;
  }
  @keyframes lmSlideUp {
    from { opacity:0; transform: translateY(18px) scale(0.98) }
    to   { opacity:1; transform: translateY(0)   scale(1) }
  }

  .lm-header {
    padding: 24px 24px 0;
    display: flex; justify-content: space-between; align-items: center;
    flex-shrink: 0;
  }
  .lm-title {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 20px; font-weight: 400; color: #f1ece0; margin: 0;
  }
  .lm-close {
    background: none; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px; width: 32px; height: 32px;
    color: #4b5563; cursor: pointer; font-size: 18px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    transition: 0.15s;
  }
  .lm-close:hover { color: #9ca3af; border-color: rgba(255,255,255,0.18); }

  .lm-fields { padding: 20px 24px 0; flex-shrink: 0; }

  .lm-label {
    display: block; font-size: 10px; font-weight: 600;
    color: #4b5563; text-transform: uppercase; letter-spacing: 0.08em;
    margin-bottom: 6px;
  }
  .lm-input {
    width: 100%; box-sizing: border-box;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px; color: #e5e7eb;
    font-size: 14px; font-family: inherit;
    padding: 10px 14px; outline: none;
    transition: border-color 0.18s; margin-bottom: 14px;
  }
  .lm-input:focus { border-color: rgba(201,168,76,0.45); }
  .lm-input::placeholder { color: #374151; }

  .lm-divider {
    height: 1px; background: rgba(255,255,255,0.05);
    margin: 4px 24px 0; flex-shrink: 0;
  }

  .lm-word-header {
    padding: 14px 24px 8px;
    display: flex; align-items: center;
    justify-content: space-between; flex-shrink: 0; gap: 10px;
  }
  .lm-word-search-wrap { position: relative; flex: 1; }
  .lm-word-search-icon {
    position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
    color: #374151; pointer-events: none;
  }
  .lm-word-search {
    width: 100%; box-sizing: border-box;
    background: rgba(255,255,255,0.035);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 9px; color: #e5e7eb;
    font-size: 13px; font-family: inherit;
    padding: 8px 12px 8px 34px; outline: none;
    transition: border-color 0.18s;
  }
  .lm-word-search:focus { border-color: rgba(201,168,76,0.3); }
  .lm-word-search::placeholder { color: #374151; }

  .lm-sel-info {
    font-size: 12px; font-weight: 600; color: #6b7280;
    white-space: nowrap; flex-shrink: 0;
  }
  .lm-sel-info span { color: #c9a84c; }

  .lm-select-all {
    background: none; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 7px; padding: 5px 10px;
    color: #4b5563; font-size: 11px; font-family: inherit;
    cursor: pointer; white-space: nowrap; transition: 0.15s; flex-shrink: 0;
  }
  .lm-select-all:hover { color: #c9a84c; border-color: rgba(201,168,76,0.25); }

  .lm-word-list {
    flex: 1; overflow-y: auto; padding: 0 24px;
    display: flex; flex-direction: column; gap: 4px;
    min-height: 180px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.08) transparent;
  }
  .lm-word-list::-webkit-scrollbar { width: 4px; }
  .lm-word-list::-webkit-scrollbar-track { background: transparent; }
  .lm-word-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

  .lm-word-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: 9px;
    border: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.02);
    cursor: pointer; transition: 0.15s; user-select: none;
  }
  .lm-word-item:hover { background: rgba(255,255,255,0.045); border-color: rgba(255,255,255,0.09); }
  .lm-word-item.selected {
    background: rgba(201,168,76,0.08);
    border-color: rgba(201,168,76,0.28);
  }

  .lm-checkbox {
    width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0;
    border: 1.5px solid rgba(255,255,255,0.15);
    background: transparent; display: flex; align-items: center; justify-content: center;
    transition: 0.15s;
  }
  .lm-word-item.selected .lm-checkbox {
    background: #c9a84c; border-color: #c9a84c;
  }
  .lm-checkbox svg { display: none; }
  .lm-word-item.selected .lm-checkbox svg { display: block; }

  .lm-word-info { flex: 1; min-width: 0; }
  .lm-word-de {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 14px; color: #f1ece0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .lm-word-tr {
    font-size: 12px; color: #6b7280; margin-top: 1px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .lm-word-tags { display: flex; gap: 3px; flex-wrap: wrap; flex-shrink: 0; }
  .lm-tag-badge {
    padding: 2px 6px; border-radius: 4px; font-size: 10px;
    font-weight: 600; letter-spacing: 0.02em;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
    color: #4b5563;
  }
  .lm-tag-badge.A1 { background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.18); color: #34d399; }
  .lm-tag-badge.A2 { background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.18); color: #60a5fa; }
  .lm-tag-badge.B1 { background: rgba(201,168,76,0.08); border-color: rgba(201,168,76,0.18); color: #c9a84c; }
  .lm-tag-badge.B2 { background: rgba(236,72,153,0.08); border-color: rgba(236,72,153,0.18); color: #f472b6; }

  .lm-empty {
    text-align: center; padding: 32px 0;
    color: #374151; font-size: 13px;
  }

  .lm-footer {
    padding: 16px 24px;
    border-top: 1px solid rgba(255,255,255,0.05);
    display: flex; gap: 8px; flex-shrink: 0;
  }
  .lm-cancel {
    flex: 1; padding: 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px; color: #6b7280;
    font-size: 14px; font-family: inherit;
    cursor: pointer; transition: 0.18s;
  }
  .lm-cancel:hover { background: rgba(255,255,255,0.07); color: #9ca3af; }
  .lm-save {
    flex: 2; padding: 10px;
    background: #c9a84c; border: none;
    border-radius: 10px; color: #0c0c12;
    font-size: 14px; font-weight: 700;
    font-family: inherit; cursor: pointer; transition: background 0.18s;
  }
  .lm-save:hover:not(:disabled) { background: #d4b055; }
  .lm-save:disabled { opacity: 0.4; cursor: not-allowed; }

  .lm-err {
    margin: 0 24px 10px;
    padding: 8px 12px; border-radius: 8px;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    color: #ef4444; font-size: 12px; flex-shrink: 0;
    display: none;
  }
  .lm-err.show { display: block; }
  `;
  document.head.appendChild(s);
}

/* ═══════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════ */
export function openListeModal({ allWords = [], preSelectedIds = [], existingListe = null, userId, onSave }) {
  injectStyles();
  document.getElementById("__listeModal")?.remove();

  const isEdit = !!existingListe;
  let selectedIds = new Set(preSelectedIds.length ? preSelectedIds : (existingListe?.wordIds ?? []));

  /* ── DOM ── */
  const overlay = document.createElement("div");
  overlay.className = "lm-overlay";
  overlay.id = "__listeModal";

  overlay.innerHTML = `
    <div class="lm-box" role="dialog" aria-modal="true" aria-labelledby="lmTitle">
      <div class="lm-header">
        <h2 class="lm-title" id="lmTitle">${isEdit ? "Listeyi Düzenle" : "Yeni Liste Oluştur"}</h2>
        <button class="lm-close" id="lmClose" aria-label="Kapat">×</button>
      </div>
      <div class="lm-fields">
        <label class="lm-label">Liste Adı *</label>
        <input id="lmName" class="lm-input" placeholder="örn. A2 Fiiller, Seyahat Kelimeleri…"
               value="${esc(existingListe?.name ?? "")}" spellcheck="false"/>
        <label class="lm-label">Açıklama <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#374151">(opsiyonel)</span></label>
        <input id="lmDesc" class="lm-input" placeholder="Bu liste hakkında kısa bir açıklama…"
               value="${esc(existingListe?.description ?? "")}" spellcheck="false"/>
      </div>
      <div class="lm-divider"></div>
      <div class="lm-word-header">
        <div class="lm-word-search-wrap">
          <svg class="lm-word-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="lmSearch" class="lm-word-search" placeholder="Kelime ara…" autocomplete="off"/>
        </div>
        <div class="lm-sel-info">Seçili: <span id="lmSelCount">${selectedIds.size}</span></div>
        <button class="lm-select-all" id="lmSelAll">Tümünü Seç</button>
      </div>
      <div class="lm-word-list" id="lmWordList"></div>
      <div class="lm-err" id="lmErr"></div>
      <div class="lm-footer">
        <button class="lm-cancel" id="lmCancel">İptal</button>
        <button class="lm-save" id="lmSave">${isEdit ? "Kaydet" : "Liste Oluştur"}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const nameEl      = overlay.querySelector("#lmName");
  const descEl      = overlay.querySelector("#lmDesc");
  const searchEl    = overlay.querySelector("#lmSearch");
  const listEl      = overlay.querySelector("#lmWordList");
  const selCountEl  = overlay.querySelector("#lmSelCount");
  const selAllBtn   = overlay.querySelector("#lmSelAll");
  const saveBtn     = overlay.querySelector("#lmSave");
  const errEl       = overlay.querySelector("#lmErr");

  let query = "";

  /* ── Render word list ── */
  function renderWords() {
    const q = query.toLowerCase().trim();
    const filtered = q
      ? allWords.filter(w =>
          w.word.toLowerCase().includes(q) ||
          (getMeanings(w).join(" ").toLowerCase().includes(q))
        )
      : allWords;

    if (!filtered.length) {
      listEl.innerHTML = `<div class="lm-empty">Kelime bulunamadı.</div>`;
      return;
    }

    listEl.innerHTML = "";
    filtered.forEach(w => {
      const isSelected = selectedIds.has(w.id);
      const art = extractArtikel(w.word);
      const tags = Array.isArray(w.tags) ? w.tags.slice(0, 3) : [];
      const levelTags = ["A1","A2","B1","B2","C1","C2"];

      const item = document.createElement("div");
      item.className = "lm-word-item" + (isSelected ? " selected" : "");
      item.dataset.id = w.id;
      item.innerHTML = `
        <div class="lm-checkbox">
          <svg width="10" height="10" viewBox="0 0 12 10" fill="none">
            <polyline points="1,5 4.5,8.5 11,1" stroke="#0c0c12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="lm-word-info">
          <div class="lm-word-de">${esc(w.word)}</div>
          <div class="lm-word-tr">${esc(getMeanings(w)[0])}</div>
        </div>
        <div class="lm-word-tags">
          ${tags.map(t => `<span class="lm-tag-badge ${levelTags.includes(t)?t:""}">${esc(t)}</span>`).join("")}
        </div>
      `;

      item.addEventListener("click", () => {
        if (selectedIds.has(w.id)) selectedIds.delete(w.id);
        else selectedIds.add(w.id);
        item.classList.toggle("selected", selectedIds.has(w.id));
        selCountEl.textContent = selectedIds.size;
        updateSelAllBtn();
      });

      listEl.appendChild(item);
    });
  }

  function updateSelAllBtn() {
    const q = query.toLowerCase().trim();
    const filtered = q ? allWords.filter(w => w.word.toLowerCase().includes(q) || getMeanings(w).join(" ").toLowerCase().includes(q)) : allWords;
    const allSel = filtered.length > 0 && filtered.every(w => selectedIds.has(w.id));
    selAllBtn.textContent = allSel ? "Seçimi Kaldır" : "Tümünü Seç";
  }

  selAllBtn.addEventListener("click", () => {
    const q = query.toLowerCase().trim();
    const filtered = q ? allWords.filter(w => w.word.toLowerCase().includes(q) || getMeanings(w).join(" ").toLowerCase().includes(q)) : allWords;
    const allSel = filtered.every(w => selectedIds.has(w.id));
    filtered.forEach(w => allSel ? selectedIds.delete(w.id) : selectedIds.add(w.id));
    selCountEl.textContent = selectedIds.size;
    renderWords();
    updateSelAllBtn();
  });

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    renderWords();
    updateSelAllBtn();
  });

  renderWords();

  /* ── Kaydet ── */
  saveBtn.addEventListener("click", async () => {
    errEl.classList.remove("show");
    const name = nameEl.value.trim();
    const desc = descEl.value.trim();

    if (!name) {
      errEl.textContent = "Liste adı zorunludur.";
      errEl.classList.add("show");
      nameEl.focus();
      return;
    }
    if (!selectedIds.size) {
      errEl.textContent = "Lütfen en az bir kelime seç.";
      errEl.classList.add("show");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Kaydediliyor…";
    try {
      await onSave({ name, description: desc, wordIds: [...selectedIds] });
      close();
    } catch(err) {
      errEl.textContent = err.message;
      errEl.classList.add("show");
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? "Kaydet" : "Liste Oluştur";
    }
  });

  /* ── Kapat ── */
  const close = () => overlay.remove();
  overlay.querySelector("#lmClose").addEventListener("click", close);
  overlay.querySelector("#lmCancel").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
  });

  setTimeout(() => nameEl.focus(), 80);
}