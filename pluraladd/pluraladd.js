/* ═══════════════════════════════════════════════════════════
   wordsadd.js  —  AlmancaPratik Çoklu Kelime Ekleme
   ═══════════════════════════════════════════════════════════
   Desteklenen formatlar:
     Haus = ev          Haus → ev        Haus -> ev
     Haus - ev          Haus : ev        Haus | ev
     Haus, ev           Haus	ev        (tab)
     Haus (ev)          Haus [ev]
     1. Haus = ev       • Haus - ev
     der Hund = köpek   (artikel korunur)
     Sadece: Haus       (çeviri otomatik çekilir)
   ═══════════════════════════════════════════════════════════ */

import { auth, getWords, saveWord } from "../js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { fetchTranslate, normalizeGermanWord } from "../js/german.js";

/* ─── STATE ─────────────────────────────────────────────── */
let currentUser   = null;
let existingWords = [];
let entries       = [];   // { id, de, tr, method, selected, status, translating }
let uidCounter    = 0;
let isTranslating = false;

/* ─── AUTH ──────────────────────────────────────────────── */
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    existingWords = await getWords(user.uid).catch(() => []);
    /* Eğer review zaten açıksa duplicate kontrolü yenile */
    if (entries.length) reCheckDuplicates();
  }
});

/* ═══════════════════════════════════════════════════════════
   PARSER
   ═══════════════════════════════════════════════════════════ */

/* Sıralı ayraç denemeleri — önce en kesin olanlar */
const SEPS = [
  { re: /\s*=\s*/,         name: '=' },
  { re: /\s*→\s*/,         name: '→' },
  { re: /\s*->\s*/,        name: '→' },
  { re: /\s*≈\s*/,         name: '≈' },
  { re: /\s*\|\s*/,        name: '|' },
  { re: /\t+/,             name: 'tab' },
  { re: /\s*:\s*/,         name: ':' },
  { re: /\s+[-–—]\s+/,     name: '–' },   /* boşluklu tire (artikel tiresinden ayır) */
];

const ARTICLE_RE = /^(der|die|das|ein|eine)\s+/i;

/** Satır başındaki liste işaretlerini kaldır */
function stripMarker(line) {
  return line.replace(/^(\d+[.)]\s+|[•\-\*◦▸▹›»·]\s+)/, '').trim();
}

/** Tek satırı parse et → { de, tr, method } veya null */
function parseLine(raw) {
  let line = raw.trim();
  if (!line) return null;
  line = stripMarker(line);
  if (!line) return null;

  /* Parantez/köşeli parantez: "Wort (anlam)" */
  const parenM = line.match(/^(.+?)\s*[(\[](.*?)[)\]]\s*$/);
  if (parenM) {
    const de = parenM[1].trim(), tr = parenM[2].trim();
    if (de && tr) return { de, tr, method: '()' };
  }

  /* Açık ayraçlar */
  for (const sep of SEPS) {
    const m = line.match(sep.re);
    if (!m || m.index === 0) continue;
    const idx = m.index;
    const de  = line.slice(0, idx).trim();
    const tr  = line.slice(idx + m[0].length).trim();

    /* Kolon: saat formatını atla (10:30) */
    if (sep.name === ':' && /^\d{1,2}:\d{2}/.test(line)) continue;
    /* Tire: artikel + tire kombinasyonunu ayırt et (die → geç, çünkü "die Straße" değil) */
    if (sep.name === '–' && ARTICLE_RE.test(line) && !/ [-–—] /.test(line)) continue;

    if (de && tr) return { de, tr, method: sep.name };
  }

  /* Virgül: heuristik */
  const ci = line.indexOf(',');
  if (ci > 0) {
    const de = line.slice(0, ci).trim();
    const tr = line.slice(ci + 1).trim();
    if (de && tr && looksLikeTurkish(tr)) return { de, tr, method: ',' };
  }

  /* Ayraç yok → sadece Almanca kelime */
  return { de: line, tr: '', method: '?' };
}

/** Türkçe/yabancı anlam mı diye tahmin et */
function looksLikeTurkish(s) {
  if (!s) return false;
  /* Türkçe'ye özgü karakterler */
  if (/[şğıçŞĞİÇ]/.test(s)) return true;
  /* Küçük harfle başlıyorsa (Almanca isimler büyük başlar) */
  if (s[0] === s[0].toLowerCase() && /[a-zA-Z]/.test(s[0])) return true;
  /* Çok kısa & latin-only */
  if (s.length < 25 && !/[A-ZÜÖÄ]/.test(s)) return true;
  return false;
}

/**
 * Ana parse fonksiyonu.
 * İki-blok modu: Eğer metin iki ayrı blok içeriyorsa (---/=== ayraçlı ya
 * da üst yarı büyük harfli Almanca, alt yarı küçük harfli Türkçe),
 * pozisyon eşlemesi yapar.
 */
export function parseInput(raw) {
  if (!raw.trim()) return [];

  /* ── İki-blok modu deneyi ────────────────────────────── */
  const twoBlock = tryTwoBlockMode(raw);
  if (twoBlock) return twoBlock;

  /* ── Normal satır-satır mod ──────────────────────────── */
  const lines   = raw.split(/\r?\n/);
  const results = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const p = parseLine(line);
    if (!p) continue;
    results.push(makeEntry(p.de, p.tr, p.method));
  }

  return results;
}

/**
 * İki-blok modu:
 * Eğer boş satır / --- / === ile ayrılmış iki blok varsa,
 * bunları Almanca listesi + Türkçe listesi olarak eşleştir.
 */
function tryTwoBlockMode(raw) {
  /* Açık bölücü: ---, ===, ___ tek satır */
  const dividerRe = /^[-=_]{3,}\s*$/m;
  if (dividerRe.test(raw)) {
    const [blockA, ...rest] = raw.split(dividerRe);
    const blockB = rest.join('\n');
    const deLines = blockA.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const trLines = blockB.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (deLines.length > 0 && deLines.length === trLines.length) {
      return deLines.map((de, i) => makeEntry(
        stripMarker(de), stripMarker(trLines[i]), 'blok'
      ));
    }
  }

  /* Implicit iki-blok: üst yarı büyük harfle başlıyor, alt yarı küçük */
  const allLines = raw.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (allLines.length >= 4 && allLines.length % 2 === 0) {
    const half = allLines.length / 2;
    const topHalf = allLines.slice(0, half);
    const botHalf = allLines.slice(half);
    const topGerman  = topHalf.every(l => !parseLine(l)?.tr && /^[A-ZÜÖÄ]/.test(stripMarker(l)));
    const botTurkish = botHalf.every(l => looksLikeTurkish(stripMarker(l)));
    if (topGerman && botTurkish) {
      return topHalf.map((de, i) => makeEntry(
        stripMarker(de), stripMarker(botHalf[i]), 'blok'
      ));
    }
  }

  return null;
}

function makeEntry(de, tr, method) {
  return {
    id: uidCounter++,
    de:          de.trim(),
    tr:          tr.trim(),
    method,
    selected:    true,
    status:      'new',      /* 'new' | 'duplicate' | 'saved' | 'error' */
    translating: false,
  };
}

/* ─── DUPLICATE CHECK ───────────────────────────────────── */
function reCheckDuplicates() {
  entries = entries.map(e => ({
    ...e,
    status: e.status === 'saved' ? 'saved' : isDuplicate(e.de) ? 'duplicate' : 'new',
  }));
  renderTable();
  updateBar();
}

function isDuplicate(de) {
  if (!de) return false;
  return existingWords.some(w =>
    (w.word || '').toLowerCase().trim() === de.toLowerCase().trim()
  );
}

/* ═══════════════════════════════════════════════════════════
   OTO-ÇEVİRİ
   ═══════════════════════════════════════════════════════════ */
async function autoTranslateMissing() {
  if (isTranslating) return;
  const missing = entries.filter(e => e.selected && !e.tr && e.status !== 'saved');
  if (!missing.length) { showToast("Eksik çeviri yok!", "ok"); return; }

  isTranslating = true;
  const btn = document.getElementById("btnAutoTranslate");
  if (btn) { btn.disabled = true; btn.textContent = "Çevriliyor…"; }

  const progWrap = document.getElementById("translateProgress");
  const progBar  = document.getElementById("translateBar");
  const progText = document.getElementById("translateText");
  if (progWrap) progWrap.style.display = "flex";

  let done = 0;
  for (const entry of missing) {
    /* Entry hâlâ listede ve seçili mi? */
    const live = entries.find(e => e.id === entry.id);
    if (!live || !live.selected) { done++; continue; }

    /* Loading göstergesi */
    live.translating = true;
    updateRowTranslating(live.id, true);

    try {
      const { main } = await fetchTranslate(live.de);
      live.tr          = main || '';
      live.translating = false;
      updateRowTranslating(live.id, false, main);
    } catch {
      live.translating = false;
      updateRowTranslating(live.id, false);
    }

    done++;
    const pct = Math.round((done / missing.length) * 100);
    if (progBar)  progBar.style.width = pct + '%';
    if (progText) progText.textContent = `${done} / ${missing.length}`;

    /* Rate-limit dostu gecikme */
    await sleep(220);
  }

  isTranslating = false;
  if (btn) { btn.disabled = false; btn.textContent = "Eksikleri Otomatik Çevir"; }
  if (progWrap) setTimeout(() => { progWrap.style.display = "none"; }, 1200);
  updateBar();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ─── Tek satırın çeviri alanını güncelle ───────────────── */
function updateRowTranslating(id, loading, value) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (!row) return;
  const inp = row.querySelector('.tr-input');
  if (!inp) return;
  if (loading) {
    inp.placeholder = "çevriliyor…";
    inp.disabled    = true;
    row.classList.add('row--translating');
  } else {
    inp.disabled    = false;
    inp.placeholder = "Türkçe anlam…";
    row.classList.remove('row--translating');
    if (value !== undefined) inp.value = value;
  }
}

/* ═══════════════════════════════════════════════════════════
   KAYDET
   ═══════════════════════════════════════════════════════════ */
async function saveSelected() {
  if (!currentUser) { showToast("Lütfen giriş yapın!", "err"); return; }

  const toSave = entries.filter(e => e.selected && e.de && e.tr && e.status !== 'saved');
  if (!toSave.length) { showToast("Kaydedilecek kelime yok!", "err"); return; }

  const btn = document.getElementById("btnSave");
  if (btn) { btn.disabled = true; btn.textContent = "Kaydediliyor…"; }

  let saved = 0, skipped = 0, errors = 0;

  for (const entry of toSave) {
    const normalizedDe = normalizeGermanWord(entry.de, null);
    try {
      /* Duplicate kontrolü (anlam dahil) */
      const dup = existingWords.find(w =>
        (w.word || '').toLowerCase().trim()    === normalizedDe.toLowerCase().trim() &&
        (w.meaning || '').toLowerCase().trim() === entry.tr.toLowerCase().trim()
      );
      if (dup) { entry.status = 'duplicate'; skipped++; continue; }

      await saveWord(currentUser.uid, normalizedDe, entry.tr, []);
      entry.status = 'saved';
      existingWords.push({ word: normalizedDe, meaning: entry.tr });
      updateRowStatus(entry.id, 'saved');
      saved++;
    } catch {
      entry.status = 'error';
      updateRowStatus(entry.id, 'error');
      errors++;
    }

    await sleep(60);
  }

  if (btn) { btn.disabled = false; btn.textContent = `Seçilileri Kaydet (${getSelectCount()})`; }
  showSummary(saved, skipped, errors);
  updateBar();
}

function updateRowStatus(id, status) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (!row) return;
  row.dataset.status = status;
  const badge = row.querySelector('.status-badge');
  if (badge) {
    badge.className  = `status-badge status-badge--${status}`;
    badge.textContent = STATUS_LABELS[status] || status;
  }
}

const STATUS_LABELS = {
  new:       'Yeni',
  duplicate: 'Mevcut',
  saved:     'Kaydedildi',
  error:     'Hata',
};

const METHOD_LABELS = {
  '=':   '=',
  '→':   '→',
  '–':   '–',
  ':':   ':',
  '|':   '|',
  ',':   ',',
  '()':  '()',
  'tab': '⇥',
  '?':   '?',
  'blok':'☰',
};

/* ═══════════════════════════════════════════════════════════
   RENDER
   ═══════════════════════════════════════════════════════════ */
function renderTable() {
  const tbody = document.getElementById("entryTbody");
  if (!tbody) return;
  tbody.innerHTML = '';

  entries.forEach(e => {
    const tr = document.createElement('tr');
    tr.dataset.id     = e.id;
    tr.dataset.status = e.status;
    tr.className      = e.selected ? '' : 'row--deselected';

    tr.innerHTML = `
      <td class="td-check">
        <label class="cb-wrap">
          <input type="checkbox" class="row-check" ${e.selected ? 'checked' : ''}>
          <span class="cb-box"></span>
        </label>
      </td>
      <td class="td-de">
        <input class="cell-input de-input" value="${escHtml(e.de)}" placeholder="Almanca kelime…" spellcheck="false">
      </td>
      <td class="td-arrow">
        <span class="method-badge">${METHOD_LABELS[e.method] || e.method}</span>
      </td>
      <td class="td-tr">
        <input class="cell-input tr-input" value="${escHtml(e.tr)}" placeholder="Türkçe anlam…" spellcheck="false">
      </td>
      <td class="td-status">
        <span class="status-badge status-badge--${e.status}">${STATUS_LABELS[e.status]}</span>
      </td>
      <td class="td-del">
        <button class="del-btn" title="Sil">✕</button>
      </td>
    `;

    /* Checkbox */
    tr.querySelector('.row-check').addEventListener('change', ev => {
      const entry = entries.find(x => x.id === e.id);
      if (entry) entry.selected = ev.target.checked;
      tr.classList.toggle('row--deselected', !ev.target.checked);
      updateBar();
    });

    /* DE input */
    tr.querySelector('.de-input').addEventListener('input', ev => {
      const entry = entries.find(x => x.id === e.id);
      if (entry) {
        entry.de     = ev.target.value;
        entry.status = isDuplicate(entry.de) ? 'duplicate' : 'new';
        updateRowStatus(e.id, entry.status);
      }
      updateBar();
    });

    /* TR input */
    tr.querySelector('.tr-input').addEventListener('input', ev => {
      const entry = entries.find(x => x.id === e.id);
      if (entry) entry.tr = ev.target.value;
      updateBar();
    });

    /* Sil */
    tr.querySelector('.del-btn').addEventListener('click', () => {
      entries = entries.filter(x => x.id !== e.id);
      tr.remove();
      updateBar();
    });

    tbody.appendChild(tr);
  });

  updateBar();
}

/* ─── Üst bilgi çubuğunu güncelle ───────────────────────── */
function updateBar() {
  const total   = entries.length;
  const selCount = entries.filter(e => e.selected).length;
  const missingTr = entries.filter(e => e.selected && !e.tr).length;
  const dupCount  = entries.filter(e => e.status === 'duplicate').length;
  const savedCnt  = entries.filter(e => e.status === 'saved').length;

  setText('barTotal',   total);
  setText('barSel',     selCount);
  setText('barMissing', missingTr);
  setText('barDup',     dupCount);
  setText('barSaved',   savedCnt);

  const saveBtn = document.getElementById("btnSave");
  if (saveBtn) saveBtn.textContent = `Seçilileri Kaydet (${getSelectCount()})`;

  const transBtn = document.getElementById("btnAutoTranslate");
  if (transBtn) transBtn.textContent = `Eksikleri Otomatik Çevir${missingTr ? ` (${missingTr})` : ''}`;
}

function getSelectCount() {
  return entries.filter(e => e.selected && e.de && e.tr && e.status !== 'saved').length;
}

/* ─── Özet banner ───────────────────────────────────────── */
function showSummary(saved, skipped, errors) {
  const el = document.getElementById("saveSummary");
  if (!el) return;

  let html = `<span class="sum-item sum-ok">✓ ${saved} kelime kaydedildi</span>`;
  if (skipped) html += `<span class="sum-item sum-warn">⚠ ${skipped} zaten mevcuttu</span>`;
  if (errors)  html += `<span class="sum-item sum-err">✕ ${errors} hata</span>`;

  el.innerHTML = html;
  el.style.display = 'flex';
  setTimeout(() => el.classList.add('sum--visible'), 10);
}

/* ═══════════════════════════════════════════════════════════
   FAZA GEÇİŞ
   ═══════════════════════════════════════════════════════════ */
function showPhase(n) {
  document.querySelectorAll('.phase').forEach((el, i) => {
    el.classList.toggle('phase--active', i + 1 === n);
  });
}

/* ═══════════════════════════════════════════════════════════
   ANA KONTROL
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* ── Faza 1: Giriş ── */
  const textarea   = document.getElementById('inputArea');
  const parseBtn   = document.getElementById('btnParse');
  const charCount  = document.getElementById('inputCharCount');
  const lineCount  = document.getElementById('inputLineCount');
  document.getElementById('previewClose')?.addEventListener('click', closePreviewModal);
  document.getElementById('previewCancel')?.addEventListener('click', closePreviewModal);
  document.getElementById('previewBackdrop')?.addEventListener('click', closePreviewModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePreviewModal(); });

  textarea?.addEventListener('input', () => {
    const val  = textarea.value;
    const lines = val.split('\n').filter(l => l.trim()).length;
    if (charCount) charCount.textContent = val.length;
    if (lineCount) lineCount.textContent = lines + ' satır';
  });

  parseBtn?.addEventListener('click', () => {
    const raw = textarea?.value || '';
    if (!raw.trim()) { showToast("Liste boş!", "err"); return; }

    const parsed = parseInput(raw);
    if (!parsed.length) { showToast("Kelime bulunamadı!", "err"); return; }
    openPreviewModal(parsed);

    /* Tümünü seç butonu */
    document.getElementById("btnSelectAll")?.addEventListener('click', () => {
      entries.forEach(e => e.selected = true);
      document.querySelectorAll('.row-check').forEach(cb => cb.checked = true);
      document.querySelectorAll('tr[data-id]').forEach(r => r.classList.remove('row--deselected'));
      updateBar();
    });

    document.getElementById("btnSelectNone")?.addEventListener('click', () => {
      entries.forEach(e => e.selected = false);
      document.querySelectorAll('.row-check').forEach(cb => cb.checked = false);
      document.querySelectorAll('tr[data-id]').forEach(r => r.classList.add('row--deselected'));
      updateBar();
    });

    document.getElementById("btnSelectNew")?.addEventListener('click', () => {
      entries.forEach(e => { e.selected = e.status !== 'duplicate'; });
      document.querySelectorAll('tr[data-id]').forEach(row => {
        const id  = parseInt(row.dataset.id);
        const e   = entries.find(x => x.id === id);
        const cb  = row.querySelector('.row-check');
        if (cb)   cb.checked = e?.selected || false;
        row.classList.toggle('row--deselected', !e?.selected);
      });
      updateBar();
    });
  });

  /* ── Faza 2: İnceleme ── */
  document.getElementById("btnAutoTranslate")?.addEventListener('click', autoTranslateMissing);

  document.getElementById("btnSave")?.addEventListener('click', saveSelected);

  document.getElementById("btnBackToInput")?.addEventListener('click', () => {
    entries = [];
    uidCounter = 0;
    showPhase(1);
    const sum = document.getElementById("saveSummary");
    if (sum) { sum.style.display = 'none'; sum.classList.remove('sum--visible'); }
  });

  document.getElementById("goSingleAdd")?.addEventListener('click', () => {
    window.location.href = '../singleadd/';
  });

});

/* ═══════════════════════════════════════════════════════════
   YARDIMCILAR
   ═══════════════════════════════════════════════════════════ */
function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function showToast(msg, type = '') {
  let toast = document.getElementById('_toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = '_toast';
    toast.className = 'wa-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className   = `wa-toast wa-toast--show${type ? ' wa-toast--' + type : ''}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('wa-toast--show'), 2800);
}
function closePreviewModal() {
  document.getElementById('previewModal')?.classList.remove('open');
}

function openPreviewModal(parsed) {
  const modal = document.getElementById('previewModal');
  const body  = document.getElementById('previewBody');
  if (!modal || !body) return;

  body.innerHTML = '';

  parsed.forEach(e => {
    const isDup = isDuplicate(e.de);
    const noTr  = !e.tr;

    const row = document.createElement('div');
    row.className = 'pv-row';

    let statusClass, statusLabel;
    if (isDup)       { statusClass = 'pv-status--dup';  statusLabel = 'Mevcut'; }
    else if (noTr)   { statusClass = 'pv-status--miss'; statusLabel = 'Çevirisiz'; }
    else             { statusClass = 'pv-status--new';  statusLabel = 'Yeni'; }

    row.innerHTML = `
      <span class="pv-de">${escHtml(e.de)}</span>
      <span class="pv-sep">→</span>
      <span class="pv-tr${noTr ? ' pv-tr--empty' : ''}">${noTr ? 'çeviri yok' : escHtml(e.tr)}</span>
      <span class="pv-status ${statusClass}">${statusLabel}</span>
    `;
    body.appendChild(row);
  });

  const total = parsed.length;
  const dups  = parsed.filter(e => isDuplicate(e.de)).length;
  const miss  = parsed.filter(e => !e.tr).length;
  const yeni  = total - dups;

  const sum = document.createElement('div');
  sum.className = 'pv-summary';
  sum.innerHTML = `
    <span class="pv-sum-chip" style="background:rgba(79,214,156,.1);color:#4fd69c;border:1px solid rgba(79,214,156,.2)">${yeni} yeni</span>
    ${dups ? `<span class="pv-sum-chip" style="background:rgba(96,200,240,.1);color:#60c8f0;border:1px solid rgba(96,200,240,.2)">${dups} mevcut</span>` : ''}
    ${miss ? `<span class="pv-sum-chip" style="background:rgba(255,210,80,.1);color:#ffd250;border:1px solid rgba(255,210,80,.2)">${miss} çevirisiz</span>` : ''}
  `;
  body.appendChild(sum);

  modal.classList.add('open');

  document.getElementById('previewConfirm').onclick = () => {
    closePreviewModal();
    entries = parsed;
    reCheckDuplicates();
    renderTable();
    showPhase(2);
  };
}