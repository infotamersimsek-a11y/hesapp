function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildMonthDays(dailyIncome, year, month, includeSunday = false) {
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const lastDay = isCurrentMonth ? Math.min(today.getDate(), daysInMonth) : daysInMonth;
  const byDate = new Map(dailyIncome.map((d) => [d.date.slice(0, 10), d.total]));
  const todayStr = formatYMD(today);

  const days = Array.from({ length: lastDay }, (_, i) => {
    const d = new Date(year, month - 1, i + 1);
    const dateStr = formatYMD(d);
    const dow = d.getDay();
    return { dateStr, total: byDate.get(dateStr) ?? 0, isSunday: dow === 0 && !includeSunday, dow };
  });

  return { days, isCurrentMonth, todayStr, byDate };
}

export function analyzeDaySet(daySet, isCurrentMonth, todayStr, byDate) {
  const missingDates = [];
  const businessDays = daySet.filter((d) => {
    if (d.isSunday) return false;
    if (byDate.has(d.dateStr)) return true;
    if (isCurrentMonth && d.dateStr === todayStr) return false;
    missingDates.push(d.dateStr);
    return false;
  });
  const avg = businessDays.length ? businessDays.reduce((s, d) => s + d.total, 0) / businessDays.length : 0;
  return { avg, missingDates };
}

export function analyzeMonthDays(dailyIncome, year, month, includeSunday = false) {
  const { days, isCurrentMonth, todayStr, byDate } = buildMonthDays(dailyIncome, year, month, includeSunday);
  const { avg, missingDates } = analyzeDaySet(days, isCurrentMonth, todayStr, byDate);
  return { days, avg, missingDates };
}
