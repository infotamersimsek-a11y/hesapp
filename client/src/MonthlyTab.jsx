import { useEffect, useState } from 'react';
import { api } from './api';
import ShopSwitcher from './ShopSwitcher';
import { useLiveRefresh } from './useLiveRefresh';

const now = new Date();
const FIXED_EXPENSE_TYPES = ['Kira', 'Elektrik', 'Su', 'Doğalgaz', 'Ev Kirası', 'Ambalaj', 'Lale Gıda', 'Örgün Gıda', 'Coca-Cola', 'Diğer'];

export default function MonthlyTab({ shops }) {
  const [shopId, setShopId] = useState(shops[0]?.id ?? '');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [vendorType, setVendorType] = useState(FIXED_EXPENSE_TYPES[0]);
  const [vendorCustomName, setVendorCustomName] = useState('');
  const [vendorNote, setVendorNote] = useState('');
  const [vendorAmount, setVendorAmount] = useState('');
  const [vendorCardId, setVendorCardId] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [cards, setCards] = useState([]);

  const reload = async () => {
    if (!shopId) return;
    const params = { shop_id: shopId, year, month };
    const [exp, sum, cardList] = await Promise.all([
      api.monthlyExpenseList(params),
      api.monthlySummary(params),
      api.creditCardsList(),
    ]);
    setExpenses(exp);
    setSummary(sum);
    setCards(cardList);
  };

  useEffect(() => { reload(); }, [shopId, year, month]);
  useLiveRefresh(reload);

  const addFixedExpense = async (e) => {
    e.preventDefault();
    const vendorName = vendorType === 'Diğer' ? vendorCustomName : vendorType;
    if (!vendorName || !vendorAmount) return;
    await api.monthlyExpenseCreate({
      shop_id: shopId,
      year,
      month,
      vendor_name: vendorName,
      category: vendorType,
      amount: vendorAmount,
      note: vendorNote,
      credit_card_id: vendorCardId || null,
    });
    setVendorCustomName('');
    setVendorNote('');
    setVendorAmount('');
    setVendorCardId('');
    reload();
  };

  return (
    <div>
      <ShopSwitcher shops={shops} shopId={shopId} onChange={setShopId} />

      <div className="filters">
        <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 80 }} />
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {summary && (
        <div className="summary">
          <span>Nakit Gelir: {summary.cashIncome.toFixed(2)} ₺</span>
          <span>POS Gelir: {summary.posIncome.toFixed(2)} ₺</span>
          <span>Toplam Gelir: {summary.totalIncome.toFixed(2)} ₺</span>
          <span>Günlük Gider: {summary.dailyExpense.toFixed(2)} ₺</span>
          <span>Sabit Gider: {summary.fixedExpense.toFixed(2)} ₺</span>
          <span>Toplam Gider: {summary.totalExpense.toFixed(2)} ₺</span>
          <span className={summary.balance >= 0 ? 'ok' : 'bad'}>Bakiye: {summary.balance.toFixed(2)} ₺</span>
        </div>
      )}
      <p className="hint">Nakit ve POS gelirleri artık Günlük sekmesinden girilir, buradaki toplam otomatik hesaplanır.</p>

      <section>
        <h3>Sabit Gider Ekle</h3>
        <form onSubmit={addFixedExpense}>
          <select value={vendorType} onChange={(e) => setVendorType(e.target.value)}>
            {FIXED_EXPENSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {vendorType === 'Diğer' && (
            <input type="text" placeholder="Firma / gider adı" value={vendorCustomName} onChange={(e) => setVendorCustomName(e.target.value)} required />
          )}
          <input type="text" placeholder="Not (opsiyonel)" value={vendorNote} onChange={(e) => setVendorNote(e.target.value)} />
          <input type="number" step="0.01" placeholder="Tutar" value={vendorAmount} onChange={(e) => setVendorAmount(e.target.value)} required />
          <select value={vendorCardId} onChange={(e) => setVendorCardId(e.target.value)}>
            <option value="">Ödeme kartı yok</option>
            {cards.map((c) => <option key={c.id} value={c.id}>{c.name} ile ödendi</option>)}
          </select>
          <button type="submit">Ekle</button>
        </form>
        <ul>
          {expenses.map((x) => {
            const card = cards.find((c) => c.id === x.credit_card_id);
            return (
              <li key={x.id}>
                {x.vendor_name}{x.note ? ` — ${x.note}` : ''}: {Number(x.amount).toFixed(2)} ₺ {card ? <span className="tag-pos">{card.name}</span> : ''}
                <button onClick={() => api.monthlyExpenseDelete(x.id).then(reload)}>Sil</button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
