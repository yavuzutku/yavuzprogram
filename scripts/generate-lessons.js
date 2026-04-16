/**
 * generate-lessons.js
 * ───────────────────
 * Firebase'deki yayınlanmış dersleri çekip her biri için
 *   /dersler/{slug}/index.html
 * dosyası üretir. SEO paketli, tasarım uyumlu.
 *
 * Kullanım:
 *   node generate-lessons.js                        → sadece yayındaki dersler
 *   node generate-lessons.js --all                  → taslakları da üretir
 *   node generate-lessons.js --slug=almanca-renkler → tek ders
 */

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, collection, getDocs, query,
  orderBy, where
} from "firebase/firestore";
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ── Ayarlar ──────────────────────────────────────── */
const SITE_URL    = "https://almancapratik.com";
const SITE_NAME   = "AlmancaPratik";
const SITE_LOCALE = "tr_TR";

const firebaseConfig = {
  apiKey:            "AIzaSyCGpRMUNNSx4Kla2YrmDOBHlLSt4rOM1wQ",
  authDomain:        "lernen-deutsch-bea69.firebaseapp.com",
  projectId:         "lernen-deutsch-bea69",
  storageBucket:     "lernen-deutsch-bea69.firebasestorage.app",
  messagingSenderId: "653560965391",
  appId:             "1:653560965391:web:545142e9be6d130a54b67a"
};

/* ── Argümanlar ───────────────────────────────────── */
const args       = process.argv.slice(2);
const includeAll = args.includes("--all");
const singleSlug = args.find(a => a.startsWith("--slug="))?.split("=")[1];

/* ── Yollar ───────────────────────────────────────── */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");   // scripts/ → repo kökü
const OUT_DIR   = path.join(REPO_ROOT, "dersler"); // /dersler klasörü

/* ══════════════════════════════════════════════════
   HTML ŞABLONU
══════════════════════════════════════════════════ */
function buildHtml(lesson) {
  const slug        = lesson.slug || lesson.id;
  const title       = lesson.title || "Ders";
  const excerpt     = lesson.excerpt || stripHtml(lesson.content || "").slice(0, 155);
  const canonicalUrl = `${SITE_URL}/dersler/${slug}/`;
  const coverUrl    = lesson.coverUrl || "";
  const category    = lesson.category || "";

  /* Tarih */
  const rawDate = lesson.createdAt?._seconds
    ? new Date(lesson.createdAt._seconds * 1000)
    : new Date();
  const isoDate    = rawDate.toISOString();
  const prettyDate = rawDate.toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric"
  });

  /* Okuma süresi */
  const wordCount = wordCountText(lesson.content || "");
  const readMin   = Math.max(1, Math.round(wordCount / 200));

  /* Kategori badge */
  const catBadgeHtml = category
    ? `<span class="lesson-cat-badge" data-cat="${esc(category)}">${esc(category)}</span>`
    : "";

  /* Kapak görseli */
  const heroHtml = coverUrl
    ? `<img class="lesson-hero-img" src="${esc(coverUrl)}" alt="${esc(title)}" loading="eager">`
    : "";

  /* JSON-LD yapılandırılmış veri */
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": excerpt,
    ...(coverUrl ? { "image": coverUrl } : {}),
    "datePublished": isoDate,
    "dateModified": lesson.updatedAt?._seconds
      ? new Date(lesson.updatedAt._seconds * 1000).toISOString()
      : isoDate,
    "author": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL
    },
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": canonicalUrl
    },
    "inLanguage": "tr"
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- ── Birincil SEO ── -->
  <title>${esc(title)} — ${SITE_NAME}</title>
  <meta name="description" content="${esc(excerpt)}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="robots" content="index, follow">

  <!-- ── Open Graph ── -->
  <meta property="og:type"        content="article">
  <meta property="og:title"       content="${esc(title)}">
  <meta property="og:description" content="${esc(excerpt)}">
  <meta property="og:url"         content="${canonicalUrl}">
  <meta property="og:site_name"   content="${SITE_NAME}">
  <meta property="og:locale"      content="${SITE_LOCALE}">
  ${coverUrl ? `<meta property="og:image"     content="${esc(coverUrl)}">
  <meta property="og:image:alt"   content="${esc(title)}">` : ""}
  <meta property="article:published_time" content="${isoDate}">
  ${category ? `<meta property="article:section" content="${esc(category)}">` : ""}

  <!-- ── Twitter Card ── -->
  <meta name="twitter:card"        content="${coverUrl ? "summary_large_image" : "summary"}">
  <meta name="twitter:title"       content="${esc(title)}">
  <meta name="twitter:description" content="${esc(excerpt)}">
  ${coverUrl ? `<meta name="twitter:image" content="${esc(coverUrl)}">` : ""}

  <!-- ── JSON-LD ── -->
  <script type="application/ld+json">
${jsonLd}
  </script>

  <!-- ── Favicon ── -->
  <link rel="icon" href="/favicon.ico">

  <!-- ── Fontlar ── -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Mono:wght@400;500&family=Lora:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">

  <!-- ── Stiller ── -->
  <link rel="stylesheet" href="/css/global.css">
  <link rel="stylesheet" href="/dersler/lesson-static.css">
</head>
<body>

<!-- Arka plan dekorasyonu -->
<div class="bg-canvas" aria-hidden="true">
  <div class="bg-grid"></div>
  <div class="bg-glow bg-glow--1"></div>
  <div class="bg-glow bg-glow--2"></div>
</div>

<!-- Navbar -->
<script type="module">
  import "/js/core.js";
  window.loadNavbar?.();
</script>

<!-- ── Ana içerik ── -->
<main class="lesson-wrap">

  <nav class="lesson-nav-row" aria-label="Breadcrumb">
    <a class="lesson-back" href="/dersler/">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
      </svg>
      Tüm dersler
    </a>
  </nav>

  ${heroHtml}

  <div class="lesson-meta-row">
    ${catBadgeHtml}
    <time datetime="${isoDate}">${prettyDate}</time>
    <span class="lesson-card-dot" aria-hidden="true"></span>
    <span>${readMin} dk okuma</span>
  </div>

  <h1 class="lesson-heading">${esc(title)}</h1>

  <article class="lesson-body" id="lessonBody">
    ${lesson.content || ""}
  </article>

</main>

</body>
</html>`;
}

/* ══════════════════════════════════════════════════
   YARDIMCI FONKSİYONLAR
══════════════════════════════════════════════════ */
function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function wordCountText(t) {
  return stripHtml(t).split(/\s+/).filter(Boolean).length;
}

/* ══════════════════════════════════════════════════
   ANA AKIŞ
══════════════════════════════════════════════════ */
async function main() {
  console.log("🔥 Firebase'e bağlanıyor…");
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const db  = getFirestore(app);

  console.log("📚 Dersler alınıyor…");
  let q;
  if (singleSlug) {
    q = query(collection(db, "lessons"), where("slug", "==", singleSlug));
  } else if (includeAll) {
    q = query(collection(db, "lessons"), orderBy("createdAt", "desc"));
  } else {
    q = query(
      collection(db, "lessons"),
      where("published", "==", true),
      orderBy("createdAt", "desc")
    );
  }

  const snap    = await getDocs(q);
  const lessons = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (!lessons.length) {
    console.log("ℹ️  Ders bulunamadı. Çıkılıyor.");
    process.exit(0);
  }

  console.log(`✅ ${lessons.length} ders bulundu.\n`);

  let generated = 0;
  let skipped   = 0;

  for (const lesson of lessons) {
    const slug = lesson.slug || lesson.id;

    if (!slug) {
      console.warn(`  ⚠️  Slug eksik, atlandı: ${lesson.id}`);
      skipped++;
      continue;
    }

    /* Klasörü oluştur ve HTML yaz */
    const dir      = path.join(OUT_DIR, slug);
    const filePath = path.join(dir, "index.html");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, buildHtml(lesson), "utf8");

    console.log(`  ✓  /dersler/${slug}/index.html`);
    generated++;
  }

  console.log(`\n🎉 Tamamlandı! ${generated} dosya üretildi, ${skipped} atlandı.`);
  console.log(`📁 Çıktı: ${OUT_DIR}`);
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Hata:", err);
  process.exit(1);
});