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
];

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
