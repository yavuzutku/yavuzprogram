import { auth, logoutFirebase, onAuthChange } from "./firebase.js";

/* ============================
   AUTH KONTROL
============================= */

function requireAuth(){
  const isLocal =
    location.hostname === "127.0.0.1" ||
    location.hostname === "localhost";

  // Local dev: Firebase auth çalışır ama yine de bekle
  onAuthChange((user) => {
    if(!user && !isLocal){
      window.location.href = "index.html";
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
    <div class="logo">YavuzProgram</div>
    <div style="display:flex; gap:12px; align-items:center;">
      <button class="home-btn" id="homeBtn">Anamenü</button>
      <button class="logout-btn" id="logoutBtn">Çıkış Yap</button>
    </div>
  `;
  document.body.prepend(navbar);

  document.getElementById("homeBtn").addEventListener("click", () => {
    window.location.href = "anasayfa.html";
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await logoutFirebase();
    window.location.href = "index.html";
  });
}

/* ============================
   KULLANICI ID
============================= */

function getUserId(){
  const user = auth.currentUser;
  return user ? user.uid : null;
}

// Global'e aç
window.requireAuth = requireAuth;
window.loadNavbar  = loadNavbar;
window.getUserId   = getUserId;