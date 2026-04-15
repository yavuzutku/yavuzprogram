let verbData = [];

fetch('./fiil.json')
    .then(response => response.json())
    .then(data => {
        verbData = data;
        console.log("8000 fiil yüklendi.");
    });

const searchInput = document.getElementById('searchInput');
const verbContent = document.getElementById('verbContent');

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (query.length < 2) {
        verbContent.classList.add('hidden');
        return;
    }

    // Tam eşleşme ara
    const verb = verbData.find(v => v.Infinitive.toLowerCase() === query);

    if (verb) {
        showVerb(verb);
    } 
    // İstersen buraya 'yakın sonuçları listele' özelliği de eklenebilir.
});

function showVerb(v) {
    verbContent.classList.remove('hidden');
    verbContent.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2 style="margin:0; color:#1e293b;">${v.Infinitive}</h2>
                <span class="badge">Hilfsverb: ${v.Hilfsverb}</span>
            </div>
            
            <div class="grid">
                <div class="item"><strong>Präsens (ich):</strong> ${v.Präsens_ich}</div>
                <div class="item"><strong>Präsens (du):</strong> ${v.Präsens_du}</div>
                <div class="item"><strong>Präsens (er/sie/es):</strong> ${v["Präsens_er, sie, es"]}</div>
                <div class="item highlight"><strong>Präteritum:</strong> ${v.Präteritum_ich}</div>
                <div class="item highlight"><strong>Partizip II:</strong> ${v["Partizip II"]}</div>
                <div class="item"><strong>Konjunktiv II:</strong> ${v["Konjunktiv II_ich"]}</div>
                <div class="item"><strong>Imperativ (Sg):</strong> ${v["Imperativ Singular"]}</div>
                <div class="item"><strong>Imperativ (Pl):</strong> ${v["Imperativ Plural"]}</div>
            </div>
        </div>
    `;
}