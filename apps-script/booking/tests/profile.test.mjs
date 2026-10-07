/* プロフィール編集・写真登録・サイト反映（Code.gs）のテスト。
 * GitHub は通信せず、メモリ上の模擬リポジトリ（API の必要な部分だけ）で動かす。
 *   実行: node apps-script/booking/tests/profile.test.mjs */
import assert from "node:assert/strict";
import { makeSheet, load, plain } from "./harness.mjs";

const TOKEN = "test-token-not-real";

/* ---- 模擬 GitHub（Git Data API・contents・workflow dispatch・raw） ---- */
function makeRepo(files = {}) {
  const repo = { files: { ...files }, head: "c0", blobs: {}, trees: {}, commits: { c0: { tree: "t0" } }, dispatches: 0, calls: [], fail422: 0, seq: 0 };
  const res = (code, body) => ({ getResponseCode: () => code, getContentText: () => (body == null ? "" : JSON.stringify(body)) });
  repo.fetch = (url, opt = {}) => {
    const method = (opt.method || "get").toUpperCase();
    repo.calls.push(method + " " + url);
    if (url.startsWith("https://raw.githubusercontent.com/naoxxx0320-del/-/main/")) {
      const path = decodeURIComponent(url.slice("https://raw.githubusercontent.com/naoxxx0320-del/-/main/".length));
      return repo.files[path] == null ? res(404, "") : { getResponseCode: () => 200, getContentText: () => repo.files[path] };
    }
    const base = "https://api.github.com/repos/naoxxx0320-del/-";
    assert.ok(url.startsWith(base), "想定外のURL: " + url);
    assert.equal(opt.headers.Authorization, "Bearer " + TOKEN);
    const path = url.slice(base.length);
    const body = opt.payload ? JSON.parse(opt.payload) : null;
    let m;
    if (method === "GET" && (m = path.match(/^\/contents\/(.+)\?ref=main$/))) {
      const p = m[1].split("/").map(decodeURIComponent).join("/");
      if (repo.files[p] == null) return res(404, { message: "Not Found" });
      return res(200, { content: Buffer.from(repo.files[p]).toString("base64").replace(/(.{60})/g, "$1\n") });
    }
    if (method === "GET" && path === "/git/ref/heads/main") return res(200, { object: { sha: repo.head } });
    if (method === "GET" && (m = path.match(/^\/git\/commits\/(\w+)$/))) return res(200, { tree: { sha: repo.commits[m[1]].tree } });
    if (method === "POST" && path === "/git/blobs") {
      const sha = "b" + ++repo.seq;
      repo.blobs[sha] = body.encoding === "base64" ? Buffer.from(body.content, "base64").toString("latin1") : body.content;
      repo.blobs[sha + ":enc"] = body.encoding;
      return res(201, { sha });
    }
    if (method === "POST" && path === "/git/trees") { const sha = "t" + ++repo.seq; repo.trees[sha] = body; return res(201, { sha }); }
    if (method === "POST" && path === "/git/commits") { const sha = "c" + ++repo.seq; repo.commits[sha] = { tree: body.tree, parents: body.parents, message: body.message }; return res(201, { sha }); }
    if (method === "PATCH" && path === "/git/refs/heads/main") {
      if (repo.fail422 > 0) { repo.fail422--; repo.head = repo.head + "x"; repo.commits[repo.head] = { tree: "t0" }; return res(422, { message: "Update is not a fast forward" }); }
      const c = repo.commits[body.sha];
      assert.equal(c.parents[0], repo.head, "古い先頭に積もうとしている");
      for (const e of repo.trees[c.tree].tree) repo.files[e.path] = repo.blobs[e.sha];
      repo.lastMessage = c.message;
      repo.head = body.sha;
      return res(200, { object: { sha: body.sha } });
    }
    if (method === "POST" && path === "/actions/workflows/deploy.yml/dispatches") { assert.deepEqual(body, { ref: "main" }); repo.dispatches++; return res(204, null); }
    if (method === "GET" && path === "/actions/workflows/deploy.yml/runs?per_page=1")
      return res(200, { workflow_runs: [{ status: "completed", conclusion: "success", run_started_at: "2026-10-07T03:00:00Z" }] });
    throw new Error("未対応: " + method + " " + path);
  };
  return repo;
}

const HEAD = ["名前", "出勤", "年齢", "T", "B", "カップ", "W", "H", "新人", "タグ", "写真", "プロフィール"];
const prof = () => makeSheet("本日の出勤", [
  HEAD,
  ["みお", "○", "23", "158", "86", "D", "57", "85", "", "ピュア;妹系", "therapist-mio-old.jpg", "やさしい"],
  ["花恋", "✖️", "", "", "", "", "", "", "", "", "", ""],
]);
const DETAILS = {
  花恋: { nameFull: "白花 かれん", age: "21", height: "160", cup: "F", stats: ["T.160", "B.88(F)", "W.58", "H.86"], tags: ["清楚", "美脚"], sns: ["https://x.example/karen"], profile: "はじめまして", extraKeep: "残す" },
};
const PHOTOS = { 花恋: "therapist-karen.jpg", みお: ["therapist-mio.jpg"] };

function setup({ token = true, files } = {}) {
  const repo = makeRepo(files ?? {
    "data/therapist-details.json": JSON.stringify(DETAILS),
    "data/photo-overrides.json": JSON.stringify(PHOTOS),
  });
  const sh = prof();
  const g = load({ 本日の出勤: sh }, token ? { GITHUB_TOKEN: TOKEN } : {}, { UrlFetchApp: { fetch: repo.fetch } });
  return { g, sh, repo };
}

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("  ✓ " + name); };
console.log("プロフィール編集 テスト");

t("detailsToSheet_: 旧設定ファイルの値をシートの列に変換（stats → T/B/カップ/W/H）", () => {
  const { g } = setup();
  const r = plain(g.detailsToSheet_(DETAILS["花恋"]));
  assert.deepEqual(r.values, { T: "160", B: "88", カップ: "F", W: "58", H: "86", 表示名: "白花 かれん", 年齢: "21", プロフィール: "はじめまして", タグ: "清楚;美脚", SNS: "https://x.example/karen" });
  assert.equal(r.consumed.extraKeep, undefined); // 知らない項目は消さない
});

t("adminProfileGet: シートの値＋旧設定ファイルの値（優先）と写真を返す", () => {
  const { g } = setup();
  const r = plain(g.adminProfileGet("花恋"));
  assert.equal(r.ok, true);
  assert.equal(r.exists, true);
  assert.equal(r.values["表示名"], "白花 かれん");
  assert.equal(r.values["カップ"], "F");
  assert.equal(r.values["出勤"], "✖️");
  assert.deepEqual(r.photos, ["therapist-karen.jpg"]);
  assert.equal(r.migrated, true);
  assert.equal(r.hasToken, true);
  assert.ok(r.fields.some((f) => f.key === "表示名"));
  const m = plain(g.adminProfileGet("みお"));
  assert.deepEqual(m.photos, ["therapist-mio.jpg"]); // 上書きファイルが優先
  assert.equal(m.values["タグ"], "ピュア;妹系");
});

t("adminProfileGet: 新規（名前なし）は空欄・出勤は ✖️ で始まる", () => {
  const { g } = setup();
  const r = plain(g.adminProfileGet(""));
  assert.equal(r.exists, false);
  assert.equal(r.values["出勤"], "✖️");
  assert.equal(r.values["年齢"], "");
  assert.deepEqual(r.photos, []);
});

t("adminProfileSave: シートに保存・列が無い項目（表示名）は列を追加・旧設定から外してコミット", () => {
  const { g, sh, repo } = setup();
  const before = plain(g.adminProfileGet("花恋"));
  const vals = { ...before.values, 年齢: "22", 表示名: "白花 かれん", プロフィール: "=HYPERLINK(\"x\")" };
  const r = plain(g.adminProfileSave({ name: "花恋", values: vals, photos: ["therapist-karen.jpg", "therapist-new.jpg"] }));
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.deployed, true);
  const head = sh.v[0];
  assert.ok(head.includes("表示名"));
  const row = sh.v[2];
  const col = (k) => row[head.indexOf(k)];
  assert.equal(col("名前"), "花恋");
  assert.equal(col("年齢"), "22");
  assert.equal(col("表示名"), "白花 かれん");
  assert.equal(col("カップ"), "F");
  assert.equal(col("写真"), "therapist-karen.jpg;therapist-new.jpg");
  assert.equal(col("プロフィール"), "=HYPERLINK(\"x\")"); // ' 付きで書き込み＝文字列のまま
  assert.equal(sh.v[1][0], "みお"); // 他の人の行はそのまま
  assert.equal(sh.v[1][head.indexOf("タグ")], "ピュア;妹系");
  // 旧設定ファイルから花恋さんの移した項目だけ外れ、他の人・未知の項目は残る
  const d = JSON.parse(repo.files["data/therapist-details.json"]);
  assert.deepEqual(d, { 花恋: { extraKeep: "残す" } });
  const q = JSON.parse(repo.files["data/photo-overrides.json"]);
  assert.deepEqual(q, { みお: ["therapist-mio.jpg"] });
  assert.match(repo.lastMessage, /花恋/);
  assert.equal(repo.dispatches, 0); // push で作り直しが始まるので dispatch は不要
});

t("adminProfileSave: 旧設定に無い人はコミットせず、作り直しを開始（dispatch）", () => {
  const { g, repo } = setup({ files: { "data/therapist-details.json": "{}", "data/photo-overrides.json": "{}" } });
  const v = plain(g.adminProfileGet("みお")).values;
  const r = plain(g.adminProfileSave({ name: "みお", values: { ...v, タグ: "癒し系" } }));
  assert.equal(r.ok, true);
  assert.equal(r.deployed, true);
  assert.equal(repo.dispatches, 1);
  assert.ok(!repo.calls.some((c) => c.includes("/git/refs")));
});

t("adminProfileSave: 新規は末尾に追加（既存の並び＝サイトのIDを変えない）・出勤は ✖️・重複は拒否", () => {
  const { g, sh } = setup();
  const r = plain(g.adminProfileSave({ name: "れな", isNew: true, values: { 年齢: "20", 新人: "○" } }));
  assert.equal(r.ok, true, r.reason);
  const last = sh.v[sh.v.length - 1];
  assert.equal(last[0], "れな");
  assert.equal(last[1], "✖️");
  assert.equal(last[2], "20");
  assert.equal(last[8], "○");
  assert.equal(sh.v[1][0], "みお");
  assert.equal(plain(g.adminProfileSave({ name: "れな", isNew: true, values: {} })).ok, false);
  assert.equal(plain(g.adminProfileSave({ name: "いない人", values: {} })).ok, false);
  assert.equal(plain(g.adminProfileSave({ name: "a;b", isNew: true, values: {} })).ok, false);
});

t("adminProfileSave: 写真名の検査（パス区切り等は拒否）", () => {
  const { g } = setup({ files: {} });
  assert.equal(plain(g.adminProfileSave({ name: "みお", values: {}, photos: ["../secret.jpg"] })).ok, false);
  assert.equal(plain(g.adminProfileSave({ name: "みお", values: {}, photos: ["a.exe"] })).ok, false);
});

t("鍵なし：旧設定に入っている人は保存を断る・入っていない人はシートだけ保存", () => {
  const { g, repo } = setup({ token: false });
  const r = plain(g.adminProfileSave({ name: "花恋", values: { 年齢: "30" } }));
  assert.equal(r.ok, false);
  assert.match(r.reason, /GITHUB_TOKEN/);
  const { g: g2, sh: sh2 } = setup({ token: false, files: { "data/therapist-details.json": "{}", "data/photo-overrides.json": "{}" } });
  const r2 = plain(g2.adminProfileSave({ name: "みお", values: { 年齢: "24" } }));
  assert.equal(r2.ok, true);
  assert.equal(r2.deployed, false);
  assert.match(r2.note, /自動更新/);
  assert.equal(sh2.v[1][2], "24");
  assert.ok(repo.calls.every((c) => c.startsWith("GET https://raw.githubusercontent.com/")));
  assert.equal(plain(g2.adminDeployNow()).ok, false);
  assert.equal(plain(g2.adminPhotoUpload({ name: "みお", dataUrl: "data:image/jpeg;base64,AAAA" })).ok, false);
});

t("adminPhotoUpload: public/ に画像を追加し、ファイル名を返す・形式違いは拒否", () => {
  const { g, repo } = setup({ files: {} });
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64");
  const r = plain(g.adminPhotoUpload({ name: "みお", dataUrl: "data:image/jpeg;base64," + jpg }));
  assert.equal(r.ok, true);
  assert.match(r.file, /^therapist-\d{14}-[a-z0-9]{1,4}\.jpg$/);
  assert.equal(Buffer.from(repo.files["public/" + r.file], "latin1").toString("base64"), jpg);
  assert.equal(plain(g.adminPhotoUpload({ dataUrl: "data:image/svg+xml;base64,PHN2Zz4=" })).ok, false);
  assert.equal(plain(g.adminPhotoUpload({ dataUrl: "data:text/html;base64,PGI+" })).ok, false);
});

t("ghCommit_: 同時更新（422）なら最新を読み直してやり直す", () => {
  const { g, repo } = setup({ files: { "data/x.json": "{}" } });
  repo.fail422 = 1;
  let reads = 0;
  const sha = g.ghCommit_("test", () => { reads++; return [{ path: "data/x.json", content: "{\"a\":1}" }]; });
  assert.ok(sha);
  assert.equal(reads, 2);
  assert.equal(repo.files["data/x.json"], "{\"a\":1}");
});

t("adminDeployNow / adminDeployStatus", () => {
  const { g, repo } = setup({ files: {} });
  assert.equal(plain(g.adminDeployNow()).ok, true);
  assert.equal(repo.dispatches, 1);
  const s = plain(g.adminDeployStatus());
  assert.equal(s.status, "completed");
  assert.equal(s.conclusion, "success");
});

t("GitHubの権限エラーは日本語で説明", () => {
  const { g } = setup({ files: {} });
  g.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 403, getContentText: () => "{}" }) };
  assert.throws(() => g.adminDeployNow(), /権限/);
});

console.log(`\n✅ 全 ${passed} 件 パス`);
