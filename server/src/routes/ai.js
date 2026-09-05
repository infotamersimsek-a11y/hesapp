import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { withComputed } from './creditCards.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const WHISPER_MODEL = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3';
const TEXT_MODEL = process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-120b';
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';

function apiKey() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    const err = new Error('GROQ_API_KEY tanımlı değil (server/.env)');
    err.status = 400;
    throw err;
  }
  return key;
}

async function transcribeAudio(buffer, mimetype) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimetype }), 'audio.webm');
  form.append('model', WHISPER_MODEL);
  form.append('language', 'tr');
  form.append('response_format', 'json');

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form
  });
  if (!res.ok) throw new Error(`Groq transkript hatası: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.text;
}

const PARSE_SYSTEM_PROMPT = `Sen bir dükkan gelir-gider asistanısın. Kullanıcı Türkçe konuşarak günlük işlemlerini anlatır (gelir: nakit/pos veya gider). Konuşmadan işlemleri çıkar ve SADECE şu JSON formatında döndür, başka hiçbir metin ekleme:
{"transactions":[{"type":"income" veya "expense","method":"nakit" veya "pos" (sadece income için, yoksa null),"category":"Yemek"|"Temizlik"|"Kişisel Giderler"|"Ekstra Giderler"|"Ürün Alımı"|"Diğer" (sadece expense için, yoksa null),"amount":sayı,"note":kısa açıklama veya null}]}
Tutarı sadece sayı olarak yaz (₺, TL, lira gibi birimleri çıkar). Emin olmadığın alanları en mantıklı tahminle doldur.`;

async function parseTransactions(transcript) {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PARSE_SYSTEM_PROMPT },
        { role: 'user', content: transcript }
      ]
    })
  });
  if (!res.ok) throw new Error(`Groq ayrıştırma hatası: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return parsed.transactions || [];
}

router.post('/voice-entry', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'audio dosyası gerekli' });
  const transcript = await transcribeAudio(req.file.buffer, req.file.mimetype);
  const transactions = await parseTransactions(transcript);
  res.json({ transcript, transactions });
});

async function visionExtract(buffer, mimetype, systemPrompt) {
  const dataUrl = `data:${mimetype};base64,${buffer.toString('base64')}`;
  const r = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ]
    })
  });
  if (!r.ok) throw new Error(`Groq görsel hatası: ${r.status} ${await r.text()}`);
  const data = await r.json();
  return JSON.parse(data.choices[0].message.content);
}

const RECEIPT_SYSTEM_PROMPT = `Bir dekont veya fiş fotoğrafına bakıyorsun (ürün/mal alımı için yapılmış bir ödeme belgesi). Firma/tedarikçi adını ve TOPLAM tutarı bul. SADECE şu JSON formatında döndür, başka hiçbir metin ekleme:
{"vendor_name": string veya null, "amount": sayı, "note": dekont üzerinde tarih/açıklama gibi kısa bilgi veya null}
Tutarı sadece sayı olarak yaz (₺, TL gibi birimleri çıkar). Emin değilsen dekontta en belirgin/toplam tutarı seç.`;

router.post('/receipt-expense', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'image dosyası gerekli' });
  const draft = await visionExtract(req.file.buffer, req.file.mimetype, RECEIPT_SYSTEM_PROMPT);
  res.json({ draft });
});

const CARD_BALANCE_SYSTEM_PROMPT = `Bir banka/kredi kartı mobil uygulaması ekran görüntüsüne bakıyorsun. Güncel borç veya bakiye tutarını bul (genelde "Güncel Borç", "Ekstre Borcu", "Bakiye" gibi bir etiketin yanında yazar). SADECE şu JSON formatında döndür, başka hiçbir metin ekleme:
{"amount": sayı, "note": ekranda görünen ek bilgi (tarih, kart adı vb) veya null}
Tutarı sadece sayı olarak yaz (₺, TL gibi birimleri çıkar). Birden fazla tutar varsa en belirgin/güncel borç olanı seç.`;

router.post('/card-balance', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'image dosyası gerekli' });
  const draft = await visionExtract(req.file.buffer, req.file.mimetype, CARD_BALANCE_SYSTEM_PROMPT);
  res.json({ draft });
});

const DEBT_ADVICE_SYSTEM_PROMPT = `Sen deneyimli, öz konuşan bir finans danışmanısın. Türkçe yanıt ver. SADECE düz metin kullan — markdown biçimlendirmesi (yıldız/kalın işareti, tablo, # başlık, kod bloğu vb.) KULLANMA. Satır başında "•" ile madde listeleri yapabilirsin. Gereksiz uzatma yapma.`;

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.*?)\*(?!\*)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\|/g, ' ')
    .replace(/^\s*-{3,}\s*$/gm, '');
}

router.get('/debt-advice', async (req, res) => {
  const cardsRes = await pool.query('SELECT * FROM credit_cards ORDER BY id');
  const cards = cardsRes.rows.map(withComputed);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const shopsRes = await pool.query('SELECT * FROM shops ORDER BY id');
  const shopSummaries = [];
  for (const shop of shopsRes.rows) {
    const income = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM daily_income WHERE shop_id=$1 AND EXTRACT(YEAR FROM date)=$2 AND EXTRACT(MONTH FROM date)=$3`,
      [shop.id, year, month]
    );
    const dailyExp = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM daily_expense WHERE shop_id=$1 AND EXTRACT(YEAR FROM date)=$2 AND EXTRACT(MONTH FROM date)=$3`,
      [shop.id, year, month]
    );
    const fixedExp = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM monthly_expense WHERE shop_id=$1 AND year=$2 AND month=$3`,
      [shop.id, year, month]
    );
    const totalIncome = Number(income.rows[0].total);
    const totalExpense = Number(dailyExp.rows[0].total) + Number(fixedExp.rows[0].total);
    shopSummaries.push({ dukkan: shop.name, bu_ayki_gelir: totalIncome, bu_ayki_gider: totalExpense, bu_ayki_bakiye: totalIncome - totalExpense });
  }

  const totalDebt = cards.reduce((s, c) => s + Number(c.debt_amount), 0);
  const totalCash = shopSummaries.reduce((s, sh) => s + sh.bu_ayki_bakiye, 0);

  const cardSummary = cards.map((c) => ({
    ad: c.name,
    sahip: c.owner,
    tur: c.type,
    borc: Number(c.debt_amount),
    limit: c.credit_limit != null ? Number(c.credit_limit) : null,
    son_odeme_gunu: c.due_day,
    son_odemeye_kalan_gun: c.days_until_due,
    hesap_kesim_gunu: c.statement_day,
  }));

  const prompt = `Aşağıda bir işletmenin kredi kartı/borç durumu ve bu ayki nakit durumu var (JSON).

KARTLAR: ${JSON.stringify(cardSummary)}
TOPLAM BORÇ: ${totalDebt} TL
BU AYKİ DÜKKAN DURUMU: ${JSON.stringify(shopSummaries)}
TOPLAM NAKİT DURUMU (bu ay, iki dükkan toplamı): ${totalCash} TL

Görevlerin:
1. Son ödeme tarihi yaklaşan (7 gün içinde) kartları öne çıkar, hangi tarihte ne kadar ödeme gerektiğini belirt.
2. Her "Kredi Kartı" türü için TAHMİNİ asgari ödeme tutarını hesapla (borcun %20'si makul bir kaba tahmindir). Esnek Hesap/İhtiyaç Kredisi/Cari Hesap için asgari ödeme kavramı farklıdır, onlar için sadece genel yorum yap. Bunun gerçek banka asgari tutarı OLMADIĞINI, sadece kaba bir tahmin olduğunu MUTLAKA belirt.
3. Mevcut nakit durumuna göre hangi borcun/kartın önce kapatılması gerektiğine dair öncelik sırası öner (en yakın vadeli ve en küçük borçlu karttan başlamak mantıklı bir strateji, gerekçesini kısaca belirt).
4. Kısa bir özet ve 2-3 somut öneriyle bitir.

Yanıtı düz metin olarak ver — yıldız (**), tablo (|), başlık (#) gibi markdown işaretleri KULLANMA. Sadece "•" ile madde işareti kullanabilirsin.`;

  const aiRes = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: DEBT_ADVICE_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!aiRes.ok) throw new Error(`Groq analiz hatası: ${aiRes.status} ${await aiRes.text()}`);
  const data = await aiRes.json();
  res.json({ advice: stripMarkdown(data.choices[0].message.content), generated_at: new Date().toISOString() });
});

export default router;
