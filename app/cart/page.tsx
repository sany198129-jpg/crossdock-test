 'use client';
import { useEffect, useState } from 'react';
 import { formatPrice, products, readCartItems, type CartItems, writeCartItems } from '../store';

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItems>(() => readCartItems());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  const updateQuantity = (productId: number, change: number) => {
    const nextCart = { ...cartItems };
    const nextQuantity = (nextCart[productId] || 0) + change;
    if (nextQuantity > 0) nextCart[productId] = nextQuantity;
    else delete nextCart[productId];
    setCartItems(nextCart);
    writeCartItems(nextCart);
  };

  const cartProducts = products.filter((product) => (cartItems[product.id] || 0) > 0);
  const total = cartProducts.reduce((sum, product) => sum + product.price * (cartItems[product.id] || 0), 0);

  return (
    <main className="cart-page">
      <header className="cart-header"><a className="brand" href="/"><span className="brand-mark">М</span><span className="brand-word">максидом</span></a><a href="/" className="cart-back">← Продолжить покупки</a></header>
      <div className="cart-content">
        <div className="cart-breadcrumbs"><a href="/">Главная</a><span>/</span><span>Корзина</span></div>
        <h1>Корзина{loaded && cartProducts.length > 0 && <span>{cartProducts.length}</span>}</h1>
        {!loaded ? <p className="cart-loading">Загружаем корзину…</p> : cartProducts.length === 0 ? <section className="cart-empty"><span className="cart-empty-icon">▱</span><h2>Пока здесь пусто</h2><p>Добавьте товары из каталога, и они появятся здесь.</p><a className="cart-shop-button" href="/#products">Перейти к покупкам</a></section> : <div className="cart-layout">
          <section className="cart-items" aria-label="Товары в корзине">{cartProducts.map((product) => <article className="cart-item" key={product.id}><div className="cart-product-image"><img src={product.image} alt={product.name} loading="lazy" /></div><div className="cart-product-details"><span>{product.category} · Код: {product.code}</span><h2>{product.name}</h2><div className="cart-quantity"><button aria-label={`Уменьшить количество: ${product.name}`} onClick={() => updateQuantity(product.id, -1)}>−</button><b>{cartItems[product.id]}</b><button aria-label={`Увеличить количество: ${product.name}`} onClick={() => updateQuantity(product.id, 1)}>+</button></div></div><div className="cart-item-price"><b>{formatPrice(product.price * cartItems[product.id])}</b><button onClick={() => updateQuantity(product.id, -cartItems[product.id])}>Удалить</button></div></article>)}</section>
          <aside className="cart-summary"><h2>Ваш заказ</h2><div><span>Товары, {cartProducts.reduce((count, product) => count + cartItems[product.id], 0)} шт.</span><b>{formatPrice(total)}</b></div><div className="cart-total"><span>Итого</span><strong>{formatPrice(total)}</strong></div><button className="checkout-button" onClick={() => window.alert('Оформление заказа скоро появится')}>Перейти к оформлению</button><p>Стоимость доставки рассчитаем при оформлении</p></aside>
        </div>}
      </div>
    </main>
  );
}