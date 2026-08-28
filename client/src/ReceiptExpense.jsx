import { useState } from 'react';
import { api } from './api';

export default function ReceiptExpense({ shopId, date, adminPassword, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('image', file);
      const result = await api.receiptExpense(form);
      setDraft({
        amount: String(result.draft.amount ?? ''),
        note: result.draft.vendor_name || result.draft.note || '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.dailyExpenseCreate({
        shop_id: shopId,
        date,
        category: 'Ürün Alımı',
        amount: draft.amount,
        note: draft.note,
        admin_password: adminPassword,
      });
      setDraft(null);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ai-entry">
      {!draft && (
        <label className="file-btn">
          {busy ? 'Okunuyor...' : '📷 Dekont Fotoğrafı Ekle'}
          <input type="file" accept="image/*" capture="environment" onChange={onFile} disabled={busy} hidden />
        </label>
      )}
      {error && <p className="bad">{error}</p>}
      {draft && (
        <div className="ai-confirm">
          <div className="draft-row">
            <input type="number" step="0.01" placeholder="Tutar" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
            <input type="text" placeholder="Firma / not" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          </div>
          <div className="ai-actions">
            <button type="button" onClick={confirm} disabled={busy}>Onayla ve Kaydet (Ürün Alımı)</button>
            <button type="button" onClick={() => setDraft(null)} disabled={busy}>Vazgeç</button>
          </div>
        </div>
      )}
    </div>
  );
}
