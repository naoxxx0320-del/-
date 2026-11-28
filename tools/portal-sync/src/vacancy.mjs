#!/usr/bin/env node
// 空き時間の告知（オーナーの選択：1日3回 11時・15時・19時、60分以上の空き）
//   node src/vacancy.mjs plan        … 今の空きと、告知する文章を表示するだけ
//   node src/vacancy.mjs run [--now] … 告知の時刻が来ていれば出す（--now は時刻を待たずに今の空きを出す）
// 出す先：駅ちか・エステラブ・全国メンズエステランキング（ニュース）、リラクシィ（本人のアカウント）
// 空き＝本日の出勤（出勤表シート）−予約（予約管理の公開の空き状況。担当者・時間帯だけで、お客様の情報は含まない）。
//   空き状況を読めないときは告知しない（読めない＝空き、とはしない）。
// 投稿の回数は、各サイトのニュースの1日の件数（out/news-state.json）に数える。
// 記録：out/vacancy-state.json、out/vacancy-log.txt
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSource, displayNameMap } from "./source.mjs";
import { collectShifts, bizToday } from "./shifts.mjs";
import { fitPost, allowedFor } from "./news/compose.mjs";
import { freeWindows, dueSlot, vacancyPost, rxVacancyText } from "./news/vacancy.mjs";
import { photoFile, padded } from "./news/photos.mjs";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(HERE, "..", "..");
const OUT = join(HERE, "out");
const STATE = join(OUT, "vacancy-state.json");
const NEWS_STATE = join(OUT, "news-state.json");
const SITES = ["ekichika", "eslove", "esthe-ranking"];
const NAMES = { ekichika: "駅ちか", eslove: "エステラブ", "esthe-ranking": "全国メンズエステランキング" };

const log = (s) => { console.log(s); mkdirSync(OUT, { recursive: true, mode: 0o700 }); appendFileSync(join(OUT, "vacancy-log.txt"), `${new Date().toISOString()} ${s}\n`); };
const readJSON = (p, fb) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fb; } };
const save = (p, o) => { mkdirSync(OUT, { recursive: true, mode: 0o700 }); writeFileSync(p, JSON.stringify(o, null, 1)); };
const ymdSlash = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${y}/${m}/${d}`; };
const nextIso = (iso) => new Date(Date.parse(iso + "T00:00:00Z") + 86400e3).toISOString().slice(0, 10);

/** 予約の入っている時間（本日と、翌0時以降のために翌日の分も）。読めなければ例外 */
async function readBusy(today) {
  const cfg = readJSON(join(REPO, "data", "reserve-config.json"), {});
  const api = String(cfg.apiV2 || "").trim();
  if (!api) throw new Error("data/reserve-config.json に apiV2 がありません");
  const out = [];
  for (const d of [today, nextIso(today)]) {
    const res = await fetch(`${api}?action=availability&date=${encodeURIComponent(ymdSlash(d))}`, { redirect: "follow", signal: AbortSignal.timeout(30000) });
    const j = JSON.parse(await res.text());
    if (!j || j.ok !== true || !Array.isArray(j.busy)) throw new Error("空き状況の応答が正しくありません");
    for (const b of j.busy) out.push({ th: b.th, s: Number(b.s), e: Number(b.e) });
  }
  return out;
}

async function main() {
  const cmd = process.argv[2] || "plan";
  if (!["plan", "run"].includes(cmd)) throw new Error("使い方：node src/vacancy.mjs plan | run [--now]");
  const config = JSON.parse(readFileSync(join(HERE, "config.local.json"), "utf8"));
  const today = bizToday();
  const midnightMs = Date.parse(today + "T00:00:00+09:00");
  const nowMs = Date.now();
  const nowMin = Math.floor((nowMs - midnightMs) / 60000);
  const state = readJSON(STATE, { days: {} });
  const day = (state.days[today] ||= { done: [] });
  const slot = process.argv.includes("--now") ? nowMin : dueSlot(nowMin, day.done);
  if (cmd === "run" && slot == null) { console.log("空き時間の告知：次の告知の時刻（11時・15時・19時）ではありません"); return; }

  const { schedule, roster } = await loadSource(config);
  const todays = collectShifts(schedule, displayNameMap(roster)).shifts.filter((s) => s.date === today);
  let busy;
  try { busy = await readBusy(today); } catch (e) { log(`空き時間の告知：予約の空き状況を読めないため、告知しません（${e.message}）`); process.exitCode = 1; return; }
  const windows = freeWindows({ shifts: todays, busy, midnightMs, nowMs });
  const offers = readJSON(join(REPO, "data", "offers.json"), { items: [] }).items || [];
  const hayawari = offers.find((o) => o.id === "hayawari" && (!o.since || o.since <= today) && (!o.until || today <= o.until)) || null;
  const post = vacancyPost({ today, windows, nowMin, hayawari });
  const { ACCOUNTS, SHOP, whoAmI, postAsRelaxi } = await import("./rx-post.mjs");
  const accounts = { ...ACCOUNTS, ...((config.rx && config.rx.accounts) || {}) };
  const byName = {};
  for (const w of windows) (byName[w.name] ||= []).push(w);

  if (cmd === "plan") {
    console.log(`空き時間（${today}、今 ${Math.floor(nowMin / 60)}:${String(nowMin % 60).padStart(2, "0")}）：${windows.length ? windows.map((w) => `${w.name} ${w.start / 60 | 0}:${String(w.start % 60).padStart(2, "0")}〜`).join("・") : "なし"}`);
    console.log(`次の告知：${slot == null ? "今日はもうなし／まだ" : `${slot / 60 | 0}時の回（今出せる）`}`);
    if (post) console.log(`\n■ 掲載サイト\n  題名：${post.title}\n${post.body.split("\n").map((l) => "    " + l).join("\n")}`);
    for (const [name, ws] of Object.entries(byName)) console.log(`\n■ リラクシィ ${name}${accounts[name] ? `（@${accounts[name]}）` : "（アカウントなし・出さない）"}\n${rxVacancyText({ windows: ws, hayawari }).split("\n").map((l) => "    " + l).join("\n")}`);
    return;
  }

  if (!post) { day.done.push(slot); save(STATE, state); log(`空き時間の告知（${slot / 60 | 0}時の回）：60分以上の空きがないため、出しません`); return; }
  const S = await import("./news/sites.mjs");
  const ns = readJSON(NEWS_STATE, {}); ns.days ||= {};
  const { chromium } = await import("playwright");
  const b = await chromium.connectOverCDP(config.browserCdpUrl || "http://127.0.0.1:9333", { timeout: 5000 }).catch(() => null);
  if (!b) throw new Error("作業用ブラウザが開いていません（node src/browser.mjs で開いてください）");
  const ctx = b.contexts()[0];
  const page = await ctx.newPage();
  const photoDir = config.photoDir || join(REPO, "..", "photos");
  try {
    for (const site of SITES) {
      const nd = ((ns.days[site] ||= {})[today] ||= { count: 0, keys: [], rotation: 0 });
      if (nd.keys.includes(post.key)) continue;
      let remain = null;
      if (site === "ekichika") remain = await S.ekichikaRemaining(page).catch(() => null);
      if (site === "eslove") remain = await S.esloveRemaining(page).catch(() => null);
      if (site === "esthe-ranking") remain = await S.rankingRemaining(page).catch(() => null);
      if (remain === 0) { log(`空き時間の告知 ${NAMES[site]}：サイトの残り回数が0のため出しません`); continue; }
      const p = fitPost(post, S.LIMITS[site]);
      const chk = allowedFor(site, p);
      if (!chk.ok) { log(`空き時間の告知 ${NAMES[site]}：出しません（${chk.reason}）`); continue; }
      const file = photoFile(post.displayName, photoDir);
      const meta = { ownTitles: (ns.titles && ns.titles[site]) || [], photo: file || site === "ekichika" ? { name: post.displayName, file: file || "(駅ちかの登録写真)", wide: site === "eslove" && file ? padded(file, "4:3", join(OUT, "news-img")) : null } : null };
      try {
        const ok = await S.POSTERS[site](page, p, meta);
        if (!ok) { log(`空き時間の告知 ${NAMES[site]}：投稿の操作はしましたが、一覧で題名を確認できません：${p.title}［${meta.image || "写真なし"}］`); continue; }
        nd.count++; nd.keys.push(post.key);
        ((ns.titles ||= {})[site] ||= []).push(p.title); ns.titles[site] = ns.titles[site].slice(-50);
        save(NEWS_STATE, ns);
        log(`空き時間の告知 ${NAMES[site]}：投稿し、一覧で確認しました：${p.title}［${meta.image || "写真なし"}］`);
      } catch (e) { log(`空き時間の告知 ${NAMES[site]}：止まりました（${e.message}）`); process.exitCode = 1; }
    }
    // リラクシィ：本人のアカウントから
    await page.goto("https://rx-sns.jp/", { waitUntil: "load" }).catch(() => {}); await page.waitForTimeout(2500);
    const me = await whoAmI(page).catch(() => null);
    if (me !== SHOP) log(`空き時間の告知 リラクシィ：店舗アカウントでログインしていないため出しません（今は ${me ? "@" + me : "ログインなし"}）`);
    else for (const [name, ws] of Object.entries(byName)) {
      const handle = accounts[name];
      if (!handle) continue;
      const text = rxVacancyText({ windows: ws, hayawari });
      const file = photoFile(name, photoDir);
      try {
        const r = await postAsRelaxi(ctx, page, { handle, post: text, files: file ? [file] : [] });
        log(`空き時間の告知 リラクシィ ${name}（@${handle}）：${r.ok ? (r.already ? "同じ内容がすでにあります" : "投稿し、本人のページで確認しました") : "投稿の操作はしましたが、本人のページで確認できません"}：${text.split("\n")[0]}`);
      } catch (e) { log(`空き時間の告知 リラクシィ ${name}：止まりました（${e.message}）`); process.exitCode = 1; }
    }
    day.done.push(slot); save(STATE, state);
  } finally { await page.close().catch(() => {}); await b.close().catch(() => {}); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { log("空き時間の告知：止まりました：" + e.message); process.exitCode = 1; });
