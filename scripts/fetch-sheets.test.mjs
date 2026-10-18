// fetch-sheets の見出し判定のテスト（node --test scripts/fetch-sheets.test.mjs）
import test from "node:test";
import assert from "node:assert/strict";
import { withSingleHeader, toObjects, buildRoster } from "./fetch-sheets.mjs";

const BASE = "https://docs.google.com/spreadsheets/d/ID/gviz/tq?tqx=out:csv&sheet=%E6%9C%AC";

test("gviz の URL には headers=1 を付けて見出しを1行目に固定する", () => {
  assert.equal(withSingleHeader(BASE), BASE + "&headers=1");
  assert.equal(withSingleHeader(BASE + "&headers=1"), BASE + "&headers=1"); // 二重に付けない
  assert.equal(withSingleHeader(BASE + "&headers=0"), BASE + "&headers=0"); // 明示指定は尊重
  const pub = "https://docs.google.com/spreadsheets/d/e/X/pub?output=csv";
  assert.equal(withSingleHeader(pub), pub); // gviz 以外は変更しない
});

test("見出しが1行目にあれば、新しく追加した人も名簿に入る", () => {
  const csv = ["名前,出勤,年齢,T,写真", "みお,○,24,158,therapist-mio.jpg", "れいこ,✖️,41,162,a.jpg;b.jpg"].join("\n");
  const r = buildRoster(toObjects(csv, "スケジュール"));
  assert.deepEqual(r.map((t) => t.name), ["みお", "れいこ"]);
  assert.equal(r[1].photo, "a.jpg");
  assert.deepEqual(r[1].photos, ["a.jpg", "b.jpg"]);
});

test("目印の列（スケジュール）が無くても「名前」の行を見出しとして使う", () => {
  const csv = ["本日の出勤（メモ行）", "名前,年齢,写真", "れいこ,41,a.jpg"].join("\n");
  const r = buildRoster(toObjects(csv, "スケジュール"));
  assert.deepEqual(r.map((t) => t.name), ["れいこ"]);
});

test("（参考）見出しが連結された CSV では名簿が空になる＝headers=1 が必要な理由", () => {
  const merged = ["名前 みお,出勤 ○,年齢 24", "れいこ,✖️,41"].join("\n");
  assert.equal(buildRoster(toObjects(merged, "スケジュール")).length, 0);
});

test("プロフィール（質問と回答）：入力のある項目だけを決まった順で出す", async () => {
  const { PROFILE_QA_KEYS } = await import("./fetch-sheets.mjs");
  const csv = ["名前,メッセージ,血液型,出身地,趣味", 'れいこ,"よろしく\nお願いします",A,,旅行', "みお,,,,"].join("\n");
  const r = buildRoster(toObjects(csv, "スケジュール"));
  assert.deepEqual(r[0].qa, [
    { q: "血液型", a: "A" },
    { q: "趣味", a: "旅行" },
    { q: "メッセージ", a: "よろしく\nお願いします" },
  ]);
  assert.equal(r[1].qa, undefined); // 全部空欄なら欄ごと出さない
  assert.equal(PROFILE_QA_KEYS.length, 9);
});

test("表示順：数字（全角も可）を rank にし、空欄・数字以外は付けない", () => {
  const csv = ["名前,表示順", "みお,2", "れいこ,１", "花恋,", "さき,あとで"].join("\n");
  const r = buildRoster(toObjects(csv, "スケジュール"));
  assert.deepEqual(r.map((t) => t.rank), [2, 1, undefined, undefined]);
});
