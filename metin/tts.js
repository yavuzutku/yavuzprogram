/* ════════════════════════════════════════════════════════════
   tts.js  —  AlmancaPratik Sesli Okuma Modülü
   Web Speech API kullanır. Tüm metin veya seçili metin
   okunabilir. Durdurma, devam ettirme, sıfırlama desteklenir.
   ════════════════════════════════════════════════════════════ */

"use strict";

/* ──────────────────────────────────────────────────────────
   §1  DESTEK KONTROLÜ
   ────────────────────────────────────────────────────────── */
export const ttsSupported = "speechSynthesis" in window;

/* ──────────────────────────────────────────────────────────
   §2  DURUM
   ────────────────────────────────────────────────────────── */
const state = {
  utterance:  null,
  playing:    false,
  paused:     false,
  text:       "",
  rate:       1.0,
  pitch:      1.0,
  voice:      null,       // SpeechSynthesisVoice
  onStateChange: null,    // (state) => void — dışarıdan bağlanır
};

/* Durum değişince UI'ı bildir */
function notify() {
  state.onStateChange?.({
    playing: state.playing,
    paused:  state.paused,
    text:    state.text,
  });
}

/* ──────────────────────────────────────────────────────────
   §3  SES LİSTESİ — Almanca sesi öncelikle seç
   ────────────────────────────────────────────────────────── */

/**
 * Mevcut sesleri döndürür. Tarayıcıya bağlı olarak async yüklenir.
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
export function getVoices() {
  return new Promise(resolve => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) { resolve(voices); return; }
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      resolve(window.speechSynthesis.getVoices());
    }, { once: true });
  });
}

/**
 * Almanca sesler (de-DE / de-AT / de-CH) arasından en iyisini seçer.
 * Bulamazsa varsayılan sesi döndürür.
 * @returns {Promise<SpeechSynthesisVoice|null>}
 */
export async function getBestGermanVoice() {
  const voices = await getVoices();

  // Önce yerel (localService) Almanca ses
  const localDE = voices.find(v => v.lang.startsWith("de") && v.localService);
  if (localDE) return localDE;

  // Sonra herhangi bir Almanca
  const anyDE = voices.find(v => v.lang.startsWith("de"));
  if (anyDE) return anyDE;

  // Fallback: varsayılan
  return voices.find(v => v.default) ?? voices[0] ?? null;
}

/* ──────────────────────────────────────────────────────────
   §4  OYNATMA KONTROLÜ
   ────────────────────────────────────────────────────────── */

/**
 * Metni sesli oku.
 * @param {string} text       - okunacak metin
 * @param {{ rate?: number, pitch?: number, voice?: SpeechSynthesisVoice }} opts
 */
export async function speak(text, opts = {}) {
  if (!ttsSupported) return;

  stop(); // Varsa önceki okumayı durdur

  const cleanedText = text.trim();
  if (!cleanedText) return;

  state.text  = cleanedText;
  state.rate  = opts.rate  ?? state.rate;
  state.pitch = opts.pitch ?? state.pitch;
  state.voice = opts.voice ?? state.voice ?? await getBestGermanVoice();

  const utt = new SpeechSynthesisUtterance(cleanedText);
  utt.lang  = "de-DE";
  utt.rate  = state.rate;
  utt.pitch = state.pitch;
  if (state.voice) utt.voice = state.voice;

  utt.onstart = () => {
    state.playing = true;
    state.paused  = false;
    notify();
  };

  utt.onend = () => {
    state.playing = false;
    state.paused  = false;
    state.utterance = null;
    notify();
  };

  utt.onerror = (e) => {
    // "interrupted" hatası durdurma/sıfırlamadan gelir, normal
    if (e.error === "interrupted" || e.error === "canceled") return;
    console.warn("[tts] Konuşma hatası:", e.error);
    state.playing = false;
    state.paused  = false;
    notify();
  };

  utt.onpause = () => {
    state.paused = true;
    notify();
  };

  utt.onresume = () => {
    state.paused = false;
    notify();
  };

  state.utterance = utt;
  window.speechSynthesis.speak(utt);
}

/** Durakla / Devam et */
export function togglePause() {
  if (!ttsSupported) return;
  if (state.paused) {
    window.speechSynthesis.resume();
  } else {
    window.speechSynthesis.pause();
  }
}

/** Durdur ve sıfırla */
export function stop() {
  if (!ttsSupported) return;
  window.speechSynthesis.cancel();
  state.playing   = false;
  state.paused    = false;
  state.utterance = null;
  notify();
}

/** Hız ayarla (oynarken de geçerli olur — yeniden başlatır) */
export async function setRate(rate) {
  state.rate = rate;
  if (state.playing && state.text) {
    await speak(state.text, { rate });
  }
}

/* ──────────────────────────────────────────────────────────
   §5  DURUM OKUMA
   ────────────────────────────────────────────────────────── */
export function isPlaying() { return state.playing; }
export function isPaused()  { return state.paused; }
export function getRate()   { return state.rate; }

/**
 * Durum değişimi callback'i bağla.
 * @param {Function} cb - ({ playing, paused, text }) => void
 */
export function onStateChange(cb) { state.onStateChange = cb; }