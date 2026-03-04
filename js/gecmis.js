import { getMetinler, deleteMetin, auth, onAuthChange } from "./firebase.js";

let allMetinler = [];
let activeId    = null;

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
    card.innerHTML = `
      <div class="card-meta">
        <span class="card-date">${formatDate(item.created)}</span>
        <span class="card-wordcount">${wordCount(item.text)} kelime</span>
      </div>
      <div class="card-preview">${item.text}</div>
    `;
    card.addEventListener("click", () => openModal(item));
    container.appendChild(card);
  });
}

function openModal(item){
  activeId = item.id;
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
  allMetinler = await getMetinler(userId);
  renderList(allMetinler);
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
    // ✅ Geri dön butonu geçmişe dönsün
    sessionStorage.setItem("returnPage", "gecmis.html");
    window.location.href = "okuma.html";
  });

  document.getElementById("modalDelete").addEventListener("click", async () => {
    if(activeId === null) return;
    const userId = window.getUserId();
    await deleteMetin(userId, activeId);
    closeModal();
    await loadHistory();
  });
});