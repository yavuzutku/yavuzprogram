/* ============================================================
   artikel.js  –  Wiktionary API ile Almanca artikel bulucu
   ============================================================ */

const genusInfo = {
  m: { artikel: 'der', cls: 'der', pill: 'Maskulin', name: '— erkil isimler' },
  f: { artikel: 'die', cls: 'die', pill: 'Feminin',  name: '— dişil isimler' },
  n: { artikel: 'das', cls: 'das', pill: 'Neutrum',  name: '— nötr isimler'  },
};

document.addEventListener('DOMContentLoaded', () => {
  const input     = document.getElementById('wordInput');
  const searchBtn = document.getElementById('searchBtn');

  if (!input || !searchBtn) return;

  searchBtn.addEventListener('click', searchArtikel);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') searchArtikel(); });
});

/* ---------- helpers ---------- */
function show(id)  { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id)  { document.getElementById(id)?.classList.add('hidden'); }

function showError(html) {
  const el = document.getElementById('errorMsg');
  if (!el) return;
  el.innerHTML = html;
  show('errorMsg');
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ---------- main search ---------- */
async function searchArtikel() {
  const input = document.getElementById('wordInput');
  const word  = input?.value.trim();
  if (!word) return;

  hide('resultCard');
  hide('errorMsg');
  show('loading');
  document.getElementById('searchBtn').disabled = true;

  try {
    const genus = await fetchGenus(word);
    hide('loading');

    if (!genus) {
      showError(
        `"<strong>${escHtml(word)}</strong>" için Wiktionary'de Almanca artikel bulunamadı.<br>` +
        `Kelimenin Almanca bir isim olup olmadığını kontrol edin.`
      );
      return;
    }

    showResult(word, genus);

  } catch (err) {
    hide('loading');
    showError('Bağlantı hatası: ' + err.message);
  } finally {
    document.getElementById('searchBtn').disabled = false;
  }
}

/* ---------- Wiktionary API ---------- */
async function fetchGenus(word) {
  const capitalized = word.charAt(0).toUpperCase() + word.slice(1);

  const params = new URLSearchParams({
    action: 'parse',
    page:   capitalized,
    prop:   'wikitext',
    format: 'json',
    origin: '*',
  });

  const res  = await fetch(`https://de.wiktionary.org/w/api.php?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data     = await res.json();
  if (data.error) return null;

  const wikitext = data?.parse?.wikitext?.['*'] || '';

  // Satır satır tara: |Genus=m  /  |Genus 1=f  gibi
  for (const line of wikitext.split('\n')) {
    const match = line.match(/\|Genus\s*\d*\s*=\s*([mfnu])/i);
    if (match) {
      const g = match[1].toLowerCase();
      if (g === 'm' || g === 'f' || g === 'n') return g;
    }
  }

  return null;
}

/* ---------- render result ---------- */
function showResult(word, genus) {
  const info = genusInfo[genus];

  const badge  = document.getElementById('artikelBadge');
  const wEl    = document.getElementById('resultWord');
  const lbl    = document.getElementById('resultLabel');
  const pill   = document.getElementById('genusPill');
  const gName  = document.getElementById('genusName');

  badge.textContent  = info.artikel;
  badge.className    = `artikel-badge ${info.cls}`;
  wEl.textContent    = word.charAt(0).toUpperCase() + word.slice(1);
  lbl.textContent    = `${info.artikel.toUpperCase()} → ${info.pill}`;
  pill.textContent   = info.pill;
  pill.className     = `genus-pill ${info.cls}`;
  gName.textContent  = info.name;

  show('resultCard');
}