import { getWords, onAuthChange } from "../js/firebase.js";

// ── STATE ─────────────────────────────────────────────
let allWords   = [];   // { word, meaning }
let questions  = [];   // üretilmiş sorular
let current    = 0;
let score      = 0;
let wrongList  = [];
let totalCount = 10;

// ── SCREENS ───────────────────────────────────────────
const screens = {
  start:   document.getElementById('screen-start'),
  loading: document.getElementById('screen-loading'),
  quiz:    document.getElementById('screen-quiz'),
  result:  document.getElementById('screen-result'),
};

function show(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

// ── STEPPER ───────────────────────────────────────────
const countVal  = document.getElementById('countVal');
const countDown = document.getElementById('countDown');
const countUp   = document.getElementById('countUp');

countDown.addEventListener('click', () => {
  if (totalCount > 5) { totalCount -= 5; countVal.textContent = totalCount; }
});
countUp.addEventListener('click', () => {
  if (totalCount < 50) { totalCount += 5; countVal.textContent = totalCount; }
});

// ── AUTH + KELİME YÜKLE ───────────────────────────────
let userId = null;

onAuthChange(async (user) => {
  if (!user) return;
  userId = user.uid;

  show('loading');
  try {
    const data = await getWords(userId);
    allWords = data.map(d => ({ word: d.word, meaning: d.meaning }))
                   .filter(d => d.word && d.meaning);

    const info = document.getElementById('wordCountInfo');
    info.textContent = `Sözlüğünde ${allWords.length} kelime var.`;
    show('start');
  } catch (e) {
    console.error(e);
    show('start');
  }
});

// ── BAŞLAT ────────────────────────────────────────────
document.getElementById('startBtn').addEventListener('click', () => {
  if (allWords.length < 4) {
    alert('Quiz için en az 4 kelime gerekli. Önce kelime ekle!');
    return;
  }
  buildQuestions();
  current = 0;
  score   = 0;
  wrongList = [];
  show('quiz');
  renderQuestion();
});

// ── SORU ÜRETİCİ ─────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestions() {
  const pool  = shuffle(allWords);
  const count = Math.min(totalCount, pool.length);
  questions   = [];

  for (let i = 0; i < count; i++) {
    const item      = pool[i];
    const direction = Math.random() < 0.5 ? 'de-tr' : 'tr-de';
    const mode      = Math.random() < 0.6 ? 'multiple' : 'typing';

    const question = direction === 'de-tr' ? item.word    : item.meaning;
    const answer   = direction === 'de-tr' ? item.meaning : item.word;

    let choices = null;
    if (mode === 'multiple') {
      // 3 yanlış şık üret
      const wrongs = shuffle(
        allWords
          .filter(w => w !== item)
          .map(w => direction === 'de-tr' ? w.meaning : w.word)
      ).slice(0, 3);
      choices = shuffle([answer, ...wrongs]);
    }

    questions.push({ question, answer, direction, mode, choices });
  }
}

// ── SORU RENDER ───────────────────────────────────────
function renderQuestion() {
  const q = questions[current];

  // Progress
  const pct = (current / questions.length) * 100;
  document.getElementById('progressFill').style.width  = pct + '%';
  document.getElementById('progressLabel').textContent = `${current + 1} / ${questions.length}`;
  document.getElementById('scoreBadge').textContent    = `✓ ${score}`;

  // Kart
  document.getElementById('qDirection').textContent =
    q.direction === 'de-tr' ? 'Almanca → Türkçe' : 'Türkçe → Almanca';
  document.getElementById('qWord').textContent = q.question;

  const modeTag = document.getElementById('qModeTag');
  if (q.mode === 'multiple') {
    modeTag.textContent = 'Çoktan Seçmeli';
    modeTag.className   = 'q-mode-tag multiple';
  } else {
    modeTag.textContent = 'Yazarak Cevapla';
    modeTag.className   = 'q-mode-tag typing';
  }

  // Alanları sıfırla
  hideFeedback();

  const choicesGrid = document.getElementById('choicesGrid');
  const typeArea    = document.getElementById('typeArea');
  const typeInput   = document.getElementById('typeInput');

  if (q.mode === 'multiple') {
    choicesGrid.classList.remove('hidden');
    typeArea.classList.add('hidden');
    buildChoices(q);
  } else {
    choicesGrid.classList.add('hidden');
    typeArea.classList.remove('hidden');
    typeInput.value    = '';
    typeInput.disabled = false;
    typeInput.className = '';
    document.getElementById('checkBtn').disabled = false;
    setTimeout(() => typeInput.focus(), 100);
  }
}

// ── ÇOKTAN SEÇMELİ ────────────────────────────────────
function buildChoices(q) {
  const grid = document.getElementById('choicesGrid');
  grid.innerHTML = '';

  q.choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className   = 'choice-btn';
    btn.textContent = choice;
    btn.addEventListener('click', () => handleChoice(choice, q.answer, grid));
    grid.appendChild(btn);
  });
}

function handleChoice(chosen, correct, grid) {
  const btns = grid.querySelectorAll('.choice-btn');
  btns.forEach(b => {
    b.disabled = true;
    if (b.textContent === correct) b.classList.add('correct');
    if (b.textContent === chosen && chosen !== correct) b.classList.add('wrong');
  });

  const isCorrect = chosen === correct;
  if (isCorrect) score++;
  else wrongList.push(questions[current]);

  showFeedback(isCorrect, correct);
}

// ── YAZARAK CEVAPLAMA ─────────────────────────────────
document.getElementById('checkBtn').addEventListener('click', checkTyping);
document.getElementById('typeInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') checkTyping();
});

function normalize(str) {
  return str.trim().toLowerCase()
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
    .replace(/[^a-z0-9\s]/g, '');
}

function checkTyping() {
  const q      = questions[current];
  const input  = document.getElementById('typeInput');
  const val    = input.value.trim();
  if (!val) return;

  const isCorrect = normalize(val) === normalize(q.answer);
  input.disabled  = true;
  document.getElementById('checkBtn').disabled = true;
  input.classList.add(isCorrect ? 'correct' : 'wrong');

  if (isCorrect) score++;
  else {
    wrongList.push(questions[current]);
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 400);
  }

  showFeedback(isCorrect, q.answer);
}

// ── FEEDBACK ──────────────────────────────────────────
function showFeedback(isCorrect, correct) {
  const fb     = document.getElementById('feedback');
  const icon   = document.getElementById('feedbackIcon');
  const text   = document.getElementById('feedbackText');

  fb.classList.remove('hidden', 'correct-fb', 'wrong-fb');
  fb.classList.add(isCorrect ? 'correct-fb' : 'wrong-fb');

  if (isCorrect) {
    icon.textContent = '✅';
    text.innerHTML   = '<strong>Doğru!</strong> Harika gidiyor.';
  } else {
    icon.textContent = '❌';
    text.innerHTML   = `<strong>Yanlış.</strong> Doğru cevap: <strong style="color:#f0ede8">${correct}</strong>`;
  }
}

function hideFeedback() {
  document.getElementById('feedback').classList.add('hidden');
}

// ── SONRAKİ SORU ──────────────────────────────────────
document.getElementById('nextBtn').addEventListener('click', () => {
  current++;
  if (current >= questions.length) {
    showResult();
  } else {
    renderQuestion();
  }
});

// ── SONUÇ ─────────────────────────────────────────────
function showResult() {
  show('result');

  const total   = questions.length;
  const correct = score;
  const wrong   = total - correct;
  const pct     = Math.round((correct / total) * 100);

  // Emoji & mesaj
  let emoji, title, msg;
  if (pct === 100)      { emoji = '🏆'; title = 'Mükemmel!';    msg = 'Tüm soruları doğru yanıtladın!'; }
  else if (pct >= 80)   { emoji = '🎉'; title = 'Harika!';       msg = 'Çok başarılı bir performans!'; }
  else if (pct >= 60)   { emoji = '👍'; title = 'İyi İş!';       msg = 'Biraz daha pratikle mükemmel olacak.'; }
  else if (pct >= 40)   { emoji = '📚'; title = 'Çalışmaya Devam!'; msg = 'Bu kelimeleri biraz daha tekrar et.'; }
  else                  { emoji = '💪'; title = 'Devam Et!';     msg = 'Her tekrar seni daha iyi yapıyor.'; }

  document.getElementById('resultEmoji').textContent = emoji;
  document.getElementById('resultTitle').textContent = title;
  document.getElementById('resultScore').textContent = `${correct} / ${total}`;
  document.getElementById('resultMsg').textContent   = msg;

  document.getElementById('resultBreakdown').innerHTML = `
    <div class="rb-item">
      <span class="rb-num green">${correct}</span>
      <span class="rb-label">Doğru</span>
    </div>
    <div class="rb-item">
      <span class="rb-num red">${wrong}</span>
      <span class="rb-label">Yanlış</span>
    </div>
    <div class="rb-item">
      <span class="rb-num" style="color:var(--purple)">${pct}%</span>
      <span class="rb-label">Başarı</span>
    </div>
  `;
}

// ── TEKRAR / ANA SAYFA ────────────────────────────────
document.getElementById('restartBtn').addEventListener('click', () => {
  show('start');
});

document.getElementById('homeBtn').addEventListener('click', () => {
  window.location.href = '../anasayfa/';
});