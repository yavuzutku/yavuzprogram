
import { onAdminChange } from "../src/admin.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, getDoc,
  doc, updateDoc, deleteDoc, query, orderBy, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* ── Firebase ── */
const firebaseConfig = {
  apiKey:            "AIzaSyCGpRMUNNSx4Kla2YrmDOBHlLSt4rOM1wQ",
  authDomain:        "lernen-deutsch-bea69.firebaseapp.com",
  projectId:         "lernen-deutsch-bea69",
  storageBucket:     "lernen-deutsch-bea69.firebasestorage.app",
  messagingSenderId: "653560965391",
  appId:             "1:653560965391:web:545142e9be6d130a54b67a"
};
const app  = getApps().find(a=>a.name==="[DEFAULT]") || initializeApp(firebaseConfig);
const db   = getFirestore(app);

const BLOGS_COL   = collection(db, "blogs");

/* ── State ── */
let currentUser = null;
let isAdmin     = false;

/* ── Admin değişimini merkezi modülden dinle ── */
onAdminChange((adminStatus, user) => {
  isAdmin     = adminStatus;
  currentUser = user;
  document.getElementById("btnNewPost").style.display = adminStatus ? "flex" : "none";
});
let editingId     = null;
let coverFile     = null;
let coverDataUrl  = null;
let deleteTargetId= null;
let wordTimer     = null;


/* ── View switching + URL routing ── */
let _currentPostId = null;

function showView(id, urlParams = {}) {
  ["viewList","viewPost","viewEditor"].forEach(v => {
    document.getElementById(v).classList.toggle("active", v === id);
  });
  window.scrollTo(0, 0);

  // URL güncelle
  const url = new URL(window.location.href);
  url.search = "";
  if (id === "viewPost"   && urlParams.slug) url.searchParams.set("p",    urlParams.slug);
  if (id === "viewPost"   && !urlParams.slug && urlParams.id) url.searchParams.set("id", urlParams.id);
  if (id === "viewEditor" && urlParams.edit)  url.searchParams.set("edit", urlParams.edit);
  if (id === "viewEditor" && !urlParams.edit) url.searchParams.set("edit", "new");
  history.pushState({view: id, ...urlParams}, "", url.toString());
}

// Geri/ileri tuşu
window.addEventListener("popstate", e => {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("p");
  const id   = params.get("id");
  const edit = params.get("edit");
  if (edit) {
    if (edit === "new") openEditor(null);
    else editPost(edit);
  } else if (slug) {
    loadPostBySlug(slug);
  } else if (id) {
    loadPostById(id);
  } else {
    ["viewList","viewPost","viewEditor"].forEach(v => {
      document.getElementById(v).classList.toggle("active", v === "viewList");
    });
    loadPosts();
  }
});

/* ══════════════════════════
   LIST
══════════════════════════ */
async function loadPosts() {
  const grid = document.getElementById("postsGrid");
  grid.innerHTML = `<div class="posts-loading"><div class="spinner"></div></div>`;

  try {
    const q    = query(BLOGS_COL, orderBy("createdAt","desc"));
    const snap = await getDocs(q);
    const all  = snap.docs.map(d => ({id:d.id,...d.data()}));
    const posts = isAdmin ? all : all.filter(p => p.published);

    if (!posts.length) {
      grid.innerHTML = `<div class="posts-empty"><div class="posts-empty-icon">✍️</div><div class="posts-empty-text">${isAdmin?"Henüz yazı yok. İlk yazını ekle!":"Henüz yazı yayınlanmamış."}</div></div>`;
      return;
    }

    grid.innerHTML = "";
    posts.forEach((post, i) => {
      const card = document.createElement("div");
      card.className = "post-card";
      card.style.animationDelay = (i * 60) + "ms";

      const imgHtml = post.coverUrl
        ? `<img class="post-card-img" src="${esc(post.coverUrl)}" alt="${esc(post.title)}" loading="lazy">`
        : `<div class="post-card-img-placeholder">✍️</div>`;

      const date = post.createdAt?.toDate
        ? post.createdAt.toDate().toLocaleDateString("tr-TR",{day:"2-digit",month:"long",year:"numeric"})
        : "—";

      const words = wordCountText(post.content || "");
      const readMin = Math.max(1, Math.round(words / 200));

      const adminBtns = isAdmin ? `
        <div class="post-card-admin" onclick="event.stopPropagation()">
          <button class="btn-icon-sm" title="Düzenle" onclick="editPost('${post.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon-sm danger" title="Sil" onclick="confirmDeletePost('${post.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>` : "";

      const statusBadge = isAdmin && !post.published
        ? `<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:rgba(255,210,80,0.1);border:1px solid rgba(255,210,80,0.2);color:#ffd250;font-family:var(--font-m);">Taslak</span>` : "";

      card.innerHTML = `
        ${imgHtml}
        <div class="post-card-body">
          <div class="post-card-meta">
            ${post.tag ? `<span class="post-card-tag">${esc(post.tag)}</span><span class="post-card-dot"></span>` : ""}
            <span>${date}</span>
            <span class="post-card-dot"></span>
            <span>${readMin} dk okuma</span>
            ${statusBadge}
          </div>
          <div class="post-card-title">${esc(post.title||"Başlıksız")}</div>
          ${post.excerpt ? `<div class="post-card-excerpt">${esc(post.excerpt)}</div>` : ""}
          <div class="post-card-footer">
            <span class="post-card-read">Okumaya başla <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
            ${adminBtns}
          </div>
        </div>
      `;

      card.dataset.postId = post.id;
      card.addEventListener("click", e => {
        // Orta tık veya Ctrl+tık → yeni sekme
        if (e.ctrlKey || e.metaKey || e.button === 1) return;
        e.preventDefault();
        openPost(post);
      });
      // Sağ tık → tarayıcı menüsü için href benzeri davranış
      card.style.cursor = "pointer";
      grid.appendChild(card);
    });

  } catch(e) {
    grid.innerHTML = `<div class="posts-empty"><div class="posts-empty-text">Yazılar yüklenirken hata oluştu.</div></div>`;
    console.error(e);
  }
}

/* ══════════════════════════
   POST VIEW
══════════════════════════ */
async function loadPostById(id) {
  try {
    const snap = await getDoc(doc(db, "blogs", id));
    if (!snap.exists()) { showView("viewList"); loadPosts(); return; }
    openPost({ id: snap.id, ...snap.data() }, false);
  } catch(e) {
    console.error(e); showView("viewList"); loadPosts();
  }
}

async function loadPostBySlug(slug) {
  try {
    const q    = query(BLOGS_COL, where("slug", "==", slug));
    const snap = await getDocs(q);
    if (snap.empty) { showView("viewList"); loadPosts(); return; }
    const d = snap.docs[0];
    openPost({ id: d.id, ...d.data() }, false);
  } catch(e) {
    console.error(e); showView("viewList"); loadPosts();
  }
}

function openPost(post, pushUrl = true) {
  _currentPostId = post.id;

  const heroImg   = document.getElementById("postHeroImg");
  const tagEl     = document.getElementById("postTag");
  const dateEl    = document.getElementById("postDate");
  const rtEl      = document.getElementById("postReadTime");
  const headEl    = document.getElementById("postHeading");
  const bodyEl    = document.getElementById("postBody");
  const adminEl   = document.getElementById("postAdminActions");
  const draftEl   = document.getElementById("postDraftBadge");

  // Sayfa başlığını güncelle
  document.title = (post.title || "Yazı") + " — AlmancaPratik Blog";

  if (post.coverUrl) {
    heroImg.src = post.coverUrl; heroImg.alt = post.title || "";
    heroImg.style.display = "block";
  } else {
    heroImg.style.display = "none";
  }

  if (post.tag) { tagEl.textContent = post.tag; tagEl.style.display = "inline-flex"; }
  else tagEl.style.display = "none";

  draftEl.style.display = (isAdmin && !post.published) ? "inline-flex" : "none";

  const date = post.createdAt?.toDate
    ? post.createdAt.toDate().toLocaleDateString("tr-TR",{day:"2-digit",month:"long",year:"numeric"})
    : "—";
  dateEl.textContent = date;

  const words   = wordCountText(post.content || "");
  const readMin = Math.max(1, Math.round(words / 200));
  rtEl.textContent = readMin + " dk okuma";

  headEl.textContent = post.title || "Başlıksız";
  bodyEl.innerHTML   = post.content || "";

  // Admin butonları
  adminEl.style.display = isAdmin ? "flex" : "none";

  if (pushUrl) {
    showView("viewPost", post.slug ? { slug: post.slug } : { id: post.id });
  } else {
    ["viewList","viewPost","viewEditor"].forEach(v => {
      document.getElementById(v).classList.toggle("active", v === "viewPost");
    });
    window.scrollTo(0, 0);
  }
}

document.getElementById("btnBackFromPost").addEventListener("click", () => {
  document.title = "Blog — AlmancaPratik";
  showView("viewList");
  loadPosts();
});

document.getElementById("btnEditCurrentPost").addEventListener("click", () => {
  if (_currentPostId) editPost(_currentPostId);
});

document.getElementById("btnDeleteCurrentPost").addEventListener("click", () => {
  if (_currentPostId) confirmDeletePost(_currentPostId);
});

/* ══════════════════════════
   EDITOR
══════════════════════════ */
function openEditor(post = null) {
  editingId    = post?.id || null;
  coverFile    = null;
  coverDataUrl = post?.coverUrl || null;

  const titleEl   = document.getElementById("editorTitle");
  const contentEl = document.getElementById("editorContent");
  const tagEl     = document.getElementById("fieldTag");
  const excerptEl = document.getElementById("fieldExcerpt");
  const preview   = document.getElementById("coverPreview");
  const removeBtn = document.getElementById("coverRemoveBtn");
  const statusRow = document.getElementById("postStatusRow");
  const statusTxt = document.getElementById("postStatusText");
  const publishBtn= document.getElementById("btnPublish");

  titleEl.value      = post?.title   || "";
  contentEl.innerHTML= post?.content || "";
  tagEl.value        = post?.tag     || "";
  excerptEl.value    = post?.excerpt || "";

  if (post?.coverUrl) {
    preview.src = post.coverUrl; preview.style.display = "block";
    removeBtn.style.display = "flex";
  } else {
    preview.src = ""; preview.style.display = "none";
    removeBtn.style.display = "none";
  }

  const pub = post?.published || false;
  statusRow.className = `status-row ${pub ? "status-published" : "status-draft"}`;
  statusTxt.textContent = pub ? "Yayında" : "Taslak";
  publishBtn.textContent = pub ? "Yayından Kaldır" : "Yayınla →";

  updateWordCount();
  showView("viewEditor", editingId ? { edit: editingId } : {});
}

/* ── Toolbar ── */
/* Seçimin bulunduğu blok etiketini döndürür */
function getSelectionBlock() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return "";
  let node = sel.getRangeAt(0).commonAncestorContainer;
  if (node.nodeType === 3) node = node.parentElement;
  const block = node.closest("h2,h3,h4,blockquote,p,div");
  return block ? block.tagName : "";
}

document.querySelectorAll(".tb-btn").forEach(btn => {
  btn.addEventListener("mousedown", e => {
    e.preventDefault();
    const cmd = btn.dataset.cmd;
    if (!cmd) return;
    const ed = document.getElementById("editorContent");

    if (cmd === "h2") {
      /* Toggle: zaten h2 ise normal paragrafa döndür */
      const block = getSelectionBlock();
      document.execCommand("formatBlock", false, block === "H2" ? "p" : "h2");
    } else if (cmd === "h3") {
      const block = getSelectionBlock();
      document.execCommand("formatBlock", false, block === "H3" ? "p" : "h3");
    } else if (cmd === "blockquote") {
      /* Toggle: zaten blockquote ise p'ye çevir */
      const block = getSelectionBlock();
      document.execCommand("formatBlock", false, block === "BLOCKQUOTE" ? "p" : "blockquote");
    } else if (cmd === "createLink") {
      const url = prompt("Link URL:");
      if (url) document.execCommand("createLink", false, url);
    } else if (cmd === "highlight") {
      /* Toggle vurgulama: zaten mark içindeyse kaldır, değilse ekle */
      const sel = window.getSelection();
      if (sel && sel.rangeCount && !sel.isCollapsed) {
        const range    = sel.getRangeAt(0);
        const ancestor = range.commonAncestorContainer;
        const markEl   = ancestor.nodeType === 1
          ? ancestor.closest("mark")
          : ancestor.parentElement?.closest("mark");
        if (markEl) {
          /* Zaten mark içinde — mark'ı kaldır, içeriği bırak */
          const parent = markEl.parentNode;
          while (markEl.firstChild) parent.insertBefore(markEl.firstChild, markEl);
          parent.removeChild(markEl);
        } else {
          try {
            const mark = document.createElement("mark");
            range.surroundContents(mark);
          } catch {
            /* Seçim birden fazla elementi kapsıyorsa insertHTML kullan */
            const div = document.createElement("div");
            div.appendChild(range.extractContents());
            div.querySelectorAll("mark").forEach(m => {
              m.replaceWith(...m.childNodes);
            });
            const mark = document.createElement("mark");
            mark.innerHTML = div.innerHTML;
            range.insertNode(mark);
          }
        }
        sel.removeAllRanges();
      }
    } else if (cmd === "insertHR") {
      document.execCommand("insertHTML", false, "<hr>");
    } else if (cmd === "insertTable") {
      const rows = parseInt(prompt("Satır sayısı:", "3")) || 3;
      const cols = parseInt(prompt("Sütun sayısı:", "3")) || 3;
      let html = "<table><thead><tr>";
      for (let c2 = 0; c2 < cols; c2++) html += `<th>Başlık ${c2+1}</th>`;
      html += "</tr></thead><tbody>";
      for (let r = 0; r < rows - 1; r++) {
        html += "<tr>";
        for (let c2 = 0; c2 < cols; c2++) html += "<td>Hücre</td>";
        html += "</tr>";
      }
      html += "</tbody></table><p></p>";
      document.execCommand("insertHTML", false, html);
    } else if (cmd === "insertImage") {
      const url = prompt("Görsel URL'si:");
      if (url) document.execCommand("insertHTML", false, `<img src="${url}" alt="görsel" style="max-width:100%;border-radius:10px;margin:12px 0;">`);
    } else {
      document.execCommand(cmd, false, null);
    }
    ed.focus();
  });
});

/* Yazı boyutu select */
document.getElementById("tbFontSize").addEventListener("change", function() {
  if (!this.value) return;
  document.execCommand("fontSize", false, this.value);
  document.getElementById("editorContent").focus();
  this.value = "";
});

/* Yazı tipi select */
document.getElementById("tbFontFamily").addEventListener("change", function() {
  if (!this.value) return;
  document.execCommand("fontName", false, this.value);
  document.getElementById("editorContent").focus();
  this.value = "";
});

/* Kısayol tuşları */
document.getElementById("editorContent").addEventListener("keydown", e => {
  if (!e.ctrlKey && !e.metaKey) return;
  if (e.key === "z") { e.preventDefault(); document.execCommand("undo"); }
  if (e.key === "y") { e.preventDefault(); document.execCommand("redo"); }
  if (e.key === "k") { e.preventDefault(); const url = prompt("Link URL:"); if (url) document.execCommand("createLink", false, url); }
  if (e.shiftKey && e.key === "X") { e.preventDefault(); document.execCommand("strikeThrough"); }
  if (e.shiftKey && e.key === "H") { e.preventDefault(); document.getElementById("editorContent").dispatchEvent(new MouseEvent("mousedown")); document.querySelector('[data-cmd="highlight"]').dispatchEvent(new MouseEvent("mousedown")); }
  if (e.shiftKey && e.key === "L") { e.preventDefault(); document.execCommand("justifyLeft"); }
  if (e.shiftKey && e.key === "E") { e.preventDefault(); document.execCommand("justifyCenter"); }
  if (e.shiftKey && e.key === "R") { e.preventDefault(); document.execCommand("justifyRight"); }
  if (e.key === "2") { e.preventDefault(); document.execCommand("formatBlock", false, "h2"); }
  if (e.key === "3") { e.preventDefault(); document.execCommand("formatBlock", false, "h3"); }
});

/* ── Word count ── */
function updateWordCount() {
  const text  = document.getElementById("editorContent").innerText || "";
  const count = wordCountText(text);
  document.getElementById("wordCountDisplay").textContent = count + " kelime";
}

document.getElementById("editorContent").addEventListener("input", () => {
  clearTimeout(wordTimer);
  wordTimer = setTimeout(updateWordCount, 300);
});

/* ── Cover upload ── */
const coverArea  = document.getElementById("coverUploadArea");
const coverInput = document.getElementById("coverInput");

coverArea.addEventListener("click", e => {
  if (e.target === document.getElementById("coverRemoveBtn")) return;
  coverInput.click();
});

coverInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { toast("Görsel 8MB'dan küçük olmalı", "err"); return; }
  coverFile = file;
  /* Görseli canvas'ta sıkıştır — max 1200px, JPEG %80 */
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(objectUrl);
    const MAX = 1200;
    let w = img.width, h = img.height;
    if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    coverDataUrl = canvas.toDataURL("image/jpeg", 0.80);
    const preview = document.getElementById("coverPreview");
    const removeBtn = document.getElementById("coverRemoveBtn");
    preview.src = coverDataUrl; preview.style.display = "block";
    removeBtn.style.display = "flex";
  };
  img.src = objectUrl;
});

/* Drag & drop */
coverArea.addEventListener("dragover", e => { e.preventDefault(); coverArea.style.borderColor = "var(--gold)"; });
coverArea.addEventListener("dragleave", () => { coverArea.style.borderColor = ""; });
coverArea.addEventListener("drop", e => {
  e.preventDefault(); coverArea.style.borderColor = "";
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) {
    coverInput.files = e.dataTransfer.files;
    coverInput.dispatchEvent(new Event("change"));
  }
});

document.getElementById("coverRemoveBtn").addEventListener("click", e => {
  e.stopPropagation();
  coverFile = null; coverDataUrl = null;
  const preview = document.getElementById("coverPreview");
  const removeBtn = document.getElementById("coverRemoveBtn");
  preview.src = ""; preview.style.display = "none";
  removeBtn.style.display = "none";
  coverInput.value = "";
});

/* ── Save / Publish ── */
async function savePost(publish) {
  if (!isAdmin) return;
  const title   = document.getElementById("editorTitle").value.trim();
  const content = document.getElementById("editorContent").innerHTML;
  const tag     = document.getElementById("fieldTag").value.trim();
  const excerpt = document.getElementById("fieldExcerpt").value.trim();

  if (!title) { toast("Başlık boş olamaz", "err"); return; }

  const publishBtn = document.getElementById("btnPublish");
  const draftBtn   = document.getElementById("btnSaveDraft");
  publishBtn.disabled = true; draftBtn.disabled = true;

  try {
    /* Görsel base64 olarak Firestore'a kaydedilir — Storage/CORS gerektirmez */
    let coverUrl = coverDataUrl || null;

    const isPublished = (() => {
      if (publish === null) {
        /* Mevcut durumu koru */
        const txt = document.getElementById("postStatusText").textContent;
        return txt === "Yayında";
      }
      return publish;
    })();

    // Slug: yeni yazıda her zaman üret, düzenlemede sadece başlık değiştiyse güncelle
    let slug;
    if (editingId) {
      // Mevcut slug'ı koru, sadece başlık değişmişse güncelle
      const existing = await getDoc(doc(db, "blogs", editingId));
      const existingSlug = existing.data()?.slug;
      const existingTitle = existing.data()?.title;
      if (!existingSlug || existingTitle !== title) {
        slug = await ensureUniqueSlug(toSlug(title), editingId);
      } else {
        slug = existingSlug;
      }
    } else {
      slug = await ensureUniqueSlug(toSlug(title));
    }

    const data = {
      title, content, tag, excerpt, slug,
      published: isPublished,
      updatedAt: serverTimestamp(),
      ...(coverUrl !== null ? { coverUrl } : {}),
    };

    if (editingId) {
      await updateDoc(doc(db, "blogs", editingId), data);
    } else {
      data.createdAt = serverTimestamp();
      const ref2 = await addDoc(BLOGS_COL, data);
      editingId = ref2.id;
    }

    /* Status güncelle */
    const statusRow = document.getElementById("postStatusRow");
    const statusTxt = document.getElementById("postStatusText");
    statusRow.className = `status-row ${isPublished ? "status-published" : "status-draft"}`;
    statusTxt.textContent = isPublished ? "Yayında" : "Taslak";
    publishBtn.textContent = isPublished ? "Yayından Kaldır" : "Yayınla →";

    toast(isPublished ? "Yayınlandı ✓" : "Taslak kaydedildi ✓", "ok");
    document.getElementById("autoSaveStatus").textContent = "Kaydedildi";

    await loadPosts();

  } catch(e) {
    toast("Kayıt hatası: " + e.message, "err");
    console.error(e);
  } finally {
    publishBtn.disabled = false; draftBtn.disabled = false;
  }
}

document.getElementById("btnPublish").addEventListener("click", async () => {
  const txt = document.getElementById("postStatusText").textContent;
  const isCurrentlyPublished = txt === "Yayında";
  await savePost(!isCurrentlyPublished);
});

document.getElementById("btnSaveDraft").addEventListener("click", () => savePost(null));

document.getElementById("btnEditorBack").addEventListener("click", () => {
  document.title = "Blog — AlmancaPratik";
  showView("viewList");
  loadPosts();
});

document.getElementById("btnNewPost").addEventListener("click", () => {
  if (!isAdmin) return;
  openEditor(null);
  showView("viewEditor", {});
});

/* ══════════════════════════
   DELETE
══════════════════════════ */
function confirmDeletePost(id) {
  deleteTargetId = id;
  document.getElementById("confirmOverlay").classList.add("open");
}

document.getElementById("confirmCancel").addEventListener("click", () => {
  document.getElementById("confirmOverlay").classList.remove("open");
  deleteTargetId = null;
});

document.getElementById("confirmDelete").addEventListener("click", async () => {
  if (!deleteTargetId || !isAdmin) return;
  document.getElementById("confirmOverlay").classList.remove("open");
  try {
    await deleteDoc(doc(db, "blogs", deleteTargetId));
    toast("Yazı silindi", "ok");
    document.title = "Blog — AlmancaPratik";
    showView("viewList");
    await loadPosts();
  } catch(e) {
    toast("Silme hatası: " + e.message, "err");
  }
  deleteTargetId = null;
});

/* ══════════════════════════
   EDIT
══════════════════════════ */
async function editPost(id) {
  if (!isAdmin) return;
  try {
    const snap = await getDoc(doc(db, "blogs", id));
    if (!snap.exists()) { toast("Yazı bulunamadı", "err"); return; }
    openEditor({ id: snap.id, ...snap.data() });
  } catch(e) {
    toast("Hata: " + e.message, "err");
  }
}

/* ══════════════════════════
   UTILS
══════════════════════════ */
function toast(msg, type="ok") {
  document.querySelectorAll(".blog-toast").forEach(e=>e.remove());
  const el = document.createElement("div");
  el.className = `blog-toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity="0"; el.style.transition="opacity 0.3s"; setTimeout(()=>el.remove(),300); }, 2500);
}

function esc(s) {
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function wordCountText(t) {
  return (t||"").trim().replace(/<[^>]+>/g,"").split(/\s+/).filter(Boolean).length;
}

/* Türkçe dahil tüm dilleri destekleyen slug üretici */
function toSlug(title) {
  const trMap = {
    'ğ':'g','Ğ':'g','ü':'u','Ü':'u','ş':'s','Ş':'s',
    'ı':'i','İ':'i','ö':'o','Ö':'o','ç':'c','Ç':'c',
    'â':'a','Â':'a','î':'i','Î':'i','û':'u','Û':'u'
  };
  return title
    .split('').map(ch => trMap[ch] || ch).join('')  // Türkçe harfleri dönüştür
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // harf/rakam/boşluk/tire dışını kaldır
    .trim()
    .replace(/\s+/g, '-')            // boşlukları tireye çevir
    .replace(/-+/g, '-')             // tekrar eden tireleri temizle
    .slice(0, 80);                   // max 80 karakter
}

/* Slug'ın Firestore'da benzersiz olup olmadığını kontrol et */
async function ensureUniqueSlug(baseSlug, excludeId = null) {
  const q    = query(BLOGS_COL, where("slug", "==", baseSlug));
  const snap = await getDocs(q);
  const existing = snap.docs.filter(d => d.id !== excludeId);
  if (existing.length === 0) return baseSlug;
  // Çakışma varsa sonuna sayı ekle
  let n = 2;
  while (true) {
    const candidate = baseSlug + "-" + n;
    const q2    = query(BLOGS_COL, where("slug", "==", candidate));
    const snap2 = await getDocs(q2);
    const ex2   = snap2.docs.filter(d => d.id !== excludeId);
    if (ex2.length === 0) return candidate;
    n++;
  }
}

/* Globals for inline onclick */
window.editPost          = editPost;
window.confirmDeletePost = confirmDeletePost;

/* ── Init — URL'e göre başla ── */
(async function init() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("p");
  const id   = params.get("id");
  const edit = params.get("edit");

  await loadPosts();

  if (edit && edit !== "new") {
    await editPost(edit);
  } else if (edit === "new") {
    openEditor(null);
  } else if (slug) {
    await loadPostBySlug(slug);
  } else if (id) {
    await loadPostById(id);
  } else {
    showView("viewList");
  }
})();