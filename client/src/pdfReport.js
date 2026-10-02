import { api } from './api';
import { formatMoney } from './format';
import { analyzeMonthDays } from './monthDays';

const monthYearFormatter = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
const generatedFormatter = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short' });

const BRAND = [14, 107, 92];

export async function generateMonthlyReportPdf({ year, month, shops }) {
  const [{ jsPDF }, { default: autoTable }, { arialRegularBase64 }, { arialBoldBase64 }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    import('./fonts/arialRegularBase64.js'),
    import('./fonts/arialBoldBase64.js'),
  ]);

  const hacId = shops.find((s) => s.name === 'Hacıoğulları')?.id;

  const [combined, ...perShop] = await Promise.all([
    api.monthlySummary({ year, month }),
    ...shops.map((s) => api.monthlySummary({ shop_id: s.id, year, month })),
  ]);

  let waste = [];
  if (hacId) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, '0');
    waste = await api.wasteLogList({ shop_id: hacId, from: `${year}-${monthStr}-01`, to: `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}` });
  }

  const debtPaid = await api.creditCardsDebtPaid({ year, month });

  const doc = new jsPDF();
  doc.addFileToVFS('Arial.ttf', arialRegularBase64);
  doc.addFont('Arial.ttf', 'Arial', 'normal');
  doc.addFileToVFS('Arial-Bold.ttf', arialBoldBase64);
  doc.addFont('Arial-Bold.ttf', 'Arial', 'bold');
  doc.setFont('Arial', 'normal');

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 20;

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - 16) {
      doc.addPage();
      y = 20;
    }
  };

  const sectionTitle = (text) => {
    ensureSpace(14);
    doc.setFont('Arial', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text(text, margin, y);
    y += 6;
  };

  const tableDefaults = {
    margin: { left: margin, right: margin },
    styles: { font: 'Arial', fontSize: 10, textColor: [40, 40, 40] },
    headStyles: { fillColor: BRAND, textColor: 255, font: 'Arial', fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 246, 242] },
    theme: 'grid',
  };

  // Header
  doc.setFont('Arial', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...BRAND);
  doc.text('Gelir Gider Takip', margin, y);
  y += 8;
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text(`Aylık Özet Raporu — ${monthYearFormatter.format(new Date(year, month - 1, 1))}`, margin, y);
  y += 7;
  doc.setFont('Arial', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 130);
  doc.text(`Oluşturulma: ${generatedFormatter.format(new Date())}`, margin, y);
  y += 6;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Genel Özet
  sectionTitle('Genel Özet');
  autoTable(doc, {
    ...tableDefaults,
    startY: y,
    head: [['', 'Toplam Gelir', 'Toplam Gider', 'Bakiye']],
    body: [
      ['İki Dükkan Toplamı', formatMoney(combined.totalIncome), formatMoney(combined.totalExpense), formatMoney(combined.balance)],
      ...perShop.map((s, i) => [shops[i].name, formatMoney(s.totalIncome), formatMoney(s.totalExpense), formatMoney(s.balance)]),
    ],
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Kart Borcu — Ay Başı / Şimdi (ne kadar ödendi)
  if (debtPaid.byCard.length > 0) {
    sectionTitle(`Kredi Kartı Borcu — Ay Başı / Şimdi (Toplam Ödenen: ${formatMoney(debtPaid.totalPaid)})`);
    const hasFallback = debtPaid.byCard.some((c) => !c.isMonthStart);
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      head: [['Kart', 'Başlangıç Borcu', 'Şimdiki Borç', 'Ödenen']],
      body: debtPaid.byCard.map((c) => [
        `${c.name} ${c.owner}`,
        c.isMonthStart ? formatMoney(c.startDebt) : `${formatMoney(c.startDebt)} (${dateFormatter.format(new Date(c.startDate))} itibarıyla)`,
        formatMoney(c.currentDebt),
        formatMoney(c.paid),
      ]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      styles: { ...tableDefaults.styles, fontSize: hasFallback ? 9 : 10 },
    });
    y = doc.lastAutoTable.finalY + 4;
    if (hasFallback) {
      doc.setFont('Arial', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('* Bazı kartlar için ay başından önce kayıt yok, o kartın sistemdeki ilk kayıt tarihi baz alındı.', margin, y);
      y += 6;
    }
    y += 6;
  }

  // Veri Girilmeyen Günler (dükkan bazlı eksik gün tespiti)
  const missingByShop = shops.map((s, i) => {
    const { missingDates } = analyzeMonthDays(perShop[i].dailyIncome, year, month, s.name === 'Hacıoğulları');
    return { shop: s.name, missingDates };
  });
  if (missingByShop.some((m) => m.missingDates.length > 0)) {
    sectionTitle('Veri Girilmeyen Günler');
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      head: [['Dükkan', 'Eksik Gün Sayısı', 'Tarihler']],
      body: missingByShop
        .filter((m) => m.missingDates.length > 0)
        .map((m) => [m.shop, String(m.missingDates.length), m.missingDates.map((d) => dateFormatter.format(new Date(d))).join(', ')]),
      columnStyles: { 1: { halign: 'center', cellWidth: 28 } },
      styles: { ...tableDefaults.styles, fontSize: 9 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Kategori Bazlı Giderler
  if (combined.expenseByCategory.length > 0) {
    sectionTitle('Kategori Bazlı Giderler (İki Dükkan)');
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      head: [['Kategori', 'Tutar']],
      body: combined.expenseByCategory.map((r) => [r.category, formatMoney(r.total)]),
      columnStyles: { 1: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Sabit Gider — Firma Bazlı
  if (combined.expenseByVendor.length > 0) {
    sectionTitle('Sabit Gider — Firma Bazlı');
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      head: [['Firma', 'Tutar']],
      body: combined.expenseByVendor.map((r) => [r.vendor, formatMoney(r.total)]),
      columnStyles: { 1: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // 500 TL Üzeri Harcamalar
  if (combined.largeExpenses.length > 0) {
    sectionTitle('500 ₺ Üzeri Harcamalar');
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      head: [['Tarih', 'Açıklama', 'Tutar']],
      body: combined.largeExpenses.map((r) => [
        r.date ? dateFormatter.format(new Date(r.date)) : '—',
        `${r.label}${r.note ? ' — ' + r.note : ''}`,
        formatMoney(r.amount),
      ]),
      columnStyles: { 0: { cellWidth: 22 }, 2: { halign: 'right', cellWidth: 30 } },
      styles: { ...tableDefaults.styles, fontSize: 9 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // İmha (Fire) — Hacıoğulları
  if (waste.length > 0) {
    const byCategory = new Map();
    let totalKg = 0;
    for (const w of waste) {
      byCategory.set(w.category, (byCategory.get(w.category) || 0) + Number(w.amount_kg));
      totalKg += Number(w.amount_kg);
    }
    sectionTitle('İmha (Fire) — Hacıoğulları');
    autoTable(doc, {
      ...tableDefaults,
      startY: y,
      head: [['Kategori', 'Toplam']],
      body: [
        ...Array.from(byCategory.entries()).map(([c, t]) => [c, `${t.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} kg`]),
        ['Toplam', `${totalKg.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} kg`],
      ],
      columnStyles: { 1: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('Arial', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Sayfa ${i} / ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  doc.save(`ozet-rapor-${year}-${String(month).padStart(2, '0')}.pdf`);
}
