import { auth, logoutFirebase, onAuthChange } from "./firebase.js";

/* ============================
   AUTH KONTROL
============================= */

function requireAuth(){
  const isLocal =
    location.hostname === "127.0.0.1" ||
    location.hostname === "localhost";

  onAuthChange((user) => {
    if(!user && !isLocal){
      window.location.href = "../";
    }
  });
}

/* ============================
   NAVBAR
============================= */

function loadNavbar(){
  const navbar = document.createElement("div");
  navbar.className = "navbar";

  /* Hangi sayfada olduğumuzu tespit et */
  const isAnasayfa = window.location.pathname.includes("anasayfa");

  navbar.innerHTML = `
    <div class="logo">AlmancaPratik</div>
    <div style="display:flex; gap:8px; align-items:center;">

      <!-- Dersler & Pratik sekmeleri -->
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

      <div class="profile-wrapper" id="profileWrapper">
        <img
          class="profile-avatar"
          id="profileAvatar"
          src="https://ui-avatars.com/api/?name=User&background=555&color=fff&size=64"
          alt="Profil fotoğrafı"
        />
        <div class="profile-dropdown" id="profileDropdown" role="menu" aria-label="Profil menüsü">
          <div class="profile-dropdown__header">
            <img
              class="profile-dropdown__avatar"
              id="profileAvatarSmall"
              src="https://ui-avatars.com/api/?name=User&background=555&color=fff&size=64"
              alt="Profil fotoğrafı"
            />
            <span class="profile-email" id="profileEmail">Yükleniyor...</span>
          </div>
          <div class="profile-dropdown__divider"></div>
          <button class="logout-btn" id="logoutBtn" role="menuitem">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    /* ── Nav tab butonları ── */
    .nav-tabs-wrap {
      display: flex;
      gap: 4px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 10px;
      padding: 3px;
    }

    .nav-tab-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: transparent;
      border: none;
      border-radius: 7px;
      cursor: pointer;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 500;
      color: rgba(240,238,232,0.45);
      transition: all 0.2s ease;
      white-space: nowrap;
      min-height: 32px;
    }

    .nav-tab-btn svg {
      opacity: 0.6;
      transition: opacity 0.2s;
    }

    .nav-tab-btn:hover {
      color: rgba(240,238,232,0.85);
      background: rgba(255,255,255,0.06);
    }

    .nav-tab-btn:hover svg {
      opacity: 0.85;
    }

    .nav-tab-btn.active {
      background: rgba(201,168,76,0.13);
      color: #c9a84c;
      font-weight: 600;
    }

    .nav-tab-btn.active svg {
      opacity: 1;
      stroke: #c9a84c;
    }

    .nav-divider {
      width: 1px;
      height: 24px;
      background: rgba(255,255,255,0.07);
      flex-shrink: 0;
    }

    /* ── Profil ── */
    .profile-wrapper {
      position: relative;
      display: inline-block;
    }

    .profile-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      object-fit: cover;
      cursor: pointer;
      border: 1.5px solid rgba(255,255,255,0.15);
      transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
      display: block;
    }
    .profile-avatar:hover {
      border-color: rgba(201,168,76,0.7);
      transform: scale(1.06);
      box-shadow: 0 0 0 3px rgba(201,168,76,0.12);
    }

    .profile-dropdown {
      display: none;
      position: absolute;
      right: 0;
      top: calc(100% + 12px);
      background: #0f0f14;
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 12px;
      padding: 6px;
      min-width: 210px;
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.03),
        0 16px 40px rgba(0,0,0,0.6),
        0 4px 12px rgba(0,0,0,0.4);
      z-index: 9999;
      animation: dropdownIn 0.18s cubic-bezier(0.4,0,0.2,1) both;
    }
    .profile-dropdown.open {
      display: block;
    }

    @keyframes dropdownIn {
      from { opacity: 0; transform: translateY(-6px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .profile-dropdown__header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
    }

    .profile-dropdown__avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid rgba(255,255,255,0.1);
      flex-shrink: 0;
    }

    .profile-email {
      display: block;
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      font-weight: 400;
      color: rgba(240,238,232,0.45);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 150px;
    }

    .profile-dropdown__divider {
      height: 1px;
      background: rgba(255,255,255,0.07);
      margin: 2px 0;
    }

    .profile-dropdown .logout-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 9px 12px;
      background: transparent;
      color: rgba(240,112,104,0.8);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 500;
      text-align: left;
      transition: background 0.15s, color 0.15s;
    }
    .profile-dropdown .logout-btn:hover {
      background: rgba(240,112,104,0.1);
      color: #f07068;
    }
    .profile-dropdown .logout-btn svg {
      flex-shrink: 0;
    }

    /* ── Mobil ── */
    @media (max-width: 480px) {
      .nav-tab-btn span,
      .nav-tab-btn {
        font-size: 12px;
        padding: 5px 10px;
        gap: 4px;
      }
      .nav-divider { display: none; }
    }
  `;
  document.head.appendChild(style);
  document.body.prepend(navbar);

  /* ── Tab tıklama logic ── */
  document.getElementById("tabDerslerBtn").addEventListener("click", () => {
    if (isAnasayfa) {
      setActiveTab("dersler");
    } else {
      window.location.href = "../anasayfa/?tab=dersler";
    }
  });

  document.getElementById("tabPratikBtn").addEventListener("click", () => {
    if (isAnasayfa) {
      setActiveTab("pratik");
    } else {
      window.location.href = "../anasayfa/?tab=pratik";
    }
  });

  /* Çıkış */
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    try {
      await logoutFirebase();
    } catch (err) {
      console.error("Çıkış hatası:", err);
    } finally {
      window.location.href = "../";
    }
  });

  /* ── Dropdown aç/kapat ── */
  const avatar   = document.getElementById("profileAvatar");
  const dropdown = document.getElementById("profileDropdown");

  avatar.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains("open");
    dropdown.classList.toggle("open");
    avatar.setAttribute("aria-expanded", String(!isOpen));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      dropdown.classList.remove("open");
      avatar.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("click", () => {
    dropdown.classList.remove("open");
    avatar.setAttribute("aria-expanded", "false");
  });

  /* ── Kullanıcı bilgilerini doldur ── */
  onAuthChange((user) => {
    if(user){
      document.getElementById("profileEmail").textContent = user.email || "Kullanıcı";

      const avatarSrc = user.photoURL
        ? user.photoURL
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || "U")}&background=1e1830&color=a064ff&size=64`;

      document.getElementById("profileAvatar").src      = avatarSrc;
      document.getElementById("profileAvatarSmall").src = avatarSrc;
    }
  });

  /* ── Aktif tab'ı işaretle (anasayfadaysak) ── */
  if (isAnasayfa) {
    const urlTab    = new URLSearchParams(window.location.search).get("tab");
    const savedTab  = urlTab || sessionStorage.getItem("activeTab") || "pratik";
    /* Kısa gecikme: DOM hazır olsun */
    requestAnimationFrame(() => setActiveTab(savedTab, false));
  }
}

/* ── Tab geçiş fonksiyonu (global — anasayfa.js de kullanır) ── */
function setActiveTab(tab, save = true) {
  /* Buton stillerini güncelle */
  document.getElementById("tabPratikBtn")?.classList.toggle("active", tab === "pratik");
  document.getElementById("tabDerslerBtn")?.classList.toggle("active", tab === "dersler");

  /* İçerik alanlarını göster/gizle */
  const pratik   = document.getElementById("pratikContent");
  const dersler  = document.getElementById("derslerContent");
  if (pratik)  pratik.style.display  = tab === "pratik"  ? "block" : "none";
  if (dersler) dersler.style.display = tab === "dersler" ? "block" : "none";

  if (save) sessionStorage.setItem("activeTab", tab);
}

/* ============================
   KULLANICI ID
============================= */

function getUserId(){
  const user = auth.currentUser;
  return user ? user.uid : null;
}

export { requireAuth, loadNavbar, getUserId, setActiveTab };

// Geriye dönük uyumluluk
window.requireAuth  = requireAuth;
window.loadNavbar   = loadNavbar;
window.getUserId    = getUserId;
window.setActiveTab = setActiveTab;