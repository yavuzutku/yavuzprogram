import { auth, logoutFirebase, onAuthChange } from "./firebase.js";

/* ─────────────────────────────────────────────
   requireAuth — sayfayı giriş yapmış kullanıcıya kısıtla
───────────────────────────────────────────── */
function requireAuth() {
  const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  onAuthChange((user) => {
    if (!user && !isLocal) window.location.href = "/login.html";
  });
}

/* ─────────────────────────────────────────────
   loadNavbar — YAN NAVBAR (eski top bar kaldırıldı)
   • Masaüstü: fixed left sidebar (260px)
   • Mobil:    gizli + hamburger açar
   • Tüm eski işlev korundu:
       Dersler accordion, auth state, logout,
       aktif sayfa vurgulama
───────────────────────────────────────────── */
function loadNavbar() {
  if (document.getElementById("sideNav")) return;

  /* ── Aktif sayfa tespiti ── */
  const p          = window.location.pathname;
  const isDersler  = p.includes("/dersler");
  const isBlog     = p.includes("/blog");
  const isMetin    = p.includes("/metin");
  const isArtikel  = p.includes("/artikel/");
  const isCumle    = p.includes("/cumlebul/");
  const isFiil     = p.includes("/fiil");
  const isQuiz     = p.includes("/quiz");
  const isKelimeler= p.includes("/kelimeler");

  /* ══════════════════════════════════════════
     STYLES
  ══════════════════════════════════════════ */
  const style = document.createElement("style");
  style.textContent = `
    /* ── Değişkenler ── */
    :root {
      --sn-w:        260px;
      --sn-mobile-h: 58px;
      --sn-bg:       rgba(10, 15, 30, 0.97);
      --sn-surf:     #171f33;
      --sn-surf-h:   rgba(34, 42, 61, 0.75);
      --sn-border:   rgba(67, 70, 85, 0.38);
      --sn-text:     #dae2fd;
      --sn-muted:    #6b7280;
      --sn-primary:  #b4c5ff;
      --sn-pc:       #2563eb;
      --sn-pc-on:    #eeefff;
      --sn-radius:   11px;
      --sn-tr:       0.17s ease;
    }

    /* ── Body offset ── */
    body.has-sidenav {
      padding-left: var(--sn-w) !important;
      min-height: 100vh;
    }
    @media (max-width: 680px) {
      body.has-sidenav {
        padding-left: 0 !important;
        padding-top: var(--sn-mobile-h) !important;
      }
    }

    /* ══════════════════════
       SIDE NAV SHELL
    ══════════════════════ */
    #sideNav {
      position: fixed;
      inset: 0 auto 0 0;
      width: var(--sn-w);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      background: var(--sn-bg);
      backdrop-filter: blur(28px) saturate(180%);
      -webkit-backdrop-filter: blur(28px) saturate(180%);
      border-right: 1px solid var(--sn-border);
      border-radius: 0 20px 20px 0;
      overflow: hidden;
      transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* ── Logo Wrap ── */
    .sn-logo-wrap {
      padding: 18px 14px 14px;
      border-bottom: 1px solid var(--sn-border);
      flex-shrink: 0;
    }
    .sn-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
    }
    .sn-favicon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .sn-brand-name {
      font-family: 'Manrope', 'DM Sans', system-ui, sans-serif;
      font-size: 15px;
      font-weight: 800;
      color: var(--sn-text);
      letter-spacing: -0.03em;
      line-height: 1.1;
    }
    .sn-brand-accent { color: var(--sn-primary); }
    .sn-brand-tag {
      display: block;
      font-family: 'Space Grotesk', 'DM Mono', monospace;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--sn-muted);
      margin-top: 2px;
    }

    /* ── Scroll Area ── */
    .sn-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 10px 10px 6px;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .sn-scroll::-webkit-scrollbar { width: 3px; }
    .sn-scroll::-webkit-scrollbar-track { background: transparent; }
    .sn-scroll::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.07);
      border-radius: 3px;
    }

    /* ── Section Label ── */
    .sn-sec-label {
      font-family: 'Space Grotesk', monospace;
      font-size: 9.5px;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--sn-muted);
      padding: 10px 12px 3px;
    }

    /* ── Nav Item (link + button) ── */
    .sn-item {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 9px 12px;
      border-radius: var(--sn-radius);
      font-family: 'Manrope', 'DM Sans', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: rgba(195, 198, 215, 0.72);
      text-decoration: none;
      cursor: pointer;
      border: none;
      background: transparent;
      width: 100%;
      text-align: left;
      transition: background var(--sn-tr), color var(--sn-tr);
      letter-spacing: -0.01em;
      position: relative;
    }
    .sn-item svg {
      flex-shrink: 0;
      opacity: 0.6;
      transition: opacity var(--sn-tr);
    }
    .sn-item:hover {
      color: var(--sn-text);
      background: var(--sn-surf-h);
    }
    .sn-item:hover svg { opacity: 1; }

    /* Aktif item */
    .sn-item--active {
      color: var(--sn-primary);
      background: rgba(37, 99, 235, 0.12);
    }
    .sn-item--active svg { opacity: 1; }
    .sn-item--active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 22%;
      bottom: 22%;
      width: 3px;
      background: var(--sn-pc);
      border-radius: 0 3px 3px 0;
    }

    /* ── Chevron ── */
    .sn-chevron {
      margin-left: auto;
      opacity: 0.3;
      transition: transform 0.22s ease, opacity var(--sn-tr);
    }
    .sn-group.open .sn-chevron {
      transform: rotate(180deg);
      opacity: 0.6;
    }

    /* ── Accordion Sub ── */
    .sn-sub {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.26s ease;
      padding-left: 6px;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .sn-group.open .sn-sub { max-height: 420px; }

    /* ── Level Cards ── */
    .sn-level-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 10px;
      border-radius: 9px;
      text-decoration: none;
      transition: background var(--sn-tr);
    }
    .sn-level-card:hover { background: var(--sn-surf-h); }

    .sn-lv-badge {
      font-family: 'Manrope', sans-serif;
      font-size: 10.5px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      flex-shrink: 0;
      min-width: 30px;
      text-align: center;
      letter-spacing: 0.02em;
    }
    .lv-a1 { background: rgba(34,197,94,0.1);   border: 1px solid rgba(34,197,94,0.2);   color: #4ade80; }
    .lv-a2 { background: rgba(134,239,172,0.08); border: 1px solid rgba(134,239,172,0.16); color: #86efac; }
    .lv-b1 { background: rgba(125,211,252,0.09); border: 1px solid rgba(125,211,252,0.18); color: #7dd3fc; }
    .lv-b2 { background: rgba(165,180,252,0.09); border: 1px solid rgba(165,180,252,0.18); color: #a5b4fc; }
    .lv-c1 { background: rgba(180,197,255,0.09); border: 1px solid rgba(180,197,255,0.18); color: #b4c5ff; }

    .sn-lv-title {
      font-family: 'Manrope', sans-serif;
      font-size: 12.5px;
      font-weight: 600;
      color: rgba(218, 226, 253, 0.82);
      line-height: 1.2;
    }
    .sn-lv-sub {
      font-size: 11px;
      color: var(--sn-muted);
      margin-top: 1px;
    }

    .sn-all-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 9px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(195, 198, 215, 0.42);
      text-decoration: none;
      transition: all var(--sn-tr);
      margin-top: 1px;
    }
    .sn-all-link:hover {
      background: var(--sn-surf-h);
      color: rgba(218, 226, 253, 0.78);
    }

    /* ── Divider ── */
    .sn-divider {
      height: 1px;
      background: var(--sn-border);
      margin: 5px 4px;
    }

    /* ══════════════════════
       FOOTER (CTA + AUTH)
    ══════════════════════ */
    .sn-footer {
      padding: 10px 10px 14px;
      border-top: 1px solid var(--sn-border);
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex-shrink: 0;
    }

    /* CTA Seviye Testi */
    .sn-cta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 10px 14px;
      background: var(--sn-pc);
      color: var(--sn-pc-on);
      font-family: 'Manrope', sans-serif;
      font-size: 12.5px;
      font-weight: 700;
      border-radius: 10px;
      text-decoration: none;
      letter-spacing: 0.01em;
      transition: filter var(--sn-tr), transform var(--sn-tr);
    }
    .sn-cta:hover {
      filter: brightness(1.14);
      transform: translateY(-1px);
    }

    /* Giriş Yap */
    .sn-login-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 14px;
      background: transparent;
      border: 1px solid var(--sn-border);
      border-radius: 10px;
      color: rgba(195, 198, 215, 0.7);
      font-family: 'Manrope', sans-serif;
      font-size: 12.5px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: background var(--sn-tr), color var(--sn-tr), border-color var(--sn-tr);
    }
    .sn-login-btn:hover {
      background: var(--sn-surf);
      color: var(--sn-text);
      border-color: rgba(67, 70, 85, 0.65);
    }

    /* Profile trigger */
    .sn-profile-wrap { position: relative; }
    .sn-profile-trigger {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 7px 10px;
      background: transparent;
      border: 1px solid var(--sn-border);
      border-radius: 10px;
      cursor: pointer;
      width: 100%;
      transition: background var(--sn-tr);
    }
    .sn-profile-trigger:hover { background: var(--sn-surf); }
    .sn-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      border: 1.5px solid rgba(180, 197, 255, 0.18);
    }
    .sn-profile-info { flex: 1; min-width: 0; text-align: left; }
    .sn-profile-lbl {
      font-family: 'Space Grotesk', monospace;
      font-size: 9.5px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--sn-muted);
    }
    .sn-profile-email {
      display: block;
      font-size: 11.5px;
      font-weight: 500;
      color: rgba(195, 198, 215, 0.7);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 148px;
    }

    /* Profile dropdown */
    .sn-profile-drop {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 0;
      right: 0;
      background: #0a0f1e;
      border: 1px solid var(--sn-border);
      border-radius: 12px;
      padding: 5px;
      box-shadow: 0 -18px 40px rgba(0, 0, 0, 0.55);
      display: none;
      z-index: 10;
    }
    .sn-profile-drop.open { display: block; }
    .sn-logout-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 9px 12px;
      background: transparent;
      border: none;
      border-radius: 8px;
      font-family: 'Manrope', sans-serif;
      font-size: 13px;
      font-weight: 500;
      color: rgba(240, 112, 104, 0.72);
      cursor: pointer;
      text-align: left;
      transition: background var(--sn-tr), color var(--sn-tr);
    }
    .sn-logout-btn:hover {
      background: rgba(240, 112, 104, 0.09);
      color: #f07068;
    }

    /* ══════════════════════
       MOBİL TOP BAR
    ══════════════════════ */
    #snMobileBar {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: var(--sn-mobile-h);
      z-index: 1001;
      background: rgba(10, 15, 30, 0.95);
      backdrop-filter: blur(22px) saturate(180%);
      -webkit-backdrop-filter: blur(22px) saturate(180%);
      border-bottom: 1px solid var(--sn-border);
      padding: 0 16px;
      align-items: center;
      justify-content: space-between;
    }

    /* Hamburger */
    .sn-hamburger {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 5px;
      width: 40px;
      height: 40px;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      cursor: pointer;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      flex-shrink: 0;
      transition: border-color var(--sn-tr);
    }
    .sn-hamburger span {
      display: block;
      width: 18px;
      height: 1.5px;
      background: rgba(218, 226, 253, 0.7);
      border-radius: 2px;
      transition: all 0.24s ease;
      transform-origin: center;
    }
    .sn-hamburger:hover { border-color: rgba(255,255,255,0.22); }
    .sn-hamburger.open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); }
    .sn-hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
    .sn-hamburger.open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); }

    /* Overlay */
    #snOverlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 999;
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    }
    #snOverlay.visible { display: block; }

    /* ══════════════════════
       MOBİL RESPONSIVE
    ══════════════════════ */
    @media (max-width: 680px) {
      #sideNav {
        transform: translateX(-100%);
        top: 0;
        height: 100dvh;
        z-index: 1002;
        width: min(var(--sn-w), 86vw);
        border-radius: 0 20px 20px 0;
      }
      #sideNav.mobile-open { transform: translateX(0); }
      #snMobileBar { display: flex; }
    }

    /* ══════════════════════
       FAB — MAVİ TEMA
       (global.css altın rengi eziyor)
    ══════════════════════ */
    .fab-main {
      background: linear-gradient(140deg, #1d4ed8, #3b82f6) !important;
      color: #eeefff !important;
      box-shadow: 0 4px 24px rgba(37, 99, 235, 0.45) !important;
    }
    .fab-wrapper.active .fab-main {
      background: rgba(239, 68, 68, 0.88) !important;
      box-shadow: 0 4px 20px rgba(239, 68, 68, 0.35) !important;
    }
    .fab-item-content {
      background: #0f1829 !important;
      border-color: rgba(37, 99, 235, 0.4) !important;
      color: #93c5fd !important;
    }
    .fab-label {
      background: #1d4ed8 !important;
      color: #eeefff !important;
      box-shadow: 0 4px 10px rgba(0,0,0,0.35) !important;
    }
    .fab-label::after {
      border-color: #1d4ed8 transparent transparent transparent !important;
    }
    .item-4 .fab-label::after {
      border-color: transparent transparent transparent #1d4ed8 !important;
    }
    @media (hover: hover) {
      .fab-item:hover .fab-item-content {
        background: #2563eb !important;
        color: #eeefff !important;
      }
    }
    @media (hover: none) {
      .fab-item:active .fab-item-content {
        background: #2563eb !important;
        color: #eeefff !important;
      }
    }
  `;
  document.head.appendChild(style);

  /* ── Body offset sınıfı ── */
  document.body.classList.add("has-sidenav");

  /* ══════════════════════════════════════════
     SIDE NAV HTML
  ══════════════════════════════════════════ */
  const sidenav = document.createElement("aside");
  sidenav.id = "sideNav";
  sidenav.setAttribute("aria-label", "Ana gezinti");

  sidenav.innerHTML = `
    <!-- Logo -->
    <div class="sn-logo-wrap">
      <a class="sn-logo" href="/" aria-label="AlmancaPratik ana sayfa">
        <img class="sn-favicon" src="/favicon.png" alt="" aria-hidden="true">
        <div>
          <span class="sn-brand-name">Almanca<span class="sn-brand-accent">Pratik</span></span>
          <span class="sn-brand-tag">Türkçe · Ücretsiz · A1–C1</span>
        </div>
      </a>
    </div>

    <!-- Scroll Nav -->
    <div class="sn-scroll" role="navigation" aria-label="Sayfa gezintisi">

      <!-- Dersler Accordion -->
      <div class="sn-group${isDersler ? " open" : ""}" id="snDerslerGroup">
        <button
          class="sn-item${isDersler ? " sn-item--active" : ""}"
          id="snDerslerToggle"
          aria-expanded="${isDersler ? "true" : "false"}"
          aria-controls="snDerslerSub"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <span>Dersler</span>
          <svg class="sn-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <div class="sn-sub" id="snDerslerSub" role="region" aria-label="Ders seviyeleri">
          <a class="sn-level-card" href="/dersler/?cat=A1">
            <span class="sn-lv-badge lv-a1">A1</span>
            <div>
              <div class="sn-lv-title">Başlangıç</div>
              <div class="sn-lv-sub">Temel kelimeler</div>
            </div>
          </a>
          <a class="sn-level-card" href="/dersler/?cat=A2">
            <span class="sn-lv-badge lv-a2">A2</span>
            <div>
              <div class="sn-lv-title">Temel</div>
              <div class="sn-lv-sub">Günlük konuşma</div>
            </div>
          </a>
          <a class="sn-level-card" href="/dersler/?cat=B1">
            <span class="sn-lv-badge lv-b1">B1</span>
            <div>
              <div class="sn-lv-title">Orta</div>
              <div class="sn-lv-sub">Karmaşık cümleler</div>
            </div>
          </a>
          <a class="sn-level-card" href="/dersler/?cat=B2">
            <span class="sn-lv-badge lv-b2">B2</span>
            <div>
              <div class="sn-lv-title">Üst Orta</div>
              <div class="sn-lv-sub">İleri gramer</div>
            </div>
          </a>
          <a class="sn-level-card" href="/dersler/?cat=C1">
            <span class="sn-lv-badge lv-c1">C1</span>
            <div>
              <div class="sn-lv-title">İleri</div>
              <div class="sn-lv-sub">Akademik Almanca</div>
            </div>
          </a>
          <div class="sn-divider"></div>
          <a class="sn-all-link" href="/dersler/">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Tüm Dersleri Gör
          </a>
        </div>
      </div>

      <!-- Metin Analizi -->
      <a class="sn-item${isMetin ? " sn-item--active" : ""}" href="/metin/">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <span>Metin Analizi</span>
      </a>

      <!-- Artikel Bulucu -->
      <a class="sn-item${isArtikel ? " sn-item--active" : ""}" href="/artikel/">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span>Artikel Bulucu</span>
      </a>

      <!-- Cümle Örnekleri -->
      <a class="sn-item${isCumle ? " sn-item--active" : ""}" href="/cumlebul/">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span>Cümle Örnekleri</span>
      </a>

      <!-- Fiil Çekimleme -->
      <a class="sn-item${isFiil ? " sn-item--active" : ""}" href="/fiil/">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <span>Fiil Çekimleme</span>
      </a>

      <!-- Kelime Quizi -->
      <a class="sn-item${isQuiz ? " sn-item--active" : ""}" href="/quiz/">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <span>Kelime Quizi</span>
      </a>

      <!-- Kelimelerim -->
      <a class="sn-item${isKelimeler ? " sn-item--active" : ""}" href="/kelimeler/">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <span>Kelimelerim</span>
      </a>

      <div class="sn-divider"></div>

      <!-- Blog -->
      <a class="sn-item${isBlog ? " sn-item--active" : ""}" href="/blog/">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
        <span>Blog</span>
      </a>

    </div><!-- /sn-scroll -->

    <!-- Footer: CTA + Auth -->
    <div class="sn-footer">

      <!-- Seviye Testi CTA -->
      <a class="sn-cta" href="/seviyeler/seviyetespit/">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20V10"/>
          <path d="M18 20V4"/>
          <path d="M6 20v-4"/>
        </svg>
        Seviye Testi — Ücretsiz
      </a>

      <!-- Giriş Yap (giriş yapılmamışsa) -->
      <a class="sn-login-btn" id="snLoginBtn" href="/login.html" style="display:none">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
          <polyline points="10 17 15 12 10 7"/>
          <line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        Giriş Yap
      </a>

      <!-- Profil (giriş yapılmışsa) -->
      <div class="sn-profile-wrap" id="snProfileWrap" style="display:none">
        <button class="sn-profile-trigger" id="snProfileTrigger" aria-label="Profil menüsü" aria-expanded="false">
          <img
            class="sn-avatar"
            id="snAvatarImg"
            src="https://ui-avatars.com/api/?name=U&background=131b2e&color=b4c5ff&size=64"
            alt="Profil">
          <div class="sn-profile-info">
            <span class="sn-profile-lbl">Giriş yapıldı</span>
            <span class="sn-profile-email" id="snProfileEmail">Yükleniyor...</span>
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.3">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <!-- Profil Dropdown -->
        <div class="sn-profile-drop" id="snProfileDrop" role="menu">
          <button class="sn-logout-btn" id="snLogoutBtn" role="menuitem">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Çıkış Yap
          </button>
        </div>
      </div>

    </div><!-- /sn-footer -->
  `;

  document.body.prepend(sidenav);

  /* ── Mobil Top Bar ── */
  const mobileBar = document.createElement("div");
  mobileBar.id = "snMobileBar";
  mobileBar.innerHTML = `
    <a class="sn-logo" href="/" aria-label="AlmancaPratik ana sayfa">
      <img class="sn-favicon" src="/favicon.png" alt="" aria-hidden="true" style="width:28px;height:28px;border-radius:7px;">
      <span class="sn-brand-name" style="font-size:14px;">
        Almanca<span class="sn-brand-accent">Pratik</span>
      </span>
    </a>
    <button class="sn-hamburger" id="snHamburger" aria-label="Menüyü aç" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  `;
  document.body.prepend(mobileBar);

  /* ── Overlay ── */
  const overlay = document.createElement("div");
  overlay.id = "snOverlay";
  document.body.appendChild(overlay);

  /* ══════════════════════════════════════════
     ETKILEŞIM
  ══════════════════════════════════════════ */

  /* Dersler accordion */
  const derslerGroup  = document.getElementById("snDerslerGroup");
  const derslerToggle = document.getElementById("snDerslerToggle");

  derslerToggle.addEventListener("click", () => {
    const isOpen = derslerGroup.classList.toggle("open");
    derslerToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  /* Mobil hamburger */
  const hamburger  = document.getElementById("snHamburger");
  const navOverlay = document.getElementById("snOverlay");

  function openSideNav() {
    sidenav.classList.add("mobile-open");
    hamburger.classList.add("open");
    navOverlay.classList.add("visible");
    hamburger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }
  function closeSideNav() {
    sidenav.classList.remove("mobile-open");
    hamburger.classList.remove("open");
    navOverlay.classList.remove("visible");
    hamburger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  hamburger.addEventListener("click", () => {
    sidenav.classList.contains("mobile-open") ? closeSideNav() : openSideNav();
  });
  navOverlay.addEventListener("click", closeSideNav);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSideNav();
  });

  /* Mobilde nav linke tıklayınca kapat */
  sidenav.querySelectorAll("a:not(.sn-all-link)").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 680) closeSideNav();
    });
  });

  /* Profil dropdown */
  const profileTrigger = document.getElementById("snProfileTrigger");
  const profileDrop    = document.getElementById("snProfileDrop");

  if (profileTrigger) {
    profileTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = profileDrop.classList.toggle("open");
      profileTrigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    document.addEventListener("click", (e) => {
      if (!profileDrop.contains(e.target) && e.target !== profileTrigger) {
        profileDrop.classList.remove("open");
        profileTrigger.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        profileDrop.classList.remove("open");
        profileTrigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* Logout */
  const logoutBtn = document.getElementById("snLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try { await logoutFirebase(); } catch (e) { console.error(e); }
      finally { window.location.href = "/"; }
    });
  }

  /* Auth state izle */
  onAuthChange((user) => {
    const loginBtn  = document.getElementById("snLoginBtn");
    const profileWr = document.getElementById("snProfileWrap");

    if (user) {
      if (loginBtn)  loginBtn.style.display  = "none";
      if (profileWr) profileWr.style.display = "block";

      const emailEl = document.getElementById("snProfileEmail");
      if (emailEl) emailEl.textContent = user.email || "Kullanıcı";

      const avatarSrc = user.photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          user.displayName || user.email || "U"
        )}&background=131b2e&color=b4c5ff&size=64`;

      const avatarImg = document.getElementById("snAvatarImg");
      if (avatarImg) avatarImg.src = avatarSrc;
    } else {
      if (loginBtn)  loginBtn.style.display  = "flex";
      if (profileWr) profileWr.style.display = "none";
    }
  });
}

/* ─────────────────────────────────────────────
   loadFloatingMenu — RADYAL FAB (mavi tema)
   Eskiyle birebir aynı işlev; görünüş mavi.
───────────────────────────────────────────── */
function loadFloatingMenu() {
  if (document.getElementById("globalFab")) return;

  function fabItem(href, label, cls, svgPath) {
    return `
      <a href="${href}" class="fab-item ${cls}" aria-label="${label}">
        <div class="fab-item-content">
          <span class="fab-label">${label}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            ${svgPath}
          </svg>
        </div>
      </a>`;
  }

  const fabContainer = document.createElement("div");
  fabContainer.className = "fab-wrapper";
  fabContainer.id = "globalFab";

  fabContainer.innerHTML = `
    ${fabItem(
      "/kelimeler/", "Kelimelerim", "item-1",
      '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'
    )}
    ${fabItem(
      "/wordsadd/", "Yeni Kelime", "item-2",
      '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>'
    )}
    ${fabItem(
      "/quiz/", "Quiz", "item-3",
      '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
    )}
    ${fabItem(
      "/notlarim/", "Notlarım", "item-4",
      '<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3z"/><polyline points="15 3 15 9 21 9"/>'
    )}
    <button class="fab-main" id="fabToggle" aria-label="Hızlı menü" aria-expanded="false">+</button>
  `;

  document.body.appendChild(fabContainer);

  const toggleBtn = document.getElementById("fabToggle");

  function openFab() {
    fabContainer.classList.add("active");
    toggleBtn.setAttribute("aria-expanded", "true");
  }
  function closeFab() {
    fabContainer.classList.remove("active");
    toggleBtn.setAttribute("aria-expanded", "false");
  }

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fabContainer.classList.contains("active") ? closeFab() : openFab();
  });

  document.addEventListener("click", (e) => {
    if (!fabContainer.contains(e.target)) closeFab();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFab();
  });

  fabContainer.querySelectorAll(".fab-item").forEach((item) => {
    item.addEventListener("click", () => setTimeout(closeFab, 150));
  });
}

/* ─────────────────────────────────────────────
   Yardımcı fonksiyonlar
───────────────────────────────────────────── */
function getUserId() {
  return auth.currentUser ? auth.currentUser.uid : null;
}

/* ─────────────────────────────────────────────
   Otomatik başlat (tüm sayfalarda)
───────────────────────────────────────────── */
loadFloatingMenu();

/* ─────────────────────────────────────────────
   Export
───────────────────────────────────────────── */
export { requireAuth, loadNavbar, getUserId };
window.requireAuth = requireAuth;
window.loadNavbar  = loadNavbar;
window.getUserId   = getUserId;