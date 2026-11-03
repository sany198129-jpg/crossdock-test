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

// Типоразмеры — коэффициент к базовой европалете (PAL_STD = 1).
//
// Экономика дробления: заказы сборной поставки дробятся на коробки. Коэффициенты
// коробок подобраны так, чтобы 2–3 коробки в сумме давали европаллету
// (0,6 + 0,4 = 1,0; 0,4 + 0,3 + 0,3 = 1,0), а 4 коробки стоили дороже паллеты
// (минимум 4 × 0,3 = 1,2 > 1,0). Поэтому далее 3 частей дробить невыгодно —
// поставщику выгоднее выбрать типоразмер паллеты. Дробных «долей паллеты»
// (1/2, 1/3, 1/4 …) в справочнике нет намеренно.
export const palletSizes: PalletSize[] = [
  { value: 'BOX_STD', label: 'BOX_STD — Коробка, до 60×40×60 см, до 25 кг', coefficient: 0.3, maxWeightKg: 25 },
  { value: 'BOX_L', label: 'BOX_L — Большая коробка, до 60×40×80 см, до 40 кг', coefficient: 0.4, maxWeightKg: 40 },
  { value: 'BIG_BOX', label: 'BIG_BOX — Крупная коробка без поддона, основание до 800×600 мм, высота до 120 см, до 25 кг', coefficient: 0.6, maxWeightKg: 25 },
  { value: 'BUNDLE', label: 'BUNDLE — Вязанка (негабарит), длина 60–150 см, до 25 кг', coefficient: 0.7, maxWeightKg: 25 },
  { value: 'PAL_STD', label: 'PAL_STD — Европалета стандарт, 800×1200 мм, высота до 180 см', coefficient: 1, maxWeightKg: 1000 },
  { value: 'PAL_FIN', label: 'PAL_FIN — Финская палета, 1000×1200 мм', coefficient: 1.2, maxWeightKg: 1000 },
  { value: 'PAL_MIX', label: 'PAL_MIX — Финская палета для смесей и ванн, 1000×1200 мм', coefficient: 1.5, maxWeightKg: 1000 },
  { value: 'PAL_LONG', label: 'PAL_LONG — Длинномер (двери, МДФ), длина более 150 см до 240 см', coefficient: 2 },
  { value: 'PAL_PROF', label: 'PAL_PROF — Профили, столешницы, длинные изделия до 300 см', coefficient: 2.5 },
  { value: 'PAL_XL', label: 'PAL_XL — Особо габаритное, длинные товары до 360 см', coefficient: 3 },
];

// Семейство коробок, которыми система дробит заказы сборной на ГЕ.
// 0,3 / 0,4 / 0,6 — разные коэффициенты, суммой дающие европаллету.
const SPLIT_BOX_POOL = ['BOX_STD', 'BOX_L', 'BIG_BOX'];

const COEFFICIENT_EPSILON = 1e-9;

// Сборная поставка (дробление заказов на коробки) доступна только для
// европаллеты: если выбран любой другой типоразмер ГЕ, дробить нельзя —
// указывается только типоразмер каждого заказа, и каждый заказ тарифицируется
// целиком по своему коэффициенту.
export const ASSEMBLY_SIZE_CODE = 'PAL_STD';

export function isAssemblyAllowed(geSize: PalletSize): boolean {
  return geSize.value === ASSEMBLY_SIZE_CODE;
}

// Коэффициент для показа: запятая как десятичный разделитель, без лишних нулей.
export function formatCoefficient(value: number): string {
  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

// Предлагаемые типоразмеры заказов, размещённых на одной ГЕ (автоподбор по ГЕ).
//
// 1 заказ  → целый ГЕ (типоразмер самого ГЕ);
// 2 заказа → BIG_BOX (0,6) + BOX_L (0,4)           = 1,0 — ровно европаллета;
// 3 заказа → BOX_L (0,4) + BOX_STD (0,3) + BOX_STD = 1,0 — ровно европаллета;
// 4+ заказа→ коробок не хватает, берутся минимальные (0,3): сумма 1,2 и больше —
//            дороже паллеты, интерфейс покажет предупреждение.
// Для ГЕ с коэффициентом не 1 (PAL_FIN 1,2, PAL_MIX 1,5) подбор идёт к коэффициенту
// этого ГЕ: PAL_FIN 2 заказа → 0,6 + 0,6 = 1,2; PAL_MIX 3 заказа → 0,6 + 0,6 + 0,3 = 1,5.
// Поставщик может изменить предложенный типоразмер каждого заказа вручную.
export function suggestOrderSizes(
  basePalletSize: PalletSize,
  ordersInGe: number,
): PalletSize[] {
  if (!Number.isInteger(ordersInGe) || ordersInGe < 1) {
    return [];
  }
  if (ordersInGe === 1) {
    return [basePalletSize];
  }

  const pool = SPLIT_BOX_POOL
    .map((code) => palletSizes.find((size) => size.value === code))
    .filter((size): size is PalletSize => Boolean(size));

  // Более 8 заказов на одном ГЕ не перебираем: минимальные коробки в любом случае
  // превышают типоразмер ГЕ, что и покажет предупреждение о дорогом дроблении.
  if (ordersInGe > 8) {
    return Array.from({ length: ordersInGe }, () => pool[0]);
  }

  const target = basePalletSize.coefficient;
  let bestCounts: number[] | null = null;
  let bestDeviation = Infinity;
  let bestSum = Infinity;
  let bestBigCount = Infinity;

  // Перебор комбинаций: counts[i] — сколько коробок типа i взять.
  const enumerate = (poolIndex: number, remaining: number, counts: number[], sum: number) => {
    if (poolIndex === pool.length - 1) {
      const finalCounts = [...counts, remaining];
      const finalSum = sum + pool[poolIndex].coefficient * remaining;
      const deviation = Math.abs(finalSum - target);
      const bigCount = finalCounts[finalCounts.length - 1];
      const better = deviation < bestDeviation - COEFFICIENT_EPSILON
        || (Math.abs(deviation - bestDeviation) <= COEFFICIENT_EPSILON
          && (finalSum < bestSum - COEFFICIENT_EPSILON
            || (Math.abs(finalSum - bestSum) <= COEFFICIENT_EPSILON
              && bigCount < bestBigCount)));
      if (better) {
        bestDeviation = deviation;
        bestSum = finalSum;
        bestBigCount = bigCount;
        bestCounts = finalCounts;
      }
      return;
    }
    for (let take = 0; take <= remaining; take += 1) {
      enumerate(
        poolIndex + 1,
        remaining - take,
        [...counts, take],
        sum + pool[poolIndex].coefficient * take,
      );
    }
  };

  enumerate(0, ordersInGe, [], 0);

  const sizes: PalletSize[] = [];
  (bestCounts ?? []).forEach((boxCount, poolIndex) => {
    for (let boxIndex = 0; boxIndex < boxCount; boxIndex += 1) {
      sizes.push(pool[poolIndex]);
    }
  });
  // Первым заказам — больший типоразмер.
  return sizes.sort((a, b) => b.coefficient - a.coefficient);
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

// Базовая ставка за европаллету по маршруту «РЦ → город магазина».
export function getRouteRate(
  storeCode: string,
  distributionCenter: DistributionCenter,
): number | undefined {
  const destination = getStoreCity(storeCode);
  return destination ? routeRates[distributionCenter][destination] : undefined;
}

export function getTransportCost(
  storeCode: string,
  distributionCenter: DistributionCenter,
  palletSizeCode: string,
  geCount: number,
): number | undefined {
  const rate = getRouteRate(storeCode, distributionCenter);
  const sizeCoefficient = getPalletSize(palletSizeCode)?.coefficient;

  if (rate === undefined || sizeCoefficient === undefined || !Number.isInteger(geCount) || geCount < 1) {
    return undefined;
  }

  return Math.round(geCount * sizeCoefficient * rate);
}

// Стоимость одного заказа: коэффициент его типоразмера × ставка маршрута.
// Сумма по заказам может отличаться от стоимости booked ГЕ: если заказы дробятся
// больше чем на 3 коробки, дробление выходит дороже целой ГЕ — это показывается
// отдельным предупреждением, а не скрыто выравниванием суммы.
export function getOrderCostForCoefficient(rate: number, coefficient: number): number {
  return Math.round(rate * coefficient * 100) / 100;
}
