import { Storage } from "./storage.js";

const userText = document.getElementById("userText");
const displayText = document.getElementById("displayText");
const readingArea = document.getElementById("readingArea");
let multiWordList = [];
let multiIndex = 0;
let fontSize = 20;
let timer;
let seconds = 0;
let selectedWordGlobal = "";

window.currentTextId = null;

// ✅ FIX: app.js bu sayfada yüklü değil, burada tanımla
function hideAll(){
    document.querySelectorAll(".card").forEach(card=>{
        card.style.display = "none";
    });
}

function loadMenuWords(){
    // okuma.html'de menuWordList yok, boş bırak
}

function formatWord(word) {
    if (!word) return "";
    return word
        .toLowerCase()
        .split(" / ")
        .map(w => w.trim())
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" / ");
}

function normalizeWord(w){
    return w
        .toLowerCase()
        .replace(/\s+/g," ")
        .replace(/[.,!?]/g,"")
        .trim();
}

function startReading(id=null){
    let text;
    if(id){
        let texts=getTexts();
        let found=texts.find(t=>t.id===id);
        if(!found) return;
        text=found.content;
        window.currentTextId=id;
    } else {
        text=userText.value;
        if(text.trim()==="") return alert("Metin girin");
        let savedText = saveText(text);
        window.currentTextId = savedText.id;
    }
    hideAll();
    readingArea.style.display="block";
    displayText.innerHTML = "";
    displayText.textContent = text;
    highlightSavedWords();
    startTimer();
}

function startTimer(){
    seconds=0;
    const readingTime = document.getElementById("readingTime");
    if(readingTime) readingTime.innerText = 0;
    clearInterval(timer);
    timer=setInterval(()=>{
        seconds++;
        const rt = document.getElementById("readingTime");
        if(rt) rt.innerText = seconds;
    },1000);
}

function increaseFont(){
    fontSize+=2;
    displayText.style.fontSize=fontSize+"px";
}

function decreaseFont(){
    fontSize-=2;
    displayText.style.fontSize=fontSize+"px";
}

function addFromMiniPopup(word, meaning){
    addOrUpdateWord(word, meaning);
    document.getElementById("miniTranslatePopup").style.display = "none";
}

window.startReading = startReading;
window.increaseFont = increaseFont;
window.decreaseFont = decreaseFont;
window.addFromMiniPopup = addFromMiniPopup;
window.learnMeaning = learnMeaning;
window.saveWord = saveWord;
window.closeMultiPanel = closeMultiPanel;
window.saveBulkWords = saveBulkWords;
window.showNextMultiWord = showNextMultiWord;
window.closePopup = closePopup;
window.closeTranslate = closeTranslate;
window.scrollToTop = scrollToTop;

function openMiniTranslate(){
    let popup = document.getElementById("miniTranslatePopup");
    let btn = document.getElementById("floatingMeaningBtn");

    btn.style.display = "none";
    popup.style.display = "block";
    popup.style.top = btn.style.top;
    popup.style.left = btn.style.left;
    popup.innerHTML = "⏳ Çevriliyor...";

    fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=tr&dt=t&q=${encodeURIComponent(selectedWordGlobal)}`)
    .then(res => res.json())
    .then(data => {
        let translated = data[0][0][0];
        popup.innerHTML = `
            <div style="font-weight:600; color:#3b82f6; margin-bottom:6px;">
                ${selectedWordGlobal}
            </div>
            <div style="margin-bottom:12px;">
                ${translated}
            </div>
            <button 
                style="padding:6px 10px;border:none;border-radius:8px;background:#22c55e;color:white;cursor:pointer;"
                onclick="addFromMiniPopup('${selectedWordGlobal.replace(/'/g,"\\'")}', '${translated.replace(/'/g,"\\'")}')">
                📌 Sözlüğe Ekle
            </button>
        `;
    })
    .catch(()=>{
        popup.innerHTML = "❌ Çeviri başarısız";
    });
}

function learnMeaning(){
    const selectionObj = window.getSelection();
    let selection = selectionObj.toString().trim();
    if(selection){ selectedWordGlobal = selection; }
    if(!selectedWordGlobal){ alert("Önce kelime seç"); return; }
    openMiniTranslate();
}

function saveWord(){
    let selection = window.getSelection().toString().trim();
    if(selection === ""){ alert("Kelime seçmediniz"); return; }
    if(selection.includes("\n")){
        let choice = confirm("Birden fazla kelime seçildi.\n\nTamam = Tek tek ekle\nİptal = Tek parça olarak kaydet");
        if(choice){
            let words = selection.split("\n").map(w => formatWord(w)).filter(w => w !== "");
            addWordsSequentially(words);
            return;
        }
    }
    addSingleWord(formatWord(selection));
}

function addOrUpdateWord(word, meaning){
    Storage.addOrUpdateWord(word, meaning);
    loadMenuWords();
}

function addSingleWord(word){
    let meaning = prompt(word + " kelimesinin Türkçesi:");
    if(meaning === null) return;
    addOrUpdateWord(word, meaning.trim());
}

function addWordsSequentially(wordArray){
    multiWordList = wordArray;
    multiIndex = 0;
    document.getElementById("multiWordPanel").style.display = "block";
    showNextMultiWord();
}

function showNextMultiWord(){
    if(multiIndex >= multiWordList.length){
        alert("Tüm kelimeler eklendi ✅");
        document.getElementById("multiWordPanel").style.display = "none";
        loadMenuWords();
        return;
    }
    let word = multiWordList[multiIndex];
    document.getElementById("multiWordCurrent").innerText =
        `${multiIndex+1}/${multiWordList.length} → ${word}`;
    document.getElementById("multiMeaningInput").value = "";
    document.getElementById("multiMeaningInput").focus();
}

function saveBulkWords(){
    let meaningsText = document.getElementById("bulkMeaningInput").value;
    let meanings = meaningsText.split("\n").map(m => m.trim()).filter(m => m !== "");
    if(meanings.length !== multiWordList.length){
        alert("Kelime sayısı ile anlam sayısı eşleşmiyor!");
        return;
    }
    for(let i = 0; i < multiWordList.length; i++){
        Storage.addOrUpdateWord(multiWordList[i], meanings[i]);
    }
    alert("Tüm kelimeler kaydedildi ✅");
    document.getElementById("bulkMeaningInput").value = "";
    closeMultiPanel();
    loadMenuWords();
}

function closeMultiPanel(){
    document.getElementById("multiWordPanel").style.display = "none";
}

function highlightSavedWords(){
    displayText.innerHTML = displayText.textContent;
    let saved = Storage.getWords();
    const walker = document.createTreeWalker(displayText, NodeFilter.SHOW_TEXT, null, false);
    let nodes = [];
    while(walker.nextNode()){ nodes.push(walker.currentNode); }
    nodes.forEach(node => {
        let originalText = node.nodeValue;
        let newHTML = originalText;
        saved.forEach(wordObj => {
            let escaped = wordObj.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let regex = new RegExp(`(^|\\s|[.,!?])(${escaped})(?=$|\\s|[.,!?])`, "gi");
            newHTML = newHTML.replace(regex, `$1<span class="highlight">$2</span>`);
        });
        if(newHTML !== originalText){
            let span = document.createElement("span");
            span.innerHTML = newHTML;
            node.replaceWith(span);
        }
    });
}

displayText.addEventListener("mouseup", function(e){
    const floatingMeaningBtn = document.getElementById("floatingMeaningBtn");
    if(!floatingMeaningBtn) return;
    const selectionObj = window.getSelection();
    if(!selectionObj || selectionObj.rangeCount === 0){
        floatingMeaningBtn.style.display = "none"; return;
    }
    let selection = selectionObj.toString().trim();
    selection = selection.replace(/^[^\p{L}]+|[^\p{L}]+$/gu,"");
    if(selection.length === 0){ floatingMeaningBtn.style.display = "none"; return; }
    selectedWordGlobal = selection;
    const range = selectionObj.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if(!rect || rect.width === 0){ floatingMeaningBtn.style.display = "none"; return; }
    floatingMeaningBtn.style.display = "block";
    floatingMeaningBtn.style.top = (window.scrollY + rect.bottom + 8) + "px";
    floatingMeaningBtn.style.left = (window.scrollX + rect.left) + "px";
});

function closePopup(){
    const miniPopup = document.getElementById("miniTranslatePopup");
    const floatingMeaningBtn = document.getElementById("floatingMeaningBtn");
    if(miniPopup) miniPopup.style.display = "none";
    if(floatingMeaningBtn){
        floatingMeaningBtn.style.display = "block";
        floatingMeaningBtn.style.opacity = "1";
    }
    selectedWordGlobal = "";
}

document.addEventListener("mousedown", function(e){
    const displayText = document.getElementById("displayText");
    const floatingMeaningBtn = document.getElementById("floatingMeaningBtn");
    const miniTranslatePopup = document.getElementById("miniTranslatePopup");
    if(!displayText) return;
    const clickedOutsideDisplay = !displayText.contains(e.target);
    const clickedOutsideButton = !floatingMeaningBtn || !floatingMeaningBtn.contains(e.target);
    const clickedOutsidePopup = !miniTranslatePopup || !miniTranslatePopup.contains(e.target);
    if(clickedOutsideDisplay && clickedOutsideButton && clickedOutsidePopup){
        if(floatingMeaningBtn) floatingMeaningBtn.style.display = "none";
        if(miniTranslatePopup) miniTranslatePopup.style.display = "none";
        if(window.getSelection) window.getSelection().removeAllRanges();
        selectedWordGlobal = "";
    }
});

displayText.addEventListener("click", function(e){
    const floatingMeaningBtn = document.getElementById("floatingMeaningBtn");
    if(!floatingMeaningBtn) return;
    if(readingArea.style.display !== "block") return;
    let word = e.target.innerText.trim();
    if(word && word.split(/\s+/).length === 1){
        selectedWordGlobal = word;
        floatingMeaningBtn.style.display = "block";
        const rect = e.target.getBoundingClientRect();
        floatingMeaningBtn.style.top = (window.scrollY + rect.bottom + 8) + "px";
        floatingMeaningBtn.style.left = (window.scrollX + rect.left) + "px";
    }
});

function closeTranslate(){
    document.getElementById("translatePopup").style.display = "none";
}

function scrollToTop(){
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function saveText(content){
    return Storage.saveText(content);
}

function getTexts(){
    return Storage.getTexts();
}