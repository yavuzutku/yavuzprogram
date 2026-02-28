function addOrUpdateWord(word, meaning){

    let saved = JSON.parse(localStorage.getItem("words") || "[]");

    let normalizedWord = normalizeWord(word);
    meaning = meaning.trim();

    if(meaning === "") return;

    // İlk harfi büyüt
    meaning = meaning.charAt(0).toUpperCase() + meaning.slice(1);

    let existing = saved.find(w => normalizeWord(w.word) === normalizedWord);

    if(existing){

        let meaningsArray = existing.meaning
            .split(" / ")
            .map(m => m.trim());

        if(!meaningsArray.includes(meaning)){
            existing.meaning += " / " + meaning;
            localStorage.setItem("words", JSON.stringify(saved));
            alert("Yeni anlam eklendi 🔄");
        } else {
            alert("Bu kelime ve anlam zaten kayıtlı");
        }

        return;
    }

    // Kelime yoksa yeni ekle
    saved.push({
        id: crypto.randomUUID(),
        word: formatWord(word),
        meaning: meaning,
        difficulty: 2,
        date: new Date().toISOString()
    });

    localStorage.setItem("words", JSON.stringify(saved));
    alert("Kelime eklendi ✅");
}
