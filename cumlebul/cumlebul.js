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
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Timeout'lu fetch wrapper ──
function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// ── Çeviri ──
async function fetchTranslate(text) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=tr&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetchWithTimeout(url, 8000);
    const data = await res.json();
    return data[0]?.map(t => t?.[0]).filter(Boolean).join('') || '—';
  } catch {
    return '—';
  }
}

// ── Tüm çevirileri paralel yap ve DOM'a yaz ──
async function renderTranslations(sentences) {
  const translations = await Promise.all(sentences.map(fetchTranslate));
  translations.forEach((tr, i) => {
    const el = document.getElementById(`tr-${i}`);
    if (el) el.innerHTML = `<span class="tr-text">🇹🇷 ${escHtml(tr)}</span>`;
  });
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

// ── Wiktionary parser ──
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
      const match = line.match(/^:+\s*(?:\[\d+\]\s*)?(.+)/);
      if (match) {
        let text = match[1]
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

  const { min, max } = getWordRange();
  return examples
    .filter(e => { const wc = wordCount(e); return wc >= min && wc <= max; })
    .slice(0, 5);
}

async function fetchWiktionary(pageTitle) {
  const params = new URLSearchParams({
    action: 'parse',
    page: pageTitle,
    prop: 'wikitext',
    format: 'json',
    origin: '*'
  });
  try {
    const res = await fetchWithTimeout('https://de.wiktionary.org/w/api.php?' + params, 8000);
    const data = await res.json();
    if (data.error) return null;
    return data?.parse?.wikitext?.['*'] || null;
  } catch {
    return null;
  }
}

// ── Backend arama — sadece /search?q= kullanılır ──
async function getBackendExamples(word) {
  try {
    const res = await fetchWithTimeout(
      `https://backend-api-ndl1.onrender.com/search?q=${encodeURIComponent(word)}`,
      8000
    );
    if (!res.ok) return [];
    const data = await res.json();

    // Sadece aralığa uygun olanları filtrele (Sıralama kaldırıldı)
    const { min, max } = getWordRange();
    return data.filter(e => {
      const wc = wordCount(e);
      return wc >= min && wc <= max;
    });
  } catch {
    return [];
  }
}

// ── Sonuçları HTML olarak oluştur ──
function buildResultsHTML(sentences) {
  return sentences.map((text, i) =>
    `<div class="result-item">
      <div class="de selectable" data-i="${i}">🇩🇪 ${escHtml(text)}</div>
      <div class="tr-line" id="tr-${i}"><span class="tr-loading">çevriliyor…</span></div>
    </div>`
  ).join('');
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
  res.innerHTML = '<p class="loading">🔍 Cümleler hazırlanıyor…</p>';

  try {
    // 1. ADIM: Wiktionary'den çek
    const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
    const attempts = word === capitalized ? [word] : [word, capitalized];
    let wikitext = null;
    for (const title of attempts) {
      wikitext = await fetchWiktionary(title);
      if (wikitext) break;
    }

    let finalSentences = wikitext ? parseExamples(wikitext) : [];
    let sourceText = "Kaynak: Wiktionary";

    // 2. ADIM: Eğer 5'ten azsa Local Backend ile tamamla
    if (finalSentences.length < 5) {
      const localResults = await getBackendExamples(word);
      
      // Wiktionary'de zaten olan cümleleri tekrar eklememek için kontrol et
      for (const s of localResults) {
        if (finalSentences.length >= 5) break;
        if (!finalSentences.includes(s)) {
          finalSentences.push(s);
        }
      }
      
      // Kaynak bilgisini güncelle
      if (finalSentences.length > 0) {
        sourceText = finalSentences.length > (wikitext ? parseExamples(wikitext).length : 0) 
          ? "Kaynak: Wiktionary + Lokal Veri" 
          : "Kaynak: Wiktionary";
      }
    }

    // 3. ADIM: Ekranda Göster
    if (finalSentences.length > 0) {
      res.innerHTML =
        buildResultsHTML(finalSentences) +
        `<p class="source">${sourceText}</p>`;
      
      // Çevirileri başlat
      await renderTranslations(finalSentences);
    } else {
      err.textContent = `"${word}" için hiçbir kaynakta sonuç bulunamadı.`;
      res.innerHTML = '';
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