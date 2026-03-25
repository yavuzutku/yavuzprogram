// Vercel serverless function
export default async function handler(req, res) {
  // GET parametresinden metni al
  const text = req.query.text || '';
  if (!text) {
    return res.status(400).json({ translated: '—', error: 'No text provided' });
  }

  try {
    // Google Translate API endpoint (resmi REST API kullanıyoruz)
    // TRANSLATE_KEY environment variable olarak ekli
    const key = process.env.TRANSLATE_KEY;
    const url = `https://translation.googleapis.com/language/translate/v2?key=${key}`;

    // POST request ile metni gönderiyoruz
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'de',
        target: 'tr',
        format: 'text'
      })
    });

    const data = await response.json();

    // API cevabını frontend’e döndür
    const translated = data?.data?.translations?.[0]?.translatedText || '—';
    return res.status(200).json({ translated });

  } catch (err) {
    console.error('Translate error:', err);
    return res.status(500).json({ translated: '—', error: 'Translation failed' });
  }
}