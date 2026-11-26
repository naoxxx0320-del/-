// 写メ日記の取り込み（02）：変換・照合・絞り込み（通信しない）
import test from "node:test";
import assert from "node:assert/strict";
import { toPlainText, bareName, matchTherapist, buildDiary, MAX_PER_PERSON } from "./fetch-diary.mjs";

const roster = [
  { name: "りん", nameFull: "ななお" },
  { name: "さら", nameFull: "さら" },
  { name: "かのん", nameFull: "かのん" },
];
const NOW = Date.UTC(2026, 10, 26, 14, 0); // 日本時間 11/26 23:00

const post = (o) => ({ post_type: "cast", visibility: "public", can_view_full: true, published_at: "2026-11-25 20:31:32", content: "本文", images: ["https://cdn.m-sns.net/post/post_1_1_a.webp"], ...o });

test("本文：<br /> は改行、タグは外し、文字参照を戻す", () => {
  assert.equal(toPlainText("初投稿です🌸<br />\r\n<br />\r\nよろしく&amp;ね<b>!</b>"), "初投稿です🌸\n\nよろしく&ね!");
  assert.equal(toPlainText('<script>alert(1)</script>こんにちは'), "alert(1)こんにちは");
});

test("名前の照合：02 の名前（絵文字つき）→ 在籍表の name（表示名が違う人も）", () => {
  assert.equal(bareName("さら💎"), "さら");
  assert.equal(matchTherapist({ author_name: "ななお", username: "nanao_kameido" }, roster), "りん");
  assert.equal(matchTherapist({ author_name: "かのん💎" }, roster), "かのん");
  assert.equal(matchTherapist({ author_name: "さくら" }, roster), null);
  assert.equal(matchTherapist({ author_name: "誰か", username: "x1" }, roster, { x1: "さら" }), "さら");
});

test("使うのはセラピストの公開投稿だけ。お店の投稿・限定公開・30日より古いもの・在籍表にいない人は使わない", () => {
  const api = { success: true, posts: [
    post({ id: 1, author_name: "ななお", username: "nanao_kameido" }),
    post({ id: 2, post_type: "shop", author_name: null }),
    post({ id: 3, author_name: "さら💎", visibility: "followers" }),
    post({ id: 4, author_name: "さら💎", published_at: "2026-10-20 10:00:00" }),
    post({ id: 5, author_name: "さくら" }),
    post({ id: 6, author_name: "さら💎", images: ["javascript:alert(1)", "https://evil.example/x.jpg"], content: "画像なし" }),
  ] };
  const { posts, skipped } = buildDiary(api, roster, { nowMs: NOW });
  assert.deepEqual(Object.keys(posts).sort(), ["さら", "りん"]);
  assert.equal(posts["りん"][0].id, "1");
  assert.equal(posts["りん"][0].url, "https://m-sns.net/profile/@nanao_kameido");
  assert.deepEqual(posts["さら"].map((p) => p.id), ["6"]);
  assert.deepEqual(posts["さら"][0].images, []); // 02 以外・危ないURLの画像は使わない
  assert.deepEqual(skipped, ["さくら"]);
});

test("新しい順に、1人10件まで", () => {
  const many = Array.from({ length: 14 }, (_, i) => post({ id: i + 1, author_name: "かのん", published_at: `2026-11-${String(10 + i).padStart(2, "0")} 12:00:00` }));
  const { posts } = buildDiary({ success: true, posts: many }, roster, { nowMs: NOW });
  assert.equal(posts["かのん"].length, MAX_PER_PERSON);
  assert.equal(posts["かのん"][0].id, "14");
});

test("壊れた応答でも落ちない", () => {
  assert.deepEqual(buildDiary(null, roster).posts, {});
  assert.deepEqual(buildDiary({ posts: "x" }, roster).posts, {});
});
