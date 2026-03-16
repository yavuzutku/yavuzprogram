import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ══════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════ */
const ADMIN_EMAILS  = ["yavuzutku144@gmail.com", "almancapratik80@gmail.com"];
const HISTORY_KEY   = "ai_history_v2";
const API_KEY_STORE = "ai_gemini_key";
const MAX_HISTORY   = 30;

/* Model listesi */
const MODELS = {
  "gemini-2.5-flash":      { label: "Gemini 2.5 Flash",      note: "En güncel · Önerilen", stable: true },
  "gemini-2.5-flash-lite": { label: "Gemini 2.5 Flash-Lite", note: "Hızlı & ucuz",          stable: true },
  "gemini-2.5-pro":        { label: "Gemini 2.5 Pro",        note: "En güçlü · Yavaş",       stable: true },
  "gemini-2.0-flash":      { label: "Gemini 2.0 Flash",      note: "Eski · Haziran'a kadar", stable: true },
};

const DEFAULT_MODEL = "gemini-2.0-flash";

function geminiUrl(modelKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelKey}:generateContent`;
}

/* ══════════════════════════════════════════════
   MODLAR
══════════════════════════════════════════════ */
const MODES = {
  duzelt: {
    label: "Cümle Düzelt",
    icon: "✏️",
    placeholder: "Almanca cümlenizi yazın, hataları düzeltelim…",
    systemPrompt: (text) =>
      `Sen uzman bir Almanca dil öğretmenisin. Aşağıdaki Almanca cümleyi düzelt. Eğer hata varsa: 1) Düzeltilmiş hali yaz, 2) Hatayı kısa Türkçe açıkla. Hata yoksa "✓ Cümle doğru" de ve kısa not ekle.\n\nCümle: ${text}`,
    quickPrompts: [
      "Ich gehe gestern zum Markt.",
      "Er hat viele Bücher gelest.",
      "Die Kinder spielen in den Garten.",
      "Ich bin 20 Jahre jung.",
    ],
  },
  cevir: {
    label: "Türkçe → Almanca",
    icon: "🔄",
    placeholder: "Türkçe metni yazın, Almancaya çevirelim…",
    systemPrompt: (text) =>
      `Türkçeyi Almancaya doğal ve akıcı biçimde çevir. Sadece çeviriyi ver, açıklama ekleme. Birden fazla cümle varsa hepsini çevir.\n\nMetin: ${text}`,
    quickPrompts: [
      "Merhaba, nasılsınız?",
      "Bugün hava çok güzel.",
      "Sizi tanımaktan büyük memnuniyet duydum.",
      "Bu kitabı okumak istiyorum.",
    ],
  },
  gramer: {
    label: "Gramer Sor",
    icon: "📖",
    placeholder: "Almanca gramer sorunuzu yazın…",
    systemPrompt: (text) =>
      `Sen deneyimli bir Almanca öğretmenisin. Soruyu Türkçe, anlaşılır ve örneklerle açıkla. Örnekleri kalın yaz (**örnek**). Net ve öğretici ol.\n\nSoru: ${text}`,
    quickPrompts: [
      "Akkusativ ve Dativ ne zaman kullanılır?",
      "Perfekt ve Präteritum farkı nedir?",
      "Trennbare Verben nasıl kullanılır?",
      "Konjunktiv II nedir?",
    ],
  },
  kelime: {
    label: "Kelime Analizi",
    icon: "🔍",
    placeholder: "Analiz edilecek Almanca kelimeyi yazın…",
    systemPrompt: (text) =>
      `"${text}" kelimesini analiz et:\n- Artikel (isimse): der/die/das\n- Kelime türü\n- Türkçe anlam(lar)\n- Çoğul formu (isimse)\n- 3 örnek cümle (Almanca + Türkçe çeviri)\n- Varsa yaygın deyimler\n\nAçıklamaları Türkçe yap. Örnek cümleleri numaralandır.`,
    quickPrompts: ["Hund", "gehen", "schön", "Freundschaft", "weil", "obwohl"],
  },
  cumle: {
    label: "Cümle Üret",
    icon: "✨",
    placeholder: "Kelime veya konu yazın, cümleler üretelim…",
    systemPrompt: (text) =>
      `"${text}" konusunda veya kelimesiyle 10 Almanca örnek cümle yaz. Her cümlenin altına Türkçe çevirisini ekle. Cümleleri 1'den 10'a kadar numaralandır. Kolay ve orta seviye karışık olsun.`,
    quickPrompts: [
      "sein (fiili)", "Wetter (hava)", "Familie", "Arbeit", "essen", "gehen",
    ],
  },
  serbest: {
    label: "Serbest Sohbet",
    icon: "💬",
    placeholder: "Almanca ile ilgili her şeyi sorabilirsiniz…",
    systemPrompt: (text) =>
      `Sen Almanca öğrenmeye yardımcı olan, Türkçe açıklama yapan bir dil asistanısın. Soruyu eksiksiz ve açıklayıcı yanıtla.\n\n${text}`,
    quickPrompts: [
      "A1 için en önemli 10 fiil",
      "Almanca öğrenme tavsiyeleri",
      "Zaman zarfları listesi",
      "B1 sınavı için ipuçları",
    ],
  },
};

/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
let currentMode    = "duzelt";
let currentModel   = localStorage.getItem("ai_model") || DEFAULT_MODEL;
let isLoading      = false;
let lastPrompt     = "";   // retry için
let wordCount      = 0;

/* ══════════════════════════════════════════════
   AUTH GUARD
══════════════════════════════════════════════ */
onAuthStateChanged(auth, (user) => {
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    document.getElementById("accessDenied").style.display = "flex";
    document.getElementById("aiContent").style.display    = "none";
    return;
  }
  document.getElementById("accessDenied").style.display = "none";
  document.getElementById("aiContent").style.display    = "flex";
  init();
});

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
function init() {
  loadApiKeyUI();
  buildModelSelect();
  buildModeTabs();
  setMode("duzelt");
  renderHistory();
  bindEvents();
}

/* ── API Key ── */
function loadApiKeyUI() {
  const stored = localStorage.getItem(API_KEY_STORE) || "";
  const input  = document.getElementById("apiKeyInput");
  if (stored) {
    input.value = "●".repeat(10) + stored.slice(-4);
    input.dataset.real = stored;
    setApiStatus("✓ API Key yüklü");
  }
}

function getApiKey() {
  const input = document.getElementById("apiKeyInput");
  return input.dataset.real || input.value.trim();
}

function setApiStatus(msg, isError = false) {
  const el = document.getElementById("apiStatus");
  if (!el) return;
  el.textContent = msg;
  el.className   = "api-status" + (isError ? " error" : "");
  el.style.display = msg ? "inline" : "none";
}

/* ── Model selector ── */
function buildModelSelect() {
  const sel = document.getElementById("modelSelect");
  if (!sel) return;
  sel.innerHTML = "";
  Object.entries(MODELS).forEach(([key, m]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${m.label}${m.stable ? "" : " ⚡"}`;
    if (key === currentModel) opt.selected = true;
    sel.appendChild(opt);
  });
  updateModelDot();
}

function updateModelDot() {
  const dot  = document.getElementById("modelDot");
  const note = document.getElementById("modelNote");
  const m    = MODELS[currentModel];
  if (!dot || !m) return;
  dot.className = "model-dot" + (m.stable ? "" : " warn");
  if (note) note.textContent = m.note;
}

/* ── Mode tabs ── */
function buildModeTabs() {
  const wrap = document.getElementById("modeTabs");
  if (!wrap) return;
  wrap.innerHTML = "";
  Object.entries(MODES).forEach(([key, mode]) => {
    const btn = document.createElement("button");
    btn.className    = "mode-tab" + (key === currentMode ? " active" : "");
    btn.dataset.mode = key;
    btn.innerHTML    = `<span>${mode.icon}</span>${mode.label}`;
    btn.addEventListener("click", () => setMode(key));
    wrap.appendChild(btn);
  });
}

function setMode(key) {
  currentMode = key;
  const mode  = MODES[key];

  document.querySelectorAll(".mode-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === key);
  });

  const ta = document.getElementById("promptInput");
  if (ta) ta.placeholder = mode.placeholder;

  const hint = document.getElementById("modeHintTag");
  if (hint) hint.textContent = mode.icon + " " + mode.label;

  buildQuickPrompts(mode.quickPrompts);
}

function buildQuickPrompts(prompts) {
  const wrap = document.getElementById("quickPrompts");
  if (!wrap) return;
  wrap.innerHTML = "";
  prompts.forEach(p => {
    const chip = document.createElement("button");
    chip.className   = "quick-chip";
    chip.textContent = p;
    chip.addEventListener("click", () => {
      const ta = document.getElementById("promptInput");
      if (ta) { ta.value = p; ta.focus(); updateCharCount(p.length); }
    });
    wrap.appendChild(chip);
  });
}

/* ── Events ── */
function bindEvents() {
  /* API save */
  document.getElementById("apiSaveBtn")?.addEventListener("click", () => {
    const raw = document.getElementById("apiKeyInput").value.trim();
    if (!raw || raw.startsWith("●")) { setApiStatus("Önce yeni key girin", true); return; }
    localStorage.setItem(API_KEY_STORE, raw);
    document.getElementById("apiKeyInput").dataset.real = raw;
    document.getElementById("apiKeyInput").value = "●".repeat(10) + raw.slice(-4);
    setApiStatus("✓ Kaydedildi");
  });

  /* Model change */
  document.getElementById("modelSelect")?.addEventListener("change", (e) => {
    currentModel = e.target.value;
    localStorage.setItem("ai_model", currentModel);
    updateModelDot();
  });

  /* Send */
  document.getElementById("sendBtn")?.addEventListener("click", sendPrompt);

  /* Ctrl+Enter */
  document.getElementById("promptInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendPrompt();
    }
  });

  /* Char counter */
  document.getElementById("promptInput")?.addEventListener("input", (e) => {
    updateCharCount(e.target.value.length);
  });

  /* Clear input */
  document.getElementById("clearInputBtn")?.addEventListener("click", () => {
    const ta = document.getElementById("promptInput");
    if (ta) { ta.value = ""; ta.focus(); updateCharCount(0); }
  });

  /* Copy response */
  document.getElementById("copyRespBtn")?.addEventListener("click", copyResponse);

  /* Clear history */
  document.getElementById("clearHistBtn")?.addEventListener("click", clearHistory);
}

function updateCharCount(len) {
  const el = document.getElementById("charHint");
  if (el) el.textContent = len > 0 ? `${len} / 2000` : "Ctrl+Enter ile gönder";
}

/* ══════════════════════════════════════════════
   GEMINI API
══════════════════════════════════════════════ */
async function sendPrompt(retryText) {
  if (isLoading) return;

  const apiKey = getApiKey();
  const text   = typeof retryText === "string"
    ? retryText
    : document.getElementById("promptInput")?.value.trim();

  if (!apiKey) {
    showError("Önce Gemini API key'inizi girin ve Kaydet butonuna basın.", false);
    return;
  }
  if (!text) {
    document.getElementById("promptInput")?.focus();
    return;
  }

  lastPrompt = text;
  isLoading  = true;
  setLoading(true);

  const prompt = MODES[currentMode].systemPrompt(text);

  try {
    const res = await fetch(`${geminiUrl(currentModel)}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:     0.7,
          maxOutputTokens: 8192,
          topP:            0.95,
        },
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData?.error?.message || `HTTP ${res.status}`;

      if (res.status === 503) {
        showError(
          `Gemini sunucusu şu an meşgul (503). Birkaç saniye bekleyip tekrar deneyin.`,
          true
        );
      } else if (res.status === 400) {
        showError(`API hatası: ${msg} — API key'inizi kontrol edin.`, false);
      } else {
        showError(`Sunucu hatası (${res.status}): ${msg}`, true);
      }
      return;
    }

    const data   = await res.json();
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!answer) {
      const reason = data?.candidates?.[0]?.finishReason || "bilinmiyor";
      showError(`Yanıt alınamadı. Neden: ${reason}`, true);
      return;
    }

    wordCount = answer.trim().split(/\s+/).length;
    showResponse(answer);
    addToHistory(text, answer, currentMode);

    const ta = document.getElementById("promptInput");
    if (ta) { ta.value = ""; updateCharCount(0); }

  } catch (err) {
    showError(`Bağlantı hatası: ${err.message}. İnternet bağlantınızı kontrol edin.`, true);
  } finally {
    isLoading = false;
    setLoading(false);
  }
}

/* ══════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════ */
function setLoading(on) {
  const sendBtn = document.getElementById("sendBtn");
  const loading = document.getElementById("responseLoading");
  const empty   = document.getElementById("responseEmpty");
  const dot     = document.getElementById("respDot");

  if (sendBtn) {
    sendBtn.disabled = on;
    sendBtn.innerHTML = on
      ? `<div class="loading-dots" style="gap:3px"><span></span><span></span><span></span></div>`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Gönder`;
  }
  if (loading) loading.style.display = on ? "flex" : "none";
  if (on && empty) empty.style.display = "none";
  if (dot) dot.classList.toggle("active", on);
}

function showResponse(text) {
  document.getElementById("responseEmpty").style.display   = "none";
  document.getElementById("responseLoading").style.display = "none";
  document.getElementById("responseError").style.display   = "none";
  document.getElementById("respDot").classList.remove("active");

  const content = document.getElementById("responseContent");
  const textEl  = document.getElementById("responseText");
  const footer  = document.getElementById("responseFooter");
  const meta    = document.getElementById("responseMeta");

  textEl.innerHTML = renderMarkdown(text);
  content.style.display = "block";
  if (footer) footer.style.display = "flex";
  if (meta)   meta.textContent = `${wordCount} kelime · ${currentModel}`;

  const body = document.getElementById("responseBodyEl");
  if (body) body.scrollTop = 0;
}

function showError(msg, canRetry = true) {
  document.getElementById("responseEmpty").style.display   = "none";
  document.getElementById("responseLoading").style.display = "none";
  document.getElementById("respDot").classList.remove("active");

  const errBox  = document.getElementById("responseError");
  const errText = document.getElementById("errorText");
  const retryBtn = document.getElementById("retryBtn");

  if (errText)  errText.textContent = msg;
  if (retryBtn) retryBtn.style.display = canRetry ? "inline-flex" : "none";
  if (errBox)   errBox.style.display = "flex";
}

/* ══════════════════════════════════════════════
   MARKDOWN RENDERER
══════════════════════════════════════════════ */
function renderMarkdown(raw) {
  const esc = s => s
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  const lines = raw.split("\n");
  let html    = "";
  let inCode  = false;
  let codeBuffer = "";

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.trim().startsWith("```")) {
      if (!inCode) { inCode = true; codeBuffer = ""; continue; }
      else { inCode = false; html += `<code class="r-block-code">${esc(codeBuffer.trimEnd())}</code>`; codeBuffer = ""; continue; }
    }
    if (inCode) { codeBuffer += esc(line) + "\n"; continue; }

    if (/^#{1,3}\s/.test(line)) {
      html += `<span class="r-h">${applyInline(esc(line.replace(/^#{1,3}\s*/, "")))}</span>`;
      continue;
    }

    if (/^[\*\-]\s/.test(line.trim())) {
      html += `<div class="r-li"><span class="r-li-bullet">›</span><span>${applyInline(esc(line.trim().replace(/^[\*\-]\s/, "")))}</span></div>`;
      continue;
    }

    if (/^\d+\.\s/.test(line.trim())) {
      const m = line.trim().match(/^(\d+)\.\s(.*)/);
      if (m) {
        html += `<div class="r-li"><span class="r-li-bullet">${esc(m[1])}.</span><span>${applyInline(esc(m[2]))}</span></div>`;
        continue;
      }
    }

    if (/^---+$/.test(line.trim())) {
      html += `<hr class="r-separator">`;
      continue;
    }

    if (!line.trim()) {
      html += `<div style="height:6px"></div>`;
      continue;
    }

    html += `<span class="r-p">${applyInline(esc(line))}</span>`;
  }

  return html;
}

function applyInline(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, `<strong class="r-bold">$1</strong>`)
    .replace(/\*([^*]+)\*/g,     `<em class="r-italic">$1</em>`)
    .replace(/`([^`]+)`/g,       `<code class="r-code">$1</code>`);
}

/* ── Kopyala ── */
async function copyResponse() {
  const el  = document.getElementById("responseText");
  const btn = document.getElementById("copyRespBtn");
  if (!el || !btn) return;
  const plain = el.innerText;
  try {
    await navigator.clipboard.writeText(plain);
    btn.textContent = "✓ Kopyalandı";
    btn.classList.add("success");
    setTimeout(() => {
      btn.textContent = "Kopyala";
      btn.classList.remove("success");
    }, 2000);
  } catch { /* pass */ }
}

/* ══════════════════════════════════════════════
   GEÇMİŞ
══════════════════════════════════════════════ */
function addToHistory(question, answer, mode) {
  let hist = loadHistory();
  hist = hist.filter(h => !(h.question === question && h.mode === mode));
  hist.unshift({ question, answer, mode, model: currentModel, time: Date.now() });
  if (hist.length > MAX_HISTORY) hist = hist.slice(0, MAX_HISTORY);
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
  renderHistory();
}

function loadHistory() {
  try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function renderHistory() {
  const list  = document.getElementById("historyItems");
  const strip = document.getElementById("historyStrip");
  const hist  = loadHistory();

  if (!list || !strip) return;
  if (hist.length === 0) { strip.style.display = "none"; return; }
  strip.style.display = "block";
  list.innerHTML = "";

  hist.slice(0, 12).forEach(item => {
    const mode = MODES[item.mode] || MODES.serbest;
    const time = new Date(item.time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const el   = document.createElement("div");
    el.className = "history-item";
    el.innerHTML = `
      <span class="history-item-icon">${mode.icon}</span>
      <div class="history-item-body">
        <div class="history-item-q">${escHtml(item.question)}</div>
        <div class="history-item-meta">${mode.label} · ${item.model || ""} · ${time}</div>
      </div>
      <span class="history-item-arrow">›</span>
    `;
    el.addEventListener("click", () => {
      setMode(item.mode);
      const ta = document.getElementById("promptInput");
      if (ta) { ta.value = item.question; updateCharCount(item.question.length); }
      wordCount = item.answer.trim().split(/\s+/).length;
      showResponse(item.answer);
    });
    list.appendChild(el);
  });
}

function clearHistory() {
  sessionStorage.removeItem(HISTORY_KEY);
  const strip = document.getElementById("historyStrip");
  if (strip) strip.style.display = "none";
}

/* ── Retry butonunu bağla ── */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("retryBtn")?.addEventListener("click", () => {
    if (lastPrompt) sendPrompt(lastPrompt);
  });
});

function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}