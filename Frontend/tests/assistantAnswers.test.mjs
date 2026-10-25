import assert from "node:assert/strict";
import test from "node:test";
import { buildAssistantAnswer } from "../src/assistantAnswers.ts";
import { assessTodayWeather, forecast, initialPlan, todayRecommendation } from "../src/model.ts";

const now = new Date("2026-10-25T12:00:00Z");
const product = { id: "p", name: "Круассан", description: "", weight: 90, prepMinutes: 30, freshnessHours: 8, shelfHours: 48, price: 100 };
const settings = { businessName: "", city: "Москва", open: "08:00", close: "20:00" };
const hourly = Array.from({ length: 24 }, (_, hour) => ({ time: `2026-10-25T${String(hour).padStart(2, "0")}:00`, code: 1, temperature: 17 }));
const weather = { items: [{ date: "2026-10-26", code: 1, temperature: 18, label: "Ясно" }], hourly, timeZone: "UTC", status: "ready" };
const base = {
  products: [product],
  batches: [{ id: "b", productId: "p", quantity: 20, preparedAt: "2026-10-24T08:00:00Z", discarded: 0 }],
  sales: [
    { id: "old", productId: "p", quantity: 12, soldAt: "2026-10-24T12:00:00Z" },
    { id: "today", productId: "p", quantity: 4, soldAt: "2026-10-25T10:00:00Z" },
  ],
  settings,
};
const context = (data = base, currentWeather = weather, at = now) => ({ data, weather: currentWeather, now: at });

test("ответы за сегодня и завтра используют те же расчёты, что обзор", () => {
  const todayWeather = assessTodayWeather(hourly, settings, now, "UTC");
  const current = todayRecommendation(base, "p", todayWeather, now, "UTC");
  const todayAnswer = buildAssistantAnswer(context(), "todayDecision", "p");
  assert.match(todayAnswer.title, new RegExp(`${current.extra} шт`));
  assert.equal(todayAnswer.rows.find((row) => row.label === "Доступно к продаже").value, `${current.available} шт.`);

  const target = new Date("2026-10-26T12:00:00Z");
  const estimate = forecast(base, "p", target, weather.items[0], now, "UTC");
  const morning = initialPlan(base, product, estimate.amount);
  const tomorrowAnswer = buildAssistantAnswer(context(), "tomorrowProduct", "p");
  assert.match(tomorrowAnswer.title, new RegExp(`${morning.quantity} шт`));
  assert.match(tomorrowAnswer.summary, new RegExp(`${estimate.amount} шт`));
});

test("без продаж нет числового плана даже при известной погоде", () => {
  const data = { ...base, sales: [] };
  const answer = buildAssistantAnswer(context(data), "tomorrowMorning");
  assert.equal(answer.rows[0].value, "Утром: нет оценки");
  const today = buildAssistantAnswer(context({ ...data, batches: [] }), "todayDecision", "p");
  assert.match(today.title, /Нет числовой оценки/);
  assert.equal(today.rows.find((row) => row.label === "Доступно к продаже").value, "0 шт.");
  const weatherAnswer = buildAssistantAnswer(context(data), "tomorrowWeather");
  assert.match(weatherAnswer.summary, /недостаточно продаж/);
  assert.doesNotMatch(weatherAnswer.summary, /снижен/);
});

test("погода показывается только когда доступна и поправка реально рассчитана", () => {
  const wet = { ...weather, items: [{ date: "2026-10-26", code: 61, temperature: 18, label: "Осадки" }] };
  assert.match(buildAssistantAnswer(context(base, wet), "tomorrowWeather", "p").summary, /снижен на 5%/);
  const unavailable = { ...weather, items: [], hourly: [], status: "error" };
  assert.match(buildAssistantAnswer(context(base, unavailable), "tomorrowWeather", "p").summary, /без погодных данных/);
});

test("срочная партия получает совет по скидке, просроченная — только списание", () => {
  const expiring = { ...base, sales: [], batches: [{ id: "soon", productId: "p", quantity: 5, preparedAt: "2026-10-23T14:00:00Z", discarded: 0 }] };
  const advice = buildAssistantAnswer(context(expiring), "discounts");
  assert.match(advice.rows[0].value, /Рекомендация 20%/);
  const expired = buildAssistantAnswer(context(expiring, weather, new Date("2026-10-25T14:01:00Z")), "expired");
  assert.match(expired.summary, /нельзя продавать/);
  const noDiscount = buildAssistantAnswer(context(expiring, weather, new Date("2026-10-25T14:01:00Z")), "discounts");
  assert.equal(noDiscount.rows?.length ?? 0, 0);
});

test("старые продажи без цены не получают выдуманную выручку", () => {
  const answer = buildAssistantAnswer(context(), "salePrices", "p", "all");
  assert.match(answer.title, /нет записанных цен/);
  assert.match(answer.summary, /Без цены: 16 шт/);
});

test("сумма с известной ценой помечается частичной, если есть старые записи", () => {
  const data = { ...base, sales: [...base.sales, {
    id: "priced", productId: "p", quantity: 1, soldAt: "2026-10-25T11:00:00Z",
    lines: [{ batchId: "b", quantity: 1, regularPrice: 100, discountPercent: null, unitPrice: 100, total: 100 }],
  }] };
  const answer = buildAssistantAnswer(context(data), "salePrices", "p", "all");
  assert.match(answer.title, /известная часть выручки/);
  assert.match(answer.summary, /общая выручка за период неизвестна/);
});

test("без города помощник предлагает открыть настройки, без часов не даёт числовой совет", () => {
  const noCity = { ...base, settings: { ...settings, city: "" } };
  const weatherAnswer = buildAssistantAnswer(context(noCity, { ...weather, items: [], status: "idle" }), "tomorrowWeather", "p");
  assert.equal(weatherAnswer.links[0].to, "/app/settings");
  const noHours = { ...base, settings: { ...settings, close: "" } };
  const decision = buildAssistantAnswer(context(noHours), "todayDecision", "p");
  assert.match(decision.title, /Проверьте часы работы/);
  const morning = buildAssistantAnswer(context(noHours), "tomorrowProduct", "p");
  assert.match(morning.title, /план первой партии недоступен/);
  assert.doesNotMatch(morning.summary, /NaN/);
});

test("выбранный товар сохраняет контекст между вопросами", () => {
  const stock = buildAssistantAnswer(context(), "productStock", "p");
  const tomorrow = buildAssistantAnswer(context(), "tomorrowProduct", "p");
  assert.match(stock.title, /Круассан/);
  assert.match(tomorrow.title, /Круассан/);
});
