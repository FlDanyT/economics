import assert from "node:assert/strict";
import test from "node:test";
import { hourlySalesProfile, salesChartData } from "../src/chartData.ts";

const product = (id, name) => ({
  id,
  name,
  description: "",
  weight: 100,
  prepMinutes: 30,
  freshnessHours: 8,
  shelfHours: 24,
  price: 100,
});
const base = () => ({
  products: [product("a", "Хлеб"), product("b", "Длинное название булочки")],
  batches: [],
  sales: [],
  settings: { businessName: "", city: "", open: "08:00", close: "20:00" },
});

test("график выручки берёт только записанную цену, количество включает старые продажи", () => {
  const data = base();
  data.sales = [
    { id: "old", productId: "a", quantity: 3, soldAt: "2026-10-18T10:00:00" },
    {
      id: "priced",
      productId: "a",
      quantity: 2,
      soldAt: "2026-10-18T11:00:00",
      lines: [
        {
          batchId: "one",
          quantity: 2,
          regularPrice: 100,
          discountPercent: 20,
          unitPrice: 80,
          total: 160,
        },
      ],
    },
    {
      id: "partial",
      productId: "b",
      quantity: 2,
      soldAt: "2026-10-17T11:00:00",
      lines: [
        {
          batchId: "two",
          quantity: 1,
          regularPrice: 50,
          discountPercent: null,
          unitPrice: 50,
          total: 50,
        },
        {
          batchId: "three",
          quantity: 1,
          regularPrice: null,
          discountPercent: null,
          unitPrice: null,
          total: null,
        },
      ],
    },
  ];
  const now = new Date("2026-10-18T15:00:00");
  const quantity = salesChartData(data, now, "7d", "quantity", "total", [
    "a",
    "b",
  ]);
  assert.equal(quantity.total, 7);
  assert.equal(quantity.missingPriceRecords, 2);
  assert.equal(quantity.missingPriceUnits, 4);
  const revenue = salesChartData(data, now, "7d", "revenue", "products", [
    "a",
    "b",
  ]);
  assert.equal(revenue.total, 210);
  assert.deepEqual(
    revenue.series.map((series) => series.values.reduce((a, b) => a + b, 0)),
    [160, 50],
  );
  assert.equal(revenue.pricedRecords, 2);
  assert.equal(
    salesChartData(data, now, "7d", "revenue", "total", ["b"]).total,
    50,
  );
});

test("периоды и фильтр товаров меняют набор точек", () => {
  const data = base();
  data.sales = [
    { id: "x", productId: "a", quantity: 2, soldAt: "2026-10-18T09:15:00" },
    { id: "y", productId: "b", quantity: 4, soldAt: "2026-10-17T12:00:00" },
    { id: "z", productId: "a", quantity: 5, soldAt: "2026-09-25T12:00:00" },
  ];
  const now = new Date("2026-10-18T15:00:00");
  assert.equal(
    salesChartData(data, now, "today", "quantity", "total", ["a", "b"]).total,
    2,
  );
  assert.equal(
    salesChartData(data, now, "7d", "quantity", "total", ["a", "b"]).total,
    6,
  );
  assert.equal(
    salesChartData(data, now, "30d", "quantity", "total", ["a", "b"]).total,
    11,
  );
  assert.equal(
    salesChartData(data, now, "7d", "quantity", "total", ["b"]).total,
    4,
  );
  assert.equal(
    salesChartData(
      data,
      now,
      "custom",
      "quantity",
      "total",
      ["a", "b"],
      "2026-09-25",
      "2026-09-25",
    ).total,
    5,
  );
  assert.ok(
    salesChartData(
      data,
      now,
      "custom",
      "quantity",
      "total",
      ["a"],
      "2026-10-18",
      "2026-10-17",
    ).error,
  );
});

test("почасовой план появляется только при достаточной детализации истории", () => {
  const data = base();
  const today = new Date("2026-10-18T15:00:00");
  for (const date of ["2026-10-14", "2026-10-15"]) {
    data.sales.push(
      {
        id: `${date}-1`,
        productId: "a",
        quantity: 2,
        soldAt: `${date}T10:00:00`,
      },
      {
        id: `${date}-2`,
        productId: "a",
        quantity: 2,
        soldAt: `${date}T16:00:00`,
      },
    );
  }
  assert.equal(hourlySalesProfile(data, "a", today, 8, 20), null);
  data.sales.push(
    {
      id: "third-1",
      productId: "a",
      quantity: 2,
      soldAt: "2026-10-16T10:00:00",
    },
    {
      id: "third-2",
      productId: "a",
      quantity: 2,
      soldAt: "2026-10-16T16:00:00",
    },
  );
  const profile = hourlySalesProfile(data, "a", today, 8, 20);
  assert.equal(profile.days, 3);
  assert.equal(profile.fractionAt(9), 0);
  assert.equal(profile.fractionAt(12), 0.5);
  assert.equal(profile.fractionAt(20), 1);
});
