/* ============================================================
   artikel.js  –  Wiktionary API ile Almanca artikel bulucu
                  + Cümle örnekleri (Wiktionary & Lokal Tatoeba)
                  + Çeviri popup (tıklama & seçim)
   ============================================================ */

const genusInfo = {
  m: { artikel: 'der', cls: 'der', pill: 'Maskulin', name: '— erkil isimler' },
  f: { artikel: 'die', cls: 'die', pill: 'Feminin',  name: '— dişil isimler' },
  n: { artikel: 'das', cls: 'das', pill: 'Neutrum',  name: '— nötr isimler'  },
};

// ================================================================
// YARDIMCI
// ================================================================

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wordCount(text) {
  return text.trim().split(/\s+/).length;
}

function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

function showError(html) {
  const el = document.getElementById('errorMsg');
  if (!el) return;
  el.innerHTML = html;
  show('errorMsg');
}

// ================================================================
// CEVIRI
// ================================================================

async function fetchTranslate(text) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=tr&dt=t&q=${encodeURIComponent(text)}`;
    const res  = await fetch(url);
    const data = await res.json();
    return data[0]?.map(t => t?.[0]).filter(Boolean).join('') || '—';
  } catch { return '—'; }
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

  const vw  = window.innerWidth;
  let left  = anchorX + 10;
  let top   = anchorY - 52 + window.scrollY;
  if (left + 240 > vw - 8) left = anchorX - 250;
  if (top < window.scrollY + 8) top = anchorY + 18 + window.scrollY;
  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';

  textEl.textContent = await fetchTranslate(selectedText);
}

function hidePopup() {
  if (_popup) _popup.classList.remove('visible');
}

// ================================================================
// WIKTIONARY
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

/* fetchGenus: genus + wikitext birlikte döndürür (2. API çağrısını önler) */
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
        const match = line.match(/\|Genus\s*\d*\s*=\s*([mfnu])/i);
        if (match) {
          const g = match[1].toLowerCase();
          if (g === 'm' || g === 'f' || g === 'n') return { genus: g, wikitext };
        }
      }
    } catch { continue; }
  }
  return null;
}

// ================================================================
// ORNEK CUMLE — WIKTIONARY PARSER
// ================================================================

function parseExamples(wikitext) {
  wikitext = wikitext
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '');

  const lines    = wikitext.split('\n');
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
      if (SECTION_END.test(trimmed) || /^={2,}/.test(trimmed)) { inBeispiele = false; continue; }
      if (trimmed) {
        const match = line.match(/^:+\s*(?:\[\d+\]\s*)?(.+)/);
        if (match) {
          let text = match[1];
          text = text
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
  return examples.filter(e => { const wc = wordCount(e); return wc >= 3 && wc <= 25; }).slice(0, 5);
}

// ================================================================
// ORNEK CUMLE — LOKAL TATOEBA
// Once "artikel + kelime" (tum cekim halleri), yeterli bulunmazsa
// sadece kelime kokunü arar.
// ================================================================

async function getLocalExamples(word, artikel) {
  const capitalized = word.charAt(0).toUpperCase() + word.slice(1);

  // Artikelin tüm çekim halleri
  const artikelVariants = { der: '(?:der|dem|den|des)', die: '(?:die|der)', das: '(?:das|dem|des)' };
  const artikelPattern  = artikelVariants[artikel] || artikel;

  const phraseRegex = new RegExp(
    `(?<![a-zA-ZäöüÄÖÜß])${artikelPattern}\\s+${capitalized}(?![a-zA-ZäöüÄÖÜß])`, 'i'
  );
  const wordRegex = new RegExp(
    `(?<![a-zA-ZäöüÄÖÜß])${capitalized}(?![a-zA-ZäöüÄÖÜß])`, 'i'
  );

  const collected   = [];
  const fallbackBuf = [];

  for (let n = 1; n <= 96; n++) {
    if (collected.length >= 5) break;
    let sentences;
    try {
      // artikel/ dizininden cumlebul/datalar/ yolu
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

  // Yeterli bulunamazsa geri dönüş listesinden tamamla
  if (collected.length < 3) {
    for (const t of fallbackBuf) {
      if (collected.length >= 5) break;
      if (!collected.includes(t)) collected.push(t);
    }
  }
  return collected;
}

// ================================================================
// CUMLE BOLUMUNU YUKLE VE GOSTER
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

    section.querySelector('.sentence-loading').innerHTML =
      '<span class="sdots"><span></span><span></span><span></span></span> Lokal veriler taranıyor…';

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
// ANA ARAMA
// ================================================================

async function searchArtikel() {
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
    const info = genusInfo[genus];

    showResult(word, genus);
    loadExampleSentences(word, info.artikel, wikitext);

  } catch (err) {
    hide('loading');
    showError('Bağlantı hatası: ' + err.message);
  } finally {
    document.getElementById('searchBtn').disabled = false;
  }
}

// ================================================================
// SONUC KARTINI GOSTER
// ================================================================

function showResult(word, genus) {
  const info  = genusInfo[genus];
  const badge = document.getElementById('artikelBadge');
  const wEl   = document.getElementById('resultWord');
  const lbl   = document.getElementById('resultLabel');
  const pill  = document.getElementById('genusPill');
  const gName = document.getElementById('genusName');
  const link  = document.getElementById('wiktionaryLink');

  const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
  badge.textContent = info.artikel;
  badge.className   = `artikel-badge ${info.cls}`;
  wEl.textContent   = capitalized;
  lbl.textContent   = `${info.artikel.toUpperCase()} → ${info.pill}`;
  pill.textContent  = info.pill;
  pill.className    = `genus-pill ${info.cls}`;
  gName.textContent = info.name;
  link.href         = `https://de.wiktionary.org/wiki/${encodeURIComponent(capitalized)}`;
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

  // Seçim ile popup
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