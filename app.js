const inputArea = document.getElementById("inputArea");
const readingArea = document.getElementById("readingArea");
const historyArea = document.getElementById("historyArea");
const menuArea = document.getElementById("menuArea");
const menuWordsArea = document.getElementById("menuWordsArea");
const quizArea = document.getElementById("quizArea");



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
    inputArea.style.display="none";
    readingArea.style.display="none";
    historyArea.style.display="none";
    menuArea.style.display="none";
    menuWordsArea.style.display="none";
    quizArea.style.display="none";
}

function showInput(){
    hideAll();
    inputArea.style.display="block";
    currentTextId=null;
}



function goMenu(){
    hideAll();
    menuArea.style.display="block";
    menuWordsArea.style.display="block";

    // her zaman tarihe göre aç
    loadMenuWords("date");

    clearInterval(timer);
    updateUI();
}




document.addEventListener("keydown",e=>{

    // Anlam için T
    if((e.key==="t"||e.key==="T") && readingArea.style.display==="block"){
        learnMeaning();
    }

    // Kaydet için S
    if((e.key==="s"||e.key==="S") && readingArea.style.display==="block"){
        saveWord();
    }

});











goMenu();
function loadMenuWords(mode = "date"){
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
        <span style="font-size:16px">${formatWord(item.meaning)}</span>

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

    if(window.scrollY > 250){
        btn.classList.add("show");
    } else {
        btn.classList.remove("show");
    }
});

