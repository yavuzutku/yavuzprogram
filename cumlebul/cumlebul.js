// ── cumlebul/cumlebul.js ──

function getWordRange() {
  const min = parseInt(document.getElementById('minWords').value) || 1;
  const max = parseInt(document.getElementById('maxWords').value) || 999;
  return { min, max };
}

function wordCount(text) {
  return text.trim().split(/\s+/).length;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Çeviri ──
async function fetchTranslate(text) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=tr&dt=t&q=${encodeURIComponent(text)}`;
    const res  = await fetch(url);
    const data = await res.json();
    return data[0]?.map(t => t?.[0]).filter(Boolean).join('') || '—';
  } catch { return '—'; }
}

// ── Popup ──
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
  const popup = getPopup();
  const textEl = document.getElementById('tr-popup-text');
  textEl.textContent = '…';
  popup.classList.add('visible');

  const vw = window.innerWidth;
  let left = anchorX + 10;
  let top  = anchorY - 52 + window.scrollY;
  if (left + 220 > vw - 8) left = anchorX - 230;
  if (top < window.scrollY + 8) top = anchorY + 18 + window.scrollY;
  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';

  textEl.textContent = await fetchTranslate(selectedText);
}

function hidePopup() {
  getPopup().classList.remove('visible');
}

// ── Wiktionary örnek cümle ayrıştırıcı ──
function parseExamples(wikitext) {
  wikitext = wikitext
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '');

  const lines = wikitext.split('\n');
  const examples = [];
  let inBeispiele = false;

  const SECTION_END = /^\{\{(Herkunft|Synonyme|Übersetzungen|Wortbildungen|Bedeutungen|Redewendungen|Charakteristische|Oberbegriffe|Unterbegriffe|Gegenwörter|Sprichwörter|Referenzen|Abgeleitete|Verkleinerungsformen|Steigerungsformen|Leerzeile|Quellen)/;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^\{\{Beispiele/.test(trimmed) || /^={2,}\s*Beispiele\s*={2,}/.test(trimmed)) {
      inBeispiele = true;
      continue;
    }

    if (inBeispiele) {
      if (SECTION_END.test(trimmed) || /^={2,}/.test(trimmed)) {
        inBeispiele = false;
        continue;
      }

      if (trimmed) {
        const match = line.match(/^:+\s*(?:\[\d+\]\s*)?(.+)/);
        if (match) {
          let text = match[1];
          text = text
            .replace(/\{\{[^{}]*\}\}/g, '')
            .replace(/\{\{[^{}]*\}\}/g, '')
            .replace(/\}\}/g, '')
            .replace(/\{\{/g, '')
            .replace(/'{2,3}/g, '')
            .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
            .replace(/<[^>]+>/g, '')
            .replace(/\[\d+\]/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/[„""\u201C\u201D\u201E\u00AB\u00BB'']/g, '')
            .replace(/\s*[A-ZÄÖÜ][^.!?]*\d{4}\s*\.?\s*$/, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
          if (text.length > 10) examples.push(text);
        }
      }
    }
  }

  const { min, max } = getWordRange();
  return examples.filter(e => {
    const wc = wordCount(e);
    return wc >= min && wc <= max;
  }).slice(0, 5);
}

async function fetchWiktionary(pageTitle) {
  const params = new URLSearchParams({
    action: 'parse',
    page: pageTitle,
    prop: 'wikitext',
    format: 'json',
    origin: '*'
  });
  const response = await fetch('https://de.wiktionary.org/w/api.php?' + params);
  const data = await response.json();
  if (data.error) return null;
  return data?.parse?.wikitext?.['*'] || null;
}

// ── Lokal Tatoeba JSON tarayıcı ──
// sentences_1.json → sentences_96.json sırayla taranır,
// toplam 5 cümle bulununca durulur.
// Her cümlenin hangi dosyadan geldiği console'a yazılır.
// ── Backend'ten cümle çekme ──
async function getBackendExamples(word) {
  try {
    const res = await fetch(
      `https://backend-api-ndl1.onrender.com/search?q=${encodeURIComponent(word)}`
    );

    if (!res.ok) return [];

    const data = await res.json();
    return data; // zaten 5 sonuç geliyor
  } catch (err) {
    console.error("Backend error:", err);
    return [];
  }
}

// ── Ana arama fonksiyonu ──
async function getExamples() {
  const word = document.getElementById('wordInput').value.trim().toLowerCase();
  const btn  = document.getElementById('btn');
  const res  = document.getElementById('results');
  const err  = document.getElementById('error');

  err.textContent = '';
  res.innerHTML = '';

  if (!word) { err.textContent = 'Lütfen bir kelime gir.'; return; }

  btn.disabled = true;
  res.innerHTML = '<p class="loading">🔍 Wiktionary aranıyor...</p>';

  try {
    const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
    const attempts = word === capitalized ? [word] : [word, capitalized];

    let wikitext = null;
    for (const title of attempts) {
      wikitext = await fetchWiktionary(title);
      if (wikitext) break;
    }

    const examples = wikitext ? parseExamples(wikitext) : [];

    if (examples.length > 0) {
      // Wiktionary'den cümleler bulundu
      res.innerHTML = examples.map((e, i) =>
        `<div class="result-item">
          <div class="de selectable" data-i="wiki-${i}">🇩🇪 ${escHtml(e)}</div>
          <div class="tr-line" id="tr-wiki-${i}"><span class="tr-loading">çevriliyor…</span></div>
        </div>`
      ).join('') +
      `<p class="source">Kaynak: <a href="https://de.wiktionary.org/wiki/${encodeURIComponent(capitalized)}" target="_blank">Wiktionary</a></p>`;

      examples.forEach(async (e, i) => {
        const tr = await fetchTranslate(e);
        const el = document.getElementById(`tr-wiki-${i}`);
        if (el) el.innerHTML = `<span class="tr-text">🇹🇷 ${escHtml(tr)}</span>`;
      });

    } else {
      // Wiktionary'de bulunamadı → lokal JSON tarama
      res.innerHTML = '<p class="loading">📂 Lokal cümleler taranıyor...</p>';
      const localSentences = await getBackendExamples(word);

      if (localSentences.length > 0) {
        res.innerHTML = localSentences.map((text, i) =>
          `<div class="result-item">
            <div class="de selectable" data-i="local-${i}">🇩🇪 ${escHtml(text)}</div>
            <div class="tr-line" id="tr-local-${i}"><span class="tr-loading">çevriliyor…</span></div>
          </div>`
        ).join('') +
        `<p class="source">Kaynak: Lokal Tatoeba verisi</p>`;

        localSentences.forEach(async (text, i) => {
          const tr = await fetchTranslate(text);
          const el = document.getElementById(`tr-local-${i}`);
          if (el) el.innerHTML = `<span class="tr-text">🇹🇷 ${escHtml(tr)}</span>`;
        });

      } else {
        err.textContent = `"${word}" için ne Wiktionary'de ne de lokal veride cümle bulunamadı.`;
        res.innerHTML = '';
      }
    }

  } catch (e) {
    console.error('Arama hatası:', e);
    err.textContent = 'Bir hata oluştu: ' + e.message;
    res.innerHTML = '';
  } finally {
    btn.disabled = false;
  }
}

// ── Event Listeners ──
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn').addEventListener('click', getExamples);
  document.getElementById('wordInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') getExamples();
  });

  // Seçim ile popup
  document.addEventListener('mouseup', async (e) => {
    if (e.target.closest('#tr-popup')) return;
    const sel = window.getSelection();
    const selected = sel?.toString().trim();
    if (selected && selected.length > 1 && e.target.closest('.selectable')) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      await showTranslatePopup(selected, rect.left + rect.width / 2, rect.top);
      return;
    }
    hidePopup();
  });

  // Tek kelime tıklama
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#tr-popup')) return;
    const target = e.target.closest('.selectable');
    if (!target) { hidePopup(); return; }
    const sel = window.getSelection()?.toString().trim();
    if (sel && sel.length > 1) return;
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (!range) return;
    range.expand('word');
    const word = range.toString().trim().replace(/[^a-zA-ZäöüÄÖÜß]/g, '');
    if (word.length < 2) return;
    await showTranslatePopup(word, e.clientX, e.clientY);
  });
});