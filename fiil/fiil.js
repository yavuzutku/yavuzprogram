let verbData = [];

// ÇEKİMLEME MOTORU (Tüm mantık burada)
const GermanGrammar = {
    getPraesensPlural(infinitive) {
        const inf = infinitive.toLowerCase();
        const exceptions = {
            "sein": { wir: "sind", ihr: "seid", sie: "sind" },
            "haben": { wir: "haben", ihr: "habt", sie: "haben" },
            "werden": { wir: "werden", ihr: "werdet", sie: "werden" },
            "wissen": { wir: "wissen", ihr: "wisst", sie: "wissen" },
            "tun": { wir: "tun", ihr: "tut", sie: "tun" }
        };

        if (exceptions[inf]) return exceptions[inf];

        let stem = inf.endsWith("en") ? inf.slice(0, -2) : (inf.endsWith("n") ? inf.slice(0, -1) : inf);
        let ihr = "";
        
        if (stem.match(/[dt]$/) || stem.match(/[^aeiouhlr][mn]$/i)) {
            ihr = stem + "et";
        } else {
            ihr = stem + "t";
        }

        return { wir: infinitive, ihr: ihr, sie: infinitive };
    },

    getPraeteritum(ichForm) {
        if (!ichForm || ichForm === "-") return { ich: "-", du: "-", er: "-", wir: "-", ihr: "-", sie: "-" };
        
        let du, wir, ihr, sie;
        const er = ichForm;

        if (ichForm === "war") return { ich: "war", du: "warst", er: "war", wir: "waren", ihr: "wart", sie: "waren" };

        if (ichForm.endsWith("e")) {
            du = ichForm + "st";
            wir = ichForm + "n";
            ihr = ichForm + "t";
            sie = ichForm + "n";
        } else {
            if (ichForm.match(/[sßxz]$/)) du = ichForm + "est";
            else if (ichForm.match(/[dt]$/)) du = ichForm + "est";
            else du = ichForm + "st";

            wir = ichForm + "en";
            ihr = ichForm.match(/[dt]$/) ? ichForm + "et" : ichForm + "t";
            sie = ichForm + "en";
        }
        return { ich: ichForm, du, er, wir, ihr, sie };
    }
};

// VERİ YÜKLEME
fetch('./fiil.json')
    .then(res => res.json())
    .then(data => {
        verbData = data;
        console.log(data.length + " fiil yüklendi.");
    })
    .catch(err => console.error("Veri yükleme hatası:", err));

const searchInput = document.getElementById('searchInput');
const verbContent = document.getElementById('verbContent');

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query.length < 2) {
        verbContent.classList.add('hidden');
        return;
    }

    // Senin verindeki "Infinitive" anahtarına göre arama yapıyoruz
    const verb = verbData.find(v => v.Infinitive && v.Infinitive.toLowerCase() === query);

    if (verb) {
        showVerb(verb);
    } else {
        verbContent.classList.add('hidden');
    }
});

function showVerb(v) {
    const pPlural = GermanGrammar.getPraesensPlural(v.Infinitive);
    const pretFull = GermanGrammar.getPraeteritum(v.Präteritum_ich);

    verbContent.classList.remove('hidden');
    verbContent.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>${v.Infinitive}</h2>
                <span class="badge">Hilfsverb: ${v.Hilfsverb}</span>
            </div>
            
            <div class="time-title">Präsens (Şimdiki Zaman)</div>
            <div class="grid">
                <div class="item"><strong>ich:</strong> ${v.Präsens_ich}</div>
                <div class="item"><strong>wir:</strong> ${pPlural.wir}</div>
                <div class="item"><strong>du:</strong> ${v.Präsens_du}</div>
                <div class="item"><strong>ihr:</strong> ${pPlural.ihr}</div>
                <div class="item"><strong>er/sie/es:</strong> ${v["Präsens_er, sie, es"]}</div>
                <div class="item"><strong>sie/Sie:</strong> ${pPlural.sie}</div>
            </div>

            <div class="time-title">Präteritum (Geçmiş Zaman)</div>
            <div class="grid praeteritum-group">
                <div class="item"><strong>ich:</strong> ${pretFull.ich}</div>
                <div class="item"><strong>wir:</strong> ${pretFull.wir}</div>
                <div class="item"><strong>du:</strong> ${pretFull.du}</div>
                <div class="item"><strong>ihr:</strong> ${pretFull.ihr}</div>
                <div class="item"><strong>er/sie/es:</strong> ${pretFull.er}</div>
                <div class="item"><strong>sie/Sie:</strong> ${pretFull.sie}</div>
            </div>

            <div class="time-title">Diğer Formlar</div>
            <div class="grid">
                <div class="item highlight"><strong>Partizip II:</strong> ${v["Partizip II"]}</div>
                <div class="item highlight"><strong>Konjunktiv II:</strong> ${v["Konjunktiv II_ich"]}</div>
                <div class="item"><strong>Imperativ (Sg):</strong> ${v["Imperativ Singular"]}</div>
                <div class="item"><strong>Imperativ (Pl):</strong> ${v["Imperativ Plural"]}</div>
            </div>
        </div>
    `;
}