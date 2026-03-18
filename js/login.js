import {
  loginWithGoogle, loginWithEmail, registerWithEmail,
  resetPassword, logoutFirebase, onAuthChange
} from "./firebase.js";

function showError(elId, msg) {
  const el = document.getElementById(elId);
  if (el) { el.textContent = msg; el.style.display = msg ? "block" : "none"; }
}
function setLoading(btn, span, loading, label) {
  btn.disabled = loading;
  span.textContent = loading ? "Yükleniyor..." : label;
}

onAuthChange((user) => {
  if (!user) return;
  document.getElementById("login-view").style.display = "none";
  const uv = document.getElementById("user-view");
  uv.style.display = "flex";
  const nameEl   = document.getElementById("user-name");
  const emailEl  = document.getElementById("user-email");
  const avatarEl = document.getElementById("user-avatar");
  if (nameEl)   nameEl.textContent  = user.displayName || "Kullanıcı";
  if (emailEl)  emailEl.textContent = user.email || "";
  if (avatarEl) {
    avatarEl.src = user.photoURL || "";
    avatarEl.alt = (user.displayName || "Kullanıcı") + " profil fotoğrafı";
    avatarEl.style.display = user.photoURL ? "block" : "none";
  }
  setTimeout(() => {
    const params   = new URLSearchParams(window.location.search);
    const returnTo = params.get('returnTo');
    window.location.href = returnTo ? decodeURIComponent(returnTo) : "anasayfa/";
  }, 700);
});

document.addEventListener("DOMContentLoaded", () => {

  /* Tab geçişi */
  const tabGiris  = document.getElementById("tab-giris");
  const tabKayit  = document.getElementById("tab-kayit");
  const formGiris = document.getElementById("form-giris");
  const formKayit = document.getElementById("form-kayit");

  function switchTab(active) {
    const isGiris = active === "giris";
    tabGiris.classList.toggle("tab--active", isGiris);
    tabKayit.classList.toggle("tab--active", !isGiris);
    formGiris.style.display = isGiris  ? "flex" : "none";
    formKayit.style.display = !isGiris ? "flex" : "none";
    ["err-giris","err-kayit"].forEach(id => showError(id, ""));
  }

  tabGiris.addEventListener("click", () => switchTab("giris"));
  tabKayit.addEventListener("click", () => switchTab("kayit"));

  /* Google butonları */
  buildGoogleBtn("google-btn-giris", "Google ile Giriş Yap");
  buildGoogleBtn("google-btn-kayit", "Google ile Kayıt Ol");

  /* Email ile Giriş */
  const btnGiris  = document.getElementById("btn-giris");
  const spanGiris = btnGiris.querySelector("span");
  btnGiris.addEventListener("click", async () => {
    const email = document.getElementById("giris-email").value.trim();
    const pass  = document.getElementById("giris-sifre").value;
    showError("err-giris", "");
    if (!email || !pass) { showError("err-giris", "E-posta ve şifre zorunludur."); return; }
    setLoading(btnGiris, spanGiris, true, "Giriş Yap");
    try {
      await loginWithEmail(email, pass);
    } catch (err) {
      setLoading(btnGiris, spanGiris, false, "Giriş Yap");
      showError("err-giris", firebaseErrMsg(err.code));
    }
  });

  /* Email ile Kayıt */
  const btnKayit  = document.getElementById("btn-kayit");
  const spanKayit = btnKayit.querySelector("span");
  btnKayit.addEventListener("click", async () => {
    const name  = document.getElementById("kayit-ad").value.trim();
    const email = document.getElementById("kayit-email").value.trim();
    const pass  = document.getElementById("kayit-sifre").value;
    const pass2 = document.getElementById("kayit-sifre2").value;
    showError("err-kayit", "");
    if (!name || !email || !pass) { showError("err-kayit", "Tüm alanlar zorunludur."); return; }
    if (pass !== pass2)           { showError("err-kayit", "Şifreler eşleşmiyor."); return; }
    if (pass.length < 6)          { showError("err-kayit", "Şifre en az 6 karakter olmalıdır."); return; }
    setLoading(btnKayit, spanKayit, true, "Kayıt Ol");
    try {
      await registerWithEmail(email, pass, name);
    } catch (err) {
      setLoading(btnKayit, spanKayit, false, "Kayıt Ol");
      showError("err-kayit", firebaseErrMsg(err.code));
    }
  });

  /* Şifremi Unuttum */
  document.getElementById("forgot-link").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = document.getElementById("giris-email").value.trim();
    if (!email) { showError("err-giris", "Önce e-posta adresinizi girin."); return; }
    try {
      await resetPassword(email);
      showError("err-giris", "✅ Şifre sıfırlama e-postası gönderildi.");
    } catch (err) {
      showError("err-giris", firebaseErrMsg(err.code));
    }
  });

  /* Çıkış */
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    try { await logoutFirebase(); } catch {}
    window.location.reload();
  });
});

function buildGoogleBtn(containerId, label) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "google-btn";
  btn.setAttribute("aria-label", label);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width","20"); svg.setAttribute("height","20");
  svg.setAttribute("viewBox","0 0 48 48"); svg.setAttribute("aria-hidden","true");
  svg.innerHTML = `
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>`;
  const span = document.createElement("span");
  span.textContent = label;
  btn.appendChild(svg); btn.appendChild(span);
  container.appendChild(btn);
  btn.addEventListener("click", async () => {
    btn.disabled = true; span.textContent = "Yükleniyor...";
    try { await loginWithGoogle(); }
    catch (err) {
      btn.disabled = false; span.textContent = label;
      if (err.code !== "auth/popup-closed-by-user") {
        showError(containerId.includes("kayit") ? "err-kayit" : "err-giris",
          "Google ile giriş başarısız.");
      }
    }
  });
}

function firebaseErrMsg(code) {
  const map = {
    "auth/user-not-found":       "Bu e-posta ile kayıtlı hesap bulunamadı.",
    "auth/wrong-password":       "Şifre yanlış. Lütfen tekrar deneyin.",
    "auth/invalid-credential":   "E-posta veya şifre hatalı.",
    "auth/email-already-in-use": "Bu e-posta adresi zaten kullanımda.",
    "auth/weak-password":        "Şifre çok zayıf. En az 6 karakter kullanın.",
    "auth/invalid-email":        "Geçersiz e-posta adresi.",
    "auth/too-many-requests":    "Çok fazla deneme. Lütfen biraz bekleyin.",
    "auth/network-request-failed":"İnternet bağlantınızı kontrol edin.",
  };
  return map[code] || "Bir hata oluştu. Lütfen tekrar deneyin.";
}