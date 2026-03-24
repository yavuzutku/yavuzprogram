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
  if (!word) return null;

  // 1️⃣ Temizleme: baş/son boşluk, normalize
  word = word.trim().normalize("NFC");

  // 2️⃣ Denenecek varyantlar
  const variants = [
    word.charAt(0).toUpperCase() + word.slice(1), // Haus
    word.toLowerCase(),                            // haus
    word.toUpperCase()                             // HAUS
  ];

  for (const variant of variants) {
    try {
      const params = new URLSearchParams({
        action: 'parse',
        page: variant,
        prop: 'wikitext',
        format: 'json',
        origin: '*',
      });

      const res = await fetch(`https://de.wiktionary.org/w/api.php?${params}`);
      if (!res.ok) continue;

      const data = await res.json();
      if (data.error) continue;

      const wikitext = data?.parse?.wikitext?.['*'] || '';

      for (const line of wikitext.split('\n')) {
        const match = line.match(/\|Genus\s*\d*\s*=\s*([mfnu])/i);
        if (match) {
          const g = match[1].toLowerCase();
          if (g === 'm' || g === 'f' || g === 'n') return g;
        }
      }
    } catch (err) {
      // hata olursa diğer varyanta geç
      continue;
    }
  }

  return null; // hiçbir varyantta bulunamazsa
}

/* ---------- render result ---------- */
function showResult(word, genus) {
  const info = genusInfo[genus];

  const badge  = document.getElementById('artikelBadge');
  const wEl    = document.getElementById('resultWord');
  const lbl    = document.getElementById('resultLabel');
  const pill   = document.getElementById('genusPill');
  const gName  = document.getElementById('genusName');
  const link   = document.getElementById('wiktionaryLink');

  const capitalized = word.charAt(0).toUpperCase() + word.slice(1);

  badge.textContent  = info.artikel;
  badge.className    = `artikel-badge ${info.cls}`;
  wEl.textContent    = capitalized;
  lbl.textContent    = `${info.artikel.toUpperCase()} → ${info.pill}`;
  pill.textContent   = info.pill;
  pill.className     = `genus-pill ${info.cls}`;
  gName.textContent  = info.name;

  // Wiktionary linki: doğrudan kelime sayfasına yönlendir
  link.href = `https://de.wiktionary.org/wiki/${encodeURIComponent(capitalized)}`;

  show('resultCard');
}