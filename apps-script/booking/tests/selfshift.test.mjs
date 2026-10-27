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

t("本人の登録・変更・取消（出勤情報シートに書き、他の人の行は触らない）", () => {
  const { g, sheets, day } = setup();
  const km = keyOf(g.adminShiftLinkIssue("みお").url);
  const kr = keyOf(g.adminShiftLinkIssue("れいこ").url);
  assert.equal(plain(g.therapistShiftSet_({ key: km, date: day(1), start: "13:00", end: "翌2:00" })).ok, true);
  assert.equal(plain(g.therapistShiftSet_({ key: kr, date: day(1), start: "15:00", end: "23:00" })).ok, true);
  assert.deepEqual(names(sheets["出勤情報"]), ["みお@" + day(1), "れいこ@" + day(1)]);
  // 変更は同じ行を更新（行は増えない）
  assert.equal(plain(g.therapistShiftSet_({ key: km, date: day(1), start: "18:00", end: "翌4:00" })).ok, true);
  assert.equal(sheets["出勤情報"].v.length, 3);
  const me = plain(g.therapistShiftMe_({ key: km }));
  assert.equal(me.days.length, 28);
  assert.deepEqual([me.days[1].start, me.days[1].end], ["18:00", "翌4:00"]);
  assert.equal(me.days[0].start, ""); // 未登録の日
  assert.ok(!JSON.stringify(me).includes("れいこ")); // 他の人の情報は返さない
  // 取消
  assert.equal(plain(g.therapistShiftDel_({ key: km, date: day(1) })).ok, true);
  assert.deepEqual(names(sheets["出勤情報"]), ["れいこ@" + day(1)]);
  assert.equal(plain(g.therapistShiftDel_({ key: km, date: day(1) })).ok, false); // もう無い
  // 操作者は本人として履歴に残る
  assert.ok(g.__history.some((h) => String(h[1]).includes("セラピスト本人（みお）")));
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

t("予約が入っている日：予約が時間外になる変更・取消はできない", () => {
  const { g, day } = setup();
  const k = keyOf(g.adminShiftLinkIssue("みお").url);
  assert.equal(plain(g.therapistShiftSet_({ key: k, date: day(3), start: "13:00", end: "翌2:00" })).ok, true);
  const s = g.parseJstDateTime(day(3), "20:00");
  g.__ledger = [{ status: g.STATUS.CONFIRMED, therapistName: "みお", therapistId: "みお", startAt: s, endAt: s + 90 * 60000 }];
  const r1 = plain(g.therapistShiftSet_({ key: k, date: day(3), start: "13:00", end: "19:00" }));
  assert.equal(r1.ok, false);
  assert.match(r1.reason, /ご予約が入っている/);
  assert.equal(plain(g.therapistShiftDel_({ key: k, date: day(3) })).ok, false);
  // 予約を含む時間への変更はできる
  assert.equal(plain(g.therapistShiftSet_({ key: k, date: day(3), start: "18:00", end: "翌2:00" })).ok, true);
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
