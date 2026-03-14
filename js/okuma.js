/* ═══════════════════════════════════════════════════════════
   okuma.js  —  AlmancaPratik Okuma Modu
   ═══════════════════════════════════════════════════════════
   - sessionStorage'dan hem savedText hem parsedBlocks okur
   - parsedBlocks varsa kitap gibi biçimlendirilmiş HTML üretir
   - Yoksa plain-text fallback kullanır
   - Kelime seçimi → anlam popup → sözlüğe kaydet
   - Tema, font boyutu, odak modu, ilerleme çubuğu
   ═══════════════════════════════════════════════════════════ */

import { saveWord, getWords } from "./firebase.js";
import { renderTagChips, getSelectedTags, extractAllTags } from "./tag.js";
import {
  fetchWikiData,
  fetchTranslate,
  normalizeGermanWord,
  artikelBadgeHtml,
  escapeHtml,
} from "./german.js";

/* ══════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════ */
let _selectedWord  = "";
let _popupWikiData = null;
let _lastTranslated = "";
let _userWords     = [];
let _currentFontSize = 19;
let _themeIdx      = 0;
let _serifMode     = true;

const THEMES = ["dark", "sepia", "light"];

/* ══════════════════════════════════════════════════════════
   BAŞLANGIÇ
   ══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {

  const rawText     = sessionStorage.getItem("savedText") || "";
  const blocksJson  = sessionStorage.getItem("parsedBlocks");
  const readerBody  = document.getElementById("readerBody");

  if (!rawText.trim()) {
    readerBody.innerHTML = `<p style="color:var(--text-muted);font-style:italic;text-align:center;padding:40px 0">
      Metin bulunamadı. Lütfen <a href="../metin/" style="color:var(--gold)">Metin sayfasına</a> dönüp tekrar deneyin.</p>`;
    return;
  }

  /* Metin yükleme: parsedBlocks varsa kitap görünümü */
  if (blocksJson) {
    try {
      const blocks = JSON.parse(blocksJson);
      readerBody.innerHTML = blocksToHtml(blocks);
    } catch {
      loadPlainText(readerBody, rawText);
    }
  } else {
    loadPlainText(readerBody, rawText);
  }

  /* Meta: kelime sayısı + okuma süresi */
  updateMeta(rawText);

  /* Kullanıcı kelimelerini yükle */
  try {
    const userId = window.getUserId?.();
    if (userId) _userWords = await getWords(userId);
  } catch (_) {}

  /* Tercihler */
  restorePrefs();
  initProgressBar();
  initWordSelection();
  bindToolbar();

  /* Modal Enter tuşu */
  document.getElementById("modalMeaningInput")
    .addEventListener("keydown", e => { if (e.key === "Enter") saveWordFromModal(); });
});

/* ══════════════════════════════════════════════════════════
   METİN RENDER
   ══════════════════════════════════════════════════════════ */

/** parsedBlocks dizisini okuma sayfası HTML'ine çevirir */
function blocksToHtml(blocks) {
  const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  let html = "";
  for (const b of blocks) {
    if      (b.type === "title")   html += `<h2 class="rb-title">${esc(b.text)}</h2>`;
    else if (b.type === "dialog")  html += `<p class="rb-dialog">${esc(b.text)}</p>`;
    else if (b.type === "quote")   html += `<p class="rb-quote">${esc(b.text)}</p>`;
    else if (b.type === "section") html += `<div class="rb-section">\u2726 \u2003 \u2726 \u2003 \u2726</div>`;
    else if (b.type === "para")    html += `<p class="rb-para">${b.lines.map(esc).join("<br>")}</p>`;
  }
  return html;
}

/** parsedBlocks yoksa plain metin fallback */
function loadPlainText(el, text) {
  el.classList.add("plain-text");
  el.textContent = text;
}

/* ══════════════════════════════════════════════════════════
   META
   ══════════════════════════════════════════════════════════ */
function updateMeta(text) {
  const words   = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  const el      = document.getElementById("readingMeta");
  if (el) el.textContent = `${words.toLocaleString("tr")} kelime \u00b7 ~${minutes} dk`;
}

/* ══════════════════════════════════════════════════════════
   İLERLEME ÇUBUĞU
   ══════════════════════════════════════════════════════════ */
function initProgressBar() {
  const bar = document.getElementById("progressBar");
  if (!bar) return;
  window.addEventListener("scroll", () => {
    const total   = document.documentElement.scrollHeight - window.innerHeight;
    const current = window.scrollY;
    bar.style.width = total > 0 ? Math.min(100, (current / total) * 100) + "%" : "0%";
  });
}

/* ══════════════════════════════════════════════════════════
   TOOLBAR BUTONLARI
   ══════════════════════════════════════════════════════════ */
function bindToolbar() {
  document.getElementById("backBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("parsedBlocks");
    const ret = sessionStorage.getItem("returnPage");
    window.location.href = ret ? "../" + ret : "../metin/";
  });

  document.getElementById("addWordBtn")?.addEventListener("click", () => {
    if (!_selectedWord) {
      showToast("Önce metinden bir kelime seçin.", "error");
      return;
    }
    openWordModal();
  });

  document.getElementById("fontDecBtn")?.addEventListener("click", () => {
    _currentFontSize = Math.max(13, _currentFontSize - 1);
    applyFontSize();
  });

  document.getElementById("fontIncBtn")?.addEventListener("click", () => {
    _currentFontSize = Math.min(32, _currentFontSize + 1);
    applyFontSize();
  });

  document.getElementById("fontToggleBtn")?.addEventListener("click", () => {
    _serifMode = !_serifMode;
    document.getElementById("readerBody").style.fontFamily = _serifMode
      ? "var(--reader-font)"
      : "'DM Sans', system-ui, sans-serif";
    const btn = document.getElementById("fontToggleBtn");
    if (btn) btn.textContent = _serifMode ? "Tf" : "Ss";
    sessionStorage.setItem("rd_serif", _serifMode ? "1" : "0");
  });

  document.getElementById("themeBtn")?.addEventListener("click", () => {
    _themeIdx = (_themeIdx + 1) % THEMES.length;
    applyTheme(THEMES[_themeIdx]);
    sessionStorage.setItem("rd_theme", _themeIdx);
  });

  document.getElementById("focusBtn")?.addEventListener("click", () => {
    document.body.classList.toggle("focus-mode");
    const on  = document.body.classList.contains("focus-mode");
    const btn = document.getElementById("focusBtn");
    if (btn) btn.textContent = on ? "\u229E" : "\u22A1";
  });
}

function applyFontSize() {
  document.getElementById("readerBody").style.fontSize = _currentFontSize + "px";
  sessionStorage.setItem("rd_fontSize", _currentFontSize);
}

function applyTheme(name) {
  document.body.classList.remove("theme-sepia", "theme-light");
  if (name === "sepia") document.body.classList.add("theme-sepia");
  if (name === "light") document.body.classList.add("theme-light");
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = name === "light" ? "\uD83C\uDF19" : name === "sepia" ? "\uD83D\uDCDC" : "\u2600";
}

/* ══════════════════════════════════════════════════════════
   TERCIHLER KAYDET / GERİ YÜKLE
   ══════════════════════════════════════════════════════════ */
function restorePrefs() {
  const themeIdx = parseInt(sessionStorage.getItem("rd_theme") || "0", 10);
  _themeIdx = themeIdx;
  applyTheme(THEMES[_themeIdx]);

  if (sessionStorage.getItem("rd_serif") === "0") {
    _serifMode = false;
    document.getElementById("readerBody").style.fontFamily = "'DM Sans', system-ui, sans-serif";
    const btn = document.getElementById("fontToggleBtn");
    if (btn) btn.textContent = "Ss";
  }

  const savedSize = parseInt(sessionStorage.getItem("rd_fontSize") || "0", 10);
  if (savedSize >= 13 && savedSize <= 32) {
    _currentFontSize = savedSize;
    applyFontSize();
  }
}

/* ══════════════════════════════════════════════════════════
   KELİME SEÇİMİ + ANLAM POPUP
   ══════════════════════════════════════════════════════════ */
function initWordSelection() {
  const body    = document.getElementById("readerBody");
  const trigger = document.getElementById("floatingMeaningBtn");
  const popup   = document.getElementById("meaningPopup");

  body.addEventListener("mouseup", () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { trigger.style.display = "none"; return; }

    let word = sel.toString().trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    if (!word) { trigger.style.display = "none"; return; }

    _selectedWord = word;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || rect.width === 0) { trigger.style.display = "none"; return; }

    popup.style.display = "none";
    trigger.style.display = "flex";
    trigger.style.top  = (window.scrollY + rect.bottom + 10) + "px";
    trigger.style.left = (window.scrollX + rect.left) + "px";
  });

  trigger.addEventListener("click", openMeaningPopup);

  /* Dışarı tıklayınca kapat */
  document.addEventListener("mousedown", e => {
    const overlay = document.getElementById("wordModalOverlay");
    const inside  =
      body.contains(e.target)    ||
      trigger.contains(e.target) ||
      popup.contains(e.target)   ||
      (overlay && overlay.contains(e.target));

    if (!inside) {
      trigger.style.display = "none";
      popup.style.display   = "none";
      window.getSelection()?.removeAllRanges();
      _selectedWord = "";
    }
  });
}

/* ══════════════════════════════════════════════════════════
   ANLAM POPUP İÇERİĞİ
   ══════════════════════════════════════════════════════════ */
async function openMeaningPopup() {
  const trigger = document.getElementById("floatingMeaningBtn");
  const popup   = document.getElementById("meaningPopup");

  popup.style.top  = trigger.style.top;
  popup.style.left = trigger.style.left;
  trigger.style.display = "none";
  popup.style.display   = "block";
  _popupWikiData = null;

  popup.innerHTML = `
    <div class="popup-loading">
      <div class="dots"><span></span><span></span><span></span></div>
      <span>Çevriliyor\u2026</span>
    </div>`;

  try {
    const [{ main, alts }, wiki] = await Promise.all([
      fetchTranslate(_selectedWord),
      fetchWikiData(_selectedWord),
    ]);

    _lastTranslated = main;
    _popupWikiData  = wiki;

    const artikelHtml = artikelBadgeHtml(wiki.artikel, { size: 11 });
    const typeHtml    = wiki.wordType
      ? `<span class="popup-type-badge">${wiki.wordType}</span>` : "";

    const baseHtml = wiki.baseForm
      ? `<div class="popup-base-form">
           <span>Temel form: <strong>${escapeHtml(wiki.baseForm)}</strong></span>
           <button class="popup-apply-base" id="popupApplyBase">kullan \u2192</button>
         </div>` : "";

    const altsHtml = alts.length
      ? `<div class="popup-alts">${alts.slice(0,5).map(a =>
          `<button class="popup-alt-chip" data-alt="${escapeHtml(a)}">${escapeHtml(a)}</button>`
        ).join("")}</div>` : "";

    popup.innerHTML = `
      <div class="popup-header">
        <div class="popup-word-row">
          ${artikelHtml}
          <span class="popup-word">${escapeHtml(_selectedWord)}</span>
          ${typeHtml}
        </div>
        <button class="popup-close" id="popupCloseBtn">\u2715</button>
      </div>
      <div class="popup-body">
        <div class="popup-main-tr" id="popupMainTr">${escapeHtml(main)}</div>
        ${altsHtml}
        ${baseHtml}
        <div class="popup-tag-section">
          <div class="popup-tag-label">Etiket</div>
          <div id="popupTagChips" class="tag-chips" style="gap:5px"></div>
        </div>
      </div>
      <div class="popup-footer">
        <button class="popup-save-btn" id="popupSaveBtn">\uFF0B S\u00f6zl\u00fc\u011fe Ekle</button>
      </div>`;

    renderTagChips("popupTagChips", wiki.autoTags || [], extractAllTags(_userWords));

    /* Alternatif chip tıklaması */
    popup.querySelectorAll(".popup-alt-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        _lastTranslated = chip.dataset.alt;
        document.getElementById("popupMainTr").textContent = chip.dataset.alt;
      });
    });

    /* Temel form uygula */
    document.getElementById("popupApplyBase")?.addEventListener("click", () => {
      _selectedWord = wiki.baseForm;
      closeMeaningPopup();
      document.getElementById("floatingMeaningBtn").style.display = "flex";
      openMeaningPopup();
    });

    document.getElementById("popupCloseBtn")?.addEventListener("click", closeMeaningPopup);
    document.getElementById("popupSaveBtn")?.addEventListener("click", saveFromPopup);

  } catch {
    popup.innerHTML = `<div style="padding:16px;color:var(--error);font-size:13px">
      Çeviri alınamadı. Tekrar deneyin.</div>`;
  }
}

function closeMeaningPopup() {
  document.getElementById("meaningPopup").style.display = "none";
  _selectedWord   = "";
  _popupWikiData  = null;
}

/* ══════════════════════════════════════════════════════════
   POPUP'TAN KAYDET
   ══════════════════════════════════════════════════════════ */
async function saveFromPopup() {
  const word    = normalizeGermanWord(_selectedWord, _popupWikiData);
  const meaning = _lastTranslated;

  if (!word || !meaning) { showToast("Kelime veya çeviri eksik.", "error"); return; }

  const btn = document.getElementById("popupSaveBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Kaydediliyor\u2026"; }

  try {
    const userId = window.getUserId();
    if (!userId) throw new Error("Oturum yok");
    const tags = getSelectedTags("popupTagChips");
    await saveWord(userId, word, meaning, tags);
    _userWords = await getWords(userId).catch(() => _userWords);
    closeMeaningPopup();
    showToast(`\u201C${word}\u201D sözlüğe eklendi`, "success");
  } catch (err) {
    showToast("Kayıt başarısız: " + err.message, "error");
    if (btn) { btn.disabled = false; btn.textContent = "\uFF0B S\u00f6zl\u00fc\u011fe Ekle"; }
  }
}

/* ══════════════════════════════════════════════════════════
   KELİME KAYDETME MODALI (toolbar butonu ile)
   ══════════════════════════════════════════════════════════ */
function openWordModal() {
  const wiki      = _popupWikiData || {};
  const displayEl = document.getElementById("modalWordDisplay");
  const word      = normalizeGermanWord(_selectedWord, wiki);

  /* Kelime gösterimi: artikel varsa renkli badge */
  if (wiki.artikel) {
    displayEl.innerHTML = artikelBadgeHtml(wiki.artikel, { size: 14 })
      + " " + escapeHtml(_selectedWord.charAt(0).toUpperCase() + _selectedWord.slice(1));
  } else {
    displayEl.textContent = word;
  }

  /* Temel form satırı */
  const baseWrap = document.getElementById("modalBaseFormWrap");
  const baseText = document.getElementById("modalBaseFormText");
  if (baseWrap && baseText && wiki.baseForm) {
    baseText.textContent = wiki.baseForm;
    baseWrap.style.display = "flex";
  } else if (baseWrap) {
    baseWrap.style.display = "none";
  }

  document.getElementById("modalMeaningInput").value = _lastTranslated || "";
  renderTagChips("modalTagChips", wiki.autoTags || [], extractAllTags(_userWords));

  const overlay = document.getElementById("wordModalOverlay");
  overlay.classList.add("active");
  setTimeout(() => document.getElementById("modalMeaningInput").focus(), 80);

  /* Temel formu uygula butonu */
  document.getElementById("applyBaseFormBtn")?.addEventListener("click", () => {
    if (!wiki.baseForm) return;
    _selectedWord = wiki.baseForm;
    fetchWikiData(wiki.baseForm).then(newWiki => {
      _popupWikiData = newWiki;
      const a = newWiki.artikel;
      displayEl.innerHTML = a
        ? artikelBadgeHtml(a, { size: 14 }) + " " + escapeHtml(wiki.baseForm.charAt(0).toUpperCase() + wiki.baseForm.slice(1))
        : escapeHtml(wiki.baseForm);
      renderTagChips("modalTagChips", newWiki.autoTags || [], extractAllTags(_userWords));
    });
  });

  /* Kapatma */
  const closeModal = () => overlay.classList.remove("active");
  document.getElementById("wordModalClose")?.addEventListener("click",  closeModal, { once: true });
  document.getElementById("wordModalCancelBtn")?.addEventListener("click", closeModal, { once: true });
  overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });

  document.getElementById("wordModalSaveBtn")?.addEventListener("click", saveWordFromModal, { once: true });
}

async function saveWordFromModal() {
  const meaning = document.getElementById("modalMeaningInput").value.trim();
  if (!meaning) { document.getElementById("modalMeaningInput").focus(); return; }

  const word    = normalizeGermanWord(_selectedWord, _popupWikiData || {});
  const tags    = getSelectedTags("modalTagChips");
  const saveBtn = document.getElementById("wordModalSaveBtn");

  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Kaydediliyor\u2026"; }

  try {
    const userId = window.getUserId();
    if (!userId) throw new Error("Oturum yok");
    await saveWord(userId, word, meaning, tags);
    _userWords = await getWords(userId).catch(() => _userWords);
    document.getElementById("wordModalOverlay").classList.remove("active");
    showToast(`\u201C${word}\u201D sözlüğe eklendi`, "success");
    _selectedWord = "";
  } catch (err) {
    showToast("Kayıt başarısız: " + err.message, "error");
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Kaydet"; }
  }
}

/* ══════════════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════════════ */
function showToast(msg, type = "success") {
  const el = document.createElement("div");
  el.className = `reader-toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .3s";
    setTimeout(() => el.remove(), 300);
  }, 2500);
}