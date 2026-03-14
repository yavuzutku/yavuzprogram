/* ═══════════════════════════════════════════════════════════
   metin.js  —  AlmancaPratik Metin Editörü
   ═══════════════════════════════════════════════════════════
   Özellikler:
   1. parseText()        — yapı analizi (başlık/diyalog/paragraf/bölüm)
   2. Canlı istatistik   — kelime, karakter, cümle, okuma süresi
   3. Metin araçları     — temizle, tire düzelt, tırnak düzelt
   4. Otomatik kayıt     — 2 sn debounce → sessionStorage
   5. Önizleme modu      — kitap görünümü modal'da
   ═══════════════════════════════════════════════════════════ */

import { saveMetin } from "./firebase.js";

import { showToast } from "../src/components/toast.js";



/* ── Metin Parser ────────────────────────────────────────── */
function parseText(raw) {
  const lines = raw.split("\n");
  const blocks = [];
  let buf = [];

  const flush = () => {
    if (buf.length) { blocks.push({ type: "para", lines: [...buf] }); buf = []; }
  };

  /* Bölüm ayracı: * * *, ---, ### */
  const isSectionBreak = l => /^\s*(\*\s*\*\s*\*|---+|###)\s*$/.test(l.trim());

  /* Almanca diyalog: „ " \u201E \u201C – — ile başlayan satır */
  const isDialogue = l => {
    const t = l.trim();
    return /^[\u201E\u201C\u2013\u2014]/.test(t) || /^[-\u2013\u2014]\s/.test(t);
  };

  /* Markdown alıntı */
  const isQuote = l => /^>\s/.test(l.trim());

  /* Başlık tespiti */
  const isTitle = (l, i, arr) => {
    const t = l.trim();
    if (!t) return false;
    if (/^#{1,3}\s/.test(t)) return true;
    if (i === 0 && t.length < 70 && !/[.!?,;]$/.test(t)) return true;
    const prev = (arr[i - 1] || "").trim();
    const next = (arr[i + 1] || "").trim();
    return prev === "" && next === "" && t.length < 70 && !/[.!?,;\u201E]/.test(t);
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const t = l.trim();

    if (isSectionBreak(t))       { flush(); blocks.push({ type: "section" }); continue; }
    if (!t)                       { flush(); continue; }
    if (isTitle(t, i, lines))    { flush(); blocks.push({ type: "title",  text: t.replace(/^#{1,3}\s*/, "") }); continue; }
    if (isDialogue(t))           { flush(); blocks.push({ type: "dialog", text: t }); continue; }
    if (isQuote(t))              { flush(); blocks.push({ type: "quote",  text: t.replace(/^>\s*/, "") }); continue; }
    buf.push(t);
  }
  flush();
  return blocks;
}

/* ── Blokları HTML'e çevir (önizleme) ───────────────────── */
function blocksToHtml(blocks) {
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let html = "";
  for (const b of blocks) {
    if      (b.type === "title")   html += `<div class="pv-title">${esc(b.text)}</div>`;
    else if (b.type === "dialog")  html += `<div class="pv-dialog">${esc(b.text)}</div>`;
    else if (b.type === "quote")   html += `<div class="pv-quote">${esc(b.text)}</div>`;
    else if (b.type === "section") html += `<div class="pv-section">\u2726 &nbsp; \u2726 &nbsp; \u2726</div>`;
    else if (b.type === "para")    html += `<div class="pv-para">${b.lines.map(esc).join("<br>")}</div>`;
  }
  return html || `<span style="color:var(--muted);font-style:italic">Metin boş.</span>`;
}

/* ── Canlı istatistik ────────────────────────────────────── */
function updateStats(text) {
  const words     = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars     = text.length;
  const sentences = (text.match(/[.!?…]+/g) || []).length;
  const readTime  = Math.max(1, Math.round(words / 200));

  document.getElementById("statWords").textContent     = words.toLocaleString("tr");
  document.getElementById("statChars").textContent     = chars.toLocaleString("tr");
  document.getElementById("statSentences").textContent = sentences.toLocaleString("tr");
  document.getElementById("statTime").textContent      = readTime + " dk";
  document.getElementById("charCount").textContent     = chars.toLocaleString("tr");
}

/* ── Yapı analizi güncelle ───────────────────────────────── */
function updateStructure(blocks) {
  const count = type => blocks.filter(b => b.type === type).length;
  document.getElementById("structTitles").textContent   = count("title");
  document.getElementById("structDialogs").textContent  = count("dialog");
  document.getElementById("structParas").textContent    = count("para");
  document.getElementById("structSections").textContent = count("section");
}

/* ── Autosave göstergesi ─────────────────────────────────── */
function setAutoSaveState(state) {
  const dot   = document.getElementById("saveDot");
  const label = document.getElementById("saveLabel");
  if (!dot || !label) return;
  dot.className = "save-dot " + state;
  const labels = { saved: "Kaydedildi", unsaved: "Kaydedilmedi", saving: "Kaydediliyor\u2026" };
  label.textContent = labels[state] || "";
}

/* ── Metin araçları ──────────────────────────────────────── */

/* Gereksiz boşluk ve fazladan boş satırları temizle */
function cleanText(raw) {
  return raw
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]+|[ \t]+$/gm, "")
    .trim();
}

/* Tire karakterlerini Almanca standardına getir */
function fixDashes(raw) {
  return raw
    .replace(/\s*--\s*/g, " \u2014 ")    /* -- → em-dash — */
    .replace(/ - /g,       " \u2013 ")   /* yalnız tire → en-dash – */
    .replace(/^- /gm,      "\u2014 ");   /* satır başı - → — */
}

/* Tırnakları Almanca formatına dönüştür */
function fixQuotes(raw) {
  return raw
    .replace(/"([^"]+)"/g, "\u201E$1\u201C")   /* "..." → „..." */
    .replace(/'([^']+)'/g, "\u201A$1\u2018");   /* '...' → ‚...' */
}

/* ═══════════════════════════════════════════════════════════
   ANA MODÜL
   ═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {

  const editor  = document.getElementById("textArea");
  const readBtn = document.getElementById("goReadBtn");
  if (!editor) return;

  /* URL parametresinden metin yükle (?text=...) */
  const urlParams = new URLSearchParams(window.location.search);
  const urlText   = urlParams.get("text");
  if (urlText?.trim()) {
    editor.innerText = urlText.trim();
    window.history.replaceState({}, "", window.location.pathname);
  } else {
    const saved = sessionStorage.getItem("savedText");
    if (saved) editor.innerText = saved;
  }

  /* İlk render */
  const initial = editor.innerText;
  updateStats(initial);
  updateStructure(parseText(initial));
  if (initial.trim()) setAutoSaveState("saved");

  /* ── Akıllı yapıştırma — satır yapısını koru ── */
  editor.addEventListener("paste", e => {
    e.preventDefault();
    let text = (e.clipboardData || window.clipboardData).getData("text");
    text = text
      .replace(/[ \t]+/g, " ")    /* çoklu boşluk → tek */
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim();
    document.execCommand("insertText", false, text);
  });

  /* ── Canlı analiz (debounce) ── */
  let analysisTimer  = null;
  let autoSaveTimer  = null;

  editor.addEventListener("input", () => {
    const text = editor.innerText;

    /* Anlık sayaç */
    updateStats(text);

    /* Yapı analizi — 300ms sonra */
    clearTimeout(analysisTimer);
    analysisTimer = setTimeout(() => updateStructure(parseText(text)), 300);

    /* Autosave — 2 sn sonra */
    setAutoSaveState("unsaved");
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      if (text.trim()) {
        setAutoSaveState("saving");
        sessionStorage.setItem("savedText", text);
        setTimeout(() => setAutoSaveState("saved"), 500);
      }
    }, 2000);
  });

  /* ── Araç butonları ── */

  document.getElementById("btnClean")?.addEventListener("click", () => {
    const cleaned = cleanText(editor.innerText);
    editor.innerText = cleaned;
    updateStats(cleaned);
    updateStructure(parseText(cleaned));
    showToast("Metin temizlendi", "ok");
  });

  document.getElementById("btnFixDashes")?.addEventListener("click", () => {
    const fixed = fixDashes(editor.innerText);
    editor.innerText = fixed;
    updateStats(fixed);
    updateStructure(parseText(fixed));
    showToast("Tireler d\u00fczeldi (\u2013 ve \u2014)", "ok");
  });

  document.getElementById("btnFixQuotes")?.addEventListener("click", () => {
    const fixed = fixQuotes(editor.innerText);
    editor.innerText = fixed;
    updateStats(fixed);
    updateStructure(parseText(fixed));
    showToast("T\u0131rnaklar Almanca format\u0131na d\u00f6n\u00fc\u015ft\u00fcr\u00fcld\u00fc", "ok");
  });

  document.getElementById("btnClear")?.addEventListener("click", () => {
    if (!editor.innerText.trim()) return;
    if (confirm("Edit\u00f6rdeki metni silmek istedi\u011finize emin misiniz?")) {
      editor.innerText = "";
      updateStats("");
      updateStructure([]);
      sessionStorage.removeItem("savedText");
      setAutoSaveState("unsaved");
      showToast("Metin silindi");
    }
  });

  /* ── Önizleme modal ── */
  const modal      = document.getElementById("previewModal");
  const modalClose = document.getElementById("previewClose");
  const backdrop   = document.getElementById("previewBackdrop");
  const content    = document.getElementById("previewContent");

  document.getElementById("btnPreview")?.addEventListener("click", () => {
    const blocks = parseText(editor.innerText.trim());
    content.innerHTML = blocksToHtml(blocks);
    modal.classList.add("open");
  });

  const closeModal = () => modal.classList.remove("open");
  modalClose?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", closeModal);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  /* ── Okuma moduna geç ── */
  readBtn?.addEventListener("click", async () => {
    const text = editor.innerText.trim();

    if (!text) {
      showToast("Metin bo\u015f!", "err");
      return;
    }

    const userId = window.getUserId?.();
    if (!userId) {
      alert("Oturum bulunamad\u0131, l\u00fctfen tekrar giri\u015f yap\u0131n.");
      window.location.href = "../";
      return;
    }

    /* Butonu devre dışı bırak */
    readBtn.disabled     = true;
    readBtn.textContent  = "Kaydediliyor\u2026";

    try {
      const blocks = parseText(text);
      await saveMetin(userId, text);
      sessionStorage.setItem("savedText",    text);
      sessionStorage.setItem("parsedBlocks", JSON.stringify(blocks));
      sessionStorage.setItem("returnPage",   "../metin/");
      window.location.href = "../okuma/";
    } catch (err) {
      console.error("Kay\u0131t hatas\u0131:", err);
      showToast("Kay\u0131t s\u0131ras\u0131nda bir hata olu\u015ftu", "err");
      readBtn.disabled = false;
      readBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
        </svg>
        Okuma Moduna Ge\u00e7`;
    }
  });

});