// ニュースの文面と配分（通信しない）
import test from "node:test";
import assert from "node:assert/strict";
import { shiftPost, offerPost, appealPost, couponPost, forwardPost, allowedFor, fitPost, pickNext, allowedSoFar, softenProfile, timeLabel, dayLabel } from "../src/news/compose.mjs";

test("時刻と日付の書き方", () => {
  assert.equal(timeLabel(15 * 60), "15:00");
  assert.equal(timeLabel(26 * 60 + 30), "翌2:30");
  assert.equal(dayLabel("2026-11-27"), "11/27(金)");
});

test("本日の出勤：開始の早い順、写メ日記の更新を書き添える。出勤がなければ出さない", () => {
  const p = shiftPost({ today: "2026-11-27", shifts: [{ name: "かのん", start: 900, end: 1290 }, { name: "さら", start: 720, end: 1080 }], diaryNames: ["さら"] });
  assert.match(p.title, /11\/27\(金\) 2名出勤/);
  assert.ok(p.body.indexOf("さら") < p.body.indexOf("かのん"));
  assert.match(p.body, /・さら　12:00〜18:00/);
  assert.match(p.body, /写メ日記を更新しました：さら/);
  assert.equal(shiftPost({ today: "2026-11-27", shifts: [] }), null);
});

test("割引：offers.json の内容だけで書く", () => {
  const p = offerPost({ id: "hayawari", name: "早割", badge: "毎日 10:00〜17:00", amount: 2000, target: "10:00〜17:00 に開始するご予約のお客様", courses: "全コース" });
  assert.equal(p.title, "【早割】毎日 10:00〜17:00 2,000円OFF");
  assert.match(p.body, /対象：10:00〜17:00 に開始するご予約のお客様/);
  assert.match(p.body, /併用はできません/);
});

test("セラピスト紹介：体の強調・使わない表現の文は外し、絵文字も外す", () => {
  const t = { name: "りん", nameFull: "ななお", tags: ["清楚系", "グラマラス", "お姉さん系"], profile: "💎清楚な雰囲気のセラピストです。\n思わず目を奪われるグラマラスな曲線美。\n丁寧な施術が好評です✨" };
  const p = appealPost({ today: "2026-11-28", therapist: t, shift: { start: 960, end: 1440 } });
  assert.equal(p.title, "【本日出勤】ななおさん 16:00〜翌0:00");
  assert.match(p.body, /#清楚系 #お姉さん系/);
  assert.doesNotMatch(p.body, /グラマ|曲線|💎|✨/);
  assert.match(p.body, /丁寧な施術が好評です/);
  assert.equal(softenProfile("胸が大きい。笑顔が素敵です。"), "笑顔が素敵です。");
});

test("エステラブには他の媒体名・順位を含む投稿を出さない。URL・使わない表現はどこにも出さない", () => {
  const p = { title: "ランキング1位獲得！", body: "全国メンズエステランキングで1位" };
  assert.equal(allowedFor("eslove", p).ok, false);
  assert.equal(allowedFor("ekichika", p).ok, true);
  assert.equal(allowedFor("esban", { title: "x", body: "https://example.com" }).ok, false);
  assert.equal(allowedFor("esban", { title: "回春コース", body: "" }).ok, false);
});

test("文字数の上限に合わせる", () => {
  const p = fitPost({ title: "あ".repeat(60), body: "い".repeat(10) + "\n" + "う".repeat(10) }, { title: 50, body: 15 });
  assert.equal([...p.title].length, 50);
  assert.equal(p.body, "い".repeat(10));
});

test("次の1件：エステ魂の新しいニュースが最優先、その後は種類を順に回す。出した key は繰り返さない", () => {
  const c = { forward: [forwardPost({ id: "9", title: "17時まで限定！", body: "本文" })], shift: shiftPost({ today: "2026-11-27", shifts: [{ name: "さら", start: 720, end: 1080 }] }), offer: [offerPost({ id: "shinki", name: "新規割", amount: 2000, target: "初めて", courses: "全コース" })], appeal: [], coupon: [couponPost({ title: "早割クーポン" })] };
  let r = pickNext(c, { site: "esban" });
  assert.equal(r.post.type, "forward");
  r = pickNext(c, { site: "esban", done: ["forward:9"], rotation: 0 });
  assert.equal(r.post.type, "offer");
  r = pickNext(c, { site: "esban", done: ["forward:9", "offer:shinki"], rotation: r.rotation });
  assert.equal(r.post.type, "coupon");
  r = pickNext(c, { site: "esban", done: ["forward:9", "offer:shinki", "coupon:早割クーポン"], rotation: r.rotation });
  assert.equal(r.post.type, "shift");
  r = pickNext(c, { site: "esban", done: ["forward:9", "offer:shinki", "coupon:早割クーポン", "shift:2026-11-27"], rotation: r.rotation });
  assert.equal(r.post.type, "shift"); // 一回りしたら出勤案内を最新の内容で出し直す
});

test("上限を 10:00〜翌5:00 に均等に配る", () => {
  assert.equal(allowedSoFar(5, 9 * 60), 0);
  assert.equal(allowedSoFar(5, 10 * 60), 1);
  assert.equal(allowedSoFar(5, 15 * 60), 2);
  assert.equal(allowedSoFar(5, 28 * 60 + 59), 5);
  assert.equal(allowedSoFar(5, 30 * 60), 5);
  assert.equal(allowedSoFar(0, 15 * 60), 0);
});
