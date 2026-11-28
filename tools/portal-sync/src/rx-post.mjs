#!/usr/bin/env node
// 写メ日記：02（ゼロツー）の公開の日記を、リラクシィ（rx-sns.jp）の本人のアカウントへ転載する
//   node src/rx-post.mjs plan          … 転載する予定を表示するだけ
//   node src/rx-post.mjs run [--max n] … 古い順に転載する（1回の実行で最大 n 件、既定 4）
// 了承：02 運営（オーナーが電話で確認。リラクシィへの転載も含む）・セラピスト全員（2026-11-26）。写真・文章は本人の投稿どおり。
// しくみ：作業用ブラウザはリラクシィに店舗アカウントでログインしている前提。
//   セラピストの日記 → 店舗の「所属一覧」の「このセラピストとしてログイン」で本人のタブを開き、そのタブで投稿して閉じる
//   （本人のログインはタブごと。店舗のログインは切れない）。お店の日記 → 店舗アカウントのまま投稿。
//   公開範囲が限られた日記（フォロワー限定など）・動画の日記は転載しない。本文は330字まで（超えるときは文の切れ目で切る）。
//   6時間より前の日記は、先頭に「11/24の日記より」と元の日付を入れる（その日だけの内容が今日の情報に見えないように）。
//   投稿の前に本人のページを読み、同じ本文がすでにあれば投稿しない（二重投稿を防ぐ）。
// 記録：out/rx-post-state.json（転載した 02 の投稿番号）、out/rx-post-log.txt
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSource } from "./source.mjs";
import { fetchDiary, imageAsJpeg } from "./diary-post.mjs";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(HERE, "..", "..");
const OUT = join(HERE, "out");
const STATE = join(OUT, "rx-post-state.json");
export const SHOP = "aromadiamond";
// 在籍表の表示名 → リラクシィのアカウント（店舗が発行したもの）。config.local.json の rx.accounts で足せる
export const ACCOUNTS = { さら: "sara00", かのん: "kanon00", ななお: "nanao00" };
export const MAX_TEXT = 330;
const BACKLOG_DAYS = 30;

const log = (s) => { console.log(s); mkdirSync(OUT, { recursive: true, mode: 0o700 }); appendFileSync(join(OUT, "rx-post-log.txt"), `${new Date().toISOString()} ${s}\n`); };
const readJSON = (p, fb) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fb; } };
const atMs = (at) => Date.parse(String(at).replace(" ", "T").slice(0, 16) + ":00+09:00");
const norm = (t) => String(t || "").replace(/\s+/g, "");

/** 330字に収める：超えるときは最後の文の切れ目（。！？改行）で切って「…」 */
export function fitText(text, max = MAX_TEXT) {
  const s = String(text || "").trim();
  if ([...s].length <= max) return s;
  const head = [...s].slice(0, max - 1).join("");
  const cut = Math.max(head.lastIndexOf("。"), head.lastIndexOf("！"), head.lastIndexOf("？"), head.lastIndexOf("\n"));
  return (cut > max * 0.6 ? head.slice(0, cut + 1) : head).trimEnd() + "…";
}
/** 投稿する本文。6時間より前の日記は、元の日付を先頭に入れる（「本日出勤」などが今日の情報に見えないように） */
export function composeText(d, nowMs = Date.now()) {
  const ms = atMs(d.at);
  const old = Number.isFinite(ms) && nowMs - ms > 6 * 3600e3;
  const m = String(d.at).match(/^\d{4}-(\d{2})-(\d{2})/);
  return fitText(old && m ? `${+m[1]}/${+m[2]}の日記より\n\n${String(d.text || "").trim()}` : d.text);
}
/** 本人のページで同じ日記があるかを見るための目印（先頭の20字・空白なし） */
export const mark = (text) => [...norm(fitText(text))].slice(0, 20).join("");

/** お店の日記（02 の店舗の投稿のうち公開のもの） */
async function fetchShopPosts(shopId) {
  const { toPlainText } = await import(join(REPO, "scripts", "fetch-diary.mjs"));
  const res = await fetch(`https://m-sns.net/api/shop-timeline.php?shop_id=${encodeURIComponent(shopId)}&limit=50`, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`02 から取得できませんでした（HTTP ${res.status}）`);
  const api = await res.json();
  return (Array.isArray(api.posts) ? api.posts : [])
    .filter((p) => p && p.post_type === "shop" && p.visibility === "public" && p.can_view_full !== false && !p.video_path)
    .map((p) => {
      const list = Array.isArray(p.images) && p.images.length ? p.images : [p.image1, p.image2, p.image3];
      return {
        id: String(p.id), at: String(p.published_at || p.created_at).slice(0, 16), text: toPlainText(p.content),
        images: list.filter((u) => typeof u === "string" && /^https:\/\/[a-z0-9.-]+\.(m-sns\.net|cloudfront\.net)\//i.test(u)).slice(0, 4),
        disp: "お店", handle: SHOP,
      };
    })
    .filter((d) => d.text || d.images.length);
}

/** 本人のタブを開く（店舗の所属一覧の「このセラピストとしてログイン」）。お店のときは店舗のままのタブ */
async function openAs(ctx, handle) {
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  if (handle === SHOP) {
    await page.goto("https://rx-sns.jp/", { waitUntil: "load" }); await page.waitForTimeout(2500);
    return page;
  }
  try {
    await page.goto(`https://rx-sns.jp/u/${SHOP}/therapists`, { waitUntil: "load" }); await page.waitForTimeout(2500);
    const row = page.locator(`xpath=//a[@href='/u/${handle}']/ancestor::*[.//button[@title='このセラピストとしてログイン']][1]`);
    const btn = row.locator("button[title='このセラピストとしてログイン']");
    if ((await btn.count()) !== 1) throw new Error(`所属一覧に @${handle} の「このセラピストとしてログイン」が見つかりません`);
    const [tab] = await Promise.all([ctx.waitForEvent("page", { timeout: 20000 }), btn.click()]);
    tab.on("dialog", (d) => d.dismiss().catch(() => {}));
    await tab.waitForLoadState("load").catch(() => {});
    await tab.waitForTimeout(3000);
    return tab;
  } finally { await page.close().catch(() => {}); }
}
/** そのタブが誰としてログインしているか（左のメニューの「プロフィール」） */
export const whoAmI = (tab) => tab.evaluate(() => {
  const a = [...document.querySelectorAll("a[href^='/u/']")].find((x) => /プロフィール/.test(x.textContent));
  return a ? a.getAttribute("href").replace(/^\/u\//, "") : null;
});
/** 運営からのお知らせの小窓が出ていたら「閉じる」を押す（中のリンク・申請は押さない） */
async function closePopups(tab) {
  for (let i = 0; i < 5; i++) {
    const close = tab.locator("[data-testid=announcement-popup-close], [data-testid=announcement-popup-dismiss]").filter({ visible: true });
    if (!(await close.count())) return;
    await close.first().click().catch(() => {});
    await tab.waitForTimeout(1200);
  }
}
async function profileHas(tab, handle, text) {
  await tab.goto(`https://rx-sns.jp/u/${handle}`, { waitUntil: "load" }); await tab.waitForTimeout(3000);
  return norm(await tab.evaluate(() => document.body.innerText)).includes(mark(text));
}

/** 本人（または店舗）として1件投稿する。d = { handle, post（本文）, images（02 の画像URL）?, files（手元の写真のパス）?, id? } */
export async function postAsRelaxi(ctx, page, d) { return postOne(ctx, page, { images: [], ...d }); }
async function postOne(ctx, page, d) {
  const tab = await openAs(ctx, d.handle);
  try {
    const me = await whoAmI(tab);
    if (me !== d.handle) throw new Error(`@${d.handle} としてログインできませんでした（今は @${me || "?"}）。店舗アカウントでログインしているか確かめてください`);
    if (await profileHas(tab, d.handle, d.post)) return { ok: true, already: true };
    await tab.goto("https://rx-sns.jp/", { waitUntil: "load" }); await tab.waitForTimeout(2500);
    await closePopups(tab);
    const open = tab.locator("button", { hasText: /^投稿する$/ }).first();
    if (!(await open.count())) throw new Error("「投稿する」が見つかりません");
    await open.click(); await tab.waitForTimeout(1500);
    const dlg = tab.locator("[role=dialog]").filter({ has: tab.locator("textarea") }).last();
    const box = dlg.locator("textarea");
    if ((await box.count()) !== 1) throw new Error("投稿の入力欄が見つかりません");
    await box.fill(d.post); await tab.waitForTimeout(500);
    if (d.files && d.files.length) {
      const inp = tab.locator("input[type=file][data-testid=image-file-input]");
      if ((await inp.count()) < 1) throw new Error("写真の添付欄が見つかりません");
      await inp.first().setInputFiles(d.files);
      await tab.waitForTimeout(3000 + 1500 * d.files.length);
    } else if (d.images.length) {
      const bufs = [];
      for (const [i, u] of d.images.entries()) { const b = await imageAsJpeg(page, u); if (!b) throw new Error("02 の写真を読めませんでした"); bufs.push({ name: `diary-${d.id}-${i + 1}.jpg`, mimeType: "image/jpeg", buffer: b }); }
      const inp = tab.locator("input[type=file][data-testid=image-file-input]");
      if ((await inp.count()) < 1) throw new Error("写真の添付欄が見つかりません");
      await inp.first().setInputFiles(bufs);
      await tab.waitForTimeout(3000 + 1500 * bufs.length);
    }
    const send = dlg.locator("button[aria-label='投稿']");
    if ((await send.count()) !== 1) throw new Error("「投稿」ボタンが見つかりません");
    if (await send.isDisabled()) throw new Error("「投稿」ボタンが押せない状態です（写真の読み込み中など）");
    await send.click();
    await tab.waitForTimeout(5000);
    return { ok: await profileHas(tab, d.handle, d.post), already: false };
  } finally { await tab.close().catch(() => {}); }
}

async function main() {
  const cmd = process.argv[2] || "plan";
  const max = Number(process.argv[process.argv.indexOf("--max") + 1]) || 4;
  const config = JSON.parse(readFileSync(join(HERE, "config.local.json"), "utf8"));
  const accounts = { ...ACCOUNTS, ...((config.rx && config.rx.accounts) || {}) };
  const state = readJSON(STATE, { posted: [], noAccount: [] });
  const { roster } = await loadSource(config);
  const conf = readJSON(join(REPO, "data", "diary-config.json"), {});
  const cast = (await fetchDiary(roster)).map((d) => ({ ...d, handle: accounts[d.disp] || null }));
  const shop = await fetchShopPosts(conf.shopId).catch((e) => { log(`お店の日記を読めませんでした：${e.message}`); return []; });
  const cut = Date.now() - BACKLOG_DAYS * 86400e3;
  const all = [...cast, ...shop].filter((d) => atMs(d.at) >= cut).sort((a, b) => (a.at < b.at ? -1 : 1));
  const posted = new Set(state.posted);
  const todo = all.filter((d) => !posted.has(d.id) && d.handle).map((d) => ({ ...d, post: composeText(d) }));
  const noAcc = [...new Set(all.filter((d) => !d.handle).map((d) => d.disp))];
  if (cmd === "plan") {
    console.log(`リラクシィ 写メ日記：転載予定 ${todo.length}件${noAcc.length ? `（アカウントがないため転載しない人：${noAcc.join("・")}）` : ""}`);
    for (const d of todo) console.log(`  ${d.at} ${d.disp} → @${d.handle}：${[...d.post.replace(/\s+/g, " ")].slice(0, 34).join("")}（写真 ${d.images.length}枚・${[...d.post].length}字）`);
    return;
  }
  if (cmd !== "run") throw new Error("使い方：node src/rx-post.mjs plan | run [--max n]");
  for (const n of noAcc) if (!state.noAccount.includes(n)) { state.noAccount.push(n); log(`リラクシィ 写メ日記：${n}さんはリラクシィのアカウントがないため転載しません（店舗の「アカウント発行」で作り、src/rx-post.mjs か config.local.json の rx.accounts に足してください）`); }
  if (!todo.length) { console.log("リラクシィ 写メ日記：新しい日記はありません"); return; }
  // 同時に2つ動かない（二重投稿を防ぐ）。40分より古い印は、止まったものとして消す
  const LOCK = join(OUT, "rx-post.lock");
  if (existsSync(LOCK) && Date.now() - statSync(LOCK).mtimeMs < 40 * 60e3) { console.log("リラクシィ 写メ日記：ほかの転載が動いているため、次の回にします"); return; }
  mkdirSync(OUT, { recursive: true, mode: 0o700 }); writeFileSync(LOCK, String(process.pid));
  const { chromium } = await import("playwright");
  const b = await chromium.connectOverCDP(config.browserCdpUrl || "http://127.0.0.1:9333", { timeout: 5000 }).catch(() => null);
  if (!b) { try { unlinkSync(LOCK); } catch {} throw new Error("作業用ブラウザが開いていません（node src/browser.mjs で開いてください）"); }
  const ctx = b.contexts()[0];
  const page = await ctx.newPage();
  const save = () => { mkdirSync(OUT, { recursive: true, mode: 0o700 }); writeFileSync(STATE, JSON.stringify(state, null, 1)); };
  try {
    // 店舗アカウントでログインしているか
    await page.goto("https://rx-sns.jp/", { waitUntil: "load" }); await page.waitForTimeout(2500);
    const me = await whoAmI(page);
    if (me !== SHOP) throw new Error(`リラクシィに店舗アカウント（@${SHOP}）でログインしていません（今は ${me ? "@" + me : "ログインなし"}）`);
    for (const d of todo.slice(0, max)) {
      const label = `${d.disp}（@${d.handle}）「${[...d.text.replace(/\s+/g, " ")].slice(0, 20).join("")}」`;
      try {
        const r = await postOne(ctx, page, d);
        if (r.ok) { state.posted.push(d.id); save(); log(`リラクシィ 写メ日記：${r.already ? "すでに載っていたため記録だけしました" : "転載し、本人のページで確認しました"}：${label}（写真 ${d.images.length}枚）`); }
        else log(`リラクシィ 写メ日記：投稿の操作はしましたが、本人のページで確認できません（次の回で確かめます）：${label}`);
      } catch (e) { log(`リラクシィ 写メ日記：止まりました（${label}：${e.message}）`); process.exitCode = 1; break; }
    }
  } finally { save(); try { unlinkSync(LOCK); } catch {} await page.close().catch(() => {}); await b.close().catch(() => {}); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { log("リラクシィ 写メ日記：止まりました：" + e.message); process.exitCode = 1; });
