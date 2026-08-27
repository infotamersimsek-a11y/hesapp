export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function assertIsToday(date) {
  if (date !== todayStr()) {
    const err = new Error('Sadece bugünün tarihine kayıt eklenebilir (geçmişe veya geleceğe kayıt eklenemez)');
    err.status = 400;
    throw err;
  }
}
