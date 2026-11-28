// 空き時間の告知：空きの計算・告知の時刻・文章（通信しない）
import test from "node:test";
import assert from "node:assert/strict";
import { freeWindows, dueSlot, vacancyPost, rxVacancyText } from "../src/news/vacancy.mjs";

const mid = Date.parse("2026-11-28T00:00:00+09:00");
const at = (h, m = 0) => mid + (h * 60 + m) * 60000;
const shifts = [{ key: "りん", name: "ななお", start: 16 * 60, end: 24 * 60 }, { key: "さら", name: "さら", start: 12 * 60, end: 15 * 60 }];

test("予約の前後の60分以上の空きだけ。開始は今から30分より後", () => {
  const busy = [{ th: "りん", s: at(22, 30), e: at(24) }, { th: "さら", s: at(12), e: at(13, 30) }];
  const w = freeWindows({ shifts, busy, midnightMs: mid, nowMs: at(11) });
  assert.deepEqual(w.map((x) => [x.name, x.start, x.end]), [["さら", 810, 900], ["ななお", 960, 1350]]);
  // 20:10 なら ななお は 20:40〜22:30
  const w2 = freeWindows({ shifts, busy, midnightMs: mid, nowMs: at(20, 10) });
  assert.deepEqual(w2.map((x) => [x.name, x.start, x.end]), [["ななお", 1240, 1350]]);
});

test("60分に満たない空きは出さない", () => {
  const busy = [{ th: "りん", s: at(16), e: at(23, 10) }];
  assert.deepEqual(freeWindows({ shifts: [shifts[0]], busy, midnightMs: mid, nowMs: at(11) }), []);
});

test("告知の時刻：来ている一番新しい回だけ、1回ずつ", () => {
  assert.equal(dueSlot(10 * 60), null);
  assert.equal(dueSlot(11 * 60 + 7), 660);
  assert.equal(dueSlot(11 * 60 + 7, [660]), null);
  assert.equal(dueSlot(16 * 60, [660]), 900); // 11時の回を出したあと、Mac が止まっていても 15時の回だけ出す
  assert.equal(dueSlot(23 * 60, [660, 900, 1140]), null);
});

test("文章：早割は 10〜17時開始の空きがあるときだけ添える", () => {
  const hayawari = { amount: 2000, courses: "全コース" };
  const p = vacancyPost({ today: "2026-11-28", windows: [{ name: "さら", start: 810, end: 900 }], nowMin: 667, hayawari });
  assert.equal(p.title, "【本日の空き】さら 13:30〜");
  assert.match(p.body, /・さら　13:30〜15:00/);
  assert.match(p.body, /早割で2,000円OFF/);
  const q = vacancyPost({ today: "2026-11-28", windows: [{ name: "ななお", start: 1240, end: 1440 }], nowMin: 1210, hayawari });
  assert.doesNotMatch(q.body, /早割/);
  assert.match(q.body, /20:40〜翌0:00/);
  assert.equal(vacancyPost({ today: "2026-11-28", windows: [], nowMin: 700 }), null);
  assert.equal(rxVacancyText({ windows: [{ name: "ななお", start: 1240, end: 1350 }] }), "本日 20:40〜22:30 ご案内できます✨\nご予約お待ちしております🌸");
});
