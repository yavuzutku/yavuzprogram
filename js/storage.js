/* =============================================
   STORAGE.JS
   Tüm IndexedDB işlemleri burada toplanır
   ============================================= */

const DB_NAME = "AlmancaApp";
const DB_VERSION = 1;
const STORE_NAME = "metinGecmisi";

/* =========================
   DB OPEN
========================= */

function openDB() {
  return new Promise((resolve, reject) => {

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {

      const db = e.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {

        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true
        });

        store.createIndex("tarih", "tarih", { unique: false });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);

    req.onerror = (e) => reject(e.target.error);
  });
}


/* =========================
   METİN KAYDET
========================= */

async function saveMetin(metin){

  const db = await openDB();

  return new Promise((resolve,reject)=>{

    const tx = db.transaction(STORE_NAME,"readwrite");

    const store = tx.objectStore(STORE_NAME);

    const req = store.add({
      metin:metin,
      tarih:new Date().toISOString()
    });

    req.onsuccess = ()=> resolve();

    req.onerror = (e)=> reject(e.target.error);

  });
}


/* =========================
   TÜM METİNLERİ GETİR
========================= */

async function getAllMetinler(){

  const db = await openDB();

  return new Promise((resolve,reject)=>{

    const tx = db.transaction(STORE_NAME,"readonly");

    const store = tx.objectStore(STORE_NAME);

    const index = store.index("tarih");

    const req = index.getAll();

    req.onsuccess = (e)=>{

      const data = e.target.result.reverse();

      resolve(data);

    };

    req.onerror = (e)=> reject(e.target.error);

  });

}


/* =========================
   TEK METİN SİL
========================= */

async function deleteMetin(id){

  const db = await openDB();

  return new Promise((resolve,reject)=>{

    const tx = db.transaction(STORE_NAME,"readwrite");

    const store = tx.objectStore(STORE_NAME);

    const req = store.delete(id);

    req.onsuccess = ()=> resolve();

    req.onerror = (e)=> reject(e.target.error);

  });

}


/* =========================
   TÜMÜNÜ SİL
========================= */

async function clearAllMetinler(){

  const db = await openDB();

  return new Promise((resolve,reject)=>{

    const tx = db.transaction(STORE_NAME,"readwrite");

    const store = tx.objectStore(STORE_NAME);

    const req = store.clear();

    req.onsuccess = ()=> resolve();

    req.onerror = (e)=> reject(e.target.error);

  });

}