const BASE = '/api';

async function request(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: isForm ? undefined : { 'Content-Type': 'application/json', ...options.headers },
  });
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
  dailyIncomeDelete: (id) => request(`/daily-income/${id}`, { method: 'DELETE' }),

  dailyExpenseList: (params) => request(`/daily-expense?${new URLSearchParams(params)}`),
  dailyExpenseCreate: (body) => request('/daily-expense', { method: 'POST', body: JSON.stringify(body) }),
  dailyExpenseDelete: (id) => request(`/daily-expense/${id}`, { method: 'DELETE' }),

  monthlyExpenseList: (params) => request(`/monthly-expense?${new URLSearchParams(params)}`),
  monthlyExpenseCreate: (body) => request('/monthly-expense', { method: 'POST', body: JSON.stringify(body) }),
  monthlyExpenseDelete: (id) => request(`/monthly-expense/${id}`, { method: 'DELETE' }),

  dailySummary: (params) => request(`/summary/daily?${new URLSearchParams(params)}`),
  monthlySummary: (params) => request(`/summary/monthly?${new URLSearchParams(params)}`),

  voiceEntry: (formData) => request('/ai/voice-entry', { method: 'POST', body: formData }),

  creditCardsList: () => request('/credit-cards'),
  creditCardCreate: (body) => request('/credit-cards', { method: 'POST', body: JSON.stringify(body) }),
  creditCardUpdate: (id, body) => request(`/credit-cards/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  creditCardDelete: (id) => request(`/credit-cards/${id}`, { method: 'DELETE' }),
};
