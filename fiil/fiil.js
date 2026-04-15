let verbData = [];

fetch('./fiil.json')
    .then(response => response.json())
    .then(data => {
        verbData = data;
        console.log("8000 fiil yüklendi.");
    });

const searchInput = document.getElementById('searchInput');
const verbContent = document.getElementById('verbContent');

// --- ÇOK GELİŞMİŞ ALMANCA ÇEKİMLEME MOTORU ---
const GermanGrammar = {
    // 1. Präsens (Şimdiki/Geniş Zaman) Çoğul Zamirleri Üretici
    getPraesensPlural(infinitive) {
        const inf = infinitive.toLowerCase();
        
        // Mutlak İstisnalar (Modallar ve Tamamen Düzensizler)
        const exceptions = {
            "sein": { wir: "sind", ihr: "seid", sie: "sind" },
            "haben": { wir: "haben", ihr: "habt", sie: "haben" },
            "werden": { wir: "werden", ihr: "werdet", sie: "werden" },
            "wissen": { wir: "wissen", ihr: "wisst", sie: "wissen" },
            "tun": { wir: "tun", ihr: "tut", sie: "tun" },
            "können": { wir: "können", ihr: "könnt", sie: "können" },
            "müssen": { wir: "müssen", ihr: "müsst", sie: "müssen" },
            "dürfen": { wir: "dürfen", ihr: "dürft", sie: "dürfen" },
            "sollen": { wir: "sollen", ihr: "sollt", sie: "sollen" },
            "wollen": { wir: "wollen", ihr: "wollt", sie: "wollen" },
            "mögen": { wir: "mögen", ihr: "mögt", sie: "mögen" }
        };

        if (exceptions[inf]) return exceptions[inf];

        // Normal/Düzensiz fiiller için kök (stem) analizi
        let stem = inf;
        if (inf.endsWith("en")) stem = inf.slice(0, -2);
        else if (inf.endsWith("n")) stem = inf.slice(0, -1);

        let ihr = "";
        
        // "ihr" zamiri için Almanca Ses Uyum Kuralları (Euphony)
        if (stem.match(/[dt]$/)) {
            ihr = stem + "et"; // Örn: arbeit-en -> arbeitet, find-en -> findet
        } else if (stem.match(/[^aeiouhlr][mn]$/i)) {
            ihr = stem + "et"; // Örn: atm-en -> atmet, rechn-en -> rechnet
        } else {
            ihr = stem + "t";  // Örn: mach-en -> macht, geh-en -> geht
        }

        return {
            wir: infinitive, // 'wir' her zaman mastarla aynıdır (sein hariç)
            ihr: ihr,
            sie: infinitive  // 'sie/Sie' her zaman mastarla aynıdır (sein hariç)
        };
    },

    // 2. Präteritum (Geçmiş Zaman) Tüm Zamirleri Üretici
    getPraeteritum(ichForm) {
        if (!ichForm || ichForm === "-") return { ich: "-", du: "-", er: "-", wir: "-", ihr: "-", sie: "-" };
        
        let du, er, wir, ihr, sie;
        er = ichForm; // Präteritum'da 'ich' ve 'er/sie/es' HER ZAMAN aynıdır.

        if (ichForm === "war") { // Özel durum
            return { ich: "war", du: "warst", er: "war", wir: "waren", ihr: "wart", sie: "waren" };
        }

        if (ichForm.endsWith("e")) {
            // Zayıf fiiller (machte) veya 'e' ile biten güçlü fiiller (wurde)
            du = ichForm + "st";
            wir = ichForm + "n";
            ihr = ichForm + "t";
            sie = ichForm + "n";
        } else {
            // Güçlü/Düzensiz fiiller (ging, sah, fand, las)
            if (ichForm.match(/[sßxz]$/)) du = ichForm + "est"; // las -> lasest
            else if (ichForm.match(/[dt]$/)) du = ichForm + "est"; // fand -> fandest
            else du = ichForm + "st"; // ging -> gingst

            wir = ichForm + "en"; // ging -> gingen
            
            if (ichForm.match(/[dt]$/)) ihr = ichForm + "et"; // fand -> fandet
            else ihr = ichForm + "t"; // ging -> gingt
            
            sie = ichForm + "en"; // ging -> gingen
        }

        return { ich: ichForm, du, er, wir, ihr, sie };
    }
};
// ----------------------------------------------

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (query.length < 2) {
        verbContent.classList.add('hidden');
        return;
    }

    const verb = verbData.find(v => v.Infinitive.toLowerCase() === query);

    if (verb) {
        showVerb(verb);
    } 
});

function showVerb(v) {
    verbContent.classList.remove('hidden');
    
    // Motorumuzu çalıştırıp eksik zamirleri üretiyoruz!
    const praesensPlural = GermanGrammar.getPraesensPlural(v.Infinitive);
    const praeteritumFull = GermanGrammar.getPraeteritum(v.Präteritum_ich);

    verbContent.innerHTML = `
        <div class="card">
            <div class="card-header" style="border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px;">
                <h2 style="margin:0; color:#1e293b; font-size: 24px;">${v.Infinitive}</h2>
                <span class="badge" style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px;">Hilfsverb: ${v.Hilfsverb}</span>
            </div>
            
            <h3 style="color: #475569; margin-bottom: 10px;">Präsens (Şimdiki Zaman)</h3>
            <div class="grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                <div class="item"><strong>ich:</strong> ${v.Präsens_ich}</div>
                <div class="item"><strong>wir:</strong> ${praesensPlural.wir}</div>
                
                <div class="item"><strong>du:</strong> ${v.Präsens_du}</div>
                <div class="item"><strong>ihr:</strong> <span style="color: #059669;">${praesensPlural.ihr}</span></div>
                
                <div class="item"><strong>er/sie/es:</strong> ${v["Präsens_er, sie, es"]}</div>
                <div class="item"><strong>sie/Sie:</strong> ${praesensPlural.sie}</div>
            </div>

            <h3 style="color: #475569; margin-bottom: 10px;">Präteritum (Geçmiş Zaman)</h3>
            <div class="grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; background: #f8fafc; padding: 10px; border-radius: 8px;">
                <div class="item"><strong>ich:</strong> ${praeteritumFull.ich}</div>
                <div class="item"><strong>wir:</strong> ${praeteritumFull.wir}</div>
                
                <div class="item"><strong>du:</strong> ${praeteritumFull.du}</div>
                <div class="item"><strong>ihr:</strong> ${praeteritumFull.ihr}</div>
                
                <div class="item"><strong>er/sie/es:</strong> ${praeteritumFull.er}</div>
                <div class="item"><strong>sie/Sie:</strong> ${praeteritumFull.sie}</div>
            </div>

            <h3 style="color: #475569; margin-bottom: 10px;">Diğer Formlar</h3>
            <div class="grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="item highlight" style="background: #fef3c7; padding: 5px; border-radius: 4px;"><strong>Partizip II:</strong> ${v["Partizip II"]}</div>
                <div class="item highlight" style="background: #fef3c7; padding: 5px; border-radius: 4px;"><strong>Konjunktiv II:</strong> ${v["Konjunktiv II_ich"]}</div>
                <div class="item"><strong>Imperativ (Sg):</strong> ${v["Imperativ Singular"]}</div>
                <div class="item"><strong>Imperativ (Pl):</strong> ${v["Imperativ Plural"]}</div>
            </div>
        </div>
    `;
}