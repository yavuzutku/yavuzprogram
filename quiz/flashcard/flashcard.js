/**
 * AlmancaPratik — Flashcard System v2.0
 * File: quiz/flashcard/flashcard.js
 *
 * Features:
 *  - SM-2 Spaced Repetition Algorithm
 *  - Per-word SRS data: interval, repetitions, easeFactor, nextReview
 *  - Session ordering: due → new → learned
 *  - 3D card flip (CSS handles animation)
 *  - Keyboard shortcuts: Space=flip, 1-4=rate
 *  - Source filter: all words / by list
 *  - Stepper (count)
 *  - Order: SRS / Shuffle / Alphabetical
 *  - Proper reset on logout
 *  - No crash on undefined tags / missing fields
 */

import { getWords, onAuthChange }   from "../../js/firebase.js";
import { getListeler }              from "../../js/listeler-firebase.js";

/* ══════════════════════════════════════════════════
   SRS STORAGE  (localStorage, keyed per userId)
══════════════════════════════════════════════════ */
const SRS_VERSION = "ap_srs_v3";

function srsKey(userId) {
  return `${SRS_VERSION}_${userId}`;
}

function getSRSStore(userId) {
  try {
    return JSON.parse(localStorage.getItem(srsKey(userId)) || "{}");
  } catch {
    return {};
  }
}

function saveSRSStore(userId, data) {
  try {
    localStorage.setItem(srsKey(userId), JSON.stringify(data));
  } catch (e) {
    console.warn("SRS save error:", e);
  }
}

/**
 * Get SRS card for a word.
 * Returns safe defaults if not found.
 */
function getCard(userId, wordId) {
  const store = getSRSStore(userId);
  return store[wordId] || {
    interval:    0,
    repetitions: 0,
    easeFactor:  2.5,
    nextReview:  0,
    reviewCount: 0,
    lastReviewed: null,
  };
}

/**
 * SM-2 Algorithm
 * quality: 1=Again(0), 2=Hard(2), 3=Good(4), 4=Easy(5)
 *
 * SM-2 q mapping:
 *   Again → q=0  (total blackout)
 *   Hard  → q=2  (incorrect but remembered)
 *   Good  → q=4  (correct with some effort)
 *   Easy  → q=5  (perfect recall)
 */
function updateCardSM2(userId, wordId, quality) {
  const store = getSRSStore(userId);
  const card  = getCard(userId, wordId);

  const qMap = { 1: 0, 2: 2, 3: 4, 4: 5 };
  const q    = qMap[quality] ?? 0;

  if (q >= 3) {
    // Correct response
    if (card.repetitions === 0) {
      card.interval = 1;
    } else if (card.repetitions === 1) {
      card.interval = 6;
    } else {
      card.interval = Math.round(card.interval * card.easeFactor);
    }
    // Easy bonus
    if (quality === 4) card.interval = Math.round(card.interval * 1.3);
    card.repetitions++;
  } else {
    // Incorrect → reset
    card.repetitions = 0;
    card.interval     = 1;
  }

  // Update ease factor (SM-2 formula, min 1.3)
  card.easeFactor = Math.max(
    1.3,
    card.easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
  );

  ccard.nextReview = Date.now() + card.interval * 5000; // 5 saniye
  card.reviewCount = (card.reviewCount || 0) + 1;
  card.lastReviewed = Date.now();

  store[wordId] = card;
  saveSRSStore(userId, store);
  return card;
}

/**
 * Card status:
 *  'new'     → never reviewed
 *  'due'     → reviewed but nextReview ≤ now
 *  'learned' → reviewed and nextReview > now
 */
function getCardStatus(userId, wordId) {
  const c = getCard(userId, wordId);
  if (c.repetitions === 0 && c.reviewCount === 0) return "new";
  if (c.nextReview <= Date.now()) return "due";
  return "learned";
}

/**
 * Preview next interval (days) without writing to storage.
 */
function previewInterval(userId, wordId, quality) {
  const card = getCard(userId, wordId);
  const qMap = { 1: 0, 2: 2, 3: 4, 4: 5 };
  const q    = qMap[quality] ?? 0;

  if (q < 3) return 1;

  let interval = card.interval;
  if (card.repetitions === 0)      interval = 1;
  else if (card.repetitions === 1) interval = 6;
  else interval = Math.round(interval * card.easeFactor);

  if (quality === 4) interval = Math.round(interval * 1.3);
  return Math.max(1, interval);
}

/* ══════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════ */
let state = {
  userId:        null,
  allWords:      [],   // raw words from Firestore
  allLists:      [],   // user's lists
  activeWords:   [],   // filtered pool
  quizSource:    "all",
  selectedListId: null,
  totalCount:    15,
  order:         "srs",  // "srs" | "shuffle" | "alpha"

  // Session
  deck:       [],   // ordered cards for this session
  deckIndex:  0,
  flipped:    false,

  // Ratings this session
  ratings:    { 1: 0, 2: 0, 3: 0, 4: 0 },
};

/* ══════════════════════════════════════════════════
   DOM REFS
══════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

const screens = {
  loading: $("screen-loading"),
  setup:   $("screen-setup"),
  study:   $("screen-study"),
  result:  $("screen-result"),
};

/* ══════════════════════════════════════════════════
   SCREEN MANAGER
══════════════════════════════════════════════════ */
function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => {
    if (el) el.classList.toggle("hidden", k !== name);
  });
  if (name !== "study") window.scrollTo(0, 0);
}

/* ══════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════ */
onAuthChange(async (user) => {
  if (!user) {
    // BUGFIX #6: reset UI on logout
    state.userId    = null;
    state.allWords  = [];
    state.allLists  = [];
    state.activeWords = [];
    resetSetupUI();
    showLoginPrompt(true);
    showScreen("setup");
    return;
  }

  state.userId = user.uid;
  showLoginPrompt(false);
  showScreen("loading");

  try {
    const [rawWords, lists] = await Promise.all([
      getWords(user.uid),
      getListeler(user.uid)
    ]);

    // BUGFIX #3: proper data model — normalize every word
    state.allWords = rawWords
      .map(d => ({
        id:      d.id,
        word:    String(d.word   || "").trim(),
        meaning: String(d.meaning || "").trim(),
        // BUGFIX #2: safe tags — always Array
        tags:    Array.isArray(d.tags) ? d.tags : [],
        meanings: Array.isArray(d.meanings) && d.meanings.length
          ? d.meanings
          : [String(d.meaning || "").trim()],
        // SRS fields — stored in localStorage, not Firestore
      }))
      .filter(d => d.word && d.meaning);

    state.allLists = Array.isArray(lists) ? lists : [];

    refreshActiveWords();
    updateSetupSRSStrip();
    renderListPicker();
    showScreen("setup");
  } catch (err) {
    console.error("Flashcard load error:", err);
    showScreen("setup");
  }
});

function showLoginPrompt(show) {
  const el = $("loginCard");
  if (el) el.style.display = show ? "flex" : "none";
  const body = $("setupBody");
  if (body) body.style.display = show ? "none" : "block";
}

/* ══════════════════════════════════════════════════
   ACTIVE WORDS
══════════════════════════════════════════════════ */
function getActivePool() {
  if (state.quizSource === "list" && state.selectedListId) {
    const l = state.allLists.find(l => l.id === state.selectedListId);
    if (l && Array.isArray(l.wordIds)) {
      return state.allWords.filter(w => l.wordIds.includes(w.id));
    }
  }
  return state.allWords;
}

function refreshActiveWords() {
  state.activeWords = getActivePool();
  updateWordCountInfo();
  updateSetupSRSStrip();
  updateStartBtnState();
}

function updateWordCountInfo() {
  const el = $("wordCountInfo");
  if (!el) return;
  const n = state.activeWords.length;
  el.innerHTML = n > 0
    ? `<span>${n}</span> kelime mevcut`
    : `Kelime bulunamadı — lütfen başka liste seç veya kelime ekle`;
}

function updateStartBtnState() {
  const btn = $("btnStart");
  if (!btn) return;
  btn.disabled = state.activeWords.length < 1;
}

function resetSetupUI() {
  const el = $("wordCountInfo");
  if (el) el.innerHTML = "—";
  const srs = $("setupSRSStrip");
  if (srs) srs.style.display = "none";
}

/* ══════════════════════════════════════════════════
   SRS STRIP (setup screen)
══════════════════════════════════════════════════ */
function updateSetupSRSStrip() {
  if (!state.userId || !state.activeWords.length) {
    const strip = $("setupSRSStrip");
    if (strip) strip.style.display = "none";
    return;
  }
  const strip = $("setupSRSStrip");
  if (strip) strip.style.display = "grid";

  let newC = 0, dueC = 0, doneC = 0;
  state.activeWords.forEach(w => {
    const s = getCardStatus(state.userId, w.id);
    if      (s === "new")  newC++;
    else if (s === "due")  dueC++;
    else                   doneC++;
  });

  setNum("srsNew",  newC);
  setNum("srsDue",  dueC);
  setNum("srsDone", doneC);
}

function setNum(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}

/* ══════════════════════════════════════════════════
   LIST PICKER
══════════════════════════════════════════════════ */
function renderListPicker() {
  const loading = $("listPickerLoading");
  const grid    = $("listPickerGrid");
  const empty   = $("listPickerEmpty");

  if (loading) loading.style.display = "none";

  if (!state.allLists.length) {
    if (grid)  grid.style.display  = "none";
    if (empty) empty.style.display = "block";
    return;
  }

  if (empty) empty.style.display = "none";
  if (!grid) return;
  grid.style.display = "flex";
  grid.innerHTML = "";

  state.allLists.forEach(liste => {
    const item = document.createElement("div");
    item.className = "list-item" + (state.selectedListId === liste.id ? " selected" : "");
    item.dataset.id = liste.id;
    const wordCount = typeof liste.wordCount === "number"
      ? liste.wordCount
      : (Array.isArray(liste.wordIds) ? liste.wordIds.length : 0);
    item.innerHTML = `
      <div>
        <div class="list-item-name">${esc(liste.name)}</div>
        <div class="list-item-count">${wordCount} kelime</div>
      </div>
      <div class="list-check"><div class="list-check-dot"></div></div>`;
    item.addEventListener("click", () => {
      state.selectedListId = state.selectedListId === liste.id ? null : liste.id;
      grid.querySelectorAll(".list-item").forEach(el => {
        el.classList.toggle("selected", el.dataset.id === state.selectedListId);
      });
      refreshActiveWords();
    });
    grid.appendChild(item);
  });
}

/* ══════════════════════════════════════════════════
   STEPPER
══════════════════════════════════════════════════ */
function initStepper() {
  $("stepperDown")?.addEventListener("click", () => {
    state.totalCount = Math.max(5, state.totalCount - 5);
    updateStepperVal();
  });
  $("stepperUp")?.addEventListener("click", () => {
    state.totalCount = Math.min(100, state.totalCount + 5);
    updateStepperVal();
  });
}
function updateStepperVal() {
  const el = $("stepperVal");
  if (el) el.textContent = state.totalCount;
}

/* ══════════════════════════════════════════════════
   SOURCE TABS
══════════════════════════════════════════════════ */
function initSourceTabs() {
  $("srcAll")?.addEventListener("click", () => {
    state.quizSource    = "all";
    state.selectedListId = null;
    toggleActive("srcAll", "srcList");
    const wrap = $("listPickerWrap");
    if (wrap) wrap.style.display = "none";
    refreshActiveWords();
  });

  $("srcList")?.addEventListener("click", () => {
    state.quizSource = "list";
    toggleActive("srcList", "srcAll");
    const wrap = $("listPickerWrap");
    if (wrap) wrap.style.display = "block";
    refreshActiveWords();
  });
}

function toggleActive(on, off) {
  $(on)?.classList.add("active");
  $(off)?.classList.remove("active");
}

/* ══════════════════════════════════════════════════
   ORDER BUTTONS
══════════════════════════════════════════════════ */
function initOrderBtns() {
  ["orderSRS","orderShuffle","orderAlpha"].forEach(id => {
    $(id)?.addEventListener("click", () => {
      state.order = id.replace("order","").toLowerCase();
      if (state.order === "srs") state.order = "srs";
      ["orderSRS","orderShuffle","orderAlpha"].forEach(bid => {
        $(bid)?.classList.toggle("active", bid === id);
      });
    });
  });
}

/* ══════════════════════════════════════════════════
   BUILD DECK
══════════════════════════════════════════════════ */
function buildDeck() {
  const pool  = [...state.activeWords];
  const count = Math.min(state.totalCount, pool.length);

  if (state.order === "srs") {
    const due     = pool.filter(w => getCardStatus(state.userId, w.id) === "due");
    const newW    = pool.filter(w => getCardStatus(state.userId, w.id) === "new");
    const learned = pool.filter(w => getCardStatus(state.userId, w.id) === "learned");
    return [
      ...shuffle(due),
      ...shuffle(newW),
      ...shuffle(learned)
    ].slice(0, count);
  }

  if (state.order === "alpha") {
    return [...pool]
      .sort((a, b) => a.word.localeCompare(b.word, "de"))
      .slice(0, count);
  }

  // default: shuffle
  return shuffle(pool).slice(0, count);
}

/* ══════════════════════════════════════════════════
   START SESSION
══════════════════════════════════════════════════ */
function startSession() {
  if (!state.userId || state.activeWords.length < 1) return;

  state.deck      = buildDeck();
  state.deckIndex = 0;
  state.flipped   = false;
  state.ratings   = { 1: 0, 2: 0, 3: 0, 4: 0 };

  showScreen("study");
  renderCard();
}

/* ══════════════════════════════════════════════════
   RENDER CARD
══════════════════════════════════════════════════ */
function renderCard() {
  if (state.deckIndex >= state.deck.length) {
    showResult();
    return;
  }

  const card = state.deck[state.deckIndex];
  state.flipped = false;

  // Reset 3D
  const fcCard = $("fcCard");
  if (fcCard) fcCard.classList.remove("flipped");

  // Front
  const frontWord = $("fcFrontWord");
  if (frontWord) frontWord.textContent = card.word;

  // Back
  const backMeaning = $("fcBackMeaning");
  if (backMeaning) backMeaning.textContent = card.meaning;

  const extraList = $("fcExtraMeanings");
  if (extraList) {
    extraList.innerHTML = "";
    const extras = (card.meanings || []).slice(1).filter(Boolean);
    if (extras.length) {
      const sep = document.createElement("div");
      sep.className = "fc-extra-sep";
      extraList.appendChild(sep);
      extras.forEach(m => {
        const div = document.createElement("div");
        div.className   = "fc-extra-meaning";
        div.textContent = m;
        extraList.appendChild(div);
      });
    }
  }

  // Card number
  const cardNum = $("fcCardNum");
  if (cardNum) cardNum.textContent = `${state.deckIndex + 1} / ${state.deck.length}`;

  // Hide rating
  const ratingWrap = $("ratingWrap");
  if (ratingWrap) ratingWrap.classList.remove("visible");

  // Progress
  updateStudyProgress();

  // Update preview days
  updateRateDayPreviews(card.id);

  // Session stats
  updateSessionStats();

  // Re-enable scene click
  const scene = $("fcScene");
  if (scene) scene.style.pointerEvents = "auto";
}

/* ══════════════════════════════════════════════════
   FLIP CARD
══════════════════════════════════════════════════ */
function flipCard() {
  if (state.flipped) return;
  state.flipped = true;

  const fcCard = $("fcCard");
  if (fcCard) fcCard.classList.add("flipped");

  // Show rating after flip animation
  setTimeout(() => {
    const ratingWrap = $("ratingWrap");
    if (ratingWrap) ratingWrap.classList.add("visible");
    // Block scene click to prevent accidental double-flip
    const scene = $("fcScene");
    if (scene) scene.style.pointerEvents = "none";
  }, 320);
}

/* ══════════════════════════════════════════════════
   RATE CARD
══════════════════════════════════════════════════ */
function rateCard(quality) {
  if (!state.flipped) return; // must flip first
  const card = state.deck[state.deckIndex];

  updateCardSM2(state.userId, card.id, quality);
  state.ratings[quality]++;
  state.deckIndex++;

  // Update setup SRS strip for next time
  updateSetupSRSStrip();

  if (state.deckIndex >= state.deck.length) {
    showResult();
  } else {
    renderCard();
  }
}

/* ══════════════════════════════════════════════════
   PROGRESS & STATS
══════════════════════════════════════════════════ */
function updateStudyProgress() {
  const pct = state.deck.length > 0
    ? (state.deckIndex / state.deck.length) * 100
    : 0;
  const fill = $("studyProgressFill");
  if (fill) fill.style.width = pct + "%";
  const label = $("studyProgressLabel");
  if (label) label.textContent = `${state.deckIndex + 1} / ${state.deck.length}`;
}

function updateSessionStats() {
  const done = state.deckIndex;
  const remaining = state.deck.length - done;

  // Count new/due in remaining
  let newR = 0, dueR = 0;
  for (let i = done; i < state.deck.length; i++) {
    const s = getCardStatus(state.userId, state.deck[i].id);
    if      (s === "new") newR++;
    else if (s === "due") dueR++;
  }

  const row = $("sessionStats");
  if (!row) return;
  row.innerHTML = "";
  if (dueR) row.innerHTML += `<span class="ss-pip due">${dueR} tekrar</span>`;
  if (newR) row.innerHTML += `<span class="ss-pip new">${newR} yeni</span>`;
  if (done) row.innerHTML += `<span class="ss-pip done">${done} tamamlandı</span>`;
}

/* ══════════════════════════════════════════════════
   RATE DAY PREVIEWS
══════════════════════════════════════════════════ */
function updateRateDayPreviews(wordId) {
  [1, 2, 3, 4].forEach(q => {
    const el = $("rateDay" + q);
    if (!el) return;
    const days = previewInterval(state.userId, wordId, q);
    el.textContent = days === 1 ? "~1 gün" : `~${days} gün`;
  });
}

/* ══════════════════════════════════════════════════
   RESULT SCREEN
══════════════════════════════════════════════════ */
function showResult() {
  const total   = state.deck.length;
  const correct = state.ratings[3] + state.ratings[4];
  const pct     = total > 0 ? Math.round((correct / total) * 100) : 0;

  let emoji, title, msg;
  if      (pct === 100) { emoji = "🏆"; title = "Mükemmel!";        msg = "Tüm kartları doğru yanıtladın. Muhteşem bir seans!"; }
  else if (pct >= 80)   { emoji = "🎉"; title = "Harika!";           msg = "Çok başarılı bir performans. Böyle devam!"; }
  else if (pct >= 60)   { emoji = "👍"; title = "İyi İş!";           msg = "Biraz daha pratikle mükemmel olacak."; }
  else if (pct >= 40)   { emoji = "📚"; title = "Çalışmaya Devam!"; msg = "Bu kelimeleri bir kez daha gözden geçir."; }
  else                  { emoji = "💪"; title = "Devam Et!";         msg = "Her tekrar seni ileriye taşıyor. Pes etme!"; }

  $("resultEmoji")  && ($("resultEmoji").textContent  = emoji);
  $("resultTitle")  && ($("resultTitle").textContent  = title);
  $("resultScore")  && ($("resultScore").textContent  = `${correct} / ${total}`);
  $("resultMsg")    && ($("resultMsg").textContent    = msg);

  // Breakdown
  const bd = $("resultBreakdown");
  if (bd) {
    bd.innerHTML = `
      <div class="rb-cell">
        <span class="rb-num again">${state.ratings[1]}</span>
        <span class="rb-label">Tekrar</span>
      </div>
      <div class="rb-cell">
        <span class="rb-num hard">${state.ratings[2]}</span>
        <span class="rb-label">Zor</span>
      </div>
      <div class="rb-cell">
        <span class="rb-num good">${state.ratings[3]}</span>
        <span class="rb-label">İyi</span>
      </div>
      <div class="rb-cell">
        <span class="rb-num easy">${state.ratings[4]}</span>
        <span class="rb-label">Kolay</span>
      </div>`;
  }

  // SRS note
  const words  = state.activeWords;
  const dueNow = words.filter(w => getCardStatus(state.userId, w.id) === "due").length;
  const learned= words.filter(w => getCardStatus(state.userId, w.id) === "learned").length;
  const note   = $("resultSrsNote");
  if (note) {
    note.innerHTML = `
      <strong>Seans tamamlandı!</strong>
      Öğrenilen: <strong style="color:var(--gr)">${learned}</strong> kelime &nbsp;·&nbsp;
      Tekrar bekleyen: <strong style="color:var(--re)">${dueNow}</strong> kelime.
      ${dueNow > 0 ? "<br>Tekrar bekleyen kelimeler için yeni bir seans başlatabilirsin." : ""}`;
  }

  showScreen("result");
}

/* ══════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
══════════════════════════════════════════════════ */
function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    // Only active on study screen
    if ($("screen-study")?.classList.contains("hidden")) return;
    // Ignore when typing in an input
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    if (e.code === "Space" || e.code === "ArrowRight") {
      e.preventDefault();
      flipCard();
      return;
    }
    if (state.flipped) {
      if (e.key === "1") { e.preventDefault(); rateCard(1); }
      if (e.key === "2") { e.preventDefault(); rateCard(2); }
      if (e.key === "3") { e.preventDefault(); rateCard(3); }
      if (e.key === "4") { e.preventDefault(); rateCard(4); }
    }
  });
}

/* ══════════════════════════════════════════════════
   EVENT WIRING
══════════════════════════════════════════════════ */
function initEvents() {
  // Flip card
  $("fcScene")?.addEventListener("click", () => flipCard());
  $("fcScene")?.setAttribute("tabindex", "0");
  $("fcScene")?.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flipCard(); }
  });

  // Rate buttons
  [1, 2, 3, 4].forEach(q => {
    $("rateBtn" + q)?.addEventListener("click", () => rateCard(q));
  });

  // Start button
  $("btnStart")?.addEventListener("click", startSession);

  // Restart button
  $("btnRestart")?.addEventListener("click", startSession);

  // Home button
  $("btnHome")?.addEventListener("click", () => showScreen("setup"));

  // Back from study
  $("btnBackStudy")?.addEventListener("click", () => showScreen("setup"));

  // Source tabs
  initSourceTabs();

  // Stepper
  initStepper();

  // Order buttons
  initOrderBtns();
}

/* ══════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════ */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  initEvents();
  initKeyboard();
  // Show setup initially (auth will trigger data load)
  showScreen("setup");
});

// Expose minimal API for inline HTML handlers (none needed — all wired above)