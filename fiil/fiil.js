/* fiil.js — AlmancaPratik Verb Conjugation Engine
   Web Speech API · Copy · Quick chips · Table links */

"use strict";

// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
let verbData      = [];
let currentVerb   = null;
let speechSpeed   = 1;
let isSpeaking    = false;
let speechQueue   = [];
let speechIdx     = 0;

// ══════════════════════════════════════════
//  GRAMMAR ENGINE
// ══════════════════════════════════════════
const GermanGrammar = {

  getPraesensPlural(infinitive) {
    const inf = infinitive.toLowerCase();
    const exceptions = {
      "sein":   { wir: "sind",   ihr: "seid",   sie: "sind"   },
      "haben":  { wir: "haben",  ihr: "habt",   sie: "haben"  },
      "werden": { wir: "werden", ihr: "werdet", sie: "werden" },
      "wissen": { wir: "wissen", ihr: "wisst",  sie: "wissen" },
      "tun":    { wir: "tun",    ihr: "tut",    sie: "tun"    }
    };
    if (exceptions[inf]) return exceptions[inf];

    let stem = inf.endsWith("en") ? inf.slice(0, -2)
             : inf.endsWith("n")  ? inf.slice(0, -1)
             : inf;
    const ihr = (stem.match(/[dt]$/) || stem.match(/[^aeiouhlr][mn]$/i))
              ? stem + "et"
              : stem + "t";
    return { wir: infinitive, ihr, sie: infinitive };
  },

  getPraeteritum(ichForm) {
    if (!ichForm || ichForm === "-") {
      return { ich: "-", du: "-", er: "-", wir: "-", ihr: "-", sie: "-" };
    }
    if (ichForm === "war") {
      return { ich: "war", du: "warst", er: "war", wir: "waren", ihr: "wart", sie: "waren" };
    }

    let du, wir, ihr, sie;
    const er = ichForm;

    if (ichForm.endsWith("e")) {
      du  = ichForm + "st";
      wir = ichForm + "n";
      ihr = ichForm + "t";
      sie = ichForm + "n";
    } else {
      du  = ichForm.match(/[sßxz]$/) || ichForm.match(/[dt]$/)
            ? ichForm + "est"
            : ichForm + "st";
      wir = ichForm + "en";
      ihr = ichForm.match(/[dt]$/) ? ichForm + "et" : ichForm + "t";
      sie = ichForm + "en";
    }
    return { ich: ichForm, du, er, wir, ihr, sie };
  },

  getVerbType(präteritumIch) {
    if (!präteritumIch || präteritumIch === "-") return "Modal Fiil";
    return präteritumIch.endsWith("te") || präteritumIch.endsWith("t")
      ? "Düzenli (Schwach)"
      : "Düzensiz (Stark)";
  }
};

// ══════════════════════════════════════════
//  WEB SPEECH API
// ══════════════════════════════════════════
const Speech = {
  supported: "speechSynthesis" in window,

  speak(text, rate = 1, onEnd = null) {
    if (!this.supported || !text || text === "-") {
      if (onEnd) onEnd();
      return;
    }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang  = "de-DE";
    utt.rate  = rate;
    utt.pitch = 1;

    // pick a German voice if available
    const voices = window.speechSynthesis.getVoices();
    const deVoice = voices.find(v => v.lang.startsWith("de")) || null;
    if (deVoice) utt.voice = deVoice;

    utt.onend = () => { if (onEnd) onEnd(); };
    window.speechSynthesis.speak(utt);
  },

  speakQueue(items, rate = 1, onDone = null) {
    if (!items.length) { if (onDone) onDone(); return; }
    const [head, ...tail] = items;
    this.speak(head, rate, () => {
      if (tail.length) {
        setTimeout(() => this.speakQueue(tail, rate, onDone), 350);
      } else {
        if (onDone) onDone();
      }
    });
  },

  cancel() {
    if (this.supported) window.speechSynthesis.cancel();
  }
};

// ══════════════════════════════════════════
//  DATA LOADING
// ══════════════════════════════════════════
fetch('./fiil.json')
  .then(r => r.json())
  .then(data => {
    verbData = data;
    console.info(`✓ ${data.length} Almanca fiil yüklendi.`);
  })
  .catch(err => console.error("Veri yükleme hatası:", err));

// ══════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════
function showToast(msg, duration = 2000) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), duration);
}

function makeConjCell(pronoun, form, clrClass = "") {
  const isDash = !form || form === "-";
  return `
    <div class="conj-cell" data-form="${isDash ? "" : form}">
      <div class="conj-left">
        <span class="conj-pronoun">${pronoun}</span>
        <span class="conj-form${isDash ? " dash" : ""}">${isDash ? "—" : form}</span>
      </div>
      <div class="conj-btns">
        ${!isDash ? `
        <button class="speak-icon-btn" data-text="${form}" title="${form} sesli oku" aria-label="${form} sesli oku">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
        <button class="copy-icon-btn" data-copy="${form}" title="${form} kopyala" aria-label="${form} kopyala">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        ` : ""}
      </div>
    </div>`;
}

function makeFormCard(label, value, highlighted = false, withSpeak = false) {
  const isDash = !value || value === "-";
  return `
    <div class="form-card${highlighted ? " highlighted" : ""}">
      <div class="form-label">${label}</div>
      <div class="form-value${highlighted ? " gold" : ""}">
        <span>${isDash ? "—" : value}</span>
        ${withSpeak && !isDash ? `
        <button class="speak-icon-btn" data-text="${value}" title="${value} sesli oku" aria-label="${value} sesli oku">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
        ` : ""}
        ${!isDash ? `
        <button class="copy-icon-btn" data-copy="${value}" title="${value} kopyala" aria-label="${value} kopyala">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        ` : ""}
      </div>
    </div>`;
}

// ══════════════════════════════════════════
//  MAIN RENDER
// ══════════════════════════════════════════
function showVerb(v) {
  currentVerb = v;

  const pPlural  = GermanGrammar.getPraesensPlural(v.Infinitive);
  const pretFull = GermanGrammar.getPraeteritum(v.Präteritum_ich);
  const verbType = GermanGrammar.getVerbType(v.Präteritum_ich);
  const partII   = v["Partizip II"] || "-";
  const hilfsv   = v.Hilfsverb || "—";
  const perfect  = partII !== "-" && hilfsv !== "—"
    ? `ich ${hilfsv === "sein" ? "bin" : "habe"} ${partII}`
    : "—";

  // ── Header ──
  document.getElementById("verbTitle").textContent = v.Infinitive;
  document.getElementById("tagHilf").textContent   = `Hilfsverb: ${hilfsv}`;
  document.getElementById("tagType").textContent   = verbType;

  // ── Präsens grid ──
  const pGrid = document.getElementById("praesensGrid");
  pGrid.innerHTML = [
    makeConjCell("ich",        v.Präsens_ich),
    makeConjCell("wir",        pPlural.wir),
    makeConjCell("du",         v.Präsens_du),
    makeConjCell("ihr",        pPlural.ihr),
    makeConjCell("er / sie / es", v["Präsens_er, sie, es"]),
    makeConjCell("sie / Sie",  pPlural.sie),
  ].join("");

  // ── Präteritum grid ──
  const ptGrid = document.getElementById("praeteritumGrid");
  ptGrid.innerHTML = [
    makeConjCell("ich",        pretFull.ich),
    makeConjCell("wir",        pretFull.wir),
    makeConjCell("du",         pretFull.du),
    makeConjCell("ihr",        pretFull.ihr),
    makeConjCell("er / sie / es", pretFull.er),
    makeConjCell("sie / Sie",  pretFull.sie),
  ].join("");

  // ── Other forms ──
  const fGrid = document.getElementById("formsGrid");
  fGrid.innerHTML = [
    makeFormCard("Partizip II",    partII,                       true,  true),
    makeFormCard("Konjunktiv II",  v["Konjunktiv II_ich"] || "-", true,  true),
    makeFormCard("Imperativ Sg.",  v["Imperativ Singular"] || "-", false, true),
    makeFormCard("Imperativ Pl.",  v["Imperativ Plural"]   || "-", false, true),
  ].join("");

  // ── Perfect bar ──
  document.getElementById("perfectForm").textContent = perfect;
  document.getElementById("btnSpeakPerfect").dataset.text = perfect;

  // ── Show ──
  const wrapper = document.getElementById("verbContent");
  const nf      = document.getElementById("notFound");
  wrapper.classList.remove("hidden");
  nf.classList.add("hidden");

  // re-trigger animation
  wrapper.style.animation = "none";
  wrapper.offsetHeight; // reflow
  wrapper.style.animation = "";

  // ── Delegate events ──
  bindCellEvents();
}

// ══════════════════════════════════════════
//  CELL EVENT DELEGATION
// ══════════════════════════════════════════
function bindCellEvents() {
  const wrapper = document.getElementById("verbContent");
  wrapper.querySelectorAll("[data-text]").forEach(btn => {
    btn.onclick = function(e) {
      e.stopPropagation();
      const text = this.dataset.text;
      if (!text) return;
      Speech.speak(text, speechSpeed);
      // animate
      document.querySelectorAll(".speak-icon-btn.playing").forEach(b => b.classList.remove("playing"));
      this.classList.add("playing");
      setTimeout(() => this.classList.remove("playing"), 1400);
    };
  });

  wrapper.querySelectorAll("[data-copy]").forEach(btn => {
    btn.onclick = function(e) {
      e.stopPropagation();
      const text = this.dataset.copy;
      if (!text) return;
      navigator.clipboard.writeText(text)
        .then(() => showToast(`"${text}" kopyalandı ✓`))
        .catch(() => showToast("Kopyalama başarısız."));
    };
  });
}

// ══════════════════════════════════════════
//  SPEAK ALL / TENSE SPEAK
// ══════════════════════════════════════════
document.getElementById("btnSpeakAll")?.addEventListener("click", function() {
  if (!currentVerb) return;
  Speech.cancel();

  const btn = this;
  const pP  = GermanGrammar.getPraesensPlural(currentVerb.Infinitive);
  const ptF = GermanGrammar.getPraeteritum(currentVerb.Präteritum_ich);

  const allForms = [
    currentVerb.Infinitive,
    // Präsens
    currentVerb.Präsens_ich, currentVerb.Präsens_du,
    currentVerb["Präsens_er, sie, es"], pP.wir, pP.ihr, pP.sie,
    // Präteritum
    ptF.ich, ptF.du, ptF.er, ptF.wir, ptF.ihr, ptF.sie,
    // Other
    currentVerb["Partizip II"]
  ].filter(f => f && f !== "-");

  btn.classList.add("playing");
  Speech.speakQueue(allForms, speechSpeed, () => {
    btn.classList.remove("playing");
  });
});

// Mini tense speak buttons
document.getElementById("verbContent")?.addEventListener("click", function(e) {
  const speakBtn = e.target.closest("[data-tense]");
  if (!speakBtn || !currentVerb) return;

  const tense = speakBtn.dataset.tense;
  const pP    = GermanGrammar.getPraesensPlural(currentVerb.Infinitive);
  const ptF   = GermanGrammar.getPraeteritum(currentVerb.Präteritum_ich);

  let forms = [];
  if (tense === "praesens") {
    forms = [
      currentVerb.Präsens_ich, currentVerb.Präsens_du,
      currentVerb["Präsens_er, sie, es"], pP.wir, pP.ihr, pP.sie
    ];
  } else if (tense === "praeteritum") {
    forms = [ ptF.ich, ptF.du, ptF.er, ptF.wir, ptF.ihr, ptF.sie ];
  }

  Speech.cancel();
  Speech.speakQueue(forms.filter(f => f && f !== "-"), speechSpeed);
});

// ══════════════════════════════════════════
//  COPY ALL
// ══════════════════════════════════════════
document.getElementById("btnCopyAll")?.addEventListener("click", function() {
  if (!currentVerb) return;
  const pP  = GermanGrammar.getPraesensPlural(currentVerb.Infinitive);
  const ptF = GermanGrammar.getPraeteritum(currentVerb.Präteritum_ich);

  const text = [
    `=== ${currentVerb.Infinitive} (Hilfsverb: ${currentVerb.Hilfsverb}) ===`,
    "",
    "── Präsens ──",
    `ich: ${currentVerb.Präsens_ich}   wir: ${pP.wir}`,
    `du: ${currentVerb.Präsens_du}   ihr: ${pP.ihr}`,
    `er/sie/es: ${currentVerb["Präsens_er, sie, es"]}   sie/Sie: ${pP.sie}`,
    "",
    "── Präteritum ──",
    `ich: ${ptF.ich}   wir: ${ptF.wir}`,
    `du: ${ptF.du}   ihr: ${ptF.ihr}`,
    `er/sie/es: ${ptF.er}   sie/Sie: ${ptF.sie}`,
    "",
    `Partizip II: ${currentVerb["Partizip II"] || "-"}`,
    `Konjunktiv II: ${currentVerb["Konjunktiv II_ich"] || "-"}`,
    `Imperativ Sg: ${currentVerb["Imperativ Singular"] || "-"}`,
    `Imperativ Pl: ${currentVerb["Imperativ Plural"] || "-"}`,
  ].join("\n");

  navigator.clipboard.writeText(text)
    .then(() => showToast("Çekim tablosu kopyalandı ✓"))
    .catch(() => showToast("Kopyalama başarısız."));
});

// ══════════════════════════════════════════
//  SPEED PILLS
// ══════════════════════════════════════════
document.querySelectorAll(".speed-pill").forEach(pill => {
  pill.addEventListener("click", function() {
    document.querySelectorAll(".speed-pill").forEach(p => p.classList.remove("active"));
    this.classList.add("active");
    speechSpeed = parseFloat(this.dataset.speed);
    showToast(`Hız: ${this.textContent}`);
  });
});

// ══════════════════════════════════════════
//  PERFECT SPEAK
// ══════════════════════════════════════════
document.getElementById("btnSpeakPerfect")?.addEventListener("click", function() {
  const text = this.dataset.text;
  if (text && text !== "—") Speech.speak(text, speechSpeed);
});

// ══════════════════════════════════════════
//  SEARCH INPUT
// ══════════════════════════════════════════
const searchInput = document.getElementById("searchInput");

searchInput?.addEventListener("input", handleSearch);

function handleSearch() {
  const query = searchInput.value.toLowerCase().trim();

  if (query.length < 2) {
    document.getElementById("verbContent").classList.add("hidden");
    document.getElementById("notFound").classList.add("hidden");
    return;
  }

  const verb = verbData.find(v =>
    v.Infinitive && v.Infinitive.toLowerCase() === query
  );

  if (verb) {
    showVerb(verb);
    document.getElementById("notFound").classList.add("hidden");
  } else {
    document.getElementById("verbContent").classList.add("hidden");
    document.getElementById("notFound").classList.remove("hidden");
  }
}

// ══════════════════════════════════════════
//  QUICK CHIPS
// ══════════════════════════════════════════
document.querySelectorAll(".quick-chip").forEach(chip => {
  chip.addEventListener("click", function() {
    const verb = this.dataset.verb;
    if (!searchInput) return;
    searchInput.value = verb;
    handleSearch();
    // smooth scroll to results
    document.getElementById("verbContent")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

// ══════════════════════════════════════════
//  TABLE QUICK LINKS
// ══════════════════════════════════════════
document.querySelectorAll(".cv-link").forEach(link => {
  link.addEventListener("click", function() {
    const verb = this.dataset.verb;
    if (!searchInput) return;
    searchInput.value = verb;
    handleSearch();
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => searchInput.focus(), 400);
  });
});

// ══════════════════════════════════════════
//  VOICES PRELOAD (some browsers need a tick)
// ══════════════════════════════════════════
if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices(); // preload
  };
}