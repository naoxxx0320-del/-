// リラクシィの出勤：時刻の変換と「休みにする」の選び方（通信しない）
import test from "node:test";
import assert from "node:assert/strict";
import { toMin, fromMin, planRx, restChanges } from "../src/sites/rx.mjs";
import { diffShifts } from "../src/diff.mjs";

test("時刻 ⇔ 分", () => {
  assert.equal(toMin("16:00"), 960); assert.equal(toMin("26:30"), 1590);
  assert.equal(fromMin("1440"), "24:00"); assert.equal(fromMin(600), "10:00");
});

test("出勤表どおり：出勤は入れる・未設定は休みに・出勤を消す（取り消し）は自動にしない", () => {
  const today = "2026-11-28";
  const shifts = [{ date: "2026-11-28", name: "ななお", start: 960, end: 1440 }, { date: "2026-11-29", name: "さら", start: 720, end: 1080 }];
  const cell = (date, o = {}) => ({ idx: date, date, work: false, start: "", end: "", unset: true, off: false, ...o });
  const current = {
    dates: ["2026-11-28", "2026-11-29"],
    people: [
      { id: "ななお", name: "ななお", cells: [cell("2026-11-28"), cell("2026-11-29", { work: true, start: "12:00", end: "18:00", unset: false })] },
      { id: "さら", name: "さら", cells: [cell("2026-11-28", { unset: false, off: true }), cell("2026-11-29")] },
    ],
  };
  const plan = planRx(shifts, today, { people: ["ななお", "さら"] });
  const ch = diffShifts(current, plan);
  const rest = restChanges(current, plan, ch.length);
  assert.deepEqual(ch.map((c) => [c.type, c.name, c.date]), [["add", "ななお", "2026-11-28"], ["remove", "ななお", "2026-11-29"], ["add", "さら", "2026-11-29"]]);
  assert.deepEqual(rest.map((c) => [c.type, c.name, c.date, c.no]), []); // 未設定で出勤なしの日は表の2日のうちにない
  const cur2 = { ...current, people: [{ ...current.people[1], cells: [cell("2026-11-28"), cell("2026-11-29")] }] };
  const plan2 = planRx(shifts, today, { people: ["さら"] });
  assert.deepEqual(restChanges(cur2, plan2, 1).map((c) => [c.type, c.date, c.no]), [["rest", "2026-11-28", 2]]);
});
