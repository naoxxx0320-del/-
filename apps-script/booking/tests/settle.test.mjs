/* 実績・バック計算（精算の入力・バック率・月の集計）のテスト。
 *   実行: node apps-script/booking/tests/settle.test.mjs */
import assert from "node:assert/strict";
import { makeSheet, load, plain } from "./harness.mjs";

function setup() {
  const sheets = { 出勤情報: makeSheet("出勤情報", [["日付", "名前", "出勤時間"], ["2026/10/5", "みお", "13:00〜翌2:00"]]) };
  const g = load(sheets);
  const at = (d, t) => g.parseJstDateTime(d, t);
  g.__ledger = [
    { id: "A", status: "confirmed", therapistName: "みお", course: "90分コース", price: 18000, customerName: "田中", startAt: at("2026/10/5", "14:00"), endAt: at("2026/10/5", "15:30") },
    { id: "B", status: "confirmed", therapistName: "おまかせ（指名なし）", course: "60分コース", price: "¥13,000", customerName: "佐藤", startAt: at("2026/10/31", "翌1:00"), endAt: at("2026/10/31", "翌2:00") },
    { id: "C", status: "tentative", therapistName: "みお", course: "60分コース", price: 13000, customerName: "鈴木", startAt: at("2026/10/6", "14:00"), endAt: at("2026/10/6", "15:00") },
    { id: "D", status: "confirmed", therapistName: "みお", course: "120分コース", price: 23000, customerName: "高橋", startAt: at("2026/10/7", "20:00"), endAt: at("2026/10/7", "22:00") },
  ];
  g.nowMs_ = () => at("2026/11/2", "12:00");
  return { g, sheets };
}

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("  ✓ " + name); };
console.log("実績・バック計算 テスト");

t("料金設定・バック率・精算のシートは無ければ作成（料金設定は料金表の既定値）", () => {
  const { g, sheets } = setup();
  const r = plain(g.adminSettleGet("A"));
  assert.equal(r.ok, true);
  assert.equal(r.config.extend.price, 6000);
  assert.deepEqual(r.config.noms.map((x) => x.name), ["写真指名", "本指名", "姫指名"]);
  assert.equal(r.config.options.length, 3);
  assert.ok(sheets["料金設定"] && sheets["バック率"] && sheets["精算"]);
  assert.equal(r.booking.price, 18000);
  assert.equal(r.settle, null);
});

t("精算：バック率が未設定なら拒否・率を一緒に渡すと設定して保存", () => {
  const { g, sheets } = setup();
  assert.match(plain(g.adminSettleSave({ id: "A", therapistName: "みお" })).reason, /バック率が未設定/);
  const r = plain(g.adminSettleSave({ id: "A", therapistName: "みお", rate: 50, extendCount: 1, nom: "本指名", options: ["パウダートリートメント", "衣装チェンジ"], discount: 1000 }));
  assert.equal(r.ok, true, r.reason);
  // コース18,000＋延長6,000＝24,000 → 50%＝12,000 ＋指名1,000＋OP3,000
  assert.equal(r.back, 16000);
  assert.equal(r.total, 24000 + 1000 + 3000 - 1000);
  assert.equal(r.shop, 27000 - 16000);
  const row = sheets["精算"].v[1];
  assert.equal(row[0], "A");
  assert.equal(row[1], "2026/10/5"); // 文字列として保存（' 付き）
  assert.equal(row[9], "パウダートリートメント;衣装チェンジ");
  assert.deepEqual(plain(sheets["バック率"].v[1].slice(0, 2)), ["みお", 50]);
});

t("精算：同じ予約は上書き（行は増えない）・画面の金額ではなくサーバーで再計算", () => {
  const { g, sheets } = setup();
  g.adminSetBackRate("みお", 40);
  g.adminSettleSave({ id: "A", therapistName: "みお", total: 999999, back: 999999 });
  const r = plain(g.adminSettleSave({ id: "A", therapistName: "みお", coursePrice: 20000 }));
  assert.equal(r.back, 8000);
  assert.equal(sheets["精算"].v.length, 2);
  const s = plain(g.adminSettleGet("A")).settle;
  assert.equal(s.coursePrice, 20000);
  assert.equal(s.rate, 40);
});

t("精算：確定以外・おまかせのまま・料金表にない指名/オプション・不正な率は拒否", () => {
  const { g } = setup();
  g.adminSetBackRate("みお", 50);
  assert.equal(plain(g.adminSettleSave({ id: "C", therapistName: "みお" })).ok, false);
  assert.equal(plain(g.adminSettleSave({ id: "B", therapistName: "おまかせ（指名なし）" })).ok, false);
  assert.equal(plain(g.adminSettleSave({ id: "A", therapistName: "みお", nom: "超指名" })).ok, false);
  assert.equal(plain(g.adminSettleSave({ id: "A", therapistName: "みお", options: ["謎"] })).ok, false);
  assert.equal(plain(g.adminSettleSave({ id: "A", therapistName: "みお", rate: 120 })).ok, false);
  assert.equal(plain(g.adminSetBackRate("みお", "abc")).ok, false);
});

t("バック率を変えても過去の精算の金額は変わらない", () => {
  const { g } = setup();
  g.adminSetBackRate("みお", 50);
  g.adminSettleSave({ id: "A", therapistName: "みお" });
  g.adminSetBackRate("みお", 60);
  const m = plain(g.adminPayroll("2026/10"));
  const mio = m.therapists.find((x) => x.name === "みお");
  assert.equal(mio.back, 9000);
  assert.equal(mio.rate, 60);
});

t("月の集計：営業日（翌1:00は前日）でまとめ、日ごと・合計・未精算を返す", () => {
  const { g } = setup();
  g.adminSetBackRate("みお", 50);
  g.adminSetBackRate("れな", 45);
  g.adminSettleSave({ id: "A", therapistName: "みお", nom: "写真指名" });
  g.adminSettleSave({ id: "B", therapistName: "れな" }); // おまかせ → 実際の担当に
  const m = plain(g.adminPayroll("2026/10"));
  assert.equal(m.totals.count, 2);
  assert.equal(m.totals.total, 18000 + 1000 + 13000);
  assert.equal(m.totals.back, 9000 + 1000 + Math.round(13000 * 0.45));
  const rena = m.therapists.find((x) => x.name === "れな");
  assert.equal(rena.days[0].date, "2026/10/31"); // 11/1 1:00 開始だが10/31の営業日
  assert.equal(rena.items[0].customerName, "佐藤");
  const mio = m.therapists.find((x) => x.name === "みお");
  assert.deepEqual(mio.days.map((d) => d.date), ["2026/10/5"]);
  assert.deepEqual(m.unsettled.map((u) => u.id), ["D"]); // 確定・終了済み・未精算（仮予約Cは対象外）
  assert.equal(plain(g.adminPayroll("2026/11")).totals.count, 0);
  assert.equal(plain(g.adminPayroll("10月")).ok, false);
});

t("精算の取り消し・一覧に精算済みの印", () => {
  const { g } = setup();
  g.adminSetBackRate("みお", 50);
  g.adminSettleSave({ id: "A", therapistName: "みお" });
  g.readLedger_ = () => g.__ledger.map((r) => ({ ...r }));
  const list = plain(g.adminList({})).rows;
  assert.deepEqual(list.find((r) => r.id === "A").settled, { total: 18000, back: 9000 });
  assert.equal(list.find((r) => r.id === "D").settled, null);
  assert.equal(plain(g.adminSettleDelete("A")).ok, true);
  assert.equal(plain(g.adminSettleGet("A")).settle, null);
  assert.equal(plain(g.adminSettleDelete("A")).ok, false);
});

console.log(`\n✅ 全 ${passed} 件 パス`);
