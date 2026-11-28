// 上位表示：エステ魂のセラピストアピールで次に押す人の選び方（通信しない）
import test from "node:test";
import assert from "node:assert/strict";
import { parseShift, pickAppeal } from "../src/boost.mjs";

test("出勤の表示を分に直す（退勤が日をまたぐときは翌日）", () => {
  assert.deepEqual(parseShift("16:00～24:00"), { start: 960, end: 1440 });
  assert.deepEqual(parseShift("20:00～2:00"), { start: 1200, end: 1560 });
  assert.equal(parseShift(""), null);
});

test("1人の日：出勤1時間前〜退勤に3回を均等に配り、使い切る", () => {
  const rows = [{ id: "1", name: "ななお", shiftText: "16:00～24:00" }, { id: "3", name: "れいこ", shiftText: "" }];
  // 15:00〜24:00 を3つに分ける → 15:00・18:00・21:00
  assert.equal(pickAppeal(rows, { nowMin: 14 * 60, remain: 3 }), null);
  assert.equal(pickAppeal(rows, { nowMin: 15 * 60 + 7, remain: 3 }).name, "ななお");
  assert.equal(pickAppeal(rows, { nowMin: 16 * 60 + 7, remain: 2, done: ["1"] }), null); // 次は18時
  assert.equal(pickAppeal(rows, { nowMin: 18 * 60 + 7, remain: 2, done: ["1"] }).name, "ななお");
  assert.equal(pickAppeal(rows, { nowMin: 21 * 60 + 7, remain: 1, done: ["1", "1"] }).name, "ななお");
  assert.equal(pickAppeal(rows, { nowMin: 23 * 60, remain: 0, done: ["1", "1", "1"] }), null); // 残り0
});

test("複数の日：今日のアピールが少ない人から（同じなら出勤の早い人）", () => {
  const rows = [
    { id: "1", name: "ななお", shiftText: "16:00～24:00" },
    { id: "2", name: "さら", shiftText: "12:00～18:00" },
  ];
  // 11:00〜24:00 を3つに分ける → 11:00・約15:20・約19:40
  assert.equal(pickAppeal(rows, { nowMin: 11 * 60 + 7, remain: 3 }).name, "さら");
  assert.equal(pickAppeal(rows, { nowMin: 15 * 60 + 30, remain: 2, done: ["2"] }).name, "ななお");
  assert.equal(pickAppeal(rows, { nowMin: 20 * 60, remain: 1, done: ["2", "1"] }).name, "ななお"); // さらは退勤後
  assert.equal(pickAppeal(rows, { nowMin: 25 * 60, remain: 3 }), null); // 全員退勤後
});
