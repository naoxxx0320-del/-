/* 予約確定メールの「ご来店時のご案内」 */
import test from "node:test";
import assert from "node:assert/strict";
import { load } from "./harness.mjs";

const r = { customerName: "テスト", therapistName: "さら", course: "90分コース", startAt: Date.UTC(2026, 10, 16, 6), endAt: Date.UTC(2026, 10, 16, 7, 30), price: "18,000円" };

test("確定メールに待ち合わせ場所と電話番号の案内が入る（仮予約メールには入らない）", () => {
  const ctx = load({}, {});
  const c = ctx.mailTemplate_("confirmed", r);
  assert.match(c.body, /▼ご来店時のご案内/);
  assert.match(c.body, /「なか卯 亀戸店」/);
  assert.match(c.body, /「080-4885-5430」までお電話/);
  // 案内はご予約内容の後、変更・キャンセルの案内の前
  assert.ok(c.body.indexOf("▼ご予約内容") < c.body.indexOf("▼ご来店時のご案内"));
  assert.ok(c.body.indexOf("▼ご来店時のご案内") < c.body.indexOf("変更・キャンセル"));
  assert.doesNotMatch(ctx.mailTemplate_("tentative", { ...r, confirmToken: "x" }).body, /なか卯/);
});

test("スクリプトプロパティ CONFIRM_MAIL_NOTE で文面を差し替え・空白1文字で非表示", () => {
  const a = load({}, { CONFIRM_MAIL_NOTE: "1行目\\n2行目" }).mailTemplate_("confirmed", r).body;
  assert.match(a, /▼ご来店時のご案内\n1行目\n2行目/);
  const b = load({}, { CONFIRM_MAIL_NOTE: " " }).mailTemplate_("confirmed", r).body;
  assert.doesNotMatch(b, /ご来店時のご案内/);
});

test("料金が「18,000円」の文字でも ¥18,000 と表示する（¥NaN にならない）", () => {
  const ctx = load({}, {});
  assert.match(ctx.mailTemplate_("confirmed", r).body, /90分コース（¥18,000）/);
  assert.match(ctx.mailTemplate_("confirmed", { ...r, price: 23000 }).body, /（¥23,000）/);
  assert.doesNotMatch(ctx.mailTemplate_("confirmed", { ...r, price: "" }).body, /¥/);
});

test("メールのセラピスト名は名簿の表示名（名前と表示名が違う人）", async () => {
  const { makeSheet } = await import("./harness.mjs");
  const sheets = { 本日の出勤: makeSheet("本日の出勤", [["名前", "年齢", "表示名"], ["つばさ", "21", "ひなた"], ["さら", "26", ""]]) };
  const ctx = load(sheets, {});
  assert.match(ctx.mailTemplate_("confirmed", { ...r, therapistName: "つばさ" }).body, /セラピスト: ひなた/);
  assert.match(ctx.mailTemplate_("confirmed", { ...r, therapistName: "さら" }).body, /セラピスト: さら/); // 表示名が空なら名前
  assert.match(ctx.mailTemplate_("confirmed", { ...r, therapistName: "いない" }).body, /セラピスト: いない/);
});
