/**
 * authGate.js
 * Kullanıcı verisi gerektiren aksiyonlar için
 * güzel bir "giriş yap" overlay/banner gösterir.
 *
 * Kullanım:
 *   import { showAuthGate, requireAuthFor } from '../src/components/authGate.js';
 *
 *   // Bir butona bağlamak için:
 *   requireAuthFor(document.getElementById('saveBtn'), () => doSave(), {
 *     title: 'Kelime kaydetmek için giriş yap',
 *     desc: 'Sözlüğüne kelime eklemek ücretsiz — sadece bir Google hesabı yeterli.'
 *   });
 *
 *   // Direkt açmak için:
 *   showAuthGate({ title: '...', desc: '...' });
 */

import { onAuthChange } from '../../js/firebase.js';

/* ── Aktif kullanıcı cache ── */
let _currentUser = null;
onAuthChange(u => { _currentUser = u; });

/* ── CSS (bir kez inject) ── */
let _styleInjected = false;
function injectStyle() {
  if (_styleInjected) return;
  _styleInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    /* ══ Auth Gate Overlay ══ */
    .ag-backdrop {
      position: fixed; inset: 0; z-index: 8888;
      background: rgba(7,7,9,0.72);
      backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      animation: ag-fadeIn 0.2s ease both;
    }
    @keyframes ag-fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .ag-card {
      background: #0f0f14;
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 20px;
      padding: 36px 32px 28px;
      width: 100%; max-width: 400px;
      box-shadow: 0 32px 80px rgba(0,0,0,0.7),
                  0 0 0 1px rgba(255,255,255,0.04);
      animation: ag-slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1) both;
      position: relative;
    }
    @keyframes ag-slideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .ag-icon {
      width: 48px; height: 48px;
      border-radius: 14px;
      background: rgba(201,168,76,0.1);
      border: 1px solid rgba(201,168,76,0.2);
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 18px;
    }
    .ag-icon svg { width: 22px; height: 22px; stroke: #c9a84c; }

    .ag-title {
      font-family: 'Syne', sans-serif;
      font-size: 18px; font-weight: 800;
      letter-spacing: -0.02em;
      color: #f0eee8;
      margin: 0 0 8px;
    }

    .ag-desc {
      font-family: 'DM Sans', sans-serif;
      font-size: 13.5px; line-height: 1.7;
      color: rgba(240,238,232,0.5);
      margin: 0 0 24px;
    }

    .ag-btn-google {
      display: flex; align-items: center; justify-content: center;
      gap: 10px; width: 100%;
      padding: 12px 0;
      background: #fff; color: #1f1f1f;
      border: none; border-radius: 10px;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px; font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 12px rgba(0,0,0,0.25);
      transition: box-shadow 0.2s, transform 0.15s;
      margin-bottom: 10px;
      text-decoration: none;
    }
    .ag-btn-google:hover {
      box-shadow: 0 6px 24px rgba(0,0,0,0.35);
      transform: translateY(-1px);
    }
    .ag-btn-google:active { transform: scale(0.98); }
    .ag-btn-google svg { width: 18px; height: 18px; flex-shrink: 0; }

    .ag-divider {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 10px;
    }
    .ag-divider::before, .ag-divider::after {
      content: ''; flex: 1; height: 1px;
      background: rgba(255,255,255,0.07);
    }
    .ag-divider span {
      font-size: 11px; color: rgba(240,238,232,0.3);
      font-family: 'DM Sans', sans-serif;
    }

    .ag-btn-dismiss {
      display: block; width: 100%; padding: 11px 0;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      color: rgba(240,238,232,0.4);
      font-family: 'DM Sans', sans-serif;
      font-size: 13px; font-weight: 500;
      cursor: pointer; transition: all 0.2s;
    }
    .ag-btn-dismiss:hover {
      background: rgba(255,255,255,0.04);
      color: rgba(240,238,232,0.7);
      border-color: rgba(255,255,255,0.14);
    }

    .ag-close {
      position: absolute; top: 16px; right: 16px;
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 8px; cursor: pointer;
      color: rgba(240,238,232,0.35);
      font-size: 14px; line-height: 1;
      transition: all 0.15s;
    }
    .ag-close:hover {
      background: rgba(255,255,255,0.06);
      color: rgba(240,238,232,0.7);
    }

    /* ══ Inline Banner (sayfa içinde) ══ */
    .ag-banner {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 18px;
      background: rgba(201,168,76,0.06);
      border: 1px solid rgba(201,168,76,0.18);
      border-radius: 12px;
      animation: ag-fadeIn 0.25s ease both;
    }

    .ag-banner__icon {
      width: 36px; height: 36px; flex-shrink: 0;
      border-radius: 10px;
      background: rgba(201,168,76,0.1);
      display: flex; align-items: center; justify-content: center;
    }
    .ag-banner__icon svg { width: 16px; height: 16px; stroke: #c9a84c; }

    .ag-banner__body { flex: 1; min-width: 0; }
    .ag-banner__title {
      font-family: 'DM Sans', sans-serif;
      font-size: 13px; font-weight: 600;
      color: #f0eee8; margin-bottom: 2px;
    }
    .ag-banner__desc {
      font-family: 'DM Sans', sans-serif;
      font-size: 12px; color: rgba(240,238,232,0.45);
      line-height: 1.5;
    }

    .ag-banner__btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; flex-shrink: 0;
      background: linear-gradient(135deg, #c9a84c, #e8c97a);
      color: #0a0a0f;
      border: none; border-radius: 8px;
      font-family: 'DM Sans', sans-serif;
      font-size: 12px; font-weight: 700;
      cursor: pointer; text-decoration: none;
      transition: all 0.2s; white-space: nowrap;
    }
    .ag-banner__btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(201,168,76,0.4);
    }
    .ag-banner__btn:active { transform: scale(0.97); }

    @media (max-width: 480px) {
      .ag-card { padding: 28px 20px 22px; border-radius: 16px; }
      .ag-banner { flex-wrap: wrap; }
      .ag-banner__btn { width: 100%; justify-content: center; }
    }
  `;
  document.head.appendChild(style);
}

/* ── Google SVG ── */
const GOOGLE_SVG = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>`;

const LOCK_SVG = `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
</svg>`;

/* ════════════════════════════════════════════════
   showAuthGate — tam ekran overlay
════════════════════════════════════════════════ */
export function showAuthGate({
  title  = 'Bu özellik için giriş yap',
  desc   = 'Devam etmek için ücretsiz hesabına giriş yapman yeterli.',
  onDismiss = null
} = {}) {
  injectStyle();

  /* Zaten açıksa açma */
  if (document.querySelector('.ag-backdrop')) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'ag-backdrop';

  const loginHref = getLoginHref();

  backdrop.innerHTML = `
    <div class="ag-card" role="dialog" aria-modal="true" aria-label="${title}">
      <button class="ag-close" id="agClose" aria-label="Kapat">✕</button>
      <div class="ag-icon">${LOCK_SVG}</div>
      <h2 class="ag-title">${title}</h2>
      <p class="ag-desc">${desc}</p>
      <a class="ag-btn-google" href="${loginHref}">
        ${GOOGLE_SVG}
        Google ile Giriş Yap
      </a>
      <div class="ag-divider"><span>veya</span></div>
      <button class="ag-btn-dismiss" id="agDismiss">Şimdilik devam et</button>
    </div>
  `;

  document.body.appendChild(backdrop);

  const close = () => {
    backdrop.style.animation = 'ag-fadeIn 0.15s ease reverse both';
    setTimeout(() => backdrop.remove(), 150);
    onDismiss?.();
  };

  backdrop.querySelector('#agClose').addEventListener('click', close);
  backdrop.querySelector('#agDismiss').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

/* ════════════════════════════════════════════════
   showAuthBanner — sayfa içi satır içi banner
   container: HTMLElement — bannerin ekleneceği yer
════════════════════════════════════════════════ */
export function showAuthBanner(container, {
  title = 'Giriş yap',
  desc  = 'Bu özelliği kullanmak için giriş yapman gerekiyor.',
  btnLabel = 'Giriş Yap →'
} = {}) {
  injectStyle();

  /* Zaten varsa ekleme */
  if (container.querySelector('.ag-banner')) return;

  const loginHref = getLoginHref();

  const banner = document.createElement('div');
  banner.className = 'ag-banner';
  banner.innerHTML = `
    <div class="ag-banner__icon">${LOCK_SVG}</div>
    <div class="ag-banner__body">
      <div class="ag-banner__title">${title}</div>
      <div class="ag-banner__desc">${desc}</div>
    </div>
    <a class="ag-banner__btn" href="${loginHref}">${btnLabel}</a>
  `;

  container.appendChild(banner);
  return banner;
}

/* ════════════════════════════════════════════════
   requireAuthFor — bir elementi auth kapısına bağla
   Kullanıcı giriş yapmamışsa tıklamayı yakalar ve
   showAuthGate açar.
════════════════════════════════════════════════ */
export function requireAuthFor(element, action, gateOptions = {}) {
  if (!element) return;

  element.addEventListener('click', (e) => {
    if (_currentUser) {
      action(e);
    } else {
      e.preventDefault();
      e.stopPropagation();
      showAuthGate(gateOptions);
    }
  });
}

/* ════════════════════════════════════════════════
   isLoggedIn — sync check
════════════════════════════════════════════════ */
export function isLoggedIn() {
  return !!_currentUser;
}

/* ── Login sayfası path'ini bul ── */
function getLoginHref() { return '/login.html'; }