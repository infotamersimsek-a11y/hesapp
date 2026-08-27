export function formatMoney(amount) {
  const n = Number(amount);
  if (Math.abs(n) >= 1000) {
    const thousands = Math.round((n / 1000) * 10) / 10;
    return `${thousands.toLocaleString('tr-TR')} bin ₺`;
  }
  return `${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`;
}
