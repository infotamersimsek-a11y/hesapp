import { getToken, clearToken } from './auth';

const BASE = '/api';

async function request(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const token = getToken();
  const headers = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('Oturum sona erdi, tekrar giriş yapılıyor');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  shops: () => request('/shops'),

  dailyIncomeList: (params) => request(`/daily-income?${new URLSearchParams(params)}`),
  dailyIncomeCreate: (body) => request('/daily-income', { method: 'POST', body: JSON.stringify(body) }),
  dailyIncomeUpdate: (id, body) => request(`/daily-income/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  dailyIncomeDelete: (id) => request(`/daily-income/${id}`, { method: 'DELETE' }),

  dailyExpenseList: (params) => request(`/daily-expense?${new URLSearchParams(params)}`),
  dailyExpenseCreate: (body) => request('/daily-expense', { method: 'POST', body: JSON.stringify(body) }),
  dailyExpenseUpdate: (id, body) => request(`/daily-expense/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  dailyExpenseDelete: (id) => request(`/daily-expense/${id}`, { method: 'DELETE' }),

  monthlyExpenseList: (params) => request(`/monthly-expense?${new URLSearchParams(params)}`),
  monthlyExpenseCreate: (body) => request('/monthly-expense', { method: 'POST', body: JSON.stringify(body) }),
  monthlyExpenseDelete: (id) => request(`/monthly-expense/${id}`, { method: 'DELETE' }),

  dailySummary: (params) => request(`/summary/daily?${new URLSearchParams(params)}`),
  monthlySummary: (params) => request(`/summary/monthly?${new URLSearchParams(params)}`),

  voiceEntry: (formData) => request('/ai/voice-entry', { method: 'POST', body: formData }),
  receiptExpense: (formData) => request('/ai/receipt-expense', { method: 'POST', body: formData }),
  cardBalance: (formData) => request('/ai/card-balance', { method: 'POST', body: formData }),
  debtAdvice: () => request('/ai/debt-advice'),

  creditCardsList: () => request('/credit-cards'),
  creditCardCreate: (body) => request('/credit-cards', { method: 'POST', body: JSON.stringify(body) }),
  creditCardUpdate: (id, body) => request(`/credit-cards/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  creditCardDelete: (id) => request(`/credit-cards/${id}`, { method: 'DELETE' }),
};
