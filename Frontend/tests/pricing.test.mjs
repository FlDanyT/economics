import assert from "node:assert/strict";
import test from "node:test";
import {
  availableFor,
  batchPrice,
  batchViews,
  describeTomorrowWeather,
  forecast,
  money,
  saleLinesFor,
  salesFitBatches,
} from "../src/model.ts";

const product = {
  id: "p",
  name: "Круассан",
  description: "",
  weight: 100,
  prepMinutes: 30,
  freshnessHours: 8,
  shelfHours: 24,
  price: 100,
};
const older = {
  id: "a",
  productId: "p",
  quantity: 2,
  preparedAt: "2026-10-18T08:00:00Z",
  discarded: 0,
  discount: { percent: 20, regularPrice: 100, unitPrice: 80 },
};
const newer = {
  id: "b",
  productId: "p",
  quantity: 5,
  preparedAt: "2026-10-18T09:00:00Z",
  discarded: 0,
};
const settings = { businessName: "", city: "", open: "08:00", close: "20:00" };
const data = () => ({
  products: [product],
  batches: [older, newer],
  sales: [],
  settings,
});

test("скидка относится только к выбранной партии и хранит базовую цену", () => {
  assert.equal(batchPrice(product, older).unitPrice, 80);
  assert.equal(batchPrice(product, newer).unitPrice, 100);
  assert.equal(batchPrice({ ...product, price: 150 }, older).unitPrice, 80);
  assert.equal(batchPrice({ ...product, price: 150 }, newer).unitPrice, 150);
  assert.equal(money(99.99 * 0.7), 69.99);
});

test("одна продажа сохраняет две партии с разными ценами", () => {
  const snapshot = data();
  const soldAt = "2026-10-18T10:00:00Z";
  const lines = saleLinesFor(snapshot, "p", 4, soldAt);
  assert.deepEqual(
    lines.map(({ batchId, quantity, unitPrice, discountPercent, total }) => ({
      batchId,
      quantity,
      unitPrice,
      discountPercent,
      total,
    })),
    [
      {
        batchId: "a",
        quantity: 2,
        unitPrice: 80,
        discountPercent: 20,
        total: 160,
      },
      {
        batchId: "b",
        quantity: 2,
        unitPrice: 100,
        discountPercent: null,
        total: 200,
      },
    ],
  );
  snapshot.sales.push({ id: "s", productId: "p", quantity: 4, soldAt, lines });
  assert.equal(salesFitBatches(snapshot), true);
  assert.deepEqual(
    batchViews(snapshot, new Date(soldAt)).map((batch) => batch.remaining),
    [0, 3],
  );
  snapshot.products[0] = { ...product, price: 150 };
  snapshot.batches[0] = { ...older, discount: undefined };
  assert.deepEqual(
    snapshot.sales[0].lines.map((line) => line.unitPrice),
    [80, 100],
  );
});

test("старые записи остаются доступными без выдуманной цены", () => {
  const snapshot = data();
  snapshot.products[0] = { ...product, price: undefined };
  snapshot.sales.push({
    id: "old",
    productId: "p",
    quantity: 1,
    soldAt: "2026-10-18T10:00:00Z",
  });
  assert.equal(batchPrice(snapshot.products[0], newer).unitPrice, null);
  assert.equal(snapshot.sales[0].lines, undefined);
  assert.equal(
    batchViews(snapshot, new Date("2026-10-18T11:00:00Z"))[0].remaining,
    1,
  );
  assert.equal(salesFitBatches(snapshot), true);
});

test("истёкшую партию нельзя включить в новую продажу", () => {
  const snapshot = data();
  snapshot.batches = [older];
  const at = new Date("2026-10-19T09:00:00Z");
  assert.equal(availableFor(snapshot, "p", at), 0);
  assert.equal(saleLinesFor(snapshot, "p", 1, at.toISOString()), null);
});

test("погода не создаёт прогноз без продаж, продажи дают предварительную оценку", () => {
  const snapshot = data();
  const now = new Date("2026-10-18T12:00:00Z");
  const target = new Date("2026-10-19T12:00:00Z");
  const weather = {
    date: "2026-10-19",
    code: 61,
    temperature: 12,
    label: "Осадки",
  };
  assert.equal(forecast(snapshot, "p", target, weather, now).amount, null);
  snapshot.sales = [
    {
      id: "today",
      productId: "p",
      quantity: 2,
      soldAt: "2026-10-18T11:00:00Z",
    },
  ];
  const estimate = forecast(snapshot, "p", target, weather, now);
  assert.equal(estimate.preliminary, true);
  assert.ok(estimate.amount > 0);
  assert.ok(
    estimate.reasons.some((reason) =>
      reason.includes("условная корректировка"),
    ),
  );
  snapshot.sales.push(
    { id: "d1", productId: "p", quantity: 4, soldAt: "2026-10-15T11:00:00Z" },
    { id: "d2", productId: "p", quantity: 5, soldAt: "2026-10-16T11:00:00Z" },
    { id: "d3", productId: "p", quantity: 6, soldAt: "2026-10-17T11:00:00Z" },
  );
  assert.equal(
    forecast(snapshot, "p", target, weather, now).preliminary,
    false,
  );
});

test("погодная строка завтра показывает только применённую поправку", () => {
  const snapshot = data();
  const now = new Date("2026-10-18T12:00:00Z");
  const target = new Date("2026-10-19T12:00:00Z");
  const rain = {
    date: "2026-10-19",
    code: 61,
    temperature: 30,
    label: "Осадки",
  };
  const heat = { date: "2026-10-19", code: 0, temperature: 30, label: "Ясно" };
  const mild = { date: "2026-10-19", code: 0, temperature: 20, label: "Ясно" };

  const noSales = forecast(snapshot, "p", target, rain, now);
  assert.equal(noSales.amount, null);
  assert.equal(
    describeTomorrowWeather(rain, noSales).title,
    "Погода на завтра",
  );
  assert.match(
    describeTomorrowWeather(rain, noSales).conditions,
    /Осадки, 30°/,
  );
  assert.doesNotMatch(describeTomorrowWeather(rain, noSales).detail, /снижен/);

  snapshot.sales = [
    { id: "d1", productId: "p", quantity: 20, soldAt: "2026-10-17T10:00:00Z" },
  ];
  const rainyEstimate = forecast(snapshot, "p", target, rain, now);
  assert.equal(rainyEstimate.weatherAdjustment, -0.05);
  assert.equal(
    describeTomorrowWeather(rain, rainyEstimate).title,
    "Погода учтена",
  );
  assert.match(
    describeTomorrowWeather(rain, rainyEstimate).detail,
    /снижен на 5%/,
  );
  assert.match(
    describeTomorrowWeather(rain, rainyEstimate).note,
    /Условное правило/,
  );

  const hotEstimate = forecast(snapshot, "p", target, heat, now);
  assert.equal(hotEstimate.weatherAdjustment, -0.03);
  assert.match(
    describeTomorrowWeather(heat, hotEstimate).detail,
    /снижен на 3%/,
  );

  const mildEstimate = forecast(snapshot, "p", target, mild, now);
  assert.equal(mildEstimate.weatherAdjustment, 0);
  assert.match(
    describeTomorrowWeather(mild, mildEstimate).detail,
    /без изменения из-за погоды/,
  );

  const noWeatherEstimate = forecast(snapshot, "p", target, undefined, now);
  assert.equal(noWeatherEstimate.weatherAdjustment, 0);
  assert.match(
    describeTomorrowWeather(undefined, noWeatherEstimate).detail,
    /без погодных данных/,
  );
  assert.doesNotMatch(
    describeTomorrowWeather(undefined, noSales).detail,
    /рассчитан/,
  );

  const wrongDate = { ...rain, date: "2026-10-20" };
  assert.equal(
    forecast(snapshot, "p", target, wrongDate, now).weatherAdjustment,
    0,
  );
});

test("завтрашняя оценка учитывает сегодняшний темп вместе с историей", () => {
  const snapshot = data();
  const now = new Date("2026-10-18T12:00:00Z");
  const target = new Date("2026-10-19T12:00:00Z");
  snapshot.sales = [
    { id: "d1", productId: "p", quantity: 4, soldAt: "2026-10-16T10:00:00Z" },
    { id: "d2", productId: "p", quantity: 4, soldAt: "2026-10-17T10:00:00Z" },
  ];
  const pastOnly = forecast(snapshot, "p", target, undefined, now);
  snapshot.sales.push({
    id: "today",
    productId: "p",
    quantity: 6,
    soldAt: "2026-10-18T11:00:00Z",
  });
  const blended = forecast(snapshot, "p", target, undefined, now);
  assert.equal(pastOnly.amount, 4);
  assert.equal(blended.amount, 5);
  assert.equal(blended.preliminary, true);
  assert.ok(blended.reasons.some((reason) => reason.includes("весом 30%")));
});

test("день недели выбирает сопоставимые продажи, погода остаётся условной", () => {
  const snapshot = data();
  const now = new Date("2026-10-18T12:00:00Z");
  const target = new Date("2026-10-19T12:00:00Z");
  snapshot.sales = [
    { id: "m1", productId: "p", quantity: 5, soldAt: "2026-10-05T10:00:00Z" },
    { id: "m2", productId: "p", quantity: 10, soldAt: "2026-10-12T10:00:00Z" },
    { id: "t1", productId: "p", quantity: 100, soldAt: "2026-10-13T10:00:00Z" },
  ];
  const sunny = forecast(
    snapshot,
    "p",
    target,
    {
      date: "2026-10-19",
      code: 0,
      temperature: 15,
      label: "Ясно",
    },
    now,
  );
  assert.equal(sunny.amount, 8);
  assert.equal(sunny.basis, "того же дня недели");
  assert.ok(
    sunny.reasons.some((reason) => reason.includes("без корректировки")),
  );
  assert.ok(sunny.reasons.some((reason) => reason.includes("понедельник")));
});
