export type Product = {
  id: string;
  name: string;
  description: string;
  image?: string;
  weight: number;
  prepMinutes: number;
  freshnessHours: number;
  shelfHours: number;
};
export type Batch = {
  id: string;
  productId: string;
  quantity: number;
  preparedAt: string;
  discarded: number;
};
export type Sale = {
  id: string;
  productId: string;
  quantity: number;
  soldAt: string;
};
export type Settings = {
  businessName: string;
  city: string;
  open: string;
  close: string;
};
export type Weather = {
  date: string;
  code: number;
  temperature: number;
  label: string;
};
export type Data = {
  products: Product[];
  batches: Batch[];
  sales: Sale[];
  settings: Settings;
};
export const initialData: Data = {
  products: [],
  batches: [],
  sales: [],
  settings: { businessName: "", city: "", open: "08:00", close: "20:00" },
};
export const key = "economics-prototype-v1";
export const id = () => crypto.randomUUID();
export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const timeInput = (d: Date) =>
  `${dateKey(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
export const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
export const shortDateTime = (value: string | Date) =>
  new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export const plural = (n: number, one: string, two: string, five: string) =>
  n % 10 === 1 && n % 100 !== 11
    ? one
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
      ? two
      : five;
export const hours = (n: number) => `${n} ${plural(n, "час", "часа", "часов")}`;
export const round = (n: number) => Math.max(0, Math.round(n));
export function getHoliday(date: Date): string | null {
  const md = `${date.getMonth() + 1}-${date.getDate()}`;
  const fixed: Record<string, string> = {
    "1-1": "Новогодние каникулы",
    "1-2": "Новогодние каникулы",
    "1-3": "Новогодние каникулы",
    "1-4": "Новогодние каникулы",
    "1-5": "Новогодние каникулы",
    "1-6": "Новогодние каникулы",
    "1-7": "Рождество",
    "1-8": "Новогодние каникулы",
    "2-23": "День защитника Отечества",
    "3-8": "Международный женский день",
    "5-1": "Праздник Весны и Труда",
    "5-9": "День Победы",
    "6-12": "День России",
    "11-4": "День народного единства",
  };
  return fixed[md] || null;
}
export function weatherLabel(code: number): string {
  return code >= 51 ? "Осадки" : code >= 3 ? "Облачно" : "Ясно";
}
export type BatchStatus = "fresh" | "aging" | "expired";
export type BatchView = Batch & {
  remaining: number;
  expiresAt: Date;
  freshUntil: Date;
  status: BatchStatus;
  pastFreshness: boolean;
};
export function batchViews(data: Data, now = new Date()): BatchView[] {
  const remaining = new Map(
    data.batches.map((b) => [b.id, Math.max(0, b.quantity - b.discarded)]),
  );
  const sales = [...data.sales].sort(
    (a, b) => +new Date(a.soldAt) - +new Date(b.soldAt),
  );
  for (const sale of sales) {
    let needed = sale.quantity;
    const eligible = data.batches
      .filter(
        (b) =>
          b.productId === sale.productId &&
          +new Date(b.preparedAt) <= +new Date(sale.soldAt),
      )
      .sort((a, b) => +new Date(a.preparedAt) - +new Date(b.preparedAt));
    for (const batch of eligible) {
      const p = data.products.find((x) => x.id === batch.productId);
      if (
        !p ||
        +new Date(batch.preparedAt) + p.shelfHours * 3600000 <=
          +new Date(sale.soldAt)
      )
        continue;
      const used = Math.min(needed, remaining.get(batch.id) || 0);
      remaining.set(batch.id, (remaining.get(batch.id) || 0) - used);
      needed -= used;
      if (!needed) break;
    }
  }
  return data.batches.map((b) => {
    const p = data.products.find((x) => x.id === b.productId);
    const prepared = +new Date(b.preparedAt);
    const expiresAt = new Date(prepared + (p?.shelfHours || 24) * 3600000);
    const freshUntil = new Date(prepared + (p?.freshnessHours || 12) * 3600000);
    const left = remaining.get(b.id) || 0;
    const hoursLeft = (+expiresAt - +now) / 3600000;
    const status: BatchStatus =
      hoursLeft <= 0
        ? "expired"
        : hoursLeft <= Math.min(4, (p?.shelfHours || 24) * 0.25)
          ? "aging"
          : "fresh";
    return {
      ...b,
      remaining: left,
      expiresAt,
      freshUntil,
      status,
      pastFreshness: +freshUntil <= +now,
    };
  });
}
export function salesFitBatches(data: Data): boolean {
  const remaining = new Map(
    data.batches.map((b) => [b.id, Math.max(0, b.quantity - b.discarded)]),
  );
  for (const sale of [...data.sales].sort(
    (a, b) => +new Date(a.soldAt) - +new Date(b.soldAt),
  )) {
    let needed = sale.quantity;
    const product = data.products.find((p) => p.id === sale.productId);
    if (!product) return false;
    for (const batch of data.batches
      .filter(
        (b) =>
          b.productId === sale.productId &&
          +new Date(b.preparedAt) <= +new Date(sale.soldAt),
      )
      .sort((a, b) => +new Date(a.preparedAt) - +new Date(b.preparedAt))) {
      if (
        +new Date(batch.preparedAt) + product.shelfHours * 3600000 <=
        +new Date(sale.soldAt)
      )
        continue;
      const used = Math.min(needed, remaining.get(batch.id) || 0);
      remaining.set(batch.id, (remaining.get(batch.id) || 0) - used);
      needed -= used;
      if (!needed) break;
    }
    if (needed > 0) return false;
  }
  return true;
}
export function availableFor(data: Data, productId: string, now = new Date()) {
  return batchViews(data, now)
    .filter(
      (b) =>
        b.productId === productId &&
        b.status !== "expired" &&
        +new Date(b.preparedAt) <= +now,
    )
    .reduce((n, b) => n + b.remaining, 0);
}
export function historicalDays(
  data: Data,
  productId: string,
  target: Date,
  now = new Date(),
) {
  const byDay = new Map<string, number>();
  data.sales
    .filter(
      (s) =>
        s.productId === productId &&
        +new Date(s.soldAt) < +now &&
        dateKey(new Date(s.soldAt)) !== dateKey(now),
    )
    .forEach((s) => {
      const k = dateKey(new Date(s.soldAt));
      byDay.set(k, (byDay.get(k) || 0) + s.quantity);
    });
  const days = [...byDay].map(([date, qty]) => ({
    date,
    qty,
    weekday: new Date(`${date}T12:00`).getDay(),
    holiday: !!getHoliday(new Date(`${date}T12:00`)),
  }));
  const sameType = days.filter((d) => d.holiday === !!getHoliday(target));
  const sameWeekday = sameType.filter((d) => d.weekday === target.getDay());
  const comparable =
    sameWeekday.length >= 2
      ? sameWeekday
      : sameType.length >= 2
        ? sameType
        : days;
  return {
    days,
    comparable,
    basis:
      sameWeekday.length >= 2
        ? "того же дня недели"
        : sameType.length >= 2
          ? "такого же типа дня"
          : "всех дней с продажами",
  };
}
export type Forecast = {
  amount: number | null;
  basis: string;
  count: number;
  weatherAdjustment: number;
  holidayAdjustment: number;
  reasons: string[];
};
export function forecast(
  data: Data,
  productId: string,
  target: Date,
  weather?: Weather,
  now = new Date(),
): Forecast {
  const { days, comparable, basis } = historicalDays(
    data,
    productId,
    target,
    now,
  );
  if (days.length < 3)
    return {
      amount: null,
      basis,
      count: days.length,
      weatherAdjustment: 0,
      holidayAdjustment: 0,
      reasons: [],
    };
  const avg = comparable.reduce((sum, d) => sum + d.qty, 0) / comparable.length;
  let holidayAdjustment = 0;
  if (getHoliday(target) && comparable.some((d) => !d.holiday))
    holidayAdjustment = 0.1;
  let weatherAdjustment = 0;
  if (weather?.date === dateKey(target))
    weatherAdjustment =
      weather.code >= 51 ? -0.05 : weather.temperature >= 28 ? -0.03 : 0;
  const reasons = [
    `Среднее по ${comparable.length} ${plural(comparable.length, "дню", "дням", "дням")} (${basis})`,
  ];
  if (holidayAdjustment)
    reasons.push("Основной праздник России: +10% — условная корректировка");
  if (weatherAdjustment)
    reasons.push(
      weatherAdjustment < 0
        ? `Погода (${weather?.label}): ${Math.round(weatherAdjustment * 100)}% — условная корректировка`
        : "",
    );
  return {
    amount: round(avg * (1 + holidayAdjustment + weatherAdjustment)),
    basis,
    count: days.length,
    weatherAdjustment,
    holidayAdjustment,
    reasons: reasons.filter(Boolean),
  };
}
export function initialPlan(data: Data, product: Product, demand: number) {
  const [oh, om] = data.settings.open.split(":").map(Number),
    [ch, cm] = data.settings.close.split(":").map(Number);
  const workingHours = Math.max(1, ch + cm / 60 - oh - om / 60);
  const freshWindow = Math.min(product.freshnessHours, product.shelfHours);
  const fraction = Math.min(0.7, Math.max(0.35, freshWindow / workingHours));
  return { quantity: round(demand * fraction), fraction };
}
export function todayRecommendation(
  data: Data,
  productId: string,
  weather?: Weather,
  now = new Date(),
) {
  const base = forecast(data, productId, now, weather, now);
  const sold = data.sales
    .filter(
      (s) =>
        s.productId === productId &&
        dateKey(new Date(s.soldAt)) === dateKey(now),
    )
    .reduce((a, s) => a + s.quantity, 0);
  const produced = data.batches
    .filter(
      (b) =>
        b.productId === productId &&
        dateKey(new Date(b.preparedAt)) === dateKey(now),
    )
    .reduce((a, b) => a + b.quantity, 0);
  const available = availableFor(data, productId, now);
  const p = data.products.find((x) => x.id === productId);
  const [oh, om] = data.settings.open.split(":").map(Number),
    [ch, cm] = data.settings.close.split(":").map(Number);
  const opening = new Date(now);
  opening.setHours(oh, om, 0, 0);
  const closing = new Date(now);
  closing.setHours(ch, cm, 0, 0);
  const totalMinutes = Math.max(1, (+closing - +opening) / 60000);
  const elapsed = Math.max(
    0,
    Math.min(1, (+now - +opening) / 60000 / totalMinutes),
  );
  const remainingMinutes = Math.max(0, (+closing - +now) / 60000);
  const pace =
    elapsed >= 0.2 && sold > 0 && base.amount !== null
      ? Math.min(base.amount * 1.5, sold / elapsed)
      : 0;
  const total =
    base.amount === null ? null : round(Math.max(base.amount, pace));
  const remainingDemand = total === null ? null : Math.max(0, total - sold);
  const canPrepare = !!p && remainingMinutes > p.prepMinutes;
  const extra =
    remainingDemand === null || !canPrepare
      ? 0
      : Math.max(0, remainingDemand - available);
  const initial =
    base.amount === null || !p
      ? null
      : initialPlan(data, p, base.amount).quantity;
  return {
    ...base,
    sold,
    produced,
    available,
    total,
    remainingDemand,
    extra,
    initial,
    canPrepare,
    remainingMinutes,
    paceIncreased:
      base.amount !== null && total !== null && total > base.amount,
  };
}
