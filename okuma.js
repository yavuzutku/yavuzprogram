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
        let savedText = saveText(text);
        currentTextId = savedText.id;
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
function addFromMiniPopup(word, meaning){

    addOrUpdateWord(word, meaning);

    document.getElementById("miniTranslatePopup").style.display = "none";
}


function openMiniTranslate(){

    let popup = document.getElementById("miniTranslatePopup");
    let btn = document.getElementById("floatingMeaningBtn");

    // BUTONU TAMAMEN KALDIR
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
    });
}
function learnMeaning(){

    const selectionObj = window.getSelection();
    let selection = selectionObj.toString().trim();

    if(selection){
        selectedWordGlobal = selection;
    }

    if(!selectedWordGlobal){
        alert("Önce kelime seç");
        return;
    }

    openMiniTranslate();

    // floating buton gizle
    floatingMeaning}




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
function addOrUpdateWord(word, meaning){

    let saved = JSON.parse(localStorage.getItem("words") || "[]");

    let normalizedWord = normalizeWord(word);
    let normalizedMeaning = normalizeWord(meaning);

    let existing = saved.find(w => normalizeWord(w.word) === normalizedWord);

    // Eğer kelime zaten varsa
    if(existing){

        let meanings = existing.meaning
            .split(" / ")
            .map(m => normalizeWord(m));

        // Aynı anlam zaten varsa
        if(meanings.includes(normalizedMeaning)){
            alert("Bu kelime ve anlam zaten kayıtlı");
            return;
        }

        // Yeni yan anlam ekle
        existing.meaning += " / " + formatWord(meaning);

        localStorage.setItem("words", JSON.stringify(saved));
        loadMenuWords();

        alert("Yeni anlam eklendi ✅");
        return;
    }

    // Kelime yoksa yeni oluştur
    saved.push({
        id: crypto.randomUUID(),
        word: formatWord(word),
        meaning: formatWord(meaning),
        difficulty: 2,
        date: new Date().toISOString()
    });

    localStorage.setItem("words", JSON.stringify(saved));
    loadMenuWords();
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
            saddOrUpdateWord(word, meaning);
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
function highlightSavedWords(){

    let saved = JSON.parse(localStorage.getItem("words") || "[]");
    let text = displayText.innerText;

    saved.forEach(wordObj => {

        let word = wordObj.word;

        let regex = new RegExp(`\\b${word}\\b`, "gi");

        text = text.replace(regex, 
            `<span class="highlight" data-word="${wordObj.word}">${word}</span>`
        );
    });

    displayText.innerHTML = text;
}
displayText.addEventListener("mouseup", function(e){

    const selectionObj = window.getSelection();

    if(!selectionObj || selectionObj.rangeCount === 0){
        floatingMeaningBtn.style.display = "none";
        return;
    }

    let selection = selectionObj.toString().trim();

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




function closePopup(){
    miniTranslatePopup.style.display = "none";

    // Butonu tekrar aktif hale getir
    floatingMeaningBtn.style.display = "block";
    floatingMeaningBtn.style.opacity = "1";

    selectedWordGlobal = "";
}


document.addEventListener("mousedown", function(e){

    // Eğer tıklanan yer displayText değilse
    if(!displayText.contains(e.target) &&
       !floatingMeaningBtn.contains(e.target) &&
       !miniTranslatePopup.contains(e.target)){

        floatingMeaningBtn.style.display = "none";
        miniTranslatePopup.style.display = "none";
        window.getSelection().removeAllRanges(); // seçimi temizle
        selectedWordGlobal = "";
    }
});


document.addEventListener("click", function(e){
    if(!miniPopup.contains(e.target) && !floatingBtn.contains(e.target)){
        miniPopup.style.display = "none";
    }
});
displayText.addEventListener("click", function(e){

    if(readingArea.style.display !== "block") return;

    let word = e.target.innerText.trim();

    // sadece tek kelime ise
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
// === SEÇİM ALGILAMA ===




function scrollToTop(){
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}
