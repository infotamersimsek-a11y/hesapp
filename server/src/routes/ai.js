import { Router } from 'express';
import multer from 'multer';

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

export default router;
