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
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy
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
  return cred;
}

export async function loginWithEmail(email, password) {
  if (!email || !password)
    throw new Error("E-posta ve şifre zorunludur.");
  return signInWithEmailAndPassword(auth, email, password);
}

export async function resetPassword(email) {
  if (!email) throw new Error("E-posta adresi zorunludur.");
  return sendPasswordResetEmail(auth, email);
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


/* ============================
   YARDIMCI: KELİMEYİ BUL
   Büyük/küçük harf ve artikel farkını
   (der/die/das/ein/eine) görmezden gelir.
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
   AKILLI KAYDET  ← ANA FONKSİYON
   ─────────────────────────────
   Aynı Almanca kelime sözlükte zaten
   varsa yeni anlam mevcut kelimeye eklenir.
   Yoksa yeni belge oluşturulur.

   Dönüş değeri:
   {
     merged:  boolean,  // true → ek anlam olarak eklendi
     already: boolean,  // true → hem kelime hem anlam zaten vardı
     word:    string,   // kaydedilen kelime adı
     meaning: string,   // kaydedilen anlam
   }
============================= */

export async function saveWordOrAddMeaning(userId, word, meaning, tags = []) {
  if (!userId)  throw new Error("Kullanıcı kimliği bulunamadı.");
  if (!word)    throw new Error("Kelime boş olamaz.");
  if (!meaning) throw new Error("Anlam boş olamaz.");

  const wordTrimmed    = word.trim();
  const meaningTrimmed = meaning.trim();

  const existing = await getWords(userId);
  const match    = findExistingWord(existing, wordTrimmed);

  /* ── Kelime zaten var ── */
  if (match) {
    const currentMeanings = Array.isArray(match.meanings) && match.meanings.length
      ? match.meanings
      : [match.meaning];

    /* Anlam da zaten ekli mi? (büyük/küçük harf farkı yok) */
    const alreadyHas = currentMeanings.some(
      m => m.trim().toLowerCase() === meaningTrimmed.toLowerCase()
    );
    if (alreadyHas) {
      return { merged: false, already: true, word: match.word, meaning: meaningTrimmed };
    }

    /* Yeni anlamı diziye ekle */
    const updatedMeanings = [...currentMeanings, meaningTrimmed];

    /* Etiketleri birleştir */
    const existingTags = Array.isArray(match.tags) ? match.tags : [];
    const mergedTags   = [...new Set([...existingTags, ...tags])];

    try {
      await updateDoc(doc(db, "users", userId, "words", match.id), {
        meanings: updatedMeanings,
        meaning:  updatedMeanings[0],  /* ana anlam değişmez */
        tags:     mergedTags,
      });
    } catch (err) {
      console.error("[saveWordOrAddMeaning] updateDoc hatası:", err);
      throw new Error("Anlam eklenemedi. Lütfen tekrar dene.");
    }

    return { merged: true, already: false, word: match.word, meaning: meaningTrimmed };
  }

  /* ── Kelime yok → yeni belge ── */
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
   Geriye dönük uyumluluk.
   Yeni kodlarda saveWordOrAddMeaning kullan.
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