import { auth, logoutFirebase, onAuthChange } from "./firebase.js";

function requireAuth(){
  const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  onAuthChange((user) => {
    if(!user && !isLocal) window.location.href = "/login.html";
  });
}

function loadNavbar(){
  const navbar = document.createElement("div");
  navbar.className = "navbar";

  const path = window.location.pathname;
  const isDersler = path.includes("/dersler");
  const isBlog    = path.includes("/blog");
  const isRoot    = path === "/" || path === "/index.html";
  const isPratik = isRoot || ["/quiz/","/metin/","/kelimeler/","/wordsadd/","/singleadd/","/gecmis/"].some(p => path.includes(p));
  const isCeviri  = path.includes("/ceviri/");
  const isArtikel = path.includes("/artikel/");
  const isCumle   = path.includes("/cumlebul/");

  
  
  navbar.innerHTML = `
    <a class="logo" href="/" aria-label="AlmancaPratik ana sayfa">
      <img class="logo__favicon" src="/favicon.png" alt="" aria-hidden="true">
      <span class="logo__text">Almanca<span class="logo__accent">Pratik</span></span>
    </a>
    <!-- Mobil hamburger -->
    <button class="nav-hamburger" id="navHamburger" aria-label="Menüyü aç" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>

    <nav class="nav-links" role="navigation">

      <!-- Dersler dropdown -->
      <div class="nav-item-wrap" id="derslerDropWrap">
        <a class="nav-item ${isDersler ? "nav-item--active" : ""}" href="/dersler/" id="derslerPill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <span>Dersler</span>
          <svg class="nav-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </a>
        <div class="nav-dropdown" id="derslerDrop">
          <div class="nav-dropdown-inner">
            <p class="drop-section-label">Seviyeye Göre</p>
            <div class="drop-level-grid">
              <a class="drop-level-card" href="/dersler/?cat=A1">
                <span class="level-badge level-badge--a1">A1</span>
                <div>
                  <div class="drop-item-title">Başlangıç</div>
                  <div class="drop-item-sub">Temel kelimeler</div>
                </div>
              </a>
              <a class="drop-level-card" href="/dersler/?cat=A2">
                <span class="level-badge level-badge--a2">A2</span>
                <div>
                  <div class="drop-item-title">Temel</div>
                  <div class="drop-item-sub">Günlük konuşma</div>
                </div>
              </a>
              <a class="drop-level-card" href="/dersler/?cat=B1">
                <span class="level-badge level-badge--b1">B1</span>
                <div>
                  <div class="drop-item-title">Orta</div>
                  <div class="drop-item-sub">Karmaşık cümleler</div>
                </div>
              </a>
              <a class="drop-level-card" href="/dersler/?cat=B2">
                <span class="level-badge level-badge--b2">B2</span>
                <div>
                  <div class="drop-item-title">Üst Orta</div>
                  <div class="drop-item-sub">İleri gramer</div>
                </div>
              </a>
              <a class="drop-level-card" href="/dersler/?cat=C1">
                <span class="level-badge level-badge--c1">C1</span>
                <div>
                  <div class="drop-item-title">İleri</div>
                  <div class="drop-item-sub">Akademik Almanca</div>
                </div>
              </a>
            </div>
            <div class="drop-divider"></div>
            <a class="drop-all-link" href="/dersler/">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              Tüm Dersleri Gör
            </a>
          </div>
        </div>
      </div>

      <!-- Pratik dropdown -->
      <div class="nav-item-wrap" id="pratikDropWrap">
        <a class="nav-item ${isPratik ? "nav-item--active" : ""}" id="pratikPill" href="/pratik/">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>Pratik</span>
          <svg class="nav-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </a>
        <div class="nav-dropdown nav-dropdown--pratik" id="pratikDrop">
          <div class="nav-dropdown-inner">
            <div class="drop-two-col">
              <a class="drop-tool-item" href="/metin/">
                <span class="drop-tool-icon" style="background:rgba(160,100,255,0.1);border-color:rgba(160,100,255,0.2)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a064ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </span>
                <div class="drop-item-title">Metin Analizi</div>
              </a>
              <a class="drop-tool-item" href="/quiz/">
                <span class="drop-tool-icon" style="background:rgba(160,100,255,0.1);border-color:rgba(160,100,255,0.18)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a064ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </span>
                <div class="drop-item-title">Kelime Quizi</div>
              </a>
              <a class="drop-tool-item" href="/kelimeler/">
                <span class="drop-tool-icon" style="background:rgba(79,214,156,0.1);border-color:rgba(79,214,156,0.18)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4fd69c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                </span>
                <div class="drop-item-title">Kelimelerim</div>
              </a>
              <a class="drop-tool-item" href="/wordsadd/">
                <span class="drop-tool-icon" style="background:rgba(240,112,104,0.1);border-color:rgba(240,112,104,0.18)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f07068" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                </span>
                <div class="drop-item-title">Kelime Ekle</div>
              </a>
            </div>
          </div>
        </div>
      </div>
      <a class="nav-item ${isCeviri ? 'nav-item--active' : ''}" href="/ceviri/">

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>
        <span>Çeviri</span>
      </a>
      <a class="nav-item ${isArtikel ? 'nav-item--active' : ''}" href="/artikel/">

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>Artikel</span>
      </a>
      <a class="nav-item ${isCumle ? 'nav-item--active' : ''}" href="/cumlebul/">

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>Cümle</span>
      </a>
      <!-- Blog -->
      <a class="nav-item ${isBlog ? "nav-item--active" : ""}" href="/blog/">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <span>Blog</span>
      </a>

    </nav>
    

    <div class="nav-right">

      <!-- Seviye testi CTA -->
      <a class="nav-cta" href="/seviyeler/seviyetespit/">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
        <span>Seviye Testi</span>
      </a>

      <div class="nav-vr" aria-hidden="true"></div>

      <!-- Auth -->
      <a class="nav-login-btn" id="navLoginBtn" href="/login.html" style="display:none">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        <span>Giriş Yap</span>
      </a>

      <div class="profile-wrapper" id="profileWrapper" style="display:none">
        <button class="profile-trigger" id="profileAvatar" aria-label="Profil menüsü">
          <img class="profile-avatar-img" id="profileAvatarImg" src="https://ui-avatars.com/api/?name=User&background=555&color=fff&size=64" alt="Profil"/>
        </button>
        <div class="profile-dropdown" id="profileDropdown" role="menu">
          <div class="profile-dropdown__header">
            <img class="profile-dropdown__avatar" id="profileAvatarSmall" src="https://ui-avatars.com/api/?name=User&background=555&color=fff&size=64" alt=""/>
            <div>
              <div class="profile-dropdown__label">Giriş yapıldı</div>
              <span class="profile-email" id="profileEmail">Yükleniyor...</span>
            </div>
          </div>
          <div class="profile-dropdown__divider"></div>
          <button class="logout-btn" id="logoutBtn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  `;

  const style = document.createElement("style");




  style.textContent = `
      .logo {
      display: flex;        /* bunu ekle — resim ve yazı yan yana dursun */
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }

    .logo__favicon {
      width: 36px;
      height: 36px;
      object-fit: contain;
      border-radius: 5px;
      flex-shrink: 0;
    }
    /* ── NAVBAR SHELL ── */
    .navbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 0 48px;
      height: 68px;
      background: rgba(8,8,12,0.88);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border-bottom: 1px solid rgba(255,255,255,0.055);
      box-shadow: 0 1px 0 rgba(201,168,76,0.07), 0 8px 32px rgba(0,0,0,0.4);
    }

    /* ── LOGO ── */
    .logo {
      text-decoration: none;
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }
    .logo__text {
      font-family: 'Syne', sans-serif;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #f0eee8;
      user-select: none;
      position: relative;
    }
    .logo__text::after {
      content: '';
      position: absolute;
      bottom: -2px; left: 0;
      width: 100%; height: 1.5px;
      background: linear-gradient(90deg, #c9a84c, transparent);
      border-radius: 2px;
      opacity: 0.65;
    }
    .logo__accent {
      color: #c9a84c;
    }

    /* ── NAV LINKS (orta) ── */
    .nav-links {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    /* ── NAV ITEM ── */
    .nav-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 10px;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: rgba(240,238,232,0.55);
      text-decoration: none;
      cursor: pointer;
      border: 1px solid transparent;
      background: transparent;
      transition: all 0.18s ease;
      white-space: nowrap;
      position: relative;
      letter-spacing: -0.01em;
    }
    .nav-item svg { flex-shrink: 0; opacity: 0.6; transition: opacity 0.18s; }
    .nav-item:hover {
      color: rgba(240,238,232,0.9);
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.08);
    }
    .nav-item:hover svg { opacity: 1; }

    .nav-item--active {
      color: rgba(240,238,232,0.9);
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.09);
    }
    .nav-item--active svg { opacity: 1; }

    .nav-chevron { opacity: 0.35; transition: transform 0.2s ease, opacity 0.18s; }
    .nav-item-wrap.open .nav-chevron { transform: rotate(180deg); opacity: 0.7; }

    /* ── RIGHT SIDE ── */
    .nav-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    /* ── SEVIYE CTA ── */
    .nav-cta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 15px;
      border-radius: 10px;
      font-family: 'DM Sans', sans-serif;
      font-size: 12.5px;
      font-weight: 600;
      color: rgba(96,200,240,0.72);
      text-decoration: none;
      border: 1px solid rgba(96,200,240,0.16);
      background: rgba(96,200,240,0.05);
      transition: all 0.18s ease;
      white-space: nowrap;
      letter-spacing: -0.01em;
    }
    .nav-cta svg { stroke: rgba(96,200,240,0.72); transition: stroke 0.18s; }
    .nav-cta:hover {
      color: #60c8f0;
      border-color: rgba(96,200,240,0.3);
      background: rgba(96,200,240,0.1);
    }
    .nav-cta:hover svg { stroke: #60c8f0; }

    /* ── LOGIN BTN ── */
    .nav-login-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 18px;
      border-radius: 10px;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 700;
      color: #0a0a0f;
      text-decoration: none;
      background: linear-gradient(135deg, #c9a84c, #e8c97a);
      border: none;
      cursor: pointer;
      box-shadow: 0 3px 16px rgba(201,168,76,0.3);
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .nav-login-btn svg { stroke: #0a0a0f; opacity: 0.8; }
    .nav-login-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 24px rgba(201,168,76,0.45);
      background: linear-gradient(135deg, #d9b85c, #f0d480);
    }

    /* ── VERTICAL RULE ── */
    .nav-vr {
      width: 1px; height: 22px;
      background: rgba(255,255,255,0.07);
      flex-shrink: 0;
    }

    /* ══ DROPDOWN BASE ══ */
    .nav-item-wrap { position: relative; display: inline-flex; }

    .nav-dropdown {
      position: absolute;
      top: calc(100% + 14px);
      left: 50%;
      transform: translateX(-50%) translateY(-6px);
      min-width: 260px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.16s ease, transform 0.18s cubic-bezier(0.4,0,0.2,1);
      z-index: 9999;
    }
    .nav-dropdown::before {
      content: '';
      position: absolute;
      top: -14px; left: 0; right: 0;
      height: 14px;
    }
    .nav-item-wrap.open .nav-dropdown {
      opacity: 1;
      pointer-events: all;
      transform: translateX(-50%) translateY(0);
    }
    .nav-dropdown--pratik {
      min-width: 280px;
      left: 50%;
    }

    .nav-dropdown-inner {
      background: #0d0d14;
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 16px;
      padding: 10px;
      box-shadow:
        0 24px 64px rgba(0,0,0,0.72),
        0 4px 16px rgba(0,0,0,0.4),
        inset 0 1px 0 rgba(255,255,255,0.04);
    }

    /* ── SECTION LABEL ── */
    .drop-section-label {
      font-family: 'DM Sans', sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(240,238,232,0.22);
      margin: 6px 10px 6px;
      padding: 0;
    }

    /* ── LEVEL GRID (Dersler dropdown) ── */
    .drop-level-grid {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .drop-level-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 12px;
      border-radius: 10px;
      text-decoration: none;
      transition: background 0.15s;
    }
    .drop-level-card:hover { background: rgba(255,255,255,0.05); }

    .level-badge {
      font-family: 'Syne', sans-serif;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 7px;
      flex-shrink: 0;
      min-width: 36px;
      text-align: center;
      letter-spacing: 0.03em;
    }
    .level-badge--a1 { background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.22); color:#22c55e; }
    .level-badge--a2 { background:rgba(134,239,172,0.08); border:1px solid rgba(134,239,172,0.18); color:#86efac; }
    .level-badge--b1 { background:rgba(96,200,240,0.09); border:1px solid rgba(96,200,240,0.2); color:#60c8f0; }
    .level-badge--b2 { background:rgba(129,140,248,0.09); border:1px solid rgba(129,140,248,0.18); color:#818cf8; }
    .level-badge--c1 { background:rgba(201,168,76,0.09); border:1px solid rgba(201,168,76,0.2); color:#c9a84c; }

    .drop-item-title {
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: rgba(240,238,232,0.85);
      line-height: 1.2;
    }
    .drop-item-sub {
      font-family: 'DM Sans', sans-serif;
      font-size: 11.5px;
      color: rgba(240,238,232,0.3);
      margin-top: 1px;
    }

    /* ── ALL LINK ── */
    .drop-all-link {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-radius: 10px;
      font-family: 'DM Sans', sans-serif;
      font-size: 12.5px;
      font-weight: 600;
      color: rgba(240,238,232,0.4);
      text-decoration: none;
      transition: all 0.15s;
    }
    .drop-all-link:hover { background: rgba(255,255,255,0.05); color: rgba(240,238,232,0.8); }
    .drop-all-link svg { opacity: 0.45; }

    /* ── DIVIDER ── */
    .drop-divider {
      height: 1px;
      background: rgba(255,255,255,0.06);
      margin: 6px 4px;
    }

    /* ── PRATIK — TWO COL ── */
    .drop-two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      padding: 2px;
    }
    .drop-col { padding: 0 2px; }

    /* ── TOOL ITEM ── */
    .drop-tool-item {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 10px 12px;
      border-radius: 10px;
      text-decoration: none;
      transition: background 0.15s;
      cursor: pointer;
    }
    .drop-tool-item:hover { background: rgba(255,255,255,0.05); }

    .drop-tool-icon {
      width: 34px; height: 34px;
      border-radius: 9px;
      border: 1px solid;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: transform 0.15s;
    }
    .drop-tool-item:hover .drop-tool-icon { transform: scale(1.08); }

    /* ── FOOTER BANNER ── */
    .drop-footer-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px 6px;
    }
    .drop-footer-left {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      color: rgba(240,238,232,0.35);
    }
    .drop-footer-cta {
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      font-weight: 700;
      color: rgba(201,168,76,0.75);
      text-decoration: none;
      letter-spacing: -0.01em;
      transition: color 0.15s;
    }
    .drop-footer-cta:hover { color: #c9a84c; }

    /* ══ PROFILE ══ */
    .profile-wrapper { position: relative; display: inline-flex; }
    .profile-trigger {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    .profile-avatar-img {
      width: 34px; height: 34px;
      border-radius: 50%;
      object-fit: cover;
      border: 1.5px solid rgba(255,255,255,0.1);
      transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
      display: block;
    }
    .profile-trigger:hover .profile-avatar-img {
      border-color: rgba(201,168,76,0.55);
      transform: scale(1.06);
      box-shadow: 0 0 0 3px rgba(201,168,76,0.1);
    }

    .profile-dropdown {
      display: none;
      position: absolute;
      right: 0;
      top: calc(100% + 12px);
      background: #0d0d14;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 6px;
      min-width: 220px;
      box-shadow: 0 20px 48px rgba(0,0,0,0.65);
      z-index: 9999;
      animation: profileDropIn 0.18s cubic-bezier(0.4,0,0.2,1) both;
    }
    .profile-dropdown.open { display: block; }

    @keyframes profileDropIn {
      from { opacity:0; transform:translateY(-6px) scale(0.97); }
      to   { opacity:1; transform:translateY(0) scale(1); }
    }

    .profile-dropdown__header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px 8px;
    }
    .profile-dropdown__avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.09);
      flex-shrink: 0;
    }
    .profile-dropdown__label {
      font-family: 'DM Sans', sans-serif;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(240,238,232,0.25);
      margin-bottom: 2px;
    }
    .profile-email {
      display: block;
      font-family: 'DM Sans', sans-serif;
      font-size: 12.5px;
      font-weight: 500;
      color: rgba(240,238,232,0.55);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 160px;
    }
    .profile-dropdown__divider {
      height: 1px;
      background: rgba(255,255,255,0.06);
      margin: 2px 0;
    }
    .profile-dropdown .logout-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 9px 12px;
      background: transparent;
      color: rgba(240,112,104,0.75);
      border: none;
      border-radius: 9px;
      cursor: pointer;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 500;
      text-align: left;
      transition: background 0.15s, color 0.15s;
    }
    .profile-dropdown .logout-btn:hover {
      background: rgba(240,112,104,0.08);
      color: #f07068;
    }

    /* ══ RESPONSIVE ══ */
    
    
    /* ── Hamburger butonu (masaüstünde gizli) ── */
    .nav-hamburger {
      display: none;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 5px;
      width: 40px; height: 40px;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      cursor: pointer;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      transition: border-color 0.2s;
      flex-shrink: 0;
    }
    .nav-hamburger span {
      display: block;
      width: 18px; height: 1.5px;
      background: rgba(240,238,232,0.7);
      border-radius: 2px;
      transition: all 0.25s ease;
      transform-origin: center;
    }
    .nav-hamburger.open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); }
    .nav-hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
    .nav-hamburger.open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); }
    .nav-hamburger:hover { border-color: rgba(255,255,255,0.25); }

    /* ── Mobil overlay ── */
    .nav-mobile-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.65);
      z-index: 998;
      backdrop-filter: blur(2px);
    }
    .nav-mobile-overlay.visible { display: block; }

    /* ── Tablet (≤1000px) ── */
    @media (max-width: 1000px) {
      .navbar { padding: 0 28px; }
      .drop-item-sub { display: none; }
    }

    /* ── Küçük tablet (≤820px) ── */
    @media (max-width: 820px) {
      .navbar { padding: 0 20px; height: 62px; }
      .nav-item span { display: none; }
      .nav-chevron { display: none; }
      .nav-item { padding: 8px 10px; }
      .nav-cta span { display: none; }
      .nav-cta { padding: 8px 10px; }
      .nav-dropdown { left: 0; transform: translateX(0) translateY(-6px); }
      .nav-item-wrap.open .nav-dropdown { transform: translateX(0) translateY(0); }
      .nav-dropdown--pratik { min-width: 320px; left: 0; transform: translateX(0) translateY(-6px); }
      .nav-item-wrap.open .nav-dropdown--pratik { transform: translateX(0) translateY(0); }
      .drop-two-col { grid-template-columns: 1fr; }
    }
    @media (max-width: 820px) {
      .logo__favicon { width: 26px; height: 26px; }
    }

    @media (max-width: 620px) {
      .logo__favicon { width: 22px; height: 22px; }
    }
    

    /* ── Mobil (≤620px): hamburger slide-in panel ── */
    @media (max-width: 620px) {
      .navbar { padding: 0 16px; gap: 12px; }
      .nav-hamburger { display: flex; }
      .nav-vr { display: none; }
      .nav-cta { display: none; }

      /* Nav linkleri panel haline gelir */
      .nav-links {
        position: fixed;
        top: 0; right: 0;
        width: min(300px, 85vw);
        height: 100dvh;
        background: #0d0d14;
        border-left: 1px solid rgba(255,255,255,0.09);
        box-shadow: -16px 0 48px rgba(0,0,0,0.7);
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
        padding: 80px 12px 32px;
        z-index: 999;
        overflow-y: auto;
        transform: translateX(100%);
        transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .nav-links.mobile-open { transform: translateX(0); }

      /* Panelde nav-item tam genişlikte */
      .nav-item {
        width: 100%;
        padding: 12px 16px;
        border-radius: 10px;
        font-size: 14px;
      }
      
      .nav-item span { display: inline; } /* metinleri geri göster */
      .nav-chevron { display: inline; }

      /* Dropdown panelde statik açılır */
      .nav-item-wrap { flex-direction: column; width: 100%; }
      .nav-dropdown {
        position: static;
        transform: none !important;
        opacity: 1;
        pointer-events: all;
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.25s ease;
        min-width: 0;
      }
      .nav-item-wrap.open .nav-dropdown { max-height: 600px; }
      .nav-dropdown-inner {
        margin: 4px 0 4px 8px;
        border-radius: 10px;
      }
      .drop-two-col { grid-template-columns: 1fr; }
    }
  `;






  document.head.appendChild(style);
  document.body.prepend(navbar);
  // Overlay'i body'ye doğrudan ekle, navbar'a değil
  const overlayEl = document.createElement("div");
  overlayEl.className = "nav-mobile-overlay";
  overlayEl.id = "navOverlay";
  document.body.appendChild(overlayEl);
  /* ── Mobil hamburger ── */
  const hamburger = document.getElementById("navHamburger");
  const navLinks  = document.querySelector(".nav-links");
  const overlay   = document.getElementById("navOverlay");

  function openMobileMenu() {
    hamburger.classList.add("open");
    navLinks.classList.add("mobile-open");
    overlay.classList.add("visible");
    hamburger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden"; // scroll kilidi
  }

  function closeMobileMenu() {
    hamburger.classList.remove("open");
    navLinks.classList.remove("mobile-open");
    overlay.classList.remove("visible");
    hamburger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  hamburger.addEventListener("click", () => {
    hamburger.classList.contains("open") ? closeMobileMenu() : openMobileMenu();
  });
  overlay.addEventListener("click", closeMobileMenu);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeMobileMenu(); });

  // Paneldeki bir bağlantıya tıklanınca kapat (dropdown değilse)
  navLinks.addEventListener("click", e => {
    const link = e.target.closest("a:not(.nav-item[id])");
    if (link && !e.target.closest(".nav-item-wrap")) closeMobileMenu();
  });
  /* ── Dropdown hover ── */
  const DELAY = 200;
  document.querySelectorAll(".nav-item-wrap").forEach(wrap => {
    let timer = null;
    const open  = () => { clearTimeout(timer); wrap.classList.add("open"); };
    const close = () => { timer = setTimeout(() => wrap.classList.remove("open"), DELAY); };
    wrap.addEventListener("mouseenter", open);
    wrap.addEventListener("mouseleave", close);

    // Mobil: dokunuşla aç/kapat
    wrap.querySelector(".nav-item").addEventListener("click", e => {
      const isTouchDevice = window.matchMedia("(hover: none)").matches;
      if (!isTouchDevice) return; // masaüstünde hover zaten çalışıyor
      if (wrap.querySelector(".nav-dropdown")) {
        e.preventDefault();
        const isOpen = wrap.classList.contains("open");
        document.querySelectorAll(".nav-item-wrap").forEach(w => w.classList.remove("open"));
        if (!isOpen) wrap.classList.add("open");
      }
    });

    document.addEventListener("click", e => { if (!wrap.contains(e.target)) wrap.classList.remove("open"); });
  });

  /* ── Çıkış ── */
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    try { await logoutFirebase(); } catch(e){ console.error(e); }
    finally { window.location.href = "/"; }
  });

  /* ── Profil dropdown ── */
  const avatar   = document.getElementById("profileAvatar");
  const dropdown = document.getElementById("profileDropdown");
  avatar.addEventListener("click", e => { e.stopPropagation(); dropdown.classList.toggle("open"); });
  document.addEventListener("keydown", e => { if(e.key==="Escape") dropdown.classList.remove("open"); });
  document.addEventListener("click", e => {
    if (!dropdown.contains(e.target) && e.target !== avatar) dropdown.classList.remove("open");
  });

  /* ── Auth durumu ── */
  onAuthChange((user) => {
    const loginBtn  = document.getElementById("navLoginBtn");
    const profileWr = document.getElementById("profileWrapper");
    if (user) {
      if (loginBtn)  loginBtn.style.display  = "none";
      if (profileWr) profileWr.style.display = "inline-flex";
      document.getElementById("profileEmail").textContent = user.email || "Kullanıcı";
      const src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || "U")}&background=1e1830&color=a064ff&size=64`;
      document.getElementById("profileAvatarImg").src    = src;
      document.getElementById("profileAvatarSmall").src = src;
    } else {
      if (loginBtn)  loginBtn.style.display  = "flex";
      if (profileWr) profileWr.style.display = "none";
    }
  });
}

function getLoginHref(){ return "/login.html"; }
function getUserId(){
  return auth.currentUser ? auth.currentUser.uid : null;
}
// ── YÜZEN MENÜ (FAB) YÜKLEYİCİ ──
function loadFloatingMenu() {
  const fabContainer = document.createElement("div");
  fabContainer.className = "fab-wrapper";
  fabContainer.id = "globalFab";

  fabContainer.innerHTML = `
    <div class="fab-items">
      <a href="/kelimeler/" class="fab-item item-1">
        <span class="fab-label">Kelimelerim</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
      </a>
      <a href="/wordsadd/" class="fab-item item-2">
        <span class="fab-label">Yeni Kelime Ekle</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      </a>
      <a href="/quiz/" class="fab-item item-3">
        <span class="fab-label">Kelime Quizi</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </a>
      <a href="/notlarım/" class="fab-item item-4">
        <span class="fab-label">Notlarım</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3z"/><polyline points="15 3 15 9 21 9"/></svg>
      </a>
    </div>
    <button class="fab-main" id="fabToggle" aria-label="Hızlı Menü">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>
  `;

  document.body.appendChild(fabContainer);

  const toggleBtn = document.getElementById("fabToggle");
  toggleBtn.addEventListener("click", () => {
    fabContainer.classList.toggle("active");
  });

  // Dışarı tıklandığında kapatma
  document.addEventListener("click", (e) => {
    if (!fabContainer.contains(e.target)) {
      fabContainer.classList.remove("active");
    }
  });
}

// core.js zaten her sayfada çağrıldığı için otomatik başlat:
window.addEventListener("DOMContentLoaded", () => {
    loadFloatingMenu();
});
export { requireAuth, loadNavbar, getUserId };
window.requireAuth  = requireAuth;
window.loadNavbar   = loadNavbar;
window.getUserId    = getUserId;