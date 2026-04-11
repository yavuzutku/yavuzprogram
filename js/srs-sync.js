/**
 * srs-sync.js
 * ─────────────────────────────────────────────────────────────
 * Flashcard sayfalarında kullanılacak SRS senkronizasyon katmanı.
 *
 * NASIL ÇALIŞIR:
 *   1. Kullanıcı giriş yapmışsa Firestore'dan SRS verisi çekilir.
 *   2. localStorage'da daha yeni veri varsa (ilk cihaz) Firestore'a yüklenir.
 *   3. Her kart değerlendirmesinde hem localStorage hem Firestore güncellenir.
 *   4. Çevrimdışıyken sadece localStorage çalışır; tekrar bağlanınca senkronize olur.
 *
 * KULLANIM (flashcard sayfanızda):
 *   import { SRSSync } from "../js/srs-sync.js";
 *
 *   const srs = new SRSSync(userId);
 *   await srs.init();                         // sayfа yüklenince
 *   const cardData = srs.get(wordId);         // kart verisi oku
 *   await srs.save(wordId, updatedData);      // kart değerlendirmesi sonrası
 * ─────────────────────────────────────────────────────────────
 */

import {
  getSRSCards,
  saveSRSCard,
  batchSaveSRSCards,
  deleteSRSCard
} from "./firebase.js";

// ─── localStorage anahtar şablonu ──────────────────────────────
const LS_KEY = (uid) => `srs_v2_${uid}`;

// ─── Varsayılan SM-2 kart değerleri ────────────────────────────
export function defaultCard() {
  return {
    interval:    0,
    repetitions: 0,
    easeFactor:  2.5,
    nextReview:  Date.now(),
    lastReview:  null,
  };
}

export class SRSSync {
  /**
   * @param {string|null} userId  — null ise yalnızca localStorage modu
   */
  constructor(userId) {
    this._uid    = userId;
    this._cache  = {};   // { wordId: srsData }
    this._dirty  = new Set();  // henüz Firestore'a yazılmamış wordId'ler
    this._ready  = false;
    this._online = navigator.onLine;

    // Çevrimiçi durumu izle — bağlantı geri gelince bekleyen yazıları gönder
    window.addEventListener("online",  () => { this._online = true;  this._flushDirty(); });
    window.addEventListener("offline", () => { this._online = false; });
  }

  /* ──────────────────────────────────────────────────────────
     init() — sayfа yüklendiğinde bir kez çağır
  ────────────────────────────────────────────────────────── */
  async init() {
    const local = this._loadLocal();

    if (!this._uid) {
      // Giriş yapılmamış → sadece localStorage
      this._cache = local;
      this._ready = true;
      return;
    }

    try {
      const remote = await getSRSCards(this._uid);

      // Birleştirme: her kelime için daha yeni olan veriyi kullan
      const merged = { ...local };
      for (const [wordId, remoteCard] of Object.entries(remote)) {
        const localCard = local[wordId];
        if (!localCard || this._isNewer(remoteCard, localCard)) {
          merged[wordId] = remoteCard;
        }
      }

      // localStorage'da olup Firestore'da olmayan veriler → Firestore'a yükle
      const localOnly = {};
      for (const [wordId, localCard] of Object.entries(local)) {
        if (!remote[wordId]) localOnly[wordId] = localCard;
      }
      if (Object.keys(localOnly).length > 0) {
        await batchSaveSRSCards(this._uid, localOnly).catch(() => {});
      }

      this._cache = merged;
      this._saveLocal(merged);

    } catch (err) {
      // Firestore erişilemez → localStorage ile devam et
      console.warn("[SRSSync] Firestore erişilemedi, localStorage kullanılıyor:", err.message);
      this._cache = local;
    }

    this._ready = true;
  }

  /* ──────────────────────────────────────────────────────────
     get(wordId) — kart verisini oku (yoksa varsayılan döner)
  ────────────────────────────────────────────────────────── */
  get(wordId) {
    return this._cache[wordId] ? { ...this._cache[wordId] } : defaultCard();
  }

  /* ──────────────────────────────────────────────────────────
     getAll() — tüm cache'i döner
  ────────────────────────────────────────────────────────── */
  getAll() {
    return { ...this._cache };
  }

  /* ──────────────────────────────────────────────────────────
     save(wordId, srsData) — kart değerlendirmesi sonrası çağır
  ────────────────────────────────────────────────────────── */
  async save(wordId, srsData) {
    const payload = { ...srsData, lastReview: Date.now() };
    this._cache[wordId] = payload;
    this._saveLocal(this._cache);

    if (!this._uid) return;

    if (this._online) {
      try {
        await saveSRSCard(this._uid, wordId, payload);
      } catch {
        this._dirty.add(wordId);
      }
    } else {
      this._dirty.add(wordId);
    }
  }

  /* ──────────────────────────────────────────────────────────
     remove(wordId) — kelime silinince SRS verisini de temizle
  ────────────────────────────────────────────────────────── */
  async remove(wordId) {
    delete this._cache[wordId];
    this._dirty.delete(wordId);
    this._saveLocal(this._cache);

    if (this._uid) {
      await deleteSRSCard(this._uid, wordId).catch(() => {});
    }
  }

  /* ──────────────────────────────────────────────────────────
     İÇ YARDIMCILAR
  ────────────────────────────────────────────────────────── */

  _loadLocal() {
    if (!this._uid) return {};
    try {
      const raw = localStorage.getItem(LS_KEY(this._uid));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  _saveLocal(data) {
    if (!this._uid) return;
    try {
      localStorage.setItem(LS_KEY(this._uid), JSON.stringify(data));
    } catch (e) {
      console.warn("[SRSSync] localStorage yazma hatası:", e.message);
    }
  }

  _isNewer(a, b) {
    // updatedAt serverTimestamp olabilir; lastReview ile karşılaştır
    const aTime = a.lastReview ?? 0;
    const bTime = b.lastReview ?? 0;
    return aTime > bTime;
  }

  async _flushDirty() {
    if (!this._uid || !this._dirty.size) return;
    const toFlush = {};
    this._dirty.forEach(id => {
      if (this._cache[id]) toFlush[id] = this._cache[id];
    });
    try {
      await batchSaveSRSCards(this._uid, toFlush);
      this._dirty.clear();
    } catch {
      // Bir sonraki online event'te tekrar denenecek
    }
  }

  /* ──────────────────────────────────────────────────────────
     SM-2 ALGORİTMASI (kolaylık için buraya dahil)
     rating: 0=Tekrar, 1=Zor, 2=İyi, 3=Kolay
  ────────────────────────────────────────────────────────── */
  static sm2(card, rating) {
    let { interval, repetitions, easeFactor } = {
      interval:    card.interval    ?? 0,
      repetitions: card.repetitions ?? 0,
      easeFactor:  card.easeFactor  ?? 2.5,
    };

    if (rating < 1) {
      // Tekrar — sıfırla
      interval    = 1;
      repetitions = 0;
    } else {
      if (repetitions === 0)      interval = 1;
      else if (repetitions === 1) interval = 3;
      else                        interval = Math.round(interval * easeFactor);

      // Kolay bonusu
      if (rating === 3) interval = Math.round(interval * 1.3);

      repetitions += 1;

      // Ease factor güncelle
      const delta = 0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02);
      easeFactor  = Math.max(1.3, easeFactor + delta);
    }

    const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;
    return { interval, repetitions, easeFactor, nextReview };
  }
}