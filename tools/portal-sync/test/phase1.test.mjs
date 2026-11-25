// フェーズ1（読み込み・点検・駅ちかに入れる形への変換）のテスト。通信はしない。
import test from "node:test";
import assert from "node:assert/strict";
import { buildFromCsv, displayNameMap } from "../src/source.mjs";
import { collectShifts, parseTimeRange, toMinutes, hhmm, siteTime, bizToday, dateRange } from "../src/shifts.mjs";
import { planEkichika } from "../src/sites/ekichika.mjs";

const NOW = Date.UTC(2026, 10, 25, 3, 0); // 2026/11/25 12:00 JST
process.env.SCHEDULE_NOW_MS = String(NOW); // fetch-sheets の「今日」もそろえる

const scheduleCsv = [
  "日付,ラベル,エリア,名前,出勤時間,開始,終了,ステータス,出勤,区分",
  "2026/11/24,,亀戸,さら,,12:00,18:00,,○,確定", // 過去の日（出さない）
  "2026/11/25,,亀戸,さら,,12:00,18:00,空きあり,○,確定",
  "2026/11/25,,亀戸,かのん,,12:30,18:00,,✖️,確定", // 欠勤（出さない）
  "2026/11/26,,亀戸,つばさ,,20:00,2:00,,○,確定", // 深夜（翌2:00）・照合キーは つばさ（表示名 ひなた）
  "2026/11/27,,亀戸,ななお,,,,,○,確定", // 時間未定
  "2026/11/28,,亀戸,ももこ,,13:15,18:00,,○,確定", // 30分単位でない
  "2026/11/29,,亀戸,れいこ,,14:00,18:00,,○,希望休", // 申請中・希望休（出さない）
  "2026/12/05,,亀戸,さら,,12:00,18:00,,○,確定", // 駅ちかの7日の外
].join("\n");
const therapistsCsv = ["名前,表示名", "さら,", "つばさ,ひなた", "ななお,", "ももこ,", "れいこ,", "かのん,"].join("\n");

test("時間の読み方：深夜は翌、朝6時前の開始は前日の続き", () => {
  assert.equal(toMinutes("翌2:00"), 26 * 60);
  assert.equal(toMinutes("1:00", { isStart: true }), 25 * 60);
  assert.deepEqual(parseTimeRange("20:00〜2:00"), { start: 1200, end: 1560, raw: "20:00〜2:00" });
  assert.deepEqual(parseTimeRange("13:00〜翌2:00"), { start: 780, end: 1560, raw: "13:00〜翌2:00" });
  assert.equal(hhmm(1560), "26:00");
  assert.equal(siteTime(1560), "翌2:00");
  assert.equal(bizToday(Date.UTC(2026, 10, 25, 20, 0)), "2026-11-25"); // 11/26 5:00 JST はまだ 11/25 の営業日
  assert.deepEqual(dateRange("2026-11-30", 3), ["2026-11-30", "2026-12-01", "2026-12-02"]);
});

test("サイトと同じ変換で読み、欠勤・希望休・過去の日は出さない。表示名で扱う", () => {
  const { schedule, roster } = buildFromCsv({ scheduleCsv, therapistsCsv });
  const { shifts, problems } = collectShifts(schedule, displayNameMap(roster));
  const list = shifts.map((s) => `${s.date} ${s.name} ${s.start ?? "-"}-${s.end ?? "-"}`);
  assert.deepEqual(list, [
    "2026-11-25 さら 720-1080",
    "2026-11-26 ひなた 1200-1560",
    "2026-11-27 ななお ---",
    "2026-11-28 ももこ 795-1080",
    "2026-12-05 さら 720-1080",
  ]);
  assert.ok(problems.some((p) => p.level === "warn" && p.name === "ななお" && /未定/.test(p.message)));
  assert.ok(problems.some((p) => p.level === "error" && p.name === "ももこ" && /30分/.test(p.message)));
});

test("同じ日に同じ人が2回・名簿にいない名前を見つける", () => {
  const sch = { days: [{ date: "2026/11/25", list: [{ name: "さら", time: "12:00〜18:00" }, { name: "さら", time: "19:00〜22:00" }, { name: "だれか", time: "12:00〜13:00" }] }] };
  const { problems } = collectShifts(sch, new Map([["さら", "さら"]]));
  assert.ok(problems.some((p) => p.level === "error" && /2つ/.test(p.message)));
  assert.ok(problems.some((p) => p.level === "warn" && p.name === "だれか"));
});

test("駅ちか：7日分の表。登録者は出勤の無い日も「休」で入れ、未登録・時間未定・範囲外は見送り", () => {
  const { schedule, roster } = buildFromCsv({ scheduleCsv, therapistsCsv });
  const { shifts } = collectShifts(schedule, displayNameMap(roster));
  const plan = planEkichika(shifts, "2026-11-25", { people: ["さら", "ひなた", "かのん"] });
  assert.deepEqual(plan.dates, ["2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01"]);
  const sara = plan.rows.find((r) => r.name === "さら");
  assert.deepEqual(sara.cells[0], { date: "2026-11-25", work: true, start: "12:00", end: "18:00" });
  assert.equal(sara.cells[1].work, false);
  const hinata = plan.rows.find((r) => r.name === "ひなた");
  assert.deepEqual(hinata.cells[1], { date: "2026-11-26", work: true, start: "20:00", end: "26:00" });
  const kanon = plan.rows.find((r) => r.name === "かのん");
  assert.ok(kanon.cells.every((c) => !c.work)); // 欠勤の日は出勤なし（ダミーがあれば取り消し対象）
  assert.ok(plan.skipped.some((s) => s.name === "ななお" && /登録されていない/.test(s.reason)));
  assert.ok(plan.skipped.some((s) => s.name === "ももこ"));
  // 7日の外（12/5）は入らない
  assert.ok(!sara.cells.some((c) => c.date === "2026-12-05"));
});

test("駅ちか：登録者が分からないときは出勤のある人だけ。名前の読み替えができる", () => {
  const shifts = [{ date: "2026-11-25", name: "ひなた", start: 720, end: 1080 }];
  const plan = planEkichika(shifts, "2026-11-25", { nameMap: { "ひなた": "つばさ" } });
  assert.deepEqual(plan.rows.map((r) => r.name), ["つばさ"]);
});
