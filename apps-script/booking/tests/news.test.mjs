/* お知らせ・ブログ（adminNewsList / Save / Delete / ImageUpload） */
import test from "node:test";
import assert from "node:assert/strict";
import { load, plain } from "./harness.mjs";

function setup(initial = { posts: [] }, token = "tok") {
  const ctx = load({}, {});
  let repo = JSON.parse(JSON.stringify(initial));
  const commits = [];
  ctx.ghToken_ = () => token;
  ctx.readRepoJson_ = (p) => (p === "data/news.json" ? JSON.parse(JSON.stringify(repo)) : {});
  ctx.ghCommit_ = (msg, files) => {
    commits.push({ msg, files });
    for (const f of files) if (f.path === "data/news.json") repo = JSON.parse(f.content);
    return "sha";
  };
  ctx.nowMs_ = () => Date.UTC(2026, 10, 18, 3, 0);
  ctx.Utilities.formatDate = () => "2026-11-18T12:00:00+09:00";
  return { ctx, commits, repo: () => repo };
}

const post = { date: "2026-11-18", title: "グランドオープンしました", body: "本文です。\n2行目", status: "public" };

test("新規投稿：id を付けて data/news.json に保存し、日付の新しい順に並べる", () => {
  const { ctx, commits, repo } = setup({ posts: [{ id: "20261101-aaaa", date: "2026-11-01", title: "前の記事", body: "x", status: "public" }] });
  const r = plain(ctx.adminNewsSave(post));
  assert.equal(r.ok, true, r.reason);
  assert.match(r.id, /^20261118-[a-z0-9]{1,4}$/);
  assert.equal(commits.length, 1);
  assert.deepEqual(repo().posts.map((p) => p.title), ["グランドオープンしました", "前の記事"]);
  assert.equal(repo().posts[0].updatedAt, "2026-11-18T12:00:00+09:00");
});

test("修正：同じ id を上書き（件数は増えない）・下書きにできる", () => {
  const { ctx, repo } = setup();
  const { id } = plain(ctx.adminNewsSave(post));
  const r = plain(ctx.adminNewsSave({ ...post, id, title: "直したタイトル", status: "draft" }));
  assert.equal(r.ok, true);
  assert.equal(repo().posts.length, 1);
  assert.equal(repo().posts[0].title, "直したタイトル");
  assert.equal(repo().posts[0].status, "draft");
});

test("入力の検証：タイトル・本文・日付・写真名", () => {
  const { ctx, commits } = setup();
  assert.equal(plain(ctx.adminNewsSave({ ...post, title: "" })).ok, false);
  assert.equal(plain(ctx.adminNewsSave({ ...post, body: "  " })).ok, false);
  assert.equal(plain(ctx.adminNewsSave({ ...post, date: "11/18" })).ok, false);
  assert.equal(plain(ctx.adminNewsSave({ ...post, image: "../secret.jpg" })).ok, false);
  assert.equal(plain(ctx.adminNewsSave({ ...post, id: "nope" })).ok, false);
  assert.equal(commits.length, 0);
});

test("削除・GitHubの鍵が無いときは断る", () => {
  const { ctx, repo } = setup();
  const { id } = plain(ctx.adminNewsSave(post));
  assert.equal(plain(ctx.adminNewsDelete(id)).ok, true);
  assert.equal(repo().posts.length, 0);
  assert.equal(plain(ctx.adminNewsDelete(id)).ok, false);
  const noKey = setup({ posts: [] }, "");
  assert.equal(plain(noKey.ctx.adminNewsSave(post)).ok, false);
  assert.equal(plain(noKey.ctx.adminNewsList()).ok, false);
});

test("写真：public/news-*.jpg に登録してファイル名を返す・形式違いは断る", () => {
  const { ctx, commits } = setup();
  const r = plain(ctx.adminNewsImageUpload({ dataUrl: "data:image/jpeg;base64,QUJD" }));
  assert.equal(r.ok, true);
  assert.match(r.file, /^news-.*\.jpg$/);
  assert.equal(commits[0].files[0].path, "public/" + r.file);
  assert.equal(plain(ctx.adminNewsImageUpload({ dataUrl: "data:text/html;base64,QUJD" })).ok, false);
});
