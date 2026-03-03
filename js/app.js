/*
=========================================
APP.JS - ANA UYGULAMA KONTROL DOSYASI
=========================================

Bu dosya uygulamanın:

1) Sayfa geçişlerini (menu, reading, input, quiz, history)
2) XP & Level sistemini
3) Yanlış kelimeler sistemini
4) Kelime defteri listeleme ve filtreleme sistemini
5) Global klavye kısayollarını
6) Genel UI güncellemelerini

yönetir.

Diğer modüller:
- quiz.js   → Quiz sistemi
- metin.js  → Okuma ve kelime seçme sistemi
- gecmis.js → Metin geçmişi sistemi

Bu dosya uygulamanın ana kontrol merkezidir.
*/
// app.js en başına ekle
let timer = null;
const menuWordList = document.getElementById("menuWordList") || null;
const menuWordCount = document.getElementById("menuWordCount") || null;
const menuSearchInput = document.getElementById("menuSearchInput") || null;
const loginArea = document.getElementById("loginArea") || null;
const mainArea = document.getElementById("mainArea") || null;
const inputArea = document.getElementById("inputArea") || null;
const readingArea = document.getElementById("readingArea") || null;
const historyArea = document.getElementById("historyArea") || null;
const menuArea = document.getElementById("menuArea") || null;
const menuWordsArea = document.getElementById("menuWordsArea") || null;
const quizArea = document.getElementById("quizArea") || null;
const bulkWordArea = document.getElementById("bulkWordArea") || null;

const firebaseConfig = {
  apiKey: "AIzaSyCUkBPHSo6O1271n3isD8-hAAgqsyyl5YA",
  authDomain: "yavuzprogram-6c1db.firebaseapp.com",
  projectId: "yavuzprogram-6c1db",
  storageBucket: "yavuzprogram-6c1db.firebasestorage.app",
  messagingSenderId: "424372113744",
  appId: "1:424372113744:web:2a8652c974bcbfba81dc55"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

function loginWithGoogle(){
    console.log("loginWithGoogle çağrıldı");
    const provider = new firebase.auth.GoogleAuthProvider();

    auth.signInWithPopup(provider)
        .then(result => {
            const user = result.user;
            console.log("Giriş başarılı:", user.email, user.displayName);
            showUser(user);
        })
        .catch(error => {
            console.error("Giriş hatası:", error);
        });
}
function showUser(user){
    if(loginArea) loginArea.style.display = "none";
    if(mainArea) mainArea.style.display = "block";

    const userRef = db.collection("users").doc(user.email);

    userRef.get().then(doc=>{
        if(!doc.exists){
            userRef.set({
                xp: 0,
                level: 1,
                combo: 0,
                words: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    });

    goMenu(); // Menü sadece login sonrası açılır
}
function logout(){
    auth.signOut().then(()=>{
        if(mainArea) mainArea.style.display = "none";
        if(loginArea) loginArea.style.display = "block";
    });
}
// ===== XP SYSTEM =====
let playerData = JSON.parse(localStorage.getItem("playerData") || "null") || {
    xp: 0,
    level: 1,
    combo: 0
};
// ===== WRONG WORDS SYSTEM =====
function getWrongWords(){
    return JSON.parse(localStorage.getItem("wrongWords") || "[]");
}

function saveWrongWords(list){
    localStorage.setItem("wrongWords", JSON.stringify(list));
}

function addWrongWord(wordObj){
    let wrongList = getWrongWords();

    // aynı kelime tekrar eklenmesin
    if(!wrongList.find(w => w.word === wordObj.word)){
        wrongList.push(wordObj);
        saveWrongWords(wrongList);
    }
}

function savePlayer(){
    localStorage.setItem("playerData", JSON.stringify(playerData));
}

function hideAll(){
    document.querySelectorAll(".card").forEach(card=>{
        card.style.display = "none";
    });
}

function showInput(){
    hideAll();
    inputArea.style.display="block";
    currentTextId=null;
}



function goMenu(){
    if (timer !== null) {
        clearInterval(timer);
        timer = null;
    }
    if(!auth.currentUser){
        alert("Önce giriş yapmalısınız!");
        hideAll();
        if(document.querySelector("button[onclick='loginWithGoogle()']"))
            document.querySelector("button[onclick='loginWithGoogle()']").style.display = "block";
        return;
    }

    hideAll(); // tüm kartları gizle
    if(menuArea) menuArea.style.display = "block";
    if(menuWordsArea) menuWordsArea.style.display = "block";

    loadMenuWords("date");

    if (typeof timer !== "undefined") {
        clearInterval(timer);
    }
    updateUI();
}

document.addEventListener("keydown",e=>{

    // Anlam için T
    if(readingArea && (e.key==="t"||e.key==="T")){
        learnMeaning();
    }

    // Kaydet için S
    if(readingArea && (e.key==="s"||e.key==="S")){
        saveWord();
    }

});




function loadMenuWords(mode = "date"){
    if(!menuWordList) return;
    let saved = JSON.parse(localStorage.getItem("words") || "[]");
    // eski kayıtlar için tarih oluştur
    saved.forEach(w=>{
        if(!w.date){
            w.date = new Date().toISOString();
        }
    });

    localStorage.setItem("words", JSON.stringify(saved));

    let wrongList = JSON.parse(localStorage.getItem("wrongWords") || "[]");

    let sorted = [...saved];

    // SIRALAMA
    if(mode === "date"){
        sorted = [...saved].sort((a,b)=> new Date(b.date) - new Date(a.date));
    }
    else if(mode === "alpha"){
        sorted = [...saved].sort((a,b)=> a.word.localeCompare(b.word));
    }
    else if(mode === "difficulty"){
        sorted = [...saved].sort((a,b)=> (b.difficulty || 2) - (a.difficulty || 2));
    }
    else if(mode === "wrong"){
        let wrongSet = new Set(wrongList.map(w => w.word));
        sorted = saved.filter(word => wrongSet.has(word.word));
    }

    menuWordList.innerHTML = "";

    if(mode === "date"){

    let dateGroups = {};

    sorted.forEach(item=>{
        let day = new Date(item.date).toLocaleDateString();

        if(!dateGroups[day]) dateGroups[day] = [];
        dateGroups[day].push(item);
    });

    menuWordList.innerHTML = "";

    Object.keys(dateGroups).forEach(day=>{

        let wrapper = document.createElement("div");
        wrapper.style.marginBottom = "25px";

        // GÜN BAŞLIK
        let header = document.createElement("div");
        header.style.fontWeight = "600";
        header.style.fontSize = "18px";
        header.style.cursor = "pointer";
        header.style.padding = "12px 18px";
        header.style.borderRadius = "14px";
        header.style.background = "rgba(255,255,255,0.08)";
        header.style.marginBottom = "10px";
        header.innerText = "📅 " + day;

        // KELİMELER
        let container = document.createElement("div");
        container.style.display = "none";
    
        container.style.gridTemplateColumns = "repeat(auto-fill, minmax(220px, 1fr))";
        container.style.gap = "12px";
        container.style.gap = "12px";

        dateGroups[day].forEach(word=>{
            container.appendChild(createWordCard(word));
        });

        header.onclick = ()=>{
            if(container.style.display === "none"){
                container.style.display = "grid";
            } else {
                container.style.display = "none";
            }
        };

        wrapper.appendChild(header);
        wrapper.appendChild(container);

        menuWordList.appendChild(wrapper);
    });

    menuWordCount.innerText = sorted.length;
    return;
}

    // ===== DİĞER MODLAR =====
    sorted.forEach(item=>{
        menuWordList.appendChild(createWordCard(item));
    });

    menuWordCount.innerText = sorted.length;
}
function createWordCard(item){

    let div = document.createElement("div");
    div.style.padding = "8px 10px";
    div.style.marginBottom = "6px";
    div.style.background = "rgba(255,255,255,0.05)";
    div.style.borderRadius = "8px";

    div.innerHTML = `
        <b style="color:#3b82f6; font-size:18px">${item.word}</b>
        <br>
        <span style="font-size:16px">${item.meaning.split("/").join("<br>")}</span>

        <br><br>
        <button class="secondary" onclick="editWord('${item.id}')">✏️ Düzenle</button>
        <button class="danger" onclick="deleteWord('${item.id}')">❌ Sil</button>
    `;

    return div;
}


function updateUI(){
    playerLevel.innerText = playerData.level;
    playerXP.innerText = playerData.xp;
    playerCombo.innerText = playerData.combo;

    let requiredXP = playerData.level * 100;
    let percent = (playerData.xp / requiredXP) * 100;
    xpBar.style.width = percent + "%";
}

function addXP(amount){
    playerData.xp += amount;

    let requiredXP = playerData.level * 100;

    if(playerData.xp >= requiredXP){
        playerData.xp -= requiredXP;
        playerData.level++;
        alert("🎉 LEVEL UP! Yeni Seviye: " + playerData.level);
    }

    savePlayer();
    updateUI();
}

function wrongAnswer(){
    playerData.combo = 0;
    playerData.xp -= 5;
    if(playerData.xp < 0) playerData.xp = 0;
    savePlayer();
    updateUI();
}

function correctAnswer(){
    playerData.combo++;

    let baseXP = 15;
    let bonus = playerData.combo >= 2 ? 5 : 0;
    
    addXP(baseXP + bonus);
}


// === MINI ÇEVİRİ AÇ ===




// === MINI POPUP'TAN EKLE ===



// === BOŞ ALANA TIKLAYINCA KAPAT ===
const miniPopup = document.getElementById("miniTranslatePopup");
const floatingBtn = document.getElementById("floatingMeaningBtn");



window.addEventListener("scroll", function(){

    let btn = document.getElementById("scrollTopBtn");
    if(!btn) return;

    if(window.scrollY > 250){
        btn.classList.add("show");
    } else {
        btn.classList.remove("show");
    }
});
function loadSavedWords(){
    let saved = JSON.parse(localStorage.getItem("words") || "[]");

    savedWords.innerHTML = "";

    saved.forEach(item => {
        let div = document.createElement("div");
        div.style.marginBottom = "8px";
        div.innerHTML = `
            <b>${item.word}</b> → ${item.meaning}
        `;
        savedWords.appendChild(div);
    });
}
function editWord(id){
    let saved = JSON.parse(localStorage.getItem("words") || "[]");

    let index = saved.findIndex(item => item.id === id);
    if(index === -1) return;

    let item = saved[index];

    // Kullanıcı iptal ederse null döner
    let newWord = prompt("Almanca kelimeyi düzenle:", item.word);
    if(newWord === null) return;

    let newMeaning = prompt("Türkçe anlamı düzenle:", item.meaning);
    if(newMeaning === null) return;

    // Trim ve güncelle
    saved[index].word = formatWord(newWord.trim());
    saved[index].meaning = formatWord(newMeaning.trim());


    localStorage.setItem("words", JSON.stringify(saved));
    loadMenuWords();

    alert("Kelime güncellendi ✅");
}
function deleteWord(id){
    let saved = JSON.parse(localStorage.getItem("words") || "[]");

    if(!confirm("Bu kelime silinsin mi?")) return;

    let updated = saved.filter(item => item.id !== id);

    localStorage.setItem("words", JSON.stringify(updated));
    loadMenuWords();
}

function filterMenuWords(){

    let searchValue = menuSearchInput.value.toLowerCase();
    let items = menuWordList.querySelectorAll("div");

    let visibleCount = 0;

    items.forEach(div=>{
        let text = div.innerText.toLowerCase();

        if(text.includes(searchValue)){
            div.style.display = "block";
            visibleCount++;
        } else {
            div.style.display = "none";
        }
    });

    menuWordCount.innerText = visibleCount;
}
// Sayfa yüklendiğinde auth durumunu kontrol et
const currentPage = window.location.pathname.split("/").pop();

if(currentPage === "index.html" || currentPage === ""){
    // Sayfa yüklendiğinde auth durumunu kontrol et ama sadece loginArea göster/gizle
    auth.onAuthStateChanged(user => {
        console.log("onAuthStateChanged çalıştı", user);

        if(user){
            console.log("Kullanıcı var:", user.displayName, user.email);

            // Sadece index.html ise menu aç
            const currentPage = window.location.pathname.split("/").pop();
            console.log("currentPage:", currentPage);

            if(currentPage === "index.html" || currentPage === ""){
                if(loginArea) loginArea.style.display = "none";
                if(mainArea) mainArea.style.display = "block";
                goMenu();
            }
        } else {
            console.log("Kullanıcı yok, login gösteriliyor");
            if(mainArea) mainArea.style.display = "none";
            if(loginArea) loginArea.style.display = "block";
        }
    });
}