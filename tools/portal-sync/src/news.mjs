#!/usr/bin/env node
// ニュースの自動投稿（各サイトの上限まで、10:00〜翌5:00 に均等に配る）
//   node src/news.mjs plan [--site s]        … 次に出す内容を表示するだけ（書き込まない）
//   node src/news.mjs run  [--site s] [--now] … 時間が来ているサイトに1件ずつ投稿する（--now は配分を無視して今すぐ1件）
//   サイト：estama / ekichika / esban / eslove / esthe-ranking
// 内容：エステ魂にお店が書いた新しいニュースの転載（他4サイト）／本日の出勤（写メ日記の更新を書き添える）／
//       割引（data/offers.json）／本日出勤のセラピストの紹介／そのサイトのクーポン（読めるサイトだけ）
// 記録：out/news-state.json（その日に出した内容・回数）、out/news-log.txt
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSource, displayNameMap } from "./source.mjs";
import { collectShifts, bizToday } from "./shifts.mjs";
import { shiftPost, offerPost, appealPost, couponPost, forwardPost, pickNext, fitPost, allowedFor, allowedSoFar } from "./news/compose.mjs";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(HERE, "..", "..");
const OUT = join(HERE, "out");
const STATE = join(OUT, "news-state.json");
export const SITES = ["estama", "ekichika", "esban", "eslove", "esthe-ranking"];
const NAMES = { estama: "エステ魂", ekichika: "駅ちか", esban: "エステ番長", eslove: "エステラブ", "esthe-ranking": "全国メンズエステランキング" };
// 1日の上限（サイトが残り回数を出すところは、その数も超えない）。エステ魂・エステ番長は上限の記載がないため控えめに
const QUOTA = { estama: 3, ekichika: 15, esban: 5, eslove: 10, "esthe-ranking": 5 };
const FORWARD_HOURS = 12; // エステ魂のニュースは、見つけてから12時間以内のものだけ転載（時間限定の内容があるため）

const arg = (f) => { const i = process.argv.indexOf(f); return i < 0 ? null : process.argv[i + 1]; };
const log = (s) => { console.log(s); mkdirSync(OUT, { recursive: true, mode: 0o700 }); appendFileSync(join(OUT, "news-log.txt"), `${new Date().toISOString()} ${s}\n`); };
const readJSON = (p, fb) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fb; } };

/** 営業日の分（6時より前は前日の24時以降として数える） */
function bizMinutes(nowMs = Date.now()) {
  const j = new Date(nowMs + 9 * 3600e3);
  const m = j.getUTCHours() * 60 + j.getUTCMinutes();
  return m < 6 * 60 ? m + 24 * 60 : m;
}
const jstDate = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);

function activeOffers() {
  const o = readJSON(join(REPO, "data", "offers.json"), { items: [] });
  const d = jstDate();
  return (o.items || []).filter((x) => (!x.since || x.since <= d) && (!x.until || d <= x.until));
}

async function diaryNames(roster) {
  try {
    const { buildDiary } = await import(join(REPO, "scripts", "fetch-diary.mjs"));
    const conf = readJSON(join(REPO, "data", "diary-config.json"), {});
    if (!conf.shopId) return [];
    const res = await fetch(`https://m-sns.net/api/shop-timeline.php?shop_id=${encodeURIComponent(conf.shopId)}&limit=50`, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    const api = await res.json();
    const { posts } = buildDiary(api, roster, { accounts: conf.accounts || {} });
    const since = Date.now() - 24 * 3600e3;
    return Object.entries(posts)
      .filter(([, list]) => list.some((p) => Date.parse(p.at.replace(" ", "T") + ":00+09:00") >= since))
      .map(([name]) => (roster.find((r) => r.name === name) || {}).nameFull || name);
  } catch { return []; }
}

/** 投稿の候補（サイト共通のもの） */
async function buildCandidates(config) {
  const { schedule, roster } = await loadSource(config);
  const today = bizToday();
  const { shifts } = collectShifts(schedule, displayNameMap(roster));
  const todays = shifts.filter((s) => s.date === today);
  const diary = await diaryNames(roster);
  const byDisp = (n) => roster.find((r) => (r.nameFull || r.name) === n || r.name === n);
  return {
    today,
    shift: shiftPost({ today, shifts: todays, diaryNames: diary }),
    offer: activeOffers().map((o) => offerPost(o)).filter(Boolean),
    appeal: todays.map((s) => appealPost({ today, therapist: byDisp(s.name), shift: s })).filter(Boolean),
    diary,
  };
}

function loadState() {
  const s = readJSON(STATE, {});
  s.days ||= {}; s.forwarded ||= {}; s.estama ||= {}; s.estama.firstSeen ||= {}; s.estama.ours ||= [];
  return s;
}
function saveState(s) { mkdirSync(OUT, { recursive: true, mode: 0o700 }); writeFileSync(STATE, JSON.stringify(s, null, 1)); }

async function withPage(config, fn) {
  const { chromium } = await import("playwright");
  const b = await chromium.connectOverCDP(config.browserCdpUrl || "http://127.0.0.1:9333", { timeout: 5000 }).catch(() => null);
  if (!b) throw new Error("作業用ブラウザが開いていません（node src/browser.mjs で開いてください）");
  const page = await b.contexts()[0].newPage();
  try { return await fn(page); } finally { await page.close().catch(() => {}); await b.close().catch(() => {}); }
}

async function main() {
  const cmd = process.argv[2] || "plan";
  const only = arg("--site");
  const sites = only ? [only] : SITES;
  if (only && !SITES.includes(only)) throw new Error(`使えるサイト：${SITES.join(" / ")}`);
  const config = JSON.parse(readFileSync(join(HERE, "config.local.json"), "utf8"));
  const quota = { ...QUOTA, ...((config.news && config.news.quota) || {}) };
  const state = loadState();
  const base = await buildCandidates(config);
  const today = base.today;
  const nowMin = bizMinutes();
  const S = await import("./news/sites.mjs");

  await withPage(config, async (page) => {
    // エステ魂のニュース：最初の実行では今あるものを「転載しない」印にする（古い・時間限定の内容を流さないため）
    const est = await S.readEstamaNews(page).catch((e) => { log(`エステ魂のニュースを読めませんでした：${e.message}`); return null; });
    const forward = [];
    if (est) {
      const first = !state.estama.initialized;
      // 0 は「最初からあった（転載しない）」の印。0 を未登録と取り違えないよう、キーの有無で判定する
      for (const it of est) if (!Object.prototype.hasOwnProperty.call(state.estama.firstSeen, it.id)) state.estama.firstSeen[it.id] = first ? 0 : Date.now();
      state.estama.initialized = true;
      const fresh = est.filter((it) => state.estama.firstSeen[it.id] > Date.now() - FORWARD_HOURS * 3600e3 && !state.estama.ours.includes(it.title));
      if (fresh.length) for (const it of await S.readEstamaNews(page, { withBody: fresh.map((x) => x.id) })) if (fresh.some((f) => f.id === it.id)) forward.push(forwardPost(it));
    }
    const coupons = { "esthe-ranking": (await S.readRankingCoupons(page).catch(() => [])).map(couponPost).filter(Boolean) };

    for (const site of sites) {
      const day = ((state.days[site] ||= {})[today] ||= { count: 0, keys: [], rotation: 0 });
      const want = process.argv.includes("--now") ? day.count + 1 : allowedSoFar(quota[site], nowMin);
      let remain = null;
      if (site === "ekichika") remain = await S.ekichikaRemaining(page).catch(() => null);
      if (site === "eslove") remain = await S.esloveRemaining(page).catch(() => null);
      if (site === "esthe-ranking") remain = await S.rankingRemaining(page).catch(() => null);
      const cand = { ...base, forward: site === "estama" ? [] : forward, coupon: coupons[site] || [] };
      const done = [...day.keys, ...(state.forwarded[site] || []).map((id) => `forward:${id}`)];
      const { post, rotation } = pickNext(cand, { rotation: day.rotation, done, site });
      const head = `${NAMES[site]}：今日 ${day.count}/${quota[site]}件${remain != null ? `（サイトの残り ${remain}回）` : ""}`;
      if (!post) { log(`${head} … 出せる内容がありません`); continue; }
      const p = fitPost(post, S.LIMITS[site]);
      const chk = allowedFor(site, p);
      if (cmd === "plan") {
        console.log(`\n■ ${head}${day.count >= want ? "（今は時間外・上限。次の時間を待つ）" : "（今出せる）"}\n  種類：${p.type}\n  題名：${p.title}\n  本文：\n${p.body.split("\n").map((l) => "    " + l).join("\n")}${chk.ok ? "" : `\n  ※出さない：${chk.reason}`}`);
        continue;
      }
      if (cmd !== "run") throw new Error("使い方：node src/news.mjs plan | run [--site s] [--now]");
      if (day.count >= want) { log(`${head} … まだ次の時間ではありません`); continue; }
      if (remain === 0) { log(`${head} … サイトの残り回数が0のため出しません`); continue; }
      if (!chk.ok) { log(`${head} … 出しません（${chk.reason}）`); continue; }
      try {
        const ok = await S.POSTERS[site](page, p, {});
        if (!ok) { log(`${head} … 投稿の操作はしましたが、一覧で題名を確認できません（数えずに次の回で確かめます）：${p.title}`); continue; }
        day.count++; day.keys.push(post.key); day.rotation = rotation;
        if (post.type === "forward") (state.forwarded[site] ||= []).push(post.key.slice("forward:".length));
        if (site === "estama") state.estama.ours.push(p.title);
        saveState(state);
        log(`${head.replace(/今日 \d+/, `今日 ${day.count}`)} … 投稿し、一覧で確認しました：${p.title}`);
      } catch (e) {
        saveState(state);
        log(`${NAMES[site]}：止まりました（${e.message}）`);
      }
    }
  });
  saveState(state);
}

main().catch((e) => { log("ニュース：止まりました：" + e.message); process.exitCode = 1; });
