let verbData = [];

// Aynı klasördeki fiil.json dosyasını çekiyoruz
fetch('./fiil.json')
    .then(response => {
        if (!response.ok) throw new Error("JSON yüklenemedi!");
        return response.json();
    })
    .then(data => {
        verbData = data;
        console.log("8000 fiil başarıyla yüklendi.");
    })
    .catch(err => console.error("Hata oluştu:", err));

const searchInput = document.getElementById('searchInput');
const verbContent = document.getElementById('verbContent');

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    // Performans için en az 2 harf girilmesini bekliyoruz
    if (query.length < 2) {
        verbContent.classList.add('hidden');
        return;
    }

    // JSON'daki 'Infinitive' sütununa göre arama yapıyoruz
    const verb = verbData.find(v => v.Infinitive.toLowerCase() === query);

    if (verb) {
        showVerb(verb);
    }
});

function showVerb(v) {
    verbContent.classList.remove('hidden');
    verbContent.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>${v.Infinitive}</h2>
                <span class="badge">${v.Hilfsverb}</span>
            </div>
            
            <div class="grid">
                <div class="item"><strong>Präsens ich:</strong> ${v.Präsens_ich}</div>
                <div class="item"><strong>Präsens du:</strong> ${v.Präsens_du}</div>
                <div class="item"><strong>Präsens er/sie/es:</strong> ${v["Präsens_er, sie, es"]}</div>
                <div class="item highlight"><strong>Präteritum (ich):</strong> ${v.Präteritum_ich}</div>
                <div class="item highlight"><strong>Partizip II:</strong> ${v["Partizip II"]}</div>
                <div class="item"><strong>Konjunktiv II:</strong> ${v["Konjunktiv II_ich"]}</div>
                <div class="item"><strong>Imp. Sg:</strong> ${v["Imperativ Singular"]}</div>
                <div class="item"><strong>Imp. Pl:</strong> ${v["Imperativ Plural"]}</div>
            </div>
        </div>
    `;
}