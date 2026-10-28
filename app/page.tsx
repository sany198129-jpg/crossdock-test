'use client';
import { useEffect, useState } from 'react';
import { formatPrice, products, readCartItems, type CartItems, writeCartItems } from './store';

const categories = [
  { name: 'Сантехника', image: 'photo-1620626011761-996317b8d101', color: 'blue' },
  { name: 'Уборка', image: 'photo-1585421514284-efb74c2b69ba', color: 'sand' },
  { name: 'Двери и фурнитура', image: 'photo-1503602642458-232111445657', color: 'lilac' },
  { name: 'Строительство', image: 'photo-1600607687939-ce8a6c25118c', color: 'yellow' },
  { name: 'Мебель', image: 'photo-1499933374294-4584851497cc', color: 'pink' },
  { name: 'Сад и дача', image: 'photo-1416879595882-3373a0480b5b', color: 'green' },
];

const heroSlides = [
  { eyebrow: 'Сезон больших открытий', title: 'Время обновить', highlight: 'сад и дачу', description: 'Инструменты, растения и всё для отдыха на свежем воздухе.', cta: 'Выбрать для дачи', offer: 'до −35%', image: 'photo-1416879595882-3373a0480b5b', alt: 'Зелёный сад и товары для дачного сезона' },
  { eyebrow: 'Спецпредложения недели', title: 'Ремонт проще,', highlight: 'чем кажется', description: 'Нужные материалы и инструменты по специальным ценам.', cta: 'Смотреть акции', offer: '−20%', image: 'photo-1600607687939-ce8a6c25118c', alt: 'Светлый интерьер после ремонта' },
  { eyebrow: 'Идеи для уютного дома', title: 'Создайте место,', highlight: 'куда хочется', description: 'Мебель, свет и детали, которые меняют привычное пространство.', cta: 'Найти вдохновение', offer: 'ХИТЫ', image: 'photo-1600210492486-724fe5c67fb0', alt: 'Уютная современная гостиная' },
];

export default function Page() {
  const [cartItems, setCartItems] = useState<CartItems>(() => readCartItems());
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Все товары');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const cartCount = Object.values(cartItems).reduce((total, quantity) => total + quantity, 0);
  const slide = heroSlides[activeSlide];
  const compareProducts = products.filter((product) => compareIds.includes(product.id));

  useEffect(() => {
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % heroSlides.length), 6000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (compareOpen) document.getElementById('compare')?.scrollIntoView({ behavior: 'smooth' });
  }, [compareOpen]);

  const addToCart = (productId: number) => {
    const nextCart = { ...cartItems, [productId]: (cartItems[productId] || 0) + 1 };
    setCartItems(nextCart);
    writeCartItems(nextCart);
  };

  const selectCategory = (categoryName: string) => {
    setActiveCategory(categoryName);
    setCatalogOpen(false);
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  };

  const visibleProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'Все товары'
      || (activeCategory === 'Для дома' ? product.category !== 'Сад и дача' : product.category === activeCategory);
    return matchesSearch && matchesCategory;
  });

  return (
    <main className="site-shell">
      <div className="topline">
        <div className="container topline-inner">
          <button className="city-button" aria-label="Выбрать регион"><span className="pin-icon">⌖</span> Санкт-Петербург <span className="chevron">⌄</span></button>
          <div className="topline-links"><a href="#stores">Магазины</a><a href="#delivery">Доставка и оплата</a><a href="#help">Помощь</a></div>
          <a className="phone-link" href="tel:+78123245555">+7 (812) 324-55-55</a>
        </div>
      </div>

      <header className="main-header">
        <div className="container header-main">
          <a className="brand" href="/" aria-label="Максидом — на главную"><span className="brand-mark">М</span><span className="brand-word">максидом</span></a>
          <label className="search-box">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти товары для дома и ремонта" aria-label="Поиск товаров" />
            <button type="button" aria-label="Искать" onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}>Найти</button>
          </label>
          <div className="header-actions">
            <button className="header-action" aria-label={`Избранное, ${favorites.length} товаров`} onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}><span className="action-icon">♡</span><span>Избранное</span></button>
            <button className="header-action compare-action" aria-label={`Сравнение, ${compareIds.length} товаров`} onClick={() => setCompareOpen(true)}><span className="action-icon">⇄</span><span>Сравнение</span>{compareIds.length > 0 && <b className="cart-count">{compareIds.length}</b>}</button>
            <a className="header-action cart-action" href="/cart"><span className="action-icon">▱</span><span>Корзина</span>{cartCount > 0 && <b className="cart-count">{cartCount}</b>}</a>
          </div>
        </div>
        <nav className="category-nav">
          <div className="container nav-inner">
            <button className="catalog-button" aria-expanded={catalogOpen} onClick={() => setCatalogOpen((open) => !open)}><span>☰</span> Каталог товаров <span className="catalog-chevron">⌄</span></button>
            <a href="#products">Акции</a><a href="#products">Хиты продаж</a><a href="#categories">Идеи для дома</a><a href="#stores">Услуги</a>
            <span className="nav-spacer" />
            <a className="bonus-link" href="#loyalty"><span>✳</span> Программа лояльности</a>
          </div>
          {catalogOpen && <div className="container catalog-menu">{categories.map((category) => <button key={category.name} onClick={() => selectCategory(category.name)}><span>{category.name}</span><b>→</b></button>)}<a className="catalog-menu-offer" href="#services" onClick={() => setCatalogOpen(false)}>Подбор услуг и сервисов <span>↗</span></a></div>}
        </nav>
      </header>

      <div className="container page-content">
        <div className="breadcrumbs"><span>Главная</span><span>/</span><span>Товары для дома и ремонта</span></div>

        <section className="hero" aria-label="Предложение недели">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" /> {slide.eyebrow}</span>
            <h1>{slide.title}<br /><em>{slide.highlight}</em></h1>
            <p>{slide.description}</p>
            <a href="#products" className="hero-cta">{slide.cta} <span>↗</span></a>
            <div className="hero-note"><span className="note-line" /> Выгодные предложения Максидом</div>
          </div>
          <div className="hero-photo" role="img" aria-label={slide.alt} style={{ backgroundImage: `url(https://images.unsplash.com/${slide.image}?auto=format&fit=crop&w=1400&q=90)` }} />
          <div className="hero-stamp"><span>{slide.offer}</span><b>спеццена</b><i>только сейчас</i></div>
          <div className="hero-controls"><button aria-label="Предыдущий баннер" onClick={() => setActiveSlide((activeSlide + heroSlides.length - 1) % heroSlides.length)}>‹</button><div className="hero-pagination">{heroSlides.map((item, index) => <button key={item.eyebrow} aria-label={`Баннер ${index + 1}`} className={index === activeSlide ? 'pagination-active' : ''} onClick={() => setActiveSlide(index)} />)}</div><button aria-label="Следующий баннер" onClick={() => setActiveSlide((activeSlide + 1) % heroSlides.length)}>›</button></div>
        </section>

        <section className="quick-benefits" aria-label="Преимущества">
          <div className="benefit"><span className="benefit-icon benefit-red">↗</span><span><b>Доставка от 1 дня</b><small>бережно и удобно</small></span></div>
          <div className="benefit"><span className="benefit-icon benefit-gray">₽</span><span><b>Оплата как удобно</b><small>онлайн или при получении</small></span></div>
          <div className="benefit"><span className="benefit-icon benefit-gray">✳</span><span><b>Бонусы за покупки</b><small>по программе лояльности</small></span></div>
          <a className="benefit benefit-last" href="#stores"><span className="benefit-icon benefit-gray">⌖</span><span><b>Рядом с вами</b><small>найдите свой магазин</small></span><span className="benefit-arrow">→</span></a>
        </section>

        <section className="category-section" id="categories">
          <div className="section-heading"><div><span className="section-kicker">Найдётся всё</span><h2>Что ищем сегодня?</h2></div><a href="#products" className="text-link">Весь каталог <span>↗</span></a></div>
          <div className="category-grid">
            {categories.map((category) => (
              <button className={`category-tile ${category.color}`} key={category.name} onClick={() => selectCategory(category.name)}>
                <span className="category-image" style={{ backgroundImage: `url(https://images.unsplash.com/${category.image}?auto=format&fit=crop&w=500&q=80)` }} />
                <span className="category-name">{category.name}</span><span className="category-arrow">↗</span>
              </button>
            ))}
          </div>
        </section>

        <section className="products-section" id="products">
          <div className="section-heading products-heading"><div><span className="section-kicker">Выбирают покупатели</span><h2>Популярное сейчас</h2></div><div className="product-tabs"><button className={activeCategory === 'Все товары' ? 'tab-active' : ''} onClick={() => setActiveCategory('Все товары')}>Все товары</button><button className={activeCategory === 'Сад и дача' ? 'tab-active' : ''} onClick={() => setActiveCategory('Сад и дача')}>Для дачи</button><button className={activeCategory === 'Для дома' ? 'tab-active' : ''} onClick={() => setActiveCategory('Для дома')}>Для дома</button></div></div>
          {visibleProducts.length ? <div className="product-grid">
            {visibleProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-picture">
                  <img src={product.image} alt={product.name} loading="lazy" />
                  {product.badge && <span className={`product-badge ${product.oldPrice ? 'badge-sale' : ''}`}>{product.badge}</span>}
                  <button className={`favorite-button ${favorites.includes(product.id) ? 'is-favorite' : ''}`} aria-label={favorites.includes(product.id) ? 'Убрать из избранного' : 'Добавить в избранное'} onClick={() => setFavorites((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])}>♡</button>
                  <button className={`compare-product-button ${compareIds.includes(product.id) ? 'is-compared' : ''}`} aria-label={compareIds.includes(product.id) ? 'Убрать из сравнения' : 'Добавить к сравнению'} aria-pressed={compareIds.includes(product.id)} onClick={() => { setCompareIds((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id]); setCompareOpen(true); }}>⇄</button>
                </div>
                <div className="product-info"><span className="product-category">{product.category}</span><h3>{product.name}</h3><span className="product-code">Код: {product.code}</span><div className="product-price-row"><div>{product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}<strong>{formatPrice(product.price)}{product.unit && <small>/{product.unit}</small>}</strong></div><button className="add-button" aria-label={`Добавить в корзину: ${product.name}`} onClick={() => addToCart(product.id)}><span>+</span><b>В корзину</b></button></div></div>
              </article>
            ))}
          </div> : <p className="empty-results">Ничего не найдено. Попробуйте изменить запрос или выбрать другую категорию.</p>}
          {compareOpen && <div className="compare-panel" id="compare"><div className="compare-panel-heading"><div><span className="section-kicker">Сравнение товаров</span><h3>{compareProducts.length ? `Выбрано: ${compareProducts.length}` : 'Добавьте товары кнопкой ⇄'}</h3></div><button aria-label="Закрыть сравнение" onClick={() => setCompareOpen(false)}>×</button></div>{compareProducts.length > 0 && <div className="compare-list">{compareProducts.map((product) => <div className="compare-item" key={product.id}><b>{product.name}</b><span>{formatPrice(product.price)}</span><button aria-label={`Убрать ${product.name} из сравнения`} onClick={() => setCompareIds((current) => current.filter((id) => id !== product.id))}>Убрать</button></div>)}</div>}</div>}
        </section>

        <section className="services-section" id="services"><div className="section-heading"><div><span className="section-kicker">Помогаем на каждом этапе</span><h2>Услуги для вашего проекта</h2></div><a href="#services" className="text-link">Все услуги <span>↗</span></a></div><div className="service-grid"><a id="stores" href="#delivery" className="service-card service-red" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=85)' }}><span className="service-icon">↗</span><span id="delivery" className="service-label">Доставка</span><b>Привезём покупки<br />до двери</b><span className="service-link">Рассчитать →</span></a><a href="#services" className="service-card service-gray" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=900&q=85)' }}><span className="service-icon">⌂</span><span className="service-label">Монтаж</span><b>Установим и соберём<br />за вас</b><span className="service-link">Заказать →</span></a><a href="#services" className="service-card service-light" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85)' }}><span className="service-icon">✳</span><span className="service-label">Дизайн-проект</span><b>Спланируем интерьер<br />вместе</b><span className="service-link">Подробнее →</span></a><a href="#services" className="service-card service-dark" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85)' }}><span className="service-icon">▤</span><span className="service-label">Распил материалов</span><b>Подготовим детали<br />по размеру</b><span className="service-link">Узнать →</span></a></div></section>

        <section className="promo-banner" id="loyalty">
          <div className="promo-copy"><span className="promo-kicker">Программа лояльности Максидом</span><h2>Больше покупок.<br />Больше выгоды.</h2><p>Получайте бонусы и оплачивайте ими следующие покупки.</p><a href="#products" className="promo-cta">Узнать о программе <span>↗</span></a></div>
          <div className="promo-number">10<span>%</span></div>
          <span className="promo-footnote">бонусами<br />за покупки</span>
        </section>

        <footer className="site-footer" id="help"><a className="brand footer-brand" href="/"><span className="brand-mark">М</span><span className="brand-word">максидом</span></a><p>Всё для дома, ремонта и дачи</p><div className="footer-links"><a href="#categories">Каталог</a><a href="#products">Акции</a><a href="#delivery">Доставка</a><a href="#help">Контакты</a></div><span className="copyright">© Максидом, 2026</span></footer>
      </div>
    </main>
  );
}