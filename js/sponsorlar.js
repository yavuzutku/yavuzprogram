import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, addDoc,
  deleteDoc, updateDoc, doc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ── Firebase init ── */
const firebaseConfig = {
  apiKey:            "AIzaSyCGpRMUNNSx4Kla2YrmDOBHlLSt4rOM1wQ",
  authDomain:        "lernen-deutsch-bea69.firebaseapp.com",
  projectId:         "lernen-deutsch-bea69",
  storageBucket:     "lernen-deutsch-bea69.firebasestorage.app",
  messagingSenderId: "653560965391",
  appId:             "1:653560965391:web:545142e9be6d130a54b67a"
};

const app  = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

const SPONSORS_COL = collection(db, "sponsors");

/* ──────────────────────────────────────────────────────────────────
   ADMIN KONTROLÜ — iki hesap
──────────────────────────────────────────────────────────────────── */
const ADMIN_EMAILS = ["yavuzutku144@gmail.com", "almancapratik80@gmail.com"];

let currentUser = null;
let isAdmin     = false;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  isAdmin     = !!(user && ADMIN_EMAILS.includes(user.email));
  renderAdminArea();
});

/* ── Firestore helpers ── */
async function loadSponsors() {
  try {
    const q    = query(SPONSORS_COL, orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("[loadSponsors]", e);
    return [];
  }
}

async function addSponsorToDb(data) {
  const ref = await addDoc(SPONSORS_COL, data);
  return ref.id;
}

async function deleteSponsorFromDb(id) {
  await deleteDoc(doc(db, "sponsors", id));
}

async function updateSponsorInDb(id, data) {
  await updateDoc(doc(db, "sponsors", id), data);
}

/* ── State ── */
let sponsors  = [];
let editingId = null;

/* ── Init ── */
(async () => {
  sponsors = await loadSponsors();
  renderSponsors();
})();

/* ══════════════════════════════════════════════
   RENDER — PUBLIC SPONSOR GRID
══════════════════════════════════════════════ */
function renderSponsors() {
  const grid       = document.getElementById("sponsorGrid");
  const totalNum   = document.getElementById("totalNum");
  const totalCount = document.getElementById("totalCount");

  const sorted = [...sponsors].sort((a, b) => b.amount - a.amount);
  const total  = sponsors.reduce((s, x) => s + Number(x.amount || 0), 0);

  totalNum.textContent   = total.toLocaleString("tr-TR");
  totalCount.textContent = sponsors.length + " sponsor";

  if (!sponsors.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="icon">🏅</div>
        <p>Henüz sponsor eklenmemiş.</p>
      </div>`;
    return;
  }

  grid.innerHTML = sorted.map(sp => `
    <div class="sponsor-card">
      ${sp.image
        ? `<img class="sponsor-avatar" src="${esc(sp.image)}" alt="${esc(sp.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : ""}
      <div class="sponsor-avatar-placeholder" ${sp.image ? 'style="display:none"' : ""}>
        ${esc(sp.name).charAt(0).toUpperCase()}
      </div>
      <div class="sponsor-name">${esc(sp.name)}</div>
      <div class="sponsor-amount">💛 ₺${Number(sp.amount).toLocaleString("tr-TR")}</div>
      ${sp.note ? `<div class="sponsor-note">"${esc(sp.note)}"</div>` : ""}
    </div>
  `).join("");
}

/* ══════════════════════════════════════════════
   RENDER — ADMIN AREA
══════════════════════════════════════════════ */
function renderAdminArea() {
  const area = document.getElementById("adminArea");
  if (!area) return;

  if (!isAdmin) {
    area.innerHTML = "";
    return;
  }

  area.innerHTML = `
    <div class="admin-section">
      <div class="admin-header">
        <div class="admin-title">
          ⚙️ Sponsor Yönetimi
          <span class="admin-badge">Admin</span>
        </div>
        <span style="font-size:13px;color:#666;">${esc(currentUser.email)}</span>
      </div>

      <div class="sponsor-form">
        <div class="form-group">
          <label>Sponsor İsmi *</label>
          <input type="text" id="newName" placeholder="Ad Soyad veya Kurum">
        </div>
        <div class="form-group">
          <label>Bağış Miktarı (₺) *</label>
          <input type="number" id="newAmount" placeholder="0" min="0">
        </div>
        <div class="form-group full">
          <label>Görsel URL (opsiyonel)</label>
          <div class="img-preview-wrap">
            <input type="url" id="newImage" placeholder="https://örnek.com/foto.jpg" oninput="previewImg()">
            <img id="imgPreview" src="" alt="önizleme">
          </div>
        </div>
        <div class="form-group full">
          <label>Not / Mesaj (opsiyonel)</label>
          <textarea id="newNote" rows="2" placeholder="Destekçinin bir mesajı..."></textarea>
        </div>
      </div>

      <div class="form-actions" style="margin-bottom:36px">
        <button class="btn btn-gold" onclick="addSponsor()">➕ Sponsor Ekle</button>
        <button class="btn btn-ghost" onclick="clearForm()">Temizle</button>
      </div>

      <div class="section-title">Mevcut Sponsorlar (${sponsors.length})</div>
      <div class="admin-list" id="adminList">${buildAdminList()}</div>
    </div>`;
}

function buildAdminList() {
  if (!sponsors.length) return `<p style="color:#555;font-size:14px">Henüz sponsor yok.</p>`;
  return [...sponsors].sort((a, b) => b.amount - a.amount).map(sp => `
    <div class="admin-item">
      ${sp.image
        ? `<img class="admin-item-img" src="${esc(sp.image)}" alt="${esc(sp.name)}" onerror="this.src=''">`
        : `<div class="admin-item-img" style="background:rgba(201,168,76,0.12);display:flex;align-items:center;justify-content:center;font-size:20px">${esc(sp.name).charAt(0).toUpperCase()}</div>`}
      <div class="admin-item-info">
        <div class="admin-item-name">${esc(sp.name)}</div>
        <div class="admin-item-meta">₺${Number(sp.amount).toLocaleString("tr-TR")}</div>
      </div>
      <div class="admin-item-actions">
        <button class="btn btn-ghost btn-sm" onclick="openEdit('${sp.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteSponsor('${sp.id}')">🗑️</button>
      </div>
    </div>
  `).join("");
}

/* ── Add ── */
async function addSponsor() {
  if (!isAdmin) return;
  const name   = document.getElementById("newName").value.trim();
  const amount = document.getElementById("newAmount").value;
  const image  = document.getElementById("newImage").value.trim();
  const note   = document.getElementById("newNote").value.trim();

  if (!name || !amount) { showToast("⚠️ İsim ve miktar zorunlu!"); return; }

  try {
    const data  = { name, amount: Number(amount), image, note, createdAt: Date.now() };
    const newId = await addSponsorToDb(data);
    sponsors.push({ id: newId, ...data });
    renderSponsors();
    renderAdminArea();
    clearForm();
    showToast("🎉 Sponsor eklendi!");
  } catch (e) {
    showToast("❌ Eklenemedi: " + e.message);
  }
}

/* ── Delete ── */
async function deleteSponsor(id) {
  if (!isAdmin) return;
  if (!confirm("Bu sponsoru silmek istediğinize emin misiniz?")) return;
  try {
    await deleteSponsorFromDb(id);
    sponsors = sponsors.filter(s => s.id !== id);
    renderSponsors();
    renderAdminArea();
    showToast("🗑️ Sponsor silindi.");
  } catch (e) {
    showToast("❌ Silinemedi: " + e.message);
  }
}

/* ── Edit ── */
function openEdit(id) {
  const sp = sponsors.find(s => s.id === id);
  if (!sp) return;
  editingId = id;
  document.getElementById("editName").value   = sp.name;
  document.getElementById("editAmount").value = sp.amount;
  document.getElementById("editImage").value  = sp.image || "";
  document.getElementById("editNote").value   = sp.note  || "";
  document.getElementById("editModal").classList.add("open");
}

function closeModal() {
  document.getElementById("editModal").classList.remove("open");
  editingId = null;
}

async function saveEdit() {
  if (!isAdmin) return;
  const sp = sponsors.find(s => s.id === editingId);
  if (!sp) return;

  sp.name   = document.getElementById("editName").value.trim();
  sp.amount = Number(document.getElementById("editAmount").value);
  sp.image  = document.getElementById("editImage").value.trim();
  sp.note   = document.getElementById("editNote").value.trim();

  if (!sp.name || !sp.amount) { showToast("⚠️ İsim ve miktar zorunlu!"); return; }

  try {
    await updateSponsorInDb(editingId, {
      name: sp.name, amount: sp.amount, image: sp.image, note: sp.note
    });
    closeModal();
    renderSponsors();
    renderAdminArea();
    showToast("✅ Değişiklikler kaydedildi!");
  } catch (e) {
    showToast("❌ Kaydedilemedi: " + e.message);
  }
}

document.getElementById("editModal")?.addEventListener("click", function(e) {
  if (e.target === this) closeModal();
});

/* ── Helpers ── */
function previewImg() {
  const val = document.getElementById("newImage").value;
  const img = document.getElementById("imgPreview");
  if (val) { img.src = val; img.style.display = "block"; }
  else img.style.display = "none";
}

function clearForm() {
  ["newName","newAmount","newImage","newNote"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const preview = document.getElementById("imgPreview");
  if (preview) preview.style.display = "none";
}

function esc(str = "") {
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

/* ── Global exports ── */
window.addSponsor    = addSponsor;
window.deleteSponsor = deleteSponsor;
window.openEdit      = openEdit;
window.saveEdit      = saveEdit;
window.closeModal    = closeModal;
window.previewImg    = previewImg;
window.clearForm     = clearForm;