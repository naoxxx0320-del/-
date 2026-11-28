// リラクシィへの転載：本文の長さの調整と、二重投稿を防ぐ目印（通信しない）
import test from "node:test";
import assert from "node:assert/strict";
import { fitText, mark, MAX_TEXT } from "../src/rx-post.mjs";

test("330字以内はそのまま", () => {
  assert.equal(fitText("こんにちは。\n今日も出勤です"), "こんにちは。\n今日も出勤です");
});

test("330字を超えるときは文の切れ目で切って「…」", () => {
  const long = "あ".repeat(250) + "。" + "い".repeat(200);
  const t = fitText(long);
  assert.ok([...t].length <= MAX_TEXT);
  assert.equal(t, "あ".repeat(250) + "。…");
  const noBreak = "う".repeat(400);
  assert.equal([...fitText(noBreak)].length, MAX_TEXT);
});

test("目印は空白を除いた先頭20字", () => {
  assert.equal(mark("おはよう ございます\n今日は 12時から 出勤します よろしく"), "おはようございます今日は12時から出勤し");
});

test("6時間より前の日記は元の日付を先頭に入れる", async () => {
  const { composeText } = await import("../src/rx-post.mjs");
  const now = Date.parse("2026-11-28T17:00:00+09:00");
  assert.equal(composeText({ at: "2026-11-24 12:25", text: "本日も出勤しました" }, now), "11/24の日記より\n\n本日も出勤しました");
  assert.equal(composeText({ at: "2026-11-28 15:00", text: "本日も出勤しました" }, now), "本日も出勤しました");
});
