import crypto from 'crypto';

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr() {
  return formatDate(new Date());
}

export function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

function checkAdminPassword(password) {
  const expected = Buffer.from(process.env.ADMIN_PASSWORD || '');
  const given = Buffer.from(password || '');
  if (expected.length === 0 || expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}

export function assertDateAllowed(date, adminPassword) {
  const today = todayStr();
  if (date > today) {
    const err = new Error('Gelecek tarihe kayıt girilemez');
    err.status = 400;
    throw err;
  }
  if (date === today || date === yesterdayStr()) return;

  if (!checkAdminPassword(adminPassword)) {
    const err = new Error('Bu tarihe (24 saatten eski) kayıt eklemek için yönetici şifresi gerekli');
    err.status = 403;
    throw err;
  }
}
