/* 表示順：出勤表の ▲▼ で並べ替えて保存（adminTherapistOrderSave）・一覧の並び（therapistNames_） */
import test from "node:test";
import assert from "node:assert/strict";
import { load, makeSheet, plain } from "./harness.mjs";

function setup(rows) {
  const sheets = { 本日の出勤: makeSheet("本日の出勤", rows) };
  const ctx = load(sheets, {});
  ctx.autoDeploy_ = () => ({ deployed: true, note: "" });
  ctx.therapistDirectory_ = () => ({ list: [{ id: "x", name: "出勤だけの人" }], byName: {} });
  return { ctx, sheet: sheets["本日の出勤"] };
}

test("一覧は「表示順」の小さい順、空欄は後ろに名簿の順、出勤シートだけの人は最後", () => {
  const { ctx } = setup([["名前", "年齢", "表示順"], ["れいこ", "30", ""], ["かのん", "22", "2"], ["さら", "26", "１"], ["ももこ", "26", ""]]);
  assert.deepEqual(plain(ctx.therapistNames_()), ["さら", "かのん", "れいこ", "ももこ", "出勤だけの人"]);
});

test("並び順を保存：1,2,3…を書き込み、一覧もその順になる・サイトを作り直す", () => {
  const { ctx, sheet } = setup([["名前", "年齢", "表示順"], ["れいこ", "30", "1"], ["かのん", "22", "2"], ["さら", "26", "3"]]);
  const r = plain(ctx.adminTherapistOrderSave(["さら", "れいこ", "かのん", "出勤だけの人"]));
  assert.equal(r.ok, true);
  assert.equal(r.deployed, true);
  assert.deepEqual(sheet.v.slice(1).map((x) => [x[0], x[2]]), [["れいこ", 2], ["かのん", 3], ["さら", 1]]);
  assert.deepEqual(plain(ctx.therapistNames_()).slice(0, 3), ["さら", "れいこ", "かのん"]);
});

test("「表示順」列が無ければ作る・一覧に無い名簿の人は後ろに番号を付ける", () => {
  const { ctx, sheet } = setup([["名前", "年齢"], ["れいこ", "30"], ["かのん", "22"], ["さら", "26"]]);
  assert.equal(plain(ctx.adminTherapistOrderSave(["かのん"])).ok, true);
  assert.equal(sheet.v[0][2], "表示順");
  assert.deepEqual(sheet.v.slice(1).map((x) => [x[0], x[2]]), [["れいこ", 2], ["かのん", 1], ["さら", 3]]);
});

test("空の並び順は断る・プロフィール編集の項目に「表示順」は出ない", () => {
  const { ctx } = setup([["名前", "年齢", "表示順"], ["れいこ", "30", "1"]]);
  assert.equal(plain(ctx.adminTherapistOrderSave([])).ok, false);
  assert.ok(!plain(ctx.PROFILE_FIELDS_).some((f) => f.key === "表示順"));
});
