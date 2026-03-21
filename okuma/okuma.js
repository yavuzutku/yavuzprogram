import { saveWordOrAddMeaning, getWords } from "../js/firebase.js";
import { renderTagChips, getSelectedTags, extractAllTags, getAutoLevel } from "../js/tag.js";
import {
  fetchWikiData,
  fetchTranslate,
  normalizeGermanWord,
  artikelBadgeHtml,
  escapeHtml,
} from "../js/german.js";
import { showToast } from "../src/components/toast.js";
import { showLemmaHintOnce } from '../src/components/lemmaHint.js';
import { showAuthGate, isLoggedIn } from '../src/components/authGate.js';

/* ── State ─────────────────────────────────────────────── */
let _word            = "";
let _wiki            = null;
let _tr              = "";
let _userWords       = [];
let _fontSize        = 19;
let _themeIdx        = 0;
let _serifMode       = true;
let _modalOpen       = false;
let _prefetchWord    = "";
let _prefetchPromise = null;

const THEMES     = ["", "ok-sepia", "ok-light"];
const THEME_ICONS = ["☀", "📜", "🌙"];

/* ── DOM ────────────────────────────────────────────────── */
let $body, $meaning, $popup, $overlay;

/* ═══════════════════════════════════════════════════════════
   BAŞLANGIÇ
   ═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  $body    = document.getElementById("readerBody");
  $meaning = document.getElementById("floatingMeaningBtn");
  $popup   = document.getElementById("meaningPopup");
  $overlay = document.getElementById("wordModalOverlay");

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
    if (!ret) href = "../metin/";
    else if (ret === "metin.html" || ret === "metin/" || ret === "../metin/") href = "../metin/";
    else if (ret === "gecmis" || ret === "gecmis/" || ret === "../gecmis/") href = "../gecmis/";
    else if (ret.startsWith("../")) href = ret;
    else href = "../" + ret.replace(/\.html$/, "/").replace(/\/?$/, "/");
    location.href = href;
  });

  on("addWordBtn", "click", () => {
    if (!isLoggedIn()) {
      showAuthGate({ title: 'Kelime kaydetmek için giriş yap', desc: 'Seçtiğin kelimeleri kişisel sözlüğüne eklemek için ücretsiz hesabına giriş yap.' });
      return;
    }
    if (!_word) { showToast("Önce metinden bir kelime seçin.", false); return; }
    openModal();
  });

  on("fontDecBtn",    "click", () => setFont(Math.max(13, _fontSize - 1)));
  on("fontIncBtn",    "click", () => setFont(Math.min(32, _fontSize + 1)));

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
    const $addBtn = document.getElementById("addWordBtn");
    const inside  = [$body, $meaning, $popup, $overlay, $addBtn].some(el => el && el.contains(e.target));
    if (!inside) {
      hideMeaning(); hidePopup();
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

  if (raw !== _word) { _tr = ""; _wiki = null; }
  _word = raw;

  if (_prefetchWord !== raw) {
    _prefetchWord    = raw;
    _prefetchPromise = Promise.all([fetchTranslate(raw), fetchWikiData(raw)]).catch(() => null);
  }

  const rect = sel.getRangeAt(0).getBoundingClientRect();
  if (!rect.width) { hideMeaning(); return; }

  hidePopup();
  $meaning.style.top  = (rect.bottom + 10) + "px";
  $meaning.style.left = rect.left + "px";
  $meaning.style.display = "inline-flex";
  $meaning.classList.remove("pop");
  requestAnimationFrame(() => $meaning.classList.add("pop"));
}

function hideMeaning() { $meaning.style.display = "none"; $meaning.classList.remove("pop"); }
function hidePopup()   { $popup.style.display = "none"; $popup.classList.remove("slide"); }

function positionPopup(anchorRect) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const pw = $popup.offsetWidth || 300, ph = $popup.offsetHeight || 120, GAP = 8;
  let top  = anchorRect.bottom + GAP;
  if (top + ph > vh - 10) top = anchorRect.top - ph - GAP;
  top = Math.max(6, top);
  let left = anchorRect.left;
  if (left + pw > vw - 10) left = vw - pw - 10;
  left = Math.max(6, left);
  $popup.style.top  = top  + "px";
  $popup.style.left = left + "px";
}

/* ═══════════════════════════════════════════════════════════
   ANLAM POPUP
   ═══════════════════════════════════════════════════════════ */
async function openPopup() {
  const btnRect = $meaning.getBoundingClientRect();
  $popup.style.visibility = "hidden";
  $popup.style.display    = "block";
  $popup.classList.remove("slide");
  hideMeaning();
  _wiki = null;

  $popup.innerHTML = `<div class="ok-loading"><div class="ok-dots"><span></span><span></span><span></span></div><span>Çevriliyor…</span></div>`;
  positionPopup(btnRect);
  $popup.style.visibility = "visible";
  requestAnimationFrame(() => $popup.classList.add("slide"));

  let mainTr = "—", alts = [], wikiData = {};

  try {
    let result = null;
    if (_prefetchWord === _word && _prefetchPromise) result = await _prefetchPromise;
    if (!result) result = await Promise.all([fetchTranslate(_word), fetchWikiData(_word)]);
    [{ main: mainTr, alts }, wikiData] = result;
  } catch {
    $popup.innerHTML = `<div style="padding:16px;color:var(--ok-error);font-size:13px">Çeviri alınamadı.</div>`;
    positionPopup(btnRect);
    return;
  }

  _tr   = mainTr;
  _wiki = wikiData;

  const artHtml  = artikelBadgeHtml(wikiData.artikel, { size: 11 });
  const typeHtml = wikiData.wordType ? `<span class="ok-ptb">${wikiData.wordType}</span>` : "";
  const baseHtml = wikiData.baseForm
    ? `<div class="ok-pbase"><span>Temel form: <strong>${escapeHtml(wikiData.baseForm)}</strong></span><button class="ok-papply" id="ppApply">kullan →</button></div>` : "";
  const altsHtml = alts.length
    ? `<div class="ok-palts">${alts.slice(0,5).map(a => `<button class="ok-palt" data-a="${escapeHtml(a)}">${escapeHtml(a)}</button>`).join("")}</div>` : "";

  $popup.innerHTML = `
    <div class="ok-ph">
      <div class="ok-pw-row">${artHtml}<span class="ok-pw">${escapeHtml(_word)}</span>${typeHtml}</div>
      <button class="ok-px" id="ppClose">✕</button>
    </div>
    <div class="ok-pb">
      <div class="ok-pmain" id="ppMain">${escapeHtml(mainTr)}</div>
      ${altsHtml}${baseHtml}
      <div class="ok-ptags">
        <div class="ok-ptag-label">Etiket</div>
        <div class="ok-tag-chips" id="ppTags"></div>
      </div>
    </div>
    <div class="ok-pfoot">
      <button class="ok-psave" id="ppSave">+ Sözlüğe Ekle</button>
    </div>`;

  requestAnimationFrame(() => positionPopup(btnRect));

  const _ppLvl  = getAutoLevel(_word);
  const _ppTags = [...(wikiData.autoTags || [])];
  if (_ppLvl && !_ppTags.includes(_ppLvl)) _ppTags.push(_ppLvl);
  renderTagChips("ppTags", _ppTags, extractAllTags(_userWords));

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
    try { const nw = await fetchWikiData(_word); _wiki = nw; } catch { _wiki = {}; }
    $meaning.style.top  = $popup.style.top;
    $meaning.style.left = $popup.style.left;
    $meaning.style.display = "inline-flex";
    await openPopup();
  });

  document.getElementById("ppClose")?.addEventListener("click", hidePopup);
  document.getElementById("ppSave")?.addEventListener("click", saveFromPopup);
}

/* ── Popup'tan kaydet ─── */
async function saveFromPopup() {
  if (!isLoggedIn()) {
    showAuthGate({ title: 'Kelime kaydetmek için giriş yap', desc: 'Beğendiğin kelimeleri kişisel sözlüğüne eklemek ücretsiz.' });
    return;
  }

  const word = normalizeGermanWord(_word, _wiki);
  if (!word || !_tr || _tr === "—") { showToast("Kelime veya çeviri eksik.", false); return; }

  const btn = document.getElementById("ppSave");
  if (btn) { btn.disabled = true; btn.textContent = "Kaydediliyor…"; }

  try {
    const uid = window.getUserId?.();
    if (!uid) throw new Error("Oturum yok");

    const result = await saveWordOrAddMeaning(uid, word, _tr, getSelectedTags("ppTags"));
    getWords(uid).then(l => { _userWords = l; }).catch(() => {});
    hidePopup();
    _word = "";

    if (result.already) {
      showToast(`"${result.word}" için bu anlam zaten kayıtlı.`, false);
    } else if (result.merged) {
      showToast(`"${result.word}" kelimesine "${result.meaning}" eklendi`);
    } else {
      showToast(`"${result.word}" sözlüğe eklendi`);
    }
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

  on("wordModalClose",     "click", close);
  on("wordModalCancelBtn", "click", close);
  $overlay.addEventListener("click", e => { if (e.target === $overlay) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && _modalOpen) close(); });

  document.addEventListener("keydown", e => {
    if (e.key !== "s" && e.key !== "S") return;
    if (_modalOpen) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
    if (!_word) return;
    if (!isLoggedIn()) {
      showAuthGate({ title: 'Kelime kaydetmek için giriş yap', desc: 'Seçtiğin kelimeleri kişisel sözlüğüne eklemek için ücretsiz hesabına giriş yap.' });
      return;
    }
    hidePopup();
    openModal();
  });

  on("applyBaseFormBtn", "click", async () => {
    const base = _wiki?.baseForm;
    if (!base) return;
    _word = base;
    try { _wiki = await fetchWikiData(_word); } catch { _wiki = {}; }
    fillModalWord(true);
    renderTagChips("modalTagChips", _wiki?.autoTags || [], extractAllTags(_userWords));
  });

  on("modalMeaningInput", "keydown", e => { if (e.key === "Enter") doSaveModal(); });
  on("wordModalSaveBtn",  "click",   doSaveModal);
}

async function openModal() {
  $overlay.style.display = "flex";
  $overlay.classList.add("active");
  _modalOpen = true;

  fillModalWord(true);
  const okumaMountEl = document.getElementById('okumLemmaMount');
  if (okumaMountEl && _word) {
    showLemmaHintOnce({
      word: _word, mountEl: okumaMountEl,
      onApply: (lemma) => {
        const inp = document.getElementById('modalWordInput');
        if (inp) inp.value = lemma;
        okumaMountEl.innerHTML = '';
      }
    });
  }

  const inp = document.getElementById("modalMeaningInput");
  if (inp) { inp.value = ""; inp.placeholder = "Yükleniyor…"; }

  if (_prefetchWord === _word && _prefetchPromise) {
    try {
      const result = await _prefetchPromise;
      if (result) {
        const [{ main: mainTr }, wikiRes] = result;
        _tr   = mainTr;
        _wiki = wikiRes;
      }
    } catch { /* sessizce */ }
  }

  fillModalWord();
  if (inp) { inp.placeholder = "Türkçe anlamını gir…"; inp.value = _tr || ""; }

  const baseWrap = document.getElementById("modalBaseFormWrap");
  const baseText = document.getElementById("modalBaseFormText");
  if (baseWrap && baseText) {
    const base           = _wiki?.baseForm;
    baseText.textContent      = base || "";
    baseWrap.style.display    = base ? "flex" : "none";
  }

  const _okLvl  = getAutoLevel(_word);
  const _okTags = [...(_wiki?.autoTags || [])];
  if (_okLvl && !_okTags.includes(_okLvl)) _okTags.push(_okLvl);
  renderTagChips("modalTagChips", _okTags, extractAllTags(_userWords));
  setTimeout(() => inp?.focus(), 60);
}

function fillModalWord(force = false) {
  const badge = document.getElementById("modalArticleBadge");
  const input = document.getElementById("modalWordInput");
  if (!input) return;
  const wordNorm = normalizeGermanWord(_word, _wiki || {});
  if (force || input.value === "" || input.value === (input.dataset.lastFill || "")) {
    input.value            = wordNorm;
    input.dataset.lastFill = wordNorm;
  }
  if (badge) {
    badge.innerHTML = _wiki?.artikel ? artikelBadgeHtml(_wiki.artikel, { size: 13 }) : "";
  }
}

async function doSaveModal() {
  if (!isLoggedIn()) {
    showAuthGate({ title: 'Kelime kaydetmek için giriş yap', desc: 'Sözlüğüne kelime eklemek için ücretsiz hesabına giriş yapman yeterli.' });
    return;
  }

  const inp     = document.getElementById("modalMeaningInput");
  const meaning = inp?.value.trim();
  if (!meaning) { inp?.focus(); return; }

  const wordInput = document.getElementById("modalWordInput");
  const word      = wordInput?.value.trim() || normalizeGermanWord(_word, _wiki || {});
  const tags      = getSelectedTags("modalTagChips");
  const btn       = document.getElementById("wordModalSaveBtn");

  if (btn) { btn.disabled = true; btn.textContent = "Kaydediliyor…"; }

  try {
    const uid = window.getUserId?.();
    if (!uid) throw new Error("Oturum yok");

    const result = await saveWordOrAddMeaning(uid, word, meaning, tags);
    getWords(uid).then(l => { _userWords = l; }).catch(() => {});

    $overlay.style.display = "none";
    $overlay.classList.remove("active");
    _modalOpen = false;
    _word      = "";

    if (result.already) {
      showToast(`"${result.word}" için bu anlam zaten kayıtlı.`, false);
    } else if (result.merged) {
      showToast(`"${result.word}" kelimesine "${result.meaning}" eklendi`);
    } else {
      showToast(`"${result.word}" sözlüğe eklendi`);
    }
  } catch (err) {
    showToast("Kayıt başarısız: " + err.message, false);
    if (btn) { btn.disabled = false; btn.textContent = "Kaydet"; }
  }
}

/* ═══════════════════════════════════════════════════════════
   MİNİ YARDIMCILAR
   ═══════════════════════════════════════════════════════════ */
function on(id, ev, fn) { document.getElementById(id)?.addEventListener(ev, fn); }
function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }
function ss(k, v) { sessionStorage.setItem(k, v); }
function sg(k)    { return sessionStorage.getItem(k); }