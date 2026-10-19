import { dateKey, money, type Data, type Sale } from "./model.ts";

export type SalesPeriod = "today" | "7d" | "30d" | "custom";
export type SalesMetric = "quantity" | "revenue";
export type SalesGrouping = "total" | "products";

export type ChartBucket = {
  start: number;
  end: number;
  label: string;
  detail: string;
};
export type ChartSeries = {
  id: string;
  name: string;
  values: number[];
};
export type SalesChartResult = {
  buckets: ChartBucket[];
  series: ChartSeries[];
  total: number;
  missingPriceRecords: number;
  missingPriceUnits: number;
  pricedRecords: number;
  recordCount: number;
  error: string | null;
};

const localDate = (value: string) => new Date(`${value}T00:00:00`);
const dayEnd = (date: Date) => {
  const end = new Date(date);
  end.setDate(end.getDate() + 1);
  return +end;
};
const short = (date: Date) =>
  date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

export function salesChartData(
  data: Data,
  now: Date,
  period: SalesPeriod,
  metric: SalesMetric,
  grouping: SalesGrouping,
  productIds: string[],
  customStart = "",
  customEnd = "",
): SalesChartResult {
  const empty: SalesChartResult = {
    buckets: [],
    series: [],
    total: 0,
    missingPriceRecords: 0,
    missingPriceUnits: 0,
    pricedRecords: 0,
    recordCount: 0,
    error: null,
  };
  let start: Date;
  let end: Date;
  if (period === "custom") {
    start = localDate(customStart);
    end = localDate(customEnd);
    if (
      !customStart ||
      !customEnd ||
      !Number.isFinite(+start) ||
      !Number.isFinite(+end)
    )
      return { ...empty, error: "Укажите начало и конец периода." };
    if (+start > +end)
      return { ...empty, error: "Начало периода должно быть раньше конца." };
  } else {
    end = localDate(dateKey(now));
    start = new Date(end);
    start.setDate(
      start.getDate() - (period === "30d" ? 29 : period === "7d" ? 6 : 0),
    );
  }
  const days = Math.round((+end - +start) / 86400000) + 1;
  const buckets: ChartBucket[] = [];
  if (period === "today") {
    for (let hour = 0; hour < 24; hour++) {
      const at = new Date(start);
      at.setHours(hour, 0, 0, 0);
      buckets.push({
        start: +at,
        end: +at + 3600000,
        label: `${String(hour).padStart(2, "0")}:00`,
        detail: `${short(at)}, ${String(hour).padStart(2, "0")}:00–${String(hour + 1).padStart(2, "0")}:00`,
      });
    }
  } else {
    const step = days > 45 ? 7 : 1;
    for (
      let cursor = new Date(start);
      +cursor <= +end;
      cursor.setDate(cursor.getDate() + step)
    ) {
      const bucketEnd = new Date(cursor);
      bucketEnd.setDate(bucketEnd.getDate() + step - 1);
      if (+bucketEnd > +end) bucketEnd.setTime(+end);
      buckets.push({
        start: +cursor,
        end: dayEnd(bucketEnd),
        label: short(cursor),
        detail:
          step === 1 || dateKey(cursor) === dateKey(bucketEnd)
            ? cursor.toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : `${short(cursor)} — ${short(bucketEnd)}`,
      });
    }
  }
  const selected = new Set(productIds);
  const byProduct = new Map(
    productIds.map((id) => [id, Array(buckets.length).fill(0) as number[]]),
  );
  let missingPriceRecords = 0;
  let missingPriceUnits = 0;
  let pricedRecords = 0;
  let recordCount = 0;
  for (const sale of data.sales) {
    if (!selected.has(sale.productId)) continue;
    const at = +new Date(sale.soldAt);
    const index = buckets.findIndex(
      (bucket) => at >= bucket.start && at < bucket.end,
    );
    if (index < 0) continue;
    recordCount++;
    const missing = sale.lines?.length
      ? sale.lines.filter(
          (line) => line.total === null || !Number.isFinite(line.total),
        )
      : null;
    if (
      sale.lines?.some(
        (line) => line.total !== null && Number.isFinite(line.total),
      )
    )
      pricedRecords++;
    if (missing === null || missing.length) {
      missingPriceRecords++;
      missingPriceUnits +=
        missing === null
          ? sale.quantity
          : missing.reduce((sum, line) => sum + line.quantity, 0);
    }
    const value =
      metric === "quantity"
        ? sale.quantity
        : sale.lines?.reduce(
            (sum, line) =>
              sum +
              (line.total !== null && Number.isFinite(line.total)
                ? line.total
                : 0),
            0,
          ) || 0;
    byProduct.get(sale.productId)![index] += value;
  }
  const productSeries = productIds.map((id) => ({
    id,
    name:
      data.products.find((product) => product.id === id)?.name ||
      "Удалённый продукт",
    values: byProduct.get(id)!.map(money),
  }));
  const series =
    grouping === "total"
      ? [
          {
            id: "total",
            name: "Все выбранные продукты",
            values: buckets.map((_, index) =>
              money(
                productSeries.reduce(
                  (sum, item) => sum + item.values[index],
                  0,
                ),
              ),
            ),
          },
        ]
      : productSeries;
  return {
    buckets,
    series,
    total: money(
      productSeries.reduce(
        (sum, item) => sum + item.values.reduce((a, b) => a + b, 0),
        0,
      ),
    ),
    missingPriceRecords,
    missingPriceUnits,
    pricedRecords,
    recordCount,
    error: null,
  };
}

export function hourlySalesProfile(
  data: Data,
  productId: string,
  today: Date,
  openHour: number,
  closeHour: number,
): { days: number; fractionAt: (hour: number) => number } | null {
  const byDay = new Map<string, Sale[]>();
  for (const sale of data.sales) {
    const at = new Date(sale.soldAt);
    if (
      sale.productId !== productId ||
      +at >= +today ||
      dateKey(at) === dateKey(today)
    )
      continue;
    const key = dateKey(at);
    byDay.set(key, [...(byDay.get(key) || []), sale]);
  }
  const usable = [...byDay.values()].filter((sales) => {
    const hours = new Set(
      sales.map((sale) => new Date(sale.soldAt).getHours()),
    );
    return (
      hours.size >= 2 && sales.reduce((sum, sale) => sum + sale.quantity, 0) > 0
    );
  });
  if (usable.length < 3 || closeHour <= openHour) return null;
  return {
    days: usable.length,
    fractionAt: (hour) =>
      usable.reduce((sum, sales) => {
        const total = sales.reduce((amount, sale) => amount + sale.quantity, 0);
        const sold = sales.reduce((amount, sale) => {
          const at = new Date(sale.soldAt);
          const saleHour = at.getHours() + at.getMinutes() / 60;
          return amount + (saleHour <= hour ? sale.quantity : 0);
        }, 0);
        return sum + sold / total;
      }, 0) / usable.length,
  };
}
