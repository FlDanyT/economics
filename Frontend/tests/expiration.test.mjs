import assert from "node:assert/strict";
import test from "node:test";
import {
  availableFor,
  batchViews,
  expirationAdvice,
  forecast,
} from "../src/model.ts";

const preparedAt = "2026-10-17T15:00:00.000Z";
const product = {
  id: "product-1",
  name: "Булочка",
  description: "",
  weight: 100,
  prepMinutes: 30,
  freshnessHours: 12,
  shelfHours: 24,
};
const batch = {
  id: "batch-1",
  productId: product.id,
  quantity: 10,
  preparedAt,
  discarded: 0,
};
const makeData = (changes = {}) => ({
  products: [product],
  batches: [batch],
  sales: [],
  settings: { businessName: "", city: "", open: "08:00", close: "20:00" },
  ...changes,
});
const adviceAt = (data, time) => {
  const now = new Date(time);
  return expirationAdvice(
    batchViews(data, now)[0],
    data.products[0].shelfHours,
    now,
  );
};

test("партия без продаж получает рекомендацию отдельно от прогноза спроса", () => {
  const data = makeData();
  const now = new Date("2026-10-18T12:00:00.000Z");
  assert.equal(forecast(data, product.id, now, undefined, now).amount, null);
  assert.deepEqual(adviceAt(data, now), {
    kind: "discount",
    minutesLeft: 180,
    discountPercent: 10,
  });
});

test("скидка растёт по мере приближения срока", () => {
  const data = makeData();
  assert.equal(adviceAt(data, "2026-10-18T13:30:00.000Z").discountPercent, 20);
  assert.equal(adviceAt(data, "2026-10-18T14:30:00.000Z").discountPercent, 30);
});

test("истёкшая партия недоступна к продаже и не получает скидку", () => {
  const data = makeData();
  const now = new Date("2026-10-18T15:01:00.000Z");
  assert.equal(batchViews(data, now)[0].status, "expired");
  assert.deepEqual(adviceAt(data, now), { kind: "expired" });
  assert.equal(availableFor(data, product.id, now), 0);
});

test("при нулевом остатке рекомендация не появляется", () => {
  const data = makeData({ batches: [{ ...batch, discarded: 10 }] });
  assert.equal(
    batchViews(data, new Date("2026-10-18T12:00:00.000Z"))[0].remaining,
    0,
  );
  assert.equal(adviceAt(data, "2026-10-18T12:00:00.000Z"), null);
});

test("остаток и рекомендация пересчитываются после продаж, списания и изменения срока", () => {
  const sale = {
    id: "sale-1",
    productId: product.id,
    quantity: 3,
    soldAt: "2026-10-18T11:00:00.000Z",
  };
  const data = makeData({
    sales: [sale],
    batches: [{ ...batch, discarded: 2 }],
  });
  const now = new Date("2026-10-18T12:00:00.000Z");
  assert.equal(batchViews(data, now)[0].remaining, 5);
  assert.equal(adviceAt(data, now).discountPercent, 10);
  const longerShelfLife = makeData({
    products: [{ ...product, shelfHours: 48 }],
  });
  assert.equal(adviceAt(longerShelfLife, now), null);
});
