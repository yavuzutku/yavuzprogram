// =============================================
// TAG.JS — Ortak etiket sistemi
// =============================================

export const TAG_OPTIONS = [
  "fiil","isim","sıfat","zarf","A1","A2","B1","B2","seyahat","iş"
];

/**
 * Bir container içine chip'leri + özel etiket input'unu render eder.
 * @param {string} containerId  — chip'lerin ekleneceği div'in id'si
 * @param {string[]} selected   — başlangıçta seçili olacak tag'ler
 */
export function renderTagChips(containerId, selected = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  // Sabit chip'ler
  TAG_OPTIONS.forEach(tag => {
    container.appendChild(_makeChip(tag, selected.includes(tag)));
  });

  // ↓ SADECE BU BLOK EKLENDİ ↓
  // selected içinde TAG_OPTIONS'da olmayan özel etiketleri de göster
  selected.forEach(tag => {
    if (!TAG_OPTIONS.includes(tag)) {
      container.appendChild(_makeChip(tag, true));
    }
  });
  // ↑ SADECE BU BLOK EKLENDİ ↑
  // Özel etiket input'u
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

    // Zaten varsa sadece seç
    const existing = [...container.querySelectorAll(".tag-chip")]
      .find(c => c.dataset.tag.toLowerCase() === val.toLowerCase());

    if (existing) {
      existing.classList.add("selected");
    } else {
      container.insertBefore(_makeChip(val, true), wrapper);
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

/**
 * Bir container içindeki seçili tag'leri döndürür.
 * @param {string} containerId
 * @returns {string[]}
 */
export function getSelectedTags(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return [...container.querySelectorAll(".tag-chip.selected")]
    .map(c => c.dataset.tag);
}

// ── İç yardımcı ──
function _makeChip(tag, selected = false) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "tag-chip" + (selected ? " selected" : "");
  chip.dataset.tag = tag;
  chip.textContent = tag;
  chip.addEventListener("click", () => chip.classList.toggle("selected"));
  return chip;
}