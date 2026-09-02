import { useEffect, useState } from 'react';
import { api } from './api';
import { useLiveRefresh } from './useLiveRefresh';
import { formatMoney } from './format';
import { getBankColor, getContrastText, TURKISH_BANKS } from './bankColors';

const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const formatDate = (isoDate) => dateFormatter.format(new Date(isoDate));

const OWNERS = ['Tamer', 'Ramazan'];
const CARD_TYPES = ['Kredi Kartı', 'Esnek Hesap', 'İhtiyaç Kredisi', 'Cari Hesap', 'Diğer'];
const SUPPLIER_COLORS = {
  'Lale Gıda': '#2E7D32',
  'Örgün Gıda': '#EF6C00',
  'Ambalaj': '#5D4037',
  'Coca-Cola': '#E30613',
  'Alpedo': '#0277BD',
};
const SUPPLIER_COMPANIES = Object.keys(SUPPLIER_COLORS);
const getSupplierColor = (name) => SUPPLIER_COLORS[name] || '#616161';
const getEntityColor = (name) => SUPPLIER_COLORS[name] || getBankColor(name);

function groupCards(cards) {
  const map = new Map();
  for (const c of cards) {
    const key = `${c.name}||${c.owner}`;
    if (!map.has(key)) map.set(key, { name: c.name, owner: c.owner, items: [] });
    map.get(key).items.push(c);
  }
  return Array.from(map.values());
}

function BalancePhoto({ onRead }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('image', file);
      const result = await api.cardBalance(form);
      onRead(String(result.draft.amount ?? ''));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="balance-photo">
      <label className="file-btn small">
        {busy ? '...' : '📷'}
        <input type="file" accept="image/*" capture="environment" onChange={onFile} disabled={busy} hidden />
      </label>
      {error && <span className="bad"> {error}</span>}
    </span>
  );
}

function DebtActions({ card, onDone }) {
  const [amount, setAmount] = useState(card.debt_amount);

  const save = async (newDebt) => {
    await api.creditCardUpdate(card.id, {
      name: card.name,
      owner: card.owner,
      type: card.type,
      last4: card.last4,
      credit_limit: card.credit_limit,
      debt_amount: newDebt,
      statement_day: card.statement_day,
      due_day: card.due_day,
      note: card.note,
    });
    onDone();
  };

  const setNewTotal = async (e) => {
    e.preventDefault();
    if (amount === '') return;
    await save(amount);
  };

  return (
    <form className="inline-update" onSubmit={setNewTotal}>
      <input type="number" step="0.01" placeholder="Tutar" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button type="submit" className="debt-update-btn">Borcu Güncelle</button>
      <BalancePhoto onRead={setAmount} />
    </form>
  );
}

export default function CreditCardsTab() {
  const [cards, setCards] = useState([]);
  const [bankChoice, setBankChoice] = useState(TURKISH_BANKS[0]);
  const [bankCustom, setBankCustom] = useState('');
  const [owner, setOwner] = useState(OWNERS[0]);
  const [type, setType] = useState(CARD_TYPES[0]);
  const [typeCustom, setTypeCustom] = useState('');
  const [last4, setLast4] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [statementDay, setStatementDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [note, setNote] = useState('');

  const reload = async () => {
    setCards(await api.creditCardsList());
  };

  useEffect(() => { reload(); }, []);
  useLiveRefresh(reload);

  const addCard = async (e) => {
    e.preventDefault();
    const bankName = bankChoice === 'Diğer' ? bankCustom : bankChoice;
    const typeName = type === 'Diğer' ? typeCustom : type;
    if (!bankName || !typeName) return;
    await api.creditCardCreate({
      name: bankName,
      owner,
      type: typeName,
      last4: last4 || null,
      credit_limit: creditLimit || null,
      debt_amount: debtAmount || 0,
      statement_day: statementDay || null,
      due_day: dueDay || null,
      note,
    });
    setBankChoice(TURKISH_BANKS[0]);
    setBankCustom('');
    setOwner(OWNERS[0]);
    setType(CARD_TYPES[0]);
    setTypeCustom('');
    setLast4('');
    setCreditLimit('');
    setDebtAmount('');
    setStatementDay('');
    setDueDay('');
    setNote('');
    reload();
  };

  const totalDebt = cards.reduce((s, c) => s + Number(c.debt_amount), 0);
  const groups = groupCards(cards);

  return (
    <div>
      <div className="summary">
        <span>Kart sayısı: {cards.length}</span>
        <span className="bad">Toplam Borç: {formatMoney(totalDebt)}</span>
      </div>

      <section>
        <h3>Kart Ekle</h3>
        <form onSubmit={addCard}>
          <label className="inline-label">
            Banka / Firma
            <select value={bankChoice} onChange={(e) => setBankChoice(e.target.value)}>
              <optgroup label="Banka">
                {TURKISH_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </optgroup>
              <optgroup label="Firma">
                {SUPPLIER_COMPANIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </optgroup>
              <option value="Diğer">Diğer</option>
            </select>
          </label>
          {bankChoice === 'Diğer' && (
            <input type="text" placeholder="Banka / firma adı" value={bankCustom} onChange={(e) => setBankCustom(e.target.value)} required />
          )}

          <label className="inline-label">
            Kime ait
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>

          <label className="inline-label">
            Tür
            <select
              value={type}
              onChange={(e) => {
                const v = e.target.value;
                setType(v);
                if (v !== 'Kredi Kartı' && v !== 'Diğer') {
                  setLast4('');
                  setStatementDay('');
                }
              }}
            >
              {CARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {type === 'Diğer' && (
            <input type="text" placeholder="Tür adı" value={typeCustom} onChange={(e) => setTypeCustom(e.target.value)} required />
          )}

          {(type === 'Kredi Kartı' || type === 'Diğer') && (
            <input type="text" placeholder="Kartın son 4 hanesi (opsiyonel)" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))} />
          )}
          <input type="number" step="0.01" placeholder="Toplam limit (opsiyonel)" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
          <input type="number" step="0.01" placeholder="Güncel borç" value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} />

          {(type === 'Kredi Kartı' || type === 'Diğer') && (
            <label className="inline-label">
              Hesap kesim günü (opsiyonel, 1-31)
              <input type="number" min="1" max="31" value={statementDay} onChange={(e) => setStatementDay(e.target.value)} />
            </label>
          )}
          <label className="inline-label">
            Son ödeme günü (opsiyonel, 1-31)
            <input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
          </label>
          <input type="text" placeholder="Not (opsiyonel)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="submit">Ekle</button>
        </form>
      </section>

      <div className="card-list">
        {groups.length === 0 && <p className="hint">Henüz kart yok.</p>}
        {groups.map((g) => {
          const bankColor = getEntityColor(g.name);
          const textColor = getContrastText(bankColor);
          const anyDueSoon = g.items.some((c) => c.due_soon);
          return (
            <div
              className={`credit-card${anyDueSoon ? ' due-soon' : ''}`}
              style={{ background: bankColor, color: textColor }}
              key={`${g.name}||${g.owner}`}
            >
              <div className="credit-card-header">
                <strong style={{ color: textColor }}>{g.name} — {g.owner}</strong>
              </div>

              {g.items.map((c) => (
                <div className="debt-item" key={c.id}>
                  <div className="credit-card-header">
                    <strong style={{ color: textColor }}>{c.type}{c.last4 ? ` •••• ${c.last4}` : ''}</strong>
                    {c.due_soon && <span className="backdated-flag">Son ödemeye {c.days_until_due} gün</span>}
                    <button className="delete-link" onClick={() => api.creditCardDelete(c.id).then(reload)}>Sil</button>
                  </div>
                  <div className="credit-card-body" style={{ color: textColor }}>
                    <span className="label-debt">Borç: {formatMoney(c.debt_amount)}</span>
                    {c.credit_limit != null && <span className="label-limit">Kullanılabilir Limit: {formatMoney(c.available_limit)} / {formatMoney(c.credit_limit)}</span>}
                    {c.statement_day && <span className="label-statement">Hesap Kesim: {c.statement_day} (sıradaki: {formatDate(c.next_statement_date)})</span>}
                    {c.due_day && <span className="label-due">Son Ödeme: {c.due_day} (sıradaki: {formatDate(c.next_due_date)})</span>}
                    {c.note && <span>Not: {c.note}</span>}
                    {c.history.filter((h) => h.delta != null).slice(0, 2).map((h, i) => (
                      <span key={i} className="hint" style={{ color: textColor, opacity: 0.85 }}>
                        {h.delta > 0 ? `Ödeme: ${formatMoney(h.delta)}` : `Borç artışı: ${formatMoney(-h.delta)}`} — {formatDate(h.recorded_at)}
                      </span>
                    ))}
                    {c.recent_charges.length > 0 && (
                      <div className="recent-charges">
                        <span className="hint" style={{ color: textColor }}>Son 3 gün bu karttan yapılan harcamalar:</span>
                        {c.recent_charges.map((r, i) => (
                          <span key={i} className="hint" style={{ color: textColor, opacity: 0.85 }}>
                            {g.name} kartından {formatMoney(r.amount)} ödeme yapıldı — {r.label}{r.note ? ` (${r.note})` : ''} — {formatDate(r.date)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <DebtActions card={c} onDone={reload} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
