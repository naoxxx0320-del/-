/* LINE 予約ボット（apps-script/line-booking.gs）のテスト。
 * LINE・スプレッドシート・予約管理APIを模擬して、会話の流れとメッセージの形（LINEの上限）を確認する。
 *   実行: node apps-script/booking/tests/line-bot.test.mjs */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "..", "line-booking.gs"), "utf8");

const NOW = Date.UTC(2026, 9, 8, 3, 0); // 2026/10/8 12:00 JST
const sheet = (rows) => ({ getDataRange: () => ({ getValues: () => rows }) });

function boot({ busy = [], bookingResult = { ok: true, id: "BK1" } } = {}) {
  const replies = [], posts = [];
  const calls = { sheet: 0, avail: 0 };
  const cache = new Map();
  const props = { LINE_CHANNEL_ACCESS_TOKEN: "x", SHEET_ID: "S", BOOKING_API_URL: "https://api.example/exec", PROXY_SHARED_SECRET: "sec" };
  const sheets = {
    出勤情報: sheet([
      ["日付", "ラベル", "エリア", "名前", "出勤時間", "開始", "終了", "ステータス", "出勤", "案内時刻", "並び"],
      ["2026/10/7", "", "亀戸", "あやか", "", "18:00", "2:00", "空きあり", "○", "", ""],
      ["2026/10/8", "", "亀戸", "みお", "", "13:00", "2:00", "空きあり", "○", "", "2"],
      ["2026/10/8", "", "亀戸", "花恋", "", "16:00", "3:00", "残りわずか", "○", "", "1"],
      ["2026/10/8", "", "亀戸", "れな", "", "13:00", "2:00", "空きあり", "✖️", "", ""],
      ["2026/10/9", "", "亀戸", "ゆな", "", "13:00", "22:00", "空きあり", "○", "", ""],
    ]),
    本日の出勤: sheet([
      ["名前", "年齢", "T", "カップ", "タグ", "写真"],
      ["みお", "23", "158", "D", "癒し系;笑顔", "therapist-mio.jpg"],
      ["花恋", "21", "160", "F", "", ""],
    ]),
  };
  class FixedDate extends Date {
    constructor(...a) { super(...(a.length ? a : [NOW])); }
    static now() { return NOW; }
  }
  const ctx = {
    console: { log() {}, error: console.error }, Date: FixedDate, JSON, Math, Number, String, Object, Array, encodeURIComponent, decodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null }) },
    SpreadsheetApp: { openById: () => { calls.sheet++; return { getSheetByName: (n) => sheets[n] || null }; } },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }) },
    Utilities: { formatDate: () => "", getUuid: () => "u" },
    ContentService: { createTextOutput: (s) => s },
    Logger: { log: () => {} },
    UrlFetchApp: {
      fetchAll: (reqs) => reqs.map((r) => ctx.UrlFetchApp.fetch(r.url, r)),
      fetch: (url, opt = {}) => {
        const res = (code, body) => ({ getResponseCode: () => code, getContentText: () => (typeof body === "string" ? body : JSON.stringify(body)) });
        if (url.includes("/message/reply")) { replies.push(JSON.parse(opt.payload).messages); return res(200, {}); }
        if (url.includes("/bot/profile/")) return res(200, { displayName: "ゆうた" });
        if (url.includes("raw.githubusercontent.com")) return res(200, { 花恋: "therapist-karen.jpg" });
        if (url.startsWith("https://api.example/exec?action=availability")) {
          calls.avail++;
          const d = decodeURIComponent(url.split("date=")[1]);
          return res(200, { ok: true, busy: busy.filter((b) => b.d === d).map((b) => ({ th: b.th, s: b.s, e: b.e, st: "confirmed" })) });
        }
        if (url === "https://api.example/exec" && opt.method === "post") { posts.push(JSON.parse(opt.payload)); return res(200, bookingResult); }
        throw new Error("unexpected fetch " + url);
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const ev = (o) => vm.runInContext("handleEvent", ctx)(Object.assign({ replyToken: "r", source: { userId: "U1" } }, o));
  return {
    ctx, replies, posts, calls,
    pb: (data) => { ev({ type: "postback", postback: { data } }); return replies[replies.length - 1]; },
    say: (text) => { ev({ type: "message", message: { type: "text", text } }); return replies[replies.length - 1]; },
    follow: () => { ev({ type: "follow" }); return replies[replies.length - 1]; },
    state: () => JSON.parse(cache.get("st_U1") || "null"),
  };
}
const jst = (y, m, d, h, mi) => Date.UTC(y, m - 1, d, h - 9, mi);

/* LINE の上限チェック */
function walk(node, fn) {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, fn));
  if (node && typeof node === "object") { fn(node); Object.values(node).forEach((v) => walk(v, fn)); }
}
function checkLimits(msgs) {
  assert.ok(msgs.length >= 1 && msgs.length <= 5, "1回の返信は5件まで");
  for (const m of msgs) {
    if (m.type === "text") { assert.ok(m.text.length > 0 && m.text.length <= 5000); continue; }
    assert.equal(m.type, "flex");
    assert.ok(m.altText && m.altText.length <= 400, "altText");
    if (m.contents.type === "carousel") assert.ok(m.contents.contents.length <= 12, "カルーセルは12枚まで");
    assert.ok(JSON.stringify(m.contents).length < 30000, "サイズ");
    walk(m.contents, (n) => {
      if (n.type === "text") assert.ok(String(n.text).length > 0, "空のテキスト");
      if (n.type === "box") assert.ok(Array.isArray(n.contents) && n.contents.length > 0, "空のbox");
      if (n.action) {
        assert.ok(n.action.label.length <= 40, "ボタン文字数: " + n.action.label);
        if (n.action.type === "postback") {
          assert.ok(n.action.data.length <= 300, "postback data");
          assert.ok((n.action.displayText || "").length <= 300);
        }
      }
      if (n.type === "image") assert.match(n.url, /^https:\/\//);
    });
  }
}
const texts = (msgs) => { const out = []; walk(msgs, (n) => { if (n.type === "text") out.push(n.text); if (n.action) out.push("[" + n.action.label + "]"); }); return out.join("\n"); };
const buttons = (msgs) => { const out = []; walk(msgs, (n) => { if (n.action && n.action.type === "postback") out.push(n.action); }); return out; };

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("  ✓ " + name); };
console.log("LINE予約ボット テスト");

t("友だち追加・メニューはカードと大きいボタン", () => {
  const b = boot();
  const m = b.follow();
  checkLimits(m);
  assert.match(texts(m), /\[📅 予約する\]/);
  assert.match(texts(m), /\[👩 本日の出勤\]/);
});

t("予約の流れ：日付 → 写真カード → 空き時間だけ → 入るコース → お名前 → 電話 → 確認 → 確定", () => {
  const b = boot({ busy: [{ d: "2026/10/8", th: "みお", s: jst(2026, 10, 8, 14, 0), e: jst(2026, 10, 8, 15, 30) }] });
  let m = b.pb("a=start");
  checkLimits(m);
  const tx = texts(m);
  assert.match(tx, /STEP 1 \/ 6/);
  assert.match(tx, /\[10\/8\(木\)　出勤2名\]/); // ラベル空でも曜日つき・休み（✖️）は数えない
  assert.match(tx, /\[10\/9\(金\)　出勤1名\]/);
  assert.doesNotMatch(tx, /10\/7/); // 過去日は出ない

  m = b.pb("a=date&v=2026%2F10%2F8&l=10%2F8(%E6%9C%A8)");
  checkLimits(m);
  const car = m[0].contents.contents;
  assert.equal(car[0].body.contents[0].text, "花恋"); // 並び順
  assert.equal(car[0].hero.url, "https://aroma-daiamond.com/therapist-karen.jpg"); // サイトの写真上書きから
  assert.equal(car[1].hero.url, "https://aroma-daiamond.com/therapist-mio.jpg");
  assert.match(texts(car[1]), /23歳 \/ T158 \/ Dカップ/);
  assert.match(texts(car[1]), /13:00〜翌2:00/);
  assert.match(texts(car[car.length - 1]), /おまかせ/);
  assert.match(texts(m[1]), /\[◀ 戻る\]/);

  m = b.pb("a=th&v=" + encodeURIComponent("みお"));
  checkLimits(m);
  const times = buttons(m).filter((a) => a.data.startsWith("a=time")).map((a) => a.label);
  assert.ok(times.includes("13:00")); // 13:00〜14:00 は入る
  assert.ok(!times.includes("13:30") && !times.includes("14:00") && !times.includes("15:00")); // 予約と重なる
  assert.ok(times.includes("15:30") && times.includes("翌1:00"));
  assert.ok(!times.includes("翌1:30")); // 60分が出勤終了を超える
  assert.ok(!times.includes("12:30"));

  m = b.pb("a=time&v=" + encodeURIComponent("13:00"));
  const courses = buttons(m).filter((a) => a.data.startsWith("a=course")).map((a) => a.label);
  assert.deepEqual(courses, ["60分コース　¥13,000"]); // 14:00 から予約があるので60分だけ

  m = b.pb("a=back");
  m = b.pb("a=time&v=" + encodeURIComponent("翌0:00"));
  const c2 = buttons(m).filter((a) => a.data.startsWith("a=course")).map((a) => a.label);
  assert.deepEqual(c2, ["60分コース　¥13,000", "70分あおむけコース　¥18,000", "90分コース　¥18,000", "120分コース　¥23,000"]); // 翌2:00 終了まで2時間 → 150分は入らない
  m = b.pb("a=back");
  m = b.pb("a=time&v=" + encodeURIComponent("15:30"));
  const c3 = buttons(m).filter((a) => a.data.startsWith("a=course")).map((a) => a.label);
  assert.equal(c3.length, 5); // 本指名なので150分も

  m = b.pb("a=course&v=2"); // 90分
  checkLimits(m);
  assert.match(texts(m), /STEP 5 \/ 6/);
  assert.match(texts(m), /\[「ゆうた」で登録\]/);
  m = b.say("田中");
  assert.match(texts(m), /STEP 6 \/ 6/);
  m = b.say("０９０ー１２３４ー５６７８"); // 全角
  checkLimits(m);
  const ctx = texts(m);
  assert.match(ctx, /ご予約内容の確認/);
  assert.match(ctx, /10\/8\(木\)　15:30〜/);
  assert.match(ctx, /09012345678/);
  m = b.pb("a=confirm");
  checkLimits(m);
  assert.match(m[0].altText, /ご予約が確定しました/);
  assert.equal(b.posts.length, 1);
  assert.equal(b.posts[0].therapistName, "みお");
  assert.equal(b.posts[0].timeLabel, "15:30");
  assert.equal(b.posts[0].course, "90分コース");
  assert.equal(b.posts[0].tel, "09012345678");
  assert.equal(b.state(), null);
});

t("戻る：コース → 時間 → セラピスト → 日付", () => {
  const b = boot();
  b.pb("a=start");
  b.pb("a=date&v=2026%2F10%2F9");
  b.pb("a=th&v=" + encodeURIComponent("ゆな"));
  b.pb("a=time&v=14%3A00");
  assert.equal(b.state().step, "course");
  let m = b.pb("a=back");
  assert.equal(b.state().step, "time");
  assert.match(texts(m), /開始時間/);
  m = b.pb("a=back");
  assert.equal(b.state().step, "th");
  m = b.pb("a=back");
  assert.match(texts(m), /STEP 1 \/ 6/);
});

t("時間の直接入力：深夜の「1:00」は「翌1:00」・空いていない時間は選び直し", () => {
  const b = boot();
  b.pb("a=start");
  b.pb("a=date&v=2026%2F10%2F8");
  b.pb("a=th&v=" + encodeURIComponent("みお"));
  let m = b.say("1:00");
  assert.equal(b.state().time, "翌1:00");
  b.pb("a=back");
  m = b.say("12:00");
  assert.match(texts(m), /ご予約いただけません/);
  assert.equal(b.state().step, "time");
});

t("今日は今から30分後以降だけ・おまかせは150分なし", () => {
  const b = boot();
  b.pb("a=start");
  b.pb("a=date&v=2026%2F10%2F8");
  let m = b.pb("a=th&v=" + encodeURIComponent("おまかせ"));
  const times = buttons(m).filter((a) => a.data.startsWith("a=time")).map((a) => a.label);
  assert.equal(times[0], "13:00"); // 12:00 現在 → 12:30 以降、出勤は13:00から
  m = b.pb("a=time&v=13%3A00");
  const courses = buttons(m).filter((a) => a.data.startsWith("a=course")).map((a) => a.label);
  assert.ok(!courses.some((c) => c.includes("150分")));
});

t("満員のセラピストは「満員」表示・予約できない", () => {
  const b = boot({ busy: [{ d: "2026/10/9", th: "ゆな", s: jst(2026, 10, 9, 13, 0), e: jst(2026, 10, 9, 22, 0) }] });
  b.pb("a=start");
  const m = b.pb("a=date&v=2026%2F10%2F9");
  assert.match(texts(m[0].contents.contents[0]), /満員/);
  assert.ok(!buttons(m[0].contents.contents[0]).length);
});

t("台帳で断られたら時間の選び直し（完了と表示しない）", () => {
  const b = boot({ bookingResult: { ok: false, reason: "その時間は埋まりました。" } });
  b.pb("a=start");
  b.pb("a=date&v=2026%2F10%2F9");
  b.pb("a=th&v=" + encodeURIComponent("ゆな"));
  b.pb("a=time&v=14%3A00");
  b.pb("a=course&v=0");
  b.say("田中");
  b.say("09012345678");
  const m = b.pb("a=confirm");
  assert.match(texts(m), /その時間は埋まりました/);
  assert.doesNotMatch(texts(m), /確定しました/);
  assert.equal(b.state().step, "time");
});

t("本日の出勤：写真カードから「この人で予約」→ 時間へ", () => {
  const b = boot();
  let m = b.say("本日の出勤");
  checkLimits(m);
  assert.match(m[0].text, /10\/8\(木\) 本日の出勤】2名/);
  const pick = buttons(m[1]).find((a) => a.label === "この人で予約");
  m = b.pb(pick.data);
  assert.equal(b.state().step, "time");
  assert.match(texts(m), /開始時間/);
});

t("「やめる」でいつでも中止", () => {
  const b = boot();
  b.pb("a=start");
  b.pb("a=date&v=2026%2F10%2F9");
  const m = b.say("やめる");
  assert.match(texts(m), /やめました/);
  assert.equal(b.state(), null);
});

t("速さ：次のステップではシート・予約APIを読み直さない（キャッシュ）・確定後は空きを取り直す", () => {
  const b = boot();
  b.pb("a=start");
  b.pb("a=date&v=2026%2F10%2F9");
  const s0 = { ...b.calls };
  b.pb("a=th&v=" + encodeURIComponent("ゆな"));
  b.pb("a=time&v=14%3A00");
  b.pb("a=course&v=0");
  assert.deepEqual({ ...b.calls }, s0); // 時間・コースの選択で読み込みゼロ
  b.say("田中");
  b.say("09012345678");
  b.pb("a=confirm");
  b.pb("a=start");
  b.pb("a=date&v=2026%2F10%2F9");
  assert.equal(b.calls.avail, s0.avail + 2); // 予約後は空き状況を取り直す（その日＋翌日）
});

console.log(`\n✅ 全 ${passed} 件 パス`);
