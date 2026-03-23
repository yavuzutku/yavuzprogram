import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, deleteDoc,
  updateDoc, doc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ============================
   LİSTE OLUŞTUR
============================= */
export async function saveListe(userId, name, wordIds, description = "") {
  if (!userId)        throw new Error("Kullanıcı kimliği bulunamadı.");
  if (!name?.trim())  throw new Error("Liste adı boş olamaz.");
  if (!wordIds?.length) throw new Error("Lütfen en az bir kelime seç.");

  const ref = await addDoc(collection(db, "users", userId, "lists"), {
    name:        name.trim(),
    description: description.trim(),
    wordIds:     [...wordIds],
    wordCount:   wordIds.length,
    created:     Date.now(),
    updated:     Date.now(),
  });
  return ref.id;
}

/* ============================
   TÜM LİSTELERİ GETİR
============================= */
export async function getListeler(userId) {
  if (!userId) throw new Error("Kullanıcı kimliği bulunamadı.");
  const q = query(
    collection(db, "users", userId, "lists"),
    orderBy("created", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ============================
   LİSTE SİL
============================= */
export async function deleteListe(userId, listeId) {
  if (!userId || !listeId) throw new Error("Geçersiz parametre.");
  await deleteDoc(doc(db, "users", userId, "lists", listeId));
}

/* ============================
   LİSTE GÜNCELLE
============================= */
export async function updateListe(userId, listeId, data) {
  if (!userId || !listeId) throw new Error("Geçersiz parametre.");
  await updateDoc(doc(db, "users", userId, "lists", listeId), {
    ...data,
    updated: Date.now(),
  });
}