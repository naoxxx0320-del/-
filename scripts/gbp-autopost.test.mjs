/* Googleビジネスプロフィール自動投稿（apps-script/gbp-autopost.gs）の動作確認。
   Apps Script のサービスを模したもので読み込み、実際の通信はしない。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SRC = readFileSync(new URL("../apps-script/gbp-autopost.gs", import.meta.url), "utf8");
const SITE = "https://aroma-daiamond.com/";

function load({ props = {}, posts = [], live = true, hour = 17, today = "2026-11-22", api = [] } = {}) {
  const store = { ...props };
  const calls = [];
  const mails = [];
  const apiQueue = api.slice();
  const res = (code, text) => ({ getResponseCode: () => code, getContentText: () => text });
  const ctx = {
    Logger: { log: () => {} },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in store ? store[k] : null),
        setProperty: (k, v) => { store[k] = String(v); },
      }),
    },
    Utilities: {
      formatDate: (_d, _tz, fmt) => (fmt === "yyyy-MM-dd" ? today : fmt === "H" ? String(hour) : today + "T17:05:00+09:00"),
    },
    ScriptApp: { getOAuthToken: () => "TOKEN" },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    MailApp: { sendEmail: (to, subject, body) => mails.push({ to, subject, body }) },
    UrlFetchApp: {
      fetch: (url, opt = {}) => {
        calls.push({ url, opt });
        if (url.startsWith("https://raw.githubusercontent.com/")) return res(200, JSON.stringify({ posts }));
        if (url.startsWith(SITE + "news/")) {
          const id = url.slice((SITE + "news/").length).replace(/\/$/, "");
          return live ? res(200, `<link rel="canonical" href="${SITE}news/${id}/">`) : res(404, "");
        }
        if (url.includes("/localPosts")) {
          const r = apiQueue.shift() || { code: 200, json: { name: "accounts/1/locations/2/localPosts/9", state: "LIVE" } };
          return res(r.code, JSON.stringify(r.json));
        }
        return res(404, "");
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { ctx, store, calls, mails };
}

const READY = { GBP_AUTOPOST: "true", GBP_LOCATION: "accounts/1/locations/2", GBP_NOTIFY_EMAIL: "owner@example.com" };
const post = (o = {}) => ({ id: "20261122-price-total", date: "2026-11-22", title: "料金の総額", status: "public", image: "", gbp: "投稿文", ...o });
const postCalls = (calls) => calls.filter((c) => c.url.includes("/localPosts"));

test("17時以降、今日公開の記事を1回だけ投稿し、記事へのリンクを付ける", () => {
  const { ctx, store, calls, mails } = load({ props: READY, posts: [post()] });
  const r = ctx.gbpAutoPost();
  assert.equal(r.done, true);
  const sent = postCalls(calls);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, "https://mybusiness.googleapis.com/v4/accounts/1/locations/2/localPosts");
  assert.equal(sent[0].opt.headers.Authorization, "Bearer TOKEN");
  const body = JSON.parse(sent[0].opt.payload);
  assert.equal(body.summary, "投稿文");
  assert.equal(body.languageCode, "ja");
  assert.deepEqual(body.callToAction, { actionType: "LEARN_MORE", url: SITE + "news/20261122-price-total/" });
  assert.equal(body.media, undefined);
  assert.equal(JSON.parse(store.GBP_POSTED)["20261122-price-total"].state, "posted");
  assert.equal(mails.length, 1);
  // 2回目は投稿しない
  const again = load({ props: { ...READY, GBP_POSTED: store.GBP_POSTED }, posts: [post()] });
  assert.equal(again.ctx.gbpAutoPost().reason, "no_post");
  assert.equal(postCalls(again.calls).length, 0);
});

test("17時前・下書き・別の日・Google投稿文なしの記事は投稿しない", () => {
  assert.equal(load({ props: READY, posts: [post()], hour: 16 }).ctx.gbpAutoPost().reason, "before_start");
  for (const p of [post({ status: "draft" }), post({ date: "2026-11-21" }), post({ gbp: "  " })]) {
    const { ctx, calls } = load({ props: READY, posts: [p] });
    assert.equal(ctx.gbpAutoPost().reason, "no_post");
    assert.equal(postCalls(calls).length, 0);
  }
});

test("記事がまだサイトに出ていなければ投稿せず、次の回に回す", () => {
  const { ctx, calls, store } = load({ props: READY, posts: [post()], live: false });
  assert.equal(ctx.gbpAutoPost().reason, "not_live");
  assert.equal(postCalls(calls).length, 0);
  assert.equal(store.GBP_POSTED, undefined);
});

test("GBP_AUTOPOST が true でない・投稿先が未設定なら試運転（送らない）", () => {
  for (const props of [{ GBP_LOCATION: "accounts/1/locations/2" }, { GBP_AUTOPOST: "true" }, { GBP_AUTOPOST: "true", GBP_LOCATION: "locations/2" }]) {
    const { ctx, calls } = load({ props, posts: [post()] });
    const r = ctx.gbpAutoPost();
    assert.equal(r.reason, "dry_run");
    assert.equal(postCalls(calls).length, 0);
  }
  // プレビューは時刻・設定に関係なく送らない
  const pv = load({ props: READY, posts: [post()], hour: 9 });
  assert.equal(pv.ctx.gbpPreview().reason, "dry_run");
  assert.equal(postCalls(pv.calls).length, 0);
});

test("写真付きで断られたら写真なしで送り直す", () => {
  const { ctx, calls } = load({ props: READY, posts: [post({ image: "news-a.jpg" })], api: [{ code: 400, json: { error: { message: "bad media" } } }] });
  assert.equal(ctx.gbpAutoPost().done, true);
  const sent = postCalls(calls).map((c) => JSON.parse(c.opt.payload));
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0].media, [{ mediaFormat: "PHOTO", sourceUrl: SITE + "news-a.jpg" }]);
  assert.equal(sent[1].media, undefined);
});

test("失敗は記録して次の回に再挑戦し、3回失敗したら知らせてやめる", () => {
  const fail = { code: 403, json: { error: { message: "denied" } } };
  let posted;
  for (let i = 1; i <= 3; i++) {
    const { ctx, store, mails } = load({ props: { ...READY, ...(posted ? { GBP_POSTED: posted } : {}) }, posts: [post()], api: [fail] });
    const r = ctx.gbpAutoPost();
    assert.equal(r.reason, "api_error");
    posted = store.GBP_POSTED;
    assert.equal(JSON.parse(posted)["20261122-price-total"].tries, i);
    assert.equal(mails.length, i === 3 ? 1 : 0);
  }
  const after = load({ props: { ...READY, GBP_POSTED: posted }, posts: [post()] });
  assert.equal(after.ctx.gbpAutoPost().reason, "no_post");
});
