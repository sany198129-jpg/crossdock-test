export type DistributionCenter = 'Москва' | 'Санкт-Петербург';

export function isDistributionCenter(value: string): value is DistributionCenter {
  return value === 'Москва' || value === 'Санкт-Петербург';
}

export type PalletSize = {
  value: string;
  label: string;
  coefficient: number;
  maxWeightKg?: number;
};

export const palletSizes: PalletSize[] = [
  { value: 'BOX_STD', label: 'BOX_STD — Коробка, до 60×40×60 см, до 25 кг', coefficient: 0.3, maxWeightKg: 25 },
  { value: 'BUNDLE', label: 'BUNDLE — Вязанка (негабарит), длина 60–150 см, до 25 кг', coefficient: 0.7, maxWeightKg: 25 },
  { value: 'BIG_BOX', label: 'BIG_BOX — Крупная коробка без поддона, основание до 800×600 мм, высота до 120 см, до 25 кг', coefficient: 0.6, maxWeightKg: 25 },
  { value: 'PAL_STD', label: 'PAL_STD — Европалета стандарт, 800×1200 мм, высота до 180 см', coefficient: 1, maxWeightKg: 1000 },
  { value: 'PAL_FIN', label: 'PAL_FIN — Финская палета, 1000×1200 мм', coefficient: 1.2, maxWeightKg: 1000 },
  { value: 'PAL_MIX', label: 'PAL_MIX — Финская палета для смесей и ванн, 1000×1200 мм', coefficient: 1.5, maxWeightKg: 1000 },
  { value: 'PAL_LONG', label: 'PAL_LONG — Длинномер (двери, МДФ), длина более 150 см до 240 см', coefficient: 2 },
  { value: 'PAL_PROF', label: 'PAL_PROF — Профили, столешницы, длинные изделия до 300 см', coefficient: 2.5 },
  { value: 'PAL_XL', label: 'PAL_XL — Особо габаритное, длинные товары до 360 см', coefficient: 3 },
  // Дробные типоразмеры (доли стандартной европалеты). Введены для сборной поставки:
  // заказам на общем ГЕ присваивается типоразмер, равный их доле на этом ГЕ.
  // Доля каждого указана в названии: PAL_HALF — 1/2, PAL_THIRD — 1/3, PAL_QUARTER — 1/4,
  // PAL_FIFTH — 1/5, PAL_SIXTH — 1/6, PAL_EIGHTH — 1/8.
  { value: 'PAL_HALF', label: 'PAL_HALF — Половина паллеты (доля 1/2), 800×600 мм, до 500 кг', coefficient: 0.5, maxWeightKg: 500 },
  { value: 'PAL_THIRD', label: 'PAL_THIRD — Треть паллеты (доля 1/3), до 333 кг', coefficient: 1 / 3, maxWeightKg: 333 },
  { value: 'PAL_QUARTER', label: 'PAL_QUARTER — Четверть паллеты (доля 1/4), до 250 кг', coefficient: 0.25, maxWeightKg: 250 },
  { value: 'PAL_FIFTH', label: 'PAL_FIFTH — Пятая часть паллеты (доля 1/5), до 200 кг', coefficient: 0.2, maxWeightKg: 200 },
  { value: 'PAL_SIXTH', label: 'PAL_SIXTH — Шестая часть паллеты (доля 1/6), до 166 кг', coefficient: 1 / 6, maxWeightKg: 166 },
  { value: 'PAL_EIGHTH', label: 'PAL_EIGHTH — Восьмая часть паллеты (доля 1/8), до 125 кг', coefficient: 0.125, maxWeightKg: 125 },
];

// Типоразмеры-доли паллеты. Заказу присваивается существующий типоразмер из этого
// списка, если его доля на ГЕ совпадает с ним по коэффициенту (независимо от базового
// типа ГЕ: например, половина ГЕ PAL_HALF — это PAL_QUARTER, треть PAL_MIX — PAL_HALF).
// Для остальных долей создаётся производный код вида PAL_STD_1_7 или PAL_FIN_1_2.
const FRACTIONAL_SIZE_CODES = [
  'PAL_HALF', 'PAL_THIRD', 'PAL_QUARTER', 'PAL_FIFTH', 'PAL_SIXTH', 'PAL_EIGHTH',
];

const SHARE_EPSILON = 1e-9;

// Коэффициент для показа: запятая как десятичный разделитель, без лишних нулей.
function formatCoefficient(value: number): string {
  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

// Возвращает типоразмер, присваиваемый заказу, который занимает долю 1/shareDenominator
// на ГЕ с базовым типоразмером basePalletSize (например, 3 заказа на одном европалете → 1/3).
// Порядок присвоения:
// 1) доля 1/1 (целое ГЕ) — базовый типоразмер;
// 2) доля совпадает по коэффициенту с типоразмером-долей из справочника — он;
// 3) иначе — производный код «{база}_1_{N}» с комментарием доли в названии.
export function getOrderPalletSize(
  basePalletSize: PalletSize,
  shareDenominator: number,
): PalletSize {
  if (!Number.isInteger(shareDenominator) || shareDenominator <= 1) {
    return basePalletSize;
  }
  const shareCoefficient = basePalletSize.coefficient / shareDenominator;
  const matched = palletSizes.find(
    (size) => FRACTIONAL_SIZE_CODES.includes(size.value)
      && Math.abs(size.coefficient - shareCoefficient) < SHARE_EPSILON,
  );
  if (matched) {
    return matched;
  }
  const code = `${basePalletSize.value}_1_${shareDenominator}`;
  return {
    value: code,
    label: `${code} — Доля 1/${shareDenominator} от ${basePalletSize.value} (коэффициент ${formatCoefficient(shareCoefficient)})`,
    coefficient: shareCoefficient,
  };
}

const storeCities: Record<number, string> = {
  1: 'Санкт-Петербург',
  2: 'Санкт-Петербург',
  3: 'Санкт-Петербург',
  4: 'Санкт-Петербург',
  5: 'Санкт-Петербург',
  6: 'Санкт-Петербург',
  7: 'Санкт-Петербург',
  8: 'Санкт-Петербург',
  9: 'Нижний Новгород',
  10: 'Казань',
  11: 'Екатеринбург',
  12: 'Самара',
  14: 'Уфа',
  16: 'Санкт-Петербург',
  17: 'Санкт-Петербург',
  18: 'Санкт-Петербург',
  19: 'Самара',
  20: 'Москва',
  21: 'Казань',
  22: 'Москва',
  23: 'Москва',
  24: 'Екатеринбург',
  25: 'Воронеж',
  26: 'Пермь',
  27: 'Ростов-на-Дону',
  28: 'Челябинск',
  29: 'Нижний Новгород',
  30: 'Москва',
  51: 'Санкт-Петербург',
};

const routeRates: Record<DistributionCenter, Record<string, number>> = {
  Москва: {
    Воронеж: 3375,
    Екатеринбург: 7400,
    Казань: 4550,
    Москва: 2050,
    'Нижний Новгород': 3200,
    Пермь: 6900,
    'Ростов-на-Дону': 6500,
    Самара: 5000,
    'Санкт-Петербург': 4250,
    Уфа: 6150,
    Челябинск: 7300,
  },
  'Санкт-Петербург': {
    Воронеж: 4600,
    Екатеринбург: 8300,
    Казань: 5550,
    Москва: 3150,
    'Нижний Новгород': 4200,
    Пермь: 8350,
    'Ростов-на-Дону': 7950,
    Самара: 6400,
    'Санкт-Петербург': 1600,
    Уфа: 7100,
    Челябинск: 8350,
  },
};

export function getStoreCity(storeCode: string): string | undefined {
  return storeCities[Number(storeCode)];
}

export function getPalletSize(palletSizeCode: string): PalletSize | undefined {
  return palletSizes.find((size) => size.value === palletSizeCode);
}

export function getTransportCost(
  storeCode: string,
  distributionCenter: DistributionCenter,
  palletSizeCode: string,
  geCount: number,
): number | undefined {
  const destination = getStoreCity(storeCode);
  const rate = destination ? routeRates[distributionCenter][destination] : undefined;
  const sizeCoefficient = getPalletSize(palletSizeCode)?.coefficient;

  if (rate === undefined || sizeCoefficient === undefined || !Number.isInteger(geCount) || geCount < 1) {
    return undefined;
  }

  return Math.round(geCount * sizeCoefficient * rate);
}

// Разбивает базовую стоимость перевозки между заказами пропорционально коэффициентам
// их присвоенных типоразмеров. Гарантия: сумма по заказам в точности равна baseCost
// (расчёт в копейках, остаток распределяется по первым заказам) — итог по заказам
// не может стать меньше базовой стоимости.
export function getOrderCosts(
  baseCost: number,
  orderCoefficients: number[],
): number[] {
  const totalKopecks = Math.round(baseCost * 100);
  const weightsSum = orderCoefficients.reduce((sum, coefficient) => sum + coefficient, 0);
  if (orderCoefficients.length === 0 || weightsSum <= 0) {
    return [];
  }
  const kopecks = orderCoefficients.map(
    (coefficient) => Math.floor((totalKopecks * coefficient) / weightsSum + 1e-6),
  );
  let remainder = totalKopecks - kopecks.reduce((sum, value) => sum + value, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % kopecks.length, remainder -= 1) {
    kopecks[index] += 1;
  }
  return kopecks.map((value) => value / 100);
}
