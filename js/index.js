function parseJwt(token){
  try{
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g,'+').replace(/_/g,'/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  }catch(e){
    return null;
  }
}

/* TOKEN KONTROL */
document.addEventListener("DOMContentLoaded", ()=>{

  const token = localStorage.getItem("userToken");

  if(token){
    const payload = parseJwt(token);
    if(payload && payload.exp * 1000 > Date.now()){
      window.location.href = "anasayfa.html";
      return;
    }
  }
  updateAuthUI();
  initLogout();
  initGoogle();
});
function initGoogle(){

  google.accounts.id.initialize({
    client_id:'279266692579-pcrjmld03761be73i2pr6iis9evclm4q.apps.googleusercontent.com',
    callback:handleCredentialResponse,
    auto_select:true
  });

  google.accounts.id.renderButton(
    document.getElementById("google-btn-container"),
    {theme:'filled_black',size:'large',width:324}
  );

  google.accounts.id.prompt();
}

function handleCredentialResponse(response){
  localStorage.setItem("userToken",response.credential);
  window.location.href="anasayfa.html";
}

function initLogout(){

  const btn = document.getElementById("logoutBtn");

  if(!btn) return;

  btn.addEventListener("click", ()=>{
    google.accounts.id.disableAutoSelect();
    localStorage.removeItem("userToken");

    setTimeout(()=>{
      window.location.reload();
    },100);
  });
}
function updateAuthUI(){

  const token = localStorage.getItem("userToken");

  const loginView = document.getElementById("login-view");
  const userView  = document.getElementById("user-view");

  if(!loginView || !userView) return;

  if(token){
    loginView.style.display = "none";
    userView.style.display = "flex";
  }else{
    loginView.style.display = "block";
    userView.style.display = "none";
  }
}