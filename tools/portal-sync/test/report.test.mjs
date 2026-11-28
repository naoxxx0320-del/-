// 週の集客レポート：画面の文字・記録から数字を取り出す（通信しない）
import test from "node:test";
import assert from "node:assert/strict";
import { estamaRank, estamaAccess, ekichikaAccess, rxFollowers, countLog, lastWeek } from "../src/report/parse.mjs";

test("エステ魂の順位：お店の名前の前の番号（宣伝の行は飛ばす）", () => {
  const t = "17\nOREKANO\n錦糸町・亀戸\n18\nブランドサイト超集客DX契約中\nアロマダイヤモンド\n錦糸町・亀戸\n19\nラグタイム";
  assert.equal(estamaRank(t), 18);
  assert.equal(estamaRank("1\nほかのお店\n"), null);
});

test("エステ魂のアクセス：日付と件数", () => {
  assert.deepEqual(estamaAccess([["日付", "曜日", "", "アクセス数", "変化"], ["11月27日", "金", "", "243", "67"], ["11月26日", "木", "", "1,176", "43"]], "2026"), { "2026-11-27": 243, "2026-11-26": 1176 });
});

test("駅ちかのアクセス：「アクセス 総数」の行の日ごとの値（- は入れない）", () => {
  const days = [...Array(30)].map((_, i) => (i < 27 ? String(i + 1) : "-"));
  const rows = [["2026年", "11月"], ["アクセス", "総数", "日平均", "4.2", "2.1", "2.1", "114", ...days], ["プロフィール", "日平均", "9", ...days]];
  const r = ekichikaAccess(rows, "2026-11");
  assert.equal(r["2026-11-01"], 1);
  assert.equal(r["2026-11-27"], 27);
  assert.equal(r["2026-11-28"], undefined);
});

test("リラクシィのフォロワー", () => {
  assert.deepEqual(rxFollowers("さら\n発行\n@sara00\n2 フォロー\n17 フォロワー\n0\nかのん\n発行\n@kanon00\n0 フォロー\n20 フォロワー"), { sara00: 17, kanon00: 20 });
});

test("記録の数え方：日本時間の日付で", () => {
  const log = "2026-11-23T15:30:00.000Z 駅ちか：投稿し、一覧で確認しました\n2026-11-24T01:00:00.000Z 駅ちか：投稿し、一覧で確認しました\n2026-11-24T02:00:00.000Z 駅ちか：止まりました";
  assert.equal(countLog(log, /投稿し/, "2026-11-24", "2026-11-30"), 2); // 23日15:30Z＝24日0:30（日本時間）
});

test("先週の月〜日", () => {
  const w = lastWeek(Date.parse("2026-11-30T09:10:00+09:00")); // 月曜
  assert.equal(w[0], "2026-11-23"); assert.equal(w[6], "2026-11-29");
});

test("エステ魂の順位：画面上のお店の名前（順位の外）は数えない", () => {
  const t = "アロマダイヤモンド\n(店舗番号:52057)\nポイント\n0\n…\n17\nOREKANO\n錦糸町・亀戸\n18\nアロマダイヤモンド\n錦糸町・亀戸";
  assert.equal(estamaRank(t), 18);
});

test("駅ちかのアクセス（画面の文字から）", async () => {
  const { ekichikaAccessText } = await import("../src/report/parse.mjs");
  const vals = [...Array(30)].map((_, i) => (i < 27 ? String(i + 1) : "-"));
  const t = ["今月", "アクセス", "総数", "日平均", "4.2", "2.1", "2.1", "114", ...vals, "プロフィール"].join("\n");
  const r = ekichikaAccessText(t, "2026-11");
  assert.equal(r["2026-11-01"], 1); assert.equal(r["2026-11-27"], 27); assert.equal(r["2026-11-28"], undefined);
});
