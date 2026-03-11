import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
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
   AUTH
============================= */

export function loginWithGoogle(){
  return signInWithPopup(auth, provider);
}

export function logoutFirebase(){
  return signOut(auth);
}

export function onAuthChange(callback){
  return onAuthStateChanged(auth, callback);
}


/* ============================
   METİN KAYDET
============================= */

export async function saveMetin(userId, text){
  if (!userId) throw new Error("Kullanıcı kimliği bulunamadı.");
  if (!text || text.trim().length === 0) throw new Error("Metin boş olamaz.");

  try {
    await addDoc(
      collection(db, "users", userId, "texts"),
      {
        text: text.trim(),
        created: Date.now()
      }
    );
  } catch (err) {
    console.error("[saveMetin] Firestore hatası:", err);
    throw new Error("Metin kaydedilemedi. Lütfen tekrar dene.");
  }
}


/* ============================
   METİNLERİ GETİR
============================= */

export async function getMetinler(userId){
  if (!userId) throw new Error("Kullanıcı kimliği bulunamadı.");

  try {
    const q = query(
      collection(db, "users", userId, "texts"),
      orderBy("created", "desc")
    );
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });
    return list;
  } catch (err) {
    console.error("[getMetinler] Firestore hatası:", err);
    throw new Error("Metinler yüklenemedi. Lütfen sayfayı yenile.");
  }
}


/* ============================
   METİN SİL
============================= */

export async function deleteMetin(userId, id){
  if (!userId || !id) throw new Error("Geçersiz parametre.");

  try {
    await deleteDoc(
      doc(db, "users", userId, "texts", id)
    );
  } catch (err) {
    console.error("[deleteMetin] Firestore hatası:", err);
    throw new Error("Metin silinemedi. Lütfen tekrar dene.");
  }
}


/* ============================
   KELİME KAYDET
============================= */

export async function saveWord(userId, word, meaning, tags = []){
  if (!userId) throw new Error("Kullanıcı kimliği bulunamadı.");
  if (!word || !meaning) throw new Error("Kelime ve anlam boş olamaz.");

  try {
    await addDoc(
      collection(db, "users", userId, "words"),
      {
        word:    word.trim(),
        meaning: meaning.trim(),
        tags:    Array.isArray(tags) ? tags : [],
        date:    new Date().toISOString(),
        created: Date.now()
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

export async function getWords(userId){
  if (!userId) throw new Error("Kullanıcı kimliği bulunamadı.");

  try {
    const q = query(
      collection(db, "users", userId, "words"),
      orderBy("created", "desc")
    );
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });
    return list;
  } catch (err) {
    console.error("[getWords] Firestore hatası:", err);
    throw new Error("Kelimeler yüklenemedi. Lütfen sayfayı yenile.");
  }
}


/* ============================
   KELİME SİL
============================= */

export async function deleteWord(userId, wordId){
  if (!userId || !wordId) throw new Error("Geçersiz parametre.");

  try {
    await deleteDoc(
      doc(db, "users", userId, "words", wordId)
    );
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

  try {
    const ref = doc(db, "users", userId, "words", wordId);
    await updateDoc(ref, data);
  } catch (err) {
    console.error("[updateWord] Firestore hatası:", err);
    throw new Error("Kelime güncellenemedi. Lütfen tekrar dene.");
  }
}