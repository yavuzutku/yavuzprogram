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
const app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
const db  = getFirestore(app);
const LESSONS_COL = collection(db, "lessons");

/* ── State ── */
let isAdmin          = false;
let currentUser      = null;
let editingId        = null;
let coverDataUrl     = null;  /* base64 data URL veya https:// URL */
let coverMode        = "file"; /* "file" | "url" */
let deleteTargetId   = null;
let wordTimer        = null;
let activeCatFilter  = "all";
let allLessons       = [];
let _currentLessonId = null;

/* ── Highlight renk paleti ── */
const HIGHLIGHT_COLORS = [
  { hex: "#ffd250", label: "Sarı",   alpha: "rgba(255,210,80,0.38)"  },
  { hex: "#4ade80", label: "Yeşil",  alpha: "rgba(74,222,128,0.32)"  },
  { hex: "#60c8f0", label: "Mavi",   alpha: "rgba(96,200,240,0.35)"  },
  { hex: "#818cf8", label: "Mor",    alpha: "rgba(129,140,248,0.38)" },
  { hex: "#f472b6", label: "Pembe",  alpha: "rgba(244,114,182,0.38)" },
  { hex: "#fb923c", label: "Turuncu",alpha: "rgba(251,146,60,0.38)"  },
  { hex: "#f87171", label: "Kırmızı",alpha: "rgba(248,113,113,0.35)" },
  { hex: "#2dd4bf", label: "Teal",   alpha: "rgba(45,212,191,0.32)"  },
  { hex: "#a78bfa", label: "Lavanta",alpha: "rgba(167,139,250,0.38)" },
  { hex: "#e2e8f0", label: "Beyaz",  alpha: "rgba(226,232,240,0.22)" },
];
let currentHlColor = HIGHLIGHT_COLORS[0]; /* varsayılan: sarı */

/* ── Admin dinle ── */
onAdminChange((adminStatus, user) => {
  isAdmin     = adminStatus;
  currentUser = user;
  document.getElementById("btnNewLesson").style.display = adminStatus ? "flex" : "none";
});

/* ══════════════════════════════════════════════
   VIEW YÖNETİMİ + URL ROUTING
══════════════════════════════════════════════ */
function showView(id, urlParams = {}) {
  ["viewList","viewLesson","viewEditor"].forEach(v => {
    document.getElementById(v).classList.toggle("active", v === id);
  });
  window.scrollTo(0, 0);
  const url = new URL(window.location.href);
  url.search = "";
  if (id === "viewLesson" && urlParams.slug)              url.searchParams.set("ders", urlParams.slug);
  if (id === "viewLesson" && !urlParams.slug && urlParams.id) url.searchParams.set("id", urlParams.id);
  if (id === "viewEditor" && urlParams.edit)              url.searchParams.set("edit", urlParams.edit);
  if (id === "viewEditor" && !urlParams.edit)             url.searchParams.set("edit", "new");
  history.pushState({ view: id, ...urlParams }, "", url.toString());
}

window.addEventListener("popstate", () => {
  const p    = new URLSearchParams(window.location.search);
  const slug = p.get("ders");
  const id   = p.get("id");
  const edit = p.get("edit");
  if (edit === "new")  openEditor(null);
  else if (edit)       editLesson(edit);
  else if (slug)       loadLessonBySlug(slug);
  else if (id)         loadLessonById(id);
  else { showViewOnly("viewList"); loadLessons(); }
});

function showViewOnly(id) {
  ["viewList","viewLesson","viewEditor"].forEach(v => {
    document.getElementById(v).classList.toggle("active", v === id);
  });
  window.scrollTo(0, 0);
}

/* ══════════════════════════════════════════════
   KATEGORİ FİLTRE
══════════════════════════════════════════════ */
function buildCatFilters(lessons) {
  const wrap    = document.getElementById("catFilterWrap");
  const stdCats = ["A1","A2","B1","B2","C1"];
  const allCats = [...new Set(lessons.map(l => l.category).filter(Boolean))];
  const custCats = allCats.filter(c => !stdCats.includes(c));

  wrap.querySelectorAll(".cat-filter-btn[data-custom]").forEach(b => b.remove());

  custCats.forEach(cat => {
    const btn = document.createElement("button");
    btn.className      = "cat-filter-btn" + (activeCatFilter === cat ? " active" : "");
    btn.dataset.cat    = cat;
    btn.dataset.custom = "1";
    btn.textContent    = cat;
    btn.addEventListener("click", () => setCatFilter(cat));
    wrap.appendChild(btn);
  });

  wrap.querySelectorAll(".cat-filter-btn").forEach(btn => {
    btn.onclick = () => setCatFilter(btn.dataset.cat);
    btn.classList.toggle("active", btn.dataset.cat === activeCatFilter);
  });
}

function setCatFilter(cat) {
  activeCatFilter = cat;
  document.querySelectorAll(".cat-filter-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.cat === cat)
  );
  renderLessons(filterLessons(allLessons));
}

function filterLessons(lessons) {
  if (activeCatFilter === "all") return lessons;
  return lessons.filter(l => l.category === activeCatFilter);
}

/* ══════════════════════════════════════════════
   LIST
══════════════════════════════════════════════ */
async function loadLessons() {
  const grid = document.getElementById("lessonsGrid");
  grid.innerHTML = `<div class="grid-loading"><div class="spinner"></div></div>`;
  try {
    const snap = await getDocs(query(LESSONS_COL, orderBy("createdAt","desc")));
    allLessons  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const visible = isAdmin ? allLessons : allLessons.filter(l => l.published);
    buildCatFilters(visible);
    renderLessons(filterLessons(visible));
  } catch(e) {
    document.getElementById("lessonsGrid").innerHTML =
      `<div class="grid-empty"><div class="grid-empty-text">Dersler yüklenirken hata oluştu.</div></div>`;
    console.error(e);
  }
}

function renderLessons(list) {
  const grid = document.getElementById("lessonsGrid");
  if (!list.length) {
    grid.innerHTML = `<div class="grid-empty">
      <div class="grid-empty-icon">📚</div>
      <div class="grid-empty-text">${isAdmin ? "Henüz ders yok. İlk dersi ekle!" : "Bu kategoride henüz ders yayınlanmamış."}</div>
    </div>`;
    return;
  }
  grid.innerHTML = "";
  list.forEach((lesson, i) => {
    const card = document.createElement("a");
    card.className = "lesson-card";
    card.style.animationDelay = (i * 50) + "ms";
    card.href = `/dersler/?ders=${encodeURIComponent(lesson.slug || lesson.id)}`;

    const cat     = lesson.category || "";
    const date    = lesson.createdAt?.toDate
      ? lesson.createdAt.toDate().toLocaleDateString("tr-TR",{day:"2-digit",month:"long",year:"numeric"})
      : "—";
    const wc      = wordCountText(lesson.content || "");
    const readMin = Math.max(1, Math.round(wc / 200));

    const coverHtml = lesson.coverUrl
      ? `<img class="lesson-card-cover" src="${esc(lesson.coverUrl)}" alt="${esc(lesson.title)}" loading="lazy">`
      : `<div class="lesson-card-cover-placeholder">📖</div>`;

    const adminBtns = isAdmin ? `
      <div class="lesson-card-admin" onclick="event.stopPropagation();event.preventDefault()">
        <button class="btn-icon-sm" title="Düzenle" onclick="editLesson('${lesson.id}');event.preventDefault()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon-sm danger" title="Sil" onclick="confirmDeleteLesson('${lesson.id}');event.preventDefault()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>` : "";

    const draftBadge = isAdmin && !lesson.published
      ? `<span class="draft-badge">Taslak</span>` : "";

    card.innerHTML = `
      ${coverHtml}
      <div class="lesson-card-body">
        <div class="lesson-card-meta">
          ${cat ? `<span class="lesson-cat-badge" data-cat="${esc(cat)}">${esc(cat)}</span><span class="lesson-card-dot"></span>` : ""}
          <span>${date}</span>
          <span class="lesson-card-dot"></span>
          <span>${readMin} dk</span>
          ${draftBadge}
        </div>
        <div class="lesson-card-title">${esc(lesson.title || "Başlıksız")}</div>
        ${lesson.excerpt ? `<div class="lesson-card-excerpt">${esc(lesson.excerpt)}</div>` : ""}
        <div class="lesson-card-footer">
          <span class="lesson-card-read">Derse başla <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
          ${adminBtns}
        </div>
      </div>`;

    card.addEventListener("click", e => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      openLesson(lesson);
    });

    grid.appendChild(card);
  });
}

/* ══════════════════════════════════════════════
   DERS OKUMA
══════════════════════════════════════════════ */
async function loadLessonById(id) {
  try {
    const snap = await getDoc(doc(db, "lessons", id));
    if (!snap.exists()) { showViewOnly("viewList"); loadLessons(); return; }
    openLesson({ id: snap.id, ...snap.data() }, false);
  } catch(e) { console.error(e); showViewOnly("viewList"); loadLessons(); }
}

async function loadLessonBySlug(slug) {
  try {
    const snap = await getDocs(query(LESSONS_COL, where("slug","==",slug)));
    if (snap.empty) { showViewOnly("viewList"); loadLessons(); return; }
    const d = snap.docs[0];
    openLesson({ id: d.id, ...d.data() }, false);
  } catch(e) { console.error(e); showViewOnly("viewList"); loadLessons(); }
}

function openLesson(lesson, pushUrl = true) {
  _currentLessonId = lesson.id;
  document.title   = (lesson.title || "Ders") + " — AlmancaPratik";

  const heroImg = document.getElementById("lessonHeroImg");
  if (lesson.coverUrl) { heroImg.src = lesson.coverUrl; heroImg.style.display = "block"; }
  else heroImg.style.display = "none";

  const catBadge = document.getElementById("lessonCatBadge");
  if (lesson.category) {
    catBadge.textContent   = lesson.category;
    catBadge.dataset.cat   = lesson.category;
    catBadge.className     = "lesson-cat-badge";
    catBadge.style.display = "inline-flex";
  } else { catBadge.style.display = "none"; }

  document.getElementById("lessonDraftBadge").style.display =
    (isAdmin && !lesson.published) ? "inline-flex" : "none";

  const date = lesson.createdAt?.toDate
    ? lesson.createdAt.toDate().toLocaleDateString("tr-TR",{day:"2-digit",month:"long",year:"numeric"})
    : "—";
  document.getElementById("lessonDate").textContent     = date;
  const wc = wordCountText(lesson.content || "");
  document.getElementById("lessonReadTime").textContent = Math.max(1, Math.round(wc / 200)) + " dk okuma";
  document.getElementById("lessonHeading").textContent  = lesson.title || "Başlıksız";
  document.getElementById("lessonBody").innerHTML        = lesson.content || "";
  document.getElementById("lessonAdminActions").style.display = isAdmin ? "flex" : "none";

  if (pushUrl) {
    showView("viewLesson", lesson.slug ? { slug: lesson.slug } : { id: lesson.id });
  } else { showViewOnly("viewLesson"); }
}

document.getElementById("btnBackFromLesson").addEventListener("click", () => {
  document.title = "Dersler — AlmancaPratik";
  showView("viewList");
  loadLessons();
});
document.getElementById("btnEditCurrentLesson").addEventListener("click", () => {
  if (_currentLessonId) editLesson(_currentLessonId);
});
document.getElementById("btnDeleteCurrentLesson").addEventListener("click", () => {
  if (_currentLessonId) confirmDeleteLesson(_currentLessonId);
});

/* ══════════════════════════════════════════════
   EDİTÖR
══════════════════════════════════════════════ */
function openEditor(lesson = null) {
  editingId    = lesson?.id      || null;
  coverDataUrl = lesson?.coverUrl || null;
  coverMode    = "file";

  document.getElementById("editorTitle").value       = lesson?.title   || "";
  document.getElementById("editorContent").innerHTML = lesson?.content || "";
  document.getElementById("fieldExcerpt").value      = lesson?.excerpt || "";

  /* Kategori */
  const catSel  = document.getElementById("fieldCategory");
  const stdCats = ["A1","A2","B1","B2","C1",""];
  if (lesson?.category && !stdCats.includes(lesson.category)) {
    catSel.value = "__custom__";
    document.getElementById("fieldCustomCategory").value = lesson.category;
    document.getElementById("customCatWrap").style.display = "block";
  } else {
    catSel.value = lesson?.category || "";
    document.getElementById("fieldCustomCategory").value = "";
    document.getElementById("customCatWrap").style.display = "none";
  }

  /* Kapak: dosya moduna sıfırla */
  setCoverTab("file");
  const preview   = document.getElementById("coverPreview");
  const removeBtn = document.getElementById("coverRemoveBtn");
  if (lesson?.coverUrl) {
    preview.src = lesson.coverUrl; preview.style.display = "block"; removeBtn.style.display = "flex";
  } else { preview.src = ""; preview.style.display = "none"; removeBtn.style.display = "none"; }

  /* URL alanını temizle */
  document.getElementById("coverUrlInput").value = "";
  document.getElementById("coverUrlPreview").classList.remove("visible");
  document.getElementById("coverUrlPreview").src = "";
  document.getElementById("coverUrlClear").classList.remove("visible");

  /* Status */
  const pub = lesson?.published || false;
  document.getElementById("lessonStatusRow").className     = `status-row ${pub ? "status-published" : "status-draft"}`;
  document.getElementById("lessonStatusText").textContent  = pub ? "Yayında" : "Taslak";
  document.getElementById("btnPublish").textContent        = pub ? "Yayından Kaldır" : "Yayınla →";

  updateWordCount();
  showView("viewEditor", editingId ? { edit: editingId } : {});
}

/* ── Kapak sekme değiştirme ─────────────────── */
function setCoverTab(mode) {
  coverMode = mode;
  document.getElementById("coverTabFile").classList.toggle("active", mode === "file");
  document.getElementById("coverTabUrl").classList.toggle("active",  mode === "url");
  document.getElementById("coverUploadArea").classList.toggle("hidden", mode === "url");
  document.getElementById("coverUrlArea").classList.toggle("active", mode === "url");
}

document.getElementById("coverTabFile").addEventListener("click", () => setCoverTab("file"));
document.getElementById("coverTabUrl").addEventListener("click",  () => setCoverTab("url"));

/* ── URL ile kapak ─────────────────────────── */
function applyUrlCover(url) {
  if (!url) return;
  coverDataUrl = url;
  const prev = document.getElementById("coverUrlPreview");
  const clr  = document.getElementById("coverUrlClear");
  prev.src = url;
  prev.classList.add("visible");
  clr.classList.add("visible");
  toast("Kapak URL'i uygulandı", "ok");
}

document.getElementById("coverUrlApply").addEventListener("click", () => {
  const url = document.getElementById("coverUrlInput").value.trim();
  if (!url) return;
  applyUrlCover(url);
});
document.getElementById("coverUrlInput").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const url = e.target.value.trim();
    if (url) applyUrlCover(url);
  }
});
document.getElementById("coverUrlClear").addEventListener("click", () => {
  coverDataUrl = null;
  document.getElementById("coverUrlInput").value = "";
  document.getElementById("coverUrlPreview").classList.remove("visible");
  document.getElementById("coverUrlPreview").src = "";
  document.getElementById("coverUrlClear").classList.remove("visible");
});

/* Özel kategori toggle */
document.getElementById("fieldCategory").addEventListener("change", function() {
  document.getElementById("customCatWrap").style.display = this.value === "__custom__" ? "block" : "none";
});

/* ══════════════════════════════════════════════
   HIGHLIGHT RENK PALETİ
══════════════════════════════════════════════ */
function buildHighlightPalette() {
  const wrap    = document.getElementById("tbHighlightWrap");
  const btn     = document.getElementById("tbHighlightBtn");
  const palette = document.getElementById("tbColorPalette");

  /* Swatches oluştur */
  HIGHLIGHT_COLORS.forEach((c, i) => {
    const sw = document.createElement("button");
    sw.className             = "tb-color-swatch" + (i === 0 ? " active" : "");
    sw.style.background      = c.hex;
    sw.title                 = c.label;
    sw.dataset.color         = c.alpha;
    sw.dataset.hex           = c.hex;
    sw.addEventListener("mousedown", e => {
      e.preventDefault();
      /* Aktif swatch işaretle */
      palette.querySelectorAll(".tb-color-swatch").forEach(s => s.classList.remove("active"));
      sw.classList.add("active");
      /* Rengi güncelle */
      currentHlColor = c;
      btn.style.setProperty("--hl-current", c.hex);
      /* Vurguyu uygula */
      applyHighlight(c.alpha);
      closePalette();
    });
    palette.appendChild(sw);
  });

  /* Sil butonu (vurguyu kaldır) */
  const clrSw = document.createElement("button");
  clrSw.className = "tb-color-swatch tb-color-swatch--clear";
  clrSw.title = "Vurguyu Kaldır";
  clrSw.innerHTML = "✕";
  clrSw.addEventListener("mousedown", e => {
    e.preventDefault();
    removeHighlight();
    closePalette();
  });
  palette.appendChild(clrSw);

  /* Palette aç/kapat */
  btn.addEventListener("click", e => {
    e.stopPropagation();
    const isOpen = palette.classList.contains("open");
    if (isOpen) { closePalette(); return; }

    /* Seçim varsa direkt uygula, yoksa paleti aç */
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      applyHighlight(currentHlColor.alpha);
    } else {
      palette.classList.add("open");
    }
  });

  document.addEventListener("click", e => {
    if (!wrap.contains(e.target)) closePalette();
  });
}

function closePalette() {
  document.getElementById("tbColorPalette").classList.remove("open");
}

function applyHighlight(bgColor) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return;

  const range = sel.getRangeAt(0);

  /* Zaten mark içindeyse güncelle */
  const ancestor = range.commonAncestorContainer;
  const existingMark = (ancestor.nodeType === 3 ? ancestor.parentElement : ancestor).closest("mark");
  if (existingMark) {
    existingMark.style.background = bgColor;
    sel.removeAllRanges();
    return;
  }

  /* Yeni mark ekle */
  try {
    const m = document.createElement("mark");
    m.style.background = bgColor;
    range.surroundContents(m);
  } catch {
    const d = document.createElement("div");
    d.appendChild(range.extractContents());
    d.querySelectorAll("mark").forEach(m => m.replaceWith(...m.childNodes));
    const m = document.createElement("mark");
    m.style.background = bgColor;
    m.innerHTML = d.innerHTML;
    range.insertNode(m);
  }
  sel.removeAllRanges();
  document.getElementById("editorContent").focus();
}

function removeHighlight() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const ancestor = range.commonAncestorContainer;
  const markEl = (ancestor.nodeType === 3 ? ancestor.parentElement : ancestor).closest("mark");
  if (markEl) {
    const p = markEl.parentNode;
    while (markEl.firstChild) p.insertBefore(markEl.firstChild, markEl);
    p.removeChild(markEl);
  }
  sel.removeAllRanges();
}

/* ── Toolbar ── */
function getSelectionBlock() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return "";
  let node = sel.getRangeAt(0).commonAncestorContainer;
  if (node.nodeType === 3) node = node.parentElement;
  const block = node.closest("h2,h3,h4,blockquote,p,div");
  return block ? block.tagName : "";
}

document.querySelectorAll(".tb-btn[data-cmd]").forEach(btn => {
  btn.addEventListener("mousedown", e => {
    e.preventDefault();
    const cmd = btn.dataset.cmd;
    if (!cmd) return;
    if      (cmd === "h2")        { const b = getSelectionBlock(); document.execCommand("formatBlock", false, b === "H2" ? "p" : "h2"); }
    else if (cmd === "h3")        { const b = getSelectionBlock(); document.execCommand("formatBlock", false, b === "H3" ? "p" : "h3"); }
    else if (cmd === "blockquote"){ const b = getSelectionBlock(); document.execCommand("formatBlock", false, b === "BLOCKQUOTE" ? "p" : "blockquote"); }
    else if (cmd === "createLink"){ const u = prompt("Link URL:"); if (u) document.execCommand("createLink", false, u); }
    else if (cmd === "insertHR")  { document.execCommand("insertHTML", false, "<hr>"); }
    else if (cmd === "insertTable") {
      const rows = parseInt(prompt("Satır sayısı:","3")) || 3;
      const cols = parseInt(prompt("Sütun sayısı:","3")) || 3;
      let html = "<table><thead><tr>";
      for (let c = 0; c < cols; c++) html += `<th>Başlık ${c+1}</th>`;
      html += "</tr></thead><tbody>";
      for (let r = 0; r < rows - 1; r++) {
        html += "<tr>";
        for (let c = 0; c < cols; c++) html += "<td>Hücre</td>";
        html += "</tr>";
      }
      html += "</tbody></table><p></p>";
      document.execCommand("insertHTML", false, html);
    }
    else { document.execCommand(cmd, false, null); }
    document.getElementById("editorContent").focus();
  });
});

document.getElementById("tbFontSize").addEventListener("change", function() {
  if (!this.value) return;
  document.execCommand("fontSize", false, this.value);
  document.getElementById("editorContent").focus(); this.value = "";
});
document.getElementById("tbFontFamily").addEventListener("change", function() {
  if (!this.value) return;
  document.execCommand("fontName", false, this.value);
  document.getElementById("editorContent").focus(); this.value = "";
});
document.getElementById("editorContent").addEventListener("keydown", e => {
  if (!e.ctrlKey && !e.metaKey) return;
  if (e.key === "z") { e.preventDefault(); document.execCommand("undo"); }
  if (e.key === "y") { e.preventDefault(); document.execCommand("redo"); }
  if (e.key === "k") { e.preventDefault(); const u = prompt("Link URL:"); if (u) document.execCommand("createLink", false, u); }
});

function updateWordCount() {
  const text = document.getElementById("editorContent").innerText || "";
  document.getElementById("wordCountDisplay").textContent = wordCountText(text) + " kelime";
}
document.getElementById("editorContent").addEventListener("input", () => {
  clearTimeout(wordTimer); wordTimer = setTimeout(updateWordCount, 300);
});

/* ══════════════════════════════════════════════
   KAPAK DOSYA YÜKLEMESİ (letterbox canvas)
══════════════════════════════════════════════ */
const coverArea  = document.getElementById("coverUploadArea");
const coverInput = document.getElementById("coverInput");

coverArea.addEventListener("click", e => {
  if (e.target !== document.getElementById("coverRemoveBtn")) coverInput.click();
});
coverArea.addEventListener("dragover",  e => { e.preventDefault(); coverArea.style.borderColor = "var(--gold)"; });
coverArea.addEventListener("dragleave", () => { coverArea.style.borderColor = ""; });
coverArea.addEventListener("drop", e => {
  e.preventDefault(); coverArea.style.borderColor = "";
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith("image/")) { coverInput.files = e.dataTransfer.files; coverInput.dispatchEvent(new Event("change")); }
});

coverInput.addEventListener("change", e => {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 8 * 1024 * 1024) { toast("Görsel 8MB'dan küçük olmalı", "err"); return; }

  const objectUrl = URL.createObjectURL(file);
  const img       = new Image();

  img.onload = () => {
    URL.revokeObjectURL(objectUrl);

    /* ── Letterbox: orijinal oran korunur, 16:9 kanvasa sığdırılır ── */
    const TARGET_W = 1200;
    const TARGET_H = 675; /* 16:9 */

    const scale  = Math.min(TARGET_W / img.width, TARGET_H / img.height);
    const drawW  = Math.round(img.width  * scale);
    const drawH  = Math.round(img.height * scale);
    const offsetX = Math.round((TARGET_W - drawW) / 2);
    const offsetY = Math.round((TARGET_H - drawH) / 2);

    const canvas = document.createElement("canvas");
    canvas.width  = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext("2d");

    /* Arka plan: site temasıyla uyumlu koyu renk */
    ctx.fillStyle = "#0d0e14";
    ctx.fillRect(0, 0, TARGET_W, TARGET_H);

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

    coverDataUrl = canvas.toDataURL("image/jpeg", 0.82);
    document.getElementById("coverPreview").src          = coverDataUrl;
    document.getElementById("coverPreview").style.display = "block";
    document.getElementById("coverRemoveBtn").style.display = "flex";
  };

  img.src = objectUrl;
});

document.getElementById("coverRemoveBtn").addEventListener("click", e => {
  e.stopPropagation(); coverDataUrl = null;
  document.getElementById("coverPreview").src = "";
  document.getElementById("coverPreview").style.display = "none";
  document.getElementById("coverRemoveBtn").style.display = "none";
  coverInput.value = "";
});

/* ══════════════════════════════════════════════
   KAYDET / YAYINLA
══════════════════════════════════════════════ */
async function saveLesson(publish) {
  if (!isAdmin) return;
  const title   = document.getElementById("editorTitle").value.trim();
  const content = document.getElementById("editorContent").innerHTML;
  const excerpt = document.getElementById("fieldExcerpt").value.trim();
  const catSel  = document.getElementById("fieldCategory").value;
  const category = catSel === "__custom__"
    ? document.getElementById("fieldCustomCategory").value.trim()
    : catSel;

  if (!title) { toast("Başlık boş olamaz", "err"); return; }

  const publishBtn = document.getElementById("btnPublish");
  const draftBtn   = document.getElementById("btnSaveDraft");
  publishBtn.disabled = true; draftBtn.disabled = true;

  try {
    const isPublished = publish === null
      ? document.getElementById("lessonStatusText").textContent === "Yayında"
      : publish;

    let slug;
    if (editingId) {
      const existing = await getDoc(doc(db, "lessons", editingId));
      const eSlug = existing.data()?.slug, eTitle = existing.data()?.title;
      slug = (!eSlug || eTitle !== title) ? await ensureUniqueSlug(toSlug(title), editingId) : eSlug;
    } else {
      slug = await ensureUniqueSlug(toSlug(title));
    }

    const data = {
      title, content, category, excerpt, slug,
      published: isPublished,
      updatedAt: serverTimestamp(),
      ...(coverDataUrl !== null ? { coverUrl: coverDataUrl } : {}),
    };

    if (editingId) {
      await updateDoc(doc(db, "lessons", editingId), data);
    } else {
      data.createdAt = serverTimestamp();
      const ref = await addDoc(LESSONS_COL, data);
      editingId = ref.id;
    }

    document.getElementById("lessonStatusRow").className    = `status-row ${isPublished ? "status-published" : "status-draft"}`;
    document.getElementById("lessonStatusText").textContent = isPublished ? "Yayında" : "Taslak";
    document.getElementById("btnPublish").textContent       = isPublished ? "Yayından Kaldır" : "Yayınla →";
    document.getElementById("autoSaveStatus").textContent   = "Kaydedildi";
    toast(isPublished ? "Yayınlandı ✓" : "Taslak kaydedildi ✓", "ok");
    await loadLessons();

  } catch(e) { toast("Kayıt hatası: " + e.message, "err"); console.error(e); }
  finally { publishBtn.disabled = false; draftBtn.disabled = false; }
}

document.getElementById("btnPublish").addEventListener("click", async () => {
  const cur = document.getElementById("lessonStatusText").textContent === "Yayında";
  await saveLesson(!cur);
});
document.getElementById("btnSaveDraft").addEventListener("click", () => saveLesson(null));
document.getElementById("btnEditorBack").addEventListener("click", () => {
  document.title = "Dersler — AlmancaPratik"; showView("viewList"); loadLessons();
});
document.getElementById("btnNewLesson").addEventListener("click", () => {
  if (!isAdmin) return; openEditor(null);
});

/* ══════════════════════════════════════════════
   SİLME
══════════════════════════════════════════════ */
function confirmDeleteLesson(id) {
  deleteTargetId = id;
  document.getElementById("confirmOverlay").classList.add("open");
}
document.getElementById("confirmCancel").addEventListener("click", () => {
  document.getElementById("confirmOverlay").classList.remove("open"); deleteTargetId = null;
});
document.getElementById("confirmDelete").addEventListener("click", async () => {
  if (!deleteTargetId || !isAdmin) return;
  document.getElementById("confirmOverlay").classList.remove("open");
  try {
    await deleteDoc(doc(db, "lessons", deleteTargetId));
    toast("Ders silindi", "ok");
    document.title = "Dersler — AlmancaPratik";
    showView("viewList"); await loadLessons();
  } catch(e) { toast("Silme hatası: " + e.message, "err"); }
  deleteTargetId = null;
});

/* ══════════════════════════════════════════════
   DÜZENLEME
══════════════════════════════════════════════ */
async function editLesson(id) {
  if (!isAdmin) return;
  try {
    const snap = await getDoc(doc(db, "lessons", id));
    if (!snap.exists()) { toast("Ders bulunamadı", "err"); return; }
    openEditor({ id: snap.id, ...snap.data() });
  } catch(e) { toast("Hata: " + e.message, "err"); }
}

/* ══════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════ */
function toast(msg, type = "ok") {
  document.querySelectorAll(".d-toast").forEach(e => e.remove());
  const el = document.createElement("div");
  el.className = `d-toast ${type}`; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0"; el.style.transition = "opacity 0.3s";
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function wordCountText(t) {
  return (t || "").trim().replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length;
}

function toSlug(title) {
  const map = {
    'ğ':'g','Ğ':'g','ü':'u','Ü':'u','ş':'s','Ş':'s',
    'ı':'i','İ':'i','ö':'o','Ö':'o','ç':'c','Ç':'c'
  };
  return title.split("").map(c => map[c] || c).join("").toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim()
    .replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

async function ensureUniqueSlug(base, excludeId = null) {
  const snap = await getDocs(query(LESSONS_COL, where("slug","==",base)));
  if (!snap.docs.filter(d => d.id !== excludeId).length) return base;
  let n = 2;
  while (true) {
    const c = base + "-" + n;
    const s = await getDocs(query(LESSONS_COL, where("slug","==",c)));
    if (!s.docs.filter(d => d.id !== excludeId).length) return c;
    n++;
  }
}

/* ── Globals (inline onclick için) ── */
window.editLesson          = editLesson;
window.confirmDeleteLesson = confirmDeleteLesson;

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
(async function init() {
  /* Highlight paletini kur */
  buildHighlightPalette();

  const p    = new URLSearchParams(window.location.search);
  const slug = p.get("ders");
  const id   = p.get("id");
  const edit = p.get("edit");
  const cat  = p.get("cat");

  await loadLessons();

  if (edit === "new")  openEditor(null);
  else if (edit)       await editLesson(edit);
  else if (slug)       await loadLessonBySlug(slug);
  else if (id)         await loadLessonById(id);
  else {
    showViewOnly("viewList");
    if (cat) setCatFilter(cat);
  }
})();