import { getMetinler, deleteMetin, onAuthChange } from "./firebase.js";

let allMetinler = [];
let activeId    = null;

/* ============================
   GÜVENLİK: HTML ESCAPE
============================= */
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(ts){
  const d = new Date(ts);
  return d.toLocaleDateString("tr-TR", {
    day:"2-digit", month:"long", year:"numeric",
    hour:"2-digit", minute:"2-digit"
  });
}

function wordCount(text){
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/* ── Hata mesajı göster ─────────────────────────────────────────────────── */
function showError(msg) {
  const container = document.getElementById("historyList");
  if (!container) return;
  container.innerHTML = `
    <div style="
      padding:24px;border-radius:12px;
      background:rgba(224,82,82,0.08);
      border:1px solid rgba(224,82,82,0.2);
      color:#e05252;font-size:14px;text-align:center;
    ">⚠️ ${escapeHtml(msg)}</div>
  `;
}

function renderList(list){
  const container = document.getElementById("historyList");
  const empty     = document.getElementById("emptyState");

  [...container.querySelectorAll(".history-card")].forEach(el => el.remove());

  if(list.length === 0){
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  list.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "history-card";
    card.style.animationDelay = (idx * 40) + "ms";

    /* ── Güvenli DOM oluşturma ── */
    const metaDiv = document.createElement("div");
    metaDiv.className = "card-meta";

    const dateSpan = document.createElement("span");
    dateSpan.className = "card-date";
    dateSpan.textContent = formatDate(item.created);  // ← textContent: güvenli

    const wcSpan = document.createElement("span");
    wcSpan.className = "card-wordcount";
    wcSpan.textContent = wordCount(item.text) + " kelime";  // ← textContent: güvenli

    metaDiv.appendChild(dateSpan);
    metaDiv.appendChild(wcSpan);

    const previewDiv = document.createElement("div");
    previewDiv.className = "card-preview";
    previewDiv.textContent = item.text;  // ← textContent: güvenli (innerHTML DEĞİL)

    card.appendChild(metaDiv);
    card.appendChild(previewDiv);

    card.addEventListener("click", () => openModal(item));
    container.appendChild(card);
  });
}

function openModal(item){
  activeId = item.id;
  /* textContent ile set et — innerHTML kullanma */
  document.getElementById("modalDate").textContent = formatDate(item.created);
  document.getElementById("modalText").textContent = item.text;
  document.getElementById("previewModal").style.display = "flex";
}

function closeModal(){
  document.getElementById("previewModal").style.display = "none";
  activeId = null;
}

async function loadHistory(){
  const userId = window.getUserId();
  if(!userId){
    console.warn("Kullanıcı henüz yüklenmedi");
    return;
  }
  try {
    allMetinler = await getMetinler(userId);
    renderList(allMetinler);
  } catch (err) {
    showError(err.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {

  onAuthChange((user) => {
    if(user){
      loadHistory();
    }
  });

  document.getElementById("searchInput").addEventListener("input", (e) => {
    const q        = e.target.value.toLowerCase();
    const filtered = allMetinler.filter(m => m.text.toLowerCase().includes(q));
    renderList(filtered);
  });

  document.getElementById("modalClose").addEventListener("click", closeModal);

  document.getElementById("previewModal").addEventListener("click", (e) => {
    if(e.target.id === "previewModal") closeModal();
  });

  document.getElementById("modalRead").addEventListener("click", () => {
    const item = allMetinler.find(m => m.id === activeId);
    if(!item) return;

    sessionStorage.setItem("savedText", item.text);
    sessionStorage.setItem("returnPage", "../gecmis/");
    window.location.href = "../okuma/";
  });

  document.getElementById("modalDelete").addEventListener("click", async () => {
    if(activeId === null) return;
    const userId = window.getUserId();
    if (!userId) return;

    try {
      await deleteMetin(userId, activeId);
      closeModal();
      await loadHistory();
    } catch (err) {
      alert("Silme hatası: " + err.message);
    }
  });
});