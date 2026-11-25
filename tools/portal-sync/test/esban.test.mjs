// エステ番長：予定表と値の置き換え（通信しない）
import test from "node:test";
import assert from "node:assert/strict";
import { planEsban, toValue, fromShown } from "../src/sites/esban.mjs";

test("値の置き換え：12:30→t1250、翌3:00(27:00)→t2700、表示 03:00→27:00", () => {
  assert.equal(toValue("12:30"), "t1250");
  assert.equal(toValue("27:00"), "t2700");
  assert.equal(toValue("10:00"), "t1000");
  assert.equal(fromShown("03:00"), "27:00");
  assert.equal(fromShown("18:30"), "18:30");
});

test("7日分、10:00〜翌5:00の範囲。範囲外は見送り", () => {
  const shifts = [
    { date: "2026-11-25", name: "さら", start: 720, end: 1080 },
    { date: "2026-11-26", name: "ひなた", start: 1260, end: 1740 }, // 21:00〜翌5:00
    { date: "2026-11-27", name: "かのん", start: 540, end: 1080 }, // 9:00開始（選べない）
  ];
  const plan = planEsban(shifts, "2026-11-25", { people: ["さら", "ひなた", "かのん"] });
  assert.equal(plan.dates.length, 7);
  assert.deepEqual(plan.rows.find((r) => r.name === "ひなた").cells[1], { date: "2026-11-26", work: true, start: "21:00", end: "29:00" });
  assert.ok(plan.skipped.some((s) => s.name === "かのん"));
});
