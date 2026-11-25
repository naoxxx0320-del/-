// フェーズ2（駅ちか：変更点の作り方・実行するものの選び方）のテスト。通信・ブラウザは使わない。
import test from "node:test";
import assert from "node:assert/strict";
import { diffShifts, selectChanges, formatChanges } from "../src/diff.mjs";
import { planEkichika } from "../src/sites/ekichika.mjs";
import { labelToIso } from "../src/sites/ekichika-portal.mjs";

const dates = ["2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01"];
const blank = () => dates.map((date, idx) => ({ idx, date, work: false, start: "", end: "" }));

test("駅ちかの日付の見出し（11/25）を年つきの日付にする（年またぎも）", () => {
  assert.equal(labelToIso("11/25", "2026-11-25"), "2026-11-25");
  assert.equal(labelToIso("1/2", "2026-12-30"), "2027-01-02");
  assert.equal(labelToIso("12/31", "2027-01-01"), "2026-12-31");
});

test("変更点：入れる・時間を変える・取り消す（ダミーの出勤は取り消し候補）", () => {
  const current = {
    dates,
    people: [
      { id: "1", name: "さら", cells: blank() },
      { id: "2", name: "つばさ", cells: blank().map((c) => (c.idx === 0 ? { ...c, work: true, start: "12:30", end: "18:00" } : c)) }, // ダミー
      { id: "3", name: "かのん", cells: blank().map((c) => (c.idx === 2 ? { ...c, work: true, start: "12:00", end: "19:00" } : c)) },
    ],
  };
  const shifts = [
    { date: "2026-11-25", name: "さら", start: 720, end: 1080 },
    { date: "2026-11-27", name: "かのん", start: 780, end: 1140 },
    { date: "2026-11-28", name: "ななお", start: 960, end: 1440 },
  ];
  const plan = planEkichika(shifts, "2026-11-25", { nameMap: { "ひなた": "つばさ" }, people: current.people.map((p) => p.name) });
  const ch = diffShifts(current, plan);
  assert.deepEqual(ch.map((c) => `${c.no}:${c.type}:${c.date}:${c.name}:${c.before}>${c.after}`), [
    "1:add:2026-11-25:さら:出勤なし>12:00-18:00",
    "2:remove:2026-11-25:つばさ:12:30-18:00>出勤なし",
    "3:change:2026-11-27:かのん:12:00-19:00>13:00-19:00",
  ]);
  assert.equal(ch[0].id, "1");
  assert.equal(ch[0].idx, 0);
  assert.ok(plan.skipped.some((s) => s.name === "ななお"));
  assert.match(formatChanges("駅ちか", ch, plan.skipped), /取り消す（要確認）/);
});

test("一致していれば変更なし", () => {
  const current = { dates, people: [{ id: "1", name: "さら", cells: blank().map((c) => (c.idx === 0 ? { ...c, work: true, start: "12:00", end: "18:00" } : c)) }] };
  const plan = planEkichika([{ date: "2026-11-25", name: "さら", start: 720, end: 1080 }], "2026-11-25", { people: ["さら"] });
  assert.deepEqual(diffShifts(current, plan), []);
});

test("実行するものの選び方：取り消しは番号で個別に指定したときだけ。--only で絞れる", () => {
  const ch = [{ no: 1, type: "add" }, { no: 2, type: "remove" }, { no: 3, type: "change" }, { no: 4, type: "remove" }];
  assert.deepEqual(selectChanges(ch).map((c) => c.no), [1, 3]);
  assert.deepEqual(selectChanges(ch, { removeNos: [2] }).map((c) => c.no), [1, 2, 3]);
  assert.deepEqual(selectChanges(ch, { only: [1] }).map((c) => c.no), [1]);
  assert.deepEqual(selectChanges(ch, { only: [4], removeNos: [] }).map((c) => c.no), []);
  assert.deepEqual(selectChanges(ch, { only: [4], removeNos: [4] }).map((c) => c.no), [4]);
});
