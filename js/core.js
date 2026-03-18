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
  const isPratik  = isRoot || ["/quiz/","/artikel/","/cumlebul/","/ceviri/","/metin/","/okuma/","/kelimeler/","/wordsadd/","/singleadd/","/gecmis/"].some(p => path.includes(p));

  navbar.innerHTML = `
    <a class="logo" href="/" aria-label="AlmancaPratik ana sayfa">AlmancaPratik</a>
    <div style="display:flex;gap:6px;align-items:center;">

      <!-- Dersler dropdown -->
      <div class="nav-dropdown-wrap" id="derslerDropWrap">
        <a class="nav-pill nav-pill--dersler${isDersler ? " nav-pill--active" : ""}" href="/dersler/" id="derslerPill">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <span>Dersler</span>
          <svg class="nav-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </a>
        <div class="nav-dropdown" id="derslerDrop"><div class="nav-dropdown-inner">
          <div class="nav-drop-header">Seviyeye Göre</div>
          <a class="nav-drop-item" href="/dersler/?cat=A1">
            <span class="nav-drop-badge nav-drop-badge--a1">A1</span>
            <div><div class="nav-drop-title">Başlangıç</div><div class="nav-drop-sub">Temel kelimeler ve basit cümleler</div></div>
          </a>
          <a class="nav-drop-item" href="/dersler/?cat=A2">
            <span class="nav-drop-badge nav-drop-badge--a2">A2</span>
            <div><div class="nav-drop-title">Temel</div><div class="nav-drop-sub">Günlük konuşma ve gramer</div></div>
          </a>
          <a class="nav-drop-item" href="/dersler/?cat=B1">
            <span class="nav-drop-badge nav-drop-badge--b1">B1</span>
            <div><div class="nav-drop-title">Orta</div><div class="nav-drop-sub">Karmaşık cümleler ve kelimeler</div></div>
          </a>
          <a class="nav-drop-item" href="/dersler/?cat=B2">
            <span class="nav-drop-badge nav-drop-badge--b2">B2</span>
            <div><div class="nav-drop-title">Üst Orta</div><div class="nav-drop-sub">İleri gramer ve metin analizi</div></div>
          </a>
          <a class="nav-drop-item" href="/dersler/?cat=C1">
            <span class="nav-drop-badge nav-drop-badge--c1">C1</span>
            <div><div class="nav-drop-title">İleri</div><div class="nav-drop-sub">Akademik ve profesyonel Almanca</div></div>
          </a>
          <div class="nav-drop-divider"></div>
          <a class="nav-drop-item nav-drop-item--all" href="/dersler/">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Tüm Dersleri Gör
          </a>
        </div></div>
      </div>

      <!-- Pratik dropdown -->
      <div class="nav-dropdown-wrap" id="pratikDropWrap">
        <button class="nav-pill nav-pill--pratik${isPratik ? " nav-pill--active" : ""}" id="pratikPill" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>Pratik</span>
          <svg class="nav-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="nav-dropdown nav-dropdown--wide" id="pratikDrop"><div class="nav-dropdown-inner">
          <div class="nav-drop-cols">
            <div class="nav-drop-col">
              <div class="nav-drop-header">Araçlar</div>
              <a class="nav-drop-item" href="/artikel/">
                <span class="nav-drop-icon nav-drop-icon--amber"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
                <div><div class="nav-drop-title">Artikel Bul</div><div class="nav-drop-sub">der / die / das</div></div>
              </a>
              <a class="nav-drop-item" href="/cumlebul/">
                <span class="nav-drop-icon nav-drop-icon--blue"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60c8f0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
                <div><div class="nav-drop-title">Cümle Örnekleri</div><div class="nav-drop-sub">Wiktionary · Tatoeba</div></div>
              </a>
              <a class="nav-drop-item" href="/ceviri/">
                <span class="nav-drop-icon nav-drop-icon--teal"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4fd69c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg></span>
                <div><div class="nav-drop-title">Çeviri</div><div class="nav-drop-sub">Almanca ↔ Türkçe</div></div>
              </a>
              <a class="nav-drop-item" href="/metin/">
                <span class="nav-drop-icon nav-drop-icon--violet"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a064ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
                <div><div class="nav-drop-title">Metin Analizi</div><div class="nav-drop-sub">Almanca metni oku ve analiz et</div></div>
              </a>
            </div>
            <div class="nav-drop-col">
              <div class="nav-drop-header">Çalışma</div>
              <a class="nav-drop-item" href="/quiz/">
                <span class="nav-drop-icon nav-drop-icon--violet"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a064ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>
                <div><div class="nav-drop-title">Kelime Quizi</div><div class="nav-drop-sub">Kendi listenden test</div></div>
              </a>
              <a class="nav-drop-item" href="/kelimeler/">
                <span class="nav-drop-icon nav-drop-icon--green"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4fd69c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span>
                <div><div class="nav-drop-title">Kelimelerim</div><div class="nav-drop-sub">Kişisel sözlük</div></div>
              </a>
              <a class="nav-drop-item" href="/wordsadd/">
                <span class="nav-drop-icon nav-drop-icon--rose"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f07068" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></span>
                <div><div class="nav-drop-title">Kelime Ekle</div><div class="nav-drop-sub">Sözlüğüne kelime kaydet</div></div>
              </a>
              <a class="nav-drop-item" href="/gecmis/">
                <span class="nav-drop-icon nav-drop-icon--gray"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(240,238,232,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
                <div><div class="nav-drop-title">Metin Geçmişi</div><div class="nav-drop-sub">Kayıtlı metinlerin</div></div>
              </a>
            </div>
          </div>
          <div class="nav-drop-footer">
            <a href="/seviyeler/seviyetespit/" class="nav-drop-footer-link">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
              Seviye testini ücretsiz çöz →
            </a>
          </div>
        </div></div>
      </div>

      <!-- Blog (düz link) -->
      <a class="nav-pill nav-pill--blog${isBlog ? " nav-pill--active" : ""}" href="/blog/">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <span>Blog</span>
      </a>

      <div class="nav-sep"></div>

      <!-- Seviye testi -->
      <a class="nav-pill nav-pill--seviye" href="/seviyeler/seviyetespit/">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
        <span>Seviye Testi</span>
      </a>

      <div class="nav-sep"></div>

      <!-- Auth -->
      <a class="nav-pill nav-pill--login" id="navLoginBtn" href="/login.html" style="display:none">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        <span>Giriş Yap</span>
      </a>

      <div class="profile-wrapper" id="profileWrapper" style="display:none">
        <img class="profile-avatar" id="profileAvatar" src="https://ui-avatars.com/api/?name=User&background=555&color=fff&size=64" alt="Profil"/>
        <div class="profile-dropdown" id="profileDropdown" role="menu">
          <div class="profile-dropdown__header">
            <img class="profile-dropdown__avatar" id="profileAvatarSmall" src="https://ui-avatars.com/api/?name=User&background=555&color=fff&size=64" alt="Profil"/>
            <span class="profile-email" id="profileEmail">Yükleniyor...</span>
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
    /* ── Logo: link olarak ── */
    .logo {
      font-family: 'Syne', sans-serif;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #f0eee8;
      position: relative;
      user-select: none;
      flex-shrink: 0;
      text-decoration: none;
    }
    .logo::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 100%;
      height: 1.5px;
      background: linear-gradient(90deg, #c9a84c, transparent);
      border-radius: 2px;
      opacity: 0.7;
    }

    /* ── Seperatör ── */
    .nav-sep{width:1px;height:20px;background:rgba(255,255,255,0.08);}

    /* ── Pill butonlar ── */
    .nav-pill{
      display:inline-flex;align-items:center;gap:5px;
      padding:6px 12px;border-radius:8px;
      font-family:'DM Sans',sans-serif;font-size:12.5px;font-weight:600;
      text-decoration:none;cursor:pointer;
      border:1px solid rgba(255,255,255,0.09);
      background:rgba(255,255,255,0.03);
      color:rgba(240,238,232,0.6);
      transition:all 0.18s cubic-bezier(0.4,0,0.2,1);
      white-space:nowrap;
      position:relative;
    }
    .nav-pill:hover{
      background:rgba(255,255,255,0.07);
      border-color:rgba(255,255,255,0.18);
      color:rgba(240,238,232,0.95);
    }
    .nav-pill svg:first-child{opacity:0.7;flex-shrink:0;}
    .nav-pill:hover svg:first-child{opacity:1;}
    .nav-chevron{opacity:0.45;transition:transform 0.2s;}

    .nav-pill--dersler.nav-pill--active,
    .nav-pill--dersler:hover{background:rgba(79,214,156,0.1);border-color:rgba(79,214,156,0.28);color:#4fd69c;}
    .nav-pill--dersler.nav-pill--active svg,.nav-pill--dersler:hover svg{stroke:#4fd69c;opacity:1;}

    .nav-pill--pratik.nav-pill--active,
    .nav-pill--pratik:hover{background:rgba(201,168,76,0.1);border-color:rgba(201,168,76,0.28);color:#c9a84c;}
    .nav-pill--pratik.nav-pill--active svg,.nav-pill--pratik:hover svg{stroke:#c9a84c;opacity:1;}

    .nav-pill--blog.nav-pill--active,
    .nav-pill--blog:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.2);color:rgba(240,238,232,0.95);}

    .nav-pill--seviye{background:rgba(96,200,240,0.06);border-color:rgba(96,200,240,0.18);color:rgba(96,200,240,0.75);}
    .nav-pill--seviye:hover{background:rgba(96,200,240,0.12);border-color:rgba(96,200,240,0.35);color:#60c8f0;}
    .nav-pill--seviye svg{stroke:rgba(96,200,240,0.75);}
    .nav-pill--seviye:hover svg{stroke:#60c8f0;}

    .nav-pill--login{background:linear-gradient(135deg,#c9a84c,#e8c97a);border-color:transparent;color:#0a0a0f !important;box-shadow:0 3px 14px rgba(201,168,76,0.28);}
    .nav-pill--login:hover{transform:translateY(-1px);box-shadow:0 6px 22px rgba(201,168,76,0.42);background:linear-gradient(135deg,#d9b85c,#f0d480);color:#0a0a0f !important;}
    .nav-pill--login svg{stroke:#0a0a0f;opacity:0.8;}

    .nav-dropdown-wrap{position:relative;display:inline-flex;}
    .nav-dropdown-wrap.open .nav-chevron{transform:rotate(180deg);}
    .nav-dropdown-wrap.open .nav-dropdown{opacity:1;pointer-events:all;transform:translateY(0);}
    .nav-dropdown-wrap.open .nav-dropdown--wide{transform:translateX(-50%) translateY(0);}

    .nav-dropdown{
      position:absolute;top:100%;left:0;padding-top:10px;
      min-width:240px;opacity:0;pointer-events:none;
      transform:translateY(-4px);
      transition:opacity 0.15s ease, transform 0.15s cubic-bezier(0.4,0,0.2,1);
      z-index:9999;
    }
    .nav-dropdown-inner{
      background:#0c0c12;border:1px solid rgba(255,255,255,0.1);
      border-radius:14px;padding:8px;
      box-shadow:0 20px 60px rgba(0,0,0,0.7),0 4px 16px rgba(0,0,0,0.4);
    }
    .nav-dropdown--wide{min-width:480px;left:50%;transform:translateX(-50%) translateY(-4px);}

    .nav-drop-header{font-family:'DM Sans',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(240,238,232,0.28);padding:6px 10px 4px;}
    .nav-drop-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;text-decoration:none;transition:background 0.15s;cursor:pointer;}
    .nav-drop-item:hover{background:rgba(255,255,255,0.06);}
    .nav-drop-item--all{color:rgba(240,238,232,0.5);font-family:'DM Sans',sans-serif;font-size:12.5px;font-weight:600;gap:8px;}
    .nav-drop-item--all:hover{color:rgba(240,238,232,0.85);}
    .nav-drop-item--all svg{opacity:0.5;}

    .nav-drop-title{font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;color:rgba(240,238,232,0.88);line-height:1.2;}
    .nav-drop-sub{font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(240,238,232,0.35);margin-top:1px;}
    .nav-drop-divider{height:1px;background:rgba(255,255,255,0.07);margin:4px 0;}

    .nav-drop-badge{font-family:'Syne',sans-serif;font-size:11px;font-weight:800;letter-spacing:0.02em;padding:3px 8px;border-radius:6px;flex-shrink:0;min-width:32px;text-align:center;}
    .nav-drop-badge--a1{background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);color:#22c55e;}
    .nav-drop-badge--a2{background:rgba(134,239,172,0.1);border:1px solid rgba(134,239,172,0.2);color:#86efac;}
    .nav-drop-badge--b1{background:rgba(96,200,240,0.1);border:1px solid rgba(96,200,240,0.22);color:#60c8f0;}
    .nav-drop-badge--b2{background:rgba(129,140,248,0.1);border:1px solid rgba(129,140,248,0.2);color:#818cf8;}
    .nav-drop-badge--c1{background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.22);color:#c9a84c;}

    .nav-drop-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
    .nav-drop-icon--amber{background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.2);}
    .nav-drop-icon--blue{background:rgba(96,200,240,0.1);border:1px solid rgba(96,200,240,0.18);}
    .nav-drop-icon--teal{background:rgba(79,214,156,0.1);border:1px solid rgba(79,214,156,0.18);}
    .nav-drop-icon--violet{background:rgba(160,100,255,0.1);border:1px solid rgba(160,100,255,0.18);}
    .nav-drop-icon--green{background:rgba(79,214,156,0.1);border:1px solid rgba(79,214,156,0.18);}
    .nav-drop-icon--rose{background:rgba(240,112,104,0.1);border:1px solid rgba(240,112,104,0.18);}
    .nav-drop-icon--gray{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);}

    .nav-drop-cols{display:grid;grid-template-columns:1fr 1fr;gap:4px;}
    .nav-drop-col{padding:2px;}
    .nav-drop-footer{border-top:1px solid rgba(255,255,255,0.07);margin-top:4px;padding:8px 10px 4px;}
    .nav-drop-footer-link{display:inline-flex;align-items:center;gap:6px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;color:rgba(201,168,76,0.7);text-decoration:none;transition:color 0.15s;}
    .nav-drop-footer-link:hover{color:#c9a84c;}

    .profile-wrapper{position:relative;display:inline-block;}
    .profile-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;cursor:pointer;border:1.5px solid rgba(255,255,255,0.12);transition:border-color 0.2s,transform 0.2s,box-shadow 0.2s;display:block;}
    .profile-avatar:hover{border-color:rgba(201,168,76,0.6);transform:scale(1.05);box-shadow:0 0 0 3px rgba(201,168,76,0.1);}
    .profile-dropdown{display:none;position:absolute;right:0;top:calc(100% + 10px);background:#0c0c12;border:1px solid rgba(255,255,255,0.09);border-radius:13px;padding:6px;min-width:210px;box-shadow:0 16px 40px rgba(0,0,0,0.6);z-index:9999;animation:dropdownIn 0.18s cubic-bezier(0.4,0,0.2,1) both;}
    .profile-dropdown.open{display:block;}
    @keyframes dropdownIn{from{opacity:0;transform:translateY(-6px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);}}
    .profile-dropdown__header{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;}
    .profile-dropdown__avatar{width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,0.1);flex-shrink:0;}
    .profile-email{display:block;font-family:'DM Sans',sans-serif;font-size:12px;color:rgba(240,238,232,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;}
    .profile-dropdown__divider{height:1px;background:rgba(255,255,255,0.07);margin:2px 0;}
    .profile-dropdown .logout-btn{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;background:transparent;color:rgba(240,112,104,0.8);border:none;border-radius:8px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;text-align:left;transition:background 0.15s,color 0.15s;}
    .profile-dropdown .logout-btn:hover{background:rgba(240,112,104,0.1);color:#f07068;}

    @media(max-width:1000px){
      .nav-drop-badge~div .nav-drop-sub,.nav-drop-icon~div .nav-drop-sub,.nav-drop-footer{display:none;}
      .nav-dropdown--wide{min-width:360px;}
      .nav-drop-cols{gap:2px;}
    }
    @media(max-width:820px){
      .nav-pill span{display:none;}
      .nav-chevron{display:none;}
      .nav-pill{padding:7px 10px;}
      .nav-dropdown{left:50%;transform:translateX(-50%) translateY(-4px);}
      .nav-dropdown-wrap.open .nav-dropdown:not(.nav-dropdown--wide){transform:translateX(-50%) translateY(0);}
      .nav-dropdown--wide{min-width:300px;left:50%;transform:translateX(-50%) translateY(-4px);}
      .nav-drop-cols{grid-template-columns:1fr;}
    }
    @media(max-width:600px){
      .nav-pill--seviye{display:none;}
      .nav-sep{display:none;}
    }
  `;
  document.head.appendChild(style);
  document.body.prepend(navbar);

  /* ── Dropdown hover ── */
  const DELAY = 180;
  document.querySelectorAll(".nav-dropdown-wrap").forEach(wrap => {
    let timer = null;
    const open  = () => { clearTimeout(timer); wrap.classList.add("open"); };
    const close = () => { timer = setTimeout(() => wrap.classList.remove("open"), DELAY); };
    wrap.addEventListener("mouseenter", open);
    wrap.addEventListener("mouseleave", close);
    document.addEventListener("click", e => { if(!wrap.contains(e.target)) wrap.classList.remove("open"); });
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
    if(user){
      if(loginBtn)  loginBtn.style.display  = "none";
      if(profileWr) profileWr.style.display = "inline-block";
      document.getElementById("profileEmail").textContent = user.email || "Kullanıcı";
      const src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName||user.email||"U")}&background=1e1830&color=a064ff&size=64`;
      document.getElementById("profileAvatar").src      = src;
      document.getElementById("profileAvatarSmall").src = src;
    } else {
      if(loginBtn)  loginBtn.style.display  = "flex";
      if(profileWr) profileWr.style.display = "none";
    }
  });
}

function getLoginHref(){ return "/login.html"; }
function getUserId(){
  return auth.currentUser ? auth.currentUser.uid : null;
}

export { requireAuth, loadNavbar, getUserId };
window.requireAuth  = requireAuth;
window.loadNavbar   = loadNavbar;
window.getUserId    = getUserId;