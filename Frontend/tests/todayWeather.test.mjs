import assert from "node:assert/strict";
import test from "node:test";
import {
  assessTodayWeather,
  businessClock,
  describeTomorrowWeather,
  forecast,
  todayRecommendation,
} from "../src/model.ts";

const product = {
  id: "p", name: "Хлеб", description: "", weight: 500,
  prepMinutes: 30, freshnessHours: 8, shelfHours: 24,
};
const settings = { businessName: "", city: "Москва", open: "08:00", close: "20:00" };
const now = new Date("2026-10-18T12:00:00Z");
const hourly = (rainHours = []) => Array.from({ length: 24 }, (_, hour) => ({
  time: `2026-10-18T${String(hour).padStart(2, "0")}:00`,
  code: rainHours.includes(hour) ? 61 : 1,
  temperature: 18,
}));
const data = (sales = []) => ({ products: [product], batches: [], sales, settings });
const pastSales = [{ id: "s", productId: "p", quantity: 100, soldAt: "2026-10-17T12:00:00Z" }];
const assess = (points, at = now) => assessTodayWeather(points, settings, at, "UTC");
const recommend = (sales, weather, at = now) => todayRecommendation(data(sales), "p", weather, at, "UTC");

test("осадки в остатке смены уменьшают только оставшийся спрос", () => {
  const weather = assess(hourly([15, 16]));
  assert.equal(weather.kind, "available");
  assert.equal(weather.firstRain, "15:00");
  assert.equal(weather.rainMinutes, 120);
  assert.equal(weather.adjustment, -0.0125);
  const base = recommend(pastSales, assess(hourly()));
  const wet = recommend(pastSales, weather);
  assert.equal(base.remainingDemand, 100);
  assert.equal(wet.remainingDemand, 99);
  assert.equal(wet.extra, 99);
});

test("осадки после закрытия не меняют рекомендацию", () => {
  const weather = assess(hourly([20, 21]));
  assert.equal(weather.kind, "available");
  assert.equal(weather.adjustment, 0);
  assert.equal(weather.firstRain, null);
  assert.equal(recommend(pastSales, weather).remainingDemand, 100);
});

test("часть затронутого часа учитывается пропорционально", () => {
  const at = new Date("2026-10-18T15:30:00Z");
  const weather = assess(hourly([15]), at);
  assert.equal(weather.rainMinutes, 30);
  assert.equal(weather.remainingMinutes, 270);
  assert.equal(weather.adjustment, -(0.05 * 30 / 270));
});

test("неполный прогноз не считается ясной погодой", () => {
  const weather = assess(hourly().filter((point) => point.time !== "2026-10-18T15:00"));
  assert.equal(weather.kind, "unavailable");
  assert.equal(recommend(pastSales, weather).remainingDemand, 100);
});

test("жара снижает оставшийся спрос по доле затронутых часов", () => {
  const points = hourly().map((point) =>
    point.time.endsWith("T16:00") ? { ...point, temperature: 29 } : point);
  const weather = assess(points);
  assert.equal(weather.heatMinutes, 60);
  assert.ok(Math.abs(weather.adjustment + 0.00375) < 1e-10);
});

test("погода без продаж не создаёт числовую оценку", () => {
  const recommendation = recommend([], assess(hourly([15, 16])));
  assert.equal(recommendation.amount, null);
  assert.equal(recommendation.remainingDemand, null);
  assert.equal(recommendation.extra, 0);
});

test("после закрытия выпуск не предлагается", () => {
  const at = new Date("2026-10-18T21:00:00Z");
  const weather = assess(hourly([21]), at);
  const recommendation = recommend(pastSales, weather, at);
  assert.equal(weather.kind, "closed");
  assert.equal(recommendation.remainingDemand, 0);
  assert.equal(recommendation.extra, 0);
});

test("без рабочих часов числовой спрос до закрытия не вычисляется", () => {
  const invalid = { ...settings, close: "" };
  const weather = assessTodayWeather(hourly(), invalid, now, "UTC");
  const recommendation = todayRecommendation(
    { ...data(pastSales), settings: invalid }, "p", weather, now, "UTC");
  assert.equal(weather.kind, "hours");
  assert.equal(recommendation.amount, null);
  assert.equal(recommendation.remainingDemand, null);
});

test("завтрашнее правило осадков сохранено", () => {
  const target = new Date("2026-10-19T12:00:00Z");
  const weather = { date: "2026-10-19", code: 61, temperature: 18, label: "Осадки" };
  const result = forecast(data(pastSales), "p", target, weather, now, "UTC");
  assert.equal(result.weatherAdjustment, -0.05);
  assert.equal(describeTomorrowWeather(weather, result).detail, "Ожидаются осадки. Прогноз спроса снижен на 5%.");
});

test("дата и часы берутся из часового пояса бизнеса", () => {
  assert.deepEqual(businessClock(new Date("2026-10-18T22:15:00Z"), "Europe/Moscow"), {
    date: "2026-10-19", minutes: 75,
  });
});
