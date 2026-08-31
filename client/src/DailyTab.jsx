import { useEffect, useState } from 'react';
import { api } from './api';
import VoiceEntry from './VoiceEntry';
import ReceiptExpense from './ReceiptExpense';
import ShopSwitcher from './ShopSwitcher';
import { useLiveRefresh } from './useLiveRefresh';

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function today() { return formatYMD(new Date()); }
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatYMD(d);
}
const FREE_EDIT_DAYS = 3;
const FREE_EDIT_DATES = Array.from({ length: FREE_EDIT_DAYS }, (_, i) => daysAgo(i));
const isToday = (isoDate) => isoDate.slice(0, 10) === today();
const isFreeEditDate = (isoDate) => FREE_EDIT_DATES.includes(isoDate.slice(0, 10));
const DAYS_PER_PAGE = 3;
const EXPENSE_CATEGORIES = ['Yemek', 'Temizlik', 'Kişisel Giderler', 'Ekstra Giderler', 'Ürün Alımı', 'Diğer'];

const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const formatDate = (isoDate) => dateFormatter.format(new Date(isoDate));

function AmountEditor({ item, onSave }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(item.amount);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(null);
  const needsPassword = !isFreeEditDate(item.date);

  if (!editing) {
    return <button className="edit-link" onClick={() => setEditing(true)}>Düzenle</button>;
  }

  const save = async () => {
    setErr(null);
    try {
      await onSave(amount, needsPassword ? pw : undefined);
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <span className="edit-inline">
      <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      {needsPassword && (
        <input type="password" placeholder="Yönetici şifresi" value={pw} onChange={(e) => setPw(e.target.value)} />
      )}
      <button type="button" onClick={save}>Kaydet</button>
      <button type="button" onClick={() => setEditing(false)}>Vazgeç</button>
      {err && <span className="bad"> {err}</span>}
    </span>
  );
}

function Pager({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pager">
      <button type="button" disabled={page === 0} onClick={() => onChange(page - 1)}>◀ Yeni</button>
      <span>Sayfa {page + 1} / {totalPages}</span>
      <button type="button" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>Eski ▶</button>
    </div>
  );
}

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

export default function DailyTab({ shops, defaultShopName }) {
  const initialShop = shops.find((s) => s.name === defaultShopName) ?? shops[0];
  const [shopId, setShopId] = useState(initialShop?.id ?? '');
  const [date, setDate] = useState(today());
  const [adminPassword, setAdminPassword] = useState('');
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
  const [error, setError] = useState(null);
  const [incomePage, setIncomePage] = useState(0);
  const [expensePage, setExpensePage] = useState(0);

  const isBackdated = !isFreeEditDate(date);

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
  useEffect(() => { setIncomePage(0); setExpensePage(0); }, [shopId]);
  useLiveRefresh(reload);

  const addIncome = async (e) => {
    e.preventDefault();
    if (!incomeAmount) return;
    setError(null);
    try {
      await api.dailyIncomeCreate({ shop_id: shopId, date, method: incomeMethod, amount: incomeAmount, note: incomeNote, admin_password: isBackdated ? adminPassword : undefined });
      setIncomeAmount('');
      setIncomeNote('');
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const addExpense = async (e) => {
    e.preventDefault();
    if (!expenseAmount) return;
    setError(null);
    try {
      await api.dailyExpenseCreate({
        shop_id: shopId,
        date,
        category: expenseCategory,
        amount: expenseAmount,
        note: expenseNote,
        credit_card_id: expenseCardId || null,
        admin_password: isBackdated ? adminPassword : undefined,
      });
      setExpenseAmount('');
      setExpenseNote('');
      setExpenseCardId('');
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const incomeDays = groupByDate(allIncomes);
  const expenseDays = groupByDate(allExpenses);
  const incomeTotalPages = Math.max(1, Math.ceil(incomeDays.length / DAYS_PER_PAGE));
  const expenseTotalPages = Math.max(1, Math.ceil(expenseDays.length / DAYS_PER_PAGE));
  const incomePageClamped = Math.min(incomePage, incomeTotalPages - 1);
  const expensePageClamped = Math.min(expensePage, expenseTotalPages - 1);
  const incomeDaysPage = incomeDays.slice(incomePageClamped * DAYS_PER_PAGE, (incomePageClamped + 1) * DAYS_PER_PAGE);
  const expenseDaysPage = expenseDays.slice(expensePageClamped * DAYS_PER_PAGE, (expensePageClamped + 1) * DAYS_PER_PAGE);

  return (
    <div>
      <ShopSwitcher shops={shops} shopId={shopId} onChange={setShopId} />

      <div className="filters">
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        <span className="hint">{formatDate(date)}{isBackdated && ' — geçmişe dönük'}</span>
      </div>

      {isBackdated && (
        <div className="admin-gate">
          <input
            type="password"
            placeholder={`Yönetici şifresi (son ${FREE_EDIT_DAYS} günden eski tarih için gerekli)`}
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
        </div>
      )}
      {error && <p className="bad">{error}</p>}

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
          <ReceiptExpense shopId={shopId} date={date} adminPassword={isBackdated ? adminPassword : undefined} onSaved={reload} />
        </section>
      </div>

      <section className="voice-section">
        <h3>Sesle Gelir/Gider Ekle</h3>
        <p className="hint">Mikrofona bas, konuş (örn: "500 lira nakit geldi, 200 lira pos geldi, 50 lira temizlik gideri oldu"), çıkan işlemleri kontrol edip onayla.</p>
        <VoiceEntry shopId={shopId} date={date} adminPassword={isBackdated ? adminPassword : undefined} onSaved={reload} />
      </section>

      <div className="grid history-grid">
        <section>
          <h3>Gelir Geçmişi</h3>
          <Pager page={incomePageClamped} totalPages={incomeTotalPages} onChange={setIncomePage} />
          {incomeDays.length === 0 && <p className="hint">Henüz kayıt yok.</p>}
          {incomeDaysPage.map((d) => {
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
                      <AmountEditor
                        item={i}
                        onSave={(amount, admin_password) => api.dailyIncomeUpdate(i.id, {
                          shop_id: i.shop_id, date: i.date.slice(0, 10), method: i.method, amount, note: i.note, admin_password,
                        }).then(reload)}
                      />
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
          <Pager page={expensePageClamped} totalPages={expenseTotalPages} onChange={setExpensePage} />
          {expenseDays.length === 0 && <p className="hint">Henüz kayıt yok.</p>}
          {expenseDaysPage.map((d) => {
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
                        <AmountEditor
                          item={x}
                          onSave={(amount, admin_password) => api.dailyExpenseUpdate(x.id, {
                            shop_id: x.shop_id, date: x.date.slice(0, 10), category: x.category, amount, note: x.note, credit_card_id: x.credit_card_id, admin_password,
                          }).then(reload)}
                        />
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
