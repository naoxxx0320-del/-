/* ご意見フォーム（feedbackSubmit_）：検証・記録先・メール・いたずら対策 */
import test from "node:test";
import assert from "node:assert/strict";
import { load, plain } from "./harness.mjs";

function setup(props = { STORE_EMAIL: "store@example.com", TEST_MODE: "false" }) {
  const sheets = {};
  const mails = [];
  const logs = [];
  const ctx = load(sheets, props, {
    GmailApp: { sendEmail: (to, subject, body) => mails.push({ to, subject, body }) },
  });
  ctx.Logger = { log: (s) => logs.push(String(s)) };
  ctx.ledgerBook_ = ctx.book_; // お客様情報用のブック（テストでは同じ模擬ブック）
  return { ctx, sheets, mails, logs };
}

const ok = {
  name: "やまだ",
  visitDate: "2026-11-15",
  therapist: "ももこ",
  course: "90分コース",
  ratings: { treatment: "とても満足", service: "満足", therapist: "とても満足", clean: "普通", phone: "満足" },
  comment: "また来ます",
};

test("正しい内容：ご意見シートに1行記録し、店舗へメールする", () => {
  const { ctx, sheets, mails } = setup();
  const r = plain(ctx.feedbackSubmit_(ok));
  assert.equal(r.ok, true);
  assert.equal(r.mailed, true);
  const v = sheets["ご意見"].v;
  assert.deepEqual(plain(v[0]), ["受付日時", "お名前", "来店日", "担当セラピスト", "コース", "施術", "サービス", "セラピスト", "お店の清潔感", "電話受付", "よかった点・悪かった点"]);
  assert.deepEqual(plain(v[1].slice(1)), ["やまだ", "2026-11-15", "ももこ", "90分コース", "とても満足", "満足", "とても満足", "普通", "満足", "また来ます"]);
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, "store@example.com");
  assert.match(mails[0].subject, /ご意見/);
  assert.match(mails[0].body, /また来ます/);
});

test("必須項目・評価の値を検証する（記録もメールもしない）", () => {
  const { ctx, sheets, mails } = setup();
  assert.equal(plain(ctx.feedbackSubmit_({ ...ok, visitDate: "" })).ok, false);
  assert.equal(plain(ctx.feedbackSubmit_({ ...ok, therapist: "" })).ok, false);
  assert.equal(plain(ctx.feedbackSubmit_({ ...ok, ratings: { ...ok.ratings, clean: "最高" } })).ok, false);
  assert.equal(sheets["ご意見"], undefined);
  assert.equal(mails.length, 0);
});

test("隠し項目が埋まった自動投稿は記録しない／同じ内容の連続送信は1件だけ", () => {
  const { ctx, sheets, mails } = setup();
  assert.equal(plain(ctx.feedbackSubmit_({ ...ok, website: "http://spam" })).ok, true);
  assert.equal(sheets["ご意見"], undefined);
  ctx.feedbackSubmit_(ok);
  const r2 = plain(ctx.feedbackSubmit_(ok));
  assert.equal(r2.duplicate, true);
  assert.equal(sheets["ご意見"].v.length, 2); // 見出し＋1件
  assert.equal(mails.length, 1);
});

test("数式として解釈される入力は文字列として記録する", () => {
  const { ctx, sheets } = setup();
  ctx.feedbackSubmit_({ ...ok, comment: "=HYPERLINK(\"x\")" });
  assert.equal(sheets["ご意見"].v[1][10], "=HYPERLINK(\"x\")"); // 模擬シートは先頭の ' を外して保持＝文字列扱い
});

test("TEST_MODE 中は送信せず、記入内容をログに出さない", () => {
  const { ctx, logs, mails } = setup({ STORE_EMAIL: "store@example.com", TEST_MODE: "true" });
  const r = plain(ctx.feedbackSubmit_(ok));
  assert.equal(r.ok, true);
  assert.equal(r.mailed, false);
  assert.equal(mails.length, 0);
  assert.ok(!logs.some((l) => l.includes("また来ます")), "本文がログに出ている");
});

test("doPost の action=feedback で受け付ける", () => {
  const { ctx, sheets } = setup();
  const out = ctx.doPost({ postData: { contents: JSON.stringify({ action: "feedback", ...ok }) } });
  assert.equal(JSON.parse(out.s).ok, true);
  assert.equal(sheets["ご意見"].v.length, 2);
});
