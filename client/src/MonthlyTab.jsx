import { useEffect, useState } from 'react';
import { api } from './api';
import { useLiveRefresh } from './useLiveRefresh';
import { formatMoney } from './format';

const now = new Date();
const FIXED_EXPENSE_TYPES = ['Kira', 'Elektrik', 'Su', 'Doğalgaz', 'Ev Kirası', 'Ambalaj', 'Lale Gıda', 'Örgün Gıda', 'Coca-Cola', 'Diğer'];

function mergeByKey(lists, key) {
  const map = new Map();
  for (const list of lists) {
    for (const item of list) {
      map.set(item[key], (map.get(item[key]) || 0) + item.total);
    }
  }
  return Array.from(map.entries())
    .map(([k, total]) => ({ [key]: k, total }))
    .sort((a, b) => b.total - a.total);
}

export default function MonthlyTab({ shops }) {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summaries, setSummaries] = useState({});
  const [vendorType, setVendorType] = useState(FIXED_EXPENSE_TYPES[0]);
  const [vendorCustomName, setVendorCustomName] = useState('');
  const [vendorNote, setVendorNote] = useState('');
  const [vendorAmount, setVendorAmount] = useState('');
  const [vendorCardId, setVendorCardId] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [cards, setCards] = useState([]);
  const [showReport, setShowReport] = useState(false);
  const [reportMode, setReportMode] = useState('separate');

  const hacId = shops.find((s) => s.name === 'Hacıoğulları')?.id;

  const reload = async () => {
    if (shops.length === 0) return;
    const results = await Promise.all(shops.map((s) => api.monthlySummary({ shop_id: s.id, year, month })));
    const map = {};
    shops.forEach((s, i) => { map[s.id] = results[i]; });
    setSummaries(map);

    if (hacId) {
      const [exp, cardList] = await Promise.all([
        api.monthlyExpenseList({ shop_id: hacId, year, month }),
        api.creditCardsList(),
      ]);
      setExpenses(exp);
      setCards(cardList);
    }
  };

  useEffect(() => { reload(); }, [year, month, shops.length, hacId]);
  useLiveRefresh(reload);

  const addFixedExpense = async (e) => {
    e.preventDefault();
    const vendorName = vendorType === 'Diğer' ? vendorCustomName : vendorType;
    if (!vendorName || !vendorAmount || !hacId) return;
    await api.monthlyExpenseCreate({
      shop_id: hacId,
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
      <div className="filters">
        <input type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 80 }} />
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {shops.map((s) => {
        const sum = summaries[s.id];
        if (!sum) return null;
        return (
          <div className="shop-summary-block" key={s.id}>
            <h3>{s.name}</h3>
            <div className="summary">
              <span>Nakit Gelir: {formatMoney(sum.cashIncome)}</span>
              <span>POS Gelir: {formatMoney(sum.posIncome)}</span>
              <span>Toplam Gelir: {formatMoney(sum.totalIncome)}</span>
              <span>Toplam Gider: {formatMoney(sum.totalExpense)}</span>
              <span className={sum.balance >= 0 ? 'ok' : 'bad'}>Bakiye: {formatMoney(sum.balance)}</span>
            </div>
          </div>
        );
      })}
      <p className="hint">Nakit ve POS gelirleri Günlük sekmesinden girilir, buradaki toplamlar otomatik hesaplanır.</p>

      <section>
        <h3>Sabit Gider Ekle (Hacıoğulları)</h3>
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

      <section>
        <button type="button" className="file-btn" onClick={() => setShowReport((v) => !v)}>
          {showReport ? 'Özet Raporunu Gizle' : 'Özet Raporu Göster'}
        </button>

        {showReport && (
          <div className="report-mode-toggle">
            <button type="button" className={reportMode === 'separate' ? 'active' : ''} onClick={() => setReportMode('separate')}>Ayrı Ayrı</button>
            <button type="button" className={reportMode === 'combined' ? 'active' : ''} onClick={() => setReportMode('combined')}>Toplu</button>
          </div>
        )}

        {showReport && reportMode === 'separate' && shops.map((s) => {
          const sum = summaries[s.id];
          if (!sum) return null;
          return (
            <div className="report-box" key={s.id}>
              <h4>{s.name} — Kategori Bazlı Gider</h4>
              {sum.expenseByCategory.length === 0 && <p className="hint">Bu ay kayıt yok.</p>}
              <ul className="report-list">
                {sum.expenseByCategory.map((r) => (
                  <li key={r.category}><span>{r.category}</span><span>{formatMoney(r.total)}</span></li>
                ))}
              </ul>
              {s.id === hacId && (
                <>
                  <h4>Sabit Gider — Firma Bazlı</h4>
                  {sum.expenseByVendor.length === 0 && <p className="hint">Bu ay kayıt yok.</p>}
                  <ul className="report-list">
                    {sum.expenseByVendor.map((r) => (
                      <li key={r.vendor}><span>{r.vendor}</span><span>{formatMoney(r.total)}</span></li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          );
        })}

        {showReport && reportMode === 'combined' && (() => {
          const validSums = shops.map((s) => summaries[s.id]).filter(Boolean);
          const combinedCategory = mergeByKey(validSums.map((s) => s.expenseByCategory), 'category');
          const combinedVendor = mergeByKey(validSums.map((s) => s.expenseByVendor), 'vendor');
          return (
            <div className="report-box">
              <h4>Tüm Dükkanlar (Toplu) — Kategori Bazlı Gider</h4>
              {combinedCategory.length === 0 && <p className="hint">Bu ay kayıt yok.</p>}
              <ul className="report-list">
                {combinedCategory.map((r) => (
                  <li key={r.category}><span>{r.category}</span><span>{formatMoney(r.total)}</span></li>
                ))}
              </ul>
              <h4>Sabit Gider — Firma Bazlı</h4>
              {combinedVendor.length === 0 && <p className="hint">Bu ay kayıt yok.</p>}
              <ul className="report-list">
                {combinedVendor.map((r) => (
                  <li key={r.vendor}><span>{r.vendor}</span><span>{formatMoney(r.total)}</span></li>
                ))}
              </ul>
            </div>
          );
        })()}
      </section>
    </div>
  );
}
