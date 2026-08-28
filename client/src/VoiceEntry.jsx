import { useRef, useState } from 'react';
import { api } from './api';

export default function VoiceEntry({ shopId, date, onSaved }) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [drafts, setDrafts] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await sendAudio(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError('Mikrofon erişimi reddedildi veya kullanılamıyor.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const sendAudio = async (blob) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('audio', blob, 'audio.webm');
      const result = await api.voiceEntry(form);
      setTranscript(result.transcript);
      setDrafts(result.transactions.map((t) => ({ ...t, amount: String(t.amount ?? '') })));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const updateDraft = (idx, field, value) => {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
  };

  const removeDraft = (idx) => {
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
  };

  const confirmAll = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const d of drafts) {
        if (d.type === 'income') {
          await api.dailyIncomeCreate({ shop_id: shopId, date, method: d.method || 'nakit', amount: d.amount, note: d.note });
        } else {
          await api.dailyExpenseCreate({ shop_id: shopId, date, category: d.category || 'Diğer', amount: d.amount, note: d.note });
        }
      }
      setDrafts(null);
      setTranscript(null);
      onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setDrafts(null);
    setTranscript(null);
  };

  return (
    <div className="ai-entry">
      {!drafts && (
        <button
          type="button"
          className={recording ? 'rec-active' : ''}
          disabled={busy}
          onClick={recording ? stopRecording : startRecording}
        >
          {busy ? 'İşleniyor...' : recording ? '⏹ Durdur' : '🎤 Sesle Ekle'}
        </button>
      )}
      {error && <p className="bad">{error}</p>}

      {drafts && (
        <div className="ai-confirm">
          <p className="hint">Duyulan: "{transcript}"</p>
          {drafts.length === 0 && <p>İşlem çıkarılamadı. Tekrar dene.</p>}
          {drafts.map((d, i) => (
            <div className="draft-row" key={i}>
              <select value={d.type} onChange={(e) => updateDraft(i, 'type', e.target.value)}>
                <option value="income">Gelir</option>
                <option value="expense">Gider</option>
              </select>
              {d.type === 'income' ? (
                <select value={d.method || 'nakit'} onChange={(e) => updateDraft(i, 'method', e.target.value)}>
                  <option value="nakit">Nakit</option>
                  <option value="pos">POS</option>
                </select>
              ) : (
                <select value={d.category || 'Diğer'} onChange={(e) => updateDraft(i, 'category', e.target.value)}>
                  <option>Yemek</option>
                  <option>Temizlik</option>
                  <option>Kişisel Giderler</option>
                  <option>Ekstra Giderler</option>
                  <option>Ürün Alımı</option>
                  <option>Diğer</option>
                </select>
              )}
              <input type="number" step="0.01" value={d.amount} onChange={(e) => updateDraft(i, 'amount', e.target.value)} />
              <input type="text" placeholder="Not" value={d.note ?? ''} onChange={(e) => updateDraft(i, 'note', e.target.value)} />
              <button type="button" onClick={() => removeDraft(i)}>Sil</button>
            </div>
          ))}
          <div className="ai-actions">
            <button type="button" onClick={confirmAll} disabled={busy || drafts.length === 0}>Onayla ve Kaydet</button>
            <button type="button" onClick={cancel} disabled={busy}>Vazgeç</button>
          </div>
        </div>
      )}
    </div>
  );
}
