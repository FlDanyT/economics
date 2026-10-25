import {
  assessTodayWeather, availableFor, batchViews, businessClock, businessDateKey,
  dateKey, describeTomorrowWeather, expirationAdvice, forecast, initialPlan,
  money, shortDateTime, todayRecommendation,
  type Data, type HourlyWeather, type Product, type Weather,
} from "./model.ts";

export type AssistantPeriod = "today" | "7d" | "all";
export type AssistantQuestion =
  | "todayDecision" | "todaySummary" | "todayWhy"
  | "tomorrowMorning" | "tomorrowProduct" | "tomorrowWhy" | "tomorrowWeather"
  | "freshness" | "expiry" | "expired" | "discounts"
  | "salesToday" | "salesTop" | "salesProduct" | "salePrices"
  | "productStock" | "productBatches";
export type AssistantTopic = "today" | "tomorrow" | "attention" | "sales";
export type AssistantWeather = {
  items: Weather[];
  hourly: HourlyWeather[];
  timeZone?: string;
  status: "idle" | "loading" | "ready" | "error";
};
export type AssistantContext = { data: Data; now: Date; weather: AssistantWeather };
export type AssistantRow = { label: string; value: string; detail?: string };
export type AssistantAnswer = {
  title: string;
  summary: string;
  details?: string[];
  rows?: AssistantRow[];
  links?: { label: string; to: string }[];
  followUps?: AssistantQuestion[];
};

export const topicOptions: { id: AssistantTopic; label: string; description: string }[] = [
  { id: "today", label: "Что делать сегодня?", description: "Выпуск, остатки и текущая смена" },
  { id: "tomorrow", label: "Что приготовить завтра?", description: "Спрос и первая партия" },
  { id: "attention", label: "Что требует внимания?", description: "Свежесть, сроки и скидки" },
  { id: "sales", label: "Как идут продажи?", description: "Количество, товары и цены" },
];
export const questionOptions: Record<AssistantTopic, AssistantQuestion[]> = {
  today: ["todayDecision", "todaySummary", "todayWhy"],
  tomorrow: ["tomorrowMorning", "tomorrowProduct", "tomorrowWhy", "tomorrowWeather"],
  attention: ["freshness", "expiry", "expired", "discounts"],
  sales: ["salesToday", "salesTop", "salesProduct", "salePrices"],
};
export const questionLabels: Record<AssistantQuestion, string> = {
  todayDecision: "Нужно ли что-то допечь сейчас?",
  todaySummary: "Что приготовлено и продано сегодня?",
  todayWhy: "Почему предлагается допечь?",
  tomorrowMorning: "Сколько приготовить утром?",
  tomorrowProduct: "Покажи план по товару",
  tomorrowWhy: "Почему такой план?",
  tomorrowWeather: "Какая погода завтра и как она учтена?",
  freshness: "Какие партии скоро перестанут быть свежими?",
  expiry: "Какие партии скоро нельзя будет продавать?",
  expired: "Есть ли просроченные остатки?",
  discounts: "Где рекомендована скидка?",
  salesToday: "Сколько продано сегодня?",
  salesTop: "Что продавалось лучше всего?",
  salesProduct: "Как продавался конкретный товар?",
  salePrices: "По какой цене продавали?",
  productStock: "Сколько осталось?",
  productBatches: "Какие партии требуют внимания?",
};
export const productQuestions: AssistantQuestion[] = [
  "productStock", "todayDecision", "tomorrowProduct", "productBatches", "salesProduct", "todayWhy",
];
export const needsProduct = (question: AssistantQuestion) =>
  (["todayWhy", "tomorrowProduct", "tomorrowWhy", "salesProduct", "salePrices", "productStock", "productBatches"] as AssistantQuestion[]).includes(question);
export const periodLabels: Record<AssistantPeriod, string> = {
  today: "Сегодня", "7d": "Последние 7 дней", all: "За всё время",
};

const qty = (n: number) => `${n} шт.`;
const rub = (n: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n)} ₽`;
const validHours = (data: Data) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(data.settings.open) &&
  /^([01]\d|2[0-3]):[0-5]\d$/.test(data.settings.close) &&
  data.settings.close > data.settings.open;
const minutesText = (value: number) => {
  const minutes = Math.max(0, Math.ceil(value));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} ч ${minutes % 60} мин` : `${minutes} мин`;
};
const productLink = [{ label: "Открыть продукты", to: "/app/products" }];
const salesLink = [{ label: "Открыть историю продаж", to: "/app/sales" }];
const noProducts = (): AssistantAnswer => ({
  title: "Пока нет товаров", summary: "Добавьте товар, затем записывайте партии и продажи.", links: productLink,
});
const missingProduct = (): AssistantAnswer => ({
  title: "Товар не найден", summary: "Возможно, он был удалён. Выберите другой товар.", links: productLink,
});
const periodStart = (ctx: AssistantContext, period: AssistantPeriod) => {
  const today = businessClock(ctx.now, ctx.weather.timeZone).date;
  if (period === "all") return "";
  if (period === "today") return today;
  const start = new Date(`${today}T12:00`);
  start.setDate(start.getDate() - 6);
  return dateKey(start);
};
const salesInPeriod = (ctx: AssistantContext, period: AssistantPeriod) => {
  const start = periodStart(ctx, period);
  const today = businessClock(ctx.now, ctx.weather.timeZone).date;
  return ctx.data.sales.filter((sale) => {
    const date = businessDateKey(new Date(sale.soldAt), ctx.weather.timeZone);
    return +new Date(sale.soldAt) <= +ctx.now && date >= start && date <= today;
  });
};
const productName = (ctx: AssistantContext, id: string) =>
  ctx.data.products.find((product) => product.id === id)?.name || "Удалённый товар";
const batchName = (batch: { id: string; preparedAt: string }) =>
  `Партия №${batch.id.slice(0, 8)} · ${shortDateTime(batch.preparedAt)}`;
const targetTomorrow = (ctx: AssistantContext) => {
  const local = businessClock(ctx.now, ctx.weather.timeZone).date;
  const date = new Date(`${local}T12:00`);
  date.setDate(date.getDate() + 1);
  return date;
};
const tomorrowFor = (ctx: AssistantContext, product: Product) => {
  const target = targetTomorrow(ctx);
  const weather = ctx.weather.items.find((item) => item.date === dateKey(target));
  const estimate = forecast(ctx.data, product.id, target, weather, ctx.now, ctx.weather.timeZone);
  return { target, weather, estimate, morning: estimate.amount === null || !validHours(ctx.data) ? null : initialPlan(ctx.data, product, estimate.amount) };
};
const todayFor = (ctx: AssistantContext, product: Product) => {
  const weather = assessTodayWeather(ctx.weather.hourly, ctx.data.settings, ctx.now, ctx.weather.timeZone);
  return todayRecommendation(ctx.data, product.id, weather, ctx.now, ctx.weather.timeZone);
};
const todayDecision = (ctx: AssistantContext, product: Product) => {
  const result = todayFor(ctx, product);
  if (!validHours(ctx.data))
    return { result, decision: "Проверьте часы работы", reason: "Без корректного графика расчёт до закрытия недоступен." };
  if (result.remainingMinutes === 0)
    return { result, decision: "Смена завершилась", reason: "Дополнительный выпуск на сегодня не предлагается." };
  if (result.remainingDemand !== null && result.available >= result.remainingDemand)
    return { result, decision: "Допекать не нужно", reason: `Доступно ${qty(result.available)}, ожидаемый спрос до закрытия — ${qty(result.remainingDemand)}.` };
  if (!result.canPrepare)
    return { result, decision: "Не успеть до закрытия", reason: `Приготовление займёт ${minutesText(product.prepMinutes)}; осталось ${minutesText(result.remainingMinutes)}.` };
  if (result.remainingDemand === null)
    return { result, decision: "Нет числовой оценки", reason: "Нужны записи продаж для оценки спроса до закрытия." };
  if (result.extra > 0)
    return { result, decision: `Допеките ${qty(result.extra)}`, reason: `Ожидаемый спрос до закрытия — ${qty(result.remainingDemand)}, доступно — ${qty(result.available)}.` };
  return { result, decision: "Допекать не нужно", reason: `Доступно ${qty(result.available)}, ожидаемый спрос до закрытия — ${qty(result.remainingDemand)}.` };
};
const periodSalesRows = (ctx: AssistantContext, period: AssistantPeriod) => {
  const sums = new Map(ctx.data.products.map((product) => [product.id, 0]));
  for (const sale of salesInPeriod(ctx, period)) sums.set(sale.productId, (sums.get(sale.productId) || 0) + sale.quantity);
  return ctx.data.products.map((product) => ({ product, quantity: sums.get(product.id) || 0 }));
};

export function buildAssistantAnswer(
  ctx: AssistantContext, question: AssistantQuestion,
  productId: string | null = null, period: AssistantPeriod = "7d",
): AssistantAnswer {
  const products = ctx.data.products;
  const product = products.find((item) => item.id === productId);
  if (needsProduct(question) && !product) return productId ? missingProduct() : {
    title: "Выберите товар", summary: "Для ответа нужен конкретный товар.", links: productLink,
  };
  if (!products.length && !["tomorrowWeather", "salesToday"].includes(question)) return noProducts();
  const views = batchViews(ctx.data, ctx.now);
  const localDate = businessClock(ctx.now, ctx.weather.timeZone).date;
  switch (question) {
    case "todayDecision": {
      if (product) {
        const { result, decision, reason } = todayDecision(ctx, product);
        return {
          title: `${product.name}: ${decision}`, summary: reason,
          rows: [
            { label: "Доступно к продаже", value: qty(result.available) },
            { label: "Спрос до закрытия", value: result.remainingDemand === null ? "Нет оценки" : qty(result.remainingDemand) },
            { label: "Дополнительный выпуск", value: result.remainingDemand === null || !result.canPrepare ? "Не рассчитан" : qty(result.extra) },
            { label: "Приготовление", value: minutesText(product.prepMinutes) },
          ], followUps: ["todayWhy", "productBatches", "tomorrowProduct"],
        };
      }
      return {
        title: "Решение на текущую смену", summary: "По каждому товару — с учётом остатков и времени до закрытия.",
        rows: products.map((item) => {
          const { result, decision, reason } = todayDecision(ctx, item);
          return { label: item.name, value: decision, detail: `Доступно ${qty(result.available)}. ${reason}` };
        }), followUps: ["todaySummary", "todayWhy"],
      };
    }
    case "todaySummary": {
      const produced = ctx.data.batches.filter((batch) => businessDateKey(new Date(batch.preparedAt), ctx.weather.timeZone) === localDate)
        .reduce((sum, batch) => sum + batch.quantity, 0);
      const sold = salesInPeriod(ctx, "today").reduce((sum, sale) => sum + sale.quantity, 0);
      const available = products.reduce((sum, item) => sum + availableFor(ctx.data, item.id, ctx.now), 0);
      const urgent = views.filter((view) => view.remaining > 0 && view.status !== "fresh").length;
      return { title: `Сегодня продано ${qty(sold)}`, summary: `Приготовлено ${qty(produced)}; сейчас доступно к продаже ${qty(available)}. Партий, требующих внимания: ${urgent}.`,
        rows: products.map((item) => {
          const made = ctx.data.batches.filter((batch) => batch.productId === item.id && businessDateKey(new Date(batch.preparedAt), ctx.weather.timeZone) === localDate)
            .reduce((sum, batch) => sum + batch.quantity, 0);
          const soldProduct = salesInPeriod(ctx, "today").filter((sale) => sale.productId === item.id).reduce((sum, sale) => sum + sale.quantity, 0);
          return { label: item.name, value: `Продано ${qty(soldProduct)}`, detail: `Приготовлено ${qty(made)} · доступно ${qty(availableFor(ctx.data, item.id, ctx.now))}.` };
        }),
        followUps: ["todayDecision", "expiry", "salesToday"],
      };
    }
    case "todayWhy": {
      const { result, decision, reason } = todayDecision(ctx, product!);
      return { title: `${product!.name}: ${decision}`, summary: reason,
        details: [
          `Продано сегодня ${qty(result.sold)}; выпущено ${qty(result.produced)}; доступно ${qty(result.available)}.`,
          ...result.reasons,
          ...(result.remainingDemand === null ? ["Числовой расчёт до закрытия пока недоступен."] : []),
        ], followUps: ["todayDecision", "productBatches", "tomorrowProduct"],
      };
    }
    case "tomorrowMorning": {
      const rows = products.map((item) => {
        const { estimate, morning } = tomorrowFor(ctx, item);
        return { label: item.name, value: morning === null ? estimate.amount === null ? "Утром: нет оценки" : "Утром: нет плана" : `Утром: ${qty(morning.quantity)}`,
          detail: estimate.amount === null ? "Недостаточно данных продаж для числового плана." :
            `Спрос за весь день: ${qty(estimate.amount)}${estimate.preliminary ? " · предварительно" : ""}.${morning === null ? " Проверьте часы работы для расчёта первой партии." : ""}` };
      });
      return { title: "Первая партия на завтра", summary: "Утренний выпуск показан отдельно от ожидаемого спроса за весь день.",
        rows, followUps: ["tomorrowProduct", "tomorrowWeather"],
        links: !validHours(ctx.data) ? [{ label: "Настроить часы работы", to: "/app/settings" }] : rows.every((row) => row.value.includes("нет оценки")) ? salesLink : undefined };
    }
    case "tomorrowProduct": {
      const { estimate, morning } = tomorrowFor(ctx, product!);
      if (estimate.amount === null) return { title: `${product!.name}: нет оценки`, summary: "Запишите продажи: погода сама по себе не создаёт числовой план.", links: salesLink,
        followUps: ["tomorrowWeather", "salesProduct"] };
      if (morning === null) return { title: `${product!.name}: план первой партии недоступен`, summary: `Ожидаемый спрос за день — ${qty(estimate.amount)}, но рабочие часы требуют проверки.`,
        links: [{ label: "Настроить часы работы", to: "/app/settings" }], followUps: ["tomorrowWeather", "salesProduct"] };
      return { title: `${product!.name}: утром ${qty(morning!.quantity)}`, summary: `Ожидаемый спрос за весь день — ${qty(estimate.amount)}${estimate.preliminary ? "; оценка предварительная" : ""}.`,
        details: [`Первая партия — ${Math.round(morning!.fraction * 100)}% дневной оценки с учётом окна свежести. Её можно дополнить позже по фактическим продажам.`],
        followUps: ["tomorrowWhy", "tomorrowWeather", "todayDecision"] };
    }
    case "tomorrowWhy": {
      const { estimate, morning } = tomorrowFor(ctx, product!);
      if (estimate.amount === null) return { title: `${product!.name}: нет основы для плана`, summary: "Недостаточно продаж и текущего темпа для числовой оценки.", links: salesLink, followUps: ["tomorrowWeather", "salesProduct"] };
      if (morning === null) return { title: `${product!.name}: первая партия не рассчитана`, summary: `Оценка спроса за день — ${qty(estimate.amount)}. Укажите корректные часы работы для расчёта утреннего выпуска.`,
        details: estimate.reasons, links: [{ label: "Настроить часы работы", to: "/app/settings" }], followUps: ["tomorrowWeather", "salesProduct"] };
      return { title: `${product!.name}: утром ${qty(morning!.quantity)}`, summary: `Спрос на весь день — ${qty(estimate.amount)}${estimate.preliminary ? "; предварительная оценка" : ""}.`,
        details: [...estimate.reasons, `Окно свежести для первой партии: ${Math.min(product!.freshnessHours, product!.shelfHours)} ч; доля плана ${Math.round(morning!.fraction * 100)}%.`],
        followUps: ["tomorrowProduct", "tomorrowWeather"] };
    }
    case "tomorrowWeather": {
      const target = targetTomorrow(ctx);
      const weather = ctx.weather.items.find((item) => item.date === dateKey(target));
      const estimate = product ? tomorrowFor(ctx, product).estimate : products.map((item) => tomorrowFor(ctx, item).estimate).find((item) => item.amount !== null);
      const description = describeTomorrowWeather(weather, estimate, ctx.weather.status === "loading");
      const prefix = !ctx.data.settings.city.trim() ? "Укажите город в настройках. " : "";
      return { title: description.title, summary: `${prefix}${description.conditions}. ${description.detail}`,
        details: description.note ? [description.note] : undefined,
        links: !ctx.data.settings.city.trim() ? [{ label: "Настроить город", to: "/app/settings" }] : undefined,
        followUps: ["tomorrowMorning", "tomorrowProduct"] };
    }
    case "freshness": {
      // Отдельный порог вопроса: последняя четверть свежести, максимум 4 часа.
      const approaching = views.filter((view) => {
        const item = products.find((p) => p.id === view.productId);
        if (!item || view.remaining <= 0 || view.status === "expired" || +new Date(view.preparedAt) > +ctx.now) return false;
        const left = (+view.freshUntil - +ctx.now) / 3600000;
        return left > 0 && left <= Math.min(4, item.freshnessHours * 0.25);
      }).sort((a, b) => +a.freshUntil - +b.freshUntil);
      return { title: approaching.length ? `${approaching.length} партий скоро потеряют свежесть` : "Скорой потери свежести нет",
        summary: "«Скоро» означает последнюю четверть срока свежести, не более 4 часов. После неё партия не становится автоматически просроченной.",
        rows: approaching.map((view) => ({ label: `${productName(ctx, view.productId)} · ${batchName(view)}`, value: qty(view.remaining), detail: `До конца свежести ${minutesText((+view.freshUntil - +ctx.now) / 60000)}.` })),
        followUps: ["expiry", "expired", "discounts"], links: approaching.length ? productLink : undefined };
    }
    case "expiry": {
      const nearing = views.filter((view) => view.remaining > 0 && +new Date(view.preparedAt) <= +ctx.now && expirationAdvice(view, products.find((p) => p.id === view.productId)?.shelfHours || 0, ctx.now)?.kind === "discount")
        .sort((a, b) => +a.expiresAt - +b.expiresAt);
      return { title: nearing.length ? `${nearing.length} партий близки к концу срока продажи` : "Скоро истекающих партий нет",
        summary: "Показаны партии, которые ещё можно продавать; ближайшие сроки идут первыми.",
        rows: nearing.map((view) => ({ label: `${productName(ctx, view.productId)} · ${batchName(view)}`, value: qty(view.remaining), detail: `До конца продажи ${minutesText((+view.expiresAt - +ctx.now) / 60000)}.` })),
        followUps: ["discounts", "expired"], links: nearing.length ? productLink : undefined };
    }
    case "expired": {
      const expired = views.filter((view) => view.remaining > 0 && view.status === "expired").sort((a, b) => +a.expiresAt - +b.expiresAt);
      return { title: expired.length ? `${expired.length} партий с просроченным остатком` : "Просроченных остатков нет",
        summary: expired.length ? "Эти единицы нельзя продавать. Запишите списание на странице продуктов." : "Партии с истёкшим сроком продажи и остатком не найдены.",
        rows: expired.map((view) => ({ label: `${productName(ctx, view.productId)} · ${batchName(view)}`, value: qty(view.remaining), detail: `Срок продажи истёк ${shortDateTime(view.expiresAt)}.` })),
        links: expired.length ? [{ label: "Открыть партии и списания", to: "/app/products" }] : undefined,
        followUps: ["expiry", "discounts"] };
    }
    case "discounts": {
      const advised = views.flatMap((view) => {
        const item = products.find((p) => p.id === view.productId);
        if (+new Date(view.preparedAt) > +ctx.now) return [];
        const advice = item && expirationAdvice(view, item.shelfHours, ctx.now);
        return advice?.kind === "discount" ? [{ view, advice }] : [];
      }).sort((a, b) => +a.view.expiresAt - +b.view.expiresAt);
      return { title: advised.length ? `Скидка рекомендована для ${advised.length} партий` : "Рекомендаций по скидке нет",
        summary: "Рекомендация сама не меняет цену; применённая скидка показана отдельно.",
        rows: advised.map(({ view, advice }) => ({ label: `${productName(ctx, view.productId)} · ${batchName(view)}`,
          value: `Рекомендация ${advice.discountPercent}%`, detail: `${qty(view.remaining)}; до конца продажи ${minutesText(advice.minutesLeft)}. ${view.discount ? `Применена скидка ${view.discount.percent}%.` : "Скидка не применена."}` })),
        links: advised.length ? productLink : undefined, followUps: ["expiry", "expired"] };
    }
    case "salesToday": {
      const rows = periodSalesRows(ctx, "today").filter((row) => row.quantity > 0);
      const total = rows.reduce((sum, row) => sum + row.quantity, 0);
      return { title: `Сегодня продано ${qty(total)}`, summary: total ? "Записанные продажи по товарам:" : "Продаж за сегодня пока нет.",
        rows: rows.map((row) => ({ label: row.product.name, value: qty(row.quantity) })),
        links: salesLink, followUps: ["salesTop", "salesProduct"] };
    }
    case "salesTop": {
      const rows = periodSalesRows(ctx, period).filter((row) => row.quantity > 0)
        .sort((a, b) => b.quantity - a.quantity || a.product.name.localeCompare(b.product.name, "ru") || a.product.id.localeCompare(b.product.id));
      return { title: rows.length ? `Лидер продаж: ${rows[0].product.name}` : "Продаж за период нет",
        summary: `${periodLabels[period]} · рейтинг по количеству проданных единиц${rows.length ? ` · всего ${qty(rows.reduce((n, row) => n + row.quantity, 0))}` : ""}.`,
        rows: rows.map((row, index) => ({ label: `${index + 1}. ${row.product.name}`, value: qty(row.quantity) })),
        links: salesLink, followUps: ["salesProduct", "salePrices"] };
    }
    case "salesProduct": {
      const sales = salesInPeriod(ctx, period).filter((sale) => sale.productId === product!.id);
      const total = sales.reduce((sum, sale) => sum + sale.quantity, 0);
      const byDay = new Map<string, number>();
      for (const sale of sales) {
        const day = businessDateKey(new Date(sale.soldAt), ctx.weather.timeZone);
        byDay.set(day, (byDay.get(day) || 0) + sale.quantity);
      }
      return { title: `${product!.name}: продано ${qty(total)}`, summary: `${periodLabels[period]} · записанные единицы${total ? "." : "; продаж пока нет."}`,
        rows: [...byDay].sort((a, b) => b[0].localeCompare(a[0])).map(([date, amount]) => ({ label: date, value: qty(amount) })),
        links: salesLink, followUps: ["salePrices", "salesTop", "tomorrowProduct"] };
    }
    case "salePrices": {
      const sales = salesInPeriod(ctx, period).filter((sale) => sale.productId === product!.id);
      const prices = new Map<string, { quantity: number; total: number; unitPrice: number; discount: number | null }>();
      let missingUnits = 0, missingRecords = 0;
      for (const sale of sales) {
        let pricedUnits = 0;
        for (const line of sale.lines || []) {
          if (line.unitPrice === null || line.total === null) continue;
          pricedUnits += line.quantity;
          const key = `${line.unitPrice}:${line.discountPercent ?? ""}`;
          const entry = prices.get(key) || { quantity: 0, total: 0, unitPrice: line.unitPrice, discount: line.discountPercent };
          entry.quantity += line.quantity;
          entry.total += line.total;
          prices.set(key, entry);
        }
        if (pricedUnits < sale.quantity) { missingUnits += sale.quantity - pricedUnits; missingRecords++; }
      }
      const knownTotal = money([...prices.values()].reduce((sum, entry) => sum + entry.total, 0));
      return { title: prices.size ? `${product!.name}: ${missingUnits ? "известная часть выручки" : "выручка"} ${rub(knownTotal)}` : `${product!.name}: нет записанных цен`,
        summary: `${periodLabels[period]}. ${missingUnits ? `Без цены: ${qty(missingUnits)} в ${missingRecords} записях; общая выручка за период неизвестна.` : sales.length ? "Все найденные продажи имеют цену в записи." : "Продаж за период нет."}`,
        rows: [...prices.values()].sort((a, b) => a.unitPrice - b.unitPrice).map((entry) => ({ label: `${rub(entry.unitPrice)} за единицу${entry.discount ? ` · скидка ${entry.discount}%` : ""}`, value: qty(entry.quantity), detail: `Сумма ${rub(money(entry.total))}.` })),
        links: salesLink, followUps: ["salesProduct", "salesTop"] };
    }
    case "productStock": {
      const available = availableFor(ctx.data, product!.id, ctx.now);
      const recorded = views.filter((view) => view.productId === product!.id && view.remaining > 0 && view.status === "expired")
        .reduce((sum, view) => sum + view.remaining, 0);
      return { title: `${product!.name}: доступно ${qty(available)}`, summary: recorded ? `Ещё ${qty(recorded)} записано в просроченных партиях; продавать их нельзя.` : "Учтены только партии с действующим сроком продажи.",
        followUps: ["todayDecision", "productBatches", "tomorrowProduct"], links: productLink };
    }
    case "productBatches": {
      const relevant = views.filter((view) => view.productId === product!.id && view.remaining > 0 && view.status !== "fresh" && +new Date(view.preparedAt) <= +ctx.now)
        .sort((a, b) => +a.expiresAt - +b.expiresAt);
      return { title: relevant.length ? `${product!.name}: требуют внимания ${relevant.length} партий` : `${product!.name}: срочных партий нет`,
        summary: "Сроки продажи и рекомендации по скидкам считаются для каждой партии отдельно.",
        rows: relevant.map((view) => {
          const advice = expirationAdvice(view, product!.shelfHours, ctx.now);
          return { label: batchName(view), value: qty(view.remaining), detail: advice?.kind === "expired" ? "Просрочена: не продавать, записать списание." :
            advice?.kind === "discount" ? `До конца продажи ${minutesText(advice.minutesLeft)}; рекомендация скидки ${advice.discountPercent}%${view.discount ? `, применена ${view.discount.percent}%` : ""}.` : "Проверьте партию." };
        }), links: relevant.length ? productLink : undefined, followUps: ["discounts", "expired", "productStock"] };
    }
  }
}
