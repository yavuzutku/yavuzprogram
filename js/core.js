import { auth, logoutFirebase, onAuthChange } from "./firebase.js";

/* requireAuth — sadece tamamen private sayfalar için */
function requireAuth(){
  const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  onAuthChange((user) => {
    if(!user && !isLocal) window.location.href = "../";
  });
}

function loadNavbar(){
  const navbar = document.createElement("div");
  navbar.className = "navbar";

  // Aktif sayfa tespiti
  const path = window.location.pathname;
  const isDersler = path.includes("/dersler");
  const isBlog    = path.includes("/blog");

  navbar.innerHTML = `
    <div class="logo">AlmancaPratik</div>
    <div style="display:flex;gap:8px;align-items:center;">

      <div class="nav-divider"></div>

      <!-- Dersler sayfasına direkt link -->
      <a class="nav-dersler-btn${isDersler ? " active" : ""}" href="/dersler/">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        Dersler
      </a>

      <div class="nav-divider"></div>

      <a class="nav-seviye-btn" id="navSeviyeBtn" href="/seviyeler/seviyetespit/">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
        Seviye Testi
      </a>

      <div class="nav-divider"></div>

      <a class="nav-blog-btn${isBlog ? " active" : ""}" href="/blog/">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Blog
      </a>

      <div class="nav-divider"></div>

      <a class="nav-login-btn" id="navLoginBtn" href="${getLoginHref()}" style="display:none">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        Giriş Yap
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
    /* ── Ayırıcı ── */
    .nav-divider{width:1px;height:24px;background:rgba(255,255,255,0.07);}

    /* ── Dersler butonu ── */
    .nav-dersler-btn{display:flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(79,214,156,0.08);border:1px solid rgba(79,214,156,0.2);border-radius:8px;color:rgba(79,214,156,0.8);font-family:'DM Sans',sans-serif;font-size:12.5px;font-weight:600;text-decoration:none;transition:all 0.2s;white-space:nowrap;}
    .nav-dersler-btn svg{opacity:0.8;stroke:rgba(79,214,156,0.8);}
    .nav-dersler-btn:hover,.nav-dersler-btn.active{background:rgba(79,214,156,0.14);border-color:rgba(79,214,156,0.4);color:#4fd69c;transform:translateY(-1px);}
    .nav-dersler-btn.active{transform:none;}

    /* ── Seviye testi butonu ── */
    .nav-seviye-btn{display:flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(96,200,240,0.08);border:1px solid rgba(96,200,240,0.2);border-radius:8px;color:rgba(96,200,240,0.8);font-family:'DM Sans',sans-serif;font-size:12.5px;font-weight:600;text-decoration:none;transition:all 0.2s;white-space:nowrap;}
    .nav-seviye-btn svg{opacity:0.8;stroke:rgba(96,200,240,0.8);}
    .nav-seviye-btn:hover{background:rgba(96,200,240,0.14);border-color:rgba(96,200,240,0.4);color:#60c8f0;transform:translateY(-1px);}

    /* ── Blog butonu ── */
    .nav-blog-btn{display:flex;align-items:center;gap:6px;padding:6px 14px;background:transparent;border:1px solid rgba(255,255,255,0.09);border-radius:8px;color:rgba(240,238,232,0.5);font-family:'DM Sans',sans-serif;font-size:12.5px;font-weight:500;text-decoration:none;transition:all 0.2s;white-space:nowrap;}
    .nav-blog-btn svg{opacity:0.6;}
    .nav-blog-btn:hover,.nav-blog-btn.active{background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.16);color:rgba(240,238,232,0.9);}

    /* ── Giriş butonu ── */
    .nav-login-btn{display:flex;align-items:center;gap:6px;padding:7px 16px;background:linear-gradient(135deg,#c9a84c,#e8c97a);color:#0a0a0f!important;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;border-radius:8px;text-decoration:none;box-shadow:0 3px 14px rgba(201,168,76,0.3);transition:all 0.2s;white-space:nowrap;}
    .nav-login-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(201,168,76,0.45);}
    .nav-login-btn:active{transform:scale(0.97);}

    /* ── Profil ── */
    .profile-wrapper{position:relative;display:inline-block;}
    .profile-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;cursor:pointer;border:1.5px solid rgba(255,255,255,0.15);transition:border-color 0.2s,transform 0.2s,box-shadow 0.2s;display:block;}
    .profile-avatar:hover{border-color:rgba(201,168,76,0.7);transform:scale(1.06);box-shadow:0 0 0 3px rgba(201,168,76,0.12);}
    .profile-dropdown{display:none;position:absolute;right:0;top:calc(100% + 12px);background:#0f0f14;border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:6px;min-width:210px;box-shadow:0 16px 40px rgba(0,0,0,0.6);z-index:9999;animation:dropdownIn 0.18s cubic-bezier(0.4,0,0.2,1) both;}
    .profile-dropdown.open{display:block;}
    @keyframes dropdownIn{from{opacity:0;transform:translateY(-6px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);}}
    .profile-dropdown__header{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;}
    .profile-dropdown__avatar{width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,0.1);flex-shrink:0;}
    .profile-email{display:block;font-family:'DM Sans',sans-serif;font-size:12px;color:rgba(240,238,232,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;}
    .profile-dropdown__divider{height:1px;background:rgba(255,255,255,0.07);margin:2px 0;}
    .profile-dropdown .logout-btn{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;background:transparent;color:rgba(240,112,104,0.8);border:none;border-radius:8px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;text-align:left;transition:background 0.15s,color 0.15s;}
    .profile-dropdown .logout-btn:hover{background:rgba(240,112,104,0.1);color:#f07068;}

    /* ── Responsive ── */
    @media(max-width:900px){
      .nav-dersler-btn span,.nav-seviye-btn span,.nav-blog-btn span{display:none;}
      .nav-dersler-btn,.nav-seviye-btn,.nav-blog-btn{padding:6px 10px;}
    }
    @media(max-width:480px){
      .nav-seviye-btn{display:none;}
    }
  `;
  document.head.appendChild(style);
  document.body.prepend(navbar);

  /* ── Çıkış ── */
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    try { await logoutFirebase(); } catch(e){ console.error(e); }
    finally { window.location.href = "../"; }
  });

  /* ── Profil dropdown ── */
  const avatar   = document.getElementById("profileAvatar");
  const dropdown = document.getElementById("profileDropdown");
  avatar.addEventListener("click", e => { e.stopPropagation(); dropdown.classList.toggle("open"); });
  document.addEventListener("keydown", e => { if(e.key==="Escape") dropdown.classList.remove("open"); });
  document.addEventListener("click", () => dropdown.classList.remove("open"));

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
function getAnasayfaHref(){ return "/anasayfa/"; }
function getUserId(){
  return auth.currentUser ? auth.currentUser.uid : null;
}

export { requireAuth, loadNavbar, getUserId };
window.requireAuth  = requireAuth;
window.loadNavbar   = loadNavbar;
window.getUserId    = getUserId;