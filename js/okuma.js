import { saveWord, getWords } from "./firebase.js";
import { renderTagChips, getSelectedTags, extractAllTags } from "./tag.js";

document.addEventListener("DOMContentLoaded", async () => {

  const text   = sessionStorage.getItem("savedText");
  const reader = document.getElementById("readerText");

  if (!text || text.trim().length < 1) {
    reader.innerHTML = "<h2>Metin Bulunamadı</h2>";
    return;
  }

  loadText(text);
  createTranslateUI();

  try {
    const userId = window.getUserId?.();
    if (userId) _userWords = await getWords(userId);
  } catch(e) {}

  document.getElementById("modalMeaningInput")
    .addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveWordFromModal();
    });
});

/* ══════════════════════════════════════════════
   GENEL
══════════════════════════════════════════════ */
function goBack() {
  sessionStorage.removeItem("returnPage");
  window.location.href = "../metin/";
}

let currentSize = 20;

function increaseFont() {
  currentSize += 2;
  document.getElementById("readerText").style.fontSize = currentSize + "px";
}

function decreaseFont() {
  currentSize = Math.max(12, currentSize - 2);
  document.getElementById("readerText").style.fontSize = currentSize + "px";
}

function toggleDark() {
  document.body.classList.toggle("light-mode");
}

const readerText = document.getElementById("readerText");

function loadText(text) {
  readerText.innerText = text;
}

window.goBack             = goBack;
window.increaseFont       = increaseFont;
window.decreaseFont       = decreaseFont;
window.toggleDark         = toggleDark;
window.openAddWordModal   = openAddWordModal;
window.closeAddWordModal  = closeAddWordModal;
window.saveWordFromModal  = saveWordFromModal;
window.closeMiniTranslate = closeMiniTranslate;
window.saveWordFromPopup  = saveWordFromPopup;

/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
let selectedWordGlobal = "";
let _userWords         = [];
let _popupWikiData     = null;   // popup için Wiktionary verisi
let _wikiCache         = new Map();

/* ══════════════════════════════════════════════
   WİKTİONARY — ORTAK YARDIMCI
   (ceviri.js ile aynı mantık, okuma.js'e kopyalandı)
══════════════════════════════════════════════ */
async function fetchWikiForWord(word) {
  if (_wikiCache.has(word)) return _wikiCache.get(word);

  const result = { artikel: "", wordType: "", plural: "", genitive: "", baseForm: "", autoTags: [] };

  try {
    const cap = word.charAt(0).toUpperCase() + word.slice(1);
    const params = new URLSearchParams({
      action: "parse", page: cap,
      prop: "wikitext", format: "json", origin: "*"
    });
    const res  = await fetch("https://de.wiktionary.org/w/api.php?" + params);
    const data = await res.json();
    const wt   = data?.parse?.wikitext?.["*"] || "";

    if (!wt) { _wikiCache.set(word, result); return result; }

    // Kelime türü
    const typeMatch = wt.match(/\{\{Wortart\|([^|}\n]+)/);
    if (typeMatch) {
      const raw = typeMatch[1].trim();
      const typeMap = {
        "Substantiv": { label: "İsim", tag: "isim" },
        "Verb":       { label: "Fiil", tag: "fiil" },
        "Adjektiv":   { label: "Sıfat", tag: "sıfat" },
        "Adverb":     { label: "Zarf",  tag: "zarf" },
      };
      const info = typeMap[raw] || { label: raw, tag: null };
      result.wordType = info.label;
      if (info.tag) result.autoTags.push(info.tag);

      // Artikel (sadece isimler)
      if (raw === "Substantiv") {
        if (/\|\s*Genus\s*=\s*m/i.test(wt))       result.artikel = "der";
        else if (/\|\s*Genus\s*=\s*[fp]/i.test(wt)) result.artikel = "die";
        else if (/\|\s*Genus\s*=\s*n/i.test(wt))   result.artikel = "das";

        const pMatch = wt.match(/\|\s*Nominativ Plural\s*=\s*([^\n|{}]+)/);
        if (pMatch) {
          const p = pMatch[1].trim().replace(/\[\[|\]\]/g, "");
          if (p && p !== "—" && p !== "-") result.plural = p;
        }
        const gMatch = wt.match(/\|\s*Genitiv Singular\s*=\s*([^\n|{}]+)/);
        if (gMatch) {
          const g = gMatch[1].trim().replace(/\[\[|\]\]/g, "");
          if (g && g !== "—" && g !== "-") result.genitive = g;
        }
      }

      // Fiil: temel form
      if (raw === "Verb") {
        const bMatch = wt.match(/\|\s*Grundform\s*=\s*([^\n|{}]+)/);
        if (bMatch) {
          const b = bMatch[1].trim().replace(/\[\[|\]\]/g, "");
          if (b && b.toLowerCase() !== word.toLowerCase()) result.baseForm = b;
        }
        const iMatch = wt.match(/\|\s*Infinitiv\s*=\s*([^\n|{}]+)/);
        if (!result.baseForm && iMatch) {
          const inf = iMatch[1].trim().replace(/\[\[|\]\]/g, "");
          if (inf && inf.toLowerCase() !== word.toLowerCase()) result.baseForm = inf;
        }
      }

      // Sıfat: temel form
      if (raw === "Adjektiv") {
        const pMatch = wt.match(/\|\s*Positiv\s*=\s*([^\n|{}]+)/);
        if (pMatch) {
          const pos = pMatch[1].trim().replace(/\[\[|\]\]/g, "");
          if (pos && pos.toLowerCase() !== word.toLowerCase()) result.baseForm = pos;
        }
      }
    }
  } catch { /* sessizce geç */ }

  _wikiCache.set(word, result);
  return result;
}

/* ══════════════════════════════════════════════
   ÇEVİRİ POPUP SİSTEMİ
══════════════════════════════════════════════ */
function createTranslateUI() {

  const btn = document.createElement("button");
  btn.id = "floatingMeaningBtn";
  btn.innerText = "💬 Anlam";
  btn.style.cssText = `
    display: none;
    position: absolute;
    z-index: 9999;
    padding: 6px 12px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  `;
  btn.onclick = openMiniTranslate;
  document.body.appendChild(btn);

  const popup = document.createElement("div");
  popup.id = "miniTranslatePopup";
  popup.style.cssText = `
    display: none;
    position: absolute;
    z-index: 9999;
    background: #1a1a26;
    border: 1px solid rgba(201,168,76,0.25);
    border-radius: 14px;
    padding: 14px;
    min-width: 240px;
    max-width: 300px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.45);
    font-size: 14px;
    color: #e2e8f0;
  `;
  document.body.appendChild(popup);

  readerText.addEventListener("mouseup", function() {
    const selObj = window.getSelection();
    if (!selObj || selObj.rangeCount === 0) { btn.style.display = "none"; return; }

    let selection = selObj.toString().trim();
    selection = selection.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    if (selection.length === 0) { btn.style.display = "none"; return; }

    selectedWordGlobal = selection;
    const range = selObj.getRangeAt(0);
    const rect  = range.getBoundingClientRect();
    if (!rect || rect.width === 0) { btn.style.display = "none"; return; }

    popup.style.display = "none";
    btn.style.display   = "block";
    btn.style.top  = (window.scrollY + rect.bottom + 8) + "px";
    btn.style.left = (window.scrollX + rect.left) + "px";
  });

  document.addEventListener("mousedown", function(e) {
    const leftToolbar      = document.querySelector(".left-toolbar");
    const wordModalOverlay = document.getElementById("wordModalOverlay");

    const clickedInside =
      readerText.contains(e.target)    ||
      btn.contains(e.target)           ||
      popup.contains(e.target)         ||
      (leftToolbar && leftToolbar.contains(e.target)) ||
      (wordModalOverlay && wordModalOverlay.contains(e.target));

    if (!clickedInside) {
      btn.style.display   = "none";
      popup.style.display = "none";
      window.getSelection().removeAllRanges();
      selectedWordGlobal = "";
    }
  });
}

function openMiniTranslate() {
  const btn   = document.getElementById("floatingMeaningBtn");
  const popup = document.getElementById("miniTranslatePopup");

  btn.style.display   = "none";
  popup.style.display = "block";
  popup.style.top  = btn.style.top;
  popup.style.left = btn.style.left;

  _popupWikiData = null;

  // Yükleniyor durumu
  popup.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;color:#888;font-size:13px;">
      <div class="popup-loading-dots"><span></span><span></span><span></span></div>
      Çevriliyor…
    </div>
  `;

  // Google Translate + Wiktionary paralel
  Promise.all([
    fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=tr&dt=t&dt=at&q=${encodeURIComponent(selectedWordGlobal)}`)
      .then(r => r.json()),
    fetchWikiForWord(selectedWordGlobal),
  ])
  .then(([transData, wiki]) => {
    const main = transData[0]?.map(t => t?.[0]).filter(Boolean).join("") || "—";
    window._lastTranslated = main;
    _popupWikiData = wiki;

    // Alternatifler
    const alts = [];
    if (transData[5]) {
      transData[5].forEach(entry => {
        entry?.[2]?.forEach(item => {
          const w = item?.[0];
          if (w && w !== main) alts.push(w);
        });
      });
    }

    // Artikel badge
    const artikelColor = { der: "#60c8f0", die: "#f07068", das: "#a064ff" };
    const artikelBg    = { der: "rgba(96,200,240,0.12)", die: "rgba(240,112,104,0.1)", das: "rgba(160,100,255,0.1)" };
    const artikelHtml  = wiki.artikel
      ? `<span style="font-family:monospace;font-size:12px;padding:2px 8px;border-radius:5px;background:${artikelBg[wiki.artikel]};color:${artikelColor[wiki.artikel]};border:1px solid ${artikelColor[wiki.artikel]}33;">${wiki.artikel}</span>`
      : "";

    // Kelime türü badge
    const typeHtml = wiki.wordType
      ? `<span style="font-size:11px;padding:2px 8px;border-radius:5px;background:rgba(255,255,255,0.06);color:#888;border:1px solid rgba(255,255,255,0.1);">${wiki.wordType}</span>`
      : "";

    // Temel form satırı (gehe → gehen)
    const baseFormHtml = wiki.baseForm
      ? `<div style="margin-top:8px;padding:8px 10px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:12px;color:#aaa;display:flex;align-items:center;justify-content:space-between;gap:8px;">
           <span>Temel form: <strong style="color:#e2e8f0;font-family:monospace;">${wiki.baseForm}</strong></span>
           <button id="popupApplyBase" style="padding:3px 8px;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:6px;color:#c9a84c;font-size:11px;cursor:pointer;font-weight:600;">kullan →</button>
         </div>`
      : "";

    // Alternatif chip'ler
    const altsHtml = alts.length > 0
      ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;">
           ${alts.slice(0, 5).map(a =>
             `<button class="popup-alt-chip" data-alt="${a.replace(/"/g,'&quot;')}"
                style="padding:3px 10px;border-radius:14px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#94a3b8;font-size:12px;cursor:pointer;"
              >${a}</button>`
           ).join("")}
         </div>`
      : "";

    popup.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:6px;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          ${artikelHtml}
          <span style="font-weight:700;color:#c9a84c;font-size:15px;">${escapeHtml(selectedWordGlobal)}</span>
          ${typeHtml}
        </div>
        <button onclick="closeMiniTranslate()" style="background:none;border:none;cursor:pointer;font-size:16px;color:#555;flex-shrink:0;">✕</button>
      </div>

      <div style="color:#94a3b8;font-size:14px;margin-bottom:4px;" id="popupMainTranslation">${escapeHtml(main)}</div>

      ${altsHtml}
      ${baseFormHtml}

      <div style="font-size:10px;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:0.5px;margin:10px 0 5px;">Etiket</div>
      <div id="popupTagChips" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;"></div>

      <button id="popupSaveBtn"
        style="width:100%;padding:8px 0;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;"
      >➕ Sözlüğe Ekle</button>
    `;

    // autoTag'leri seçili render et
    renderTagChips("popupTagChips", wiki.autoTags, extractAllTags(_userWords));

    // Alternatif chip event'leri
    popup.querySelectorAll(".popup-alt-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        window._lastTranslated = btn.dataset.alt;
        popup.querySelector("#popupMainTranslation").textContent = btn.dataset.alt;
      });
    });

    // Temel form uygula
    const applyBtn = popup.querySelector("#popupApplyBase");
    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        selectedWordGlobal = wiki.baseForm;
        closeMiniTranslate();
        // Popup'ı yeniden aç yeni kelime ile
        const floatBtn = document.getElementById("floatingMeaningBtn");
        floatBtn.style.display = "block";
        openMiniTranslate();
      });
    }

    // Kaydet
    popup.querySelector("#popupSaveBtn").addEventListener("click", saveWordFromPopup);
  })
  .catch(() => {
    popup.innerHTML = `<span style="color:#ef4444;">Çeviri başarısız oldu.</span>`;
  });
}

function closeMiniTranslate() {
  document.getElementById("miniTranslatePopup").style.display = "none";
  selectedWordGlobal = "";
  _popupWikiData = null;
}

async function saveWordFromPopup() {
  let word      = selectedWordGlobal;
  const meaning = window._lastTranslated;

  if (!word || !meaning) {
    showToast("❌ Kelime veya çeviri bulunamadı.", true);
    return;
  }

  const saveBtn = document.getElementById("popupSaveBtn");
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Kaydediliyor..."; }

  try {
    const userId = window.getUserId();
    if (!userId) throw new Error("Oturum yok");

    // Artikel varsa ekle, baş harf büyüt
    if (_popupWikiData?.artikel) {
      word = `${_popupWikiData.artikel} ${word.charAt(0).toUpperCase() + word.slice(1)}`;
    } else if (_popupWikiData?.wordType === "İsim") {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }

    const tags = getSelectedTags("popupTagChips");

    await saveWord(userId, word, meaning, tags);
    closeMiniTranslate();
    window._lastTranslated = "";
    showToast(`✅ "${word}" kaydedildi!`);

  } catch(err) {
    console.error(err);
    showToast("❌ Kayıt başarısız.", true);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "➕ Sözlüğe Ekle"; }
  }
}

/* ══════════════════════════════════════════════
   KELİME EKLEME — MANUEL MODAL
══════════════════════════════════════════════ */
function openAddWordModal() {
  if (!selectedWordGlobal) {
    alert("Önce metinden bir kelime seç.");
    return;
  }

  const wiki = _wikiCache.get(selectedWordGlobal);

  // Artikel varsa önizlemede göster
  const artikelColor = { der: "#60c8f0", die: "#f07068", das: "#a064ff" };
  const artikel = wiki?.artikel || "";
  const displayEl = document.getElementById("modalWordDisplay");
  if (artikel) {
    displayEl.innerHTML = `<span style="font-family:monospace;font-size:14px;margin-right:6px;color:${artikelColor[artikel]};">${artikel}</span>${escapeHtml(selectedWordGlobal.charAt(0).toUpperCase() + selectedWordGlobal.slice(1))}`;
  } else {
    displayEl.textContent = selectedWordGlobal;
  }

  // Temel form uyarısı
  const baseWrap = document.getElementById("modalBaseFormWrap");
  const baseSpan = document.getElementById("modalBaseFormText");
  if (baseWrap && baseSpan && wiki?.baseForm) {
    baseSpan.textContent = wiki.baseForm;
    baseWrap.style.display = "flex";
  } else if (baseWrap) {
    baseWrap.style.display = "none";
  }

  document.getElementById("modalMeaningInput").value = "";
  renderTagChips("modalTagChips", wiki?.autoTags || [], extractAllTags(_userWords));

  document.getElementById("wordModalOverlay").classList.add("active");
  setTimeout(() => document.getElementById("modalMeaningInput").focus(), 100);
}

// "Temel formu kullan" — modal içindeki buton
window.applyModalBaseForm = function() {
  const wiki = _wikiCache.get(selectedWordGlobal);
  if (!wiki?.baseForm) return;
  selectedWordGlobal = wiki.baseForm;

  const baseWrap = document.getElementById("modalBaseFormWrap");
  if (baseWrap) baseWrap.style.display = "none";

  // Wiki cache'de yoksa fetch et, sonra modalı güncelle
  fetchWikiForWord(wiki.baseForm).then(newWiki => {
    const displayEl = document.getElementById("modalWordDisplay");
    const artikelColor = { der: "#60c8f0", die: "#f07068", das: "#a064ff" };
    const a = newWiki.artikel;
    if (a) {
      displayEl.innerHTML = `<span style="font-family:monospace;font-size:14px;margin-right:6px;color:${artikelColor[a]};">${a}</span>${escapeHtml(wiki.baseForm.charAt(0).toUpperCase() + wiki.baseForm.slice(1))}`;
    } else {
      displayEl.textContent = wiki.baseForm;
    }
    renderTagChips("modalTagChips", newWiki.autoTags, extractAllTags(_userWords));
  });
};

function closeAddWordModal() {
  document.getElementById("wordModalOverlay").classList.remove("active");
}

async function saveWordFromModal() {
  const meaning = document.getElementById("modalMeaningInput").value.trim();
  if (!meaning) {
    document.getElementById("modalMeaningInput").focus();
    return;
  }

  const wiki    = _wikiCache.get(selectedWordGlobal) || {};
  const tags    = getSelectedTags("modalTagChips");
  const saveBtn = document.querySelector(".word-modal-save");
  saveBtn.disabled    = true;
  saveBtn.textContent = "Kaydediliyor...";

  try {
    const userId = window.getUserId();
    if (!userId) throw new Error("Oturum yok");

    // Artikel + baş harf
    let word = selectedWordGlobal;
    if (wiki.artikel) {
      word = `${wiki.artikel} ${word.charAt(0).toUpperCase() + word.slice(1)}`;
    } else if (wiki.wordType === "İsim") {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }

    await saveWord(userId, word, meaning, tags);
    closeAddWordModal();
    selectedWordGlobal = "";
    showToast(`✅ "${word}" kaydedildi!`);

  } catch(err) {
    console.error(err);
    showToast("❌ Kayıt başarısız.", true);
  } finally {
    saveBtn.disabled    = false;
    saveBtn.textContent = "Kaydet ✓";
  }
}

/* ══════════════════════════════════════════════
   YARDIMCI
══════════════════════════════════════════════ */
function showToast(msg, isError = false) {
  const toast = document.createElement("div");
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: ${isError ? "#ef4444" : "#22c55e"};
    color: white;
    padding: 10px 22px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    z-index: 99999;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* CSS — loading dots (popup içinde kullanılan animasyon) */
const styleEl = document.createElement("style");
styleEl.textContent = `
  .popup-loading-dots { display:flex; gap:4px; }
  .popup-loading-dots span {
    width:5px; height:5px; border-radius:50%; background:#c9a84c;
    animation: popupdot 1.2s ease-in-out infinite;
  }
  .popup-loading-dots span:nth-child(2) { animation-delay:0.2s; }
  .popup-loading-dots span:nth-child(3) { animation-delay:0.4s; }
  @keyframes popupdot {
    0%,80%,100% { transform:scale(0.6); opacity:0.35; }
    40%         { transform:scale(1);   opacity:1; }
  }
`;
document.head.appendChild(styleEl);