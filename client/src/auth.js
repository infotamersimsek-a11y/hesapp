const TOKEN_KEY = 'auth_token';
const DEFAULT_SHOP_KEY = 'default_shop';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const getDefaultShop = () => localStorage.getItem(DEFAULT_SHOP_KEY);
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(DEFAULT_SHOP_KEY);
};

export async function login(password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Giriş başarısız');
  setToken(data.token);
  if (data.defaultShop) localStorage.setItem(DEFAULT_SHOP_KEY, data.defaultShop);
}
