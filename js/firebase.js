import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, updateDoc,
  doc, query, orderBy, writeBatch,
  setDoc, serverTimestamp   // ← YENİ
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCGpRMUNNSx4Kla2YrmDOBHlLSt4rOM1wQ",
  authDomain: "lernen-deutsch-bea69.firebaseapp.com",
  projectId: "lernen-deutsch-bea69",
  storageBucket: "lernen-deutsch-bea69.firebasestorage.app",
  messagingSenderId: "653560965391",
  appId: "1:653560965391:web:545142e9be6d130a54b67a",
  measurementId: "G-X1RF550PTV"
};

const app      = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

const provider = new GoogleAuthProvider();

/* ============================
   AUTH — GOOGLE
============================= */

export function loginWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function logoutFirebase() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/* ============================
   AUTH — EMAIL / ŞİFRE
============================= */

export async function registerWithEmail(email, password, displayName) {
  if (!email || !password || !displayName)
    throw new Error("Ad, e-posta ve şifre zorunludur.");
  if (password.length < 6)
    throw new Error("Şifre en az 6 karakter olmalıdır.");

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await sendEmailVerification(cred.user);
  await signOut(auth); // Kayıt sonrası oturumu kapat — doğrulama zorunlu
  return cred;
}

export async function loginWithEmail(email, password) {
  if (!email || !password)
    throw new Error("E-posta ve şifre zorunludur.");

  const cred = await signInWithEmailAndPassword(auth, email, password);
  await cred.user.reload();

  if (!cred.user.emailVerified) {
    await signOut(auth);
    throw new Error("Lütfen e-posta adresini doğrula!");
  }

  return cred;
}

export async function resetPassword(email) {
  if (!email) throw new Error("E-posta adresi zorunludur.");
  return sendPasswordResetEmail(auth, email);
}

export async function sendVerificationEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(cred.user);
  await signOut(auth); // Mail gönder ama oturumu açma
}

/* ============================
   METİN KAYDET
============================= */

export async function saveMetin(userId, text) {
  if (!userId) throw new Error("Kullanıcı kimliği bulunamadı.");
  if (!text || text.trim().length === 0) throw new Error("Metin boş olamaz.");
  try {
    await addDoc(
      collection(db, "users", userId, "texts"),
      { text: text.trim(), created: Date.now() }
    );
  } catch (err) {
    console.error("[saveMetin] Firestore hatası:", err);
    throw new Error("Metin kaydedilemedi. Lütfen tekrar dene.");
  }
}

/* ============================
   METİNLERİ GETİR
============================= */

export async function getMetinler(userId) {
  if (!userId) throw new Error("Kullanıcı kimliği bulunamadı.");
  try {
    const q = query(
      collection(db, "users", userId, "texts"),
      orderBy("created", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("[getMetinler] Firestore hatası:", err);
    throw new Error("Metinler yüklenemedi. Lütfen sayfayı yenile.");
  }
}

/* ============================
   METİN SİL
============================= */

export async function deleteMetin(userId, id) {
  if (!userId || !id) throw new Error("Geçersiz parametre.");
  try {
    await deleteDoc(doc(db, "users", userId, "texts", id));
  } catch (err) {
    console.error("[deleteMetin] Firestore hatası:", err);
    throw new Error("Metin silinemedi. Lütfen tekrar dene.");
  }
}

export async function updateMetinTimestamp(userId, id) {
  if (!userId || !id) throw new Error("Geçersiz parametre.");
  try {
    await updateDoc(doc(db, "users", userId, "texts", id), {
      created: Date.now()
    });
  } catch (err) {
    console.error("[updateMetinTimestamp] Firestore hatası:", err);
    throw new Error("Tarih güncellenemedi.");
  }
}

/* ============================
   YARDIMCI: KELİMEYİ BUL
============================= */

function normalizeForMatch(word) {
  return String(word ?? "")
    .trim()
    .toLowerCase()
    .replace(/^(der|die|das|ein|eine)\s+/i, "");
}

export function findExistingWord(wordList, germanWord) {
  const needle = normalizeForMatch(germanWord);
  return wordList.find(w => normalizeForMatch(w.word) === needle) || null;
}

/* ============================
   AKILLI KAYDET
============================= */

export async function saveWordOrAddMeaning(userId, word, meaning, tags = []) {
  if (!userId)  throw new Error("Kullanıcı kimliği bulunamadı.");
  if (!word)    throw new Error("Kelime boş olamaz.");
  if (!meaning) throw new Error("Anlam boş olamaz.");

  const wordTrimmed    = word.trim();
  const meaningTrimmed = meaning.trim();

  const existing = await getWords(userId);
  const match    = findExistingWord(existing, wordTrimmed);

  if (match) {
    const currentMeanings = Array.isArray(match.meanings) && match.meanings.length
      ? match.meanings
      : [match.meaning];

    const alreadyHas = currentMeanings.some(
      m => m.trim().toLowerCase() === meaningTrimmed.toLowerCase()
    );
    if (alreadyHas) {
      return { merged: false, already: true, word: match.word, meaning: meaningTrimmed };
    }

    const updatedMeanings = [...currentMeanings, meaningTrimmed];
    const existingTags    = Array.isArray(match.tags) ? match.tags : [];
    const mergedTags      = [...new Set([...existingTags, ...tags])];

    try {
      await updateDoc(doc(db, "users", userId, "words", match.id), {
        meanings: updatedMeanings,
        meaning:  updatedMeanings[0],
        tags:     mergedTags,
      });
    } catch (err) {
      console.error("[saveWordOrAddMeaning] updateDoc hatası:", err);
      throw new Error("Anlam eklenemedi. Lütfen tekrar dene.");
    }

    return { merged: true, already: false, word: match.word, meaning: meaningTrimmed };
  }

  try {
    await addDoc(
      collection(db, "users", userId, "words"),
      {
        word:     wordTrimmed,
        meaning:  meaningTrimmed,
        meanings: [meaningTrimmed],
        tags:     Array.isArray(tags) ? tags : [],
        date:     new Date().toISOString(),
        created:  Date.now(),
      }
    );
  } catch (err) {
    console.error("[saveWordOrAddMeaning] addDoc hatası:", err);
    throw new Error("Kelime kaydedilemedi. Lütfen tekrar dene.");
  }

  return { merged: false, already: false, word: wordTrimmed, meaning: meaningTrimmed };
}

/* ============================
   KELİME KAYDET (eski API)
============================= */

export async function saveWord(userId, word, meaning, tags = [], meanings = []) {
  if (!userId) throw new Error("Kullanıcı kimliği bulunamadı.");
  if (!word || !meaning) throw new Error("Kelime ve anlam boş olamaz.");

  const normalizedMeanings = meanings.length > 0 ? meanings : [meaning.trim()];
  const primaryMeaning     = normalizedMeanings[0];

  try {
    await addDoc(
      collection(db, "users", userId, "words"),
      {
        word:     word.trim(),
        meaning:  primaryMeaning,
        meanings: normalizedMeanings,
        tags:     Array.isArray(tags) ? tags : [],
        date:     new Date().toISOString(),
        created:  Date.now(),
      }
    );
  } catch (err) {
    console.error("[saveWord] Firestore hatası:", err);
    throw new Error("Kelime kaydedilemedi. Lütfen tekrar dene.");
  }
}

/* ============================
   KELİMELERİ GETİR
============================= */

export async function getWords(userId) {
  if (!userId) throw new Error("Kullanıcı kimliği bulunamadı.");
  try {
    const q = query(
      collection(db, "users", userId, "words"),
      orderBy("created", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = d.data();
      if (!Array.isArray(data.meanings) || data.meanings.length === 0) {
        data.meanings = data.meaning ? [data.meaning] : [];
      }
      return { id: d.id, ...data };
    });
  } catch (err) {
    console.error("[getWords] Firestore hatası:", err);
    throw new Error("Kelimeler yüklenemedi. Lütfen sayfayı yenile.");
  }
}

/* ============================
   KELİME SİL
============================= */

export async function deleteWord(userId, wordId) {
  if (!userId || !wordId) throw new Error("Geçersiz parametre.");
  try {
    await deleteDoc(doc(db, "users", userId, "words", wordId));
  } catch (err) {
    console.error("[deleteWord] Firestore hatası:", err);
    throw new Error("Kelime silinemedi. Lütfen tekrar dene.");
  }
}

/* ============================
   KELİME GÜNCELLE
============================= */

export async function updateWord(userId, wordId, data) {
  if (!userId || !wordId) throw new Error("Geçersiz parametre.");
  const payload = { ...data };
  if (Array.isArray(payload.meanings) && payload.meanings.length > 0) {
    payload.meaning = payload.meanings[0];
  }
  if (payload.meaning && !payload.meanings) {
    payload.meanings = [payload.meaning];
  }
  try {
    await updateDoc(doc(db, "users", userId, "words", wordId), payload);
  } catch (err) {
    console.error("[updateWord] Firestore hatası:", err);
    throw new Error("Kelime güncellenemedi. Lütfen tekrar dene.");
  }
}

/* ============================
   TOPLU KELİME SİL (Batch)
============================= */

export async function batchDeleteWords(userId, wordIds, onProgress) {
  if (!userId || !wordIds?.length) throw new Error("Geçersiz parametre.");

  const BATCH_SIZE = 499; // Firestore limiti 500, güvenli tarafta kalıyoruz
  let deleted = 0;

  for (let i = 0; i < wordIds.length; i += BATCH_SIZE) {
    const chunk = wordIds.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(id => {
      batch.delete(doc(db, "users", userId, "words", id));
    });
    try {
      await batch.commit();
    } catch (err) {
      console.error("[batchDeleteWords] batch.commit hatası:", err);
      throw new Error("Toplu silme sırasında hata oluştu.");
    }
    deleted += chunk.length;
    if (typeof onProgress === "function") onProgress(deleted, wordIds.length);
  }
}
// ============================================================
//  Bu bloğu mevcut firebase.js dosyanın EN ALTINA ekle
//  (import'lar zaten dosyanın başında mevcut — tekrar ekleme)
// ============================================================

// Firestore import'larına şunları da eklemen gerekiyor (henüz yoksa):
//   setDoc, getDoc, serverTimestamp
// Mevcut import satırını şöyle güncelle:
//
// import {
//   getFirestore, collection, addDoc, getDocs, deleteDoc, updateDoc,
//   doc, query, orderBy, writeBatch,
//   setDoc, getDoc, serverTimestamp          // ← YENİ
// } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
//
// ============================================================

/* ============================
   SRS — TEK KART KAYDET
   srsData = { interval, repetitions, easeFactor, nextReview, lastReview }
============================= */
export async function saveSRSCard(userId, wordId, srsData) {
  if (!userId || !wordId) throw new Error("Geçersiz parametre.");
  try {
    await setDoc(
      doc(db, "users", userId, "srs", wordId),
      { ...srsData, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.error("[saveSRSCard] Firestore hatası:", err);
    throw new Error("SRS verisi kaydedilemedi.");
  }
}

/* ============================
   SRS — TÜM KARTLARI GETİR
   Döndürür: { wordId: { interval, repetitions, easeFactor, nextReview, lastReview }, … }
============================= */
export async function getSRSCards(userId) {
  if (!userId) throw new Error("Kullanıcı kimliği bulunamadı.");
  try {
    const snap = await getDocs(collection(db, "users", userId, "srs"));
    const result = {};
    snap.docs.forEach(d => { result[d.id] = d.data(); });
    return result;
  } catch (err) {
    console.error("[getSRSCards] Firestore hatası:", err);
    throw new Error("SRS verileri yüklenemedi.");
  }
}

/* ============================
   SRS — TOPLU KAYDET  (localStorage → Firestore ilk senkronizasyon için)
   cardsMap = { wordId: srsData, … }
============================= */
export async function batchSaveSRSCards(userId, cardsMap) {
  if (!userId || !cardsMap) throw new Error("Geçersiz parametre.");
  const entries = Object.entries(cardsMap);
  if (!entries.length) return;

  const BATCH_SIZE = 499;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(([wordId, srsData]) => {
      batch.set(
        doc(db, "users", userId, "srs", wordId),
        { ...srsData, updatedAt: serverTimestamp() },
        { merge: true }
      );
    });
    try {
      await batch.commit();
    } catch (err) {
      console.error("[batchSaveSRSCards] batch.commit hatası:", err);
      throw new Error("Toplu SRS kaydı sırasında hata oluştu.");
    }
  }
}

/* ============================
   SRS — TEK KART SİL (kelime silinince SRS verisini de temizle)
============================= */
export async function deleteSRSCard(userId, wordId) {
  if (!userId || !wordId) throw new Error("Geçersiz parametre.");
  try {
    await deleteDoc(doc(db, "users", userId, "srs", wordId));
  } catch (err) {
    console.error("[deleteSRSCard] Firestore hatası:", err);
    // Sessizce geç — SRS verisi olmaması kritik değil
  }
}