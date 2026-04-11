/* ============================================================
   artikel.js  –  Wiktionary API ile Almanca artikel bulucu
                  + Çoğul / IPA / Anlam parsing
                  + Oturum geçmişi (in-memory)
                  + Quiz modu (in-memory)
                  + Debounce arama
                  + Clipboard kopyalama
                  + Haptic feedback
                  + Geliştirilmiş mobil kelime seçimi
                  + Cümle örnekleri (Wiktionary & Lokal Tatoeba)
                  + Çeviri popup (tıklama & seçim)
   ============================================================ */

const genusInfo = {
  m: { artikel: 'der', cls: 'der', pill: 'Maskulin', name: '— eril isimler'  },
  f: { artikel: 'die', cls: 'die', pill: 'Feminin',  name: '— dişil isimler' },
  n: { artikel: 'das', cls: 'das', pill: 'Neutrum',  name: '— nötr isimler'  },
};

/* Oturum boyunca tutulan kelime geçmişi (storage kullanılmıyor) */
const sessionHistory = [];

// ================================================================
// YARDIMCI
// ================================================================

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function wordCount(text) {
  return text.trim().split(/\s+/).length;
}

function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden');    }

function showError(html) {
  const el = document.getElementById('errorMsg');
  if (!el) return;
  el.innerHTML = html;
  show('errorMsg');
}

// ================================================================
// HAPTIC
// ================================================================

function haptic(ms = 30) {
  try { navigator.vibrate?.(ms); } catch (_) { /* sessizce yoksay */ }
}

// ================================================================
// CLIPBOARD
// ================================================================

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* Eski tarayıcılar için fallback */
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

// ================================================================
// ÇEVIRI
// ================================================================

async function fetchTranslate(text) {
  if (!text?.trim()) return '';
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=de|tr`;
    const res  = await fetch(url);
    if (!res.ok) return text;
    const data = await res.json();
    const tr   = data?.responseData?.translatedText;
    return (tr && tr.toLowerCase() !== text.toLowerCase()) ? tr : text;
  } catch {
    return text;
  }
}

// ================================================================
// POPUP
// ================================================================

let _popup = null;

function getPopup() {
  if (!_popup) {
    _popup = document.createElement('div');
    _popup.id = 'tr-popup';
    _popup.innerHTML = '<span class="tr-popup-flag">🇹🇷</span><span id="tr-popup-text">…</span>';
    document.body.appendChild(_popup);
  }
  return _popup;
}

async function showTranslatePopup(selectedText, anchorX, anchorY) {
  const popup  = getPopup();
  const textEl = document.getElementById('tr-popup-text');
  textEl.textContent = '…';
  popup.classList.add('visible');

  const vw = window.innerWidth;
  let left = anchorX + 10;
  let top  = anchorY - 52 + window.scrollY;
  if (left + 240 > vw - 8) left = anchorX - 250;
  if (left < 8)            left = 8;
  if (top < window.scrollY + 8) top = anchorY + 18 + window.scrollY;
  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';

  textEl.textContent = await fetchTranslate(selectedText);
}

function hidePopup() {
  _popup?.classList.remove('visible');
}

// ================================================================
// WIKTIONARY — ham wikitext çekme
// ================================================================

async function fetchWiktionaryText(pageTitle) {
  const params = new URLSearchParams({
    action: 'parse', page: pageTitle, prop: 'wikitext', format: 'json', origin: '*',
  });
  try {
    const res  = await fetch('https://de.wiktionary.org/w/api.php?' + params);
    const data = await res.json();
    if (data.error) return null;
    return data?.parse?.wikitext?.['*'] || null;
  } catch { return null; }
}

/* fetchGenus — genus + wikitext birlikte döndürür; ilk eşleşmede erken çıkar */
async function fetchGenus(word) {
  if (!word) return null;
  word = word.trim().normalize('NFC');

  const variants = [
    word.charAt(0).toUpperCase() + word.slice(1),
    word.toLowerCase(),
    word.toUpperCase(),
  ];

  for (const variant of variants) {
    try {
      const params = new URLSearchParams({
        action: 'parse', page: variant, prop: 'wikitext', format: 'json', origin: '*',
      });
      const res  = await fetch(`https://de.wiktionary.org/w/api.php?${params}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.error) continue;
      const wikitext = data?.parse?.wikitext?.['*'] || '';

      for (const line of wikitext.split('\n')) {
        const m = line.match(/\|Genus\s*\d*\s*=\s*([mfnu])/i);
        if (m) {
          const g = m[1].toLowerCase();
          if (g === 'm' || g === 'f' || g === 'n') {
            return { genus: g, wikitext }; /* ← erken çıkış, diğer variant'lar denenmez */
          }
        }
      }
    } catch { continue; }
  }
  return null;
}

// ================================================================
// WIKITEXT PARSING — Çoğul / IPA / Anlam
// ================================================================

function parsePlural(wikitext) {
  const patterns = [
    /\|Nominativ Plural 1\s*=\s*([^\|\n\}]+)/,
    /\|Nominativ Plural\s*=\s*([^\|\n\}]+)/,
    /\|Nominativ Plural 2\s*=\s*([^\|\n\}]+)/,
  ];
  for (const p of patterns) {
    const m = wikitext.match(p);
    if (m) {
      const val = m[1].trim()
        .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
        .trim();
      if (val && val !== '—' && val !== '-' && val !== '—' && !val.startsWith('{{')) {
        return val;
      }
    }
  }
  return null;
}

function parseIPA(wikitext) {
  const m1 = wikitext.match(/\{\{Lautschrift\|([^}]+)\}\}/);
  if (m1) return m1[1].trim();
  const m2 = wikitext.match(/\|Lautschrift\s*=\s*([^\|\n\}]+)/);
  if (m2) return m2[1].trim();
  return null;
}

function parseBedeutung(wikitext) {
  const lines    = wikitext.split('\n');
  const meanings = [];
  let inSection  = false;

  const END_RE = /^\{\{(Herkunft|Synonyme|Übersetzungen|Beispiele|Wortbildungen|Redewendungen|Charakteristische|Oberbegriffe|Unterbegriffe|Gegenwörter|Sprichwörter|Referenzen|Abgeleitete|Verkleinerungsformen|Steigerungsformen|Leerzeile|Quellen)/;

  for (const line of lines) {
    const t = line.trim();
    if (/^\{\{Bedeutungen/.test(t) || /^={2,}\s*Bedeutungen\s*={2,}/.test(t)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (END_RE.test(t) || /^={2,}/.test(t)) { inSection = false; continue; }
      const m = line.match(/^:+\s*(?:\[\d+\]\s*)?(.+)/);
      if (m) {
        let text = m[1]
          .replace(/\{\{[^{}]*\}\}/g, '').replace(/\}\}/g, '').replace(/\{\{/g, '')
          .replace(/'{2,3}/g, '')
          .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
          .replace(/<[^>]+>/g, '').replace(/\[\d+\]/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s{2,}/g, ' ').trim();
        if (text.length > 3 && text.length < 140) meanings.push(text);
      }
    }
  }
  return meanings.slice(0, 2);
}

// ================================================================
// ORNEK CUMLE — Wiktionary parser
// ================================================================

function parseExamples(wikitext) {
  wikitext = wikitext
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '');

  const lines      = wikitext.split('\n');
  const examples   = [];
  let inBeispiele  = false;

  const SECTION_END = /^\{\{(Herkunft|Synonyme|Übersetzungen|Wortbildungen|Bedeutungen|Redewendungen|Charakteristische|Oberbegriffe|Unterbegriffe|Gegenwörter|Sprichwörter|Referenzen|Abgeleitete|Verkleinerungsformen|Steigerungsformen|Leerzeile|Quellen)/;

  for (const line of lines) {
    const t = line.trim();
    if (/^\{\{Beispiele/.test(t) || /^={2,}\s*Beispiele\s*={2,}/.test(t)) {
      inBeispiele = true;
      continue;
    }
    if (inBeispiele) {
      if (SECTION_END.test(t) || /^={2,}/.test(t)) { inBeispiele = false; continue; }
      if (t) {
        const m = line.match(/^:+\s*(?:\[\d+\]\s*)?(.+)/);
        if (m) {
          let text = m[1]
            .replace(/\{\{[^{}]*\}\}/g, '').replace(/\}\}/g, '').replace(/\{\{/g, '')
            .replace(/'{2,3}/g, '')
            .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
            .replace(/<[^>]+>/g, '').replace(/\[\d+\]/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/[„""\u201C\u201D\u201E\u00AB\u00BB'']/g, '')
            .replace(/\s*[A-ZÄÖÜ][^.!?]*\d{4}\s*\.?\s*$/, '')
            .replace(/\s{2,}/g, ' ').trim();
          if (text.length > 10) examples.push(text);
        }
      }
    }
  }
  return examples
    .filter(e => { const wc = wordCount(e); return wc >= 3 && wc <= 25; })
    .slice(0, 5);
}

// ================================================================
// ORNEK CUMLE — Lokal Tatoeba
// ================================================================

async function getLocalExamples(word, artikel) {
  const capitalized   = word.charAt(0).toUpperCase() + word.slice(1);
  const artikelVars   = { der: '(?:der|dem|den|des)', die: '(?:die|der)', das: '(?:das|dem|des)' };
  const artikelPat    = artikelVars[artikel] || artikel;
  const phraseRegex   = new RegExp(`(?<![a-zA-ZäöüÄÖÜß])${artikelPat}\\s+${capitalized}(?![a-zA-ZäöüÄÖÜß])`, 'i');
  const wordRegex     = new RegExp(`(?<![a-zA-ZäöüÄÖÜß])${capitalized}(?![a-zA-ZäöüÄÖÜß])`, 'i');
  const collected     = [];
  const fallbackBuf   = [];

  for (let n = 1; n <= 96; n++) {
    if (collected.length >= 5) break;
    let sentences;
    try {
      const res = await fetch(`../cumlebul/datalar/sentences_${n}.json`);
      if (!res.ok) continue;
      sentences = await res.json();
    } catch { continue; }

    for (const s of sentences) {
      const text = s.t || '';
      const wc   = wordCount(text);
      if (wc < 3 || wc > 25) continue;
      if (phraseRegex.test(text)) {
        if (collected.length < 5) collected.push(text);
      } else if (fallbackBuf.length < 10 && wordRegex.test(text)) {
        fallbackBuf.push(text);
      }
    }
  }

  if (collected.length < 3) {
    for (const t of fallbackBuf) {
      if (collected.length >= 5) break;
      if (!collected.includes(t)) collected.push(t);
    }
  }
  return collected;
}

// ================================================================
// CUMLE BOLUMU
// ================================================================

async function loadExampleSentences(word, artikel, cachedWikitext) {
  const section = document.getElementById('sentenceSection');
  if (!section) return;

  section.innerHTML = `
    <div class="sentence-header"><span class="sentence-eyebrow">📝 Örnek Cümleler</span></div>
    <p class="sentence-loading">
      <span class="sdots"><span></span><span></span><span></span></span>
      Cümleler aranıyor…
    </p>`;
  section.classList.remove('hidden');

  const capitalized = word.charAt(0).toUpperCase() + word.slice(1);

  try {
    const wikitext = cachedWikitext
      || (await fetchWiktionaryText(capitalized))
      || (await fetchWiktionaryText(word.toLowerCase()));

    const examples = wikitext ? parseExamples(wikitext) : [];

    if (examples.length > 0) {
      renderSentences(examples, 'wiktionary', capitalized);
      return;
    }

    const loadingEl = section.querySelector('.sentence-loading');
    if (loadingEl) {
      loadingEl.innerHTML =
        '<span class="sdots"><span></span><span></span><span></span></span> Lokal veriler taranıyor…';
    }

    const local = await getLocalExamples(word, artikel);
    if (local.length > 0) {
      renderSentences(local, 'tatoeba', null);
    } else {
      section.innerHTML = `
        <div class="sentence-header"><span class="sentence-eyebrow">📝 Örnek Cümleler</span></div>
        <p class="sentence-none">"${escHtml(artikel)} ${escHtml(capitalized)}" için örnek cümle bulunamadı.</p>`;
    }
  } catch (e) {
    console.error('Cümle yükleme hatası:', e);
    section.innerHTML = `
      <div class="sentence-header"><span class="sentence-eyebrow">📝 Örnek Cümleler</span></div>
      <p class="sentence-none">Cümleler yüklenirken bir hata oluştu.</p>`;
  }
}

function renderSentences(sentences, source, wikiWord) {
  const section = document.getElementById('sentenceSection');
  const sourceHtml = source === 'wiktionary' && wikiWord
    ? `<p class="sentence-source">Kaynak: <a href="https://de.wiktionary.org/wiki/${encodeURIComponent(wikiWord)}" target="_blank" rel="noopener">Wiktionary</a></p>`
    : `<p class="sentence-source">Kaynak: Lokal Tatoeba verisi</p>`;

  section.innerHTML = `
    <div class="sentence-header"><span class="sentence-eyebrow">📝 Örnek Cümleler</span></div>
    ${sentences.map((text, i) => `
      <div class="sentence-item" style="animation-delay:${i * 0.07}s">
        <div class="sentence-de selectable">🇩🇪 ${escHtml(text)}</div>
        <div class="sentence-tr-line" id="str-${i}">
          <span class="sentence-tr-loading">çevriliyor…</span>
        </div>
      </div>
    `).join('')}
    ${sourceHtml}`;

  sentences.forEach(async (text, i) => {
    const tr = await fetchTranslate(text);
    const el = document.getElementById(`str-${i}`);
    if (el) el.innerHTML = `<span class="sentence-tr-text">🇹🇷 ${escHtml(tr)}</span>`;
  });
}

// ================================================================
// OTURUM GEÇMİŞİ
// ================================================================

function addToHistory(word, genus, artikel) {
  const idx = sessionHistory.findIndex(h => h.word.toLowerCase() === word.toLowerCase());
  if (idx !== -1) sessionHistory.splice(idx, 1);
  sessionHistory.unshift({ word, genus, artikel });
  if (sessionHistory.length > 20) sessionHistory.pop();
  renderHistory();
  updateQuizBtn();
}

function renderHistory() {
  const container = document.getElementById('historySection');
  if (!container) return;

  if (sessionHistory.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="history-header">
      <span class="history-eyebrow">🕐 Bu Oturumda Arananlar</span>
    </div>
    <div class="history-list">
      ${sessionHistory.map(h => `
        <button class="history-chip ${h.genus === 'm' ? 'der' : h.genus === 'f' ? 'die' : 'das'}"
                data-word="${escHtml(h.word)}" type="button">
          <span class="hc-artikel">${escHtml(h.artikel)}</span>
          <span class="hc-word">${escHtml(h.word)}</span>
        </button>
      `).join('')}
    </div>`;

  container.querySelectorAll('.history-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = btn.dataset.word;
      const input = document.getElementById('wordInput');
      if (input) { input.value = w; searchArtikel(); }
    });
  });
}

function updateQuizBtn() {
  const btn = document.getElementById('quizStartBtn');
  if (!btn) return;
  btn.classList.toggle('hidden', sessionHistory.length < 3);
}

// ================================================================
// QUIZ (in-memory, storage yok)
// ================================================================

let quizWords    = [];
let quizIndex    = 0;
let quizScore    = 0;
let quizAnswered = false;

function startQuiz() {
  if (sessionHistory.length < 3) return;
  quizWords    = [...sessionHistory].sort(() => Math.random() - 0.5);
  quizIndex    = 0;
  quizScore    = 0;
  quizAnswered = false;

  const section = document.getElementById('quizSection');
  section?.classList.remove('hidden');
  document.getElementById('quizStartBtn')?.classList.add('hidden');
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const section = document.getElementById('quizSection');
  if (!section) return;

  if (quizIndex >= quizWords.length) { renderQuizResult(); return; }

  const item        = quizWords[quizIndex];
  const capitalized = item.word.charAt(0).toUpperCase() + item.word.slice(1);
  const pct         = Math.round((quizIndex / quizWords.length) * 100);

  section.innerHTML = `
    <div class="quiz-header">
      <span class="quiz-eyebrow">🎯 Quiz</span>
      <span class="quiz-progress">${quizIndex + 1} / ${quizWords.length}</span>
    </div>
    <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${pct}%"></div></div>
    <div class="quiz-question">
      <span class="quiz-q-label">Bu kelimenin artikeli nedir?</span>
      <span class="quiz-word">${escHtml(capitalized)}</span>
    </div>
    <div class="quiz-choices">
      <button class="quiz-choice der" data-answer="der" type="button">der</button>
      <button class="quiz-choice die" data-answer="die" type="button">die</button>
      <button class="quiz-choice das" data-answer="das" type="button">das</button>
    </div>
    <div class="quiz-feedback hidden" id="quizFeedback"></div>
    <button class="quiz-next hidden" id="quizNextBtn" type="button">Sonraki →</button>`;

  section.querySelectorAll('.quiz-choice').forEach(btn => {
    btn.addEventListener('click', () => handleQuizAnswer(btn.dataset.answer, item));
  });
}

function handleQuizAnswer(chosen, item) {
  if (quizAnswered) return;
  quizAnswered = true;
  haptic(40);

  const correct   = item.artikel;
  const isCorrect = chosen === correct;
  if (isCorrect) quizScore++;

  document.querySelectorAll('.quiz-choice').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.answer === correct)           btn.classList.add('correct');
    if (btn.dataset.answer === chosen && !isCorrect) btn.classList.add('wrong');
  });

  const fb = document.getElementById('quizFeedback');
  if (fb) {
    fb.classList.remove('hidden');
    fb.innerHTML = isCorrect
      ? `<span class="fb-correct">✓ Doğru!</span>`
      : `<span class="fb-wrong">✗ Yanlış — doğru cevap: <strong class="${correct}">${escHtml(correct)}</strong></span>`;
  }

  const nextBtn = document.getElementById('quizNextBtn');
  if (nextBtn) {
    nextBtn.classList.remove('hidden');
    nextBtn.addEventListener('click', () => {
      quizIndex++;
      quizAnswered = false;
      renderQuizQuestion();
    });
  }
}

function renderQuizResult() {
  const section = document.getElementById('quizSection');
  if (!section) return;
  const pct   = Math.round((quizScore / quizWords.length) * 100);
  const emoji = pct === 100 ? '🏆' : pct >= 70 ? '👍' : '📚';

  section.innerHTML = `
    <div class="quiz-header"><span class="quiz-eyebrow">🎯 Quiz Bitti</span></div>
    <div class="quiz-result">
      <div class="quiz-result-emoji">${emoji}</div>
      <div class="quiz-result-score">${quizScore} / ${quizWords.length}</div>
      <div class="quiz-result-pct">${pct}% doğru</div>
      <div class="quiz-result-actions">
        <button class="quiz-restart-btn" id="quizRestartBtn" type="button">Tekrar Oyna</button>
        <button class="quiz-close-btn"   id="quizCloseBtn"   type="button">Kapat</button>
      </div>
    </div>`;

  document.getElementById('quizRestartBtn')?.addEventListener('click', startQuiz);
  document.getElementById('quizCloseBtn')?.addEventListener('click', () => {
    section?.classList.add('hidden');
    updateQuizBtn();
  });
}

// ================================================================
// ANA ARAMA
// ================================================================

let debounceTimer = null;

function debounceSearch() {
  clearTimeout(debounceTimer);
  const val = document.getElementById('wordInput')?.value.trim() || '';
  if (val.length < 2) return;
  debounceTimer = setTimeout(searchArtikel, 700);
}

async function searchArtikel() {
  clearTimeout(debounceTimer);
  const input = document.getElementById('wordInput');
  const word  = input?.value.trim();
  if (!word) return;

  hide('resultCard');
  hide('errorMsg');
  hide('sentenceSection');
  show('loading');
  document.getElementById('searchBtn').disabled = true;

  try {
    const result = await fetchGenus(word);
    hide('loading');

    if (!result) {
      showError(
        `"<strong>${escHtml(word)}</strong>" için Wiktionary'de Almanca artikel bulunamadı.<br>` +
        `Kelimenin Almanca bir isim olup olmadığını kontrol edin.`
      );
      return;
    }

    const { genus, wikitext } = result;
    const info     = genusInfo[genus];
    const plural   = parsePlural(wikitext);
    const ipa      = parseIPA(wikitext);
    const bedeutung = parseBedeutung(wikitext);

    haptic(30);
    showResult(word, genus, plural, ipa, bedeutung);
    addToHistory(word, genus, info.artikel);
    loadExampleSentences(word, info.artikel, wikitext);

  } catch (err) {
    hide('loading');
    showError('Bağlantı hatası: ' + err.message);
  } finally {
    document.getElementById('searchBtn').disabled = false;
  }
}

// ================================================================
// SONUÇ KARTINI GÖSTER
// ================================================================

function showResult(word, genus, plural, ipa, bedeutung) {
  const info        = genusInfo[genus];
  const capitalized = word.charAt(0).toUpperCase() + word.slice(1);

  document.getElementById('artikelBadge').textContent = info.artikel;
  document.getElementById('artikelBadge').className   = `artikel-badge ${info.cls}`;
  document.getElementById('resultWord').textContent   = capitalized;
  document.getElementById('resultLabel').textContent  = `${info.artikel.toUpperCase()} → ${info.pill}`;
  document.getElementById('genusPill').textContent    = info.pill;
  document.getElementById('genusPill').className      = `genus-pill ${info.cls}`;
  document.getElementById('genusName').textContent    = info.name;

  /* Wiktionary linki — artık görünür */
  const link = document.getElementById('wiktionaryLink');
  if (link) {
    link.href = `https://de.wiktionary.org/wiki/${encodeURIComponent(capitalized)}`;
    link.classList.remove('hidden');
  }

  /* Ek bilgi (IPA / Çoğul / Anlam) */
  const extraEl = document.getElementById('resultExtra');
  if (extraEl) {
    let html = '';
    if (ipa) {
      html += `<div class="extra-item">
        <span class="extra-label">Telaffuz</span>
        <span class="extra-val ipa">[${escHtml(ipa)}]</span>
      </div>`;
    }
    if (plural) {
      html += `<div class="extra-item">
        <span class="extra-label">Çoğul</span>
        <span class="extra-val plural-val">die <strong>${escHtml(plural)}</strong></span>
      </div>`;
    }
    if (bedeutung?.length) {
      html += `<div class="extra-item extra-bedeutung">
        <span class="extra-label">Anlam</span>
        <span class="extra-val">${bedeutung.map(b => escHtml(b)).join('<span class="meaning-sep"> / </span>')}</span>
      </div>`;
    }
    extraEl.innerHTML = html;
    extraEl.classList.toggle('hidden', !html);
  }

  /* Kopyala butonu */
  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    copyBtn.dataset.text = `${info.artikel} ${capitalized}`;
    copyBtn.textContent  = '📋 Kopyala';
    copyBtn.classList.remove('hidden', 'copied');
  }

  show('resultCard');
}

// ================================================================
// EVENT LISTENERS
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
  const input     = document.getElementById('wordInput');
  const searchBtn = document.getElementById('searchBtn');
  if (!input || !searchBtn) return;

  searchBtn.addEventListener('click', searchArtikel);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') searchArtikel(); });
  input.addEventListener('input', debounceSearch);

  /* Kopyala */
  document.getElementById('copyBtn')?.addEventListener('click', async (e) => {
    const btn  = e.currentTarget;
    const text = btn.dataset.text;
    if (!text) return;
    haptic(20);
    const ok = await copyToClipboard(text);
    if (ok) {
      btn.textContent = '✓ Kopyalandı';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '📋 Kopyala';
        btn.classList.remove('copied');
      }, 1800);
    }
  });

  /* Quiz başlat */
  document.getElementById('quizStartBtn')?.addEventListener('click', startQuiz);

  /* — Masaüstü: seçim ile popup — */
  document.addEventListener('mouseup', async (e) => {
    if (e.target.closest('#tr-popup')) return;
    const sel      = window.getSelection();
    const selected = sel?.toString().trim();
    if (selected && selected.length > 1 && e.target.closest('.selectable')) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      await showTranslatePopup(selected, rect.left + rect.width / 2, rect.top);
      return;
    }
    hidePopup();
  });

  /* — Masaüstü: tek kelime tıklama — */
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#tr-popup')) return;
    const target = e.target.closest('.selectable');
    if (!target) { hidePopup(); return; }
    const sel = window.getSelection()?.toString().trim();
    if (sel && sel.length > 1) return;

    const word = extractWordAtPoint(e.clientX, e.clientY);
    if (!word || word.length < 2) return;
    await showTranslatePopup(word, e.clientX, e.clientY);
  });

  /* — Mobil: uzun basış ile kelime çevirisi — */
  let longPressTimer = null;

  document.addEventListener('touchstart', (e) => {
    const target = e.target.closest('.selectable');
    if (!target) return;
    const touch = e.touches[0];
    longPressTimer = setTimeout(async () => {
      haptic(50);
      const word = extractWordAtPoint(touch.clientX, touch.clientY);
      if (!word || word.length < 2) return;
      await showTranslatePopup(word, touch.clientX, touch.clientY);
    }, 500);
  }, { passive: true });

  document.addEventListener('touchend',  () => clearTimeout(longPressTimer), { passive: true });
  document.addEventListener('touchmove', () => clearTimeout(longPressTimer), { passive: true });
});

/* Tarayıcılar arası (Chrome, Firefox, Safari/iOS) kelime ayıklama */
function extractWordAtPoint(x, y) {
  try {
    /* Chrome / Safari */
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y);
      if (!range) return null;
      range.expand('word');
      return range.toString().trim().replace(/[^a-zA-ZäöüÄÖÜß]/g, '') || null;
    }
    /* Firefox */
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (!pos) return null;
      const range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.setEnd(pos.offsetNode, pos.offset);
      /* Firefox 'expand' desteklemeyebilir; manuel genişlet */
      const node = pos.offsetNode;
      if (node.nodeType !== Node.TEXT_NODE) return null;
      const text   = node.textContent;
      let   start  = pos.offset;
      let   end    = pos.offset;
      while (start > 0 && /[a-zA-ZäöüÄÖÜß]/.test(text[start - 1])) start--;
      while (end < text.length && /[a-zA-ZäöüÄÖÜß]/.test(text[end])) end++;
      return text.slice(start, end) || null;
    }
  } catch (_) { /* sessizce yoksay */ }
  return null;
}