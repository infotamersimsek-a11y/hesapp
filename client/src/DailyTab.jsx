import { useEffect, useState } from 'react';
import { api } from './api';
import VoiceEntry from './VoiceEntry';
import ReceiptExpense from './ReceiptExpense';
import ShopSwitcher from './ShopSwitcher';
import { useLiveRefresh } from './useLiveRefresh';

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const isToday = (isoDate) => isoDate.slice(0, 10) === today();
const EXPENSE_CATEGORIES = ['Yemek', 'Temizlik', 'Kişisel Giderler', 'Ekstra Giderler', 'Ürün Alımı', 'Diğer'];

const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const formatDate = (isoDate) => dateFormatter.format(new Date(isoDate));

function groupByDate(entries) {
  const days = {};
  for (const e of entries) {
    (days[e.date] ??= []).push(e);
  }
  return Object.entries(days)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({
      date,
      items,
      total: items.reduce((s, i) => s + Number(i.amount), 0),
    }));
}

export default function DailyTab({ shops }) {
  const [shopId, setShopId] = useState(shops[0]?.id ?? '');
  const [incomeMethod, setIncomeMethod] = useState('nakit');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeNote, setIncomeNote] = useState('');
  const [expenseCategory, setExpenseCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [expenseCardId, setExpenseCardId] = useState('');
  const [allIncomes, setAllIncomes] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [cards, setCards] = useState([]);

  const reload = async () => {
    if (!shopId) return;
    const [inc, exp, cardList] = await Promise.all([
      api.dailyIncomeList({ shop_id: shopId }),
      api.dailyExpenseList({ shop_id: shopId }),
      api.creditCardsList(),
    ]);
    setAllIncomes(inc);
    setAllExpenses(exp);
    setCards(cardList);
  };

  useEffect(() => { reload(); }, [shopId]);
  useLiveRefresh(reload);

  const addIncome = async (e) => {
    e.preventDefault();
    if (!incomeAmount) return;
    await api.dailyIncomeCreate({ shop_id: shopId, date: today(), method: incomeMethod, amount: incomeAmount, note: incomeNote });
    setIncomeAmount('');
    setIncomeNote('');
    reload();
  };

  const addExpense = async (e) => {
    e.preventDefault();
    if (!expenseAmount) return;
    await api.dailyExpenseCreate({
      shop_id: shopId,
      date: today(),
      category: expenseCategory,
      amount: expenseAmount,
      note: expenseNote,
      credit_card_id: expenseCardId || null,
    });
    setExpenseAmount('');
    setExpenseNote('');
    setExpenseCardId('');
    reload();
  };

  const incomeDays = groupByDate(allIncomes);
  const expenseDays = groupByDate(allExpenses);

  return (
    <div>
      <ShopSwitcher shops={shops} shopId={shopId} onChange={setShopId} />

      <p className="hint">Bugün: <strong>{formatDate(today())}</strong> — kayıtlar sadece bugüne girilir, geçmişe/geleceğe kayıt eklenemez.</p>

      <div className="grid">
        <section>
          <h3>Gelir Ekle</h3>
          <form onSubmit={addIncome}>
            <select value={incomeMethod} onChange={(e) => setIncomeMethod(e.target.value)}>
              <option value="nakit">Nakit</option>
              <option value="pos">POS</option>
            </select>
            <input type="number" step="0.01" placeholder="Tutar" value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} required />
            <input type="text" placeholder="Not (opsiyonel)" value={incomeNote} onChange={(e) => setIncomeNote(e.target.value)} />
            <button type="submit">Ekle</button>
          </form>
        </section>

        <section>
          <h3>Gider Ekle</h3>
          <form onSubmit={addExpense}>
            <select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" step="0.01" placeholder="Tutar" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} required />
            <input type="text" placeholder="Not (opsiyonel)" value={expenseNote} onChange={(e) => setExpenseNote(e.target.value)} />
            <select value={expenseCardId} onChange={(e) => setExpenseCardId(e.target.value)}>
              <option value="">Ödeme kartı yok (nakit/pos)</option>
              {cards.map((c) => <option key={c.id} value={c.id}>{c.name} ile ödendi</option>)}
            </select>
            <button type="submit">Ekle</button>
          </form>
          <ReceiptExpense shopId={shopId} date={today()} onSaved={reload} />
        </section>
      </div>

      <section className="voice-section">
        <h3>Sesle Gelir/Gider Ekle</h3>
        <p className="hint">Mikrofona bas, konuş (örn: "500 lira nakit geldi, 200 lira pos geldi, 50 lira temizlik gideri oldu"), çıkan işlemleri kontrol edip onayla.</p>
        <VoiceEntry shopId={shopId} date={today()} onSaved={reload} />
      </section>

      <div className="grid history-grid">
        <section>
          <h3>Gelir Geçmişi</h3>
          {incomeDays.length === 0 && <p className="hint">Henüz kayıt yok.</p>}
          {incomeDays.map((d) => {
            const editable = isToday(d.date);
            return (
              <div className={`day-card${editable ? '' : ' backdated'}`} key={d.date}>
                <div className="day-card-header">
                  <strong>{formatDate(d.date)}</strong>
                  {!editable && <span className="backdated-flag">Kilitli</span>}
                  <span className="ok">Toplam: {d.total.toFixed(2)} ₺</span>
                </div>
                <ul>
                  {d.items.map((i) => (
                    <li key={i.id}>
                      <span className={i.method === 'pos' ? 'tag-pos' : 'tag-nakit'}>{i.method === 'pos' ? 'POS' : 'Nakit'}</span>
                      {Number(i.amount).toFixed(2)} ₺ {i.note ? `— ${i.note}` : ''}
                      {editable && <button onClick={() => api.dailyIncomeDelete(i.id).then(reload)}>Sil</button>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        <section>
          <h3>Gider Geçmişi</h3>
          {expenseDays.length === 0 && <p className="hint">Henüz kayıt yok.</p>}
          {expenseDays.map((d) => {
            const editable = isToday(d.date);
            return (
              <div className={`day-card${editable ? '' : ' backdated'}`} key={d.date}>
                <div className="day-card-header">
                  <strong>{formatDate(d.date)}</strong>
                  {!editable && <span className="backdated-flag">Kilitli</span>}
                  <span className="bad">Toplam: {d.total.toFixed(2)} ₺</span>
                </div>
                <ul>
                  {d.items.map((x) => {
                    const card = cards.find((c) => c.id === x.credit_card_id);
                    return (
                      <li key={x.id}>
                        {x.category}: {Number(x.amount).toFixed(2)} ₺ {x.note ? `— ${x.note}` : ''} {card ? <span className="tag-pos">{card.name}</span> : ''}
                        {editable && <button onClick={() => api.dailyExpenseDelete(x.id).then(reload)}>Sil</button>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
