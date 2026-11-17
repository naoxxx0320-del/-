/* セラピスト名の表示と予約URLの解決（app/_components/names.js） */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// CI の Node 20 は package.json に "type":"module" が無い .js を ESM として読めないため、
// ソースをそのまま data URL のモジュールとして読み込む（アプリと同じコードを検証する）
const src = readFileSync(new URL("../app/_components/names.js", import.meta.url), "utf8");
const { displayName, resolveTherapistKey } = await import("data:text/javascript," + encodeURIComponent(src));

const roster = [
  { name: "つばさ", nameFull: "ひなた" }, // 管理画面で表示名だけ変えた人
  { name: "さら", nameFull: "さら" },
  { name: "りん" }, // 表示名なし
  { name: "A", nameFull: "同名" },
  { name: "B", nameFull: "同名" },
];

test("表示は表示名を優先し、無ければ照合キー", () => {
  assert.equal(displayName(roster[0]), "ひなた");
  assert.equal(displayName(roster[2]), "りん");
  assert.equal(displayName(null), "");
});

test("?t= は照合キー（従来リンク）でも表示名でも同じ人に解決する", () => {
  assert.equal(resolveTherapistKey("つばさ", roster), "つばさ");
  assert.equal(resolveTherapistKey("ひなた", roster), "つばさ");
  assert.equal(resolveTherapistKey(" ひなた ", roster), "つばさ");
  assert.equal(resolveTherapistKey("りん", roster), "りん");
});

test("存在しない名前・同じ表示名が複数の場合は決めない", () => {
  assert.equal(resolveTherapistKey("いない", roster), "");
  assert.equal(resolveTherapistKey("同名", roster), "");
  assert.equal(resolveTherapistKey("", roster), "");
});
