export default function ShopSwitcher({ shops, shopId, onChange }) {
  return (
    <div className="shop-switcher">
      {shops.map((s) => (
        <button
          key={s.id}
          type="button"
          className={String(shopId) === String(s.id) ? 'active' : ''}
          onClick={() => onChange(s.id)}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}
