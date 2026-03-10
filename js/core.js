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
  navbar.innerHTML = `
    <div class="logo">AlmancaPratik</div>
    <div style="display:flex; gap:12px; align-items:center;">
      <button class="home-btn" id="homeBtn">Anamenü</button>

      <!-- Profil Fotoğrafı + Dropdown -->
      <div class="profile-wrapper" id="profileWrapper">
        <img
          class="profile-avatar"
          id="profileAvatar"
          src="https://ui-avatars.com/api/?name=User&background=555&color=fff&size=64"
          alt="Profil"
        />
        <div class="profile-dropdown" id="profileDropdown">
          <span class="profile-email" id="profileEmail">Yükleniyor...</span>
          <hr style="border-color:#ffffff22; margin:6px 0;">
          <button class="logout-btn" id="logoutBtn">🚪 Çıkış Yap</button>
        </div>
      </div>
    </div>
  `;

  // Stil enjeksiyonu
  const style = document.createElement("style");
  style.textContent = `
    .profile-wrapper {
      position: relative;
      display: inline-block;
    }

    .profile-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      object-fit: cover;
      cursor: pointer;
      border: 2px solid rgba(255,255,255,0.35);
      transition: border-color 0.2s, transform 0.2s;
    }
    .profile-avatar:hover {
      border-color: rgba(255,255,255,0.85);
      transform: scale(1.07);
    }

    .profile-dropdown {
      display: none;
      position: absolute;
      right: 0;
      top: calc(100% + 10px);
      background: #1e1e2e;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      padding: 10px 12px;
      min-width: 180px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.45);
      z-index: 9999;
      animation: fadeDown 0.18s ease;
    }
    .profile-dropdown.open {
      display: block;
    }

    @keyframes fadeDown {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .profile-email {
      display: block;
      font-size: 12px;
      color: #aaa;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 160px;
    }

    .profile-dropdown .logout-btn {
      width: 100%;
      margin-top: 6px;
      padding: 7px 10px;
      background: #e74c3c22;
      color: #e74c3c;
      border: 1px solid #e74c3c55;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      text-align: left;
      transition: background 0.15s;
    }
    .profile-dropdown .logout-btn:hover {
      background: #e74c3c44;
    }
  `;
  document.head.appendChild(style);
  document.body.prepend(navbar);

  // Anamenü
  document.getElementById("homeBtn").addEventListener("click", () => {
    window.location.href = "../anasayfa/";
  });

  // Çıkış
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await logoutFirebase();
    window.location.href = "../";
  });

  // Dropdown aç/kapat
  const avatar   = document.getElementById("profileAvatar");
  const dropdown = document.getElementById("profileDropdown");

  avatar.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });

  // Dışarı tıklayınca kapat
  document.addEventListener("click", () => {
    dropdown.classList.remove("open");
  });

  // Kullanıcı bilgilerini doldur
  onAuthChange((user) => {
    if(user){
      document.getElementById("profileEmail").textContent = user.email || "Kullanıcı";

      if(user.photoURL){
        avatar.src = user.photoURL;
      } else {
        // İsim baş harfiyle avatar oluştur
        const name = encodeURIComponent(user.displayName || user.email || "U");
        avatar.src = `https://ui-avatars.com/api/?name=${name}&background=4f46e5&color=fff&size=64`;
      }
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

window.requireAuth = requireAuth;
window.loadNavbar  = loadNavbar;
window.getUserId   = getUserId;