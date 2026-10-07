/* 出勤管理（Code.gs）のテスト。スプレッドシートをメモリ上の模擬シートに差し替えて、
 * 実際の Code.gs / lib.gs をそのまま動かす（GAS固有APIは最小限のスタブ）。
 *   実行: node apps-script/booking/tests/shift.test.mjs */
import assert from "node:assert/strict";
import { makeSheet, load, plain } from "./harness.mjs";

const HEAD = ["日付", "ラベル", "名前", "出勤時間", "ステータス", "出勤", "区分", "エリア"];
const baseSched = () => [
  HEAD,
  ["2026/10/7", "10/7(水)", "みお", "13:00〜翌2:00", "空きあり", "○", "確定", "亀戸"],
  ["2026/10/7", "10/7(水)", "花恋", "16:00〜翌3:00", "空きあり", "✖️", "確定", "亀戸"],
  ["2026/10/8", "10/8(木)", "みお", "13:00〜22:00", "空きあり", "○", "希望休", "亀戸"],
];

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
  const prof = makeSheet("本日の出勤", [["名前", "年齢"], ["みお", "23"], ["新人ちゃん", "20"]]);
  const g = load({ 出勤情報: makeSheet("出勤情報", baseSched()), 本日の出勤: prof });
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


t("名簿シート：応募シート（名前・年齢）を名簿と誤認しない", () => {
  const apply = makeSheet("応募", [["名前", "年齢", "電話"], ["応募者", "22", "090"]]);
  const g = load({ 出勤情報: makeSheet("出勤情報", baseSched()), 応募: apply });
  assert.equal(g.profileSheet_(), null);
});

t("非公開ファイルへの移動：コピー→LEDGER_SHEET_ID設定→台帳はそちらに読み書き→元から削除", () => {
  const props = { SHEET_ID: "PUB" };
  const pub = {
    出勤情報: makeSheet("出勤情報", baseSched()),
    予約台帳: makeSheet("予約台帳", [["予約ID"], ["BK1"]]),
    予約履歴: makeSheet("予約履歴", [["履歴ID"], ["H1"], ["H2"]]),
  };
  const books = { PUB: pub };
  let created = null;
  const mkBook = (id, tabs) => ({
    getId: () => id, getUrl: () => "https://example/" + id,
    getSheetByName: (n) => tabs[n] || null,
    getSheets: () => Object.values(tabs),
    deleteSheet: (sh) => { delete tabs[sh.getName()]; },
  });
  const g = load(pub, props);
  g.props_ = () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } });
  g.cfg_ = (k, d) => (props[k] == null || props[k] === "" ? d : props[k]);
  g.SpreadsheetApp = {
    openById: (id) => mkBook(id, books[id]),
    create: () => { books.PRIV = { "シート1": makeSheet("シート1", [[]]) }; created = mkBook("PRIV", books.PRIV); return created; },
  };
  g.book_ = () => mkBook(g.sheetId_(), books[g.sheetId_()]);
  // copyTo を模擬
  for (const sh of Object.values(pub)) sh.copyTo = (dst) => { const c = makeSheet(sh.getName() + " のコピー", sh.v); c.setName = (n) => { delete books.PRIV[c.__n]; books.PRIV[n] = c; c.getName = () => n; }; c.__n = sh.getName() + " のコピー"; books.PRIV[c.__n] = c; return c; };
  g.privateBookStep1_copy();
  assert.equal(props.LEDGER_SHEET_ID, "PRIV");
  assert.ok(books.PRIV["予約台帳"] && books.PRIV["予約履歴"]);
  assert.equal(books.PRIV["シート1"], undefined);
  assert.equal(g.ledger_().getName(), "予約台帳");
  assert.equal(g.ledgerBook_().getId(), "PRIV");
  // 元ファイルにコピー後の追記があれば削除しない
  pub["予約台帳"].v.push(["BK2"]);
  assert.throws(() => g.privateBookStep2_remove(), /追記/);
  pub["予約台帳"].v.pop();
  g.privateBookStep2_remove();
  assert.equal(pub["予約台帳"], undefined);
  assert.equal(pub["予約履歴"], undefined);
  assert.ok(pub["出勤情報"]); // サイト用は残る
});

t("開始・終了の列に分かれた表（出勤時間は空・終了は「2:00」形式）を読み書きできる", () => {
  const head = ["日付", "ラベル", "エリア", "名前", "出勤時間", "開始", "終了", "ステータス", "出勤", "チェック"];
  const rows = [head,
    ["2026/9/16", "", "亀戸", "あやか", "", "18:00", "2:00", "空きあり", "○", false],
    ["2026/10/2", "", "亀戸", "みお", "", "13:00", "2:00", "空きあり", "○", false]];
  for (let i = 0; i < 30; i++) rows.push(["", "", "", "", "", "", "", "", "", false]); // チェックボックスだけの行
  const sch = makeSheet("出勤情報", rows);
  const g = load({ 出勤情報: sch });
  const r = g.readShift_("みお", "2026/10/2");
  assert.ok(r);
  assert.equal(g.fmtJst(r.endMs), "2026/10/03 02:00"); // 2:00 は翌日として読む
  const res = g.adminShiftSave({ name: "ゆな", date: "2026/10/8", start: "13:00", end: "翌2:00" });
  assert.equal(res.ok, true, res.reason);
  const row = sch.v[3]; // 最後の出勤行のすぐ下（チェックボックスだけの行の下ではない）
  assert.equal(row[3], "ゆな");
  assert.equal(row[0], "2026/10/8");
  assert.equal(row[4], ""); // 出勤時間は空の運用なので触らない
  assert.equal(row[5], "13:00");
  assert.equal(row[6], "2:00"); // 既存に合わせて「翌」なし
  assert.equal(row[8], "○");
  assert.equal(row[9], false); // 他の列（チェックボックス）は消さない
  assert.equal(sch.v.length, rows.length);
  const r2 = g.readShift_("ゆな", "2026/10/8");
  assert.equal(g.fmtJst(r2.endMs), "2026/10/09 02:00");
  // 2件目はその下に
  g.adminShiftSave({ name: "花恋", date: "2026/10/8", start: "16:00", end: "翌3:00" });
  assert.equal(sch.v[4][3], "花恋");
});

t("本日：今日（営業日）の行を並び順で返し、保存で ステータス・案内時刻・並び を書き込む（列が無ければ追加）", () => {
  const head = ["日付", "ラベル", "エリア", "名前", "出勤時間", "開始", "終了", "ステータス", "出勤"];
  const sch = makeSheet("出勤情報", [head,
    ["2026/10/7", "", "亀戸", "あやか", "", "18:00", "2:00", "空きあり", "○"],
    ["2026/10/7", "", "亀戸", "みお", "", "13:00", "2:00", "空きあり", "○"],
    ["2026/10/7", "", "亀戸", "れな", "", "13:00", "2:00", "空きあり", "✖️"],
    ["2026/10/8", "", "亀戸", "ゆな", "", "13:00", "2:00", "空きあり", "○"]]);
  const g = load({ 出勤情報: sch });
  g.nowMs_ = () => g.parseJstDateTime("2026/10/8", "3:00"); // 10/8 3:00 は 10/7 の営業日
  const r = plain(g.adminToday());
  assert.equal(r.date, "2026/10/7");
  assert.deepEqual(r.list.map((x) => x.name), ["あやか", "みお", "れな"]);
  assert.equal(r.list[2].absent, true);
  const res = plain(g.adminTodaySave({ date: "2026/10/7", items: [
    { row: 3, name: "みお", status: "残りわずか", guideTime: "翌0:30" },
    { row: 2, name: "あやか", status: "満員", guideTime: "" },
  ] }));
  assert.equal(res.ok, true, res.reason);
  assert.deepEqual(plain(sch.v[0].slice(9)), ["案内時刻", "並び"]);
  assert.equal(sch.v[2][7], "残りわずか");
  assert.equal(sch.v[2][9], "翌0:30");
  assert.equal(sch.v[2][10], 1);
  assert.equal(sch.v[1][10], 2);
  assert.equal(sch.v[1][7], "満員");
  const r2 = plain(g.adminToday());
  assert.deepEqual(r2.list.map((x) => x.name), ["みお", "あやか", "れな"]);
  assert.equal(r2.list[0].guideTime, "翌0:30");
  // 行がずれていたら拒否・日付が変わったら拒否・不正な時刻は拒否
  assert.equal(plain(g.adminTodaySave({ date: "2026/10/7", items: [{ row: 2, name: "みお" }] })).ok, false);
  assert.equal(plain(g.adminTodaySave({ date: "2026/10/6", items: [{ row: 3, name: "みお" }] })).ok, false);
  assert.equal(plain(g.adminTodaySave({ date: "2026/10/7", items: [{ row: 3, name: "みお", guideTime: "あとで" }] })).ok, false);
});

console.log(`\n✅ 全 ${passed} 件 パス`);
