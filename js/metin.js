/* ═══════════════════════════════════════════════════════════
   metin.js  —  AlmancaPratik Metin Editörü  v3
   ═══════════════════════════════════════════════════════════
   v3 eklemeleri:
   - Sidebar'da "Geçmiş Metinler" paneli
   - Geçmiş metne tıklayınca editöre yükle
   - Auth değişince geçmiş otomatik güncellenir
   ═══════════════════════════════════════════════════════════ */

import { saveMetin, getMetinler } from "./firebase.js";
import { showToast } from "../src/components/toast.js";
import { showAuthGate, isLoggedIn } from '../src/components/authGate.js';
import { onAuthChange } from "./firebase.js";

/* ─────────────────────────────────────────────────────────
   YARDIMCI: tek bir regex test fonksiyonu
   ───────────────────────────────────────────────────────── */
const test = (re, s) => re.test(s);

/* ═══════════════════════════════════════════════════════════
   parseText  —  Almanca metin yapı çözümleyici
   ═══════════════════════════════════════════════════════════ */
export function parseText(raw) {
  if (!raw || !raw.trim()) return [];

  const lines  = raw.split("\n");
  const blocks = [];
  let   buf    = [];

  const flush = () => {
    if (buf.length) {
      blocks.push({ type: "para", lines: [...buf] });
      buf = [];
    }
  };

  const isSectionBreak = t =>
    test(/^(\*\s*){3,}\s*$/, t) ||
    test(/^-{3,}\s*$/, t)       ||
    test(/^_{3,}\s*$/, t)       ||
    test(/^={3,}\s*$/, t)       ||
    test(/^~{3,}\s*$/, t)       ||
    test(/^(#\s*){3,}\s*$/, t)  ||
    test(/^(\.+\s*){3,}\s*$/, t)||
    test(/^(\xB7\s*){3,}\s*$/, t);

  const isTitle = (t, idx, arr) => {
    if (!t || t.length > 90) return false;
    if (test(/^#{1,3}\s+\S/, t)) return true;
    if (test(/^(Kapitel|Kap\.|Teil|Abschnitt|Buch|Band|Prolog|Epilog|Einleitung|Nachwort|Chapter|Part|Section|Introduction|Conclusion)\s+[\dIVXivx]/i, t)) return true;
    if (test(/^[IVXLCDM]+\.?\s*$/i, t) && t.replace(/\s/g,"").length <= 8) return true;
    if (test(/^\d{1,3}[.)]\s*$/, t)) return true;
    if (t === t.toUpperCase() && test(/[A-ZÜÖÄ]{3,}/, t) && !test(/[.!?,;:\u201E\u201C\u2018\u201A\u2013\u2014]/, t)) return true;
    if (idx === 0 && t.length <= 65 && !test(/[.!?,;:\u201E\u201C\u2013\u2014]/, t) && !test(/^[-\u2013\u2014]/, t)) return true;
    const prev2 = (arr[idx - 2] || "").trim();
    const prev1 = (arr[idx - 1] || "").trim();
    const next1 = (arr[idx + 1] || "").trim();
    const next2 = (arr[idx + 2] || "").trim();
    const isolatedByDouble = prev1 === "" && prev2 === "" && next1 === "" && next2 === "";
    const isolatedBySingle = idx > 0 && prev1 === "" && next1 === "";
    if ((isolatedByDouble || isolatedBySingle) && t.length <= 60 && !test(/[.!?,;:\u201E\u201C\u2018\u201A\u2013\u2014\u2015]/, t) && !test(/^[-\u2013\u2014]/, t)) return true;
    return false;
  };

  const isDialog = t => {
    if (test(/^[\u201E\u201C\u201A\u2018]/, t)) return true;
    if (test(/^["']/, t)) return true;
    if (test(/^[\u2013\u2014]\s[A-Za-zÄÖÜäöüß\d]/, t)) return true;
    if (test(/^-\s[A-ZÜÖÄ]/, t)) return true;
    return false;
  };

  const isQuote = (raw_line) => {
    if (test(/^>\s/, raw_line.trimStart())) return true;
    if (test(/^(\t|    )/, raw_line)) return true;
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const t       = rawLine.trim();
    if (!t) { flush(); continue; }
    if (isSectionBreak(t)) { flush(); blocks.push({ type: "section" }); continue; }
    if (isTitle(t, i, lines)) { flush(); blocks.push({ type: "title", text: t.replace(/^#{1,3}\s*/, "") }); continue; }
    if (isDialog(t)) { flush(); blocks.push({ type: "dialog", text: t }); continue; }
    if (isQuote(rawLine)) { flush(); blocks.push({ type: "quote", text: t.replace(/^>\s*/, "") }); continue; }
    buf.push(t);
  }
  flush();
  return blocks;
}

/* ═══════════════════════════════════════════════════════════
   Blokları HTML'e çevir (önizleme)
   ═══════════════════════════════════════════════════════════ */
function blocksToHtml(blocks) {
  const esc = s => String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return blocks.map(b => {
    switch (b.type) {
      case "title":   return `<div class="pv-title">${esc(b.text)}</div>`;
      case "dialog":  return `<div class="pv-dialog">${esc(b.text)}</div>`;
      case "quote":   return `<div class="pv-quote">${esc(b.text)}</div>`;
      case "section": return `<div class="pv-section">\u2726 &nbsp; \u2726 &nbsp; \u2726</div>`;
      case "para":    return `<div class="pv-para">${b.lines.map(esc).join("<br>")}</div>`;
      default:        return "";
    }
  }).join("") || `<span style="color:var(--muted);font-style:italic">Metin boş.</span>`;
}

/* ═══════════════════════════════════════════════════════════
   Canlı istatistik
   ═══════════════════════════════════════════════════════════ */
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

function updateStructure(blocks) {
  const count = type => blocks.filter(b => b.type === type).length;
  document.getElementById("structTitles").textContent   = count("title");
  document.getElementById("structDialogs").textContent  = count("dialog");
  document.getElementById("structParas").textContent    = count("para");
  document.getElementById("structSections").textContent = count("section");
}

function setAutoSaveState(state) {
  const dot   = document.getElementById("saveDot");
  const label = document.getElementById("saveLabel");
  if (!dot || !label) return;
  dot.className = "save-dot " + state;
  const labels = { saved: "Kaydedildi", unsaved: "Kaydedilmedi", saving: "Kaydediliyor\u2026" };
  label.textContent = labels[state] || "";
}

/* ═══════════════════════════════════════════════════════════
   Metin araçları
   ═══════════════════════════════════════════════════════════ */
function cleanText(raw) {
  return raw
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]+|[ \t]+$/gm, "")
    .trim();
}

function fixDashes(raw) {
  return raw
    .replace(/\s*--\s*/g, " \u2014 ")
    .replace(/ - /g,       " \u2013 ")
    .replace(/^- /gm,      "\u2014 ");
}

function fixQuotes(raw) {
  return raw
    .replace(/"([^"]+)"/g, "\u201E$1\u201C")
    .replace(/'([^']+)'/g, "\u201A$1\u2018");
}

/* ═══════════════════════════════════════════════════════════
   GEÇMİŞ SIDEBAR
   ═══════════════════════════════════════════════════════════ */
function formatRelativeDate(ts) {
  const diff  = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)   return "Az önce";
  if (mins  < 60)  return `${mins} dk önce`;
  if (hours < 24)  return `${hours} sa önce`;
  if (days  < 7)   return `${days} gün önce`;
  return new Date(ts).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Sidebar geçmiş listesini render eder.
 * @param {Array} items  — Firebase'den gelen metin nesneleri dizisi
 * @param {HTMLElement} editor — contenteditable div
 */
function renderSidebarHistory(items, editor) {
  const container = document.getElementById("sidebarHistory");
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `<div class="sidebar-history-empty">Henüz kaydedilmiş metin yok.</div>`;
    return;
  }

  container.innerHTML = "";

  /* En fazla 8 metin göster */
  items.slice(0, 8).forEach((item, idx) => {
    const el = document.createElement("button");
    el.className = "sidebar-history-item";
    el.style.animationDelay = (idx * 35) + "ms";

    /* Tarih */
    const date = document.createElement("span");
    date.className = "shi-date";
    date.textContent = formatRelativeDate(item.created);

    /* Önizleme */
    const preview = document.createElement("span");
    preview.className = "shi-preview";
    preview.textContent = item.text.trim().slice(0, 80);

    /* Kelime sayısı */
    const wc = document.createElement("span");
    wc.className = "shi-wc";
    wc.textContent = wordCount(item.text) + " kelime";

    el.appendChild(date);
    el.appendChild(preview);
    el.appendChild(wc);

    el.addEventListener("click", () => loadHistoryItem(item, editor));
    container.appendChild(el);
  });
}

/**
 * Seçilen geçmiş metni editöre yükler.
 * Mevcut içerik varsa onay ister.
 */
function loadHistoryItem(item, editor) {
  const current = editor.innerText.trim();
  if (current && !confirm("Editördeki mevcut metin silinecek. Devam etmek istiyor musunuz?")) return;

  editor.innerText = item.text;
  updateStats(item.text);
  updateStructure(parseText(item.text));
  setAutoSaveState("saved");
  sessionStorage.setItem("savedText", item.text);

  /* Editöre scroll */
  editor.scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("Metin editöre yüklendi", "ok");
}

/**
 * Geçmişi Firebase'den çeker ve sidebar'ı günceller.
 */
async function loadSidebarHistory(editor) {
  const container = document.getElementById("sidebarHistory");
  if (!container) return;

  if (!isLoggedIn()) {
    container.innerHTML = `<div class="sidebar-history-empty">Geçmişi görmek için giriş yapın.</div>`;
    return;
  }

  container.innerHTML = `<div class="sidebar-history-empty">Yükleniyor…</div>`;

  try {
    const userId = window.getUserId?.();
    if (!userId) throw new Error("Kullanıcı bulunamadı");
    const items = await getMetinler(userId);
    renderSidebarHistory(items, editor);
  } catch (err) {
    container.innerHTML = `<div class="sidebar-history-empty sidebar-history-error">Geçmiş yüklenemedi.</div>`;
    console.error("Sidebar geçmiş hatası:", err);
  }
}

/* ═══════════════════════════════════════════════════════════
   ANA MODÜL
   ═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {

  const editor  = document.getElementById("textArea");
  const readBtn = document.getElementById("goReadBtn");
  if (!editor) return;

  /* URL parametresinden metin yükle */
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

  /* Auth değişince geçmişi güncelle */
  onAuthChange(() => loadSidebarHistory(editor));

  /* ── Akıllı yapıştırma ── */
  editor.addEventListener("paste", e => {
    e.preventDefault();
    let text = (e.clipboardData || window.clipboardData).getData("text");
    text = text
      .replace(/[ \t]+/g, " ")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim();
    document.execCommand("insertText", false, text);
  });

  /* ── Canlı analiz (debounce) ── */
  let analysisTimer = null;
  let autoSaveTimer = null;

  editor.addEventListener("input", () => {
    const text = editor.innerText;
    updateStats(text);
    clearTimeout(analysisTimer);
    analysisTimer = setTimeout(() => updateStructure(parseText(text)), 300);
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
    showToast("Tireler düzeldi (\u2013 ve \u2014)", "ok");
  });

  document.getElementById("btnFixQuotes")?.addEventListener("click", () => {
    const fixed = fixQuotes(editor.innerText);
    editor.innerText = fixed;
    updateStats(fixed);
    updateStructure(parseText(fixed));
    showToast("Tırnaklar Almanca formatına dönüştürüldü", "ok");
  });

  document.getElementById("btnClear")?.addEventListener("click", () => {
    if (!editor.innerText.trim()) return;
    if (confirm("Editördeki metni silmek istediğinize emin misiniz?")) {
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
  backdrop?.addEventListener("click",  closeModal);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  /* ── Okuma moduna geç ── */
  readBtn?.addEventListener("click", async () => {
    const text = editor.innerText.trim();
    if (!text) { showToast("Metin boş!", "err"); return; }

    if (!isLoggedIn()) {
      const blocks = parseText(text);
      sessionStorage.setItem("savedText",    text);
      sessionStorage.setItem("parsedBlocks", JSON.stringify(blocks));
      sessionStorage.setItem("returnPage",   "../metin/");
      window.location.href = "../okuma/";
      return;
    }

    readBtn.disabled    = true;
    readBtn.textContent = "Kaydediliyor…";
    try {
      const blocks = parseText(text);
      await saveMetin(window.getUserId(), text);
      /* Kayıt sonrası sidebar'ı güncelle */
      loadSidebarHistory(editor);
      sessionStorage.setItem("savedText",    text);
      sessionStorage.setItem("parsedBlocks", JSON.stringify(blocks));
      sessionStorage.setItem("returnPage",   "../metin/");
      window.location.href = "../okuma/";
    } catch (err) {
      showToast("Kayıt sırasında bir hata oluştu", "err");
      readBtn.disabled    = false;
      readBtn.innerHTML   = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg> Okuma Moduna Geç`;
    }
  });

});