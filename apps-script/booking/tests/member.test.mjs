/* 会員制度（OPENING VIP・来店ランク）のテスト。
 *   実行: node apps-script/booking/tests/member.test.mjs */
import assert from "node:assert/strict";
import { makeSheet, load, plain } from "./harness.mjs";

function setup(props = {}) {
  const sheets = { 出勤情報: makeSheet("出勤情報", [["日付", "名前", "出勤時間"]]) };
  const g = load(sheets, props);
  g.__now = g.parseJstDateTime("2026/10/20", "12:00"); // 募集期間中
  g.nowMs_ = () => g.__now;
  g.__ledger = [];
  return { g, sheets };
}
const reg = (g, o = {}) => plain(g.memberRegister_({ nickname: "ゆう", email: "a@example.com", agreeTerms: true, ...o }));
const jsonp = (out) => JSON.parse(out.s);

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("  ✓ " + name); };
console.log("会員制度 テスト");

t("募集前は登録できない・受付状況は before", () => {
  const { g } = setup();
  g.__now = g.parseJstDateTime("2026/10/9", "23:59");
  assert.match(reg(g).reason, /から開始/);
  const s = jsonp(g.vipStatusResponse_({}));
  assert.equal(s.phase, "before");
  assert.equal(s.count, 0);
  assert.equal(s.remaining, 100);
});

t("受付中：登録順に 001, 002…・会員証キーを発行・人数は実データ", () => {
  const { g, sheets } = setup();
  const a = reg(g, { email: "A@Example.com", tel: "090-1111-2222", agreeMarketing: true, birthMonth: "4" });
  assert.equal(a.ok, true, a.reason);
  assert.equal(a.memberNo, "001");
  assert.equal(a.kind, "VIP");
  assert.match(a.cardKey, /^[0-9a-f]{40}$/);
  const b = reg(g, { email: "b@example.com" });
  assert.equal(b.memberNo, "002");
  const row = sheets["会員"].v[1];
  assert.equal(row[0], "001");
  assert.equal(row[4], "a@example.com"); // メールは小文字で保存
  assert.equal(row[5], "09011112222");
  assert.equal(row[7], "同意");
  assert.equal(row[14], 4); // 誕生月（任意）
  const s = jsonp(g.vipStatusResponse_({}));
  assert.equal(s.count, 2);
  assert.equal(s.remaining, 98);
  assert.equal(s.phase, "open");
  assert.ok(!JSON.stringify(s).includes("example.com")); // 個人情報なし
});

t("重複登録はメール・電話で防ぐ／同じ送信の再送は同じ番号", () => {
  const { g } = setup();
  reg(g, { email: "a@example.com", tel: "09011112222", idempotencyKey: "k1" });
  assert.equal(reg(g, { email: "A@example.com " }).ok, false);
  assert.equal(reg(g, { email: "c@example.com", tel: "090-1111-2222" }).ok, false);
  const again = reg(g, { email: "a@example.com", tel: "09011112222", idempotencyKey: "k1" });
  assert.equal(again.ok, true);
  assert.equal(again.memberNo, "001");
  assert.equal(reg(g, { email: "d@example.com" }).memberNo, "002");
});

t("定員に達したら VIP は締切 → 通常会員（M0001〜）として登録", () => {
  const { g } = setup({ VIP_CAPACITY: "2" });
  reg(g, { email: "1@example.com" });
  reg(g, { email: "2@example.com" });
  assert.equal(jsonp(g.vipStatusResponse_({})).phase, "full");
  const c = reg(g, { email: "3@example.com" });
  assert.equal(c.kind, "MEMBER");
  assert.equal(c.memberNo, "M0001");
  assert.equal(jsonp(g.vipStatusResponse_({})).count, 2); // VIPは2名のまま
});

t("募集期間の終了後は通常会員", () => {
  const { g } = setup();
  g.__now = g.parseJstDateTime("2026/11/15", "0:00");
  const r = reg(g);
  assert.equal(r.kind, "MEMBER");
  assert.equal(jsonp(g.vipStatusResponse_({})).phase, "closed");
});

t("入力チェック：同意なし・メール不正・電話不正・ボット対策", () => {
  const { g } = setup();
  assert.equal(reg(g, { agreeTerms: false }).ok, false);
  assert.equal(reg(g, { email: "abc" }).ok, false);
  assert.equal(reg(g, { tel: "123" }).ok, false);
  assert.equal(reg(g, { nickname: "" }).ok, false);
  assert.equal(reg(g, { birthMonth: "13" }).ok, false);
  assert.equal(reg(g, { website: "http://spam" }).ok, false);
});

t("会員証：キーで照会・直近6か月の精算済み来店でランク（メール・電話は返さない）", () => {
  const { g } = setup();
  const a = reg(g, { email: "a@example.com", tel: "09011112222" });
  const at = (d) => g.parseJstDateTime(d, "14:00");
  g.__ledger = [
    { id: "B1", status: "confirmed", tel: "090-1111-2222", startAt: at("2026/10/1") },
    { id: "B2", status: "confirmed", tel: "09011112222", startAt: at("2026/10/5") },
    { id: "B3", status: "confirmed", tel: "", email: "A@example.com", startAt: at("2026/10/10") },
    { id: "B4", status: "confirmed", tel: "09011112222", startAt: at("2026/3/1") },   // 6か月より前
    { id: "B5", status: "cancelled", tel: "09011112222", startAt: at("2026/10/12") }, // 精算なし
    { id: "B6", status: "confirmed", tel: "08099998888", startAt: at("2026/10/12") }, // 別の人
  ];
  g.settlements_ = () => ({ B1: {}, B2: {}, B3: {}, B4: {}, B6: {} });
  const c = jsonp(g.memberCardResponse_({ k: a.cardKey }));
  assert.equal(c.ok, true);
  assert.equal(c.memberNo, "001");
  assert.equal(c.visits, 3);
  assert.equal(c.rank, "GOLD");
  assert.equal(c.vipActive, true);
  assert.ok(!JSON.stringify(c).includes("example.com") && !JSON.stringify(c).includes("0901111"));
  assert.equal(jsonp(g.memberCardResponse_({ k: "0".repeat(40) })).ok, false);
  assert.equal(jsonp(g.memberCardResponse_({ k: "<script>" })).ok, false);
  g.__now = g.parseJstDateTime("2027/1/1", "12:00");
  assert.equal(jsonp(g.memberCardResponse_({ k: a.cardKey })).vipActive, false); // 12/31で終了
});

t("ランクの段階：0=未付与・1〜2 SILVER・3〜5 GOLD・6〜 DIAMOND", () => {
  const { g } = setup();
  assert.deepEqual([0, 1, 2, 3, 5, 6, 10].map((n) => g.rankOf_(n)), ["", "SILVER", "SILVER", "GOLD", "GOLD", "DIAMOND", "DIAMOND"]);
});

t("管理：会員一覧（来店・ランク）・取消すると会員証は無効・履歴に記録", () => {
  const { g } = setup();
  const a = reg(g, { email: "a@example.com", tel: "09011112222" });
  g.__ledger = [{ id: "B1", status: "confirmed", tel: "09011112222", startAt: g.parseJstDateTime("2026/10/15", "14:00") }];
  g.settlements_ = () => ({ B1: {} });
  const m = plain(g.adminMembers());
  assert.equal(m.rows[0].no, "001");
  assert.equal(m.rows[0].rank, "SILVER");
  assert.equal(m.vip.count, 1);
  assert.equal(plain(g.adminMemberUpdate({ no: "001", status: "取消", memo: "ご本人希望" })).ok, true);
  assert.equal(jsonp(g.memberCardResponse_({ k: a.cardKey })).ok, false);
  assert.ok(g.__history.some((h) => h[0] === "MEMBER" && /変更/.test(h[2])));
  // 取消後は同じメールで再登録できる
  assert.equal(reg(g, { email: "a@example.com" }).ok, true);
});

t("予約一覧に会員番号・来店ランク", () => {
  const { g } = setup();
  reg(g, { email: "a@example.com", tel: "09011112222" });
  const at = (d) => g.parseJstDateTime(d, "14:00");
  g.__ledger = [
    { id: "B1", status: "confirmed", tel: "09011112222", startAt: at("2026/10/1"), endAt: at("2026/10/1") },
    { id: "B2", status: "confirmed", tel: "09011112222", startAt: at("2026/10/25"), endAt: at("2026/10/25") },
  ];
  g.settlements_ = () => ({ B1: {} });
  const rows = plain(g.adminList({})).rows;
  const b2 = rows.find((r) => r.id === "B2");
  assert.equal(b2.member.memberNo, "001");
  assert.equal(b2.member.rank, "SILVER");
});

console.log(`\n✅ 全 ${passed} 件 パス`);
