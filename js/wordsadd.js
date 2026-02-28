

function showBulkWordPage(){
    document.querySelectorAll('.card').forEach(c => c.style.display = "none");
    document.getElementById("bulkWordArea").style.display = "block";
}

function prepareMeaningArea(){
    let germanText = document.getElementById("bulkGermanWords").value;

    // boş satırları sil
    let germanList = germanText
        .split("\n")
        .map(w => w.trim())
        .filter(w => w !== "");

    if(germanList.length === 0){
        alert("Kelime yok!");
        return;
    }

    // temizlenmiş listeyi geri yaz
    document.getElementById("bulkGermanWords").value = germanList.join("\n");

    document.getElementById("meaningSection").style.display = "block";
}

function saveBulkWordList(){

    let germanList = document.getElementById("bulkGermanWords").value
        .split("\n")
        .map(w => w.trim())
        .filter(w => w !== "");

    let turkishList = document.getElementById("bulkTurkishWords").value
        .split("\n")
        .map(w => w.trim())
        .filter(w => w !== "");

    if(germanList.length !== turkishList.length){
        alert("Kelime ve anlam sayısı eşit değil!");
        return;
    }

    let savedWords = JSON.parse(localStorage.getItem("words") || "[]");

    let addedCount = 0;
    let updatedCount = 0;

    for(let i = 0; i < germanList.length; i++){

        let word = germanList[i].toLowerCase();
        let meaning = turkishList[i].trim();

        // İlk harfi büyüt
        meaning = meaning.charAt(0).toUpperCase() + meaning.slice(1);

        let existingWord = savedWords.find(w => w.word === word);

        if(existingWord){

            // Mevcut anlamları ayır
            let meaningsArray = existingWord.meaning
                .split(" / ")
                .map(m => m.trim());

            // Aynı anlam zaten varsa ekleme
            if(!meaningsArray.includes(meaning)){
                existingWord.meaning += " / " + meaning;
                updatedCount++;
            }

        } else {

            savedWords.push({
                id: Date.now().toString() + i,
                word: word,
                meaning: meaning,
                difficulty: 1,
                wrong: 0,
                date: new Date().toISOString()
            });

            addedCount++;
        }
    }

    localStorage.setItem("words", JSON.stringify(savedWords));

    alert(
        "✅ " + addedCount + " yeni kelime eklendi!\n" +
        "🔄 " + updatedCount + " kelimeye yeni anlam eklendi!"
    );

    document.getElementById("bulkGermanWords").value = "";
    document.getElementById("bulkTurkishWords").value = "";
    document.getElementById("meaningSection").style.display = "none";

    goMenu();
}
