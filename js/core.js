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

  /* İskelet HTML — kullanıcı verisi YOK */
  navbar.innerHTML = `
    <div class="logo">AlmancaPratik</div>
    <div style="display:flex; gap:10px; align-items:center;">
      <button class="home-btn" id="homeBtn">Anamenü</button>
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
  `;
  document.head.appendChild(style);
  document.body.prepend(navbar);

  /* ── Anamenü ── */
  document.getElementById("homeBtn").addEventListener("click", () => {
    window.location.href = "../anasayfa/";
  });

  /* ── Çıkış ── */
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

  /* Klavye erişilebilirliği: Escape ile kapat */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      dropdown.classList.remove("open");
      avatar.setAttribute("aria-expanded", "false");
    }
  });

  /* Dışarı tıklayınca kapat */
  document.addEventListener("click", () => {
    dropdown.classList.remove("open");
    avatar.setAttribute("aria-expanded", "false");
  });

  /* ── Kullanıcı bilgilerini doldur ── */
  onAuthChange((user) => {
    if(user){
      /* textContent ile set et — innerHTML değil */
      document.getElementById("profileEmail").textContent = user.email || "Kullanıcı";

      const avatarSrc = user.photoURL
        ? user.photoURL
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || "U")}&background=1e1830&color=a064ff&size=64`;

      document.getElementById("profileAvatar").src      = avatarSrc;
      document.getElementById("profileAvatarSmall").src = avatarSrc;
    }
  });
}

/* ============================
   KULLANICI ID
============================= */

function getUserId(){
  const user = auth.currentUser;
  return user ? user.uid : null;
}

/* ============================
   EXPORT
   NOT: window'a bağlamak yerine
   ES Module export kullanıyoruz.
   Ancak mevcut sayfalar window.*
   ile çağırdığından geçici olarak
   ikisini de destekliyoruz.
============================= */

export { requireAuth, loadNavbar, getUserId };

// Geriye dönük uyumluluk — ileride kaldırılacak
window.requireAuth = requireAuth;
window.loadNavbar  = loadNavbar;
window.getUserId   = getUserId;