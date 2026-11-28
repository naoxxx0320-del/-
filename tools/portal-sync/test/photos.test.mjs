// ニュースに添える写真の選び方（通信しない）
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pickPhotoName, photoFile } from "../src/news/photos.mjs";

const todays = [
  { name: "ななお", start: 960 },
  { name: "さら", start: 720 },
  { name: "知らない人", start: 600 }, // 写真の登録がない人は使わない
];

test("紹介の投稿は本人の写真", () => {
  assert.equal(pickPhotoName({ type: "appeal", displayName: "ななお" }, todays, 0), "ななお");
  assert.equal(pickPhotoName({ type: "appeal", displayName: "知らない人" }, todays, 0), null);
});

test("それ以外は本日出勤の人を、出勤の早い順に投稿ごとに入れ替える", () => {
  assert.equal(pickPhotoName({ type: "shift" }, todays, 0), "さら");
  assert.equal(pickPhotoName({ type: "offer" }, todays, 1), "ななお");
  assert.equal(pickPhotoName({ type: "coupon" }, todays, 2), "さら");
  assert.equal(pickPhotoName({ type: "offer" }, [], 0), null); // 出勤なし → 写真なし
});

test("写真ファイルは選定済みの写真だけを探す", () => {
  const dir = mkdtempSync(join(tmpdir(), "ph-"));
  writeFileSync(join(dir, "therapist-20261126182654-r82f.jpg"), ""); // みかの除外した写真
  writeFileSync(join(dir, "therapist-20261126182731-17i0.jpg"), "");
  assert.equal(photoFile("みか", dir), join(dir, "therapist-20261126182731-17i0.jpg"));
  assert.equal(photoFile("ななお", dir), null);
  assert.equal(photoFile("みか", join(dir, "ない")), null);
});
