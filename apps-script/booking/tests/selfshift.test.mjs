/* セラピスト本人のシフト入力（専用URL）のテスト。
 *   実行: node apps-script/booking/tests/selfshift.test.mjs */
import assert from "node:assert/strict";
import { makeSheet, load, plain } from "./harness.mjs";

const HEAD = ["日付", "ラベル", "名前", "開始", "終了", "ステータス", "出勤", "区分", "エリア"];
const PROF = [["名前", "年齢"], ["みお", "24"], ["れいこ", "41"]];

function setup() {
  const sheets = {
    出勤情報: makeSheet("出勤情報", [HEAD]),
    本日の出勤: makeSheet("本日の出勤", PROF),
  };
  const g = load(sheets, { SITE_URL: "https://aroma-daiamond.com/" });
  g.__ledger = [];
  const today = g.bizTodayStr_();
  const day = (n) => g.addDays_(today, n);
  return { g, sheets, today, day };
}
const keyOf = (url) => new URL(url).searchParams.get("k");
const names = (sh) => sh.v.slice(1).map((r) => r[2] + "@" + r[0]);

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("  ✓ " + name); };
console.log("セラピスト本人のシフト入力 テスト");

t("URLの発行：鍵はハッシュだけを保存し、再発行で前のURLは使えなくなる", () => {
  const { g, sheets } = setup();
  const a = plain(g.adminShiftLinkIssue("みお"));
  assert.equal(a.ok, true);
  assert.match(a.url, /^https:\/\/aroma-daiamond\.com\/shift\/\?k=[0-9a-f]{40}$/);
  const k1 = keyOf(a.url);
  const row = sheets["シフト入力URL"].v[1];
  assert.equal(row[0], "みお");
  assert.notEqual(row[1], k1); // 鍵そのものは保存しない
  assert.equal(plain(g.therapistShiftMe_({ key: k1 })).name, "みお");
  const b = plain(g.adminShiftLinkIssue("みお"));
  assert.equal(sheets["シフト入力URL"].v.length, 2); // 1人1行
  assert.equal(plain(g.therapistShiftMe_({ key: k1 })).ok, false);
  assert.equal(plain(g.therapistShiftMe_({ key: keyOf(b.url) })).ok, true);
  assert.equal(plain(g.adminShiftLinkIssue("だれか")).ok, false); // 名簿にいない人には発行しない
});

t("無効化すると使えない・でたらめな鍵も使えない", () => {
  const { g } = setup();
  const k = keyOf(g.adminShiftLinkIssue("れいこ").url);
  g.adminShiftLinkRevoke("れいこ");
  assert.equal(plain(g.therapistShiftMe_({ key: k })).ok, false);
  assert.equal(plain(g.therapistShiftMe_({ key: "abc" })).ok, false);
  assert.equal(plain(g.therapistShiftSet_({ key: "0".repeat(40), date: g.bizTodayStr_(), start: "13:00", end: "翌2:00" })).ok, false);
});

t("本人は登録だけ：登録済みの日の変更はできず、他の人の行は触らない", () => {
  const { g, sheets, day } = setup();
  const km = keyOf(g.adminShiftLinkIssue("みお").url);
  const kr = keyOf(g.adminShiftLinkIssue("れいこ").url);
  assert.equal(plain(g.therapistShiftSet_({ key: km, date: day(1), start: "13:00", end: "18:00" })).ok, true);
  assert.equal(plain(g.therapistShiftSet_({ key: kr, date: day(1), start: "18:00", end: "翌2:00" })).ok, true); // ちょうど境目はOK
  assert.deepEqual(names(sheets["出勤情報"]), ["みお@" + day(1), "れいこ@" + day(1)]);
  const again = plain(g.therapistShiftSet_({ key: km, date: day(1), start: "10:00", end: "12:00" }));
  assert.equal(again.ok, false);
  assert.match(again.reason, /すでに登録されています/);
  assert.equal(sheets["出勤情報"].v.length, 3);
  assert.equal(g.therapistShiftDel_, undefined); // 本人の取消は無い
  const post = (body) => JSON.parse(g.doPost({ postData: { contents: JSON.stringify(body) } }).s);
  assert.equal(post({ action: "shift_del", key: km, date: day(1) }).ok, false); // 取消のアクションも無い
  assert.equal(sheets["出勤情報"].v.length, 3);
  assert.ok(g.__history.some((h) => String(h[1]).includes("セラピスト本人（みお）")));
});

t("ほかの人の出勤と1分でも重なる時間は登録できない（休みの人は除く）", () => {
  const { g, sheets, day } = setup();
  const km = keyOf(g.adminShiftLinkIssue("みお").url);
  const kr = keyOf(g.adminShiftLinkIssue("れいこ").url);
  assert.equal(plain(g.therapistShiftSet_({ key: km, date: day(2), start: "13:00", end: "翌2:00" })).ok, true);
  const r = plain(g.therapistShiftSet_({ key: kr, date: day(2), start: "翌1:30", end: "翌4:00" }));
  assert.equal(r.ok, false);
  assert.match(r.reason, /みお さんの出勤（13:00〜翌2:00）と重なる/);
  assert.equal(plain(g.therapistShiftSet_({ key: kr, date: day(2), start: "翌2:00", end: "翌4:00" })).ok, true);
  // 休み（✖️）の人の時間は空き扱い
  assert.equal(plain(g.therapistShiftSet_({ key: km, date: day(3), start: "13:00", end: "20:00" })).ok, true);
  const row = sheets["出勤情報"].v.findIndex((x) => x[2] === "みお" && x[0] === day(3));
  sheets["出勤情報"].v[row][6] = "✖️";
  assert.equal(plain(g.therapistShiftSet_({ key: kr, date: day(3), start: "15:00", end: "18:00" })).ok, true);
});

t("本人の画面：自分の登録と、ほかの人の出勤（名前と時間・休みは除く）を返す", () => {
  const { g, sheets, day } = setup();
  const km = keyOf(g.adminShiftLinkIssue("みお").url);
  const kr = keyOf(g.adminShiftLinkIssue("れいこ").url);
  g.therapistShiftSet_({ key: km, date: day(1), start: "13:00", end: "翌2:00" });
  g.therapistShiftSet_({ key: kr, date: day(2), start: "15:00", end: "23:00" });
  const me = plain(g.therapistShiftMe_({ key: km }));
  assert.equal(me.days.length, 28);
  assert.equal(me.days[1].registered, true);
  assert.deepEqual([me.days[1].start, me.days[1].end], ["13:00", "翌2:00"]);
  assert.deepEqual(me.days[1].others, []);
  assert.equal(me.days[2].registered, false);
  assert.deepEqual(me.days[2].others, [{ name: "れいこ", start: "15:00", end: "23:00" }]);
  assert.ok(!JSON.stringify(me).includes("予約")); // 予約・お客様の情報は返さない
});

t("受け付ける範囲：今日〜4週間・30分単位・終了は開始より後", () => {
  const { g, day } = setup();
  const k = keyOf(g.adminShiftLinkIssue("みお").url);
  assert.equal(plain(g.therapistShiftSet_({ key: k, date: day(-1), start: "13:00", end: "20:00" })).ok, false);
  assert.equal(plain(g.therapistShiftSet_({ key: k, date: day(28), start: "13:00", end: "20:00" })).ok, false);
  assert.equal(plain(g.therapistShiftSet_({ key: k, date: day(27), start: "13:00", end: "20:00" })).ok, true);
  assert.equal(plain(g.therapistShiftSet_({ key: k, date: day(2), start: "13:15", end: "20:00" })).ok, false);
  assert.equal(plain(g.therapistShiftSet_({ key: k, date: day(2), start: "20:00", end: "13:00" })).ok, false);
});

t("公開API（doPost）から呼べる・不明な鍵は拒否", () => {
  const { g } = setup();
  const k = keyOf(g.adminShiftLinkIssue("みお").url);
  const post = (body) => JSON.parse(g.doPost({ postData: { contents: JSON.stringify(body) } }).s);
  assert.equal(post({ action: "shift_me", key: k }).name, "みお");
  assert.equal(post({ action: "shift_me", key: "x" }).ok, false);
});

t("セラピストを削除するとURLも無効になる", () => {
  const { g, sheets } = setup();
  const k = keyOf(g.adminShiftLinkIssue("れいこ").url);
  sheets["予約台帳"] = makeSheet("予約台帳", [g.HEADER]);
  sheets["予約履歴"] = makeSheet("予約履歴", [g.HISTORY_HEADER]);
  assert.equal(plain(g.adminTherapistDelete({ name: "れいこ", confirm: "れいこ" })).ok, true);
  assert.equal(plain(g.therapistShiftMe_({ key: k })).ok, false);
});

console.log(`\n${passed} 件すべて成功`);
