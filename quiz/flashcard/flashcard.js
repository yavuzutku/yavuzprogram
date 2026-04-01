/**
 * AlmancaPratik — Flashcard System v4.0
 * File: quiz/flashcard/flashcard.js
 *
 * Yenilikler v4:
 *  - TTS  : Kart açıldığında Almanca kelime otomatik okunur (de-DE)
 *           Replay butonu (R kısayolu) ile tekrar dinlenebilir
 *           Topbar'da ses açma/kapama toggle'ı
 *  - Timer: Seans kronometresi (MM:SS)
 *  - Bury : Kartı bu seanstan çıkar (B kısayolu)
 *  - Info : Kart SRS verilerini göster (I kısayolu)
 *  - Heatmap: Sonuç ekranında 30 günlük aktivite haritası
 *  - Streak : Sonuç ekranında ardışık çalışma serisi
 *
 *  SRS Sistemi (değişmedi):
 *  - Learning Phase  : Yeni / hatalı kartlar dakika bazlı tekrar (1dk → 10dk → 60dk)
 *  - Review Phase    : SM-2 algoritması ile gün bazlı uzun vadeli tekrar
 */

import { getWords, onAuthChange }   from "../../js/firebase.js";
import { getListeler }              from "../../js/listeler-firebase.js";

/* ══════════════════════════════════════════════════
   LEARNING STEPS (dakika)
══════════════════════════════════════════════════ */
const LEARNING_STEPS = [1, 10, 60];

/* ══════════════════════════════════════════════════
   SRS STORAGE
══════════════════════════════════════════════════ */
const SRS_VERSION = "ap_srs_v4";

function srsKey(userId) { return `${SRS_VERSION}_${userId}`; }

function getSRSStore(userId) {
  try { return JSON.parse(localStorage.getItem(srsKey(userId)) || "{}"); }
  catch { return {}; }
}

function saveSRSStore(userId, data) {
  try { localStorage.setItem(srsKey(userId), JSON.stringify(data)); }
  catch (e) { console.warn("SRS save error:", e); }
}

function defaultCard() {
  return {
    state: "new", step: 0, interval: 1,
    repetitions: 0, easeFactor: 2.5,
    nextReview: 0, reviewCount: 0, lastReviewed: null,
  };
}

function getCard(userId, wordId) {
  const store = getSRSStore(userId);
  const saved = store[wordId];
  if (!saved) return defaultCard();
  if (!saved.state) {
    saved.state = saved.repetitions > 0 ? "review" : "new";
    saved.step  = 0;
  }
  return saved;
}

/* ══════════════════════════════════════════════════
   LEARNING PHASE
══════════════════════════════════════════════════ */
function handleLearning(card, quality) {
  if (quality === 1) {
    card.step = 0;
  } else if (quality === 4) {
    card.step = LEARNING_STEPS.length;
  } else {
    if (quality === 3) card.step++;
  }

  if (card.step >= LEARNING_STEPS.length) {
    card.state       = "review";
    card.repetitions = 1;
    card.interval    = quality === 4 ? 4 : 1;
    card.nextReview  = Date.now() + card.interval * 86_400_000;
  } else {
    card.state      = "learning";
    const minutes   = LEARNING_STEPS[card.step];
    card.nextReview = Date.now() + minutes * 60_000;
  }
}

/* ══════════════════════════════════════════════════
   SM-2 REVIEW PHASE
══════════════════════════════════════════════════ */
function handleReviewSM2(card, quality) {
  const qMap = { 1: 0, 2: 2, 3: 4, 4: 5 };
  const q    = qMap[quality] ?? 0;

  if (q < 3) {
    card.state       = "learning";
    card.step        = 0;
    card.repetitions = 0;
    card.interval    = 1;
    card.nextReview  = Date.now() + LEARNING_STEPS[0] * 60_000;
  } else {
    if (card.repetitions <= 1) {
      card.interval = card.repetitions === 0 ? 1 : 6;
    } else {
      card.interval = Math.round(card.interval * card.easeFactor);
    }
    if (quality === 4) card.interval = Math.round(card.interval * 1.3);
    card.repetitions++;
    card.nextReview = Date.now() + card.interval * 86_400_000;
  }

  card.easeFactor = Math.max(
    1.3,
    card.easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
  );
}

/* ══════════════════════════════════════════════════
   UPDATE CARD
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
   CARD STATUS
══════════════════════════════════════════════════ */
function getCardStatus(userId, wordId) {
  const c = getCard(userId, wordId);
  if (c.state === "new")                          return "new";
  if (c.state === "learning")                     return "learning";
  if (c.state === "review" && c.nextReview <= Date.now()) return "due";
  if (c.state === "review" && c.nextReview >  Date.now()) return "learned";
  if (c.repetitions === 0 && c.reviewCount === 0)  return "new";
  if (c.nextReview <= Date.now())                   return "due";
  return "learned";
}

/* ══════════════════════════════════════════════════
   PREVIEW NEXT REVIEW
══════════════════════════════════════════════════ */
function previewNextReview(userId, wordId, quality) {
  const card = getCard(userId, wordId);

  if (card.state !== "review") {
    let step = card.step;
    if (quality === 1) step = 0;
    else if (quality === 4) step = LEARNING_STEPS.length;
    else if (quality === 3) step = card.step + 1;

    if (step >= LEARNING_STEPS.length) {
      return { value: quality === 4 ? 4 : 1, unit: "gün" };
    }
    const minutes = LEARNING_STEPS[step];
    if (minutes < 60) return { value: minutes,     unit: "dk"  };
    else              return { value: minutes / 60, unit: "sa"  };
  }

  const qMap = { 1: 0, 2: 2, 3: 4, 4: 5 };
  const q    = qMap[quality] ?? 0;
  if (q < 3) return { value: LEARNING_STEPS[0], unit: "dk" };

  let interval = card.interval;
  if (card.repetitions <= 1) interval = card.repetitions === 0 ? 1 : 6;
  else interval = Math.round(interval * card.easeFactor);
  if (quality === 4) interval = Math.round(interval * 1.3);
  return { value: Math.max(1, interval), unit: "gün" };
}

function formatPreview({ value, unit }) {
  return `~${value} ${unit}`;
}

/* ══════════════════════════════════════════════════
   TTS — TEXT TO SPEECH
══════════════════════════════════════════════════ */
let ttsEnabled = true;
let ttsVoices  = [];

function loadVoices() {
  ttsVoices = window.speechSynthesis?.getVoices() || [];
}

if (window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
}

async function speakWord(text, lang = "de-DE") {
  if (!ttsEnabled || !window.speechSynthesis || !text) return;

  // Önceki konuşmayı durdur
  window.speechSynthesis.cancel();

  const utt = new SpeechSynthesisUtterance(text);
  utt.lang  = lang;
  utt.rate  = 0.82;
  utt.pitch = 1.0;

  // Almanca ses ara
  const germanVoice = ttsVoices.find(v =>
    v.lang.toLowerCase().startsWith("de")
  );
  if (germanVoice) utt.voice = germanVoice;

  // Replay buton animasyonu
  const replayBtn = $("ttsReplay");
  if (replayBtn) replayBtn.classList.add("speaking");

  utt.onend  = () => replayBtn?.classList.remove("speaking");
  utt.onerror = () => replayBtn?.classList.remove("speaking");

  window.speechSynthesis.speak(utt);
}

function toggleTTS() {
  ttsEnabled = !ttsEnabled;
  const btn = $("ttsToggle");
  if (!btn) return;
  if (ttsEnabled) {
    btn.classList.remove("tts-off");
    btn.classList.add("active");
    btn.title = "Sesi kapat";
  } else {
    btn.classList.add("tts-off");
    btn.classList.remove("active");
    btn.title = "Sesi aç";
    window.speechSynthesis?.cancel();
    $("ttsReplay")?.classList.remove("speaking");
  }
}

/* ══════════════════════════════════════════════════
   SESSION TIMER
══════════════════════════════════════════════════ */
let sessionStartTime = null;
let timerInterval    = null;

function startTimer() {
  sessionStartTime = Date.now();
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function updateTimer() {
  const el = $("sessionTimer");
  if (!el || !sessionStartTime) return;
  const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
  const m = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");
  el.textContent = `${m}:${s}`;
}

/* ══════════════════════════════════════════════════
   BURY CARD — Bu seanstan çıkar
══════════════════════════════════════════════════ */
function buryCard() {
  // Sadece kart görünürken (henüz rating yapılmamışken) çalışır
  state.deck.splice(state.deckIndex, 1);
  if (state.deck.length === 0 || state.deckIndex >= state.deck.length) {
    showResult();
  } else {
    renderCard();
  }
}

/* ══════════════════════════════════════════════════
   CARD INFO PANEL
══════════════════════════════════════════════════ */
function toggleCardInfo() {
  const panel = $("cardInfoPanel");
  if (!panel) return;

  const isVisible = panel.classList.contains("visible");
  if (isVisible) {
    panel.classList.remove("visible");
    $("infoBtn")?.classList.remove("active");
    return;
  }

  // Mevcut kartın SRS verilerini doldur
  if (state.deckIndex < state.deck.length) {
    const card    = state.deck[state.deckIndex];
    const srsCard = getCard(state.userId, card.id);
    const status  = getCardStatus(state.userId, card.id);

    // Sonraki tekrar
    let nextStr = "—";
    if (srsCard.nextReview && srsCard.nextReview > 0) {
      const diff = srsCard.nextReview - Date.now();
      if (diff <= 0) {
        nextStr = "Şimdi (gecikmiş)";
      } else {
        const days  = Math.floor(diff / 86_400_000);
        const hours = Math.floor((diff % 86_400_000) / 3_600_000);
        const mins  = Math.floor((diff % 3_600_000) / 60_000);
        if (days > 0)       nextStr = `${days} gün sonra`;
        else if (hours > 0) nextStr = `${hours} saat sonra`;
        else                nextStr = `${mins} dk sonra`;
      }
    }

    const statusLabels = {
      new:      "Yeni",
      learning: "Öğreniliyor",
      due:      "Tekrar Bekliyor",
      learned:  "Öğrenildi",
    };
    const statusClasses = {
      new:      "cip-state-new",
      learning: "cip-state-learning",
      due:      "cip-state-due",
      learned:  "cip-state-learned",
    };

    const stateEl = $("infoState");
    if (stateEl) {
      stateEl.textContent = statusLabels[status] || "—";
      stateEl.className   = statusClasses[status] || "";
    }

    const intervalStr = srsCard.state === "review"
      ? `${srsCard.interval} gün`
      : srsCard.state === "learning"
        ? `${LEARNING_STEPS[srsCard.step] || 1} dk`
        : "—";

    setInfoField("infoInterval", intervalStr);
    setInfoField("infoEase",     `${Math.round(srsCard.easeFactor * 100)}%`);
    setInfoField("infoReviews",  `${srsCard.reviewCount || 0}`);
    setInfoField("infoNext",     nextStr);
  }

  panel.classList.add("visible");
  $("infoBtn")?.classList.add("active");
}

function setInfoField(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}

/* ══════════════════════════════════════════════════
   STREAK
══════════════════════════════════════════════════ */
function computeStreak(userId) {
  const store = getSRSStore(userId);
  const daySet = new Set();

  Object.values(store).forEach(card => {
    if (card.lastReviewed) {
      const d = new Date(card.lastReviewed);
      daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  });

  if (!daySet.size) return 0;

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (daySet.has(key)) {
      streak++;
    } else if (i > 0) {
      // i=0 bugün — bugün henüz giriş olmasa da devam et
      // i>0 boşluk varsa dur
      break;
    }
  }
  return streak;
}

/* ══════════════════════════════════════════════════
   HEATMAP DATA
══════════════════════════════════════════════════ */
function generateHeatmapData(userId, days = 30) {
  const store  = getSRSStore(userId);
  const counts = {};

  Object.values(store).forEach(card => {
    if (card.lastReviewed) {
      const d = new Date(card.lastReviewed);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  });

  const result = [];
  const today  = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    result.push({ date: key, count: counts[key] || 0 });
  }

  return result;
}

function renderHeatmap(userId) {
  const grid      = $("heatmapGrid");
  const container = $("resultHeatmap");
  if (!grid || !container) return;

  const data    = generateHeatmapData(userId, 30);
  const maxVal  = Math.max(...data.map(d => d.count), 1);
  container.style.display = "block";
  grid.innerHTML = "";

  data.forEach(({ date, count }) => {
    const cell       = document.createElement("div");
    cell.className   = "hm-cell";

    // Seviye hesapla
    if (count > 0) {
      const ratio = count / maxVal;
      if      (ratio <= 0.25) cell.classList.add("lv-1");
      else if (ratio <= 0.50) cell.classList.add("lv-2");
      else if (ratio <= 0.75) cell.classList.add("lv-3");
      else                    cell.classList.add("lv-4");
    }

    // Tooltip
    const [y, m, d] = date.split("-");
    const label = `${d}.${m} — ${count} tekrar`;
    cell.setAttribute("data-tooltip", label);
    cell.setAttribute("title", label);

    grid.appendChild(cell);
  });
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
  deck:           [],
  deckIndex:      0,
  flipped:        false,
  ratings:        { 1: 0, 2: 0, 3: 0, 4: 0 },
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

  if (name === "study") {
    // nothing
  } else {
    stopTimer();
    window.speechSynthesis?.cancel();
    $("ttsReplay")?.classList.remove("speaking");
    window.scrollTo(0, 0);
  }
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
   SRS STRIP
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

  const todayCount = newC + learningC + dueC;
  setNum("srsNew",   newC);
  setNum("srsDue",   dueC + learningC);
  setNum("srsDone",  learnedC);
  setNum("srsToday", todayCount);
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
    const item      = document.createElement("div");
    item.className  = "list-item" + (state.selectedListId === liste.id ? " selected" : "");
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

  // Timer sıfırla
  const timerEl = $("sessionTimer");
  if (timerEl) timerEl.textContent = "00:00";

  showScreen("study");
  startTimer();
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

  // Kart info panelini kapat
  $("cardInfoPanel")?.classList.remove("visible");
  $("infoBtn")?.classList.remove("active");

  // Flip sıfırla
  const fcCard = $("fcCard");
  if (fcCard) fcCard.classList.remove("flipped");

  // Ön yüz
  const frontWord = $("fcFrontWord");
  if (frontWord) frontWord.textContent = card.word;

  // Arka yüzü animasyon bittikten sonra güncelle
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
  }, 540);

  // Kart numarası
  const cardNum = $("fcCardNum");
  if (cardNum) cardNum.textContent = `${state.deckIndex + 1} / ${state.deck.length}`;

  // Status badge
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

  // Replay butonu data attribute
  const replayBtn = $("ttsReplay");
  if (replayBtn) replayBtn.setAttribute("data-word", card.word || "");

  // Scene tekrar aktif et
  const scene = $("fcScene");
  if (scene) scene.style.pointerEvents = "auto";

  // Otomatik TTS — Almanca kelimeyi oku
  speakWord(card.word, "de-DE");
}

/* ── Status Badge ── */
function updateCardStatusBadge(card) {
  const badge = $("fcStatusBadge");
  if (!badge) return;

  const status = getCardStatus(state.userId, card.id);
  const labels = {
    new:      { text: "Yeni",          cls: "badge-new"      },
    learning: { text: "Öğreniliyor",   cls: "badge-learning" },
    due:      { text: "Tekrar",        cls: "badge-due"      },
    learned:  { text: "Öğrenildi",     cls: "badge-learned"  },
  };
  const info    = labels[status] || labels.new;
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
  }, 300);
}

/* ══════════════════════════════════════════════════
   RATE CARD
══════════════════════════════════════════════════ */
function rateCard(quality) {
  if (!state.flipped) return;
  const card = state.deck[state.deckIndex];

  updateCard(state.userId, card.id, quality);
  state.ratings[quality]++;

  // Again → deck sonuna ekle
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
  const done = state.deckIndex;
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
   PREVIEW SÜRELER
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
  stopTimer();

  const total   = Object.values(state.ratings).reduce((a, b) => a + b, 0);
  const correct = state.ratings[3] + state.ratings[4];
  const pct     = total > 0 ? Math.round((correct / total) * 100) : 0;

  let title, msg;
  if      (pct === 100) { title = "Mükemmel!";       msg = "Tüm kartları doğru yanıtladın. İnanılmaz bir seans!"; }
  else if (pct >= 80)   { title = "Çok İyi!";         msg = "Yüksek başarı oranıyla seans tamamlandı."; }
  else if (pct >= 60)   { title = "İyi İş!";          msg = "Biraz daha pratikle mükemmel olacak."; }
  else if (pct >= 40)   { title = "Çalışmaya Devam!"; msg = "Bu kelimeleri bir kez daha gözden geçir."; }
  else                  { title = "Devam Et!";         msg = "Her tekrar seni ileriye taşıyor."; }

  const titleEl = $("resultTitle");
  const scoreEl = $("resultScore");
  const msgEl   = $("resultMsg");
  if (titleEl) titleEl.textContent = title;
  if (scoreEl) scoreEl.textContent = `${correct} / ${total}`;
  if (msgEl)   msgEl.textContent   = msg;

  const bd = $("resultBreakdown");
  if (bd) {
    bd.innerHTML = `
      <div class="rb-cell"><span class="rb-num again">${state.ratings[1]}</span><span class="rb-label">Tekrar</span></div>
      <div class="rb-cell"><span class="rb-num hard">${state.ratings[2]}</span><span class="rb-label">Zor</span></div>
      <div class="rb-cell"><span class="rb-num good">${state.ratings[3]}</span><span class="rb-label">İyi</span></div>
      <div class="rb-cell"><span class="rb-num easy">${state.ratings[4]}</span><span class="rb-label">Kolay</span></div>`;
  }

  // SRS özet
  const words   = state.activeWords;
  const dueNow  = words.filter(w => {
    const s = getCardStatus(state.userId, w.id);
    return s === "due" || s === "learning";
  }).length;
  const learned = words.filter(w => getCardStatus(state.userId, w.id) === "learned").length;

  const note = $("resultSrsNote");
  if (note) {
    note.innerHTML = `
      Seans tamamlandı. Öğrenilen: <strong>${learned}</strong> kelime &nbsp;·&nbsp;
      Tekrar bekleyen: <strong style="color:var(--rel)">${dueNow}</strong> kelime.
      ${dueNow > 0 ? "<br>Tekrar bekleyen kelimeler için yeni bir seans başlatabilirsin." : ""}`;
  }

  // Streak
  const streak    = computeStreak(state.userId);
  const streakEl  = $("resultStreak");
  const streakNum = $("streakDays");
  if (streakEl && streakNum) {
    if (streak > 1) {
      streakNum.textContent   = streak;
      streakEl.style.display  = "inline-flex";
    } else {
      streakEl.style.display  = "none";
    }
  }

  // Heatmap
  renderHeatmap(state.userId);

  showScreen("result");
}

/* ══════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
══════════════════════════════════════════════════ */
function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    if ($("screen-study")?.classList.contains("hidden")) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    // Kartı çevir
    if (e.code === "Space" || e.code === "ArrowRight") {
      e.preventDefault();
      flipCard();
      return;
    }

    // Yeniden oku
    if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      const btn = $("ttsReplay");
      const word = btn?.getAttribute("data-word") || "";
      if (word) speakWord(word, "de-DE");
      return;
    }

    // Bury / skip
    if (e.key === "b" || e.key === "B") {
      e.preventDefault();
      if (!state.flipped) buryCard();
      return;
    }

    // Kart bilgisi
    if (e.key === "i" || e.key === "I") {
      e.preventDefault();
      toggleCardInfo();
      return;
    }

    // Rating
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
  // Kart flip
  $("fcScene")?.addEventListener("click", () => flipCard());
  $("fcScene")?.setAttribute("tabindex", "0");
  $("fcScene")?.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flipCard(); }
  });

  // Rating buttons
  [1, 2, 3, 4].forEach(q => {
    $("rateBtn" + q)?.addEventListener("click", () => rateCard(q));
  });

  // TTS Replay
  $("ttsReplay")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const word = e.currentTarget.getAttribute("data-word") || "";
    if (word) speakWord(word, "de-DE");
  });

  // TTS Toggle
  $("ttsToggle")?.addEventListener("click", toggleTTS);

  // Card Info
  $("infoBtn")?.addEventListener("click", toggleCardInfo);

  // Bury
  $("buryBtn")?.addEventListener("click", () => {
    if (!state.flipped) buryCard();
  });

  // Nav buttons
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
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  initEvents();
  initKeyboard();
  showScreen("setup");
});