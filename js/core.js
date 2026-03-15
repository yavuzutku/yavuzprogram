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
  const isAnasayfa = window.location.pathname.includes("anasayfa");

  navbar.innerHTML = `
    <div class="logo">AlmancaPratik</div>
    <div style="display:flex;gap:8px;align-items:center;">
      <div class="nav-tabs-wrap">
        <button class="nav-tab-btn" id="tabDerslerBtn" data-tab="dersler">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          Dersler
        </button>
        <button class="nav-tab-btn" id="tabPratikBtn" data-tab="pratik">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Pratik
        </button>
      </div>
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
    .nav-tabs-wrap{display:flex;gap:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:3px;}
    .nav-tab-btn{display:flex;align-items:center;gap:6px;padding:6px 14px;background:transparent;border:none;border-radius:7px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;color:rgba(240,238,232,0.45);transition:all 0.2s;white-space:nowrap;min-height:32px;}
    .nav-tab-btn svg{opacity:0.6;transition:opacity 0.2s;}
    .nav-tab-btn:hover{color:rgba(240,238,232,0.85);background:rgba(255,255,255,0.06);}
    .nav-tab-btn:hover svg{opacity:0.85;}
    .nav-tab-btn.active{background:rgba(201,168,76,0.13);color:#c9a84c;font-weight:600;}
    .nav-tab-btn.active svg{opacity:1;stroke:#c9a84c;}
    .nav-divider{width:1px;height:24px;background:rgba(255,255,255,0.07);flex-shrink:0;}
    .nav-login-btn{display:flex;align-items:center;gap:6px;padding:7px 16px;background:linear-gradient(135deg,#c9a84c,#e8c97a);color:#0a0a0f!important;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;border-radius:8px;text-decoration:none;box-shadow:0 3px 14px rgba(201,168,76,0.3);transition:all 0.2s;white-space:nowrap;}
    .nav-login-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(201,168,76,0.45);}
    .nav-login-btn:active{transform:scale(0.97);}
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
    @media(max-width:480px){.nav-tab-btn{font-size:12px;padding:5px 10px;gap:4px;}.nav-divider{display:none;}.nav-login-btn{padding:7px 12px;font-size:12px;}}
  `;
  document.head.appendChild(style);
  document.body.prepend(navbar);

  document.getElementById("tabDerslerBtn").addEventListener("click", () => {
    if (isAnasayfa) setActiveTab("dersler");
    else window.location.href = getAnasayfaHref() + "?tab=dersler";
  });
  document.getElementById("tabPratikBtn").addEventListener("click", () => {
    if (isAnasayfa) setActiveTab("pratik");
    else window.location.href = getAnasayfaHref() + "?tab=pratik";
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    try { await logoutFirebase(); } catch(e){ console.error(e); }
    finally { window.location.href = "../"; }
  });

  const avatar = document.getElementById("profileAvatar");
  const dropdown = document.getElementById("profileDropdown");
  avatar.addEventListener("click", e => { e.stopPropagation(); dropdown.classList.toggle("open"); });
  document.addEventListener("keydown", e => { if(e.key==="Escape") dropdown.classList.remove("open"); });
  document.addEventListener("click", () => dropdown.classList.remove("open"));

  onAuthChange((user) => {
    const loginBtn  = document.getElementById("navLoginBtn");
    const profileWr = document.getElementById("profileWrapper");
    if(user){
      if(loginBtn)  loginBtn.style.display  = "none";
      if(profileWr) profileWr.style.display = "inline-block";
      document.getElementById("profileEmail").textContent = user.email || "Kullanıcı";
      const src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName||user.email||"U")}&background=1e1830&color=a064ff&size=64`;
      document.getElementById("profileAvatar").src = src;
      document.getElementById("profileAvatarSmall").src = src;
    } else {
      if(loginBtn)  loginBtn.style.display  = "flex";
      if(profileWr) profileWr.style.display = "none";
    }
  });

  if(isAnasayfa){
    const urlTab  = new URLSearchParams(window.location.search).get("tab");
    const initTab = urlTab || sessionStorage.getItem("activeTab") || "pratik";
    requestAnimationFrame(() => setActiveTab(initTab, false));
  }
}

function setActiveTab(tab, save=true){
  document.getElementById("tabPratikBtn")?.classList.toggle("active",  tab==="pratik");
  document.getElementById("tabDerslerBtn")?.classList.toggle("active", tab==="dersler");
  const p = document.getElementById("pratikContent");
  const d = document.getElementById("derslerContent");
  if(p) p.style.display = tab==="pratik"  ? "block" : "none";
  if(d) d.style.display = tab==="dersler" ? "block" : "none";
  if(save) sessionStorage.setItem("activeTab", tab);
}

function getLoginHref(){ return "/login.html"; }
function getAnasayfaHref(){ return "/anasayfa/"; }
function getUserId(){
  return auth.currentUser ? auth.currentUser.uid : null;
}

export { requireAuth, loadNavbar, getUserId, setActiveTab };
window.requireAuth  = requireAuth;
window.loadNavbar   = loadNavbar;
window.getUserId    = getUserId;
window.setActiveTab = setActiveTab;