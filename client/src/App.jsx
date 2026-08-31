import { useEffect, useState } from 'react';
import { api } from './api';
import { getToken, getDefaultShop } from './auth';
import Login from './Login';
import DailyTab from './DailyTab';
import MonthlyTab from './MonthlyTab';
import CreditCardsTab from './CreditCardsTab';
import './App.css';

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [shops, setShops] = useState(null);
  const [tab, setTab] = useState('daily');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authed) return;
    api.shops().then(setShops).catch((e) => setError(e.message));
  }, [authed]);

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;
  if (error) return <div className="app"><p className="bad">Bağlantı hatası: {error}</p></div>;
  if (!shops) return <div className="app"><p>Yükleniyor...</p></div>;

  return (
    <div className="app">
      <h1>Gelir Gider Takip</h1>
      <nav className="tabs">
        <button className={tab === 'daily' ? 'active' : ''} onClick={() => setTab('daily')}>Günlük</button>
        <button className={tab === 'monthly' ? 'active' : ''} onClick={() => setTab('monthly')}>Aylık</button>
        <button className={tab === 'cards' ? 'active' : ''} onClick={() => setTab('cards')}>Kredi Kartları</button>
      </nav>
      {tab === 'daily' && <DailyTab shops={shops} defaultShopName={getDefaultShop()} />}
      {tab === 'monthly' && <MonthlyTab shops={shops} />}
      {tab === 'cards' && <CreditCardsTab />}
    </div>
  );
}
