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

export function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

export function yesterdayStr() {
  return daysAgoStr(1);
}

const FREE_EDIT_DAYS = 3;

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
  for (let i = 0; i < FREE_EDIT_DAYS; i++) {
    if (date === daysAgoStr(i)) return;
  }

  if (!checkAdminPassword(adminPassword)) {
    const err = new Error(`Bu tarihe (son ${FREE_EDIT_DAYS} günden eski) kayıt eklemek için yönetici şifresi gerekli`);
    err.status = 403;
    throw err;
  }
}
