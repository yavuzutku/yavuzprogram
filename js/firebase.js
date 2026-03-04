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
  await addDoc(
    collection(db, "users", userId, "texts"),
    {
      text: text,
      created: Date.now()
    }
  );
}


/* ============================
   METİNLERİ GETİR
============================= */

export async function getMetinler(userId){
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
}


/* ============================
   METİN SİL
============================= */

export async function deleteMetin(userId, id){
  await deleteDoc(
    doc(db, "users", userId, "texts", id)
  );
}