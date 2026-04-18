import { auth, logoutFirebase, onAuthChange } from "./firebase.js";

/* ─────────────────────────────────────────────────
   requireAuth
   Local ortamda bypass; üretimde login'e yönlendir
───────────────────────────────────────────────── */
function requireAuth() {
  const isLocal =
    location.hostname === "127.0.0.1" || location.hostname === "localhost";
  onAuthChange((user) => {
    if (!user && !isLocal) window.location.href = "/login.html";
  });
}

/* ─────────────────────────────────────────────────
   loadNavbar
───────────────────────────────────────────────── */
function loadNavbar() {
  const navbar = document.createElement("div");
  navbar.className = "navbar";

  /* Aktif sayfa tespiti */
  const path     = window.location.pathname;
  const isDersler = path.includes("/dersler");
  const isBlog    = path.includes("/blog");
  const isMetin   = path.includes("/metin");
  const isArtikel = path.includes("/artikel/");
  const isCumle   = path.includes("/cumlebul/");
  const isFiil    = path.includes("/fiil");

  /* ── SVG İkonlar ── */
  const icons = {
    dersler:  `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`,
    metin:    `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
    artikel:  `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`,
    cumle:    `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
    /* ❌ HATA: Fiil ve Blog aynı ikona sahipti (copy-paste). Düzeltildi ✔ */
    fiil:     `<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>`,
    blog:     `<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/>`,
    chevron:  `<polyline points="6 9 12 15 18 9"/>`,
    seviye:   `<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>`,
    login:    `<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>`,
    logout:   `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`,
    grid:     `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>`,
  };

  const svg = (d, size = 14) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

  const navItem = (href, id, active, iconKey, label) => `
    <a class="nav-item${active ? " nav-item--active" : ""}" href="${href}" ${id ? `id="${id}"` : ""}>
      ${svg(icons[iconKey])}
      <span>${label}</span>
    </a>`;

  navbar.innerHTML = `
    <!-- LOGO -->
    <a class="logo" href="/" aria-label="AlmancaPratik ana sayfa">
      <img class="logo__favicon" src="/favicon.png" alt="" aria-hidden="true">
      <span class="logo__text">Almanca<span class="logo__accent">Pratik</span></span>
    </a>

    <!-- MOBİL HAMBURGER -->
    <button class="nav-hamburger" id="navHamburger"
            aria-label="Menüyü aç/kapat" aria-expanded="false"
            aria-controls="navLinks">
      <span></span><span></span><span></span>
    </button>

    <!-- ANA NAV LINKLERI -->
    <nav class="nav-links" id="navLinks" role="navigation" aria-label="Ana menü">

      <!-- Dersler dropdown -->
      <div class="nav-item-wrap" id="derslerDropWrap">
        <a class="nav-item${isDersler ? " nav-item--active" : ""}"
           href="/dersler/" id="derslerPill"
           aria-haspopup="true" aria-expanded="false">
          ${svg(icons.dersler)}
          <span>Dersler</span>
          <span class="nav-chevron">${svg(icons.chevron, 12)}</span>
        </a>

        <div class="nav-dropdown" id="derslerDrop" role="menu">
          <div class="nav-dropdown-inner">
            <p class="drop-section-label">Seviyeye Göre</p>
            <div class="drop-level-grid">
              ${[
                ["A1", "a1", "Başlangıç",  "Temel kelimeler",     "/dersler/?cat=A1"],
                ["A2", "a2", "Temel",       "Günlük konuşma",      "/dersler/?cat=A2"],
                ["B1", "b1", "Orta",        "Karmaşık cümleler",   "/dersler/?cat=B1"],
                ["B2", "b2", "Üst Orta",    "İleri gramer",        "/dersler/?cat=B2"],
                ["C1", "c1", "İleri",       "Akademik Almanca",    "/dersler/?cat=C1"],
              ].map(([lvl, cls, title, sub, href]) => `
                <a class="drop-level-card" href="${href}" role="menuitem">
                  <span class="level-badge level-badge--${cls}">${lvl}</span>
                  <div>
                    <div class="drop-item-title">${title}</div>
                    <div class="drop-item-sub">${sub}</div>
                  </div>
                </a>
              `).join("")}
            </div>
            <div class="drop-divider"></div>
            <a class="drop-all-link" href="/dersler/" role="menuitem">
              ${svg(icons.grid, 13)}
              Tüm Dersleri Gör
            </a>
          </div>
        </div>
      </div>

      ${navItem("/metin/",    null, isMetin,   "metin",   "Metin Analizi")}
      ${navItem("/artikel/",  null, isArtikel, "artikel", "Artikel")}
      ${navItem("/cumlebul/", null, isCumle,   "cumle",   "Cümle Bul")}
      ${navItem("/fiil/",     null, isFiil,    "fiil",    "Fiil Çekimi")}
      ${navItem("/blog/",     null, isBlog,    "blog",    "Blog")}

      <!-- MOBİL: Bento alt bölümü — yalnızca mobilde görünür -->
      <div class="nav-mobile-bento" aria-hidden="true">
        <a class="nav-bento-card" href="/seviyeler/seviyetespit/">
          ${svg(icons.seviye, 18)}
          <span>Seviye Testi</span>
        </a>
        <a class="nav-bento-card nav-bento-card--cta" href="/kelimeler/">
          ${svg(icons.dersler, 18)}
          <span>Kelimelerim</span>
        </a>
        <a class="nav-bento-card" href="/quiz/">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span>Quiz</span>
        </a>
        <a class="nav-bento-card" href="/notlarim/">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3z"/>
            <polyline points="15 3 15 9 21 9"/>
          </svg>
          <span>Notlarım</span>
        </a>
      </div>

    </nav><!-- /nav-links -->

    <!-- SAĞ ARAÇLAR -->
    <div class="nav-right">
      <a class="nav-cta" href="/seviyeler/seviyetespit/">
        ${svg(icons.seviye, 13)}
        <span class="nav-cta-label">Seviye Testi</span>
      </a>

      <div class="nav-vr" aria-hidden="true"></div>

      <a class="nav-login-btn" id="navLoginBtn" href="/login.html" style="display:none">
        ${svg(icons.login, 13)}
        <span>Giriş Yap</span>
      </a>

      <div class="profile-wrapper" id="profileWrapper" style="display:none">
        <button class="profile-trigger" id="profileAvatar"
                aria-label="Profil menüsü" aria-expanded="false" aria-haspopup="true">
          <img class="profile-avatar-img" id="profileAvatarImg"
            src="https://ui-avatars.com/api/?name=User&background=1a1a2e&color=c9a84c&size=64"
            alt="Profil fotoğrafı"/>
        </button>
        <div class="profile-dropdown" id="profileDropdown" role="menu">
          <div class="profile-dropdown__header">
            <img class="profile-dropdown__avatar" id="profileAvatarSmall"
              src="https://ui-avatars.com/api/?name=User&background=1a1a2e&color=c9a84c&size=64"
              alt="" aria-hidden="true"/>
            <div>
              <div class="profile-dropdown__label">Oturum açık</div>
              <span class="profile-email" id="profileEmail">Yükleniyor…</span>
            </div>
          </div>
          <div class="profile-dropdown__divider"></div>
          <button class="logout-btn" id="logoutBtn" role="menuitem">
            ${svg(icons.logout, 13)}
            Çıkış Yap
          </button>
        </div>
      </div>
    </div><!-- /nav-right -->
  `;

  /* ────────────────────────────────────────
     STİLLER — Navbar'a özgü tüm CSS
  ──────────────────────────────────────── */
  const style = document.createElement("style");
  style.textContent = /* css */`

    /* ── LOGO ── */
    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      flex-shrink: 0;
      user-select: none;
    }
    .logo__favicon {
      width: 34px; height: 34px;
      object-fit: contain;
      border-radius: 6px;
      flex-shrink: 0;
    }
    .logo__text {
      font-family: 'Syne', sans-serif;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.025em;
      color: #f0eee8;
      position: relative;
    }
    .logo__text::after {
      content: '';
      position: absolute;
      bottom: -2px; left: 0;
      width: 100%; height: 1.5px;
      background: linear-gradient(90deg, #c9a84c, transparent);
      border-radius: 2px;
      opacity: 0.6;
    }
    .logo__accent { color: #c9a84c; }

    /* ── NAVBAR SHELL ── */
    .navbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      padding: 0 48px;
      height: 68px;
      background: rgba(8, 8, 12, 0.88);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.055);
      box-shadow:
        0 1px 0 rgba(201, 168, 76, 0.07),
        0 8px 32px rgba(0, 0, 0, 0.4);
      transition: background 0.3s ease, box-shadow 0.3s ease;
    }

    /* ── NAV LINKS ── */
    .nav-links {
      display: flex;
      align-items: center;
      gap: 2px;
      flex: 1;
    }

    /* ── NAV ITEM ── */
    .nav-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 13px;
      border-radius: 10px;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: rgba(240, 238, 232, 0.52);
      text-decoration: none;
      border: 1px solid transparent;
      background: transparent;
      transition: all 0.18s ease;
      white-space: nowrap;
      position: relative;
      letter-spacing: -0.01em;
    }
    .nav-item svg { flex-shrink: 0; opacity: 0.55; transition: opacity 0.18s; }
    .nav-item:hover {
      color: rgba(240, 238, 232, 0.9);
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.08);
    }
    .nav-item:hover svg { opacity: 1; }
    .nav-item--active {
      color: rgba(240, 238, 232, 0.92);
      background: rgba(201, 168, 76, 0.07);
      border-color: rgba(201, 168, 76, 0.18);
    }
    .nav-item--active svg { opacity: 1; }

    /* Chevron */
    .nav-chevron { opacity: 0.3; transition: transform 0.2s ease, opacity 0.18s; }
    .nav-item-wrap.open .nav-chevron { transform: rotate(180deg); opacity: 0.65; }

    /* ── NAV RIGHT ── */
    .nav-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    /* ── CTA ── */
    .nav-cta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 15px;
      border-radius: 10px;
      font-family: 'DM Sans', sans-serif;
      font-size: 12.5px;
      font-weight: 600;
      color: rgba(96, 200, 240, 0.72);
      text-decoration: none;
      border: 1px solid rgba(96, 200, 240, 0.16);
      background: rgba(96, 200, 240, 0.05);
      transition: all 0.18s ease;
      white-space: nowrap;
    }
    .nav-cta svg { stroke: rgba(96, 200, 240, 0.72); transition: stroke 0.18s; flex-shrink: 0; }
    .nav-cta:hover {
      color: #60c8f0;
      border-color: rgba(96, 200, 240, 0.3);
      background: rgba(96, 200, 240, 0.1);
      transform: translateY(-1px);
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
      box-shadow: 0 3px 16px rgba(201, 168, 76, 0.3);
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .nav-login-btn svg { stroke: #0a0a0f; opacity: 0.85; flex-shrink: 0; }
    .nav-login-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 24px rgba(201, 168, 76, 0.45);
      background: linear-gradient(135deg, #d9b85c, #f0d480);
    }

    /* ── DIVIDER ── */
    .nav-vr {
      width: 1px; height: 22px;
      background: rgba(255, 255, 255, 0.07);
      flex-shrink: 0;
    }

    /* ────────────────────────────────
       DROPDOWN
    ──────────────────────────────── */
    .nav-item-wrap { position: relative; display: inline-flex; }

    .nav-dropdown {
      position: absolute;
      top: calc(100% + 14px);
      left: 50%;
      transform: translateX(-50%) translateY(-8px);
      min-width: 268px;
      opacity: 0;
      pointer-events: none;
      /* ❌ HATA: pointer-events: all → pointer-events: auto ✔ */
      transition: opacity 0.16s ease, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 9999;
    }
    /* Boşluk köprüsü — hover kaymasını önler */
    .nav-dropdown::before {
      content: '';
      position: absolute;
      top: -14px; left: 0; right: 0;
      height: 14px;
    }
    .nav-item-wrap.open .nav-dropdown {
      opacity: 1;
      pointer-events: auto;
      transform: translateX(-50%) translateY(0);
    }

    .nav-dropdown-inner {
      background: #0c0c15;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      padding: 10px;
      box-shadow:
        0 24px 64px rgba(0, 0, 0, 0.75),
        0 4px 16px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    .drop-section-label {
      font-family: 'DM Sans', sans-serif;
      font-size: 10px; font-weight: 700;
      letter-spacing: 0.12em; text-transform: uppercase;
      color: rgba(240, 238, 232, 0.2);
      padding: 6px 10px 4px;
    }

    .drop-level-grid { display: flex; flex-direction: column; gap: 2px; }

    .drop-level-card {
      display: flex; align-items: center; gap: 12px;
      padding: 9px 12px;
      border-radius: 11px;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .drop-level-card:hover { background: rgba(255, 255, 255, 0.05); }

    .level-badge {
      font-family: 'Syne', sans-serif;
      font-size: 11px; font-weight: 800;
      padding: 4px 10px; border-radius: 7px;
      flex-shrink: 0; min-width: 36px;
      text-align: center; letter-spacing: 0.03em;
    }
    .level-badge--a1 { background:rgba(34,197,94,0.1);   border:1px solid rgba(34,197,94,0.22);   color:#22c55e; }
    .level-badge--a2 { background:rgba(134,239,172,0.08); border:1px solid rgba(134,239,172,0.18); color:#86efac; }
    .level-badge--b1 { background:rgba(96,200,240,0.09);  border:1px solid rgba(96,200,240,0.2);   color:#60c8f0; }
    .level-badge--b2 { background:rgba(129,140,248,0.09); border:1px solid rgba(129,140,248,0.18); color:#818cf8; }
    .level-badge--c1 { background:rgba(201,168,76,0.09);  border:1px solid rgba(201,168,76,0.2);   color:#c9a84c; }

    .drop-item-title {
      font-family: 'DM Sans', sans-serif;
      font-size: 13px; font-weight: 600;
      color: rgba(240, 238, 232, 0.85);
      line-height: 1.2;
    }
    .drop-item-sub {
      font-family: 'DM Sans', sans-serif;
      font-size: 11.5px;
      color: rgba(240, 238, 232, 0.3);
      margin-top: 1px;
    }

    .drop-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 6px 4px; }

    .drop-all-link {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 12px; border-radius: 10px;
      font-family: 'DM Sans', sans-serif;
      font-size: 12.5px; font-weight: 600;
      color: rgba(240, 238, 232, 0.38);
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .drop-all-link:hover { background: rgba(255,255,255,0.05); color: rgba(240,238,232,0.8); }
    .drop-all-link svg { opacity: 0.4; }

    /* ────────────────────────────────
       PROFİL
    ──────────────────────────────── */
    .profile-wrapper { position: relative; display: inline-flex; }
    .profile-trigger {
      background: none; border: none;
      padding: 2px; cursor: pointer;
      display: flex; align-items: center;
      border-radius: 50%;
      transition: box-shadow 0.2s ease;
    }
    .profile-avatar-img {
      width: 34px; height: 34px;
      border-radius: 50%; object-fit: cover;
      border: 1.5px solid rgba(255, 255, 255, 0.1);
      transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
      display: block;
    }
    .profile-trigger:hover .profile-avatar-img {
      border-color: rgba(201,168,76,0.5);
      transform: scale(1.06);
      box-shadow: 0 0 0 3px rgba(201,168,76,0.12);
    }

    .profile-dropdown {
      display: none;
      position: absolute;
      right: 0; top: calc(100% + 12px);
      background: #0c0c15;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px; padding: 6px;
      min-width: 224px;
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
      display: flex; align-items: center;
      gap: 10px; padding: 10px 12px 8px;
    }
    .profile-dropdown__avatar {
      width: 32px; height: 32px; border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.09); flex-shrink: 0;
    }
    .profile-dropdown__label {
      font-family: 'DM Sans', sans-serif;
      font-size: 10px; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
      color: rgba(240,238,232,0.22); margin-bottom: 2px;
    }
    .profile-email {
      display: block;
      font-family: 'DM Sans', sans-serif;
      font-size: 12.5px; font-weight: 500;
      color: rgba(240,238,232,0.52);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 164px;
    }
    .profile-dropdown__divider { height:1px; background:rgba(255,255,255,0.06); margin:2px 0; }

    .profile-dropdown .logout-btn {
      display: flex; align-items: center; gap: 8px;
      width: 100%; padding: 9px 12px;
      background: transparent;
      color: rgba(240,112,104,0.72);
      border: none; border-radius: 9px;
      cursor: pointer;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px; font-weight: 500;
      text-align: left;
      transition: background 0.15s, color 0.15s;
    }
    .profile-dropdown .logout-btn:hover {
      background: rgba(240,112,104,0.08);
      color: #f07068;
    }

    /* ────────────────────────────────
       HAMBURGERs
    ──────────────────────────────── */
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
      cursor: pointer; padding: 0;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      transition: border-color 0.2s ease, background 0.2s ease;
      flex-shrink: 0;
    }
    .nav-hamburger span {
      display: block;
      width: 18px; height: 1.5px;
      background: rgba(240,238,232,0.7);
      border-radius: 2px;
      transition: all 0.26s cubic-bezier(0.4,0,0.2,1);
      transform-origin: center;
    }
    .nav-hamburger.open {
      border-color: rgba(201,168,76,0.35);
      background: rgba(201,168,76,0.06);
    }
    .nav-hamburger.open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); background: #c9a84c; }
    .nav-hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
    .nav-hamburger.open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); background: #c9a84c; }
    .nav-hamburger:hover { border-color: rgba(255,255,255,0.22); }

    /* ────────────────────────────────
       MOBİL OVERLAY
    ──────────────────────────────── */
    .nav-mobile-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 997;
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
    }
    .nav-mobile-overlay.visible { display: block; }

    /* ────────────────────────────────
       MOBİL BENTO GRID (menü alt kısım)
    ──────────────────────────────── */
    .nav-mobile-bento {
      display: none; /* masaüstünde gizli */
    }

    /* ────────────────────────────────
       RESPONSIVE BREAKPOINTS
    ──────────────────────────────── */

    /* ─ Tablet (≤1000px): padding kıs ─ */
    @media (max-width: 1000px) {
      .navbar { padding: 0 28px; gap: 14px; }
      .drop-item-sub { display: none; }
    }

    /* ─ Küçük tablet (≤820px): metin gizle, ikon kalsın ─ */
    @media (max-width: 820px) {
      .navbar { padding: 0 20px; height: 64px; }
      .nav-item span { display: none; }
      .nav-chevron { display: none; }
      .nav-item { padding: 8px 10px; }
      .nav-cta-label { display: none; }
      .nav-cta { padding: 8px 10px; }
      .logo__favicon { width: 28px; height: 28px; }
      .logo__text { font-size: 15px; }
      /* Dropdown sola hizala, taşmasın */
      .nav-dropdown { left: 0; transform: translateX(0) translateY(-8px); }
      .nav-item-wrap.open .nav-dropdown { transform: translateX(0) translateY(0); }
    }

    /* ─ Mobil (≤620px): tam ekran menü ─ */
    @media (max-width: 620px) {
      .navbar { padding: 0 16px; height: 60px; gap: 10px; }
      .nav-hamburger { display: flex; }
      .nav-vr { display: none; }
      .nav-cta { display: none; } /* Seviye Testi bento'da var */

      /* Mobil menü paneli — tam genişlik, aşağı açılır */
      .nav-links {
        position: fixed;
        top: 60px;           /* navbar yüksekliği */
        left: 0; right: 0;
        width: 100%;
        max-height: calc(100dvh - 60px);
        background: rgba(9, 9, 14, 0.98);
        backdrop-filter: blur(28px) saturate(160%);
        -webkit-backdrop-filter: blur(28px) saturate(160%);
        border-bottom: 1px solid rgba(255,255,255,0.07);
        box-shadow: 0 20px 48px rgba(0,0,0,0.65);
        flex-direction: column;
        align-items: stretch;
        gap: 2px;
        padding: 12px 14px 24px;
        z-index: 998;
        overflow-y: auto;
        /* Kapalı hâl */
        opacity: 0;
        transform: translateY(-10px);
        pointer-events: none;
        visibility: hidden;
        transition:
          opacity    0.24s cubic-bezier(0.4, 0, 0.2, 1),
          transform  0.24s cubic-bezier(0.4, 0, 0.2, 1),
          visibility 0s linear 0.24s;
      }
      .nav-links.mobile-open {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
        visibility: visible;
        transition:
          opacity   0.24s cubic-bezier(0.4, 0, 0.2, 1),
          transform 0.24s cubic-bezier(0.4, 0, 0.2, 1);
      }

      /* Mobilde nav-item'lar tam genişlik */
      .nav-item {
        width: 100%; padding: 13px 16px;
        border-radius: 12px; font-size: 14px;
        min-height: 48px;
      }
      .nav-item span { display: inline; }
      .nav-chevron  { display: flex; }

      /* Dropdown mobilde statik, akordeon gibi */
      .nav-item-wrap { flex-direction: column; width: 100%; }
      .nav-dropdown {
        position: static;
        transform: none !important;
        opacity: 1;
        pointer-events: auto;
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.26s ease;
        min-width: 0;
      }
      .nav-item-wrap.open .nav-dropdown { max-height: 600px; }
      .nav-dropdown-inner { margin: 4px 0 4px 8px; border-radius: 12px; }

      /* ─ BENTO GRID (mobil alt kısım) ─ */
      .nav-mobile-bento {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(255,255,255,0.06);
      }

      .nav-bento-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 18px 12px;
        border-radius: 14px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.07);
        text-decoration: none;
        font-family: 'DM Sans', sans-serif;
        font-size: 12.5px;
        font-weight: 600;
        color: rgba(240,238,232,0.55);
        transition: all 0.18s ease;
        text-align: center;
        min-height: 80px;
      }
      .nav-bento-card:hover,
      .nav-bento-card:active {
        background: rgba(255,255,255,0.07);
        border-color: rgba(255,255,255,0.14);
        color: #f0eee8;
      }
      .nav-bento-card--cta {
        background: rgba(201,168,76,0.08);
        border-color: rgba(201,168,76,0.22);
        color: #c9a84c;
      }
      .nav-bento-card--cta:hover,
      .nav-bento-card--cta:active {
        background: rgba(201,168,76,0.14);
        border-color: rgba(201,168,76,0.38);
        color: #e8c97a;
      }
      .nav-bento-card svg { opacity: 0.75; }
      .nav-bento-card--cta svg { opacity: 1; }
    }

    /* ─ Çok küçük ekran (≤380px) ─ */
    @media (max-width: 380px) {
      .logo__text { font-size: 13px; }
      .logo__favicon { width: 24px; height: 24px; }
      .profile-avatar-img { width: 30px !important; height: 30px !important; }
    }
  `;

  document.head.appendChild(style);
  document.body.prepend(navbar);

  /* ────────────────────────────────────────
     OVERLAY
  ──────────────────────────────────────── */
  const overlayEl = document.createElement("div");
  overlayEl.className = "nav-mobile-overlay";
  overlayEl.id        = "navOverlay";
  document.body.appendChild(overlayEl);

  /* ────────────────────────────────────────
     MOBİL MENÜ: AÇMA / KAPAMA
  ──────────────────────────────────────── */
  const hamburger = document.getElementById("navHamburger");
  const navLinks  = document.getElementById("navLinks");
  const overlay   = document.getElementById("navOverlay");

  function openMobileMenu() {
    hamburger.classList.add("open");
    navLinks.classList.add("mobile-open");
    overlay.classList.add("visible");
    hamburger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden"; /* Arka sayfa kaydırmayı kilitle */
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
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMobileMenu(); });

  /* Normal link tıklamalarında menüyü kapat (dropdown hariç) */
  navLinks.addEventListener("click", (e) => {
    const isDropdownLink = e.target.closest(".nav-item[aria-haspopup]");
    const isRegularLink  = e.target.closest("a");
    if (isRegularLink && !isDropdownLink) closeMobileMenu();
  });

  /* ────────────────────────────────────────
     DROPDOWN — hover (masaüstü) + click (mobil/dokunmatik)
  ──────────────────────────────────────── */
  const HOVER_DELAY = 180;

  document.querySelectorAll(".nav-item-wrap").forEach((wrap) => {
    let timer = null;
    const openDrop  = () => { clearTimeout(timer); wrap.classList.add("open"); };
    const closeDrop = () => {
      timer = setTimeout(() => wrap.classList.remove("open"), HOVER_DELAY);
    };

    wrap.addEventListener("mouseenter", openDrop);
    wrap.addEventListener("mouseleave", closeDrop);

    /* Dokunmatik: tıkla → aç/kapat, sayfaya gitme */
    const trigger = wrap.querySelector(".nav-item");
    if (trigger && wrap.querySelector(".nav-dropdown")) {
      trigger.addEventListener("click", (e) => {
        const isTouch = window.matchMedia("(hover: none)").matches;
        if (!isTouch) return;
        e.preventDefault();
        const isOpen = wrap.classList.contains("open");
        document.querySelectorAll(".nav-item-wrap").forEach((w) => w.classList.remove("open"));
        if (!isOpen) openDrop();
      });
    }

    /* Dışarı tıklayınca kapat */
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) wrap.classList.remove("open");
    });
  });

  /* ────────────────────────────────────────
     PROFİL DROPDOWN
  ──────────────────────────────────────── */
  const avatar   = document.getElementById("profileAvatar");
  const profDrop = document.getElementById("profileDropdown");

  avatar.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = profDrop.classList.toggle("open");
    avatar.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      profDrop.classList.remove("open");
      avatar.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("click", (e) => {
    if (!profDrop.contains(e.target) && e.target !== avatar) {
      profDrop.classList.remove("open");
      avatar.setAttribute("aria-expanded", "false");
    }
  });

  /* ────────────────────────────────────────
     LOGOUT
  ──────────────────────────────────────── */
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    try   { await logoutFirebase(); }
    catch (err) { console.error("Logout error:", err); }
    finally     { window.location.href = "/"; }
  });

  /* ────────────────────────────────────────
     AUTH DURUM TAKIBI
  ──────────────────────────────────────── */
  onAuthChange((user) => {
    const loginBtn  = document.getElementById("navLoginBtn");
    const profileWr = document.getElementById("profileWrapper");

    if (user) {
      if (loginBtn)  loginBtn.style.display  = "none";
      if (profileWr) profileWr.style.display = "inline-flex";

      const name = user.displayName || user.email || "U";
      const src  = user.photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a1a2e&color=c9a84c&size=64`;

      document.getElementById("profileEmail").textContent    = user.email || "Kullanıcı";
      document.getElementById("profileAvatarImg").src        = src;
      document.getElementById("profileAvatarSmall").src      = src;
    } else {
      if (loginBtn)  loginBtn.style.display  = "flex";
      if (profileWr) profileWr.style.display = "none";
    }
  });
}

/* ─────────────────────────────────────────────────
   loadFloatingMenu (FAB)
   ❌ HATA: .fab-label, .fab-item-content içindeydi.
   CSS'de position:absolute parent'a göre konumlanır;
   ancak parent transform uygulandığında yeni bir
   stacking context oluşur ve etiket kayar.
   ✔ DÜZELTME: .fab-label artık .fab-item'ın direkt çocuğu.
───────────────────────────────────────────────── */
function loadFloatingMenu() {
  if (document.getElementById("globalFab")) return;

  /* SVG yardımcısı */
  const fSvg = (d) =>
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

  /* ❌ HATA: label, fab-item-content içindeydi
     ✔ DÜZELTME: fab-item'ın direkt çocuğu yapıldı */
  const fabItem = (href, label, cls, svgPath) => `
    <a href="${href}" class="fab-item ${cls}" aria-label="${label}">
      <span class="fab-label">${label}</span>
      <div class="fab-item-content">
        ${fSvg(svgPath)}
      </div>
    </a>`;

  const fabContainer = document.createElement("div");
  fabContainer.className = "fab-wrapper";
  fabContainer.id        = "globalFab";
  fabContainer.setAttribute("role", "group");
  fabContainer.setAttribute("aria-label", "Hızlı erişim menüsü");

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
    <button class="fab-main" id="fabToggle"
            aria-label="Hızlı menüyü aç/kapat" aria-expanded="false"
            aria-controls="globalFab">
      +
    </button>
  `;

  document.body.appendChild(fabContainer);

  const toggleBtn = document.getElementById("fabToggle");

  const openFab = () => {
    fabContainer.classList.add("active");
    toggleBtn.setAttribute("aria-expanded", "true");
  };
  const closeFab = () => {
    fabContainer.classList.remove("active");
    toggleBtn.setAttribute("aria-expanded", "false");
  };

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

/* ─────────────────────────────────────────────────
   Yardımcılar
───────────────────────────────────────────────── */
function getLoginHref() { return "/login.html"; }
function getUserId()    { return auth.currentUser ? auth.currentUser.uid : null; }

/* ─────────────────────────────────────────────────
   İlk yükleme
───────────────────────────────────────────────── */
loadFloatingMenu();

export { requireAuth, loadNavbar, getUserId };

/* window'a bağla — inline script'lerle uyumluluk */
window.requireAuth = requireAuth;
window.loadNavbar  = loadNavbar;
window.getUserId   = getUserId;