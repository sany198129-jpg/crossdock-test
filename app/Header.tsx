export default function Header() {
  return (
    <header style={{ backgroundColor: 'white', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #d32f2f' }}>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d32f2f' }}>МАКСИДОМ</div>
      <nav style={{ display: 'flex', gap: '20px' }}>
        <a href="#">Каталог</a>
        <a href="#">Акции</a>
        <a href="#">Корзина (0)</a>
      </nav>
    </header>
  );
}