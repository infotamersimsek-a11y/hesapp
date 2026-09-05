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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function visionExtract(buffer, mimetype, systemPrompt) {
  const dataUrl = `data:${mimetype};base64,${buffer.toString('base64')}`;
  const call = () => fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      response_format: { type: 'json_object' },
      max_tokens: 500,
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

  let r = await call();
  if (r.status === 429) {
    const errText = await r.text();
    const match = errText.match(/try again in ([\d.]+)s/);
    const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : 7000;
    await sleep(Math.min(waitMs, 15000));
    r = await call();
  }
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

const CARD_DETAILS_SYSTEM_PROMPT = `Bir banka/kredi kartı mobil uygulaması ekran görüntüsüne veya kart ekstresine bakıyorsun. Kartın son 4 hanesini, toplam limitini, güncel borcunu, hesap kesim gününü ve son ödeme gününü bul. SADECE şu JSON formatında döndür, başka hiçbir metin ekleme:
{"last4": string veya null, "credit_limit": sayı veya null, "debt_amount": sayı veya null, "statement_day": sayı veya null, "due_day": sayı veya null, "note": ek bilgi veya null}
Tutarları sadece sayı olarak yaz (₺, TL gibi birimleri çıkar). statement_day/due_day SADECE ayın günü olarak yaz (örn 15), tam tarih yazma. Emin olmadığın alanları null bırak.`;

router.post('/card-details', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'image dosyası gerekli' });
  const draft = await visionExtract(req.file.buffer, req.file.mimetype, CARD_DETAILS_SYSTEM_PROMPT);
  res.json({ draft });
});

const DEBT_ADVICE_SYSTEM_PROMPT = `Sen deneyimli, ÇOK ÖZ konuşan bir finans danışmanısın. Uzun analiz yapmazsın, direkt sonuca gidersin. Türkçe yanıt ver. SADECE düz metin kullan — markdown biçimlendirmesi (yıldız/kalın işareti, tablo, # başlık, kod bloğu vb.) KULLANMA. Satır başında "•" ile madde listeleri yapabilirsin. Toplam yanıtın 150 kelimeyi geçmesin.`;

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
    const avgDaily = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total, COUNT(DISTINCT date) AS gun_sayisi FROM daily_income
       WHERE shop_id=$1 AND EXTRACT(YEAR FROM date)=$2 AND EXTRACT(MONTH FROM date)=$3 AND EXTRACT(DOW FROM date) <> 0`,
      [shop.id, year, month]
    );
    const totalIncome = Number(income.rows[0].total);
    const totalExpense = Number(dailyExp.rows[0].total) + Number(fixedExp.rows[0].total);
    const dayCount = Number(avgDaily.rows[0].gun_sayisi);
    const avgDailyIncome = dayCount > 0 ? Number(avgDaily.rows[0].total) / dayCount : 0;
    shopSummaries.push({
      dukkan: shop.name,
      bu_ayki_gelir: totalIncome,
      bu_ayki_gider: totalExpense,
      bu_ayki_bakiye: totalIncome - totalExpense,
      gunluk_ortalama_ciro: Math.round(avgDailyIncome),
    });
  }

  const totalDebt = cards.reduce((s, c) => s + Number(c.debt_amount), 0);
  const totalCash = shopSummaries.reduce((s, sh) => s + sh.bu_ayki_bakiye, 0);
  const totalDailyRevenue = shopSummaries.reduce((s, sh) => s + sh.gunluk_ortalama_ciro, 0);

  const cardSummary = cards.map((c) => ({
    ad: c.name,
    sahip: c.owner,
    tur: c.type,
    borc: Number(c.debt_amount),
    limit: c.credit_limit != null ? Number(c.credit_limit) : null,
    son_odeme_gunu: c.due_day,
    son_odemeye_kalan_gun: c.days_until_due,
    hesap_kesim_gunu: c.statement_day,
    bu_ay_ertelendi: !!c.is_deferred_this_month,
  }));

  const prompt = `Aşağıda bir işletmenin kredi kartı/borç durumu ve nakit akışı var (JSON).

KARTLAR: ${JSON.stringify(cardSummary)}
TOPLAM BORÇ: ${totalDebt} TL
DÜKKAN DURUMU (bu ay): ${JSON.stringify(shopSummaries)}
GÜNLÜK ORTALAMA TOPLAM CİRO (iki dükkan, Pazar hariç): ${totalDailyRevenue} TL
BU AYKİ TOPLAM NAKİT DURUMU: ${totalCash} TL

ÇOK KISA VE ÖZ yanıt ver, en fazla 5-6 madde, gereksiz detaya girme. TÜM kartları tek tek listeleme, sadece en kritik olan 2-3 kartı öne çıkar.

1. "bu_ay_ertelendi": true olan kartlar varsa, bunları tek satırda say ("X kartı bu ay ertelendi, ödeme planlanmıyor") — bu kartları ödeme önceliği listesine DAHİL ETME, onlara ayrılacak bütçeyi diğer kartlara yönlendirmeyi öner.
2. Ertelenmemiş kartlardan sadece 7 gün içinde ödemesi olan varsa, adını ve tutarını tek satırda belirt. Yoksa "yakın vadede ödeme yok" de.
3. Günlük ortalama ciroya göre, işletmenin haftada/ayda ne kadar nakit üretebileceğini kabaca hesaba kat ve buna göre (ertelenenler hariç) HANGİ 1-2 borcun öncelikli kapatılması gerektiğini kısaca söyle (küçük borç + yakın vade önceliklidir). Asgari ödeme rakamı istemiyorsan sadece 1 cümlelik kaba bir tahmin yeterli, banka asgarisi olmadığını belirt.
4. En fazla 2 net, uygulanabilir öneriyle bitir.

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
