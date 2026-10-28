export default function Header() {
  return (
    <header className="bg-white shadow-md p-4 flex justify-between items-center border-b-2 border-red-600">
      <div className="text-2xl font-bold text-red-600">МАКСИДОМ</div>
      <nav className="flex gap-4">
        <a href="#" className="hover:text-red-600">Каталог</a>
        <a href="#" className="hover:text-red-600">Акции</a>
        <a href="#" className="hover:text-red-600">Корзина (0)</a>
      </nav>
    </header>
  );
}