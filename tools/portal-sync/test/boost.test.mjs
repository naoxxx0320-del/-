// 上位表示：エステ魂のセラピストアピールで次に押す人の選び方（通信しない）
import test from "node:test";
import assert from "node:assert/strict";
import { parseShift, pickAppeal } from "../src/boost.mjs";

test("出勤の表示を分に直す（退勤が日をまたぐときは翌日）", () => {
  assert.deepEqual(parseShift("16:00～24:00"), { start: 960, end: 1440 });
  assert.deepEqual(parseShift("20:00～2:00"), { start: 1200, end: 1560 });
  assert.equal(parseShift(""), null);
});

test("本日出勤の人だけ、出勤の1時間前から退勤まで、開始の早い順、今日まだの人", () => {
  const rows = [
    { id: "1", name: "ななお", shiftText: "16:00～24:00" },
    { id: "2", name: "さら", shiftText: "12:00～18:00" },
    { id: "3", name: "れいこ", shiftText: "" },
  ];
  assert.equal(pickAppeal(rows, { nowMin: 10 * 60, remain: 3 }), null); // まだ誰の1時間前でもない
  assert.equal(pickAppeal(rows, { nowMin: 11 * 60, remain: 3 }).name, "さら");
  assert.equal(pickAppeal(rows, { nowMin: 15 * 60 + 30, remain: 3, done: ["2"] }).name, "ななお");
  assert.equal(pickAppeal(rows, { nowMin: 15 * 60 + 30, remain: 0 }), null); // 残り0
  assert.equal(pickAppeal(rows, { nowMin: 24 * 60 + 10, remain: 3 }), null); // 全員退勤後
});
