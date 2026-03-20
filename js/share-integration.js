/**
 * integration/share-integration.js
 * ─────────────────────────────────────────────────────────────────────────
 * Drop this into your existing seviyetespit page AFTER seviyetespit.js.
 *
 * What it does:
 *  1. Listens for the `svt:result` custom event fired by showResult()
 *  2. POSTs the result to /api/results on your share server
 *  3. Injects share buttons + share URL into the existing result screen
 *
 * Configuration:
 *  - Set SHARE_SERVER to the base URL of your Node.js share server.
 *    If you serve it from the same domain, leave it as '' (empty string).
 *
 * Usage:
 *  <script src="integration/share-integration.js" defer></script>
 */

(function () {
  // ── Config ────────────────────────────────────────────────────────────
  // Same domain: ''   |   Different domain: 'https://api.almancapratik.com'
  const SHARE_SERVER = 'http://localhost:3001';

  // ── Styles injected once ──────────────────────────────────────────────
  const CSS = `
  .svt-share-wrap {
    margin-top: 24px;
    padding: 20px 0 0;
    border-top: 1px solid rgba(255,255,255,0.07);
  }
  .svt-share-label {
    font-family: var(--fm, monospace);
    font-size: 10px; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: rgba(240,238,232,0.32);
    margin-bottom: 10px;
  }
  .svt-share-url-row {
    display: flex; gap: 8px; margin-bottom: 12px; align-items: center;
  }
  .svt-share-url-input {
    flex: 1; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; padding: 9px 12px;
    font-family: var(--fm, monospace); font-size: 12px;
    color: rgba(240,238,232,0.6);
    outline: none; cursor: text;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .svt-btn-copy {
    padding: 9px 16px; border-radius: 8px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(240,238,232,0.7);
    font-size: 12px; font-weight: 600; cursor: pointer;
    transition: all 0.2s; white-space: nowrap;
    font-family: var(--fb, sans-serif);
  }
  .svt-btn-copy:hover { background: rgba(255,255,255,0.09); color: #f0eee8; }
  .svt-btn-copy.ok   { border-color: rgba(34,197,94,0.4); color: #22c55e; }
  .svt-share-btns {
    display: flex; gap: 8px; flex-wrap: wrap;
  }
  .svt-share-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 10px 16px; border-radius: 8px;
    font-size: 13px; font-weight: 600; cursor: pointer;
    text-decoration: none; border: none; transition: all 0.2s;
    font-family: var(--fb, sans-serif);
  }
  .svt-share-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
  .svt-btn-wa   { background: #25D366; color: #fff; }
  .svt-btn-wa:hover { background: #20b858; transform: translateY(-1px); }
  .svt-btn-tw   { background: #000; color: #fff; border: 1px solid rgba(255,255,255,0.15); }
  .svt-btn-tw:hover { background: #111; transform: translateY(-1px); }
  .svt-btn-native {
    background: linear-gradient(135deg,#c9a84c,#e8c97a);
    color: #0a0a0f; display: none;
  }
  .svt-btn-native:hover { transform: translateY(-1px); }
  .svt-share-loading {
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; color: rgba(240,238,232,0.4);
    font-family: var(--fb, sans-serif);
  }
  .svt-spinner {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid rgba(201,168,76,0.25);
    border-top-color: #c9a84c;
    animation: svt-spin 0.7s linear infinite;
  }
  @keyframes svt-spin { to { transform: rotate(360deg); } }
  `;

  let styleInjected = false;
  function injectStyles() {
    if (styleInjected) return;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
    styleInjected = true;
  }

  // ── Listen for test result ─────────────────────────────────────────────
  document.addEventListener('svt:result', async function handler(e) {
    const { score, wrongs } = e.detail;

    // Figure out the level from score (mirrors LEVELS array logic)
    const THRESHOLDS = [
      { max:  7, level: 'A1', levelName: 'Başlangıç' },
      { max: 12, level: 'A2', levelName: 'Temel'     },
      { max: 17, level: 'B1', levelName: 'Orta'      },
      { max: 22, level: 'B2', levelName: 'Üst Orta'  },
      { max: 25, level: 'C1', levelName: 'İleri'     },
    ];
    const lvEntry = THRESHOLDS.find(t => score <= t.max) || THRESHOLDS[THRESHOLDS.length - 1];
    const total = 25;

    injectStyles();

    // Find or create the mount point inside the result screen
    let mount = document.getElementById('svt-share-mount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'svt-share-mount';
      const actions = document.querySelector('.result-actions');
      if (actions && actions.parentNode) {
        actions.parentNode.insertBefore(mount, actions.nextSibling);
      } else {
        const resultPage = document.querySelector('.result-page');
        if (resultPage) resultPage.appendChild(mount);
        else document.body.appendChild(mount);
      }
    }

    // Show loading state
    mount.innerHTML = `
      <div class="svt-share-wrap">
        <div class="svt-share-label">Paylaşılabilir link oluşturuluyor</div>
        <div class="svt-share-loading">
          <div class="svt-spinner"></div>
          <span>Sonucun kaydediliyor…</span>
        </div>
      </div>`;

    try {
      const res = await fetch(`${SHARE_SERVER}/api/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score,
          level: lvEntry.level,
          levelName: lvEntry.levelName,
          total,
          wrongs: (wrongs || []).map(w => ({
            question: w.q?.q || '',
            selected: w.selected,
            correct: w.q?.answer ?? -1,
          })),
        }),
      });

      if (!res.ok) throw new Error('Server responded with ' + res.status);
      const { shareUrl } = await res.json();

      renderShareUI(mount, shareUrl, lvEntry.level, score, total);
    } catch (err) {
      console.error('[share-integration]', err);
      mount.innerHTML = `
        <div class="svt-share-wrap">
          <div class="svt-share-label" style="color:rgba(239,68,68,0.7)">
            Paylaşma linki oluşturulamadı. Lütfen daha sonra tekrar dene.
          </div>
        </div>`;
    }
  });

  // ── Render share UI ────────────────────────────────────────────────────
  function renderShareUI(mount, shareUrl, level, score, total) {
    const shareText = encodeURIComponent(
      `Almanca seviye testinde ${score}/${total} puan aldım, seviyem ${level}! 🎯 Sen de dene:`
    );
    const waUrl  = `https://wa.me/?text=${shareText}%20${encodeURIComponent(shareUrl)}`;
    const twUrl  = `https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(shareUrl)}`;
    const hasNative = !!navigator.share;

    mount.innerHTML = `
      <div class="svt-share-wrap">
        <div class="svt-share-label">Sonucunu paylaş</div>

        <div class="svt-share-url-row">
          <input class="svt-share-url-input" id="svt-url-input"
                 value="${esc(shareUrl)}" readonly
                 onclick="this.select()" aria-label="Paylaşma linki"/>
          <button class="svt-btn-copy" id="svt-copy-btn" onclick="svtCopyLink()">
            Kopyala
          </button>
        </div>

        <div class="svt-share-btns">
          <a class="svt-share-btn svt-btn-wa" href="${esc(waUrl)}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </a>

          <a class="svt-share-btn svt-btn-tw" href="${esc(twUrl)}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Twitter / X
          </a>

          <button class="svt-share-btn svt-btn-native"
                  id="svt-native-btn"
                  style="display:${hasNative ? 'inline-flex' : 'none'}"
                  onclick="svtNativeShare()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Paylaş
          </button>
        </div>
      </div>`;

    // Expose helpers to global scope (needed for inline onclick)
    window.svtCopyLink = function () {
      navigator.clipboard.writeText(shareUrl).then(() => {
        const btn = document.getElementById('svt-copy-btn');
        if (btn) { btn.textContent = '✓ Kopyalandı'; btn.classList.add('ok'); }
        setTimeout(() => {
          if (btn) { btn.textContent = 'Kopyala'; btn.classList.remove('ok'); }
        }, 2000);
      }).catch(() => {
        const inp = document.getElementById('svt-url-input');
        if (inp) { inp.select(); document.execCommand('copy'); }
      });
    };

    window.svtNativeShare = function () {
      if (!navigator.share) return;
      navigator.share({
        title: `Almanca Seviyem: ${level}`,
        text: `Almanca seviye testinde ${score}/${total} puan aldım, seviyem ${level}!`,
        url: shareUrl,
      }).catch(() => {});
    };
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();