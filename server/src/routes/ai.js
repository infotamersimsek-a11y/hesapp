import { Router } from 'express';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const WHISPER_MODEL = process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3';
const TEXT_MODEL = process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-120b';

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
{"transactions":[{"type":"income" veya "expense","method":"nakit" veya "pos" (sadece income için, yoksa null),"category":"Yemek"|"Temizlik"|"Kişisel Giderler"|"Ekstra Giderler"|"Diğer" (sadece expense için, yoksa null),"amount":sayı,"note":kısa açıklama veya null}]}
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

export default router;
