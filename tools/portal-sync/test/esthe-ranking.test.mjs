// 全国メンズエステランキング：入れる予定の表と、画面の時間の書き方の置き換え（通信しない）
import test from "node:test";
import assert from "node:assert/strict";
import { planEstheRanking, toLabel, fromLabel } from "../src/sites/esthe-ranking.mjs";
import { diffShifts } from "../src/diff.mjs";

test("時間の書き方：26:00 ⇔ 02:00(26:00)", () => {
  assert.equal(toLabel("12:30"), "12:30");
  assert.equal(toLabel("26:00"), "02:00(26:00)");
  assert.equal(toLabel("24:00"), "00:00(24:00)");
  assert.equal(fromLabel("02:00(26:00)"), "26:00");
  assert.equal(fromLabel("12:30"), "12:30");
  assert.equal(fromLabel("▲出勤開始▼"), "");
});

test("14日分（設定で30日まで）。範囲は06:00〜翌5:30、それより早い・遅い時間は見送り", () => {
  const shifts = [
    { date: "2026-11-25", name: "さら", start: 720, end: 1080 },
    { date: "2026-12-03", name: "ひなた", start: 1260, end: 1740 }, // 21:00〜翌5:00
    { date: "2026-12-04", name: "ななお", start: 300, end: 600 }, // 5:00開始（選べない）
    { date: "2026-12-20", name: "さら", start: 780, end: 1140 }, // 14日の外
  ];
  const people = ["かのん", "ももこ", "さら", "れいこ", "ひなた", "ななお", "あい"];
  const p14 = planEstheRanking(shifts, "2026-11-25", { people });
  assert.equal(p14.dates.length, 14);
  assert.equal(p14.dates[13], "2026-12-08");
  const hinata = p14.rows.find((r) => r.name === "ひなた");
  assert.deepEqual(hinata.cells.find((c) => c.date === "2026-12-03"), { date: "2026-12-03", work: true, start: "21:00", end: "29:00" });
  assert.ok(p14.skipped.some((s) => s.name === "ななお" && /選べない/.test(s.reason)));
  const p30 = planEstheRanking(shifts, "2026-11-25", { people, days: 99 });
  assert.equal(p30.dates.length, 30);
  assert.ok(p30.rows.find((r) => r.name === "さら").cells.some((c) => c.date === "2026-12-20" && c.work));
});

test("ダミーの出勤（サイトに無い出勤）は取り消し候補になる", () => {
  const dates = ["2026-11-25"];
  const current = { dates, people: [
    { id: "a", name: "さら", cells: [{ idx: 0, date: "2026-11-25", work: true, start: "12:00", end: "18:00" }] },
    { id: "b", name: "かのん", cells: [{ idx: 0, date: "2026-11-25", work: true, start: "12:30", end: "18:00" }] },
  ] };
  const plan = planEstheRanking([{ date: "2026-11-25", name: "さら", start: 720, end: 1080 }], "2026-11-25", { people: ["さら", "かのん"], days: 1 });
  const ch = diffShifts(current, plan);
  assert.deepEqual(ch.map((c) => `${c.type}:${c.name}`), ["remove:かのん"]);
});

test("画面の選択肢の値：深夜は 03:00＝27:00（6時より前は翌日）", async () => {
  const { toValue, fromValue } = await import("../src/sites/esthe-ranking-portal.mjs");
  assert.equal(toValue("27:00"), "03:00");
  assert.equal(toValue("12:30"), "12:30");
  assert.equal(fromValue("03:00"), "27:00");
  assert.equal(fromValue("06:00"), "06:00");
  assert.equal(fromValue("0"), "");
});
