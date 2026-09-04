import { useEffect, useState } from 'react';
import { api } from './api';
import { useLiveRefresh } from './useLiveRefresh';
import { formatMoney } from './format';

const now = new Date();
const FIXED_EXPENSE_TYPES = ['Kira', 'Elektrik', 'Su', 'Doğalgaz', 'Ev Kirası', 'Ambalaj', 'Lale Gıda', 'Örgün Gıda', 'Coca-Cola', 'Diğer'];
const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

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

function mergeDailyIncome(lists) {
  const map = new Map();
  for (const list of lists) {
    for (const item of list) {
      const key = item.date.slice(0, 10);
      map.set(key, (map.get(key) || 0) + item.total);
    }
  }
  return Array.from(map.entries()).map(([date, total]) => ({ date, total }));
}

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function DailyRevenueChart({ title, dailyIncome, year, month }) {
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const lastDay = isCurrentMonth ? Math.min(now.getDate(), daysInMonth) : daysInMonth;
  const byDate = new Map(dailyIncome.map((d) => [d.date.slice(0, 10), d.total]));

  const days = Array.from({ length: lastDay }, (_, i) => {
    const d = new Date(year, month - 1, i + 1);
    const dateStr = formatYMD(d);
    return { dateStr, total: byDate.get(dateStr) ?? 0, isSunday: d.getDay() === 0 };
  });

  const maxTotal = Math.max(1, ...days.map((d) => d.total));
  const businessDays = days.filter((d) => !d.isSunday);
  const avg = businessDays.length ? businessDays.reduce((s, d) => s + d.total, 0) / businessDays.length : 0;

  return (
    <div className="report-box">
      <h4>{title}</h4>
      {days.length === 0 ? (
        <p className="hint">Bu ay için veri yok.</p>
      ) : (
        <>
          <div className="bar-chart">
            {days.map((d) => (
              <div
                key={d.dateStr}
                className={`bar${d.isSunday ? ' bar-sunday' : ''}`}
                style={{ height: `${Math.max(2, (d.total / maxTotal) * 100)}%` }}
                title={`${dateFormatter.format(new Date(d.dateStr))}: ${formatMoney(d.total)}`}
              />
            ))}
          </div>
          <p className="hint">Mavi: hesaba dahil · Gri: Pazar (ortalamaya dahil değil)</p>
          <p>Günlük Ortalama Ciro: <strong>{formatMoney(avg)}</strong></p>
        </>
      )}
    </div>
  );
}

export default function MonthlyTab({ shops }) {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summaries, setSummaries] = useState({});
  const [prevSummaries, setPrevSummaries] = useState({});
  const [vendorType, setVendorType] = useState(FIXED_EXPENSE_TYPES[0]);
  const [vendorCustomName, setVendorCustomName] = useState('');
  const [vendorNote, setVendorNote] = useState('');
  const [vendorAmount, setVendorAmount] = useState('');
  const [vendorCardId, setVendorCardId] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [cards, setCards] = useState([]);
  const [showReport, setShowReport] = useState(false);
  const [reportMode, setReportMode] = useState('separate');
  const [showStats, setShowStats] = useState(false);

  const hacId = shops.find((s) => s.name === 'Hacıoğulları')?.id;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const reload = async () => {
    if (shops.length === 0) return;
    const [results, prevResults] = await Promise.all([
      Promise.all(shops.map((s) => api.monthlySummary({ shop_id: s.id, year, month }))),
      Promise.all(shops.map((s) => api.monthlySummary({ shop_id: s.id, year: prevYear, month: prevMonth }))),
    ]);
    const map = {};
    shops.forEach((s, i) => { map[s.id] = results[i]; });
    setSummaries(map);
    const prevMap = {};
    shops.forEach((s, i) => { prevMap[s.id] = prevResults[i]; });
    setPrevSummaries(prevMap);

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
        const carryOver = Math.max(0, prevSummaries[s.id]?.balance ?? 0);
        const combinedTotal = sum.balance + carryOver;
        return (
          <div className="shop-summary-block" key={s.id}>
            <h3>{s.name}</h3>
            <div className="summary">
              <span>Nakit Gelir: {formatMoney(sum.cashIncome)}</span>
              <span>POS Gelir: {formatMoney(sum.posIncome)}</span>
              <span>Toplam Gelir: {formatMoney(sum.totalIncome)}</span>
              <span>Toplam Gider: {formatMoney(sum.totalExpense)}</span>
              {s.id === hacId && <span>Sabit Gider: {formatMoney(sum.fixedExpense)}</span>}
              <span className={sum.balance >= 0 ? 'ok' : 'bad'}>Bakiye: {formatMoney(sum.balance)}</span>
            </div>
            <div className="summary">
              <span>Geçen Aydan Devreden: {formatMoney(carryOver)}</span>
              <span className={combinedTotal >= 0 ? 'ok' : 'bad'}>Toplam Bakiye (Devir Dahil): {formatMoney(combinedTotal)}</span>
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

      <section>
        <button type="button" className="file-btn" onClick={() => setShowStats((v) => !v)}>
          {showStats ? 'İstatistiği Gizle' : 'İstatistik Göster'}
        </button>

        {showStats && shops.map((s) => {
          const sum = summaries[s.id];
          if (!sum) return null;
          return <DailyRevenueChart key={s.id} title={`${s.name} — Günlük Ciro`} dailyIncome={sum.dailyIncome} year={year} month={month} />;
        })}

        {showStats && (() => {
          const validSums = shops.map((s) => summaries[s.id]).filter(Boolean);
          if (validSums.length === 0) return null;
          const combinedDaily = mergeDailyIncome(validSums.map((s) => s.dailyIncome));
          return <DailyRevenueChart title="Genel (Tüm Dükkanlar) — Günlük Ciro" dailyIncome={combinedDaily} year={year} month={month} />;
        })()}
      </section>
    </div>
  );
}
