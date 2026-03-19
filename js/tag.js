/* ═══════════════════════════════════════════════════════════
   js/tag.js  —  Etiket sistemi
   • getAutoLevel(word) → "A1" | null  (A1 listesi dahili)
   • renderTagChips    → seçili chip'lerde × silme butonu
═══════════════════════════════════════════════════════════ */

export const TAG_OPTIONS = [
  "fiil","isim","sıfat","zarf","A1","A2","B1","B2","seyahat","iş"
];
import _A1_RAW from './levels/a1.js';
import _A2_RAW from './levels/a2.js';
import _B1_RAW from './levels/b1.js';
import _B2_RAW from './levels/b2.js';
// ── Stil enjeksiyonu (bir kez) ────────────────────────────────
let _cssDone = false;
function _injectStyle() {
  if (_cssDone) return; _cssDone = true;
  const s = document.createElement('style');
  s.textContent = `
    .tag-chip { display:inline-flex; align-items:center; gap:3px; }
    .tag-chip-del {
      display:inline-flex; align-items:center; justify-content:center;
      width:15px; height:15px; border-radius:50%;
      font-size:12px; font-weight:700; line-height:1;
      cursor:pointer; opacity:0.5;
      transition:opacity 0.15s, background 0.15s;
      flex-shrink:0; margin-left:2px;
    }
    .tag-chip-del:hover { opacity:1; background:rgba(255,255,255,0.18); }
  `;
  document.head.appendChild(s);
}

// ── Kelime normalizasyonu ─────────────────────────────────────
function _norm(w) {
  if (!w) return '';
  return w.trim().toLowerCase()
    .replace(/^(der|die|das)\s+/i, '')  // artikel sil
    .split(',')[0].trim()               // "ein, eine" → "ein"
    .split(' ')[0].trim();              // "zu Hause" → "zu"
}

// ── A1 Ham Kelime Listesi ─────────────────────────────────────


// Set oluştur: artikel soyulmuş, küçük harf
const A1_WORDS = new Set(_A1_RAW.map(_norm).filter(Boolean));
const A2_WORDS = new Set(_A2_RAW.map(_norm).filter(Boolean));
const B1_WORDS = new Set(_B1_RAW.map(_norm).filter(Boolean));
const B2_WORDS = new Set(_B2_RAW.map(_norm).filter(Boolean));

// ── Otomatik seviye tespiti ───────────────────────────────────
export function getAutoLevel(word) {
  if (!word) return null;
  const n = _norm(word);
  if (!n) return null;
  if (A1_WORDS.has(n)) return 'A1';
  if (A2_WORDS.has(n)) return 'A2';
  if (B1_WORDS.has(n)) return 'B1';
  if (B2_WORDS.has(n)) return 'B2';
  return null;
}

// ── Kullanıcının tüm kelimelerinden unique tag'leri toplar ────
export function extractAllTags(words = []) {
  const set = new Set(TAG_OPTIONS);
  words.forEach(w => {
    if (Array.isArray(w.tags)) w.tags.forEach(t => set.add(t));
  });
  return [...set];
}

// ── Chip: silme butonu ────────────────────────────────────────
function _appendDelBtn(chip, isCustom) {
  const x = document.createElement("span");
  x.className = "tag-chip-del";
  x.textContent = "×";
  x.title = "Etiketi kaldır";
  x.addEventListener("click", e => {
    e.stopPropagation();
    if (isCustom) {
      chip.remove();                       // özel etiket: DOM'dan sil
    } else {
      chip.classList.remove("selected");   // standart etiket: sadece seçimi kaldır
      x.remove();
    }
  });
  chip.appendChild(x);
}

function _makeChip(tag, selected = false, isCustom = false) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "tag-chip" + (selected ? " selected" : "");
  chip.dataset.tag      = tag;
  chip.dataset.isCustom = isCustom ? "1" : "";

  const label = document.createElement("span");
  label.textContent = tag;
  chip.appendChild(label);

  if (selected) _appendDelBtn(chip, isCustom);

  chip.addEventListener("click", () => {
    const nowSel = chip.classList.contains("selected");
    if (nowSel) {
      chip.classList.remove("selected");
      chip.querySelector(".tag-chip-del")?.remove();
    } else {
      chip.classList.add("selected");
      _appendDelBtn(chip, isCustom);
    }
  });

  return chip;
}

// ── Ana render fonksiyonu ─────────────────────────────────────
export function renderTagChips(containerId, selected = [], allTags = TAG_OPTIONS) {
  _injectStyle();
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  // Standart + kullanıcı tag'leri
  allTags.forEach(tag => {
    container.appendChild(_makeChip(tag, selected.includes(tag), false));
  });

  // selected içinde allTags'de olmayan özel etiketler
  selected.forEach(tag => {
    if (!allTags.includes(tag)) {
      container.appendChild(_makeChip(tag, true, true));
    }
  });

  // ── Özel etiket ekleme alanı ──
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;gap:6px;margin-top:8px;width:100%;";

  const input = document.createElement("input");
  input.placeholder = "Yeni etiket...";
  input.style.cssText = `
    flex:1;min-width:0;
    background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.12);
    border-radius:8px;color:white;
    font-size:12px;font-family:inherit;
    padding:6px 10px;outline:none;transition:0.2s;
  `;
  input.addEventListener("focus", () => input.style.borderColor = "#c9a84c");
  input.addEventListener("blur",  () => input.style.borderColor = "rgba(255,255,255,0.12)");

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "+ Ekle";
  addBtn.style.cssText = `
    padding:6px 12px;border-radius:8px;white-space:nowrap;
    border:1px solid rgba(201,168,76,0.4);
    background:rgba(201,168,76,0.1);color:#c9a84c;
    font-size:12px;font-family:inherit;cursor:pointer;
    font-weight:600;transition:0.2s;
  `;
  addBtn.addEventListener("mouseenter", () => addBtn.style.background = "rgba(201,168,76,0.2)");
  addBtn.addEventListener("mouseleave", () => addBtn.style.background = "rgba(201,168,76,0.1)");

  function addCustomTag() {
    const val = input.value.trim();
    if (!val) return;
    const existing = [...container.querySelectorAll(".tag-chip")]
      .find(c => c.dataset.tag.toLowerCase() === val.toLowerCase());
    if (existing) {
      if (!existing.classList.contains("selected")) {
        existing.classList.add("selected");
        _appendDelBtn(existing, !!existing.dataset.isCustom);
      }
    } else {
      container.insertBefore(_makeChip(val, true, true), wrapper);
    }
    input.value = "";
    input.focus();
  }

  addBtn.addEventListener("click", addCustomTag);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addCustomTag(); }
  });

  wrapper.appendChild(input);
  wrapper.appendChild(addBtn);
  container.appendChild(wrapper);
}

// ── Seçili tag'leri döndür ────────────────────────────────────
export function getSelectedTags(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return [...container.querySelectorAll(".tag-chip.selected")]
    .map(c => c.dataset.tag);
}