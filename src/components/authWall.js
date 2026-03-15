/**
 * authWall.js
 * Tamamen private sayfalar için (kelimeler, gecmis, wordsadd, singleadd)
 * requireAuth() yerine kullanılır.
 * Sayfanın içeriğini göstermez, güzel bir "giriş yap" ekranı gösterir.
 *
 * Kullanım — her private sayfanın script bloğuna:
 *
 *   import { initAuthWall } from '../src/components/authWall.js';
 *   initAuthWall({
 *     icon: '📖',
 *     title: 'Kelimelerini görmek için giriş yap',
 *     desc: 'Kişisel sözlüğün seni bekliyor.'
 *   });
 */

import { onAuthChange } from '../../js/firebase.js';

let _style_injected = false;

function injectStyle() {
  if (_style_injected) return;
  _style_injected = true;
  const s = document.createElement('style');
  s.textContent = `
    .aw-wall {
      position: fixed; inset: 0; z-index: 9000;
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      background: #070709;
    }

    .aw-wall::before {
      content: '';
      position: fixed; inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black 20%, transparent 100%);
      pointer-events: none;
    }

    .aw-wall::after {
      content: '';
      position: fixed;
      width: 500px; height: 500px;
      top: -150px; left: -100px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(201,168,76,0.07), transparent 70%);
      filter: blur(80px);
      pointer-events: none;
    }

    .aw-card {
      position: relative; z-index: 1;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 24px;
      padding: 48px 40px 40px;
      width: 100%; max-width: 420px;
      text-align: center;
      box-shadow: 0 40px 100px rgba(0,0,0,0.5);
      animation: awSlide 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
    }

    @keyframes awSlide {
      from { opacity: 0; transform: translateY(28px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .aw-icon {
      font-size: 44px;
      margin-bottom: 20px;
      display: block;
      animation: awFloat 4s ease-in-out infinite;
    }
    @keyframes awFloat {
      0%,100% { transform: translateY(0); }
      50%      { transform: translateY(-8px); }
    }

    .aw-title {
      font-family: 'Syne', sans-serif;
      font-size: 22px; font-weight: 800;
      letter-spacing: -0.025em; line-height: 1.2;
      color: #f0eee8;
      margin: 0 0 10px;
    }

    .aw-desc {
      font-family: 'DM Sans', sans-serif;
      font-size: 14px; line-height: 1.7;
      color: rgba(240,238,232,0.45);
      margin: 0 0 32px;
    }

    .aw-btn-google {
      display: flex; align-items: center; justify-content: center;
      gap: 10px; width: 100%; padding: 13px;
      background: #fff; color: #1f1f1f;
      border: none; border-radius: 12px;
      font-family: 'DM Sans', sans-serif;
      font-size: 14.5px; font-weight: 600;
      cursor: pointer; text-decoration: none;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      transition: box-shadow 0.2s, transform 0.15s;
      margin-bottom: 10px;
    }
    .aw-btn-google:hover {
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      transform: translateY(-1px);
    }
    .aw-btn-google svg { width: 18px; height: 18px; }

    .aw-divider {
      display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
    }
    .aw-divider::before, .aw-divider::after {
      content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.07);
    }
    .aw-divider span {
      font-size: 11px; color: rgba(240,238,232,0.25);
      font-family: 'DM Sans', sans-serif;
    }

    .aw-btn-back {
      display: block; width: 100%; padding: 12px;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      color: rgba(240,238,232,0.4);
      font-family: 'DM Sans', sans-serif;
      font-size: 13.5px; font-weight: 500;
      cursor: pointer; transition: all 0.2s;
      text-decoration: none;
    }
    .aw-btn-back:hover {
      background: rgba(255,255,255,0.04);
      color: rgba(240,238,232,0.7);
      border-color: rgba(255,255,255,0.14);
    }

    .aw-features {
      display: flex; gap: 8px; justify-content: center;
      margin-bottom: 28px; flex-wrap: wrap;
    }
    .aw-feature {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 5px 12px;
      background: rgba(201,168,76,0.07);
      border: 1px solid rgba(201,168,76,0.15);
      border-radius: 999px;
      font-family: 'DM Sans', sans-serif;
      font-size: 11.5px; color: rgba(201,168,76,0.8);
    }
    .aw-feature::before { content: '✓'; font-weight: 700; }

    @media (max-width: 480px) {
      .aw-card { padding: 36px 24px 32px; border-radius: 20px; }
    }
  `;
  document.head.appendChild(s);
}

const GOOGLE_SVG = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>`;

export function initAuthWall({
  icon     = '🔒',
  title    = 'Bu sayfa için giriş yap',
  desc     = 'Devam etmek için ücretsiz hesabına giriş yap.',
  features = [],
  backHref = '../anasayfa/'
} = {}) {
  injectStyle();

  const loginHref = getLoginHref();

  onAuthChange((user) => {
    if (user) {
      /* Giriş yapılmış — duvarı kaldır */
      document.getElementById('__awWall')?.remove();
      return;
    }

    /* Zaten duvar varsa tekrar ekleme */
    if (document.getElementById('__awWall')) return;

    const featuresHtml = features.length
      ? `<div class="aw-features">${features.map(f => `<span class="aw-feature">${f}</span>`).join('')}</div>`
      : '';

    const wall = document.createElement('div');
    wall.className = 'aw-wall';
    wall.id = '__awWall';
    wall.innerHTML = `
      <div class="aw-card">
        <span class="aw-icon">${icon}</span>
        <h1 class="aw-title">${title}</h1>
        <p class="aw-desc">${desc}</p>
        ${featuresHtml}
        <a class="aw-btn-google" href="${loginHref}">
          ${GOOGLE_SVG}
          Google ile Ücretsiz Giriş Yap
        </a>
        <div class="aw-divider"><span>veya</span></div>
        <a class="aw-btn-back" href="${backHref}">← Ana Sayfaya Dön</a>
      </div>
    `;

    document.body.appendChild(wall);
  });
}

function getLoginHref() { return '/login.html'; }