import { useMemo, useState } from "react";
import { BarChart3, Check, ChevronDown, Search } from "lucide-react";
import {
  salesChartData,
  type SalesGrouping,
  type SalesMetric,
  type SalesPeriod,
} from "./chartData";
import { dateKey, plural, type Data } from "./model";

const rub = (value: number) =>
  `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ₽`;
const pieces = (value: number) =>
  `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)} шт.`;
const valueText = (value: number, metric: SalesMetric) =>
  metric === "revenue" ? rub(value) : pieces(value);
const colors = [
  "#275a45",
  "#d1944e",
  "#517eaf",
  "#9a6f9f",
  "#7da24c",
  "#bf6f69",
  "#508f92",
  "#a67b4c",
  "#6674a6",
  "#669266",
  "#b87e9d",
  "#6d8eac",
];
const chart = {
  width: 900,
  height: 244,
  left: 48,
  right: 20,
  top: 18,
  bottom: 37,
};
const plotWidth = chart.width - chart.left - chart.right;
const plotHeight = chart.height - chart.top - chart.bottom;
const pointPath = (values: number[], yMax: number) =>
  values
    .map((value, index) => {
      const x =
        chart.left +
        (values.length <= 1
          ? plotWidth / 2
          : (index / (values.length - 1)) * plotWidth);
      const y = chart.top + plotHeight - (value / yMax) * plotHeight;
      return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

export function SalesHistoryChart({
  data,
  now,
  onAddSale,
  initialPeriod = "7d",
}: {
  data: Data;
  now: Date;
  onAddSale?: () => void;
  initialPeriod?: SalesPeriod;
}) {
  const [period, setPeriod] = useState<SalesPeriod>(initialPeriod);
  const [metric, setMetric] = useState<SalesMetric>("quantity");
  const [grouping, setGrouping] = useState<SalesGrouping>("total");
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [customStart, setCustomStart] = useState(dateKey(now));
  const [customEnd, setCustomEnd] = useState(dateKey(now));
  const [hovered, setHovered] = useState<number | null>(null);
  const options = useMemo(() => {
    const ids = [
      ...new Set([
        ...data.products.map((item) => item.id),
        ...data.sales.map((item) => item.productId),
      ]),
    ];
    return ids.map((id) => ({
      id,
      name:
        data.products.find((item) => item.id === id)?.name ||
        "Удалённый продукт",
    }));
  }, [data.products, data.sales]);
  const activeIds =
    selectedIds === null
      ? options.map((item) => item.id)
      : selectedIds.filter((id) => options.some((item) => item.id === id));
  const result = salesChartData(
    data,
    now,
    period,
    metric,
    grouping,
    activeIds,
    customStart,
    customEnd,
  );
  const toggleId = (id: string) => {
    const next = activeIds.includes(id)
      ? activeIds.filter((item) => item !== id)
      : [...activeIds, id];
    setSelectedIds(next.length === options.length ? null : next);
    setHovered(null);
  };
  const plotted = result.series;
  const yMax = Math.max(1, ...plotted.flatMap((series) => series.values));
  const hasRecords =
    result.recordCount > 0 &&
    (metric === "quantity" || result.pricedRecords > 0);
  return (
    <section
      className="panel analytics-chart sales-chart"
      aria-label="График продаж"
    >
      <div className="chart-heading">
        <div>
          <span className="page-eyebrow">ДИНАМИКА</span>
          <h2>Продажи в цифрах</h2>
          <p>Выберите период, товары и показатель</p>
        </div>
        <div className="chart-total">
          <small>
            {metric === "revenue"
              ? "Выручка по записям с ценой"
              : "Продано за период"}
          </small>
          <strong>{valueText(result.total, metric)}</strong>
        </div>
      </div>
      <div className="chart-controls">
        <div className="chart-segments" aria-label="Период">
          {(
            [
              ["today", "Сегодня"],
              ["7d", "7 дней"],
              ["30d", "30 дней"],
              ["custom", "Свой период"],
            ] as [SalesPeriod, string][]
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={period === value}
              onClick={() => {
                setPeriod(value);
                setHovered(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="chart-segments" aria-label="Показатель">
          <button
            type="button"
            aria-pressed={metric === "quantity"}
            onClick={() => setMetric("quantity")}
          >
            Количество
          </button>
          <button
            type="button"
            aria-pressed={metric === "revenue"}
            onClick={() => setMetric("revenue")}
          >
            Выручка
          </button>
        </div>
        <div className="chart-filter-wrap">
          <button
            type="button"
            className="chart-filter-button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            Товары: {selectedIds === null ? "все" : activeIds.length}{" "}
            <ChevronDown size={15} />
          </button>
          {filtersOpen && (
            <div className="chart-filter-popover">
              <div className="chart-filter-actions">
                <button type="button" onClick={() => setSelectedIds(null)}>
                  Выбрать все
                </button>
                <button type="button" onClick={() => setSelectedIds([])}>
                  Снять выбор
                </button>
              </div>
              <label className="chart-search">
                <Search size={14} />
                <input
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  placeholder="Найти товар"
                  aria-label="Найти товар в фильтре"
                />
              </label>
              <div className="chart-filter-list">
                {options
                  .filter((item) =>
                    item.name
                      .toLowerCase()
                      .includes(productQuery.toLowerCase()),
                  )
                  .map((item) => (
                    <label key={item.id} title={item.name}>
                      <input
                        type="checkbox"
                        checked={activeIds.includes(item.id)}
                        onChange={() => toggleId(item.id)}
                      />
                      <span>{item.name}</span>
                      <Check size={14} />
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {period === "custom" && (
        <div className="chart-date-range">
          <label>
            С{" "}
            <input
              type="date"
              value={customStart}
              onChange={(event) => {
                setCustomStart(event.target.value);
                setHovered(null);
              }}
            />
          </label>
          <label>
            По{" "}
            <input
              type="date"
              value={customEnd}
              onChange={(event) => {
                setCustomEnd(event.target.value);
                setHovered(null);
              }}
            />
          </label>
        </div>
      )}
      <div className="chart-subcontrols">
        <span>Показать</span>
        <div className="chart-segments">
          <button
            type="button"
            aria-pressed={grouping === "total"}
            onClick={() => setGrouping("total")}
          >
            Общий итог
          </button>
          <button
            type="button"
            aria-pressed={grouping === "products"}
            onClick={() => setGrouping("products")}
          >
            По товарам
          </button>
        </div>
        {grouping === "products" && activeIds.length > 6 && (
          <small>Для более ясного сравнения выберите несколько товаров.</small>
        )}
      </div>
      {result.error ? (
        <div className="chart-empty chart-empty-inline">
          <strong>{result.error}</strong>
          <p>Измените даты, чтобы построить график.</p>
        </div>
      ) : !activeIds.length ? (
        <div className="chart-empty chart-empty-inline">
          <strong>Выберите хотя бы один товар</strong>
          <p>Откройте фильтр «Товары», чтобы добавить серии на график.</p>
        </div>
      ) : !hasRecords ? (
        <div className="chart-empty chart-empty-inline">
          <span className="chart-empty-icon">
            <BarChart3 size={23} />
          </span>
          <strong>
            {!data.sales.length
              ? "Продаж пока нет"
              : metric === "revenue" && result.recordCount
                ? "В этом периоде нет записанных цен"
                : "За выбранный период нет продаж"}
          </strong>
          <p>
            {!data.sales.length
              ? data.products.length
                ? "Запишите первую продажу, чтобы увидеть динамику."
                : "Сначала добавьте продукт, затем запишите продажу."
              : metric === "revenue" && result.recordCount
                ? "Продажи без цены остаются в журнале, но не включаются в выручку."
                : "Попробуйте другой период или выберите другие товары."}
          </p>
          {!data.sales.length && onAddSale && (
            <button
              type="button"
              className="chart-empty-action"
              onClick={onAddSale}
            >
              Добавить продажу
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="chart-legend sales-legend">
            {plotted.map((series, index) => (
              <span key={series.id} title={series.name}>
                <i style={{ background: colors[index % colors.length] }} />
                {series.name}
              </span>
            ))}
          </div>
          <div className="chart-canvas">
            <svg
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              role="group"
              aria-label="Динамика продаж"
              onMouseLeave={() => setHovered(null)}
            >
              {[0, 0.5, 1].map((fraction) => {
                const value = yMax * fraction;
                const y = chart.top + plotHeight - fraction * plotHeight;
                return (
                  <g key={fraction}>
                    <line
                      x1={chart.left}
                      x2={chart.width - chart.right}
                      y1={y}
                      y2={y}
                      className="chart-gridline"
                    />
                    <text
                      x={chart.left - 9}
                      y={y + 4}
                      textAnchor="end"
                      className="chart-axis-label"
                    >
                      {metric === "revenue"
                        ? new Intl.NumberFormat("ru-RU", {
                            notation: "compact",
                          }).format(value)
                        : Math.round(value)}
                    </text>
                  </g>
                );
              })}
              {result.buckets
                .filter(
                  (_, index) =>
                    index %
                      Math.max(1, Math.ceil(result.buckets.length / 6)) ===
                    0,
                )
                .map((bucket) => {
                  const index = result.buckets.indexOf(bucket);
                  const x =
                    chart.left +
                    (result.buckets.length <= 1
                      ? plotWidth / 2
                      : (index / (result.buckets.length - 1)) * plotWidth);
                  return (
                    <text
                      key={index}
                      x={x}
                      y={chart.height - 9}
                      textAnchor="middle"
                      className="chart-axis-label"
                    >
                      {bucket.label}
                    </text>
                  );
                })}
              {plotted.map((series, index) => (
                <path
                  key={series.id}
                  d={pointPath(series.values, yMax)}
                  className="chart-line sales-chart-line"
                  stroke={colors[index % colors.length]}
                />
              ))}
              {(hovered !== null || result.buckets.length === 1) &&
                plotted.map((series, index) => {
                  const point = hovered ?? 0;
                  return (
                    <circle
                      key={series.id}
                      cx={
                        chart.left +
                        (result.buckets.length <= 1
                          ? plotWidth / 2
                          : (point / (result.buckets.length - 1)) * plotWidth)
                      }
                      cy={
                        chart.top +
                        plotHeight -
                        (series.values[point] / yMax) * plotHeight
                      }
                      r="4.5"
                      fill={colors[index % colors.length]}
                      stroke="#fff"
                      strokeWidth="2"
                    />
                  );
                })}
              {hovered !== null && (
                <line
                  x1={
                    chart.left +
                    (result.buckets.length <= 1
                      ? plotWidth / 2
                      : (hovered / (result.buckets.length - 1)) * plotWidth)
                  }
                  x2={
                    chart.left +
                    (result.buckets.length <= 1
                      ? plotWidth / 2
                      : (hovered / (result.buckets.length - 1)) * plotWidth)
                  }
                  y1={chart.top}
                  y2={chart.top + plotHeight}
                  className="chart-hover-line"
                />
              )}
              {result.buckets.map((bucket, index) => {
                const x =
                  chart.left +
                  (result.buckets.length <= 1
                    ? plotWidth / 2
                    : (index / (result.buckets.length - 1)) * plotWidth);
                return (
                  <rect
                    key={index}
                    x={x - Math.max(6, plotWidth / result.buckets.length / 2)}
                    y={chart.top}
                    width={Math.max(12, plotWidth / result.buckets.length)}
                    height={plotHeight}
                    className="chart-hit-area"
                    tabIndex={0}
                    role="button"
                    aria-label={`${bucket.detail}: ${plotted.map((series) => `${series.name} ${valueText(series.values[index], metric)}`).join(", ")}`}
                    onMouseEnter={() => setHovered(index)}
                    onFocus={() => setHovered(index)}
                    onBlur={() => setHovered(null)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setHovered(null);
                    }}
                  />
                );
              })}
            </svg>
            {hovered !== null && (
              <div
                className="chart-tooltip"
                style={{
                  left: `${Math.min(78, Math.max(12, ((chart.left + (result.buckets.length <= 1 ? plotWidth / 2 : (hovered / (result.buckets.length - 1)) * plotWidth)) / chart.width) * 100))}%`,
                }}
              >
                <strong>{result.buckets[hovered].detail}</strong>
                {plotted.map((series, index) => (
                  <span key={series.id}>
                    <i style={{ background: colors[index % colors.length] }} />
                    {series.name}
                    <b>{valueText(series.values[hovered], metric)}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {metric === "revenue" && result.missingPriceRecords > 0 && (
        <p className="chart-footnote chart-price-note">
          Не учтены в выручке {result.missingPriceUnits} шт. без цены в{" "}
          {result.missingPriceRecords}{" "}
          {plural(result.missingPriceRecords, "записи", "записях", "записях")}.
          Количество продаж в режиме «Количество» включает их.
        </p>
      )}
    </section>
  );
}
