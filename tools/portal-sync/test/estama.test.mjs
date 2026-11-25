// エステ魂：予定表と値の置き換え（通信しない）
import test from "node:test";
import assert from "node:assert/strict";
import { planEstama, toValue, fromValue } from "../src/sites/estama.mjs";

test("値：09:30→9:30、26:00→26:00、退勤の閉店（29:00）→99:99（LASTまで）", () => {
  assert.equal(toValue("09:30"), "9:30");
  assert.equal(toValue("26:00"), "26:00");
  assert.equal(toValue("29:00", { isEnd: true }), "99:99");
  assert.equal(fromValue("9:30"), "09:30");
  assert.equal(fromValue("99:99"), "29:00");
  assert.equal(fromValue(""), "");
});

test("14日分。閉店までの出勤（21:00〜翌5:00）も入る。9:30より前は見送り", () => {
  const shifts = [
    { date: "2026-12-03", name: "ひなた", start: 1260, end: 1740 },
    { date: "2026-11-26", name: "さら", start: 540, end: 1080 },
  ];
  const plan = planEstama(shifts, "2026-11-25", { people: ["ひなた", "さら"] });
  assert.equal(plan.dates.length, 14);
  assert.deepEqual(plan.rows.find((r) => r.name === "ひなた").cells.find((c) => c.date === "2026-12-03"), { date: "2026-12-03", work: true, start: "21:00", end: "29:00" });
  assert.ok(plan.skipped.some((s) => s.name === "さら"));
});
