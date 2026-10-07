import { useEffect, useState } from 'react';
import { api } from './api';
import { useLiveRefresh } from './useLiveRefresh';
import { formatMoney } from './format';
import { generateMonthlyReportPdf, generateWeeklyReportPdf } from './pdfReport';
import { buildMonthDays, analyzeDaySet, analyzeMonthDays } from './monthDays';

const now = new Date();
const FIXED_EXPENSE_TYPES = ['Kira', 'Elektrik', 'Su', 'Doğalgaz', 'Ev Kirası', 'Ambalaj', 'Lale Gıda', 'Örgün Gıda', 'Coca-Cola', 'Alpedo', 'Fıstıkçı', 'Tüpçü', 'Taş Kadayıfçı', 'Kadayıfçı', 'Personel', 'Diğer'];
const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const weekDateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOf(date) {
  const d = new Date(date);
  const isoDow = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (isoDow - 1));
  return d;
}

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

function formatKg(v) {
  return `${Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} kg`;
}

function aggregateWasteByCategory(entries) {
  const map = new Map();
  for (const e of entries) map.set(e.category, (map.get(e.category) || 0) + Number(e.amount_kg));
  return Array.from(map.entries()).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

function aggregateWasteDaily(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = e.date.slice(0, 10);
    map.set(key, (map.get(key) || 0) + Number(e.amount_kg));
  }
  return Array.from(map.entries()).map(([date, total]) => ({ date, total }));
}

const DAY_ABBR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

const monthYearFormatter = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });

function formatDayRange(days) {
  if (days.length === 0) return null;
  const firstDateStr = days[0].dateStr;
  const lastDateStr = days[days.length - 1].dateStr;
  const firstDayNum = Number(firstDateStr.slice(8, 10));
  const lastDayNum = Number(lastDateStr.slice(8, 10));
  const label = monthYearFormatter.format(new Date(lastDateStr));
  if (firstDayNum === lastDayNum) return `${firstDayNum} ${label}`;
  return `${firstDayNum}-${lastDayNum} ${label} arası`;
}

function dailyAverage(dailyIncome, year, month, includeSunday = false) {
  return analyzeMonthDays(dailyIncome, year, month, includeSunday).avg;
}

function chunkWeeks(days) {
  const weeks = [];
  let current = [];
  for (const d of days) {
    const isoDow = d.dow === 0 ? 7 : d.dow;
    if (isoDow === 1 && current.length) {
      weeks.push(current);
      current = [];
    }
    current.push(d);
  }
  if (current.length) weeks.push(current);
  return weeks;
}

function simpleAverage(daySet) {
  const businessDays = daySet.filter((d) => !d.isSunday);
  return businessDays.length ? businessDays.reduce((s, d) => s + d.total, 0) / businessDays.length : 0;
}

function DailyRevenueChart({ title, dailyIncome, year, month, formatValue = formatMoney, avgLabel = 'Günlük Ortalama Ciro', detectMissing = true, includeSunday = false }) {
  const { days, isCurrentMonth, todayStr, byDate } = buildMonthDays(dailyIncome, year, month, includeSunday);
  const weeks = chunkWeeks(days);
  const [weekIdx, setWeekIdx] = useState(weeks.length - 1);
  useEffect(() => { setWeekIdx(chunkWeeks(buildMonthDays(dailyIncome, year, month, includeSunday).days).length - 1); }, [year, month]);
  const clampedIdx = Math.max(0, Math.min(weekIdx, weeks.length - 1));
  const weekDays = weeks[clampedIdx] || [];
  const { avg, missingDates } = detectMissing
    ? analyzeDaySet(weekDays, isCurrentMonth, todayStr, byDate)
    : { avg: simpleAverage(weekDays), missingDates: [] };
  const missingSet = new Set(missingDates);
  const maxTotal = Math.max(1, ...weekDays.map((d) => d.total));
  const rangeLabel = formatDayRange(weekDays);

  return (
    <div className="report-box">
      <h4>{title}</h4>
      {rangeLabel && <p className="hint">{rangeLabel}</p>}
      {weeks.length > 1 && (
        <div className="pager">
          <button type="button" disabled={clampedIdx === 0} onClick={() => setWeekIdx(clampedIdx - 1)}>◀ Önceki Hafta</button>
          <span>Hafta {clampedIdx + 1} / {weeks.length}</span>
          <button type="button" disabled={clampedIdx === weeks.length - 1} onClick={() => setWeekIdx(clampedIdx + 1)}>Sonraki Hafta ▶</button>
        </div>
      )}
      {weekDays.length === 0 ? (
        <p className="hint">Bu hafta için veri yok.</p>
      ) : (
        <>
          <div className="bar-chart-wrap">
            <div className="bar-chart">
              {weekDays.map((d) => (
                <div
                  key={d.dateStr}
                  className={`bar${d.isSunday ? ' bar-sunday' : ''}${missingSet.has(d.dateStr) ? ' bar-missing' : ''}`}
                  style={{ height: `${Math.max(2, (d.total / maxTotal) * 100)}%` }}
                  title={`${dateFormatter.format(new Date(d.dateStr))}: ${missingSet.has(d.dateStr) ? 'veri girilmedi' : formatValue(d.total)}`}
                >
                  <span className="bar-value">{missingSet.has(d.dateStr) ? '—' : formatValue(d.total).replace(' ₺', '')}</span>
                </div>
              ))}
            </div>
            <div className="bar-labels">
              {weekDays.map((d) => <span key={d.dateStr} className="bar-label">{DAY_ABBR[d.dow]}</span>)}
            </div>
          </div>
          {missingDates.length > 0 && (
            <p className="missing-days-warning">
              ⚠ {missingDates.length} gün veri girilmemiş: {missingDates.map((d) => dateFormatter.format(new Date(d))).join(', ')} — bu günler ortalamaya dahil edilmedi, geriye dönük girmeyi unutma.
            </p>
          )}
          <p className="hint">
            {includeSunday
              ? (detectMissing ? 'Mavi: hesaba dahil · Kırmızı: veri girilmemiş (ortalamaya dahil değil)' : 'Mavi: hesaba dahil')
              : (detectMissing ? 'Mavi: hesaba dahil · Gri: Pazar (ortalamaya dahil değil) · Kırmızı: veri girilmemiş (ortalamaya dahil değil)' : 'Mavi: hesaba dahil · Gri: Pazar (ortalamaya dahil değil)')}
          </p>
          <p>{avgLabel}: <strong>{formatValue(avg)}</strong></p>
        </>
      )}
    </div>
  );
}

function ShopComparisonChart({ shops, summaries, year, month }) {
  const rows = shops
    .map((s) => ({ name: s.name, avg: summaries[s.id] ? dailyAverage(summaries[s.id].dailyIncome, year, month, s.name === 'Hacıoğulları') : null }))
    .filter((r) => r.avg !== null);
  if (rows.length === 0) return null;
  const maxAvg = Math.max(1, ...rows.map((r) => r.avg));
  const total = rows.reduce((s, r) => s + r.avg, 0);

  return (
    <div className="report-box">
      <h4>Dükkan Karşılaştırma — Günlük Ortalama Ciro</h4>
      <div className="compare-chart">
        {rows.map((r) => (
          <div className="compare-row" key={r.name}>
            <span className="compare-label">{r.name}</span>
            <div className="compare-bar-track">
              <div className="compare-bar-fill" style={{ width: `${(r.avg / maxAvg) * 100}%` }} />
            </div>
            <span className="compare-value">{formatMoney(r.avg)}</span>
          </div>
        ))}
      </div>
      <p className="hint">Toplam (iki dükkan): <strong>{formatMoney(total)}</strong></p>
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
  const [cards, setCards] = useState([]);
  const [showReport, setShowReport] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [weekStart, setWeekStart] = useState(() => toDateStr(mondayOf(new Date())));
  const [weekPdfBusy, setWeekPdfBusy] = useState(false);
  const [weekPdfError, setWeekPdfError] = useState(null);
  const [reportMode, setReportMode] = useState('separate');
  const [waste, setWaste] = useState([]);

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
      const daysInMonth = new Date(year, month, 0).getDate();
      const monthStr = String(month).padStart(2, '0');
      const [cardList, wasteList] = await Promise.all([
        api.creditCardsList(),
        api.wasteLogList({ shop_id: hacId, from: `${year}-${monthStr}-01`, to: `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}` }),
      ]);
      setCards(cardList);
      setWaste(wasteList);
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
            </div>
          </div>
        );
      })}

      {(() => {
        const validSums = shops.map((s) => summaries[s.id]).filter(Boolean);
        if (validSums.length === 0) return null;
        const totalIncome = validSums.reduce((s, v) => s + v.totalIncome, 0);
        const totalExpense = validSums.reduce((s, v) => s + v.totalExpense, 0);
        const totalBalance = totalIncome - totalExpense;
        return (
          <div className="shop-summary-block">
            <h3>Toplam (İki Dükkan)</h3>
            <div className="summary">
              <span>Toplam Gelir: {formatMoney(totalIncome)}</span>
              <span>Toplam Gider: {formatMoney(totalExpense)}</span>
              <span>Sabit Gider: {formatMoney(summaries[hacId]?.fixedExpense ?? 0)}</span>
              <span className={totalBalance >= 0 ? 'ok' : 'bad'}>Bakiye: {formatMoney(totalBalance)}</span>
              <span>Geçen Ay: {formatMoney(shops.reduce((s, sh) => s + Math.max(0, prevSummaries[sh.id]?.balance ?? 0), 0))}</span>
            </div>
          </div>
        );
      })()}
      <p className="hint">Nakit ve POS gelirleri Günlük sekmesinden girilir, buradaki toplamlar otomatik hesaplanır.</p>

      <section className="section-expense">
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
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.owner} — {c.type}{c.last4 ? ` ••••${c.last4}` : ''} ile ödendi
              </option>
            ))}
          </select>
          <button type="submit">Ekle</button>
        </form>
        <p className="hint">Eklenen ödemeler ilgili firmanın borcuna işlenir — firma bazlı durumu Kredi Kartları sekmesindeki "Firma Borçları" kartlarından takip et.</p>
      </section>

      {hacId && (() => {
        const byCategory = aggregateWasteByCategory(waste);
        const totalKg = byCategory.reduce((s, w) => s + w.total, 0);
        const daily = aggregateWasteDaily(waste);
        return (
          <section>
            <h3>İmha (Fire) — Hacıoğulları</h3>
            {waste.length === 0 ? (
              <p className="hint">Bu ay için imha kaydı yok. Günlük sekmesinden (Hacıoğulları seçiliyken) "İmha (Fire) Takibi" ile ekleyebilirsin.</p>
            ) : (
              <ul className="report-list">
                {byCategory.map((w) => (
                  <li key={w.category}><span>{w.category}</span><span>{formatKg(w.total)}</span></li>
                ))}
                <li><span><strong>Toplam</strong></span><span><strong>{formatKg(totalKg)}</strong></span></li>
              </ul>
            )}
            <DailyRevenueChart
              title="İmha — Haftalık Toplam"
              dailyIncome={daily}
              year={year}
              month={month}
              formatValue={formatKg}
              avgLabel="Haftalık Günlük Ortalama İmha"
              detectMissing={false}
              includeSunday
            />
          </section>
        );
      })()}

      <section>
        <button type="button" className="file-btn" onClick={() => setShowReport((v) => !v)}>
          {showReport ? 'Özet Raporunu Gizle' : 'Özet Raporu Göster'}
        </button>
        <button
          type="button"
          className="file-btn"
          disabled={pdfBusy}
          onClick={async () => {
            setPdfBusy(true);
            setPdfError(null);
            try {
              await generateMonthlyReportPdf({ year, month, shops });
            } catch (err) {
              setPdfError(err.message);
            } finally {
              setPdfBusy(false);
            }
          }}
        >
          {pdfBusy ? 'PDF Hazırlanıyor...' : '📄 PDF İndir'}
        </button>
        {pdfError && <p className="bad">{pdfError}</p>}

        <div className="week-pdf-row">
          <button type="button" className="edit-link" onClick={() => setWeekStart((ws) => { const d = new Date(ws + 'T00:00:00'); d.setDate(d.getDate() - 7); return toDateStr(d); })}>◀ Önceki Hafta</button>
          <span className="hint">
            {weekDateFormatter.format(new Date(weekStart + 'T00:00:00'))} - {weekDateFormatter.format(new Date(new Date(weekStart + 'T00:00:00').getTime() + 6 * 86400000))}
          </span>
          <button type="button" className="edit-link" onClick={() => setWeekStart((ws) => { const d = new Date(ws + 'T00:00:00'); d.setDate(d.getDate() + 7); return toDateStr(d); })}>Sonraki Hafta ▶</button>
          <button
            type="button"
            className="file-btn"
            disabled={weekPdfBusy}
            onClick={async () => {
              setWeekPdfBusy(true);
              setWeekPdfError(null);
              try {
                await generateWeeklyReportPdf({ weekStart, shops });
              } catch (err) {
                setWeekPdfError(err.message);
              } finally {
                setWeekPdfBusy(false);
              }
            }}
          >
            {weekPdfBusy ? 'PDF Hazırlanıyor...' : '📄 Haftalık PDF İndir'}
          </button>
        </div>
        {weekPdfError && <p className="bad">{weekPdfError}</p>}

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
              {sum.otherExpenseDetails?.length > 0 && (
                <>
                  <p className="hint">"Diğer" içindeki 100 ₺ üzeri harcamalar:</p>
                  <ul className="report-list">
                    {sum.otherExpenseDetails.map((r, i) => (
                      <li key={i}><span>{r.note || '(not yok)'} — {r.date}</span><span>{formatMoney(r.amount)}</span></li>
                    ))}
                  </ul>
                </>
              )}
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
          const combinedOtherDetails = validSums
            .flatMap((s) => s.otherExpenseDetails || [])
            .sort((a, b) => b.amount - a.amount);
          return (
            <div className="report-box">
              <h4>Tüm Dükkanlar (Toplu) — Kategori Bazlı Gider</h4>
              {combinedCategory.length === 0 && <p className="hint">Bu ay kayıt yok.</p>}
              <ul className="report-list">
                {combinedCategory.map((r) => (
                  <li key={r.category}><span>{r.category}</span><span>{formatMoney(r.total)}</span></li>
                ))}
              </ul>
              {combinedOtherDetails.length > 0 && (
                <>
                  <p className="hint">"Diğer" içindeki 100 ₺ üzeri harcamalar:</p>
                  <ul className="report-list">
                    {combinedOtherDetails.map((r, i) => (
                      <li key={i}><span>{r.note || '(not yok)'} — {r.date}</span><span>{formatMoney(r.amount)}</span></li>
                    ))}
                  </ul>
                </>
              )}
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
        <h3>İstatistik</h3>
        {shops.map((s) => {
          const sum = summaries[s.id];
          if (!sum) return null;
          return <DailyRevenueChart key={s.id} title={`${s.name} — Günlük Ciro`} dailyIncome={sum.dailyIncome} year={year} month={month} includeSunday={s.name === 'Hacıoğulları'} />;
        })}

        <ShopComparisonChart shops={shops} summaries={summaries} year={year} month={month} />
      </section>
    </div>
  );
}
