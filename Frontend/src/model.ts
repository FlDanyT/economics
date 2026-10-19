export type Product = {
  id: string;
  name: string;
  description: string;
  image?: string;
  weight: number;
  prepMinutes: number;
  freshnessHours: number;
  shelfHours: number;
  price?: number;
};
export type BatchDiscount = {
  percent: number;
  regularPrice: number;
  unitPrice: number;
};
export type Batch = {
  id: string;
  productId: string;
  quantity: number;
  preparedAt: string;
  discarded: number;
  discount?: BatchDiscount;
};
export type SaleLine = {
  batchId: string;
  quantity: number;
  regularPrice: number | null;
  discountPercent: number | null;
  unitPrice: number | null;
  total: number | null;
};
export type Sale = {
  id: string;
  productId: string;
  quantity: number;
  soldAt: string;
  lines?: SaleLine[];
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
export type HourlyWeather = { time: string; code: number; temperature: number };
export type TodayWeather = {
  kind: "available" | "unavailable" | "closed" | "hours";
  adjustment: number;
  rainMinutes: number;
  heatMinutes: number;
  remainingMinutes: number;
  firstRain: string | null;
  firstHeat: string | null;
  conditions: string | null;
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
export function businessClock(now: Date, timeZone?: string) {
  if (!timeZone) return { date: dateKey(now), minutes: now.getHours() * 60 + now.getMinutes() };
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(now);
    const part = (type: string) => parts.find((item) => item.type === type)?.value || "00";
    return {
      date: `${part("year")}-${part("month")}-${part("day")}`,
      minutes: Number(part("hour")) * 60 + Number(part("minute")),
    };
  } catch {
    return { date: dateKey(now), minutes: now.getHours() * 60 + now.getMinutes() };
  }
}
export const businessDateKey = (date: Date, timeZone?: string) =>
  businessClock(date, timeZone).date;
function workingMinutes(settings: Settings) {
  const parse = (value: string) => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const open = parse(settings.open), close = parse(settings.close);
  return open === null || close === null || close <= open ? null : { open, close };
}
export function assessTodayWeather(
  hourly: HourlyWeather[], settings: Settings, now: Date, timeZone?: string,
): TodayWeather {
  const hours = workingMinutes(settings);
  const empty = (kind: TodayWeather["kind"]): TodayWeather => ({
    kind, adjustment: 0, rainMinutes: 0, heatMinutes: 0,
    remainingMinutes: 0, firstRain: null, firstHeat: null, conditions: null,
  });
  if (!hours) return empty("hours");
  const clock = businessClock(now, timeZone);
  if (clock.minutes >= hours.close) return empty("closed");
  const start = Math.max(clock.minutes, hours.open);
  const remainingMinutes = hours.close - start;
  let covered = 0, rainMinutes = 0, heatMinutes = 0;
  let firstRain: string | null = null, firstHeat: string | null = null;
  let conditions: string | null = null;
  for (const point of hourly) {
    if (!point.time.startsWith(`${clock.date}T`)) continue;
    const match = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})$/.exec(point.time);
    if (!match || !Number.isFinite(point.code) || !Number.isFinite(point.temperature)) continue;
    const slot = Number(match[1]) * 60 + Number(match[2]);
    const from = Math.max(start, slot), to = Math.min(hours.close, slot + 60);
    if (to <= from) continue;
    const minutes = to - from;
    covered += minutes;
    conditions ??= `${hourlyWeatherLabel(point.code)}, ${Math.round(point.temperature)}° в ближайший час`;
    if (point.code >= 51) {
      rainMinutes += minutes;
      firstRain ??= `${String(Math.floor(from / 60)).padStart(2, "0")}:${String(from % 60).padStart(2, "0")}`;
    } else if (point.temperature >= 28) {
      heatMinutes += minutes;
      firstHeat ??= `${String(Math.floor(from / 60)).padStart(2, "0")}:${String(from % 60).padStart(2, "0")}`;
    }
  }
  // Incomplete hourly coverage must not be mistaken for fair weather.
  if (covered !== remainingMinutes) return { ...empty("unavailable"), remainingMinutes };
  return {
    kind: "available", remainingMinutes, rainMinutes, heatMinutes,
    firstRain, firstHeat, conditions,
    adjustment: rainMinutes || heatMinutes
      ? -(0.05 * rainMinutes + 0.03 * heatMinutes) / remainingMinutes : 0,
  };
}
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
export const money = (n: number) => Math.round(n * 100) / 100;
export function batchPrice(product: Product, batch: Batch) {
  if (batch.discount)
    return {
      regularPrice: batch.discount.regularPrice,
      discountPercent: batch.discount.percent,
      unitPrice: batch.discount.unitPrice,
    };
  const regularPrice =
    Number.isFinite(product.price) && (product.price ?? -1) >= 0
      ? product.price!
      : null;
  return { regularPrice, discountPercent: null, unitPrice: regularPrice };
}
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
function hourlyWeatherLabel(code: number) {
  return code >= 51 ? "Осадки" : code >= 2 ? "Облачно" : code === 1 ? "Малооблачно" : "Ясно";
}
export type BatchStatus = "fresh" | "aging" | "expired";
export type BatchView = Batch & {
  remaining: number;
  expiresAt: Date;
  freshUntil: Date;
  status: BatchStatus;
  pastFreshness: boolean;
};
const expirationWindowHours = (shelfHours: number) =>
  Math.min(4, shelfHours * 0.25);
function eligibleBatches(data: Data, sale: Sale) {
  const at = +new Date(sale.soldAt);
  const product = data.products.find((p) => p.id === sale.productId);
  if (!product || !Number.isFinite(at)) return [];
  return data.batches
    .filter(
      (batch) =>
        batch.productId === sale.productId &&
        +new Date(batch.preparedAt) <= at &&
        +new Date(batch.preparedAt) + product.shelfHours * 3600000 > at,
    )
    .sort((a, b) => +new Date(a.preparedAt) - +new Date(b.preparedAt));
}
function allocateSales(data: Data) {
  const remaining = new Map(
    data.batches.map((b) => [b.id, Math.max(0, b.quantity - b.discarded)]),
  );
  for (const sale of [...data.sales].sort(
    (a, b) => +new Date(a.soldAt) - +new Date(b.soldAt),
  )) {
    let needed = sale.quantity;
    if (!Number.isInteger(needed) || needed <= 0)
      return { remaining, valid: false };
    const eligible = eligibleBatches(data, sale);
    if (sale.lines?.length) {
      for (const line of sale.lines) {
        if (
          !Number.isInteger(line.quantity) ||
          line.quantity <= 0 ||
          !eligible.some((b) => b.id === line.batchId) ||
          line.quantity > (remaining.get(line.batchId) || 0)
        )
          return { remaining, valid: false };
        remaining.set(
          line.batchId,
          (remaining.get(line.batchId) || 0) - line.quantity,
        );
        needed -= line.quantity;
      }
    } else {
      for (const batch of eligible) {
        const used = Math.min(needed, remaining.get(batch.id) || 0);
        remaining.set(batch.id, (remaining.get(batch.id) || 0) - used);
        needed -= used;
        if (!needed) break;
      }
    }
    if (needed !== 0) return { remaining, valid: false };
  }
  return { remaining, valid: true };
}
export function saleLinesFor(
  data: Data,
  productId: string,
  quantity: number,
  soldAt: string,
  excludeSaleId?: string,
  previousLines: SaleLine[] = [],
): SaleLine[] | null {
  const product = data.products.find((p) => p.id === productId);
  if (!product || !Number.isInteger(quantity) || quantity <= 0) return null;
  const priorData = {
    ...data,
    sales: data.sales.filter(
      (sale) =>
        sale.id !== excludeSaleId &&
        +new Date(sale.soldAt) <= +new Date(soldAt),
    ),
  };
  const { remaining, valid } = allocateSales(priorData);
  if (!valid) return null;
  const candidate: Sale = { id: "", productId, quantity, soldAt };
  const lines: SaleLine[] = [];
  for (const batch of eligibleBatches(data, candidate)) {
    const used = Math.min(quantity, remaining.get(batch.id) || 0);
    if (!used) continue;
    const previous = previousLines.find((line) => line.batchId === batch.id);
    const price = previous
      ? {
          regularPrice: previous.regularPrice,
          discountPercent: previous.discountPercent,
          unitPrice: previous.unitPrice,
        }
      : batchPrice(product, batch);
    if (price.unitPrice === null) return null;
    lines.push({
      batchId: batch.id,
      quantity: used,
      ...price,
      total: money(used * price.unitPrice),
    });
    quantity -= used;
    if (!quantity) break;
  }
  return quantity === 0 ? lines : null;
}
export function batchViews(data: Data, now = new Date()): BatchView[] {
  const { remaining } = allocateSales(data);
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
        : hoursLeft <= expirationWindowHours(p?.shelfHours || 24)
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
export type ExpirationAdvice =
  | { kind: "discount"; minutesLeft: number; discountPercent: 10 | 20 | 30 }
  | { kind: "expired" };

export function expirationAdvice(
  batch: BatchView,
  shelfHours: number,
  now = new Date(),
): ExpirationAdvice | null {
  if (batch.remaining <= 0 || !Number.isFinite(shelfHours) || shelfHours <= 0)
    return null;
  const millisecondsLeft = +batch.expiresAt - +now;
  if (!Number.isFinite(millisecondsLeft)) return null;
  if (millisecondsLeft <= 0) return { kind: "expired" };
  const alertWindow = expirationWindowHours(shelfHours) * 3600000;
  if (millisecondsLeft > alertWindow) return null;
  return {
    kind: "discount",
    minutesLeft: Math.ceil(millisecondsLeft / 60000),
    discountPercent:
      millisecondsLeft <= 3600000
        ? 30
        : millisecondsLeft <= 2 * 3600000
          ? 20
          : 10,
  };
}
export function salesFitBatches(data: Data): boolean {
  return allocateSales(data).valid;
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
  timeZone?: string,
) {
  const byDay = new Map<string, number>();
  data.sales
    .filter(
      (s) =>
        s.productId === productId &&
        +new Date(s.soldAt) < +now &&
        businessDateKey(new Date(s.soldAt), timeZone) !== businessDateKey(now, timeZone),
    )
    .forEach((s) => {
      const k = businessDateKey(new Date(s.soldAt), timeZone);
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
  preliminary: boolean;
  basis: string;
  count: number;
  weatherAdjustment: number;
  holidayAdjustment: number;
  reasons: string[];
};
export function describeTomorrowWeather(
  weather: Weather | undefined,
  estimate: Forecast | undefined,
  loading = false,
) {
  const hasEstimate = estimate?.amount != null;
  const conditions = weather
    ? `${weather.label}, ${Math.round(weather.temperature)}°`
    : loading
      ? "Загружаем прогноз погоды"
      : "Нет данных о погоде";
  if (!hasEstimate)
    return {
      kind: "context",
      title: weather
        ? "Погода на завтра"
        : loading
          ? "Загружаем погоду"
          : "Погода недоступна",
      conditions,
      detail: weather
        ? "Погода известна, но для оценки спроса пока недостаточно продаж."
        : loading
          ? "Оценка спроса пока недоступна: для расчёта нужны продажи."
          : "Оценка спроса пока недоступна; погодных данных нет.",
      note: "",
    };
  if (!weather)
    return {
      kind: "neutral",
      title: loading ? "Загружаем погоду" : "Погода не учтена",
      conditions,
      detail: "Прогноз спроса рассчитан без погодных данных.",
      note: "",
    };
  if (estimate.weatherAdjustment === -0.05)
    return {
      kind: "adjusted",
      title: "Погода учтена",
      conditions,
      detail: "Ожидаются осадки. Прогноз спроса снижен на 5%.",
      note: "Условное правило текущей модели.",
    };
  if (estimate.weatherAdjustment === -0.03)
    return {
      kind: "adjusted",
      title: "Погода учтена",
      conditions,
      detail: "Ожидается жара. Прогноз спроса снижен на 3%.",
      note: "Условное правило текущей модели.",
    };
  return {
    kind: "neutral",
    title: "Погода учтена",
    conditions,
    detail:
      "Осадков и сильной жары не ожидается. Прогноз спроса рассчитан без изменения из-за погоды.",
    note: "",
  };
}
export function forecast(
  data: Data,
  productId: string,
  target: Date,
  weather?: Weather,
  now = new Date(),
  timeZone?: string,
): Forecast {
  const { days, comparable, basis } = historicalDays(
    data,
    productId,
    target,
    now,
    timeZone,
  );
  const soldToday = data.sales
    .filter(
      (sale) =>
        sale.productId === productId &&
        businessDateKey(new Date(sale.soldAt), timeZone) === businessDateKey(now, timeZone) &&
        +new Date(sale.soldAt) <= +now,
    )
    .reduce((sum, sale) => sum + sale.quantity, 0);
  const hours = workingMinutes(data.settings);
  const opening = hours?.open ?? 0;
  const closing = hours?.close ?? 0;
  const clock = businessClock(now, timeZone).minutes;
  const elapsed = Math.max(
    0,
    Math.min(1, (clock - opening) / Math.max(1, closing - opening)),
  );
  const todayPace =
    soldToday >= 2 && elapsed >= 0.2 && !!hours
      ? soldToday / elapsed
      : null;
  let preliminaryBasis = "";
  let observedDemand: number | null = null;
  if (days.length > 0) {
    const historicalAverage =
      comparable.reduce((sum, day) => sum + day.qty, 0) / comparable.length;
    observedDemand = historicalAverage;
    if (todayPace !== null) {
      const boundedPace = Math.min(
        historicalAverage * 1.5,
        Math.max(historicalAverage * 0.5, todayPace),
      );
      const todayWeight = days.length >= 3 ? 0.2 : 0.3;
      observedDemand =
        historicalAverage * (1 - todayWeight) + boundedPace * todayWeight;
      preliminaryBasis = `Сегодня продано ${soldToday} шт. за ${Math.round(elapsed * 100)}% смены; текущий темп учтён с весом ${Math.round(todayWeight * 100)}%`;
    }
  } else if (todayPace !== null) {
    observedDemand = todayPace;
    preliminaryBasis = `Темп продаж сегодня: ${soldToday} шт. за ${Math.round(elapsed * 100)}% смены`;
  }
  if (observedDemand === null)
    return {
      amount: null,
      preliminary: true,
      basis,
      count: days.length,
      weatherAdjustment: 0,
      holidayAdjustment: 0,
      reasons: [],
    };
  const avg = observedDemand;
  let holidayAdjustment = 0;
  if (getHoliday(target) && comparable.some((d) => !d.holiday))
    holidayAdjustment = 0.1;
  let weatherAdjustment = 0;
  if (weather?.date === dateKey(target))
    weatherAdjustment =
      weather.code >= 51 ? -0.05 : weather.temperature >= 28 ? -0.03 : 0;
  const preliminary = days.length < 3;
  const reasons = [
    ...(days.length
      ? [
          `${preliminary ? "Предварительно: среднее" : "Среднее"} по ${comparable.length} ${plural(comparable.length, "дню", "дням", "дням")} (${basis})`,
        ]
      : []),
    ...(preliminaryBasis ? [preliminaryBasis] : []),
    `День недели: ${target.toLocaleDateString("ru-RU", { weekday: "long" })}${basis === "того же дня недели" ? " — сопоставимые дни учтены" : " — отдельная поправка не применяется"}`,
  ];
  if (holidayAdjustment)
    reasons.push("Основной праздник России: +10% — условная корректировка");
  if (weatherAdjustment)
    reasons.push(
      weatherAdjustment < 0
        ? `Погода (${weather?.label}): ${Math.round(weatherAdjustment * 100)}% — условная корректировка`
        : "",
    );
  else
    reasons.push(
      weather?.date === dateKey(target)
        ? `Погода (${weather.label}): без корректировки`
        : "Погода недоступна: без корректировки",
    );
  return {
    amount: round(avg * (1 + holidayAdjustment + weatherAdjustment)),
    preliminary,
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
  weather?: TodayWeather,
  now = new Date(),
  timeZone?: string,
) {
  const clock = businessClock(now, timeZone);
  const localDate = new Date(`${clock.date}T12:00`);
  const base = forecast(data, productId, localDate, undefined, now, timeZone);
  const sold = data.sales
    .filter(
      (s) =>
        s.productId === productId &&
        businessDateKey(new Date(s.soldAt), timeZone) === clock.date &&
        +new Date(s.soldAt) <= +now,
    )
    .reduce((a, s) => a + s.quantity, 0);
  const produced = data.batches
    .filter(
      (b) =>
        b.productId === productId &&
        businessDateKey(new Date(b.preparedAt), timeZone) === clock.date,
    )
    .reduce((a, b) => a + b.quantity, 0);
  const available = availableFor(data, productId, now);
  const p = data.products.find((x) => x.id === productId);
  const hours = workingMinutes(data.settings);
  const totalMinutes = hours ? hours.close - hours.open : 1;
  const elapsed = Math.max(
    0,
    Math.min(1, (clock.minutes - (hours?.open ?? 0)) / totalMinutes),
  );
  const remainingMinutes = hours ? Math.max(0, hours.close - Math.max(clock.minutes, hours.open)) : 0;
  const pace =
    elapsed >= 0.2 && sold > 0 && base.amount !== null
      ? Math.min(base.amount * 1.5, sold / elapsed)
      : 0;
  const total =
    base.amount === null || !hours ? null : round(Math.max(base.amount, pace));
  const baselineRemaining = total === null ? null : Math.max(0, total - sold);
  const remainingDemand = baselineRemaining === null
    ? null
    : remainingMinutes === 0
      ? 0
      : round(baselineRemaining * (1 + (weather?.kind === "available" ? weather.adjustment : 0)));
  const canPrepare = !!p && remainingMinutes > p.prepMinutes;
  const extra =
    remainingDemand === null || !canPrepare
      ? 0
      : Math.max(0, remainingDemand - available);
  const initial =
    base.amount === null || !p || !hours
      ? null
      : initialPlan(data, p, base.amount).quantity;
  return {
    ...base,
    amount: hours ? base.amount : null,
    sold,
    produced,
    available,
    total,
    remainingDemand,
    extra,
    initial,
    canPrepare,
    remainingMinutes,
    weatherAdjustment: weather?.kind === "available" && baselineRemaining !== null
      ? weather.adjustment : 0,
    reasons: [
      ...base.reasons.filter((reason) => !reason.startsWith("Погода ")),
      ...(baselineRemaining !== null && weather?.kind === "available" && weather.adjustment !== 0
        ? [`Погода до закрытия: спрос на оставшуюся часть дня скорректирован на ${(weather.adjustment * 100).toFixed(1).replace(".", ",")}% по условному правилу модели`]
        : []),
    ],
    paceIncreased:
      base.amount !== null && total !== null && total > base.amount,
  };
}
