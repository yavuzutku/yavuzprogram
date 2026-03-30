/**
 * AlmancaPratik — Flashcard System v3.0
 * File: quiz/flashcard/flashcard.js
 *
 * Öğrenme Sistemi:
 *  - Learning Phase  : Yeni / hatalı kartlar dakika bazlı tekrar (1dk → 10dk → 60dk)
 *  - Review Phase    : SM-2 algoritması ile gün bazlı uzun vadeli tekrar
 *  - Again → deck'in sonuna eklenir (aynı seansta tekrar gelir)
 *  - UI   : Learning kartlarda dakika, Review kartlarda gün gösterir
 */

import { getWords, onAuthChange }   from "../../js/firebase.js";
import { getListeler }              from "../../js/listeler-firebase.js";

/* ══════════════════════════════════════════════════
   LEARNING STEPS  (dakika cinsinden)
   Yeni kart: 1dk → 10dk → 60dk → artık "review"
══════════════════════════════════════════════════ */
const LEARNING_STEPS = [1, 10, 60];   // dakika

/* ══════════════════════════════════════════════════
   SRS STORAGE  (localStorage, keyed per userId)
══════════════════════════════════════════════════ */
const SRS_VERSION = "ap_srs_v4";      // v3'ten farklı — temiz başlangıç

function srsKey(userId) {
  return `${SRS_VERSION}_${userId}`;
}
function getSRSStore(userId) {
  try { return JSON.parse(localStorage.getItem(srsKey(userId)) || "{}"); }
  catch { return {}; }
}
function saveSRSStore(userId, data) {
  try { localStorage.setItem(srsKey(userId), JSON.stringify(data)); }
  catch (e) { console.warn("SRS save error:", e); }
}

/* ── Varsayılan kart ─────────────────────────────── */
function defaultCard() {
  return {
    state:       "new",     // "new" | "learning" | "review"
    step:        0,         // LEARNING_STEPS'teki index
    interval:    1,         // review fazı için gün
    repetitions: 0,
    easeFactor:  2.5,
    nextReview:  0,         // ms timestamp
    reviewCount: 0,
    lastReviewed: null,
  };
}

function getCard(userId, wordId) {
  const store = getSRSStore(userId);
  const saved = store[wordId];
  if (!saved) return defaultCard();
  // Eski v3 kartları learning state'i yoksa migrate et
  if (!saved.state) {
    saved.state = saved.repetitions > 0 ? "review" : "new";
    saved.step  = 0;
  }
  return saved;
}

/* ══════════════════════════════════════════════════
   LEARNING PHASE HANDLER
   quality: 1=Again, 2=Hard, 3=Good, 4=Easy
══════════════════════════════════════════════════ */
function handleLearning(card, quality) {
  if (quality === 1) {
    // Again → başa dön
    card.step = 0;
  } else if (quality === 4) {
    // Easy → direkt review'e gönder (step'leri atla)
    card.step = LEARNING_STEPS.length;
  } else {
    // Hard (2) → aynı step'te kal | Good (3) → bir ileri
    if (quality === 3) card.step++;
    // Hard: step değişmez, aynı süre tekrar
  }

  if (card.step >= LEARNING_STEPS.length) {
    // 🎓 Öğrenildi → review moduna geç
    card.state       = "review";
    card.repetitions = 1;
    card.interval    = quality === 4 ? 4 : 1; // Easy ise 4 gün, diğerleri 1 gün
    card.nextReview  = Date.now() + card.interval * 86_400_000;
  } else {
    // Hâlâ learning aşamasında
    card.state      = "learning";
    const minutes   = LEARNING_STEPS[card.step];
    card.nextReview = Date.now() + minutes * 60_000;
  }
}

/* ══════════════════════════════════════════════════
   SM-2 REVIEW PHASE HANDLER
══════════════════════════════════════════════════ */
function handleReviewSM2(card, quality) {
  const qMap = { 1: 0, 2: 2, 3: 4, 4: 5 };
  const q    = qMap[quality] ?? 0;

  if (q < 3) {
    // Again/Hard → learning'e geri dön
    card.state       = "learning";
    card.step        = 0;
    card.repetitions = 0;
    card.interval    = 1;
    card.nextReview  = Date.now() + LEARNING_STEPS[0] * 60_000;
  } else {
    // Doğru cevap → SM-2
    if (card.repetitions <= 1) {
      card.interval = card.repetitions === 0 ? 1 : 6;
    } else {
      card.interval = Math.round(card.interval * card.easeFactor);
    }
    if (quality === 4) card.interval = Math.round(card.interval * 1.3);
    card.repetitions++;
    card.nextReview = Date.now() + card.interval * 86_400_000;
  }

  // Ease factor güncelle (SM-2, min 1.3)
  card.easeFactor = Math.max(
    1.3,
    card.easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
  );
}

/* ══════════════════════════════════════════════════
   ANA GÜNCELLEME FONKSİYONU
══════════════════════════════════════════════════ */
function updateCard(userId, wordId, quality) {
  const store = getSRSStore(userId);
  const card  = getCard(userId, wordId);

  if (card.state === "review") {
    handleReviewSM2(card, quality);
  } else {
    handleLearning(card, quality);
  }

  card.reviewCount  = (card.reviewCount || 0) + 1;
  card.lastReviewed = Date.now();
  store[wordId]     = card;
  saveSRSStore(userId, store);
  return card;
}

/* ══════════════════════════════════════════════════
   KART DURUMU
══════════════════════════════════════════════════ */
function getCardStatus(userId, wordId) {
  const c = getCard(userId, wordId);
  if (c.state === "new")                        return "new";
  if (c.state === "learning")                   return "learning";
  if (c.state === "review" && c.nextReview <= Date.now()) return "due";
  if (c.state === "review" && c.nextReview >  Date.now()) return "learned";
  // Fallback — eski veri
  if (c.repetitions === 0 && c.reviewCount === 0) return "new";
  if (c.nextReview <= Date.now())                  return "due";
  return "learned";
}

/* ══════════════════════════════════════════════════
   PREVIEW — Bir sonraki tekrar süresi (yazmadan)
   Dönen değer: { value: number, unit: "dk" | "sa" | "gün" }
══════════════════════════════════════════════════ */
function previewNextReview(userId, wordId, quality) {
  const card = getCard(userId, wordId);

  if (card.state !== "review") {
    // Learning phase preview
    let step = card.step;
    if (quality === 1) step = 0;
    else if (quality === 4) step = LEARNING_STEPS.length; // review'e geç
    else if (quality === 3) step = card.step + 1;
    // Hard → aynı step

    if (step >= LEARNING_STEPS.length) {
      return { value: quality === 4 ? 4 : 1, unit: "gün" };
    }
    const minutes = LEARNING_STEPS[step];
    if (minutes < 60) return { value: minutes,       unit: "dk" };
    else              return { value: minutes / 60,   unit: "sa" };
  }

  // Review phase preview (SM-2)
  const qMap = { 1: 0, 2: 2, 3: 4, 4: 5 };
  const q    = qMap[quality] ?? 0;
  if (q < 3) {
    return { value: LEARNING_STEPS[0], unit: "dk" }; // geri learning'e
  }

  let interval = card.interval;
  if (card.repetitions <= 1)      interval = card.repetitions === 0 ? 1 : 6;
  else interval = Math.round(interval * card.easeFactor);
  if (quality === 4) interval = Math.round(interval * 1.3);
  return { value: Math.max(1, interval), unit: "gün" };
}

function formatPreview({ value, unit }) {
  return `~${value} ${unit}`;
}

/* ══════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════ */
let state = {
  userId:         null,
  allWords:       [],
  allLists:       [],
  activeWords:    [],
  quizSource:     "all",
  selectedListId: null,
  totalCount:     15,
  order:          "srs",

  // Session
  deck:      [],
  deckIndex: 0,
  flipped:   false,
  ratings:   { 1: 0, 2: 0, 3: 0, 4: 0 },
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
    state.userId      = null;
    state.allWords    = [];
    state.allLists    = [];
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

    state.allWords = rawWords
      .map(d => ({
        id:       d.id,
        word:     String(d.word    || "").trim(),
        meaning:  String(d.meaning || "").trim(),
        tags:     Array.isArray(d.tags) ? d.tags : [],
        meanings: Array.isArray(d.meanings) && d.meanings.length
          ? d.meanings
          : [String(d.meaning || "").trim()],
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
  const el   = $("loginCard");
  const body = $("setupBody");
  if (el)   el.style.display   = show ? "flex" : "none";
  if (body) body.style.display = show ? "none"  : "block";
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
  if (btn) btn.disabled = state.activeWords.length < 1;
}

function resetSetupUI() {
  const el = $("wordCountInfo");
  if (el) el.innerHTML = "—";
  const srs = $("setupSRSStrip");
  if (srs) srs.style.display = "none";
}

/* ══════════════════════════════════════════════════
   SRS STRIP — Setup ekranında özet
══════════════════════════════════════════════════ */
function updateSetupSRSStrip() {
  const strip = $("setupSRSStrip");
  if (!state.userId || !state.activeWords.length) {
    if (strip) strip.style.display = "none";
    return;
  }
  if (strip) strip.style.display = "grid";

  let newC = 0, learningC = 0, dueC = 0, learnedC = 0;
  state.activeWords.forEach(w => {
    const s = getCardStatus(state.userId, w.id);
    if      (s === "new")      newC++;
    else if (s === "learning") learningC++;
    else if (s === "due")      dueC++;
    else                       learnedC++;
  });

  // Bugün çalışılacak: yeni + learning + due
  const todayCount = newC + learningC + dueC;

  setNum("srsNew",     newC);
  setNum("srsDue",     dueC + learningC); // learning + due = "tekrar"
  setNum("srsDone",    learnedC);
  setNum("srsToday",   todayCount);
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
  grid.innerHTML     = "";

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
    state.quizSource     = "all";
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
  ["orderSRS", "orderShuffle", "orderAlpha"].forEach(id => {
    $(id)?.addEventListener("click", () => {
      state.order = id.replace("order", "").toLowerCase();
      ["orderSRS", "orderShuffle", "orderAlpha"].forEach(bid => {
        $(bid)?.classList.toggle("active", bid === id);
      });
    });
  });
}

/* ══════════════════════════════════════════════════
   BUILD DECK
   Öncelik: learning → due → new → learned
══════════════════════════════════════════════════ */
function buildDeck() {
  const pool  = [...state.activeWords];
  const count = Math.min(state.totalCount, pool.length);

  if (state.order === "srs") {
    const learning = pool.filter(w => getCardStatus(state.userId, w.id) === "learning");
    const due      = pool.filter(w => getCardStatus(state.userId, w.id) === "due");
    const newW     = pool.filter(w => getCardStatus(state.userId, w.id) === "new");
    const learned  = pool.filter(w => getCardStatus(state.userId, w.id) === "learned");
    return [
      ...shuffle(learning),
      ...shuffle(due),
      ...shuffle(newW),
      ...shuffle(learned),
    ].slice(0, count);
  }

  if (state.order === "alpha") {
    return [...pool].sort((a, b) => a.word.localeCompare(b.word, "de")).slice(0, count);
  }

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

  const card    = state.deck[state.deckIndex];
  state.flipped = false;

  const fcCard = $("fcCard");
  if (fcCard) fcCard.classList.remove("flipped");

  // Ön yüz
  const frontWord = $("fcFrontWord");
  if (frontWord) frontWord.textContent = card.word;

  // Arka yüz
  // Arka yüz içeriğini flip animasyonu bittikten SONRA güncelle
  // --flip: 0.55s → 560ms bekle
  setTimeout(() => {
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
  }, 560); // CSS --flip süresiyle eşleşmeli

  // Kart numarası
  const cardNum = $("fcCardNum");
  if (cardNum) cardNum.textContent = `${state.deckIndex + 1} / ${state.deck.length}`;

  // Kart durumu etiketi (learning / review / new)
  updateCardStatusBadge(card);

  // Rating gizle
  const ratingWrap = $("ratingWrap");
  if (ratingWrap) ratingWrap.classList.remove("visible");

  // Progress
  updateStudyProgress();

  // Preview süreler
  updateRatePreviews(card.id);

  // Session stats
  updateSessionStats();

  // Sahneyi yeniden aktif et
  const scene = $("fcScene");
  if (scene) scene.style.pointerEvents = "auto";
}

/* ── Kart durum etiketi (ön yüzde küçük badge) ── */
function updateCardStatusBadge(card) {
  let badge = $("fcStatusBadge");
  if (!badge) return;

  const status = getCardStatus(state.userId, card.id);
  const labels = {
    new:      { text: "🆕 Yeni",       cls: "badge-new"      },
    learning: { text: "📖 Öğreniliyor", cls: "badge-learning" },
    due:      { text: "⏰ Tekrar",      cls: "badge-due"      },
    learned:  { text: "✅ Öğrenildi",   cls: "badge-learned"  },
  };
  const info = labels[status] || labels.new;
  badge.textContent = info.text;
  badge.className   = "fc-status-badge " + info.cls;
}

/* ══════════════════════════════════════════════════
   FLIP CARD
══════════════════════════════════════════════════ */
function flipCard() {
  if (state.flipped) return;
  state.flipped = true;

  const fcCard = $("fcCard");
  if (fcCard) fcCard.classList.add("flipped");

  setTimeout(() => {
    const ratingWrap = $("ratingWrap");
    if (ratingWrap) ratingWrap.classList.add("visible");
    const scene = $("fcScene");
    if (scene) scene.style.pointerEvents = "none";
  }, 320);
}

/* ══════════════════════════════════════════════════
   RATE CARD
   Again (1) → deck'in sonuna eklenir, seans içinde tekrar gelir
══════════════════════════════════════════════════ */
function rateCard(quality) {
  if (!state.flipped) return;
  const card = state.deck[state.deckIndex];

  updateCard(state.userId, card.id, quality);
  state.ratings[quality]++;

  // Again → kartı deck'in sonuna ekle (aynı seansta tekrar görünür)
  if (quality === 1) {
    state.deck.push({ ...card });
  }

  state.deckIndex++;
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
  const pct  = state.deck.length > 0 ? (state.deckIndex / state.deck.length) * 100 : 0;
  const fill = $("studyProgressFill");
  if (fill) fill.style.width = pct + "%";
  const label = $("studyProgressLabel");
  if (label) label.textContent = `${state.deckIndex + 1} / ${state.deck.length}`;
}

function updateSessionStats() {
  const done      = state.deckIndex;
  const remaining = state.deck.length - done;

  let newR = 0, dueR = 0, learningR = 0;
  for (let i = done; i < state.deck.length; i++) {
    const s = getCardStatus(state.userId, state.deck[i].id);
    if      (s === "new")      newR++;
    else if (s === "due")      dueR++;
    else if (s === "learning") learningR++;
  }

  const row = $("sessionStats");
  if (!row) return;
  row.innerHTML = "";
  if (learningR) row.innerHTML += `<span class="ss-pip learning">${learningR} öğrenme</span>`;
  if (dueR)      row.innerHTML += `<span class="ss-pip due">${dueR} tekrar</span>`;
  if (newR)      row.innerHTML += `<span class="ss-pip new">${newR} yeni</span>`;
  if (done)      row.innerHTML += `<span class="ss-pip done">${done} tamam</span>`;
}

/* ══════════════════════════════════════════════════
   PREVIEW SÜRELER (buton altında gösterir)
══════════════════════════════════════════════════ */
function updateRatePreviews(wordId) {
  [1, 2, 3, 4].forEach(q => {
    const el = $("rateDay" + q);
    if (!el) return;
    const preview = previewNextReview(state.userId, wordId, q);
    el.textContent = formatPreview(preview);
  });
}

/* ══════════════════════════════════════════════════
   RESULT SCREEN
══════════════════════════════════════════════════ */
function showResult() {
  const total   = state.ratings[1] + state.ratings[2] + state.ratings[3] + state.ratings[4];
  const correct = state.ratings[3] + state.ratings[4];
  const pct     = total > 0 ? Math.round((correct / total) * 100) : 0;

  let emoji, title, msg;
  if      (pct === 100) { emoji="🏆"; title="Mükemmel!";        msg="Tüm kartları doğru yanıtladın. Muhteşem bir seans!"; }
  else if (pct >= 80)   { emoji="🎉"; title="Harika!";           msg="Çok başarılı bir performans. Böyle devam!"; }
  else if (pct >= 60)   { emoji="👍"; title="İyi İş!";           msg="Biraz daha pratikle mükemmel olacak."; }
  else if (pct >= 40)   { emoji="📚"; title="Çalışmaya Devam!"; msg="Bu kelimeleri bir kez daha gözden geçir."; }
  else                  { emoji="💪"; title="Devam Et!";         msg="Her tekrar seni ileriye taşıyor. Pes etme!"; }

  $("resultEmoji")  && ($("resultEmoji").textContent  = emoji);
  $("resultTitle")  && ($("resultTitle").textContent  = title);
  $("resultScore")  && ($("resultScore").textContent  = `${correct} / ${total}`);
  $("resultMsg")    && ($("resultMsg").textContent    = msg);

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

  // SRS özet notu
  const words    = state.activeWords;
  const dueNow   = words.filter(w => {
    const s = getCardStatus(state.userId, w.id);
    return s === "due" || s === "learning";
  }).length;
  const learned  = words.filter(w => getCardStatus(state.userId, w.id) === "learned").length;

  const note = $("resultSrsNote");
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
    if ($("screen-study")?.classList.contains("hidden")) return;
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
  $("fcScene")?.addEventListener("click", () => flipCard());
  $("fcScene")?.setAttribute("tabindex", "0");
  $("fcScene")?.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flipCard(); }
  });

  [1, 2, 3, 4].forEach(q => {
    $("rateBtn" + q)?.addEventListener("click", () => rateCard(q));
  });

  $("btnStart")?.addEventListener("click", startSession);
  $("btnRestart")?.addEventListener("click", startSession);
  $("btnHome")?.addEventListener("click", () => showScreen("setup"));
  $("btnBackStudy")?.addEventListener("click", () => showScreen("setup"));

  initSourceTabs();
  initStepper();
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
  showScreen("setup");
});