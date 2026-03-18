/* ═══════════════════════════════════════════════════════════
   metin.js  —  AlmancaPratik Metin Editörü  v2
   ═══════════════════════════════════════════════════════════
   parseText() tamamen yeniden yazıldı:
   - Başlık  : çok daha katı kural seti
   - Diyalog : sadece gerçek Almanca diyalog işareti
   - Alıntı  : >  ve girinti tabanlı
   - Bölüm   : geniş ayraç seti
   - Para    : kalan her şey (yanlış pozitif minimum)
   ═══════════════════════════════════════════════════════════ */

import { saveMetin } from "./firebase.js";
import { showToast } from "../src/components/toast.js";
import { showAuthGate, isLoggedIn } from '../src/components/authGate.js';

/* ─────────────────────────────────────────────────────────
   YARDIMCI: tek bir regex test fonksiyonu
   ───────────────────────────────────────────────────────── */
const test = (re, s) => re.test(s);

/* ═══════════════════════════════════════════════════════════
   parseText  —  Almanca metin yapı çözümleyici
   ═══════════════════════════════════════════════════════════

   Blok tipleri:
     title   — bölüm / kısım başlığı
     dialog  — diyalog satırı (Almanca açılış tırnağı veya diyalog çizgisi)
     quote   — alıntı / epigraf
     section — görsel bölüm ayracı (*** gibi)
     para    — standart paragraf (birden fazla satır birleşebilir)
   ═══════════════════════════════════════════════════════════ */
export function parseText(raw) {
  if (!raw || !raw.trim()) return [];

  const lines  = raw.split("\n");
  const blocks = [];
  let   buf    = [];     /* para buffer */

  /* Birikmiş paragraf satırlarını bloğa at */
  const flush = () => {
    if (buf.length) {
      blocks.push({ type: "para", lines: [...buf] });
      buf = [];
    }
  };

  /* ── 1. BÖLÜM AYRAÇLARI ─────────────────────────────── */
  /* * * *, ***, ---, ___, ===, ~~~, . . ., · · ·          */
  const isSectionBreak = t =>
    test(/^(\*\s*){3,}\s*$/, t) ||          /* * * * */
    test(/^-{3,}\s*$/, t)       ||          /* --- */
    test(/^_{3,}\s*$/, t)       ||          /* ___ */
    test(/^={3,}\s*$/, t)       ||          /* === */
    test(/^~{3,}\s*$/, t)       ||          /* ~~~ */
    test(/^(#\s*){3,}\s*$/, t)  ||          /* # # # */
    test(/^(\.+\s*){3,}\s*$/, t)||          /* . . . */
    test(/^(\xB7\s*){3,}\s*$/, t);          /* · · · */

  /* ── 2. BAŞLIK ──────────────────────────────────────── */
  /*
     Kural kümesi — YALNIZCA aşağıdakilerden biri sağlanırsa başlık:

     a) Markdown # / ## / ###
     b) Bölüm/kısım anahtar kelimeleri + rakam/romen
     c) Sadece romen rakamı olan kısa satır
     d) Sadece rakam+nokta/parantez (1. / 2) gibi)
     e) TAMAMEN büyük harf + ≥ 3 harf + noktalama YOK
     f) İlk satır: kısa, noktalama yok, diyalog işareti yok
     g) Çift boş satırla çevrilmiş + kısa + HİÇBİR noktalama yok
        (virgül dahil — en katı kural)
  */
  const isTitle = (t, idx, arr) => {
    if (!t || t.length > 90) return false;

    /* a) Markdown heading */
    if (test(/^#{1,3}\s+\S/, t)) return true;

    /* b) Almanca/İngilizce bölüm anahtar kelimeleri */
    if (test(/^(Kapitel|Kap\.|Teil|Abschnitt|Buch|Band|Prolog|Epilog|Einleitung|Nachwort|Chapter|Part|Section|Introduction|Conclusion)\s+[\dIVXivx]/i, t)) return true;

    /* c) Yalnızca romen rakamı (I, II, III … XLVIII) + opsiyonel nokta */
    if (test(/^[IVXLCDM]+\.?\s*$/i, t) && t.replace(/\s/g,"").length <= 8) return true;

    /* d) Yalnızca numara: "1." "2)" "42." */
    if (test(/^\d{1,3}[.)]\s*$/, t)) return true;

    /* e) TAM BÜYÜK HARF başlık (min 3 harf, noktalama yok) */
    if (
      t === t.toUpperCase() &&
      test(/[A-ZÜÖÄ]{3,}/, t) &&
      !test(/[.!?,;:\u201E\u201C\u2018\u201A\u2013\u2014]/, t)
    ) return true;

    /* f) Metnin ilk satırı: kısa, yalnızca tek satır, noktalama yok,
          diyalog başlamıyor */
    if (
      idx === 0 &&
      t.length <= 65 &&
      !test(/[.!?,;:\u201E\u201C\u2013\u2014]/, t) &&
      !test(/^[-\u2013\u2014]/, t)
    ) return true;

    /* g) Çift boş satır arasında izole kısa satır — EN KATI:
          nokta, ünlem, soru, virgül, noktalı virgül, iki nokta,
          Almanca tırnak, tire-em/en HİÇBİRİ olamaz */
    const prev2 = (arr[idx - 2] || "").trim();
    const prev1 = (arr[idx - 1] || "").trim();
    const next1 = (arr[idx + 1] || "").trim();
    const next2 = (arr[idx + 2] || "").trim();
    const isolatedByDouble = prev1 === "" && prev2 === "" && next1 === "" && next2 === "";
    const isolatedBySingle = idx > 0 && prev1 === "" && next1 === "";

    if (
      (isolatedByDouble || isolatedBySingle) &&
      t.length <= 60 &&
      !test(/[.!?,;:\u201E\u201C\u2018\u201A\u2013\u2014\u2015]/, t) &&
      !test(/^[-\u2013\u2014]/, t)
    ) return true;

    return false;
  };

  /* ── 3. DİYALOG ─────────────────────────────────────── */
  /*
     Sadece gerçek Almanca diyalog işaretleri:

     • „Text..." veya "Text..."   — Almanca/genel açılış tırnağı
     • ‚Text...' veya 'Text...'   — tek tırnak diyalog
     • – Text / — Text            — diyalog çizgisi + BOŞLUK + harf/rakam
       (SADECE boşluk varsa; – bağlama çizgisi ise boşluk olmaz)

     Önemli: "–Text" (boşluksuz) diyalog değil → para'ya düşer.
  */
  const isDialog = t => {
    /* Almanca/çift açılış tırnağı */
    if (test(/^[\u201E\u201C\u201A\u2018]/, t)) return true;
    /* Standart çift/tek tırnak açılışı */
    if (test(/^["']/, t)) return true;
    /* Diyalog çizgisi: em-dash veya en-dash + boşluk + harf/rakam */
    if (test(/^[\u2013\u2014]\s[A-Za-zÄÖÜäöüß\d]/, t)) return true;
    /* Kısa çizgi (ASCII) diyalog: satır başı "- " + büyük harf
       (küçük harfle başlarsa liste veya bağlaç olabilir, ama bölümün
       bağlamına göre belirlenmesi güç — büyük harf zorunlu yapıyoruz) */
    if (test(/^-\s[A-ZÜÖÄ]/, t)) return true;
    return false;
  };

  /* ── 4. ALINTI ──────────────────────────────────────── */
  /*
     • Markdown > alıntısı
     • 4+ boşluk veya tab ile girintili satır (epigraf / alıntı bloğu)
  */
  const isQuote = (raw_line) => {
    if (test(/^>\s/, raw_line.trimStart())) return true;
    /* gerçek başlangıç girintisi: ≥ 4 boşluk veya tab */
    if (test(/^(\t|    )/, raw_line)) return true;
    return false;
  };

  /* ── ANA DÖNGÜ ───────────────────────────────────────── */
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const t       = rawLine.trim();

    /* Boş satır → para buffer'ı boşalt */
    if (!t) {
      flush();
      continue;
    }

    if (isSectionBreak(t)) {
      flush();
      blocks.push({ type: "section" });
      continue;
    }

    if (isTitle(t, i, lines)) {
      flush();
      blocks.push({ type: "title", text: t.replace(/^#{1,3}\s*/, "") });
      continue;
    }

    if (isDialog(t)) {
      flush();
      blocks.push({ type: "dialog", text: t });
      continue;
    }

    if (isQuote(rawLine)) {
      flush();
      blocks.push({ type: "quote", text: t.replace(/^>\s*/, "") });
      continue;
    }

    /* Geri kalan: paragraf satırı */
    buf.push(t);
  }

  /* Son buffer'ı boşalt */
  flush();

  return blocks;
}

/* ═══════════════════════════════════════════════════════════
   Blokları HTML'e çevir (önizleme)
   ═══════════════════════════════════════════════════════════ */
function blocksToHtml(blocks) {
  const esc = s => String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

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

/* ═══════════════════════════════════════════════════════════
   Metin araçları
   ═══════════════════════════════════════════════════════════ */

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
    .replace(/\s*--\s*/g, " \u2014 ")   /* -- → em-dash — */
    .replace(/ - /g,       " \u2013 ")  /* yalnız tire → en-dash – */
    .replace(/^- /gm,      "\u2014 ");  /* satır başı - → — */
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

  /* ── Akıllı yapıştırma: satır yapısını koru ── */
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