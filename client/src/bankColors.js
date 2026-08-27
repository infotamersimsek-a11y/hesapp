const BANKS = [
  { name: 'Ziraat Bankası', match: /ziraat/i, color: '#00693C' },
  { name: 'Türkiye İş Bankası', match: /i[şs] ?bankas[ıi]|isbank/i, color: '#002856' },
  { name: 'Garanti BBVA', match: /garanti/i, color: '#009B8D' },
  { name: 'Yapı Kredi', match: /yap[ıi] ?kredi/i, color: '#003882' },
  { name: 'Akbank', match: /akbank/i, color: '#EC1C24' },
  { name: 'Halkbank', match: /halkbank/i, color: '#004990' },
  { name: 'VakıfBank', match: /vak[ıi]f ?bank/i, color: '#FFC72C' },
  { name: 'QNB Finansbank', match: /qnb|finansbank/i, color: '#6E2585' },
  { name: 'DenizBank', match: /deniz ?bank/i, color: '#0046AD' },
  { name: 'TEB', match: /\bteb\b/i, color: '#00A651' },
];

export const TURKISH_BANKS = BANKS.map((b) => b.name);

export function getBankColor(name) {
  const found = BANKS.find((b) => b.match.test(name));
  return found ? found.color : '#9e9e9e';
}

export function getContrastText(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1a1a' : '#ffffff';
}
