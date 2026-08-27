import { useState } from 'react';
import { login } from './auth';

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(password);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-box" onSubmit={submit}>
        <h1>Gelir Gider Takip</h1>
        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        {error && <p className="bad">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Giriş yapılıyor...' : 'Giriş Yap'}</button>
      </form>
    </div>
  );
}
