export type CartItems = Record<number, number>;

export type Product = {
  id: number;
  code: string;
  name: string;
  category: string;
  price: number;
  oldPrice?: number;
  badge?: string;
  image: string;
  unit?: string;
};

export const CART_STORAGE_KEY = 'maxidom-cart-v1';

export const normalizeCartItems = (value: unknown): CartItems => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalized: CartItems = {};

  Object.entries(value as Record<string, unknown>).forEach(([rawProductId, rawQuantity]) => {
    const productId = Number(rawProductId);
    const quantity = Number(rawQuantity);

    if (!Number.isInteger(productId) || productId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    normalized[productId] = Math.trunc(quantity);
  });

  return normalized;
};

export const readCartItems = (): CartItems => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const storedValue = window.localStorage.getItem(CART_STORAGE_KEY);
    return normalizeCartItems(storedValue ? JSON.parse(storedValue) : {});
  } catch {
    return {};
  }
};

export const writeCartItems = (items: CartItems) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
};

export const products: Product[] = [
  { id: 1, code: '1000515597', name: 'Фильтр стационарный АКВАФОР Кристалл быстросъем для мягкой воды', category: 'Сантехника', price: 3490, oldPrice: 5747, badge: '−39%', image: '/products/filter-akvafor.jpg' },
  { id: 2, code: '1001200347', name: 'Насадка для поломоя РЫЖИЙ КОТ MopM4-Eco Лапша 14х44см полиэстер', category: 'Уборка', price: 213, badge: 'Хит', image: '/products/mop-nozzle.jpg' },
  { id: 3, code: '1001231500', name: 'Ручка дверная RUCETTI RAP-CLASSIC-L 8 OMB античная бронза', category: 'Двери и фурнитура', price: 1370, badge: 'Хит', image: '/products/door-handle.jpg' },
  { id: 4, code: '1001257250', name: 'Ламинат Expert Choice 32кл/8мм Дуб орегон 1285х192мм 2,221м2', category: 'Строительство', price: 681, unit: 'м²', badge: 'Хит', image: '/products/laminate.jpg' },
  { id: 5, code: '1001269982', name: 'Комплект сменных модулей ГЕЙЗЕР Смарт универсальный быстросъем', category: 'Сантехника', price: 2525, badge: 'Хит', image: '/products/filter-cartridges.jpg' },
  { id: 6, code: '1001278640', name: 'Плита потолочная BESTENHAUS 600х600х6мм уп. 22шт', category: 'Строительство', price: 3100, badge: 'Только у нас', image: '/products/ceiling-tile.jpg' },
  { id: 7, code: '1001288761', name: 'Стол нераздвижной Консоль 1200х500х880мм дуб галифакс металл/лдсп', category: 'Мебель', price: 8699, badge: 'Хит', image: '/products/console-table.jpg' },
  { id: 8, code: '1001313586', name: 'Культиватор электрический DAEWOO DAT 2000E', category: 'Сад и дача', price: 17390, badge: 'Хит', image: '/products/cultivator.jpg' },
];

export const formatPrice = (price: number) => `${price.toLocaleString('ru-RU')} ₽`;
