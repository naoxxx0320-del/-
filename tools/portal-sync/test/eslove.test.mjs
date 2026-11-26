// エステラブ：予定表と値の置き換え（通信しない）
import test from "node:test";
import assert from "node:assert/strict";
import { planEslove, toValue, fromValue, jstDate, dayOffset } from "../src/sites/eslove.mjs";

test("値の置き換え：06:00→600、12:30→1230、翌5:30(29:30)→2930 と、その逆", () => {
  assert.equal(toValue("06:00"), "600");
  assert.equal(toValue("12:30"), "1230");
  assert.equal(toValue("29:30"), "2930");
  assert.equal(fromValue("600"), "06:00");
  assert.equal(fromValue("2700"), "27:00");
  assert.equal(fromValue(""), "");
  assert.equal(fromValue("abc"), "");
});

test("表の始まりを営業日の今日に合わせる（深夜は前日から）", () => {
  assert.equal(dayOffset("2026-11-25", "2026-11-26"), -1);
  assert.equal(dayOffset("2026-11-26", "2026-11-26"), 0);
  assert.equal(jstDate(Date.UTC(2026, 10, 25, 16, 30)), "2026-11-26"); // 日本時間 11/26 1:30
});

test("7日分、6:00〜翌6:00の範囲。範囲外・未登録の人は見送り", () => {
  const shifts = [
    { date: "2026-11-26", name: "さら", start: 720, end: 1080 },
    { date: "2026-11-27", name: "ひなた", start: 1260, end: 1800 }, // 21:00〜翌6:00
    { date: "2026-11-28", name: "かのん", start: 300, end: 600 }, // 5:00開始（選べない）
    { date: "2026-11-28", name: "みか", start: 720, end: 1080 }, // 未登録
  ];
  const plan = planEslove(shifts, "2026-11-26", { people: ["さら", "ひなた", "かのん"] });
  assert.equal(plan.dates.length, 7);
  assert.deepEqual(plan.rows.find((r) => r.name === "ひなた").cells[1], { date: "2026-11-27", work: true, start: "21:00", end: "30:00" });
  assert.ok(plan.skipped.some((s) => s.name === "かのん"));
  assert.ok(plan.skipped.some((s) => s.name === "みか"));
});
