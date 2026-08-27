import { useEffect, useState } from 'react';
import { api } from './api';
import { useLiveRefresh } from './useLiveRefresh';
import { formatMoney } from './format';
import { getBankColor, getContrastText, TURKISH_BANKS } from './bankColors';

const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const formatDate = (isoDate) => dateFormatter.format(new Date(isoDate));

const PRODUCT_TYPES = ['Kredi Kartı', 'Esnek Hesap', 'İhtiyaç Kredisi', 'Diğer'];

function DebtActions({ card, onDone }) {
  const [amount, setAmount] = useState(card.debt_amount);

  const setNewTotal = async (e) => {
    e.preventDefault();
    if (amount === '') return;
    await api.creditCardUpdate(card.id, {
      name: card.name,
      debt_amount: amount,
      statement_day: card.statement_day,
      due_day: card.due_day,
      note: card.note,
    });
    onDone();
  };

  const recordPayment = async () => {
    const paid = Number(amount);
    if (!paid) return;
    const newDebt = Number(card.debt_amount) - paid;
    await api.creditCardUpdate(card.id, {
      name: card.name,
      debt_amount: newDebt,
      statement_day: card.statement_day,
      due_day: card.due_day,
      note: card.note,
    });
    onDone();
  };

  return (
    <form className="inline-update" onSubmit={setNewTotal}>
      <input type="number" step="0.01" placeholder="Tutar" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button type="submit" className="debt-update-btn">Borcu Güncelle</button>
      <button type="button" className="payment-btn" onClick={recordPayment}>Ödeme Yapıldı</button>
    </form>
  );
}

export default function CreditCardsTab() {
  const [cards, setCards] = useState([]);
  const [bankChoice, setBankChoice] = useState(TURKISH_BANKS[0]);
  const [bankCustom, setBankCustom] = useState('');
  const [productChoice, setProductChoice] = useState(PRODUCT_TYPES[0]);
  const [productCustom, setProductCustom] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [statementDay, setStatementDay] = useState('1');
  const [dueDay, setDueDay] = useState('10');
  const [note, setNote] = useState('');

  const reload = async () => {
    setCards(await api.creditCardsList());
  };

  useEffect(() => { reload(); }, []);
  useLiveRefresh(reload);

  const addCard = async (e) => {
    e.preventDefault();
    const bankName = bankChoice === 'Diğer' ? bankCustom : bankChoice;
    const productName = productChoice === 'Diğer' ? productCustom : productChoice;
    if (!bankName || !statementDay || !dueDay) return;
    const name = productName ? `${bankName} - ${productName}` : bankName;
    await api.creditCardCreate({
      name,
      debt_amount: debtAmount || 0,
      statement_day: statementDay,
      due_day: dueDay,
      note,
    });
    setBankChoice(TURKISH_BANKS[0]);
    setBankCustom('');
    setProductChoice(PRODUCT_TYPES[0]);
    setProductCustom('');
    setDebtAmount('');
    setStatementDay('1');
    setDueDay('10');
    setNote('');
    reload();
  };

  const totalDebt = cards.reduce((s, c) => s + Number(c.debt_amount), 0);

  return (
    <div>
      <div className="summary">
        <span>Kart sayısı: {cards.length}</span>
        <span className="bad">Toplam Borç: {formatMoney(totalDebt)}</span>
      </div>

      <section>
        <h3>Kart Ekle</h3>
        <form onSubmit={addCard}>
          <div className="bank-picker">
            {TURKISH_BANKS.map((b) => {
              const bColor = getBankColor(b);
              const active = bankChoice === b;
              return (
                <button
                  type="button"
                  key={b}
                  className={`bank-option${active ? ' active' : ''}`}
                  style={active ? { background: bColor, color: getContrastText(bColor), borderColor: bColor } : { borderColor: bColor, color: bColor }}
                  onClick={() => setBankChoice(b)}
                >
                  {b}
                </button>
              );
            })}
            <button
              type="button"
              className={`bank-option${bankChoice === 'Diğer' ? ' active' : ''}`}
              onClick={() => setBankChoice('Diğer')}
            >
              Diğer
            </button>
          </div>
          {bankChoice === 'Diğer' && (
            <input type="text" placeholder="Banka adı" value={bankCustom} onChange={(e) => setBankCustom(e.target.value)} required />
          )}
          <select value={productChoice} onChange={(e) => setProductChoice(e.target.value)}>
            {PRODUCT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {productChoice === 'Diğer' && (
            <input type="text" placeholder="Ürün adı" value={productCustom} onChange={(e) => setProductCustom(e.target.value)} required />
          )}
          <input type="number" step="0.01" placeholder="Güncel borç" value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} />
          <label className="inline-label">
            Hesap kesim günü (1-31)
            <input type="number" min="1" max="31" value={statementDay} onChange={(e) => setStatementDay(e.target.value)} required />
          </label>
          <label className="inline-label">
            Son ödeme günü (1-31)
            <input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} required />
          </label>
          <input type="text" placeholder="Not (opsiyonel)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="submit">Ekle</button>
        </form>
      </section>

      <div className="card-list">
        {cards.length === 0 && <p className="hint">Henüz kart yok.</p>}
        {cards.map((c) => {
          const bankColor = getBankColor(c.name);
          const textColor = getContrastText(bankColor);
          return (
          <div
            className={`credit-card${c.due_soon ? ' due-soon' : ''}`}
            style={{ background: bankColor, color: textColor }}
            key={c.id}
          >
            <div className="credit-card-header">
              <strong style={{ color: textColor }}>{c.name}</strong>
              {c.due_soon && <span className="backdated-flag">Son ödemeye {c.days_until_due} gün</span>}
              <button className="delete-link" onClick={() => api.creditCardDelete(c.id).then(reload)}>Sil</button>
            </div>
            <div className="credit-card-body" style={{ color: textColor }}>
              <span className="label-debt">Borç: {formatMoney(c.debt_amount)}</span>
              <span className="label-statement">Hesap Kesim: {c.statement_day} (sıradaki: {formatDate(c.next_statement_date)})</span>
              <span className="label-due">Son Ödeme: {c.due_day} (sıradaki: {formatDate(c.next_due_date)})</span>
              {c.note && <span>Not: {c.note}</span>}
            </div>
            <DebtActions card={c} onDone={reload} />
          </div>
          );
        })}
      </div>
    </div>
  );
}
