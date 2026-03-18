/* ═══════════════════════════════════════════════════════════
   okuma.js  —  AlmancaPratik Okuma Modu

   Düzeltmeler:
   1. Floating buton/popup position:fixed → koordinat hesabı
      window.scrollY OLMADAN, viewport-relative rect kullanılıyor.
   2. Tüm event listener'lar DOMContentLoaded içinde TEK KERE bağlandı.
   3. Modal toggle: display manipülasyonu JS'de, CSS class sadece flex açar.
   4. Promise'ler kapatılmış; hiç { once:true } kullanılmıyor.
   5. positionPopup(): popup alta sığmazsa otomatik üste çevrilir,
      yatayda da viewport'tan taşmaz. Scroll'da popup kaybolmaz.
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
import { showToast } from "../src/components/toast.js";
import { showAuthGate, isLoggedIn } from '../src/components/authGate.js';
/* ── State ───────────────────────────────────────────────── */
let _word       = "";   /* seçili kelime */
let _wiki       = null; /* Wiktionary verisi */
let _tr         = "";   /* son çeviri */
let _userWords  = [];
let _fontSize   = 19;
let _themeIdx   = 0;
let _serifMode  = true;
let _modalOpen  = false;

const THEMES = ["", "ok-sepia", "ok-light"];
const THEME_ICONS = ["☀", "📜", "🌙"];

/* ── DOM referansları ────────────────────────────────────── */
let $body, $meaning, $popup, $overlay;

/* ═══════════════════════════════════════════════════════════
   BAŞLANGIÇ
   ═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  $body    = document.getElementById("readerBody");
  $meaning = document.getElementById("floatingMeaningBtn");
  $popup   = document.getElementById("meaningPopup");
  $overlay = document.getElementById("wordModalOverlay");

  /* ── Metin yükle ── */
  const raw    = sessionStorage.getItem("savedText") || "";
  const blocks = tryParse(sessionStorage.getItem("parsedBlocks"));

  if (!raw.trim()) {
    $body.innerHTML = `<p style="color:var(--ok-text2);font-style:italic;text-align:center;padding:40px 0">
      Metin bulunamadı. <a href="../metin/" style="color:var(--ok-gold)">Metin sayfasına dön</a>.</p>`;
    return;
  }

  if (blocks) {
    $body.innerHTML = renderBlocks(blocks);
  } else {
    $body.classList.add("ok-plain");
    $body.textContent = raw;
  }

  updateMeta(raw);

  /* Kullanıcı kelimelerini arka planda yükle */
  const uid = window.getUserId?.();
  if (uid) getWords(uid).then(list => { _userWords = list; }).catch(() => {});

  restorePrefs();
  initProgress();
  bindToolbar();
  bindSelection();
  bindModal();
});

/* ═══════════════════════════════════════════════════════════
   YARDIMCI
   ═══════════════════════════════════════════════════════════ */
function tryParse(json) {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

function renderBlocks(blocks) {
  const e = s => String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return blocks.map(b => {
    switch (b.type) {
      case "title":   return `<h2 class="ok-title">${e(b.text)}</h2>`;
      case "dialog":  return `<p class="ok-dialog">${e(b.text)}</p>`;
      case "quote":   return `<p class="ok-quote">${e(b.text)}</p>`;
      case "section": return `<div class="ok-section">&#x2726; &emsp; &#x2726; &emsp; &#x2726;</div>`;
      case "para":    return `<p class="ok-para">${b.lines.map(e).join("<br>")}</p>`;
      default:        return "";
    }
  }).join("");
}

function updateMeta(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const mins  = Math.max(1, Math.round(words / 200));
  const el    = document.getElementById("readingMeta");
  if (el) el.textContent = `${words.toLocaleString("tr")} kelime · ~${mins} dk`;
}

/* ═══════════════════════════════════════════════════════════
   İLERLEME ÇUBUĞU
   ═══════════════════════════════════════════════════════════ */
function initProgress() {
  const fill = document.getElementById("okProgressFill");
  if (!fill) return;
  window.addEventListener("scroll", () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    fill.style.width = max > 0 ? Math.min(100, (window.scrollY / max) * 100) + "%" : "0%";
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════════════
   TOOLBAR
   ═══════════════════════════════════════════════════════════ */
function bindToolbar() {
  on("backBtn", "click", () => {
    sessionStorage.removeItem("parsedBlocks");
    const ret = sessionStorage.getItem("returnPage");

    let href;
    if (!ret) {
      href = "../metin/";
    } else if (ret === "metin.html" || ret === "metin/" || ret === "../metin/") {
      href = "../metin/";
    } else if (ret === "gecmis" || ret === "gecmis/" || ret === "../gecmis/") {
      href = "../gecmis/";
    } else if (ret.startsWith("../")) {
      href = ret;
    } else {
      href = "../" + ret.replace(/\.html$/, "/").replace(/\/?$/, "/");
    }

    location.href = href;
  });

  on("addWordBtn", "click", () => {
    if (!isLoggedIn()) {
      showAuthGate({
        title: 'Kelime kaydetmek için giriş yap',
        desc: 'Seçtiğin kelimeleri kişisel sözlüğüne eklemek için ücretsiz hesabına giriş yap.'
      });
      return;
    }
    if (!_word) { showToast("Önce metinden bir kelime seçin.", false); return; }
    openModal();
  });

  on("fontDecBtn", "click", () => setFont(Math.max(13, _fontSize - 1)));
  on("fontIncBtn", "click", () => setFont(Math.min(32, _fontSize + 1)));

  on("fontToggleBtn", "click", () => {
    _serifMode = !_serifMode;
    $body.style.fontFamily = _serifMode ? "var(--ok-serif)" : "var(--ok-sans)";
    setText("fontToggleBtn", _serifMode ? "Tf" : "Ss");
    ss("ok_serif", _serifMode ? "1" : "0");
  });

  on("themeBtn", "click", () => {
    _themeIdx = (_themeIdx + 1) % THEMES.length;
    setTheme(_themeIdx);
    ss("ok_theme", _themeIdx);
  });

  on("focusBtn", "click", () => {
    const on = document.body.classList.toggle("ok-focus");
    setText("focusBtn", on ? "⊞" : "⊡");
  });
}

function setFont(size) {
  _fontSize = size;
  $body.style.fontSize = size + "px";
  ss("ok_font", size);
}

function setTheme(idx) {
  document.body.classList.remove(...THEMES.filter(Boolean));
  if (THEMES[idx]) document.body.classList.add(THEMES[idx]);
  setText("themeBtn", THEME_ICONS[idx] || "☀");
}

function restorePrefs() {
  const ti = parseInt(sg("ok_theme") || "0", 10);
  _themeIdx = isNaN(ti) ? 0 : ti % THEMES.length;
  setTheme(_themeIdx);

  if (sg("ok_serif") === "0") {
    _serifMode = false;
    $body.style.fontFamily = "var(--ok-sans)";
    setText("fontToggleBtn", "Ss");
  }

  const fs = parseInt(sg("ok_font") || "0", 10);
  if (fs >= 13 && fs <= 32) setFont(fs);
}

/* ═══════════════════════════════════════════════════════════
   KELİME SEÇİMİ
   ═══════════════════════════════════════════════════════════ */
function bindSelection() {
  $body.addEventListener("mouseup", onBodyMouseUp);
  $body.addEventListener("touchend", onBodyMouseUp);

  $meaning.addEventListener("click", openPopup);

  document.addEventListener("mousedown", e => {
    if (_modalOpen) return;
    const inside = [$body, $meaning, $popup, $overlay].some(el => el && el.contains(e.target));
    if (!inside) {
      hideMeaning();
      hidePopup();
      window.getSelection()?.removeAllRanges();
      _word = "";
    }
  });
}

function onBodyMouseUp() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) { hideMeaning(); return; }

  const raw = sel.toString().trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  if (!raw) { hideMeaning(); return; }

  _word = raw;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  if (!rect.width) { hideMeaning(); return; }

  hidePopup();
  $meaning.style.top  = (rect.bottom + 10) + "px";
  $meaning.style.left = rect.left + "px";
  $meaning.style.display = "inline-flex";
  $meaning.classList.remove("pop");
  requestAnimationFrame(() => $meaning.classList.add("pop"));
}

function hideMeaning() {
  $meaning.style.display = "none";
  $meaning.classList.remove("pop");
}
function hidePopup() {
  $popup.style.display = "none";
  $popup.classList.remove("slide");
}

/* ═══════════════════════════════════════════════════════════
   POPUP KONUMLANDIRMA
   Alta sığmazsa üste çevirir; yatayda taşmayı önler.
   İçerik async yüklenince tekrar çağrılır.
   ═══════════════════════════════════════════════════════════ */
function positionPopup(anchorRect) {
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  const pw  = $popup.offsetWidth  || 300;
  const ph  = $popup.offsetHeight || 120;
  const GAP = 8;

  /* Dikey: önce alta, sığmazsa üste */
  let top = anchorRect.bottom + GAP;
  if (top + ph > vh - 10) {
    top = anchorRect.top - ph - GAP;
  }
  top = Math.max(6, top);   /* ekranın üstünden çıkmasın */

  /* Yatay: soldan hizala, sağ kenara taşmasın */
  let left = anchorRect.left;
  if (left + pw > vw - 10) {
    left = vw - pw - 10;
  }
  left = Math.max(6, left);

  $popup.style.top  = top  + "px";
  $popup.style.left = left + "px";
}

/* ═══════════════════════════════════════════════════════════
   ANLAM POPUP
   ═══════════════════════════════════════════════════════════ */
async function openPopup() {
  const btnRect = $meaning.getBoundingClientRect();

  /* Gizli aç → yükleniyor içeriğini yerleştir → konumlandır → göster */
  $popup.style.visibility = "hidden";
  $popup.style.display    = "block";
  $popup.classList.remove("slide");

  hideMeaning();
  _wiki = null;

  $popup.innerHTML = `
    <div class="ok-loading">
      <div class="ok-dots"><span></span><span></span><span></span></div>
      <span>Çevriliyor…</span>
    </div>`;

  /* Yükleniyor konumlandırması */
  positionPopup(btnRect);
  $popup.style.visibility = "visible";
  requestAnimationFrame(() => $popup.classList.add("slide"));

  let mainTr = "—", alts = [], wikiData = {};

  try {
    [ {main: mainTr, alts}, wikiData ] = await Promise.all([
      fetchTranslate(_word),
      fetchWikiData(_word),
    ]);
  } catch {
    $popup.innerHTML = `<div style="padding:16px;color:var(--ok-error);font-size:13px">Çeviri alınamadı.</div>`;
    positionPopup(btnRect);
    return;
  }

  _tr   = mainTr;
  _wiki = wikiData;

  const artHtml  = artikelBadgeHtml(wikiData.artikel, { size: 11 });
  const typeHtml = wikiData.wordType
    ? `<span class="ok-ptb">${wikiData.wordType}</span>` : "";
  const baseHtml = wikiData.baseForm
    ? `<div class="ok-pbase">
         <span>Temel form: <strong>${escapeHtml(wikiData.baseForm)}</strong></span>
         <button class="ok-papply" id="ppApply">kullan →</button>
       </div>` : "";
  const altsHtml = alts.length
    ? `<div class="ok-palts">${alts.slice(0,5).map(a =>
        `<button class="ok-palt" data-a="${escapeHtml(a)}">${escapeHtml(a)}</button>`
      ).join("")}</div>` : "";

  $popup.innerHTML = `
    <div class="ok-ph">
      <div class="ok-pw-row">${artHtml}<span class="ok-pw">${escapeHtml(_word)}</span>${typeHtml}</div>
      <button class="ok-px" id="ppClose">✕</button>
    </div>
    <div class="ok-pb">
      <div class="ok-pmain" id="ppMain">${escapeHtml(mainTr)}</div>
      ${altsHtml}
      ${baseHtml}
      <div class="ok-ptags">
        <div class="ok-ptag-label">Etiket</div>
        <div class="ok-tag-chips" id="ppTags"></div>
      </div>
    </div>
    <div class="ok-pfoot">
      <button class="ok-psave" id="ppSave">+ Sözlüğe Ekle</button>
    </div>`;

  /* İçerik yüklendi → tarayıcı layout'u bitirince gerçek yüksekliğe göre yeniden konumlandır */
  requestAnimationFrame(() => positionPopup(btnRect));

  renderTagChips("ppTags", wikiData.autoTags || [], extractAllTags(_userWords));

  $popup.querySelectorAll(".ok-palt").forEach(chip => {
    chip.addEventListener("click", () => {
      _tr = chip.dataset.a;
      const el = document.getElementById("ppMain");
      if (el) el.textContent = chip.dataset.a;
    });
  });

  document.getElementById("ppApply")?.addEventListener("click", async () => {
    _word = wikiData.baseForm;
    hidePopup();
    try {
      const nw = await fetchWikiData(_word);
      _wiki = nw;
    } catch { _wiki = {}; }
    $meaning.style.top  = $popup.style.top;
    $meaning.style.left = $popup.style.left;
    $meaning.style.display = "inline-flex";
    await openPopup();
  });

  document.getElementById("ppClose")?.addEventListener("click", hidePopup);
  document.getElementById("ppSave")?.addEventListener("click",  saveFromPopup);
}

/* ── Popup'tan kaydet ────────────────────────────────────── */
async function saveFromPopup() {
  if (!isLoggedIn()) {
    showAuthGate({
      title: 'Kelime kaydetmek için giriş yap',
      desc: 'Beğendiğin kelimeleri kişisel sözlüğüne eklemek ücretsiz — sadece bir Google hesabı yeterli.'
    });
    return;
  }

  const word = normalizeGermanWord(_word, _wiki);
  if (!word || !_tr || _tr === "—") {
    showToast("Kelime veya çeviri eksik.", false); return;
  }

  const btn = document.getElementById("ppSave");
  if (btn) { btn.disabled = true; btn.textContent = "Kaydediliyor…"; }

  try {
    const uid = window.getUserId?.();
    if (!uid) throw new Error("Oturum yok");
    await saveWord(uid, word, _tr, getSelectedTags("ppTags"));
    getWords(uid).then(l => { _userWords = l; }).catch(() => {});
    hidePopup();
    _word = "";
    showToast(`"${word}" sözlüğe eklendi`);
  } catch (err) {
    showToast("Kayıt başarısız: " + err.message, false);
    if (btn) { btn.disabled = false; btn.textContent = "+ Sözlüğe Ekle"; }
  }
}

/* ═══════════════════════════════════════════════════════════
   KELIME KAYDETME MODALI
   ═══════════════════════════════════════════════════════════ */
function bindModal() {
  const close = () => {
    $overlay.style.display = "none";
    $overlay.classList.remove("active");
    _modalOpen = false;
  };

  on("wordModalClose",    "click",   close);
  on("wordModalCancelBtn","click",   close);

  $overlay.addEventListener("click", e => { if (e.target === $overlay) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && _modalOpen) close(); });

  on("applyBaseFormBtn", "click", async () => {
    const base = _wiki?.baseForm;
    if (!base) return;
    _word = base;
    try { _wiki = await fetchWikiData(_word); } catch { _wiki = {}; }
    fillModalWord();
    renderTagChips("modalTagChips", _wiki?.autoTags || [], extractAllTags(_userWords));
  });

  on("modalMeaningInput", "keydown", e => { if (e.key === "Enter") doSaveModal(); });
  on("wordModalSaveBtn",  "click",   doSaveModal);
}

function openModal() {
  fillModalWord();

  const inp = document.getElementById("modalMeaningInput");
  if (inp) inp.value = _tr || "";

  const baseWrap = document.getElementById("modalBaseFormWrap");
  const baseText = document.getElementById("modalBaseFormText");
  if (baseWrap && baseText) {
    const base = _wiki?.baseForm;
    baseText.textContent  = base || "";
    baseWrap.style.display = base ? "flex" : "none";
  }

  renderTagChips("modalTagChips", _wiki?.autoTags || [], extractAllTags(_userWords));

  $overlay.style.display = "flex";
  $overlay.classList.add("active");
  _modalOpen = true;
  setTimeout(() => document.getElementById("modalMeaningInput")?.focus(), 60);
}

function fillModalWord() {
  const el = document.getElementById("modalWordDisplay");
  if (!el) return;
  if (_wiki?.artikel) {
    const cap = _word.charAt(0).toUpperCase() + _word.slice(1);
    el.innerHTML = artikelBadgeHtml(_wiki.artikel, { size: 14 }) + " " + escapeHtml(cap);
  } else {
    el.textContent = normalizeGermanWord(_word, _wiki || {});
  }
}

async function doSaveModal() {
  if (!isLoggedIn()) {
    showAuthGate({
      title: 'Kelime kaydetmek için giriş yap',
      desc: 'Sözlüğüne kelime eklemek için ücretsiz hesabına giriş yapman yeterli.'
    });
    return;
  }

  const inp     = document.getElementById("modalMeaningInput");
  const meaning = inp?.value.trim();
  if (!meaning) { inp?.focus(); return; }

  const word = normalizeGermanWord(_word, _wiki || {});
  const tags = getSelectedTags("modalTagChips");
  const btn  = document.getElementById("wordModalSaveBtn");

  if (btn) { btn.disabled = true; btn.textContent = "Kaydediliyor…"; }

  try {
    const uid = window.getUserId?.();
    if (!uid) throw new Error("Oturum yok");
    await saveWord(uid, word, meaning, tags);
    getWords(uid).then(l => { _userWords = l; }).catch(() => {});
    $overlay.style.display = "none";
    $overlay.classList.remove("active");
    _modalOpen = false;
    _word      = "";
    showToast(`"${word}" sözlüğe eklendi`);
  } catch (err) {
    showToast("Kayıt başarısız: " + err.message, false);
    if (btn) { btn.disabled = false; btn.textContent = "Kaydet"; }
  }
}

/* ═══════════════════════════════════════════════════════════
   MINI YARDIMCILAR
   ═══════════════════════════════════════════════════════════ */
function on(id, ev, fn) {
  document.getElementById(id)?.addEventListener(ev, fn);
}
function setText(id, t) {
  const el = document.getElementById(id);
  if (el) el.textContent = t;
}
function ss(k, v) { sessionStorage.setItem(k, v); }
function sg(k)    { return sessionStorage.getItem(k); }