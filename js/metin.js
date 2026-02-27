
let multiWordList = [];
let multiIndex = 0;
let fontSize = 20;
let timer;
let seconds = 0;
let selectedWordGlobal = "";


function startReading(id=null){

    let text;

    if(id){
        let texts=getTexts();
        let found=texts.find(t=>t.id===id);
        if(!found) return;
        text=found.content;
        currentTextId=id;
    } else {
        text=userText.value;
        if(text.trim()==="") return alert("Metin girin");
        saveText(text);
        currentTextId=Date.now();
    }

    hideAll();
    readingArea.style.display="block";
    displayText.innerText=text;
    highlightSavedWords();
    startTimer();

}
function startTimer(){
    seconds=0;
    readingTime.innerText=0;
    clearInterval(timer);
    timer=setInterval(()=>{
        seconds++;
        readingTime.innerText=seconds;
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
function learnMeaning(){

    let selection = window.getSelection().toString().trim();

    if(!selection){
        alert("Önce kelime seç");
        return;
    }

    selectedWordGlobal = selection;
    openMiniTranslate();
}
function saveWord(){

    let selection = window.getSelection().toString().trim();

    if(selection === ""){
        alert("Kelime seçmediniz");
        return;
    }

    // Çoklu seçim kontrolü (satır satır mı?)
    if(selection.includes("\n")){

        let choice = confirm(
            "Birden fazla kelime seçildi.\n\nTamam = Tek tek ekle\nİptal = Tek parça olarak kaydet"
        );

        if(choice){
            // TEK TEK EKLEME
            let words = selection
                .split("\n")
                .map(w => formatWord(w))
                .filter(w => w !== "");

            addWordsSequentially(words);
            return;
        }

    }

    // Normal tek kelime ekleme
    addSingleWord(formatWord(selection));
}

function normalizeWord(w){
    return w
        .toLowerCase()
        .replace(/\s+/g," ")
        .replace(/[.,!?]/g,"")
        .trim();
}
function formatWord(word) {
    if (!word) return "";

    return word
        .toLowerCase()
        .split("/")
        .map(w => w.trim())
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" / ");
}
function addSingleWord(word){

    let meaning = prompt(word + " kelimesinin Türkçesi:");

    if(meaning === null) return;

    let saved = JSON.parse(localStorage.getItem("words") || "[]");

    if(saved.find(w => normalizeWord(w.word) === normalizeWord(word))){
        alert(word + " zaten kayıtlı");
        return;
    }

    saved.push({
        id: crypto.randomUUID(),
        word: word,
        meaning: formatWord(meaning.trim()),
        difficulty: 2, // 1=kolay 2=orta 3=zor
        date: new Date().toISOString()
    });

    localStorage.setItem("words", JSON.stringify(saved));
    loadMenuWords();
}

function addWordsSequentially(wordArray){

    multiWordList = wordArray;
    multiIndex = 0;

    document.getElementById("multiWordPanel").style.display = "block";

    showNextMultiWord();
}

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

function saveMultiWord(){

    let word = multiWordList[multiIndex];
    let meaning = document.getElementById("multiMeaningInput").value.trim();

    if(meaning === ""){
        alert("Anlam boş olamaz");
        return;
    }

    let saved = JSON.parse(localStorage.getItem("words") || "[]");

    if(!saved.find(w => normalizeWord(w.word) === normalizeWord(word))){
        saved.push({
            id: crypto.randomUUID(),
            word: word,
            meaning: formatWord(meaning),
            difficulty: 2,
            date: new Date().toISOString()
        });

        localStorage.setItem("words", JSON.stringify(saved));
    }

    multiIndex++;
    showNextMultiWord();
}
function saveBulkWords(){

    let meaningsText = document.getElementById("bulkMeaningInput").value;

    let meanings = meaningsText
        .split("\n")
        .map(m => m.trim())
        .filter(m => m !== "");

    if(meanings.length !== multiWordList.length){
        alert("Kelime sayısı ile anlam sayısı eşleşmiyor!");
        return;
    }

    let saved = JSON.parse(localStorage.getItem("words") || "[]");

    for(let i = 0; i < multiWordList.length; i++){

        let word = multiWordList[i];
        let meaning = meanings[i];

        if(!saved.find(w => w.word === word)){
            saved.push({
                id: crypto.randomUUID(),
                word: word,
                meaning: meaning,
                difficulty: 2,
                date: new Date().toISOString()
            });
        }
    }

    localStorage.setItem("words", JSON.stringify(saved));

    alert("Tüm kelimeler kaydedildi ✅");

    document.getElementById("bulkMeaningInput").value = "";
    closeMultiPanel();
    loadMenuWords();
}
function closeMultiPanel(){
    document.getElementById("multiWordPanel").style.display = "none";
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
function openMiniTranslate(){

    let popup = document.getElementById("miniTranslatePopup");
    let btn = document.getElementById("floatingMeaningBtn");

    // BUTONU TAMAMEN KALDIR
    btn.style.display = "none";
    btn.style.opacity = "0";

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
    });
}
function addFromMiniPopup(word, meaning){

    let saved = JSON.parse(localStorage.getItem("words") || "[]");

    if(saved.find(w => normalizeWord(w.word) === normalizeWord(word))){
        alert("Bu kelime zaten kayıtlı");
        return;
    }

    saved.push({
        id: crypto.randomUUID(),
        word: formatWord(word),
        meaning: formatWord(meaning),

        difficulty: 2,
        date: new Date().toISOString()
    });

    localStorage.setItem("words", JSON.stringify(saved));

    alert("Kelime eklendi ✅");

    document.getElementById("miniTranslatePopup").style.display = "none";
}
function closeTranslate(){
    document.getElementById("translatePopup").style.display = "none";
}
// === SEÇİM ALGILAMA ===
document.addEventListener("mouseup", function(){

    if(readingArea.style.display !== "block") return;

    const selectionObj = window.getSelection();

    if(!selectionObj || selectionObj.rangeCount === 0){
        floatingMeaningBtn.style.display = "none";
        return;
    }

    let selection = selectionObj.toString().trim();

    // noktalama temizle
    selection = selection.replace(/^[^\p{L}]+|[^\p{L}]+$/gu,"");

    if(selection.length === 0){
        floatingMeaningBtn.style.display = "none";
        return;
    }

    selectedWordGlobal = selection;

    const range = selectionObj.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if(!rect || rect.width === 0){
        floatingMeaningBtn.style.display = "none";
        return;
    }

    floatingMeaningBtn.style.display = "block";
    floatingMeaningBtn.style.top = (window.scrollY + rect.bottom + 8) + "px";
    floatingMeaningBtn.style.left = (window.scrollX + rect.left) + "px";
});
document.addEventListener("mousedown", function(e){

    if(!miniTranslatePopup.contains(e.target) &&
       !floatingMeaningBtn.contains(e.target)){
        miniTranslatePopup.style.display = "none";
    }

});
document.addEventListener("click", function(e){
    if(!miniPopup.contains(e.target) && !floatingBtn.contains(e.target)){
        miniPopup.style.display = "none";
    }
});
displayText.addEventListener("scroll", function(){
    if(e.target.classList.contains("highlight")){
        let word = e.target.innerText;
        selectedWordGlobal = word;
        openMiniTranslate();
    }
    let scrollTop = this.scrollTop;
    let scrollHeight = this.scrollHeight - this.clientHeight;

    let percent = (scrollTop / scrollHeight) * 100;

    progressBar.style.width = percent + "%";

    if(percent > 95){
        progressBar.style.background = "#22c55e";
    } else {
        progressBar.style.background = "#3b82f6";
    }
});
function scrollToTop(){
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}
function highlightSavedWords(){

    let saved = JSON.parse(localStorage.getItem("words") || "[]");
    let text = displayText.innerText;

    saved.forEach(wordObj => {

        let word = wordObj.word;

        let regex = new RegExp(`\\b${word}\\b`, "gi");

        text = text.replace(regex, 
            `<span class="highlight">${word}</span>`
        );
    });

    displayText.innerHTML = text;
}
