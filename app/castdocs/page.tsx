'use client';

import JsBarcode from 'jsbarcode';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import styles from './castdocs.module.css';
import {
  getStoreCity,
  getPalletSize,
  getTransportCost,
  isDistributionCenter,
  palletSizes,
  type DistributionCenter,
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
  orderGeShare: string;
};

const formatDate = (date: string) => {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year.slice(-2)}`;
};

export default function CastdocsPage() {
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [labels, setLabels] = useState<LabelData[]>([]);
  const [selectedStoreCode, setSelectedStoreCode] = useState('');
  const [distributionCenter, setDistributionCenter] = useState<DistributionCenter | ''>('');
  const [palletSizeCode, setPalletSizeCode] = useState('');
  const [geCount, setGeCount] = useState('');
  const [weightKg, setWeightKg] = useState('');
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
    const orders = String(formData.get('zak-num') ?? '')
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
    const rcDate = String(formData.get('rc-date') ?? '');
    const storeDate = String(formData.get('mag-date') ?? '');

    if (!storeCity || cost === undefined) {
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

    const ordersPerGe = Math.floor(orders.length / geCount);
    const remainder = orders.length % geCount;
    let orderIndex = 0;
    const generatedLabels: LabelData[] = [];

    for (let geIndex = 0; geIndex < geCount; geIndex += 1) {
      const ordersInGe = assembly
        ? ordersPerGe + (geIndex >= geCount - remainder ? 1 : 0)
        : 1;
      const currentGeOrders = assembly ? orders.slice(orderIndex, orderIndex + ordersInGe) : orders;
      orderIndex += ordersInGe;

      currentGeOrders.forEach((orderNumber, orderPosition) => {
        const labelNumber = orderPosition + 1;
        const labelCode = `${storeCode}-${supplierCode}-${orderNumber}--${geIndex + 1}-${palletSizeCode}`;

        generatedLabels.push({
          storeCode,
          distributionCenter: selectedCenter,
          storeCity,
          supplierCode,
          assembly: assembly ? 'Да' : 'Нет',
          orderNumber,
          palletSizeLabel: selectedPalletSize.label,
          weight: String(formData.get('ves-gruza') ?? '').trim(),
          temperatureMode: formData.get('temp-rezim') === 'yes' ? 'Да' : 'Нет',
          rcDate,
          storeDate,
          labelCode,
          labelNumber,
          labelTotal: currentGeOrders.length,
          geNumber: geIndex + 1,
          geTotal: geCount,
          orderGeShare: currentGeOrders.length === 1 ? '1 ГЕ' : `1/${currentGeOrders.length} ГЕ`,
        });
      });
    }

    barcodeRefs.current = [];
    setLabels(generatedLabels);
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
            Заполните данные поставки, чтобы проверить расчёт стоимости и сформировать этикетки.
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
              <select name="delivery-type" defaultValue="" required>
                <option value="">Выберите вариант</option>
                <option value="yes">Да</option>
                <option value="no">Нет</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Номера заказов (по одному в строке)</span>
              <textarea name="zak-num" rows={3} placeholder="Введите номер каждого заказа с новой строки" required />
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
            <label className={styles.field}>
              <span>Типоразмер паллет *</span>
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

          <button className={styles.submitButton} type="submit" disabled={weightWarning}>
            Сформировать этикетку
          </button>
          {submissionMessage && <p className={styles.formMessage} role="status">{submissionMessage}</p>}

          <p className={styles.palletNote}>
            * Если типоразмер не выбран, автоматически используется PAL_STD
            «Европалета стандарт, 800×1200 мм».
          </p>
        </form>

        {labels.length > 0 && (
          <section className={styles.labelSection} ref={labelRef} aria-labelledby="label-title">
            <div className={styles.labelActions}>
              <h2 id="label-title">Предпросмотр этикеток ({labels.length})</h2>
              <button type="button" onClick={() => window.print()}>Печать / Сохранить в PDF</button>
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
              <p className={styles.geSequence}>Заказ занимает {label.orderGeShare}</p>
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
                    <th>Доля ГЕ этого заказа</th>
                    <td>
                      {label.orderGeShare}
                      {label.labelTotal > 1 && '; доли заказов на паллете в сумме составляют 1 ГЕ'}
                    </td>
                  </tr>
                  <tr>
                    <th>Типоразмер паллет</th>
                    <td>{label.palletSizeLabel}</td>
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
