// notlar.js — AlmancaPratik Notlarım modülü
import { auth, db, onAuthChange } from "../js/firebase.js";
import {
  collection, addDoc, getDocs, deleteDoc, updateDoc,
  doc, query, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
let currentUser  = null;
let notes        = [];           // tüm notlar
let filteredNotes = [];
let activeNoteId = null;
let activeFilter = "all";        // all | pinned | archived
let activeTagFilter = null;
let sortBy       = "updated";
let searchQuery  = "";
let saveTimer    = null;
let unsubscribe  = null;         // Firestore listener
let savedRange   = null;         // saved selection for toolbar

const NOTE_COLORS = {
  "default": null,
  "#c9a84c": "#c9a84c",
  "#60c8f0": "#60c8f0",
  "#4fd69c": "#4fd69c",
  "#f07068": "#f07068",
  "#a064ff": "#a064ff",
  "#f97316": "#f97316",
  "#ec4899": "#ec4899",
};

/* ══════════════════════════════════════════════
   DOM REFERENCES
══════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const DOM = {
  app:            $("notesApp"),
  sidebar:        $("sidebar"),
  sidebarToggle:  $("sidebarToggle"),
  noteList:       $("noteList"),
  noteListLoading:$("noteListLoading"),
  emptyState:     $("emptyState"),
  editorPanel:    $("editorPanel"),
  searchInput:    $("searchInput"),
  searchClear:    $("searchClear"),
  sortSelect:     $("sortSelect"),
  tagFilterBar:   $("tagFilterBar"),
  sidebarStats:   $("sidebarStats"),
  // editor
  noteTitleInput: $("noteTitleInput"),
  noteContent:    $("noteContent"),
  noteColorBtn:   $("noteColorBtn"),
  colorDot:       $("colorDot"),
  colorPickerDropdown: $("colorPickerDropdown"),
  tagsList:       $("tagsList"),
  btnAddTag:      $("btnAddTag"),
  tagInput:       $("tagInput"),
  btnPin:         $("btnPin"),
  btnArchive:     $("btnArchive"),
  btnDelete:      $("btnDelete"),
  wordCount:      $("wordCount"),
  charCount:      $("charCount"),
  saveStatus:     $("saveStatus"),
  saveLabel:      $("saveStatus")?.querySelector(".save-label"),
  noteDate:       $("noteDate"),
  // modals
  deleteModal:    $("deleteModal"),
  btnDeleteCancel:$("btnDeleteCancel"),
  btnDeleteConfirm:$("btnDeleteConfirm"),
  linkModal:      $("linkModal"),
  linkInput:      $("linkInput"),
  btnLinkCancel:  $("btnLinkCancel"),
  btnLinkConfirm: $("btnLinkConfirm"),
  toastContainer: $("toastContainer"),
  authGate:       $("authGate"),
  btnNewNote:     $("btnNewNote"),
  btnCreateFirst: $("btnCreateFirst"),
  btnExport:      $("btnExport"),
  btnCopy:        $("btnCopy"),
  btnInsertCode:  $("btnInsertCode"),
  btnInsertLink:  $("btnInsertLink"),
  btnInsertHr:    $("btnInsertHr"),
  btnCheckList:   $("btnCheckList"),
  btnClearFormat: $("btnClearFormat"),
};

/* ══════════════════════════════════════════════
   FIREBASE — NOTES CRUD
══════════════════════════════════════════════ */
function notesRef(uid) {
  return collection(db, "users", uid, "notes");
}

async function createNote(uid) {
  const now = Date.now();
  const data = {
    title:    "",
    content:  "",
    tags:     [],
    color:    null,
    pinned:   false,
    archived: false,
    created:  now,
    updated:  now,
  };
  const ref = await addDoc(notesRef(uid), data);
  return { id: ref.id, ...data };
}

async function updateNote(uid, id, patch) {
  patch.updated = Date.now();
  await updateDoc(doc(db, "users", uid, "notes", id), patch);
}

async function deleteNote(uid, id) {
  await deleteDoc(doc(db, "users", uid, "notes", id));
}

function listenNotes(uid, callback) {
  const q = query(notesRef(uid), orderBy("updated", "desc"));
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(list);
  }, err => {
    console.error("[listenNotes]", err);
    showToast("Notlar yüklenemedi.", "error");
  });
}

/* ══════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════ */
onAuthChange(user => {
  currentUser = user;
  if (!user) {
    DOM.authGate.classList.remove("hidden");
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    return;
  }
  DOM.authGate.classList.add("hidden");
  startListening(user.uid);
});

function startListening(uid) {
  if (unsubscribe) unsubscribe();
  unsubscribe = listenNotes(uid, list => {
    notes = list;
    DOM.noteListLoading.style.display = "none";
    applyFiltersAndRender();
    renderTagFilterBar();
    updateStats();
    // Eğer aktif not hâlâ varsa içeriği senkronize et (başka sekme güncellemesi)
    if (activeNoteId) {
      const note = notes.find(n => n.id === activeNoteId);
      if (!note) {
        // Silindi
        activeNoteId = null;
        showEditorPanel(false);
      }
    }
  });
}

/* ══════════════════════════════════════════════
   FILTERING & SORTING
══════════════════════════════════════════════ */
function applyFiltersAndRender() {
  let list = [...notes];

  // Filtre
  if (activeFilter === "pinned")   list = list.filter(n => n.pinned && !n.archived);
  else if (activeFilter === "archived") list = list.filter(n => n.archived);
  else                             list = list.filter(n => !n.archived);

  // Tag filtresi
  if (activeTagFilter) {
    list = list.filter(n => n.tags && n.tags.includes(activeTagFilter));
  }

  // Arama
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(n =>
      (n.title || "").toLowerCase().includes(q) ||
      textFromHTML(n.content || "").toLowerCase().includes(q) ||
      (n.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  // Sıralama
  list.sort((a, b) => {
    if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
    if (sortBy === "created") return (b.created || 0) - (a.created || 0);
    return (b.updated || 0) - (a.updated || 0);
  });

  // Sabitli notları üste al (arşiv filtresi dışında)
  if (activeFilter !== "archived") {
    list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }

  filteredNotes = list;
  renderNoteList();
}

function renderNoteList() {
  const container = DOM.noteList;

  // Loading node'u gizli tut
  DOM.noteListLoading.style.display = "none";

  // Mevcut kartları temizle
  [...container.children].forEach(el => {
    if (el !== DOM.noteListLoading) el.remove();
  });

  if (filteredNotes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "note-list__empty";
    empty.innerHTML = `
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span>${searchQuery ? "Arama sonucu bulunamadı." : "Henüz not yok."}</span>
    `;
    container.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  filteredNotes.forEach(note => {
    frag.appendChild(createNoteCard(note));
  });
  container.appendChild(frag);
}

function createNoteCard(note) {
  const card = document.createElement("div");
  card.className = "note-card" + (note.id === activeNoteId ? " active" : "");
  card.dataset.id = note.id;

  const preview = textFromHTML(note.content || "").slice(0, 120);
  const date    = formatRelDate(note.updated || note.created);

  const tagsHtml = (note.tags || []).slice(0, 3).map(t =>
    `<span class="mini-tag">${esc(t)}</span>`
  ).join("");

  const colorStrip = note.color
    ? `<div class="note-card__color-strip" style="background:${note.color}"></div>`
    : `<div class="note-card__color-strip" style="background:rgba(255,255,255,0.08)"></div>`;

  card.innerHTML = `
    <div class="note-card__top">
      ${colorStrip}
      <div class="note-card__meta">
        <div class="note-card__title ${!note.title ? "untitled" : ""}">${note.title ? esc(note.title) : "Başlıksız not"}</div>
        ${preview ? `<div class="note-card__preview">${esc(preview)}</div>` : ""}
      </div>
    </div>
    <div class="note-card__footer">
      <span class="note-card__date">${date}</span>
      <div class="note-card__badges">
        ${note.pinned ? `<span class="badge-pin"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="color:#c9a84c"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg></span>` : ""}
        ${note.archived ? `<span class="badge-archive" title="Arşivlenmiş"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.4"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg></span>` : ""}
        <div class="note-card__tags">${tagsHtml}</div>
      </div>
    </div>
  `;

  card.addEventListener("click", () => openNote(note.id));
  return card;
}

/* ══════════════════════════════════════════════
   EDITOR
══════════════════════════════════════════════ */
function openNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;

  activeNoteId = id;

  // Update active card
  $$(".note-card").forEach(el => el.classList.toggle("active", el.dataset.id === id));

  // Populate editor
  DOM.noteTitleInput.value = note.title || "";
  DOM.noteContent.innerHTML = note.content || "";
  setColorDot(note.color);
  renderTagPills(note.tags || []);
  updatePinBtn(note.pinned);
  updateArchiveBtn(note.archived);
  updateFooter(note);

  showEditorPanel(true);

  // Focus content if title empty
  if (!note.title) {
    setTimeout(() => DOM.noteTitleInput.focus(), 50);
  }

  // Mobile: close sidebar
  if (window.innerWidth <= 768) {
    DOM.sidebar.classList.remove("open");
  }
}

function showEditorPanel(show) {
  DOM.emptyState.classList.toggle("hidden", show);
  DOM.editorPanel.classList.toggle("hidden", !show);
}

function setColorDot(color) {
  if (color) {
    DOM.colorDot.style.background = color;
    DOM.colorDot.style.borderColor = color;
  } else {
    DOM.colorDot.style.background = "rgba(255,255,255,0.12)";
    DOM.colorDot.style.borderColor = "rgba(255,255,255,0.15)";
  }
  // mark selected in dropdown
  $$(".color-opt").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.color === (color || "default"));
  });
}

function updatePinBtn(pinned) {
  DOM.btnPin.classList.toggle("active", !!pinned);
  DOM.btnPin.title = pinned ? "Sabitlemeyi kaldır" : "Sabitle";
}

function updateArchiveBtn(archived) {
  DOM.btnArchive.classList.toggle("active", !!archived);
  DOM.btnArchive.title = archived ? "Arşivden çıkar" : "Arşivle";
}

function updateFooter(note) {
  const text   = textFromHTML(note.content || "");
  const words  = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars  = text.length;
  DOM.wordCount.textContent = `${words} kelime`;
  DOM.charCount.textContent = `${chars} karakter`;
  DOM.noteDate.textContent  = `Güncellendi: ${formatDate(note.updated || note.created)}`;
}

function renderTagPills(tags) {
  DOM.tagsList.innerHTML = "";
  tags.forEach(tag => {
    const pill = document.createElement("span");
    pill.className = "tag-pill";
    pill.innerHTML = `
      <span>${esc(tag)}</span>
      <button data-tag="${esc(tag)}" title="Etiketi kaldır">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    pill.querySelector("button").addEventListener("click", () => removeTag(tag));
    DOM.tagsList.appendChild(pill);
  });
}

async function removeTag(tag) {
  if (!currentUser || !activeNoteId) return;
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;
  const newTags = (note.tags || []).filter(t => t !== tag);
  await safeSave({ tags: newTags });
  renderTagPills(newTags);
}

/* ══════════════════════════════════════════════
   AUTO-SAVE
══════════════════════════════════════════════ */
function scheduleSave() {
  setSaveStatus("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(performSave, 1500);
}

async function performSave() {
  if (!currentUser || !activeNoteId) return;
  const patch = {
    title:   DOM.noteTitleInput.value.trim(),
    content: DOM.noteContent.innerHTML,
  };
  try {
    await updateNote(currentUser.uid, activeNoteId, patch);
    setSaveStatus("saved");
    updateNoteInList(activeNoteId, patch);
  } catch(e) {
    console.error(e);
    setSaveStatus("error");
    showToast("Kaydedilemedi. Bağlantını kontrol et.", "error");
  }
}

async function safeSave(patch) {
  if (!currentUser || !activeNoteId) return;
  try {
    await updateNote(currentUser.uid, activeNoteId, patch);
    // Merge into local cache so we don't wait for snapshot
    const idx = notes.findIndex(n => n.id === activeNoteId);
    if (idx !== -1) Object.assign(notes[idx], patch, { updated: Date.now() });
    setSaveStatus("saved");
  } catch(e) {
    console.error(e);
    setSaveStatus("error");
    showToast("Kaydedilemedi.", "error");
  }
}

function updateNoteInList(id, patch) {
  const note = notes.find(n => n.id === id);
  if (note) Object.assign(note, patch, { updated: Date.now() });
  const card = DOM.noteList.querySelector(`[data-id="${id}"]`);
  if (card) {
    const titleEl = card.querySelector(".note-card__title");
    const preEl   = card.querySelector(".note-card__preview");
    if (titleEl) {
      titleEl.textContent = patch.title || "Başlıksız not";
      titleEl.classList.toggle("untitled", !patch.title);
    }
    if (preEl && patch.content !== undefined) {
      const prev = textFromHTML(patch.content).slice(0, 120);
      preEl.textContent = prev;
    }
  }
}

function setSaveStatus(state) {
  DOM.saveStatus.className = "save-status " + state;
  const label = DOM.saveStatus.querySelector(".save-label");
  if (label) {
    label.textContent = state === "saving" ? "Kaydediliyor…" : state === "error" ? "Hata!" : "Kaydedildi";
  }
}

/* ══════════════════════════════════════════════
   TOOLBAR
══════════════════════════════════════════════ */
$$(".tool-btn[data-cmd]").forEach(btn => {
  btn.addEventListener("mousedown", e => {
    e.preventDefault();
    const cmd = btn.dataset.cmd;
    const val = btn.dataset.val || null;
    document.execCommand(cmd, false, val);
    DOM.noteContent.focus();
    updateToolbarState();
    scheduleSave();
  });
});

DOM.noteContent.addEventListener("keyup", updateToolbarState);
DOM.noteContent.addEventListener("mouseup", updateToolbarState);
DOM.noteContent.addEventListener("selectionchange", updateToolbarState);

function updateToolbarState() {
  $$(".tool-btn[data-cmd]").forEach(btn => {
    const cmd = btn.dataset.cmd;
    if (["bold","italic","underline","strikeThrough",
         "justifyLeft","justifyCenter","justifyRight",
         "insertUnorderedList","insertOrderedList"].includes(cmd)) {
      try {
        btn.classList.toggle("active", document.queryCommandState(cmd));
      } catch(e) {}
    }
  });
}

// Special toolbar buttons
DOM.btnInsertCode?.addEventListener("click", () => {
  saveSelection();
  const sel = window.getSelection();
  const selected = sel && !sel.isCollapsed ? sel.toString() : "kod buraya";
  document.execCommand("insertHTML", false, `<code>${esc(selected)}</code>`);
  scheduleSave();
});

DOM.btnInsertLink?.addEventListener("click", () => {
  saveSelection();
  DOM.linkModal.classList.remove("hidden");
  setTimeout(() => DOM.linkInput.focus(), 50);
});

DOM.btnLinkCancel?.addEventListener("click", () => {
  DOM.linkModal.classList.add("hidden");
  DOM.linkInput.value = "";
});

DOM.btnLinkConfirm?.addEventListener("click", () => {
  const url = DOM.linkInput.value.trim();
  if (!url) return;
  restoreSelection();
  document.execCommand("createLink", false, url);
  // Make it open in new tab
  const links = DOM.noteContent.querySelectorAll("a");
  links.forEach(a => { a.target = "_blank"; a.rel = "noopener noreferrer"; });
  DOM.linkModal.classList.add("hidden");
  DOM.linkInput.value = "";
  scheduleSave();
});

DOM.linkInput?.addEventListener("keydown", e => {
  if (e.key === "Enter") DOM.btnLinkConfirm.click();
  if (e.key === "Escape") DOM.btnLinkCancel.click();
});

DOM.btnInsertHr?.addEventListener("click", () => {
  document.execCommand("insertHorizontalRule", false);
  scheduleSave();
});

DOM.btnCheckList?.addEventListener("click", () => {
  const html = `<ul class="check-list"><li class="check-item"><input type="checkbox"> <span>Görev</span></li></ul>`;
  document.execCommand("insertHTML", false, html);
  scheduleSave();
});

DOM.btnClearFormat?.addEventListener("click", () => {
  document.execCommand("removeFormat", false);
  scheduleSave();
});

function saveSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
}

function restoreSelection() {
  if (!savedRange) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedRange);
  DOM.noteContent.focus();
}

/* ══════════════════════════════════════════════
   EVENTS — EDITOR INPUTS
══════════════════════════════════════════════ */
DOM.noteTitleInput?.addEventListener("input", () => {
  scheduleSave();
  // Live update word count
  updateWordCount();
});

DOM.noteContent?.addEventListener("input", () => {
  scheduleSave();
  updateWordCount();
});

DOM.noteContent?.addEventListener("keydown", e => {
  // Tab → 2 spaces
  if (e.key === "Tab") {
    e.preventDefault();
    document.execCommand("insertText", false, "  ");
  }
  // Ctrl+S
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    clearTimeout(saveTimer);
    performSave();
  }
});

function updateWordCount() {
  if (!activeNoteId) return;
  const text  = textFromHTML(DOM.noteContent.innerHTML || "") + " " + (DOM.noteTitleInput.value || "");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = (DOM.noteContent.textContent || "").length;
  DOM.wordCount.textContent = `${words} kelime`;
  DOM.charCount.textContent = `${chars} karakter`;
}

/* ══════════════════════════════════════════════
   NEW NOTE
══════════════════════════════════════════════ */
async function handleNewNote() {
  if (!currentUser) return;
  try {
    const note = await createNote(currentUser.uid);
    // Snapshot listener will update list; open immediately
    notes.unshift(note);
    applyFiltersAndRender();
    openNote(note.id);
    showToast("Yeni not oluşturuldu.", "success");
  } catch(e) {
    console.error(e);
    showToast("Not oluşturulamadı.", "error");
  }
}

DOM.btnNewNote?.addEventListener("click", handleNewNote);
DOM.btnCreateFirst?.addEventListener("click", handleNewNote);

// Ctrl+N
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "n") {
    e.preventDefault();
    handleNewNote();
  }
});

/* ══════════════════════════════════════════════
   PIN / ARCHIVE
══════════════════════════════════════════════ */
DOM.btnPin?.addEventListener("click", async () => {
  if (!currentUser || !activeNoteId) return;
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;
  const newVal = !note.pinned;
  await safeSave({ pinned: newVal });
  updatePinBtn(newVal);
  applyFiltersAndRender();
  showToast(newVal ? "Not sabitlendi." : "Sabitleme kaldırıldı.", "info");
});

DOM.btnArchive?.addEventListener("click", async () => {
  if (!currentUser || !activeNoteId) return;
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;
  const newVal = !note.archived;
  await safeSave({ archived: newVal });
  updateArchiveBtn(newVal);
  applyFiltersAndRender();
  if (newVal) {
    showToast("Not arşivlendi.", "info");
    activeNoteId = null;
    showEditorPanel(false);
  } else {
    showToast("Not arşivden çıkarıldı.", "info");
  }
});

/* ══════════════════════════════════════════════
   DELETE
══════════════════════════════════════════════ */
DOM.btnDelete?.addEventListener("click", () => {
  DOM.deleteModal.classList.remove("hidden");
});

DOM.btnDeleteCancel?.addEventListener("click", () => {
  DOM.deleteModal.classList.add("hidden");
});

DOM.btnDeleteConfirm?.addEventListener("click", async () => {
  if (!currentUser || !activeNoteId) return;
  DOM.deleteModal.classList.add("hidden");
  try {
    await deleteNote(currentUser.uid, activeNoteId);
    notes = notes.filter(n => n.id !== activeNoteId);
    activeNoteId = null;
    showEditorPanel(false);
    applyFiltersAndRender();
    renderTagFilterBar();
    updateStats();
    showToast("Not silindi.", "info");
  } catch(e) {
    console.error(e);
    showToast("Not silinemedi.", "error");
  }
});

// ESC closes modals
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    DOM.deleteModal.classList.add("hidden");
    DOM.linkModal.classList.add("hidden");
    DOM.colorPickerDropdown.classList.add("hidden");
  }
});

/* ══════════════════════════════════════════════
   COLOR PICKER
══════════════════════════════════════════════ */
DOM.noteColorBtn?.addEventListener("click", e => {
  e.stopPropagation();
  DOM.colorPickerDropdown.classList.toggle("hidden");
});

document.addEventListener("click", e => {
  if (!DOM.colorPickerDropdown.contains(e.target) && e.target !== DOM.noteColorBtn) {
    DOM.colorPickerDropdown.classList.add("hidden");
  }
});

$$(".color-opt").forEach(btn => {
  btn.addEventListener("click", async () => {
    const color = btn.dataset.color === "default" ? null : btn.dataset.color;
    setColorDot(color);
    DOM.colorPickerDropdown.classList.add("hidden");
    await safeSave({ color });
    // Update card strip
    const card = DOM.noteList.querySelector(`[data-id="${activeNoteId}"] .note-card__color-strip`);
    if (card) card.style.background = color || "rgba(255,255,255,0.08)";
  });
});

/* ══════════════════════════════════════════════
   TAGS
══════════════════════════════════════════════ */
DOM.btnAddTag?.addEventListener("click", () => {
  DOM.tagInput.classList.remove("hidden");
  DOM.btnAddTag.classList.add("hidden");
  DOM.tagInput.focus();
});

DOM.tagInput?.addEventListener("keydown", async e => {
  if (e.key === "Enter") {
    e.preventDefault();
    await addTag();
  }
  if (e.key === "Escape") {
    cancelTagInput();
  }
});

DOM.tagInput?.addEventListener("blur", () => {
  // small delay to allow click on something else
  setTimeout(cancelTagInput, 150);
});

async function addTag() {
  const tag = DOM.tagInput.value.trim();
  if (!tag || !currentUser || !activeNoteId) {
    cancelTagInput();
    return;
  }
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;
  const tags = note.tags || [];
  if (tags.includes(tag)) {
    showToast("Bu etiket zaten var.", "info");
    cancelTagInput();
    return;
  }
  const newTags = [...tags, tag];
  await safeSave({ tags: newTags });
  renderTagPills(newTags);
  renderTagFilterBar();
  cancelTagInput();
}

function cancelTagInput() {
  DOM.tagInput.value = "";
  DOM.tagInput.classList.add("hidden");
  DOM.btnAddTag.classList.remove("hidden");
}

/* ══════════════════════════════════════════════
   TAG FILTER BAR
══════════════════════════════════════════════ */
function renderTagFilterBar() {
  const allTags = [...new Set(notes.flatMap(n => n.tags || []))].sort();
  DOM.tagFilterBar.innerHTML = "";

  if (allTags.length === 0) return;

  // "Tümü" chip
  const allChip = document.createElement("button");
  allChip.className = "tag-filter-chip" + (!activeTagFilter ? " active" : "");
  allChip.textContent = "Tüm etiketler";
  allChip.addEventListener("click", () => {
    activeTagFilter = null;
    applyFiltersAndRender();
    renderTagFilterBar();
  });
  DOM.tagFilterBar.appendChild(allChip);

  allTags.forEach(tag => {
    const chip = document.createElement("button");
    chip.className = "tag-filter-chip" + (activeTagFilter === tag ? " active" : "");
    chip.textContent = tag;
    chip.addEventListener("click", () => {
      activeTagFilter = activeTagFilter === tag ? null : tag;
      applyFiltersAndRender();
      renderTagFilterBar();
    });
    DOM.tagFilterBar.appendChild(chip);
  });
}

/* ══════════════════════════════════════════════
   SEARCH
══════════════════════════════════════════════ */
let searchDebounce = null;
DOM.searchInput?.addEventListener("input", () => {
  searchQuery = DOM.searchInput.value;
  DOM.searchClear.classList.toggle("hidden", !searchQuery);
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => applyFiltersAndRender(), 200);
});

DOM.searchClear?.addEventListener("click", () => {
  DOM.searchInput.value = "";
  searchQuery = "";
  DOM.searchClear.classList.add("hidden");
  applyFiltersAndRender();
  DOM.searchInput.focus();
});

/* ══════════════════════════════════════════════
   FILTERS
══════════════════════════════════════════════ */
$$(".filter-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".filter-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    activeTagFilter = null;
    applyFiltersAndRender();
    renderTagFilterBar();
  });
});

DOM.sortSelect?.addEventListener("change", () => {
  sortBy = DOM.sortSelect.value;
  applyFiltersAndRender();
});

/* ══════════════════════════════════════════════
   SIDEBAR TOGGLE (mobile)
══════════════════════════════════════════════ */
DOM.sidebarToggle?.addEventListener("click", () => {
  DOM.sidebar.classList.toggle("open");
});

/* ══════════════════════════════════════════════
   EXPORT
══════════════════════════════════════════════ */
DOM.btnExport?.addEventListener("click", () => {
  if (!activeNoteId) return;
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;

  const title   = note.title || "Başlıksız not";
  const content = note.content || "";
  const date    = formatDate(note.updated || note.created);
  const tags    = (note.tags || []).join(", ");

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<style>
  body{font-family:'Segoe UI',system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;line-height:1.7;color:#1a1a2e;}
  h1{font-size:28px;font-weight:800;margin-bottom:4px;}
  .meta{color:#888;font-size:13px;margin-bottom:32px;}
  h2{font-size:20px;} h3{font-size:16px;}
  code{background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:13px;}
  pre{background:#f5f5f5;padding:16px;border-radius:8px;overflow:auto;}
  blockquote{border-left:3px solid #c9a84c;padding-left:1em;color:#666;}
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<div class="meta">${date}${tags ? " · " + esc(tags) : ""}</div>
${content}
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = (title.slice(0, 60) || "not") + ".html";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Not dışa aktarıldı.", "success");
});

/* ══════════════════════════════════════════════
   COPY
══════════════════════════════════════════════ */
DOM.btnCopy?.addEventListener("click", () => {
  if (!activeNoteId) return;
  const text = (DOM.noteTitleInput.value ? DOM.noteTitleInput.value + "\n\n" : "") +
               textFromHTML(DOM.noteContent.innerHTML || "");
  navigator.clipboard.writeText(text).then(() => {
    showToast("Metin kopyalandı.", "success");
  }).catch(() => {
    showToast("Kopyalanamadı.", "error");
  });
});

/* ══════════════════════════════════════════════
   STATS
══════════════════════════════════════════════ */
function updateStats() {
  const total    = notes.filter(n => !n.archived).length;
  const pinned   = notes.filter(n => n.pinned && !n.archived).length;
  const archived = notes.filter(n => n.archived).length;
  DOM.sidebarStats.textContent = `${total} not · ${pinned} sabitli · ${archived} arşivde`;
}

/* ══════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════ */
function showToast(msg, type = "info") {
  const icons = {
    success: `<svg class="toast-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg class="toast-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info:    `<svg class="toast-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `${icons[type] || ""}<span>${esc(msg)}</span>`;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("out");
    setTimeout(() => toast.remove(), 280);
  }, 2800);
}

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function textFromHTML(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function formatRelDate(ts) {
  if (!ts) return "";
  const d    = new Date(ts);
  const now  = Date.now();
  const diff = now - ts;
  if (diff < 60_000)  return "Az önce";
  if (diff < 3600_000) return `${Math.floor(diff/60_000)} dk önce`;
  if (diff < 86400_000) return `${Math.floor(diff/3600_000)} sa önce`;
  if (diff < 7*86400_000) return `${Math.floor(diff/86400_000)} gün önce`;
  return d.toLocaleDateString("tr-TR", { day:"numeric", month:"short" });
}

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}
/* ── READ MODE ── */
const readOverlay  = document.getElementById("readOverlay");
const readTitle    = document.getElementById("readTitle");
const readContent  = document.getElementById("readContent");
const readColorDot = document.getElementById("readColorDot");
const readTags     = document.getElementById("readTags");
const readDate     = document.getElementById("readDate");
const btnReadMode  = document.getElementById("btnReadMode");
const readCloseBtn = document.getElementById("readCloseBtn");
 
function openReadMode() {
  if (!activeNoteId) return;
  const note = notes.find(n => n.id === activeNoteId);
  if (!note) return;
 
  readTitle.textContent   = note.title || "";
  readContent.innerHTML   = note.content || "";
 
  // color dot
  if (note.color) {
    readColorDot.style.background   = note.color;
    readColorDot.style.borderColor  = note.color;
    readColorDot.style.display      = "block";
  } else {
    readColorDot.style.display = "none";
  }
 
  // tags
  readTags.innerHTML = (note.tags || [])
    .map(t => `<span class="read-tag">${t.replace(/</g,"&lt;")}</span>`)
    .join("");
 
  // date
  const d = new Date(note.updated || note.created);
  readDate.textContent = d.toLocaleDateString("tr-TR", {
    day:"numeric", month:"long", year:"numeric"
  });
 
  readOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
 
function closeReadMode() {
  readOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}
 
btnReadMode?.addEventListener("click", openReadMode);
readCloseBtn?.addEventListener("click", closeReadMode);
 
// ESC kapatır (mevcut ESC handler'ına readOverlay ekle)
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !readOverlay.classList.contains("hidden")) {
    closeReadMode();
  }
  // Ctrl+Shift+R
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "R") {
    e.preventDefault();
    if (readOverlay.classList.contains("hidden")) openReadMode();
    else closeReadMode();
  }
});
 
// Overlay'e tıklayınca (içeriğin dışına) kapat
readOverlay?.addEventListener("click", e => {
  if (e.target === readOverlay) closeReadMode();
});