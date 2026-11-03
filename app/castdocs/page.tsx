'use client';

import JsBarcode from 'jsbarcode';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import styles from './castdocs.module.css';
import {
  getStoreCity,
  getPalletSize,
  getTransportCost,
  getRouteRate,
  getOrderCostForCoefficient,
  suggestOrderSizes,
  formatCoefficient,
  isDistributionCenter,
  isBonusEligibleGe,
  palletSizes,
  BONUS_SIZE,
  BONUS_SIZE_CODE,
  type DistributionCenter,
  type PalletSize,
} from './tariffs';

const storeCodes = Array.from({ length: 30 }, (_, index) => index + 1)
  .filter((code) => code !== 13 && code !== 15)
  .concat(51);

type LabelData = {
  storeCode: string;
  distributionCenter: DistributionCenter;
  storeCity: string;
  supplierCode: string;
  assembly: string;
  orderNumber: string;
  palletSizeLabel: string;
  weight: string;
  temperatureMode: string;
  rcDate: string;
  storeDate: string;
  labelCode: string;
  labelNumber: number;
  labelTotal: number;
  geNumber: number;
  geTotal: number;
  orderShareText: string;
  orderPalletSizeCode: string;
  orderPalletSizeLabel: string;
  orderPalletSizeCoefficient: number;
  orderCost: number;
};

type OrderPlanRow = {
  key: string;
  orderNumber: string;
  geNumber: number;
  positionInGe: number;
  ordersInGe: number;
  suggested: PalletSize;
  chosen: PalletSize;
};

// Бесплатный типоразмер BONUS действует только при жёстких условиях: сборная
// поставка, ГЕ с коэффициентом 1,2 и больше, не больше одного бонуса на ГЕ и
// только как дополнение к обычным заказам (в ГЕ остаётся хотя бы один платный
// заказ). Нарушенные бонусы отбрасываются к предложенному автоподбору.
const sanitizeBonusChoices = (
  rows: OrderPlanRow[],
  basePalletSize: PalletSize,
  assembly: boolean,
): OrderPlanRow[] => {
  const bonusAllowed = assembly && isBonusEligibleGe(basePalletSize);
  const bonusTakenGe = new Set<number>();
  return rows.map((row) => {
    if (row.chosen.value !== BONUS_SIZE_CODE) {
      return row;
    }
    if (bonusAllowed && row.ordersInGe >= 2 && !bonusTakenGe.has(row.geNumber)) {
      bonusTakenGe.add(row.geNumber);
      return row;
    }
    return { ...row, chosen: row.suggested };
  });
};

// Типоразмер заказа по коду: сначала справочник, затем бесплатный BONUS — он
// в palletSizes не входит, но поставщик может выбрать его вручную.
const resolveOrderSize = (code: string): PalletSize | undefined =>
  getPalletSize(code) ?? (code === BONUS_SIZE_CODE ? BONUS_SIZE : undefined);

// Раскладка заказов по ГЕ с типоразмером каждого заказа. Используется и для
// подсказки в форме, и при формировании этикеток — предложенные и фактические
// типоразмеры всегда совпадают. В сборной поставке заказы распределяются по ГЕ
// поровну, типоразмер каждого заказа подставляется по типоразмеру ГЕ (автоподбор
// коробками) и может быть изменён поставщиком (choices — ручной выбор по ключу).
const buildOrderPlan = (
  orders: string[],
  geCount: number,
  basePalletSize: PalletSize,
  assembly: boolean,
  choices: Record<string, string>,
): OrderPlanRow[] => {
  if (!Number.isInteger(geCount) || geCount < 1 || orders.length === 0) {
    return [];
  }
  const rows: OrderPlanRow[] = [];
  if (!assembly) {
    // Несборная поставка: один заказ занимает каждое целое ГЕ.
    for (let geIndex = 0; geIndex < geCount; geIndex += 1) {
      const key = `0:${orders[0]}@${geIndex + 1}`;
      const override = choices[key] ? resolveOrderSize(choices[key]) : undefined;
      rows.push({
        key,
        orderNumber: orders[0],
        geNumber: geIndex + 1,
        positionInGe: 1,
        ordersInGe: 1,
        suggested: basePalletSize,
        chosen: override ?? basePalletSize,
      });
    }
    return sanitizeBonusChoices(rows, basePalletSize, assembly);
  }
  const ordersPerGe = Math.floor(orders.length / geCount);
  const remainder = orders.length % geCount;
  let orderIndex = 0;
  for (let geIndex = 0; geIndex < geCount; geIndex += 1) {
    const ordersInGe = ordersPerGe + (geIndex >= geCount - remainder ? 1 : 0);
    const sizes = suggestOrderSizes(basePalletSize, ordersInGe);
    for (let position = 0; position < ordersInGe; position += 1) {
      const orderNumber = orders[orderIndex];
      const key = `${orderIndex}:${orderNumber}`;
      const override = choices[key] ? resolveOrderSize(choices[key]) : undefined;
      rows.push({
        key,
        orderNumber,
        geNumber: geIndex + 1,
        positionInGe: position + 1,
        ordersInGe,
        suggested: sizes[position] ?? basePalletSize,
        chosen: override ?? sizes[position] ?? basePalletSize,
      });
      orderIndex += 1;
    }
  }
  return sanitizeBonusChoices(rows, basePalletSize, assembly);
};

const formatDate = (date: string) => {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year.slice(-2)}`;
};

const formatCost = (value: number) =>
  new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);

export default function CastdocsPage() {
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [labels, setLabels] = useState<LabelData[]>([]);
  const [baseCost, setBaseCost] = useState<number | null>(null);
  const [selectedStoreCode, setSelectedStoreCode] = useState('');
  const [distributionCenter, setDistributionCenter] = useState<DistributionCenter | ''>('');
  const [palletSizeCode, setPalletSizeCode] = useState('');
  const [geCount, setGeCount] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [ordersText, setOrdersText] = useState('');
  const [assemblyMode, setAssemblyMode] = useState('');
  // Ручные выборы типоразмеров хранятся по контексту (режим · заказы · ГЕ · типоразмер
  // паллет): при смене любого из них старые выборы перестают применяться, и
  // автоподстановка по ГЕ действует заново — без сброса состояния в effect.
  const [orderSizeChoicesByContext, setOrderSizeChoicesByContext] = useState<Record<string, Record<string, string>>>({});
  // Вес бонус-коробки (до 25 кг) хранится по тому же контексту, что и ручные
  // выборы типоразмеров: при смене поставки старые значения перестают применяться.
  const [bonusWeightsByContext, setBonusWeightsByContext] = useState<Record<string, Record<string, string>>>({});
  const barcodeRefs = useRef<Array<SVGSVGElement | null>>([]);
  const labelRef = useRef<HTMLElement>(null);
  const selectedStoreCity = getStoreCity(selectedStoreCode);
  const selectedSize = getPalletSize(palletSizeCode || 'PAL_STD');
  const weightLimitKg = selectedSize?.maxWeightKg;
  const parsedWeightKg = weightKg === '' ? undefined : Number(weightKg);
  const parsedGeCount = Number(geCount);
  const allowableWeightKg = weightLimitKg !== undefined
    && Number.isInteger(parsedGeCount)
    && parsedGeCount > 0
    ? weightLimitKg * parsedGeCount
    : undefined;
  const weightWarning = allowableWeightKg !== undefined
    && parsedWeightKg !== undefined
    && Number.isFinite(parsedWeightKg)
    && parsedWeightKg > allowableWeightKg;
  const suggestedPalletSizes = weightWarning && weightLimitKg !== undefined && parsedWeightKg !== undefined
    ? palletSizes.filter((size) =>
      size.maxWeightKg !== undefined
      && size.maxWeightKg > weightLimitKg
      && size.maxWeightKg * parsedGeCount >= parsedWeightKg,
    )
    : [];
  const minimumGeCount = weightWarning && weightLimitKg !== undefined && parsedWeightKg !== undefined
    ? Math.ceil(parsedWeightKg / weightLimitKg)
    : undefined;
  // Живой черновик раскладки заказов по ГЕ — для подсказки типоразмеров в форме.
  const parsedOrders = ordersText
    .split(/\r?\n/)
    .map((order) => order.trim())
    .filter(Boolean);
  const ordersKey = parsedOrders.join('\n');
  const planBasePalletSize = selectedSize ?? getPalletSize('PAL_STD')!;
  const choicesContext = `${assemblyMode !== 'no' ? 'A' : 'S'}|${ordersKey}|${geCount}|${palletSizeCode}`;
  const isAssembly = assemblyMode !== 'no';
  const orderSizeChoices = orderSizeChoicesByContext[choicesContext] ?? {};
  const bonusWeights = bonusWeightsByContext[choicesContext] ?? {};
  const bonusGeEligible = isAssembly && isBonusEligibleGe(planBasePalletSize);
  const planRows = buildOrderPlan(
    parsedOrders,
    Number(geCount),
    planBasePalletSize,
    assemblyMode !== 'no',
    orderSizeChoices,
  );
  const geSummaries = (() => {
    const map = new Map<number, { sum: number; count: number }>();
    planRows.forEach((row) => {
      const entry = map.get(row.geNumber) ?? { sum: 0, count: 0 };
      entry.sum += row.chosen.coefficient;
      entry.count += 1;
      map.set(row.geNumber, entry);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([geNumber, entry]) => {
        const sum = Math.round(entry.sum * 100) / 100;
        const target = planBasePalletSize.coefficient;
        const targetText = `${planBasePalletSize.value} (${formatCoefficient(target)})`;
        const sumText = formatCoefficient(sum);
        let text: string;
        let over = false;
        if (sum > target + 1e-9) {
          over = true;
          text = `ГЕ №${geNumber}: сумма типоразмеров заказов ${sumText} больше ${targetText} — дробление дороже целого ГЕ.`;
        } else if (sum < target - 1e-9) {
          text = `ГЕ №${geNumber}: сумма типоразмеров заказов ${sumText} меньше ${targetText} — недогруз ГЕ.`;
        } else {
          text = `ГЕ №${geNumber}: сумма типоразмеров заказов ${sumText} — равна типоразмеру ГЕ ${targetText}.`;
        }
        return { geNumber, text, over };
      });
  })();
  const bonusWeightValue = (row: OrderPlanRow): number | undefined => {
    const raw = bonusWeights[row.key];
    if (raw === undefined || raw.trim() === '') {
      return undefined;
    }
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };
  const isValidBonusWeight = (row: OrderPlanRow): boolean => {
    const value = bonusWeightValue(row);
    return value !== undefined && value <= (BONUS_SIZE.maxWeightKg ?? 25);
  };
  const invalidBonusRows = planRows.filter(
    (row) => row.chosen.value === BONUS_SIZE_CODE && !isValidBonusWeight(row),
  );
  const bonusTakenGeNumbers = new Set(
    planRows
      .filter((row) => row.chosen.value === BONUS_SIZE_CODE)
      .map((row) => row.geNumber),
  );
  const transportCost = selectedStoreCity && distributionCenter && geCount
    ? getTransportCost(
      selectedStoreCode,
      distributionCenter,
      palletSizeCode || 'PAL_STD',
      Number(geCount),
    )
    : undefined;

  useEffect(() => {
    document.title = 'Кросс-док — тестовый стенд';
  }, []);

  useEffect(() => {
    if (labels.length === 0) {
      return;
    }

    labels.forEach((label, index) => {
      const barcode = barcodeRefs.current[index];
      if (!barcode) {
        return;
      }

      JsBarcode(barcode, label.labelCode, {
        format: 'CODE128',
        displayValue: false,
        height: 56,
        margin: 0,
        width: 1.5,
      });
    });
    labelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [labels]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const storeCode = String(formData.get('gruz-pol') ?? '');
    const supplierCode = String(formData.get('gruz-otp') ?? '').trim();
    const orders = ordersText
      .split(/\r?\n/)
      .map((order) => order.trim())
      .filter(Boolean);
    const geCount = Number(formData.get('num-ge'));
    const assembly = formData.get('delivery-type') === 'yes';
    const palletSizeCode = String(formData.get('palsize_id') || 'PAL_STD');
    const selectedPalletSize = getPalletSize(palletSizeCode) ?? palletSizes[0];
    const weightValue = Number(formData.get('ves-gruza'));
    if (
      selectedPalletSize.maxWeightKg !== undefined
      && weightValue > selectedPalletSize.maxWeightKg * geCount
    ) {
      setLabels([]);
      setSubmissionMessage(
        `Общий вес превышает допустимый для ${geCount} ГЕ (${selectedPalletSize.maxWeightKg * geCount} кг). Измените типоразмер или количество ГЕ.`,
      );
      return;
    }
    const selectedCenterValue = String(formData.get('delivery-center') ?? '');
    if (!isDistributionCenter(selectedCenterValue)) {
      setLabels([]);
      setSubmissionMessage('Выберите РЦ разгрузки.');
      return;
    }
    const selectedCenter = selectedCenterValue;
    const storeCity = getStoreCity(storeCode);
    const cost = getTransportCost(storeCode, selectedCenter, palletSizeCode, geCount);
    const rate = getRouteRate(storeCode, selectedCenter);
    const rcDate = String(formData.get('rc-date') ?? '');
    const storeDate = String(formData.get('mag-date') ?? '');

    if (!storeCity || cost === undefined || rate === undefined) {
      setLabels([]);
      setSubmissionMessage('Не удалось определить тариф для выбранного магазина и РЦ разгрузки.');
      return;
    }

    if (!assembly && orders.length !== 1) {
      setLabels([]);
      setSubmissionMessage('Для несборной поставки укажите ровно один номер заказа.');
      return;
    }

    if (assembly && geCount > orders.length) {
      setLabels([]);
      setSubmissionMessage('Для сборной поставки укажите не меньше заказов, чем ГЕ.');
      return;
    }

    // Раскладка заказов по ГЕ с типоразмером каждого заказа. Типоразмер подставлен
    // по типоразмеру ГЕ (автоподбор коробками: 2 заказа → 0,6 + 0,4 = 1,0;
    // 3 заказа → 0,4 + 0,3 + 0,3 = 1,0; 4 и больше → 0,3 × N — уже дороже паллеты)
    // и мог быть изменён поставщиком в окне номеров заказов.
    const plan = buildOrderPlan(orders, geCount, selectedPalletSize, assembly, orderSizeChoices);

    const invalidBonusRow = plan.find(
      (row) => row.chosen.value === BONUS_SIZE_CODE && !isValidBonusWeight(row),
    );
    if (invalidBonusRow) {
      setLabels([]);
      setSubmissionMessage(
        `Для бонус-заказа ${invalidBonusRow.orderNumber} (ГЕ №${invalidBonusRow.geNumber}) укажите вес коробки от 0,1 до ${BONUS_SIZE.maxWeightKg ?? 25} кг.`,
      );
      return;
    }

    const generatedLabels: LabelData[] = plan.map((row) => ({
      storeCode,
      distributionCenter: selectedCenter,
      storeCity,
      supplierCode,
      assembly: assembly ? 'Да' : 'Нет',
      orderNumber: row.orderNumber,
      palletSizeLabel: selectedPalletSize.label,
      weight: String(formData.get('ves-gruza') ?? '').trim(),
      temperatureMode: formData.get('temp-rezim') === 'yes' ? 'Да' : 'Нет',
      rcDate,
      storeDate,
      labelCode: `${storeCode}-${supplierCode}-${row.orderNumber}--${row.geNumber}-${row.chosen.value}`,
      labelNumber: row.positionInGe,
      labelTotal: row.ordersInGe,
      geNumber: row.geNumber,
      geTotal: geCount,
      orderShareText: row.chosen.value === BONUS_SIZE_CODE
        ? 'бесплатный бонус до 25 кг'
        : row.ordersInGe === 1
          ? 'целое ГЕ'
          : `коэффициент ${formatCoefficient(row.chosen.coefficient)}`,
      orderPalletSizeCode: row.chosen.value,
      orderPalletSizeLabel: row.chosen.label,
      orderPalletSizeCoefficient: row.chosen.coefficient,
      orderCost: getOrderCostForCoefficient(rate, row.chosen.coefficient),
    }));

    barcodeRefs.current = [];
    setLabels(generatedLabels);
    setBaseCost(cost);
    setSubmissionMessage(
      `Сформировано этикеток: ${generatedLabels.length}. Нумерация заказов указана внутри каждой ГЕ.`,
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.testHeader}>
        <p>Тестовый стенд</p>
        <h1>Формирование этикеток кросс-док</h1>
      </header>

      <main className={styles.main}>
        <aside className={styles.notice}>
          <span aria-hidden="true">📋</span>
          <p>
            Шаг 1 — выберите грузовые единицы (типоразмер и количество ГЕ), шаг 2 — добавьте
            заказы: система распределит их по ГЕ, подберёт типоразмеры и посчитает стоимость
            каждого заказа.
          </p>
        </aside>

        <form className={styles.dispatchForm} id="castdocs-form" onSubmit={handleSubmit}>
          <div className={styles.fields}>
            <label className={styles.field}>
              <span>Код магазина</span>
              <select
                name="gruz-pol"
                value={selectedStoreCode}
                onChange={(event) => setSelectedStoreCode(event.target.value)}
                required
              >
                <option value="">Выберите код магазина</option>
                {storeCodes.map((code) => (
                  <option value={code} key={code}>{code}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>РЦ разгрузки</span>
              <select
                name="delivery-center"
                value={distributionCenter}
                onChange={(event) => {
                  const value = event.target.value;
                  setDistributionCenter(isDistributionCenter(value) ? value : '');
                }}
                required
              >
                <option value="">Выберите РЦ разгрузки</option>
                <option value="Санкт-Петербург">Санкт-Петербург</option>
                <option value="Москва">Москва</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Код поставщика</span>
              <input name="gruz-otp" type="text" required />
            </label>
            <label className={styles.field}>
              <span>Сборная</span>
              <select
                name="delivery-type"
                value={assemblyMode}
                onChange={(event) => {
                  setAssemblyMode(event.target.value);
                  setSubmissionMessage('');
                }}
                required
              >
                <option value="">Выберите вариант</option>
                <option value="yes">Да</option>
                <option value="no">Нет</option>
              </select>
            </label>
            <p className={styles.stepTitle}>Шаг 1 · Грузовые единицы (ГЕ)</p>
            <label className={styles.field}>
              <span>Типоразмер ГЕ *</span>
              <select
                name="palsize_id"
                value={palletSizeCode}
                onChange={(event) => {
                  setPalletSizeCode(event.target.value);
                  setSubmissionMessage('');
                }}
              >
                <option value="">-----</option>
                {palletSizes.map((size) => (
                  <option value={size.value} key={size.value}>{size.label}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Количество ГЕ</span>
              <input
                name="num-ge"
                type="number"
                min="1"
                step="1"
                value={geCount}
                onChange={(event) => setGeCount(event.target.value)}
                required
              />
            </label>
            <p className={styles.stepTitle}>Шаг 2 · Заказы</p>
            <label className={styles.field}>
              <span>Номера заказов (по одному в строке)</span>
              <textarea
                name="zak-num"
                rows={3}
                value={ordersText}
                onChange={(event) => {
                  setOrdersText(event.target.value);
                  setSubmissionMessage('');
                }}
                placeholder="Введите номер каждого заказа с новой строки"
                required
              />
            </label>
            {planRows.length > 0 && (
              <div className={styles.ordersEditor}>
                <span className={styles.ordersEditorTitle}>
                  Типоразмеры заказов — подставлены по типоразмеру ГЕ, при необходимости измените
                </span>
                {bonusGeEligible && (
                  <p className={styles.ordersGeHint}>
                    На каждом таком ГЕ можно разместить один заказ бесплатно: выберите для него
                    типоразмер BONUS и укажите вес коробки до 25 кг. Бонус не расходует
                    коэффициент ГЕ.
                  </p>
                )}
                {planRows.map((row) => {
                  const bonusTakenHere = bonusTakenGeNumbers.has(row.geNumber)
                    && row.chosen.value !== BONUS_SIZE_CODE;
                  return (
                    <label className={styles.ordersRow} key={row.key}>
                      <span className={styles.ordersRowName}>
                        Заказ {row.orderNumber} · ГЕ №{row.geNumber}
                      </span>
                      <select
                        value={row.chosen.value}
                        onChange={(event) => {
                          const code = event.target.value;
                          setOrderSizeChoicesByContext((previous) => ({
                            ...previous,
                            [choicesContext]: {
                              ...(previous[choicesContext] ?? {}),
                              [row.key]: code,
                            },
                          }));
                        }}
                      >
                        {palletSizes.map((size) => (
                          <option value={size.value} key={size.value}>
                            {size.value} (коэф. {formatCoefficient(size.coefficient)})
                          </option>
                        ))}
                        {bonusGeEligible && row.ordersInGe >= 2 && (
                          <option value={BONUS_SIZE_CODE} disabled={bonusTakenHere}>
                            {BONUS_SIZE_CODE} (бесплатно, до 25 кг){bonusTakenHere ? ' — уже есть на этом ГЕ' : ''}
                          </option>
                        )}
                      </select>
                      <span className={styles.ordersRowCoef}>
                        {row.chosen.value === BONUS_SIZE_CODE
                          ? 'бесплатно, 0 ₽'
                          : row.chosen.value === row.suggested.value
                            ? `коэф. ${formatCoefficient(row.chosen.coefficient)}`
                            : 'изменён вручную'}
                      </span>
                      {row.chosen.value === BONUS_SIZE_CODE && (
                        <span className={styles.bonusWeight}>
                          <input
                            className={invalidBonusRows.some((item) => item.key === row.key)
                              ? `${styles.bonusWeightInput} ${styles.bonusWeightInputInvalid}`
                              : styles.bonusWeightInput}
                            type="number"
                            min="0.1"
                            max="25"
                            step="any"
                            placeholder="Вес, кг"
                            aria-label={`Вес бонус-коробки заказа ${row.orderNumber}, кг`}
                            value={bonusWeights[row.key] ?? ''}
                            onChange={(event) => {
                              const weight = event.target.value;
                              setBonusWeightsByContext((previous) => ({
                                ...previous,
                                [choicesContext]: {
                                  ...(previous[choicesContext] ?? {}),
                                  [row.key]: weight,
                                },
                              }));
                            }}
                          />
                          <span className={styles.ordersRowCoef}>вес коробки, до 25 кг</span>
                        </span>
                      )}
                    </label>
                  );
                })}
                {invalidBonusRows.length > 0 && (
                  <p className={`${styles.ordersGeHint} ${styles.ordersGeHintOver}`} role="alert">
                    Укажите вес бонус-коробки (от 0,1 до 25 кг):{' '}
                    {invalidBonusRows.map((row) => `заказ ${row.orderNumber} (ГЕ №${row.geNumber})`).join('; ')}.
                  </p>
                )}
                {geSummaries.map((summary) => (
                  <p
                    className={summary.over
                      ? `${styles.ordersGeHint} ${styles.ordersGeHintOver}`
                      : styles.ordersGeHint}
                    key={summary.geNumber}
                  >
                    {summary.text}
                  </p>
                ))}
              </div>
            )}
            <label className={styles.field}>
              <span>E-mail поставщика</span>
              <input name="Email" type="email" required />
            </label>
            <label className={styles.field}>
              <span>Общий вес партии, кг</span>
              <input
                name="ves-gruza"
                type="number"
                min="0.01"
                step="any"
                value={weightKg}
                onChange={(event) => {
                  setWeightKg(event.target.value);
                  setSubmissionMessage('');
                }}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Температурный режим</span>
              <select name="temp-rezim" defaultValue="" required>
                <option value="">Выберите вариант</option>
                <option value="yes">Да</option>
                <option value="no">Нет</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Дата доставки на РЦ</span>
              <input name="rc-date" type="date" required />
            </label>
            <label className={styles.field}>
              <span>Дата доставки в магазин</span>
              <input name="mag-date" type="date" required />
            </label>
            {weightWarning && (
              <p className={styles.weightWarning} role="alert">
                Общий вес партии превышает допустимый для выбранного типоразмера и количества ГЕ
                ({allowableWeightKg} кг). Измените типоразмер
                {suggestedPalletSizes.length > 0 && ` на ${suggestedPalletSizes.map((size) => size.value).join(', ')}`}
                {' '}или увеличьте количество ГЕ минимум до {minimumGeCount}. Для типоразмеров с лимитом «по типу»
                числовая проверка не выполняется.
              </p>
            )}
            <label className={styles.field}>
              <span>Стоимость транспортировки</span>
              <output className={styles.costOutput} aria-live="polite">
                {!selectedStoreCity || !distributionCenter || !geCount
                  ? 'Выберите магазин, РЦ и укажите количество ГЕ'
                  : !Number.isInteger(Number(geCount)) || Number(geCount) < 1
                    ? 'Укажите целое количество ГЕ'
                    : transportCost === undefined
                      ? 'Тариф для выбранного маршрута не найден'
                      : `${new Intl.NumberFormat('ru-RU').format(transportCost)} ₽`}
              </output>
            </label>
          </div>

          <button
            className={styles.submitButton}
            type="submit"
            disabled={weightWarning || invalidBonusRows.length > 0}
          >
            Сформировать этикетку
          </button>
          {submissionMessage && <p className={styles.formMessage} role="status">{submissionMessage}</p>}

          <p className={styles.palletNote}>
            * Если типоразмер ГЕ не выбран, автоматически используется PAL_STD
            «Европалета стандарт, 800×1200 мм».
          </p>
        </form>

        {labels.length > 0 && (
          <section className={styles.labelSection} ref={labelRef} aria-labelledby="label-title">
            <div className={styles.labelActions}>
              <h2 id="label-title">Предпросмотр этикеток ({labels.length})</h2>
              <button type="button" onClick={() => window.print()}>Печать / Сохранить в PDF</button>
            </div>
            <div className={styles.costSummary}>
              <h3>Разбивка стоимости по заказам</h3>
              <ul>
                {labels.map((label) => (
                  <li key={`${label.labelCode}-${label.labelNumber}-cost`}>
                    <span>
                      Заказ {label.orderNumber} · ГЕ №{label.geNumber} · {label.orderPalletSizeCode}
                    </span>
                    <strong>{formatCost(label.orderCost)} ₽</strong>
                  </li>
                ))}
              </ul>
              <p className={styles.costSummaryTotal}>
                Итого по заказам: {formatCost(labels.reduce((sum, label) => sum + label.orderCost, 0))} ₽
              </p>
              <p className={styles.costSummaryTotal}>
                Стоимость перевозки ({labels[0].geTotal} ГЕ · {labels[0].palletSizeLabel.split('—')[0].trim()}):{' '}
                {baseCost !== null ? formatCost(baseCost) : 0} ₽
              </p>
              {(() => {
                const ordersKopecks = labels.reduce(
                  (sum, label) => sum + Math.round(label.orderCost * 100),
                  0,
                );
                const baseKopecks = baseCost !== null ? Math.round(baseCost * 100) : 0;
                const difference = ordersKopecks - baseKopecks;
                if (difference === 0) {
                  return (
                    <p className={styles.costSummaryHint}>
                      Сумма по заказам равна стоимости перевозки: дробление уложилось в типоразмер ГЕ.
                    </p>
                  );
                }
                if (difference > 0) {
                  return (
                    <p className={`${styles.costSummaryHint} ${styles.costSummaryHintOver}`}>
                      Дробление дороже целых ГЕ на {formatCost(difference / 100)} ₽ — поставщику
                      выгоднее укрупнить типоразмеры заказов (например, взять паллету вместо
                      коробок).
                    </p>
                  );
                }
                return (
                  <p className={styles.costSummaryHint}>
                    Сумма по заказам меньше стоимости перевозки на {formatCost(-difference / 100)} ₽
                    (недогруз ГЕ).
                  </p>
                );
              })()}
            </div>
            {labels.map((label, index) => (
            <article className={styles.shippingLabel} key={`${label.labelCode}-${label.labelNumber}`}>
              <h2 className={styles.labelBrand}>Кросс-док</h2>
              <p className={styles.labelCode}>{label.labelCode}</p>
              <p className={styles.labelSequence}>
                Заказ на паллете: {label.labelNumber} из {label.labelTotal}
              </p>
              <p className={styles.geSequence}>
                ГЕ №{label.geNumber} из {label.geTotal} в поставке
              </p>
              <p className={styles.geSequence}>
                Типоразмер заказа: {label.orderPalletSizeCode} ({label.orderShareText})
              </p>
              <svg
                ref={(element) => { barcodeRefs.current[index] = element; }}
                className={styles.barcode}
                aria-label={`Штрихкод ${label.labelCode}`}
              />

              <table className={styles.labelTable}>
                <tbody>
                  <tr>
                    <th>Грузоотправитель</th>
                    <td>Поставщик {label.supplierCode}</td>
                  </tr>
                  <tr>
                    <th>Грузополучатель</th>
                    <td>Магазин {label.storeCode}, {label.storeCity}</td>
                  </tr>
                  <tr>
                    <th>РЦ разгрузки</th>
                    <td>{label.distributionCenter}</td>
                  </tr>
                  <tr>
                    <th>Номер заказа</th>
                    <td>{label.orderNumber}</td>
                  </tr>
                  <tr>
                    <th>Вес всей партии</th>
                    <td>{label.weight}</td>
                  </tr>
                  <tr>
                    <th>Сборная</th>
                    <td>{label.assembly}</td>
                  </tr>
                  <tr>
                    <th>Температурный режим</th>
                    <td>{label.temperatureMode}</td>
                  </tr>
                  <tr>
                    <th>Номер грузовой единицы</th>
                    <td>ГЕ №{label.geNumber} из {label.geTotal}</td>
                  </tr>
                  <tr>
                    <th>Место заказа на паллете</th>
                    <td>{label.labelNumber} из {label.labelTotal}</td>
                  </tr>
                  <tr>
                    <th>Типоразмер заказа</th>
                    <td>
                      {label.orderPalletSizeLabel}
                      {label.labelTotal === 1 && ' (целое ГЕ)'}
                    </td>
                  </tr>
                  <tr>
                    <th>Типоразмер паллет</th>
                    <td>{label.palletSizeLabel}</td>
                  </tr>
                  <tr>
                    <th>Стоимость перевозки заказа</th>
                    <td>{formatCost(label.orderCost)} ₽</td>
                  </tr>
                </tbody>
              </table>

              <div className={styles.labelDates}>
                <div>
                  <span>Дата доставки на РЦ</span>
                  <strong>{formatDate(label.rcDate)}</strong>
                </div>
                <div>
                  <span>Дата доставки в магазин</span>
                  <strong>{formatDate(label.storeDate)}</strong>
                </div>
              </div>

              <p className={styles.labelInstructions}>
                * Не забудьте прикрепить комплект документов к первому паллету.
                <br />
                <strong>
                  Документы должны быть вложены в непромокаемые (полиэтиленовые) конверты.
                  В противном случае РЦ будет отказывать в выгрузке.
                </strong>
              </p>
            </article>
            ))}
          </section>
        )}
      </main>

    </div>
  );
}
