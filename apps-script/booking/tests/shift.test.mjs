/* 出勤管理（Code.gs）のテスト。スプレッドシートをメモリ上の模擬シートに差し替えて、
 * 実際の Code.gs / lib.gs をそのまま動かす（GAS固有APIは最小限のスタブ）。
 *   実行: node apps-script/booking/tests/shift.test.mjs */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const lib = readFileSync(join(here, "..", "lib.gs"), "utf8");
const code = readFileSync(join(here, "..", "Code.gs"), "utf8");

/* ---- 模擬シート ---- */
function makeSheet(name, values) {
  const v = values.map((r) => r.slice());
  const width = () => Math.max(0, ...v.map((r) => r.length));
  const cellIn = (x) => (typeof x === "string" && x.startsWith("'") ? x.slice(1) : x); // ' は文字列指定
  return {
    v,
    getName: () => name,
    getLastRow: () => v.length,
    getLastColumn: () => width(),
    getDataRange: () => ({ getValues: () => v.map((r) => { const o = r.slice(); while (o.length < width()) o.push(""); return o; }) }),
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (v[r - 1 + i] || [])[c - 1 + j] ?? "")),
      setValues: (vals) => vals.forEach((row, i) => row.forEach((x, j) => { (v[r - 1 + i] ||= [])[c - 1 + j] = cellIn(x); })),
      getValue: () => (v[r - 1] || [])[c - 1] ?? "",
      setValue: (x) => { (v[r - 1] ||= [])[c - 1] = cellIn(x); },
    }),
    appendRow: (row) => v.push(row.map(cellIn)),
    deleteRow: (r) => v.splice(r - 1, 1),
  };
}

function load(sheets, props = {}) {
  const pad = (n) => String(n).padStart(2, "0");
  const ctx = {
    console,
    Logger: { log: () => {} },
    Utilities: {
      formatDate: (d, tz, fmt) => {
        const j = new Date(d.getTime() + 9 * 3600e3);
        const Y = j.getUTCFullYear(), M = j.getUTCMonth() + 1, D = j.getUTCDate(), h = j.getUTCHours(), m = j.getUTCMinutes(), s = j.getUTCSeconds();
        return fmt.replace("yyyy", Y).replace("MM", pad(M)).replace("dd", pad(D)).replace("HH", pad(h)).replace("mm", pad(m)).replace("ss", pad(s)).replace(/\bM\b/, M).replace(/\bd\b/, D).replace(/\bH\b/, h);
      },
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  };
  vm.createContext(ctx);
  vm.runInContext(lib.replace(/if \(typeof module[\s\S]*$/, ""), ctx);
  vm.runInContext(code, ctx);
  const history = [];
  vm.runInContext("1", ctx);
  ctx.book_ = () => ({ getSheetByName: (n) => sheets[n] || null, getSheets: () => Object.values(sheets) });
  ctx.requireStaff_ = () => "staff@example.com";
  ctx.logHistory_ = (...a) => history.push(a);
  ctx.readLedger_ = () => ctx.__ledger || [];
  ctx.todayJst_ = () => "2026/10/7";
  ctx.__history = history;
  return ctx;
}

const HEAD = ["日付", "ラベル", "名前", "出勤時間", "ステータス", "出勤", "区分", "エリア"];
const baseSched = () => [
  HEAD,
  ["2026/10/7", "10/7(水)", "みお", "13:00〜翌2:00", "空きあり", "○", "確定", "亀戸"],
  ["2026/10/7", "10/7(水)", "花恋", "16:00〜翌3:00", "空きあり", "✖️", "確定", "亀戸"],
  ["2026/10/8", "10/8(木)", "みお", "13:00〜22:00", "空きあり", "○", "希望休", "亀戸"],
];

const plain = (x) => JSON.parse(JSON.stringify(x)); // VMの別領域の配列を通常の配列に
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("  ✓ " + name); };
console.log("出勤管理 テスト");

t("readShift_: 出勤○は範囲を返し、✖️（休み）と希望休は null", () => {
  const sch = makeSheet("出勤情報", baseSched());
  const g = load({ 出勤情報: sch });
  const r = g.readShift_("みお", "2026/10/7");
  assert.equal(g.fmtJst(r.startAt ?? r.startMs), "2026/10/07 13:00");
  assert.equal(g.fmtJst(r.endMs), "2026/10/08 02:00");
  assert.equal(g.readShift_("花恋", "2026/10/7"), null);
  assert.equal(g.readShift_("みお", "2026/10/8"), null);
});

t("dayHasShifts_: 確定の出勤がある日だけ true", () => {
  const g = load({ 出勤情報: makeSheet("出勤情報", baseSched()) });
  assert.equal(g.dayHasShifts_("2026/10/7"), true);
  assert.equal(g.dayHasShifts_("2026/10/8"), false); // 希望休のみ
  assert.equal(g.dayHasShifts_("2026/10/9"), false);
});

t("adminShiftSave: 新規は1行追加（日付・ラベル・時間は文字列・出勤○・確定・エリア）", () => {
  const sch = makeSheet("出勤情報", baseSched());
  const g = load({ 出勤情報: sch });
  const res = g.adminShiftSave({ name: "れな", date: "2026/10/9", start: "19:30", end: "翌4:00" });
  assert.equal(res.ok, true);
  const last = sch.v[sch.v.length - 1];
  assert.deepEqual(plain(last), ["2026/10/9", "10/9(金)", "れな", "19:30〜翌4:00", "空きあり", "○", "確定", "亀戸"]);
  assert.equal(g.__history.length, 1);
});

t("adminShiftSave: 同じ人・同じ日の新規登録は既存行を更新（重複しない）", () => {
  const sch = makeSheet("出勤情報", baseSched());
  const g = load({ 出勤情報: sch });
  const n = sch.v.length;
  const res = g.adminShiftSave({ name: "みお", date: "2026/10/7", start: "15:00", end: "23:00" });
  assert.equal(res.ok, true);
  assert.equal(sch.v.length, n);
  assert.equal(sch.v[1][3], "15:00〜23:00");
});

t("adminShiftSave: 編集で別の既存行と重なると拒否", () => {
  const g = load({ 出勤情報: makeSheet("出勤情報", baseSched()) });
  const res = g.adminShiftSave({ row: 3, origName: "花恋", origDate: "2026/10/7", name: "みお", date: "2026/10/7", start: "16:00", end: "翌3:00" });
  assert.equal(res.ok, false);
});

t("adminShiftSave: 行がずれていたら拒否（他の人の更新を上書きしない）", () => {
  const g = load({ 出勤情報: makeSheet("出勤情報", baseSched()) });
  const res = g.adminShiftSave({ row: 2, origName: "花恋", origDate: "2026/10/7", name: "花恋", date: "2026/10/7", start: "16:00", end: "翌3:00" });
  assert.equal(res.ok, false);
});

t("adminShiftSave: 終了が開始以前／時間不正は拒否", () => {
  const g = load({ 出勤情報: makeSheet("出勤情報", baseSched()) });
  assert.equal(g.adminShiftSave({ name: "れな", date: "2026/10/9", start: "20:00", end: "19:00" }).ok, false);
  assert.equal(g.adminShiftSave({ name: "れな", date: "2026/10/9", start: "あ", end: "19:00" }).ok, false);
});

t("adminShiftSave: 出勤時間の外になる予約を警告", () => {
  const g = load({ 出勤情報: makeSheet("出勤情報", baseSched()) });
  g.__ledger = [
    { id: "A", status: "confirmed", therapistName: "みお", therapistId: "みお", customerName: "田中", startAt: g.parseJstDateTime("2026/10/7", "翌1:00"), endAt: g.parseJstDateTime("2026/10/7", "翌2:00") },
    { id: "B", status: "cancelled", therapistName: "みお", therapistId: "みお", customerName: "佐藤", startAt: g.parseJstDateTime("2026/10/7", "23:00"), endAt: g.parseJstDateTime("2026/10/7", "翌0:00") },
  ];
  const res = g.adminShiftSave({ row: 2, origName: "みお", origDate: "2026/10/7", name: "みお", date: "2026/10/7", start: "13:00", end: "22:00" });
  assert.equal(res.ok, true);
  assert.match(res.warning, /1 件/);
  assert.match(res.warning, /田中/);
  assert.doesNotMatch(res.warning, /佐藤/); // キャンセルは対象外
});

t("adminShiftSetAbsent: ✖️ にして readShift_ が null／戻すと復活", () => {
  const sch = makeSheet("出勤情報", baseSched());
  const g = load({ 出勤情報: sch });
  assert.equal(g.adminShiftSetAbsent({ row: 2, name: "みお", date: "2026/10/7", absent: true }).ok, true);
  assert.equal(sch.v[1][5], "✖️");
  assert.equal(g.readShift_("みお", "2026/10/7"), null);
  g.adminShiftSetAbsent({ row: 2, name: "みお", date: "2026/10/7", absent: false });
  assert.notEqual(g.readShift_("みお", "2026/10/7"), null);
});

t("adminShiftDelete: 行を削除", () => {
  const sch = makeSheet("出勤情報", baseSched());
  const g = load({ 出勤情報: sch });
  assert.equal(g.adminShiftDelete({ row: 4, name: "みお", date: "2026/10/8" }).ok, true);
  assert.equal(sch.v.length, 3);
});

t("adminShifts: 週の範囲だけ返し、名簿シートの名前も含む", () => {
  const prof = makeSheet("セラピスト", [["名前", "年齢"], ["みお", "23"], ["新人ちゃん", "20"]]);
  const g = load({ 出勤情報: makeSheet("出勤情報", baseSched()), セラピスト: prof });
  const res = g.adminShifts("2026/10/7", 1);
  assert.equal(res.dates.length, 1);
  assert.equal(res.dates[0].label, "10/7(水)");
  assert.equal(res.shifts.length, 2);
  assert.deepEqual(plain(res.names.slice(0, 2)), ["みお", "新人ちゃん"]);
  assert.ok(res.names.includes("花恋"));
});

t("見出しが2行目にあっても読める", () => {
  const g = load({ 出勤情報: makeSheet("出勤情報", [["AROMA 出勤表"], ...baseSched()]) });
  assert.notEqual(g.readShift_("みお", "2026/10/7"), null);
});

t("createBooking: WEB で出勤表に無い人（休み）は拒否・おまかせと電話は許可", () => {
  const g = load({ 出勤情報: makeSheet("出勤情報", baseSched()) });
  g.appendRow_ = () => {};
  g.notifyCustomer_ = () => {};
  g.nowMs_ = () => 0;
  g.genId_ = (p) => p + "1";
  g.Utilities.formatDate = () => "2026/10/07 00:00:00";
  const base = { dateStr: "2026/10/7", timeLabel: "18:00", course: "60分コース", customerName: "x", tel: "090" };
  assert.equal(g.createBooking({ ...base, source: "WEB", therapistName: "花恋" }).ok, false); // ✖️
  assert.equal(g.createBooking({ ...base, source: "WEB", therapistName: "みお" }).ok, true);
  assert.equal(g.createBooking({ ...base, source: "WEB", therapistName: "おまかせ（指名なし）", tel: "091" }).ok, true);
  assert.equal(g.createBooking({ ...base, source: "電話", therapistName: "花恋", tel: "092", asConfirmed: true }).ok, true);
  // 出勤表が未入力の日は従来どおり受け付ける
  assert.equal(g.createBooking({ ...base, dateStr: "2026/10/20", source: "WEB", therapistName: "花恋", tel: "093" }).ok, true);
});

console.log(`\n✅ 全 ${passed} 件 パス`);
