/* ═══════════════════════════════════════════════════════════
   okuma.js  —  AlmancaPratik Okuma Modu
   ═══════════════════════════════════════════════════════════
   Düzeltmeler:
   - Tüm event listener'lar DOMContentLoaded içinde tek kez bağlandı
   - { once: true } kullanımı kaldırıldı (Promise leak'e neden oluyordu)
   - Modal aç/kapat state flag ile yönetiliyor
   - Promise'ler try/catch ile düzgün kapatılıyor
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

/* ══════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════ */
let _selectedWord   = "";
let _popupWikiData  = null;
let _lastTranslated = "";
let _userWords      = [];
let _fontSize       = 19;
let _themeIdx       = 0;
let _serifMode      = true;
let _modalOpen      = false;

const THEMES = ["dark", "sepia", "light"];

/* ══════════════════════════════════════════════
   DOM REFS (sayfa yüklendikten sonra atanır)
   ══════════════════════════════════════════════ */
let readerBody, trigger, popup, overlay;

/* ══════════════════════════════════════════════
   BAŞLANGIÇ
   ══════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  readerBody = document.getElementById("readerBody");
  trigger    = document.getElementById("floatingMeaningBtn");
  popup      = document.getElementById("meaningPopup");
  overlay    = document.getElementById("wordModalOverlay");

  /* Metni yükle */
  const rawText    = sessionStorage.getItem("savedText") || "";
  const blocksJson = sessionStorage.getItem("parsedBlocks");

  if (!rawText.trim()) {
    readerBody.innerHTML =
      `<p style="color:var(--text-muted);font-style:italic;text-align:center;padding:40px 0">
        Metin bulunamadı. <a href="../metin/" style="color:var(--gold)">Metin sayfasına dön</a>.
      </p>`;
    return;
  }

  if (blocksJson) {
    try {
      readerBody.innerHTML = blocksToHtml(JSON.parse(blocksJson));
    } catch {
      loadPlain(rawText);
    }
  } else {
    loadPlain(rawText);
  }

  updateMeta(rawText);

  /* Kullanıcı kelimelerini arka planda yükle — hata sayfayı durdurmasın */
  try {
    const uid = window.getUserId?.();
    if (uid) _userWords = await getWords(uid);
  } catch (_) { /* sessizce geç */ }

  restorePrefs();
  initProgressBar();

  /* Event listener'ları SADECE BİR KEZ bağla */
  bindToolbar();
  bindWordSelection();
  bindModal();
});

/* ══════════════════════════════════════════════
   METİN RENDER
   ══════════════════════════════════════════════ */
function blocksToHtml(blocks) {
  const esc = s => String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  let html = "";
  for (const b of blocks) {
    switch (b.type) {
      case "title":   html += `<h2 class="rb-title">${esc(b.text)}</h2>`; break;
      case "dialog":  html += `<p class="rb-dialog">${esc(b.text)}</p>`; break;
      case "quote":   html += `<p class="rb-quote">${esc(b.text)}</p>`; break;
      case "section": html += `<div class="rb-section">\u2726 \u2003 \u2726 \u2003 \u2726</div>`; break;
      case "para":    html += `<p class="rb-para">${b.lines.map(esc).join("<br>")}</p>`; break;
    }
  }
  return html;
}

function loadPlain(text) {
  readerBody.classList.add("plain-text");
  readerBody.textContent = text;
}

function updateMeta(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const mins  = Math.max(1, Math.round(words / 200));
  const el    = document.getElementById("readingMeta");
  if (el) el.textContent = `${words.toLocaleString("tr")} kelime \u00b7 ~${mins} dk`;
}

/* ══════════════════════════════════════════════
   İLERLEME ÇUBUĞU
   ══════════════════════════════════════════════ */
function initProgressBar() {
  const bar = document.getElementById("progressBar");
  if (!bar) return;
  const onScroll = () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = total > 0 ? Math.min(100, (window.scrollY / total) * 100) + "%" : "0%";
  };
  window.addEventListener("scroll", onScroll, { passive: true });
}

/* ══════════════════════════════════════════════
   TOOLBAR — tüm listener'lar tek seferde
   ══════════════════════════════════════════════ */
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
    openModal();
  });

  document.getElementById("fontDecBtn")?.addEventListener("click", () => {
    _fontSize = Math.max(13, _fontSize - 1);
    readerBody.style.fontSize = _fontSize + "px";
    sessionStorage.setItem("rd_fontSize", _fontSize);
  });

  document.getElementById("fontIncBtn")?.addEventListener("click", () => {
    _fontSize = Math.min(32, _fontSize + 1);
    readerBody.style.fontSize = _fontSize + "px";
    sessionStorage.setItem("rd_fontSize", _fontSize);
  });

  document.getElementById("fontToggleBtn")?.addEventListener("click", () => {
    _serifMode = !_serifMode;
    readerBody.style.fontFamily = _serifMode
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
    const on = document.body.classList.toggle("focus-mode");
    const btn = document.getElementById("focusBtn");
    if (btn) btn.textContent = on ? "\u229E" : "\u22A1";
  });
}

function applyTheme(name) {
  document.body.classList.remove("theme-sepia", "theme-light");
  if (name === "sepia") document.body.classList.add("theme-sepia");
  if (name === "light") document.body.classList.add("theme-light");
  const icons = { dark: "\u2600", sepia: "\uD83D\uDCDC", light: "\uD83C\uDF19" };
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = icons[name] || "\u2600";
}

function restorePrefs() {
  const ti = parseInt(sessionStorage.getItem("rd_theme") || "0", 10);
  _themeIdx = ti;
  applyTheme(THEMES[_themeIdx]);

  if (sessionStorage.getItem("rd_serif") === "0") {
    _serifMode = false;
    readerBody.style.fontFamily = "'DM Sans', system-ui, sans-serif";
    const btn = document.getElementById("fontToggleBtn");
    if (btn) btn.textContent = "Ss";
  }

  const fs = parseInt(sessionStorage.getItem("rd_fontSize") || "0", 10);
  if (fs >= 13 && fs <= 32) {
    _fontSize = fs;
    readerBody.style.fontSize = _fontSize + "px";
  }
}

/* ══════════════════════════════════════════════
   KELİME SEÇİMİ
   ══════════════════════════════════════════════ */
function bindWordSelection() {

  readerBody.addEventListener("mouseup", () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { hideTrigger(); return; }

    let word = sel.toString().trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    if (!word) { hideTrigger(); return; }

    _selectedWord = word;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || rect.width === 0) { hideTrigger(); return; }

    popup.style.display   = "none";
    trigger.style.display = "flex";
    trigger.style.top     = (window.scrollY + rect.bottom + 10) + "px";
    trigger.style.left    = (window.scrollX + rect.left) + "px";
  });

  trigger.addEventListener("click", openMeaningPopup);

  /* Dışarıya tıklayınca kapat */
  document.addEventListener("mousedown", e => {
    if (_modalOpen) return; /* modal açıkken popup'ı etkileme */
    const inside =
      readerBody.contains(e.target) ||
      trigger.contains(e.target)   ||
      popup.contains(e.target)     ||
      overlay.contains(e.target);
    if (!inside) {
      hideTrigger();
      popup.style.display = "none";
      window.getSelection()?.removeAllRanges();
      _selectedWord = "";
    }
  });
}

function hideTrigger() {
  trigger.style.display = "none";
}

/* ══════════════════════════════════════════════
   ANLAM POPUP
   ══════════════════════════════════════════════ */
async function openMeaningPopup() {
  popup.style.top  = trigger.style.top;
  popup.style.left = trigger.style.left;
  hideTrigger();
  popup.style.display = "block";
  _popupWikiData = null;

  popup.innerHTML = `
    <div class="popup-loading">
      <div class="dots"><span></span><span></span><span></span></div>
      <span>Çevriliyor\u2026</span>
    </div>`;

  let main = "—", alts = [], wiki = {};

  try {
    [{ main, alts }, wiki] = await Promise.all([
      fetchTranslate(_selectedWord),
      fetchWikiData(_selectedWord),
    ]);
  } catch {
    popup.innerHTML = `<div style="padding:16px;color:var(--error);font-size:13px">
      Çeviri alınamadı.</div>`;
    return;
  }

  _lastTranslated = main;
  _popupWikiData  = wiki;

  const artikelHtml = artikelBadgeHtml(wiki.artikel, { size: 11 });
  const typeHtml    = wiki.wordType
    ? `<span class="popup-type-badge">${wiki.wordType}</span>` : "";
  const baseHtml    = wiki.baseForm
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
      <button class="popup-save-btn" id="popupSaveBtn">+ Sözlüğe Ekle</button>
    </div>`;

  renderTagChips("popupTagChips", wiki.autoTags || [], extractAllTags(_userWords));

  /* Alt çeviri chip'leri */
  popup.querySelectorAll(".popup-alt-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      _lastTranslated = chip.dataset.alt;
      const el = document.getElementById("popupMainTr");
      if (el) el.textContent = chip.dataset.alt;
    });
  });

  /* Temel form uygula */
  document.getElementById("popupApplyBase")?.addEventListener("click", async () => {
    _selectedWord = wiki.baseForm;
    popup.style.display = "none";
    /* Yeni kelime için popup yeniden aç */
    trigger.style.display = "flex";
    await openMeaningPopup();
  });

  /* Kapat */
  document.getElementById("popupCloseBtn")?.addEventListener("click", () => {
    popup.style.display = "none";
    _selectedWord = "";
  });

  /* Kaydet */
  document.getElementById("popupSaveBtn")?.addEventListener("click", saveFromPopup);
}

/* ══════════════════════════════════════════════
   POPUP'TAN KAYDET
   ══════════════════════════════════════════════ */
async function saveFromPopup() {
  const word    = normalizeGermanWord(_selectedWord, _popupWikiData);
  const meaning = _lastTranslated;
  if (!word || !meaning || meaning === "—") {
    showToast("Kelime veya çeviri eksik.", "error");
    return;
  }

  const btn = document.getElementById("popupSaveBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Kaydediliyor\u2026"; }

  try {
    const uid = window.getUserId?.();
    if (!uid) throw new Error("Oturum bulunamadı");
    const tags = getSelectedTags("popupTagChips");
    await saveWord(uid, word, meaning, tags);
    /* Kelime listesini arka planda güncelle */
    getWords(uid).then(list => { _userWords = list; }).catch(() => {});
    popup.style.display = "none";
    _selectedWord = "";
    showToast(`"${word}" sözlüğe eklendi`, "success");
  } catch (err) {
    showToast("Kayıt başarısız: " + err.message, "error");
    if (btn) { btn.disabled = false; btn.textContent = "+ Sözlüğe Ekle"; }
  }
}

/* ══════════════════════════════════════════════
   KELİME KAYDETME MODALI
   Tüm listener'lar burada tek kez bağlanır.
   ══════════════════════════════════════════════ */
function bindModal() {

  /* Kapatma işlemleri */
  const closeModal = () => {
    overlay.classList.remove("active");
    _modalOpen = false;
  };

  document.getElementById("wordModalClose")?.addEventListener("click", closeModal);
  document.getElementById("wordModalCancelBtn")?.addEventListener("click", closeModal);

  overlay.addEventListener("click", e => {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && _modalOpen) closeModal();
  });

  /* Temel form uygula */
  document.getElementById("applyBaseFormBtn")?.addEventListener("click", async () => {
    if (!_popupWikiData?.baseForm) return;
    _selectedWord = _popupWikiData.baseForm;
    try {
      const newWiki = await fetchWikiData(_selectedWord);
      _popupWikiData = newWiki;
      _fillModalWord(newWiki);
      renderTagChips("modalTagChips", newWiki.autoTags || [], extractAllTags(_userWords));
    } catch (_) { /* sessizce geç */ }
  });

  /* Enter ile kaydet */
  document.getElementById("modalMeaningInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter") _saveFromModal();
  });

  /* Kaydet butonu */
  document.getElementById("wordModalSaveBtn")?.addEventListener("click", _saveFromModal);
}

/** Modal'ı açar ve mevcut seçili kelime + wiki verisiyle doldurur */
function openModal() {
  const wiki = _popupWikiData || {};
  _fillModalWord(wiki);

  document.getElementById("modalMeaningInput").value = _lastTranslated || "";
  renderTagChips("modalTagChips", wiki.autoTags || [], extractAllTags(_userWords));

  /* Temel form satırı */
  const baseWrap = document.getElementById("modalBaseFormWrap");
  const baseText = document.getElementById("modalBaseFormText");
  if (baseWrap && baseText) {
    if (wiki.baseForm) {
      baseText.textContent  = wiki.baseForm;
      baseWrap.style.display = "flex";
    } else {
      baseWrap.style.display = "none";
    }
  }

  overlay.classList.add("active");
  _modalOpen = true;
  setTimeout(() => document.getElementById("modalMeaningInput")?.focus(), 80);
}

/** Modal başlığındaki kelime gösterimini günceller */
function _fillModalWord(wiki) {
  const displayEl = document.getElementById("modalWordDisplay");
  if (!displayEl) return;
  if (wiki.artikel) {
    displayEl.innerHTML = artikelBadgeHtml(wiki.artikel, { size: 14 })
      + " " + escapeHtml(_selectedWord.charAt(0).toUpperCase() + _selectedWord.slice(1));
  } else {
    displayEl.textContent = normalizeGermanWord(_selectedWord, wiki);
  }
}

/** Modal'dan kelimeyi kaydet */
async function _saveFromModal() {
  const meaningEl = document.getElementById("modalMeaningInput");
  const meaning   = meaningEl?.value.trim();
  if (!meaning) { meaningEl?.focus(); return; }

  const word    = normalizeGermanWord(_selectedWord, _popupWikiData || {});
  const tags    = getSelectedTags("modalTagChips");
  const saveBtn = document.getElementById("wordModalSaveBtn");

  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Kaydediliyor\u2026"; }

  try {
    const uid = window.getUserId?.();
    if (!uid) throw new Error("Oturum bulunamadı");
    await saveWord(uid, word, meaning, tags);
    /* Arka planda güncelle */
    getWords(uid).then(list => { _userWords = list; }).catch(() => {});
    overlay.classList.remove("active");
    _modalOpen    = false;
    _selectedWord = "";
    showToast(`"${word}" sözlüğe eklendi`, "success");
  } catch (err) {
    showToast("Kayıt başarısız: " + err.message, "error");
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Kaydet"; }
  }
}

/* ══════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════ */
function showToast(msg, type = "success") {
  /* Varsa önceki toast'u temizle */
  document.querySelectorAll(".reader-toast").forEach(el => el.remove());

  const el = document.createElement("div");
  el.className   = `reader-toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);

  setTimeout(() => {
    el.style.transition = "opacity .3s";
    el.style.opacity    = "0";
    setTimeout(() => el.remove(), 300);
  }, 2400);
}