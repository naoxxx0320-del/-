/* セラピストの完全削除（adminTherapistDelete）のテスト。
 * シート・GitHub は模擬（通信しない）。
 *   実行: node apps-script/booking/tests/delete.test.mjs */
import assert from "node:assert/strict";
import { makeSheet, load, plain } from "./harness.mjs";

const TOKEN = "test-token-not-real";
const BASE = "https://api.github.com/repos/naoxxx0320-del/-";

/* ---- 模擬 GitHub（削除に必要な API だけ） ---- */
function makeRepo(files) {
  const repo = { files: { ...files }, head: "c0", blobs: {}, trees: {}, commits: { c0: { tree: "t0" } }, seq: 0, dispatches: 0, lastMessage: "",
    history: [ // /commits?path=public の結果（新しい順）
      { sha: "u2", commit: { message: "管理画面: 写真を追加（れいこ）" }, files: [{ filename: "public/therapist-reiko-unsaved.jpg" }] },
      { sha: "u1", commit: { message: "管理画面: 写真を追加（れいこ）" }, files: [{ filename: "public/therapist-reiko-a.jpg" }] },
      { sha: "u0", commit: { message: "管理画面: 写真を追加（みお）" }, files: [{ filename: "public/therapist-mio.jpg" }] },
    ] };
  const res = (code, body) => ({ getResponseCode: () => code, getContentText: () => (body == null ? "" : JSON.stringify(body)) });
  repo.fetch = (url, opt = {}) => {
    const method = (opt.method || "get").toUpperCase();
    assert.ok(url.startsWith(BASE), "想定外のURL: " + url);
    const path = url.slice(BASE.length);
    const body = opt.payload ? JSON.parse(opt.payload) : null;
    let m;
    if (method === "GET" && (m = path.match(/^\/contents\/(.+)\?ref=main$/))) {
      const p = m[1].split("/").map(decodeURIComponent).join("/");
      if (repo.files[p] == null) return res(404, { message: "Not Found" });
      return res(200, { content: Buffer.from(repo.files[p]).toString("base64") });
    }
    if (method === "GET" && path.startsWith("/commits?path=public")) return res(200, repo.history.map((c) => ({ sha: c.sha, commit: c.commit })));
    if (method === "GET" && (m = path.match(/^\/commits\/(\w+)$/))) return res(200, { files: repo.history.find((c) => c.sha === m[1]).files });
    if (method === "GET" && path === "/git/ref/heads/main") return res(200, { object: { sha: repo.head } });
    if (method === "GET" && (m = path.match(/^\/git\/commits\/(\w+)$/))) return res(200, { tree: { sha: repo.commits[m[1]].tree } });
    if (method === "POST" && path === "/git/blobs") { const sha = "b" + ++repo.seq; repo.blobs[sha] = body.content; return res(201, { sha }); }
    if (method === "POST" && path === "/git/trees") { const sha = "t" + ++repo.seq; repo.trees[sha] = body; return res(201, { sha }); }
    if (method === "POST" && path === "/git/commits") { const sha = "c" + ++repo.seq; repo.commits[sha] = { tree: body.tree, parents: body.parents, message: body.message }; return res(201, { sha }); }
    if (method === "PATCH" && path === "/git/refs/heads/main") {
      const c = repo.commits[body.sha];
      for (const e of repo.trees[c.tree].tree) {
        if (e.sha === null) { assert.ok(repo.files[e.path] != null, "存在しないファイルを削除しようとした: " + e.path); delete repo.files[e.path]; }
        else repo.files[e.path] = repo.blobs[e.sha];
      }
      repo.lastMessage = c.message; repo.head = body.sha;
      return res(200, { object: { sha: body.sha } });
    }
    if (method === "POST" && path === "/actions/workflows/deploy.yml/dispatches") { repo.dispatches++; return res(204, null); }
    throw new Error("未対応: " + method + " " + path);
  };
  return repo;
}

const H = 3600e3;
function setup({ futureForReiko = false, token = true } = {}) {
  const now = Date.now();
  const repo = makeRepo({
    "public/therapist-reiko-a.jpg": "A", "public/therapist-reiko-b.jpg": "B", "public/therapist-reiko-unsaved.jpg": "U",
    "public/therapist-mio.jpg": "M",
    "data/photo-overrides.json": JSON.stringify({ みお: "therapist-mio.jpg", れいこ: ["therapist-reiko-b.jpg"] }),
    "data/therapist-details.json": JSON.stringify({ れいこ: { profile: "x" }, 花恋: { profile: "y" } }),
    "data/roster.json": JSON.stringify([{ id: 1, name: "みお" }, { id: 2, name: "れいこ" }]),
    "data/schedule.json": JSON.stringify({ today: "2026/10/17", days: [{ date: "2026/10/17", list: [{ name: "れいこ" }, { name: "みお" }] }] }),
  });
  const sheets = {};
  const g = load(sheets, token ? { GITHUB_TOKEN: TOKEN } : {}, { UrlFetchApp: { fetch: (...a) => repo.fetch(...a), fetchAll: (reqs) => reqs.map((r) => repo.fetch(r.url, r)) } });
  const bk = (id, name, startAt, status) => g.objToRow_({ id, source: "web", status, therapistId: name, therapistName: name, startAt, endAt: startAt + 1.5 * H, durationMin: 90, course: "90分", price: 18000, customerName: "テスト客", tel: "09000000000", email: "a@example.com", createdAt: "", updatedAt: "" });
  const ledgerRows = [
    bk("BK1", "れいこ", now - 72 * H, g.STATUS.CONFIRMED),
    bk("BK2", "みお", now - 48 * H, g.STATUS.CONFIRMED),
    bk("BK3", "れいこ", now - 24 * H, g.STATUS.CANCELLED || "cancelled"),
  ];
  if (futureForReiko) ledgerRows.push(bk("BK4", "れいこ", now + 24 * H, g.STATUS.CONFIRMED));
  sheets["予約台帳"] = makeSheet("予約台帳", [g.HEADER, ...ledgerRows]);
  sheets["予約履歴"] = makeSheet("予約履歴", [g.HISTORY_HEADER,
    ["H1", "", "BK1", "web", "作成", "", "{}"],
    ["H2", "", "BK2", "web", "作成", "", "{}"],
    ["H3", "", "SHIFT", "staff", "出勤登録 れいこ 2026/10/20", "", ""],
    ["H4", "", "SHIFT", "staff", "出勤登録 れいこさん 2026/10/20", "", ""], // 別の名前（部分一致は消さない）
    ["H5", "", "PROFILE", "staff", "セラピスト追加 れいこ", "", ""],
    ["H6", "", "RATE", "staff", "バック率 みお", "", ""],
  ]);
  sheets["精算"] = makeSheet("精算", [g.SETTLE_HEADER, ["BK1", "2026/10/14", "れいこ"], ["BK2", "2026/10/15", "みお"]]);
  sheets["バック率"] = makeSheet("バック率", [g.RATE_HEADER, ["れいこ", 60, "", ""], ["みお", 65, "", ""]]);
  sheets["出勤情報"] = makeSheet("出勤情報", [["日付", "名前", "開始", "終了"], ["2026/10/10", "れいこ", "13:00", "2:00"], ["2026/10/11", "みお", "13:00", "2:00"], ["2026/11/4", "れいこ", "13:00", "2:00"]]);
  sheets["本日の出勤"] = makeSheet("本日の出勤", [["名前", "出勤", "年齢", "写真"], ["みお", "○", "24", "therapist-mio.jpg"], ["れいこ", "✖️", "41", "therapist-reiko-a.jpg;therapist-mio.jpg"]]);
  return { g, sheets, repo };
}
const names = (sh, col = 0) => sh.v.slice(1).map((r) => r[col]);

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("  ✓ " + name); };
console.log("セラピスト削除 テスト");

t("確認の名前が一致しないと何も消さない", () => {
  const { g, sheets } = setup();
  const r = plain(g.adminTherapistDelete({ name: "れいこ", confirm: "れいこさん" }));
  assert.equal(r.ok, false);
  assert.equal(sheets["本日の出勤"].v.length, 3);
  assert.equal(sheets["予約台帳"].v.length, 4);
});

t("今日以降の予約があると削除しない（お客様への連絡漏れ防止）", () => {
  const { g, sheets } = setup({ futureForReiko: true });
  const pv = plain(g.adminTherapistDeletePreview("れいこ"));
  assert.equal(pv.ok, true);
  assert.equal(pv.future.length, 1);
  const r = plain(g.adminTherapistDelete({ name: "れいこ", confirm: "れいこ" }));
  assert.equal(r.ok, false);
  assert.match(r.reason, /今日以降の予約が 1 件/);
  assert.equal(sheets["予約台帳"].v.length, 5);
  assert.equal(sheets["本日の出勤"].v.length, 3);
});

t("確認画面：消える件数を返す（シートは変更しない）", () => {
  const { g, sheets } = setup();
  const pv = plain(g.adminTherapistDeletePreview("れいこ"));
  assert.deepEqual(pv.counts, { bookings: 2, history: 3, settles: 1, rates: 1, shifts: 2, profile: 1, photos: 2 });
  assert.deepEqual(pv.future, []);
  assert.equal(sheets["予約台帳"].v.length, 4);
});

t("削除：この人のデータだけがすべて消え、ほかの人は残る", () => {
  const { g, sheets, repo } = setup();
  const r = plain(g.adminTherapistDelete({ name: "れいこ", confirm: "れいこ" }));
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.cleanup, true);
  assert.equal(repo.head, "c0"); // この時点ではサイトは触らない（すぐ返す）
  const c = g.colIndex_();
  assert.deepEqual(names(sheets["予約台帳"], c["予約ID"]), ["BK2"]);
  assert.deepEqual(names(sheets["予約履歴"]), ["H2", "H4", "H6"]);
  assert.deepEqual(names(sheets["精算"]), ["BK2"]);
  assert.deepEqual(names(sheets["バック率"]), ["みお"]);
  assert.deepEqual(names(sheets["出勤情報"], 1), ["みお"]);
  assert.deepEqual(names(sheets["本日の出勤"]), ["みお"]);
  // 削除の記録は件数だけ（名前・お客様情報なし）
  const log = g.__history.at(-1);
  assert.equal(log[0], "THERAPIST");
  assert.ok(!JSON.stringify(log).includes("れいこ"));
  // 後片付け：この人の写真（保存しなかった写真も）は削除、共有中の写真は残す
  const cl = plain(g.adminTherapistCleanup());
  assert.equal(cl.ok, true);
  assert.equal(cl.done, true);
  assert.equal(cl.removedFiles, 3);
  assert.equal(plain(g.adminTherapistCleanup()).done, false); // 2回目は待ちが無いので何もしない
  assert.equal(repo.files["public/therapist-reiko-a.jpg"], undefined);
  assert.equal(repo.files["public/therapist-reiko-b.jpg"], undefined);
  assert.equal(repo.files["public/therapist-reiko-unsaved.jpg"], undefined);
  assert.equal(repo.files["public/therapist-mio.jpg"], "M");
  assert.deepEqual(JSON.parse(repo.files["data/photo-overrides.json"]), { みお: "therapist-mio.jpg" });
  assert.deepEqual(JSON.parse(repo.files["data/therapist-details.json"]), { 花恋: { profile: "y" } });
  assert.deepEqual(JSON.parse(repo.files["data/roster.json"]).map((x) => x.name), ["みお"]);
  assert.deepEqual(JSON.parse(repo.files["data/schedule.json"]).days[0].list.map((x) => x.name), ["みお"]);
  assert.equal(cl.deployed, true);
  assert.equal(repo.lastMessage, "管理画面: セラピストを削除"); // コミット文にも名前を残さない
});

t("後片付けが失敗しても待ちに残り、次回に続きを行える", () => {
  const { g, repo } = setup();
  assert.equal(plain(g.adminTherapistDelete({ name: "れいこ", confirm: "れいこ" })).ok, true);
  const orig = repo.fetch;
  repo.fetch = () => { throw new Error("通信エラー"); };
  assert.throws(() => g.adminTherapistCleanup());
  repo.fetch = orig;
  const cl = plain(g.adminTherapistCleanup());
  assert.equal(cl.done, true);
  assert.equal(repo.files["public/therapist-reiko-a.jpg"], undefined);
});

t("GitHubの鍵が無いときはシートだけ削除し、その旨を返す", () => {
  const { g, sheets, repo } = setup({ token: false });
  const r = plain(g.adminTherapistDelete({ name: "れいこ", confirm: "れいこ" }));
  assert.equal(r.ok, true);
  assert.match(r.note, /GITHUB_TOKEN/);
  assert.deepEqual(names(sheets["本日の出勤"]), ["みお"]);
  assert.equal(repo.files["public/therapist-reiko-a.jpg"], "A");
});

t("いない人は削除できない", () => {
  const { g } = setup();
  const r = plain(g.adminTherapistDelete({ name: "だれか", confirm: "だれか" }));
  assert.equal(r.ok, false);
});

console.log(`\n${passed} 件すべて成功`);
