
let quizWords = [];
let currentQuestionIndex = 0;
let totalQuestions = 0;
let results = [];

function startQuizSetup(){
    hideAll();
    
    quizArea.style.display="block";
    quizSetup.style.display="block";
    quizQuestionArea.style.display="none";
    quizResult.style.display="none";
}

function startQuiz(){
    let saved = JSON.parse(localStorage.getItem("words") || "[]");

    if(saved.length === 0){
        alert("Kelime defteri boş!");
        return;
    }

    totalQuestions = parseInt(questionCount.value);
    if(isNaN(totalQuestions) || totalQuestions <= 0){
        alert("Geçerli bir sayı girin");
        return;
    }

    let weightedList = [];

    saved.forEach(word=>{
        let weight = word.difficulty || 2;

        // zor olanları listeye daha fazla ekle
        for(let i=0; i<weight; i++){
            weightedList.push(word);
        }
    });

    for (let i = weightedList.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [weightedList[i], weightedList[j]] = [weightedList[j], weightedList[i]];
    }

    totalQuestions = Math.min(totalQuestions, weightedList.length);
    quizWords = weightedList.slice(0, totalQuestions);


    currentQuestionIndex = 0;
    results = [];

    quizSetup.style.display="none";
    quizQuestionArea.style.display="block";

    showQuestion();
}

function showQuestion(){
    let word = quizWords[currentQuestionIndex];

    quizWord.innerText = word.word;
    quizAnswer.value = "";
    quizAnswer.focus();

    // ilerleme göstergesi
    document.querySelector(".progressText").innerText = `Soru ${currentQuestionIndex+1}/${totalQuestions}`;
    let progressPercent = ((currentQuestionIndex+1)/totalQuestions) * 100;
    document.getElementById("quizProgress").style.width = progressPercent + "%";

    // ipucu gizle
    document.getElementById("quizHint").style.display = "none";
}

function submitAnswer(){
    let userAnswer = quizAnswer.value.trim();
    let correctMeaning = quizWords[currentQuestionIndex].meaning;

    let user = normalizeWord(userAnswer);

    let meanings = correctMeaning
        .toLowerCase()
        .split("/")
        .map(m => m.trim());

    let isCorrect = meanings.includes(user);

    if(!isCorrect){
        addWrongWord({
            word: quizWords[currentQuestionIndex].word,
            meaning: quizWords[currentQuestionIndex].meaning
        });

        // yanlış kelimeleri tekrar quizWords'a ekle (opsiyonel)
}
    if(isCorrect){
        let wrongList = getWrongWords();
        wrongList = wrongList.filter(w => 
            w.word !== quizWords[currentQuestionIndex].word
        );
        saveWrongWords(wrongList);
    }
    
    if(isCorrect){
        correctAnswer();
    } else {
        wrongAnswer();
    }

    results.push({
        word: quizWords[currentQuestionIndex].word,
        correct: correctMeaning,
        user: userAnswer,
        status: isCorrect
    });

    currentQuestionIndex++;

    if(currentQuestionIndex >= totalQuestions){
        showResults();
    } else {
        showQuestion();
    }
}

function showResults(){
    quizQuestionArea.style.display="none";
    quizResult.style.display="block";

    let correctCount = results.filter(r=>r.status).length;
    let wrongCount = results.length - correctCount;

    let html = `
        <h2>📊 Sonuç</h2>
        <p><b>Toplam Soru:</b> ${results.length}</p>
        <p><b>Doğru:</b> ${correctCount}</p>
        <p><b>Yanlış:</b> ${wrongCount}</p>
        <hr>
    `;

    results.forEach(r=>{
        html += `
            <div style="margin-bottom:15px;padding:10px;border-radius:12px;
                        background:${r.status?'#22c55e33':'#ef444433'}">
                <b>${r.word}</b><br>
                Senin cevabın: ${r.user || "(boş)"}<br>
                Doğru cevap: ${r.correct}<br>
                ${r.status ? "✅ Doğru" : "❌ Yanlış"}
                <br><br>
                <button onclick="setDifficulty('${r.word}',1)">Kolay</button>
                <button onclick="setDifficulty('${r.word}',2)">Orta</button>
                <button onclick="setDifficulty('${r.word}',3)">Zor</button>
            </div>
        `;
    });

    html += `<br><button class="secondary" onclick="goMenu()">Ana Menü</button>`;

    quizResult.innerHTML = html;
}


function setDifficulty(word, level){

    let saved = JSON.parse(localStorage.getItem("words") || "[]");

    let index = saved.findIndex(w => w.word === word);

    if(index === -1) return;

    saved[index].difficulty = level;

    localStorage.setItem("words", JSON.stringify(saved));

    alert(word + " güncellendi → " + 
        (level === 1 ? "Kolay 🟢" : 
         level === 2 ? "Orta 🟡" : "Zor 🔴"));
}
// ===== CUSTOM QUIZ SYSTEM =====

function showCustomQuiz(){

    let saved = JSON.parse(localStorage.getItem("words") || "[]");

    if(saved.length === 0){
        alert("Kelime defteri boş!");
        return;
    }

    quizSetup.style.display = "none";
    customQuizArea.style.display = "block";

    customWordList.innerHTML = "";

    saved.forEach(word=>{
        let div = document.createElement("div");
        div.style.marginBottom = "8px";

        div.innerHTML = `
            <label style="cursor:pointer;">
                <input type="checkbox" value="${word.id}">
                <b>${word.word}</b> → ${word.meaning}
            </label>
        `;

        customWordList.appendChild(div);
        customWordCount.innerText = saved.length;
    });
}
function startCustomQuiz(){

    let saved = JSON.parse(localStorage.getItem("words") || "[]");

    let selectedCheckboxes = customWordList.querySelectorAll("input:checked");

    if(selectedCheckboxes.length === 0){
        alert("En az 1 kelime seçmelisiniz");
        return;
    }

    let selectedIds = Array.from(selectedCheckboxes)
        .map(cb => cb.value);

    quizWords = saved.filter(word => selectedIds.includes(word.id));

    totalQuestions = quizWords.length;
    currentQuestionIndex = 0;
    results = [];

    customQuizArea.style.display = "none";
    quizQuestionArea.style.display = "block";

    showQuestion();
}
function filterCustomWords(){

    let searchValue = customSearchInput.value.toLowerCase();
    let items = customWordList.querySelectorAll("div");

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

    customWordCount.innerText = visibleCount;
}
function showHint(){
    let word = quizWords[currentQuestionIndex];
    let hintEl = document.getElementById("quizHint");

    if(word.hint) {
        hintEl.innerText = "İpucu: " + word.hint;
    } else {
        hintEl.innerText = "İpucu: Kelimenin baş harfi → " + word.word.charAt(0);
    }
    hintEl.style.display = "block";
}
function skipQuestion(){
    results.push({
        word: quizWords[currentQuestionIndex].word,
        correct: quizWords[currentQuestionIndex].meaning,
        user: "(atlandı)",
        status: false
    });

    currentQuestionIndex++;
    if(currentQuestionIndex >= quizWords.length){
        showResults();
    } else {
        showQuestion();
    }
}
