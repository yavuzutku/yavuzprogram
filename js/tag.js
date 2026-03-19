/* ═══════════════════════════════════════════════════════════
   js/tag.js  —  Etiket sistemi
   • getAutoLevel(word) → "A1" | null  (A1 listesi dahili)
   • renderTagChips    → seçili chip'lerde × silme butonu
═══════════════════════════════════════════════════════════ */

export const TAG_OPTIONS = [
  "fiil","isim","sıfat","zarf","A1","A2","B1","B2","seyahat","iş"
];

// ── Stil enjeksiyonu (bir kez) ────────────────────────────────
let _cssDone = false;
function _injectStyle() {
  if (_cssDone) return; _cssDone = true;
  const s = document.createElement('style');
  s.textContent = `
    .tag-chip { display:inline-flex; align-items:center; gap:3px; }
    .tag-chip-del {
      display:inline-flex; align-items:center; justify-content:center;
      width:15px; height:15px; border-radius:50%;
      font-size:12px; font-weight:700; line-height:1;
      cursor:pointer; opacity:0.5;
      transition:opacity 0.15s, background 0.15s;
      flex-shrink:0; margin-left:2px;
    }
    .tag-chip-del:hover { opacity:1; background:rgba(255,255,255,0.18); }
  `;
  document.head.appendChild(s);
}

// ── Kelime normalizasyonu ─────────────────────────────────────
function _norm(w) {
  if (!w) return '';
  return w.trim().toLowerCase()
    .replace(/^(der|die|das)\s+/i, '')  // artikel sil
    .split(',')[0].trim()               // "ein, eine" → "ein"
    .split(' ')[0].trim();              // "zu Hause" → "zu"
}

// ── A1 Ham Kelime Listesi ─────────────────────────────────────
const _A1_RAW = [
  // Temel / Tanışma
  "der Abend","alles","antworten","auch","auf","aus","die Aussage","bisschen","bitte","danke",
  "dann","Deutsch","der Dialog","dir","du","ein","eine","die Entschuldigung","er","es",
  "die Form","die Frage","fragen","die Frau","ganz","gehen","die Grammatik","gut","hallo",
  "heißen","der Herr","hören","ich","Ihnen","ihr","im","ja","klar","kommen","der Kurs",
  "der Kursteilnehmer","die Kursteilnehmerin","das Land","lesen","der Mann","mein","meine",
  "mit","morgen","die Nacht","der Name","nein","neu","nicht","oder","die Person","richtig",
  "der Satz","schreiben","sehr","sein","sie","Sie","so","die Sprache","sprechen","supergut",
  "der Tag","Tschüss","und","was","welche","wer","das Wiedersehen","wie","wissen","wo",
  "woher","das Wort",
  // Aile / Kayıt
  "aber","die Adresse","alt","anmelden","die Anmeldung","arbeiten","das Bild","der Bruder",
  "buchstabieren","dein","deine","einmal","die Eltern","falsch","die Familie","der Familienname",
  "der Familienstand","das Formular","geschieden","die Geschwister","haben","die Handynummer",
  "die Hausnummer","das Heimatland","hier","Ihr","Ihre","in","die Information","das Jahr",
  "jetzt","kein","keine","das Kind","der Kindergarten","der Kontakt","leben","ledig",
  "die E-Mail","möchten","die Mutter","nach","der Nachname","noch","die Postleitzahl",
  "die Schwester","die Schwägerin","die Schwiegertochter","der Schwiegervater","der Sohn",
  "die Straße","die Telefonnummer","die Tochter","über","der Vater","vergleichen",
  "verheiratet","verwitwet","viel","viele","der Vorname","vorstellen","welcher","welches",
  "willkommen","wir","wohnen","der Wohnort","die Zahl","zu",
  // Sınıf / Haftanın Günleri
  "also","an","andere","benutzen","das Blatt","der Bleistift","das Buch","da",
  "der Deutschkurs","der Dienstag","doch","der Donnerstag","endlich","erklären","erzählen",
  "das Familienfoto","der Feiertag","das Fenster","das Foto","der Freitag","der Freund",
  "für","genau","gestern","groß","der Gruß","die Hausaufgabe","das Heft","heute","immer",
  "die Karte","klein","knifflig","der Kugelschreiber","das Kursbuch","der Kursraum",
  "die Lampe","die Landkarte","langsam","der Lehrer","die Lehrerin","lernen","liebe","lieber",
  "die Liste","machen","mir","der Mittwoch","der Montag","natürlich","nett","das Papier",
  "der Papierkorb","die Pause","das Problem","der Projektor","der Radiergummi","der Raum",
  "der Rucksack","die Sache","sagen","der Samstag","sehen","die Seite","der Schlüssel",
  "schnell","der Sonntag","der Spaß","spielen","der Spitzer","der Stuhl","die Tabelle",
  "die Tafel","die Tasche","der Text","der Tisch","die Tür","übermorgen","die Übung",
  "das Übungsbuch","verstehen","vorgestern","die Wand","die Woche","das Wochenende",
  "das Wörterbuch","zeigen","der Zettel","zusammen",
  // Alışveriş / Yiyecek
  "das Angebot","die Antwort","der Apfel","der Apfelsaft","die Aufgabe","die Babynahrung",
  "die Banane","der Becher","das Beispiel","das Bier","die Birne","das Bistro",
  "die Blaubeere","die Bohne","brauchen","das Brot","das Brötchen","der Cent","die Cola",
  "der Couscous","denn","diese","dieser","dieses","die Dose","durch","das Ei",
  "der Einkaufszettel","einige","die Erbse","die Erdbeere","essen","etwas","fertig",
  "der Fisch","die Flasche","das Fleisch","frisch","das Frühstück","frühstücken","gemeinsam",
  "das Gemüse","gern","das Getränk","das Glas","gleich","das Gramm","die Himbeere",
  "der Honig","der Joghurt","der Kaffee","die Kartoffel","der Käse","kaufen","der Keks",
  "die Kichererbse","das Kilo","die Kirsche","die Kiwi","die Kontrolle","kosten","der Kuchen",
  "der Kunde","die Kundin","kurz","das Lammfleisch","das Lebensmittel","die Limonade",
  "der Liter","man","die Mandarine","die Mango","der Markt","die Marmelade","das Mehl",
  "meistens","die Mengenangabe","die Melone","die Milch","das Milchprodukt","mögen",
  "die Möhre","müssen","nehmen","die Nudel","nur","das Obst","der Obstsalat","das Olivenöl",
  "die Orange","ordnen","die Packung","die Paprika","der Partner","die Partnerin","das Pfund",
  "der Pilz","planen","der Preis","pro","der Pudding","der Reis","das Rindfleisch","der Saft",
  "die Sahne","der Salat","das Salz","sich","schmecken","die Schokolade","schön",
  "das Schweinefleisch","sonst","stehen","streichen","das Stück","die Tasse","der Tee",
  "teuer","der Tipp","die Tomate","die Traube","trinken","unterstreichen","verbinden",
  "der Verkäufer","die Verkäuferin","von","das Wasser","der Wein","die Zitrone",
  "der Zucker","die Zwiebel",
  // Günlük Yaşam / Zaman
  "abends","der Alltag","anrufen","die Arbeit","aufstehen","beginnen","beide","das Bett",
  "bis","das Büro","der Computer","das Computerspiel","erst","fernsehen","der Film",
  "die Freundin","früh","der Fußball","geöffnet","grillen","halb","der Hunger","die Idee",
  "das Interview","kochen","können","lecker","leider","manchmal","mehr","der Mittag",
  "mittags","die Mittagspause","der Morgen","morgens","müde","die Musik","der Nachmittag",
  "nachmittags","nachts","nie","der Notizzettel","oft","die Pizza","putzen","schade",
  "schlafen","der Schluss","die Schule","spät","spazieren","das Spiel","der Sport",
  "die Stunde","der Stundenplan","der Supermarkt","telefonieren","tun","die Uhr",
  "die Uhrzeit","um","der Unterricht","das Viertel","vor","der Vormittag","vormittags",
  "wann","die Wohnung","zeichnen","die Zeit","zu Hause",
  // Konut / Ev
  "ab","der Altbau","die Angabe","die Anzeige","das Arbeitszimmer","das Bad","baden",
  "die Badewanne","das Badezimmer","der Balkon","der Bauernhof","bei","bekommen",
  "der Besichtigungstermin","besser","billig","breit","circa","dazu","die Diele","direkt",
  "dort","draußen","dringend","dunkel","die Dusche","das Einfamilienhaus","einkaufen",
  "das Elektrogerät","das Erdgeschoss","ersetzen","der Euro","der Fernseher","finden",
  "die Firma","der Flur","frei","die Garage","der Garten","der Gast","das Geld","gemütlich",
  "gepflegt","das Gerät","das Geschäft","das Gespräch","die Größe","grün","hängen","hässlich",
  "die Hauptsache","das Haus","das Haustier","die Heizung","helfen","hell","der Herd",
  "die Hilfe","hinten","das Hochhaus","die Immobilie","insgesamt","interessant",
  "jeder","jede","jedes","der Juni","die Kaffeemaschine","kalt","die Kaution","der Keller",
  "das Kinderzimmer","der Kleiderschrank","die Küche","der Kühlschrank","lang","lassen",
  "laut","liebsten","liegen","maximal","das Mehrfamilienhaus","die Miete","mindestens",
  "die Möbel","möbliert","modern","der Monat","die Monatsmiete","der Müll","neben",
  "die Nebenkosten","ohne","das Obergeschoss","der Ort","die Pflanze","der Plan","der Platz",
  "der Quadratmeter","das Regal","das Reihenhaus","ruhig","schauen","das Schlafzimmer",
  "schmal","der Schrank","der Sessel","singen","sitzen","das Sofa","sofort","sollen",
  "das Sonderangebot","die Sonne","sonstiges","die Sprachschule","spülen","die Spülmaschine",
  "die Stadt","suchen","super","der Teppich","die Terrasse","die Toilette","toll",
  "die Traumwohnung","unbedingt","ungemütlich","unser","unsere","warum","waschen",
  "die Waschmaschine","das WC","wegziehen","weiter","wenn","werden","wichtig","wohnen",
  "die Wohnungsanzeige","die Wohnungssuche","das Wohnzimmer","wunderschön","wünschen",
  "zahlen","die Zeitung","das Zentrum","das Zimmer","zu Fuß",
  // Ulaşım / Şehir
  "die Ampel","die Ankunftszeit","die Ansage","die Apotheke","der Arzt","die Ärztin",
  "die Auskunft","außerdem","außerplanmäßig","das Auto","die Bahn","der Bahnhof","der Ball",
  "die Bank","bezahlen","die Bibliothek","das Bürgerbüro","der Bus","die Bushaltestelle",
  "das Café","dafür","dritte","die Durchsage","einfach","die Einzelfahrkarte","erste",
  "der Erwachsene","fahren","der Fahrgast","die Fahrkarte","das Fahrrad","fallen","fast",
  "der Flughafen","das Gebäude","geben","gegenüber","geradeaus","das Gleis","gültig",
  "halten","die Haltestelle","der Hauptbahnhof","hinter","das Hotel",
  "der Informationsschalter","der Intercity","das Jobcenter","das Kino","die Kirche",
  "das Krankenhaus","die Krankenkasse","die Kreuzung","die Kurzstrecke","die Linie","links",
  "die Lösung","der Meter","der Metzger","die Minute","die Mobilität","das Motorrad",
  "nachfragen","nächster","nächste","nächstes","nichts","öffentlich","die Orientierung",
  "der Park","die Parkgebühr","der Parkplatz","die Polizei","die Position","die Post",
  "praktisch","rechts","das Rathaus","die Regionalbahn","das Restaurant","die Ruhe",
  "der Schienenersatzverkehr","das Schwimmbad","selten","sowieso","später","der Stadtplan",
  "der Stadtwald","steigen","die Straßenbahn","die Tageskarte","das Taxi","überall",
  "umsteigen","ungefähr","unter","die Verfügung","das Verkehrsmittel","verstanden",
  "verzögern","die Volkshochschule","voll","vorbei","vorne","warten","der Weg","der Winter",
  "der Wochenmarkt","wohin","wollen","der Zug","zweimal","zweite","zwischen",
  // Meslekler
  "anfangen","der Arbeitstag","die Ausbildung","ausfüllen","die Aushilfe",
  "der Automechaniker","die Automechanikerin","backen","der Bäcker","die Bäckerin","bald",
  "berichten","der Beruf","beruflich","die Bürokauffrau","der Bürokaufmann","der Chef",
  "die Chefin","das Computerprogramm","das Computersystem","dauern","dreimal","der Fahrer",
  "fangen","der Feierabend","flexibel","fotografieren","freundlich","der Führerschein",
  "der Fußballspieler","die Gitarre","halbtags","die Hausfrau","der Hausmann","der Hund",
  "installieren","die Kantine","kaputt","die Kasse","der Kassierer","die Kassiererin",
  "die Kauffrau","der Kellner","die Kellnerin","klingeln","der Koch","die Köchin",
  "der Kollege","die Kollegin","das Konzert","korrigieren","das Kraftfahrzeug",
  "der Krankenpfleger","die Krankenschwester","kreativ","langweilig","die Leute",
  "die Mathematik","der Mechaniker","der Mensch","das Mittagessen","der Moment",
  "der Musiklehrer","die Musiklehrerin","der Nachtdienst","organisieren","der Pizzafahrer",
  "die Pizzeria","die Pflege","prüfen","pünktlich","das Radio","rechnen","der Rentner",
  "die Reparatur","reparieren","der Reporter","der Roman","schlimm","der Schüler",
  "die Schülerin","servieren","der Stress","der Student","die Studentin","studieren",
  "der Taxifahrer","die Taxifahrerin","der Techniker","das Telefon","der Traumberuf",
  "treffen","die Universität","unterrichten","vielleicht","wählen","die Werkstatt",
  "das Wiederhören","zuerst",
  // Sağlık / Vücut
  "das Altenpflegeheim","anbei","die Anrede","der Arm","atmen","das Auge","der Bauch",
  "das Bein","die Bauchschmerzen","der Bescheid","die Besserung","der Betreff","bevor",
  "bleiben","der Brief","der Briefteil","die Brust","danach","das Datum","dürfen",
  "der Ellbogen","der Empfänger","das Entschuldigungsschreiben","erkälten","die Erkältung",
  "das Fieber","der Finger","das Gesicht","die Gesundheit","die Gesundheitskarte",
  "die Grippe","die Gruppe","das Haar","der Hals","der Hals-Nasen-Ohren-Arzt","das Halsweh",
  "die Hand","der Hausarzt","heiß","der Husten","Hustensaft","das Knie","der Kopf",
  "die Kopfschmerzen","der Körper","der Körperteil","krank","die Krankheit",
  "die Krankmeldung","der März","das Medikament","der Mund","der Nacken","die Nase",
  "die Notfallsprechstunde","das Ohr","der Orthopäde","der Patient","die Patientin","per",
  "das Pflaster","das Praktikum","die Praktikumsbetreuerin","die Praxis",
  "die Praxisgemeinschaft","rauchen","regelmäßig","das Rezept","rot","der Rücken","rund",
  "die Salbe","schicken","der Schmerz","der Schnupfen","die Schulter","schwanger","seine",
  "die Sprechstunde","die Sprechstundenhilfe","das Sprechzimmer","stark","die Stirn",
  "die Tablette","der Termin","der Tropfen","die Unterschrift","die Untersuchung",
  "der Verband","verschieden","die Vorsorge","das Wartezimmer","der Wechsel","wechseln",
  "wehtun","wieder","wiederkommen","der Zahn","der Zeh","zurzeit",
  // Tatil / Seyahat
  "aufwachsen","beantworten","der Besuch","die Bewegung","bilden","die Blume","der Dienst",
  "extra","das Ferienhaus","früher","geboren","gerade","gucken","der Hausflur","heiraten",
  "das Hobby","der Ingenieur","die Insel","die Inselrundfahrt","kennen","der Koffer",
  "letzte","das Meer","der Mond","der Nachbar","die Nachbarin","die Natur","packen",
  "die Postkarte","die Reise","das Schiff","der Seehund","der Ski","der Strand","stressig",
  "das Studium","stundenlang","die Suppe","süß","das Tennis","der Tourist","unregelmäßig",
  "der Urlaub","verdienen","warten","das Wetter",
  // Kıyafet / Alışveriş
  "anziehen","der Anzug","beige","bequem","blau","blöd","die Bluse","braun","bringen",
  "denken","der Einkaufsbummel","eng","euch","die Farbe","furchtbar","gefallen",
  "gegenseitig","gelb","genauso","glauben","grau","günstig","das Hemd","die Hose","ihm",
  "die Jacke","die Jeans","der Jogginganzug","der Kassenbon","das Kaufhaus","die Klamotten",
  "klasse","das Kleid","die Kleidung","das Kleidungsstück","lila","der Mantel","meisten",
  "die Mode","das Modell","die Mütze","online","die Ordnung","das Paar","passen","positiv",
  "probieren","der Prospekt","der Pullover","raten","der Rock","der Schal","der Schuh",
  "schwarz","sicher","die Socke","der Sportschuh","die Strickjacke","der Strumpf","tragen",
  "das T-Shirt","typisch","überhaupt","umtauschen","uns","vergessen","der Wintermantel",
  "zurück",
  // Mevsimler / Kutlamalar
  "die Achtung","der April","aufregen","der August","bauen","der Baum","besuchen","bewölkt",
  "die Braut","der Dank","darüber","die Deutschlandkarte","der Dezember","eben","einladen",
  "die Einladung","einverstanden","das Eis","der Februar","die Feier","feiern","das Fest",
  "freuen","froh","der Frühling","fühlen","die Gartenparty","der Geburtstag",
  "die Geburtstagstorte","das Geschenk","glücklich","der Glückstag","der Grad","hageln",
  "der Handschuh","der Hase","der Herbst","die Himmelsrichtung","die Hochzeit",
  "die Hochzeitsfeier","die Jahreszahl","die Jahreszeit","der Januar","der Juli",
  "der Kalender","lieben","der Luftballon","lustig","der Mai","die Mama","minus","mitbringen",
  "nass","nebelig","der Norden","der November","nun","der Oktober","das Oktoberfest",
  "die Oma","der Osten","das Osterei","das Osterfest","der Osterhase","das Ostern",
  "der Papa","räumen","reden","regnen","samstags","der Schatz","scheinen","schenken",
  "schlecht","der Schnee","der Schneemann","schneien","der Schokoladenkuchen","der Sekt",
  "der September","der Sommer","sonnig","die Spezialität","das Standesamt","stellen",
  "der Süden","tanzen","der Teller","die Torte","trocken","unglücklich","der Unglückstag",
  "warm","das Weihnachten","der Weihnachtsbaum","die Weihnachtsfeier",
  "das Weihnachtsgeschenk","der Weihnachtsmann","das Westdeutschland","der Westen",
  "der Wetterbericht","wieso"
];

// Set oluştur: artikel soyulmuş, küçük harf
const A1_WORDS = new Set(
  _A1_RAW.map(_norm).filter(Boolean)
);

// ── Otomatik seviye tespiti ───────────────────────────────────
export function getAutoLevel(word) {
  if (!word) return null;
  const n = _norm(word);
  if (!n) return null;
  if (A1_WORDS.has(n)) return 'A1';
  // İleride: A2_WORDS, B1_WORDS vs. buraya eklenir
  return null;
}

// ── Kullanıcının tüm kelimelerinden unique tag'leri toplar ────
export function extractAllTags(words = []) {
  const set = new Set(TAG_OPTIONS);
  words.forEach(w => {
    if (Array.isArray(w.tags)) w.tags.forEach(t => set.add(t));
  });
  return [...set];
}

// ── Chip: silme butonu ────────────────────────────────────────
function _appendDelBtn(chip, isCustom) {
  const x = document.createElement("span");
  x.className = "tag-chip-del";
  x.textContent = "×";
  x.title = "Etiketi kaldır";
  x.addEventListener("click", e => {
    e.stopPropagation();
    if (isCustom) {
      chip.remove();                       // özel etiket: DOM'dan sil
    } else {
      chip.classList.remove("selected");   // standart etiket: sadece seçimi kaldır
      x.remove();
    }
  });
  chip.appendChild(x);
}

function _makeChip(tag, selected = false, isCustom = false) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "tag-chip" + (selected ? " selected" : "");
  chip.dataset.tag      = tag;
  chip.dataset.isCustom = isCustom ? "1" : "";

  const label = document.createElement("span");
  label.textContent = tag;
  chip.appendChild(label);

  if (selected) _appendDelBtn(chip, isCustom);

  chip.addEventListener("click", () => {
    const nowSel = chip.classList.contains("selected");
    if (nowSel) {
      chip.classList.remove("selected");
      chip.querySelector(".tag-chip-del")?.remove();
    } else {
      chip.classList.add("selected");
      _appendDelBtn(chip, isCustom);
    }
  });

  return chip;
}

// ── Ana render fonksiyonu ─────────────────────────────────────
export function renderTagChips(containerId, selected = [], allTags = TAG_OPTIONS) {
  _injectStyle();
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  // Standart + kullanıcı tag'leri
  allTags.forEach(tag => {
    container.appendChild(_makeChip(tag, selected.includes(tag), false));
  });

  // selected içinde allTags'de olmayan özel etiketler
  selected.forEach(tag => {
    if (!allTags.includes(tag)) {
      container.appendChild(_makeChip(tag, true, true));
    }
  });

  // ── Özel etiket ekleme alanı ──
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;gap:6px;margin-top:8px;width:100%;";

  const input = document.createElement("input");
  input.placeholder = "Yeni etiket...";
  input.style.cssText = `
    flex:1;min-width:0;
    background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.12);
    border-radius:8px;color:white;
    font-size:12px;font-family:inherit;
    padding:6px 10px;outline:none;transition:0.2s;
  `;
  input.addEventListener("focus", () => input.style.borderColor = "#c9a84c");
  input.addEventListener("blur",  () => input.style.borderColor = "rgba(255,255,255,0.12)");

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "+ Ekle";
  addBtn.style.cssText = `
    padding:6px 12px;border-radius:8px;white-space:nowrap;
    border:1px solid rgba(201,168,76,0.4);
    background:rgba(201,168,76,0.1);color:#c9a84c;
    font-size:12px;font-family:inherit;cursor:pointer;
    font-weight:600;transition:0.2s;
  `;
  addBtn.addEventListener("mouseenter", () => addBtn.style.background = "rgba(201,168,76,0.2)");
  addBtn.addEventListener("mouseleave", () => addBtn.style.background = "rgba(201,168,76,0.1)");

  function addCustomTag() {
    const val = input.value.trim();
    if (!val) return;
    const existing = [...container.querySelectorAll(".tag-chip")]
      .find(c => c.dataset.tag.toLowerCase() === val.toLowerCase());
    if (existing) {
      if (!existing.classList.contains("selected")) {
        existing.classList.add("selected");
        _appendDelBtn(existing, !!existing.dataset.isCustom);
      }
    } else {
      container.insertBefore(_makeChip(val, true, true), wrapper);
    }
    input.value = "";
    input.focus();
  }

  addBtn.addEventListener("click", addCustomTag);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addCustomTag(); }
  });

  wrapper.appendChild(input);
  wrapper.appendChild(addBtn);
  container.appendChild(wrapper);
}

// ── Seçili tag'leri döndür ────────────────────────────────────
export function getSelectedTags(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return [...container.querySelectorAll(".tag-chip.selected")]
    .map(c => c.dataset.tag);
}