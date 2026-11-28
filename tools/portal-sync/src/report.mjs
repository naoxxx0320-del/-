#!/usr/bin/env node
// 週1の効果レポート（オーナーの選択：毎週月曜の朝、Mac に通知）
//   node src/report.mjs now   … 先週（月〜日）のレポートを今すぐ作る
//   node src/report.mjs auto  … 月曜の9時以降で、まだその週の分を作っていなければ作る（毎時の自動実行から呼ぶ）
// 読むもの（読むだけ）：エステ魂「アクセス状況」「ランキングデータ」、駅ちか「アクセス数」、エステラブ「電話・LINE履歴」の件数、
//   リラクシィ「所属一覧」のフォロワー数、予約の公開の空き状況（件数と時間だけ。お客様の情報は含まない）、ツールの記録（out/*-log.txt）。
// 出すもの：Mac の中のページ（out/reports/ と、デスクトップの portal-sync/レポート/）と、Mac の通知。外には出さない。
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSource, displayNameMap } from "./source.mjs";
import { collectShifts } from "./shifts.mjs";
import { estamaRank, estamaAccess, ekichikaAccess, rxFollowers, countLog, lastWeek } from "./report/parse.mjs";
import { dayLabel } from "./news/compose.mjs";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(HERE, "..", "..");
const OUT = join(HERE, "out");
const STATE = join(OUT, "report-state.json");
const readJSON = (p, fb) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fb; } };
const readText = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sum = (o, days) => days.reduce((a, d) => a + (Number.isFinite(o[d]) ? o[d] : 0), 0);
const has = (o, days) => days.some((d) => Number.isFinite(o[d]));

async function collectWeb(page, days) {
  const r = { estama: {}, estamaRank: null, ekichika: {}, esloveTaps: null, rx: {}, errors: [] };
  const go = async (u) => { await page.goto(u, { waitUntil: "load", timeout: 45000 }); await page.waitForTimeout(2500); };
  const rows = () => page.evaluate(() => [...document.querySelectorAll("table tr")].map((tr) => [...tr.cells].map((c) => c.innerText.trim())));
  try { await go("https://estama.jp/admin/analytics/"); r.estama = estamaAccess(await rows(), days[0].slice(0, 4)); } catch (e) { r.errors.push(`エステ魂のアクセス：${e.message}`); }
  try { await go("https://estama.jp/admin/analytics/ranking/"); r.estamaRank = estamaRank(await page.evaluate(() => document.body.innerText)); } catch (e) { r.errors.push(`エステ魂の順位：${e.message}`); }
  try {
    await go("https://ranking-deli.jp/admin/access/shop/");
    const ym = days[days.length - 1].slice(0, 7);
    r.ekichika = ekichikaAccess(await rows(), ym);
  } catch (e) { r.errors.push(`駅ちかのアクセス：${e.message}`); }
  try {
    await go("https://eslove.jp/admin/taphistory");
    const m = (await page.evaluate(() => document.body.innerText)).match(/全\s*(\d+)\s*件/);
    r.esloveTaps = m ? Number(m[1]) : null;
  } catch (e) { r.errors.push(`エステラブの電話・LINE：${e.message}`); }
  try { await go("https://rx-sns.jp/u/aromadiamond/therapists"); r.rx = rxFollowers(await page.evaluate(() => document.body.innerText)); } catch (e) { r.errors.push(`リラクシィ：${e.message}`); }
  return r;
}

async function collectBookings(config, days) {
  const cfg = readJSON(join(REPO, "data", "reserve-config.json"), {});
  const api = String(cfg.apiV2 || "").trim();
  const out = {};
  for (const d of days) {
    const [y, m, dd] = d.split("-").map(Number);
    try {
      const res = await fetch(`${api}?action=availability&date=${y}/${m}/${dd}`, { redirect: "follow", signal: AbortSignal.timeout(30000) });
      const j = JSON.parse(await res.text());
      if (!j.ok) throw new Error("ok:false");
      out[d] = { count: j.busy.length, minutes: j.busy.reduce((a, b) => a + Math.max(0, (Number(b.e) - Number(b.s)) / 60000), 0) };
    } catch { out[d] = null; }
  }
  let shiftMin = {};
  try {
    const { schedule, roster } = await loadSource(config);
    for (const s of collectShifts(schedule, displayNameMap(roster)).shifts) if (days.includes(s.date) && s.start != null && s.end != null) shiftMin[s.date] = (shiftMin[s.date] || 0) + (s.end - s.start);
  } catch { shiftMin = {}; }
  return { book: out, shiftMin };
}

function activity(days) {
  const [from, to] = [days[0], days[days.length - 1]];
  const L = (f) => readText(join(OUT, f));
  const news = L("news-log.txt");
  return [
    ["ニュース（エステ魂）", countLog(news, /エステ魂：.*投稿し、一覧で確認しました/, from, to)],
    ["ニュース（駅ちか）", countLog(news, /駅ちか：.*投稿し、一覧で確認しました/, from, to)],
    ["ニュース（エステ番長）", countLog(news, /エステ番長：.*投稿し、一覧で確認しました/, from, to)],
    ["ニュース（エステラブ）", countLog(news, /エステラブ：.*投稿し、一覧で確認しました/, from, to)],
    ["ニュース（全国メンズエステランキング）", countLog(news, /全国メンズエステランキング：.*投稿し、一覧で確認しました/, from, to)],
    ["空き時間の告知", countLog(L("vacancy-log.txt"), /投稿し/, from, to)],
    ["駅ちか 一括上位表示", countLog(L("boost-log.txt"), /駅ちか 一括上位表示：押しました/, from, to)],
    ["エステ魂 セラピストアピール", countLog(L("boost-log.txt"), /セラピストアピール：.*をアピールしました/, from, to)],
    ["エステ魂 集客ワンクリックアピール", countLog(L("boost-log.txt"), /集客ワンクリックアピール：押しました/, from, to)],
    ["写メ日記の転載（駅ちか）", countLog(L("diary-post-log.txt"), /転載し/, from, to)],
    ["写メ日記の転載（リラクシィ）", countLog(L("rx-post-log.txt"), /転載し/, from, to)],
  ];
}

const delta = (now, prev) => (prev == null || now == null ? "" : now === prev ? "（先週と同じ）" : `（先週より${now > prev ? "+" : ""}${Math.round((now - prev) * 10) / 10}）`);

function render({ days, web, bk, acts, prev }) {
  const bookCount = days.reduce((a, d) => a + (bk.book[d] ? bk.book[d].count : 0), 0);
  const bookKnown = days.some((d) => bk.book[d]);
  const occ = (d) => (bk.book[d] && bk.shiftMin[d] ? Math.round((bk.book[d].minutes / bk.shiftMin[d]) * 100) : null);
  const occAll = (() => { const m = days.reduce((a, d) => a + (bk.book[d] && bk.shiftMin[d] ? bk.book[d].minutes : 0), 0), s = days.reduce((a, d) => a + (bk.book[d] && bk.shiftMin[d] ? bk.shiftMin[d] : 0), 0); return s ? Math.round((m / s) * 100) : null; })();
  const es = has(web.estama, days) ? sum(web.estama, days) : null;
  const ek = has(web.ekichika, days) ? sum(web.ekichika, days) : null;
  const cards = [
    ["予約", bookKnown ? `${bookCount}件` : "—", delta(bookKnown ? bookCount : null, prev && prev.bookCount)],
    ["予約で埋まった割合", occAll == null ? "—" : `${occAll}%`, delta(occAll, prev && prev.occAll)],
    ["エステ魂 アクセス", es == null ? "—" : `${es.toLocaleString("ja-JP")}`, delta(es, prev && prev.estama)],
    ["エステ魂 エリア順位", web.estamaRank == null ? "30位より下" : `${web.estamaRank}位`, prev && prev.estamaRank != null && web.estamaRank != null ? (web.estamaRank === prev.estamaRank ? "（先週と同じ）" : `（先週 ${prev.estamaRank}位）`) : ""],
    ["駅ちか 女の子ページ", ek == null ? "—" : `${ek}`, delta(ek, prev && prev.ekichika)],
    ["エステラブ 電話・LINE", web.esloveTaps == null ? "—" : `${web.esloveTaps}回`, "（前月1日〜今日）"],
  ];
  const maxEs = Math.max(1, ...days.map((d) => web.estama[d] || 0));
  const rowsHtml = days.map((d) => {
    const b = bk.book[d], o = occ(d), e = web.estama[d], k = web.ekichika[d];
    return `<tr><td>${esc(dayLabel(d))}</td><td class="n">${b ? b.count : "—"}</td><td class="n">${o == null ? "—" : o + "%"}</td><td class="n">${e == null ? "—" : e}</td><td><span class="bar" style="width:${e == null ? 0 : Math.round((e / maxEs) * 100)}%"></span></td><td class="n">${k == null ? "—" : k}</td></tr>`;
  }).join("");
  const rxRows = Object.entries(web.rx).map(([h, n]) => `<tr><td>@${esc(h)}</td><td class="n">${n}</td><td>${esc(delta(n, prev && prev.rx && prev.rx[h]))}</td></tr>`).join("") || `<tr><td colspan="3">読めませんでした</td></tr>`;
  const actRows = acts.map(([k, n]) => `<tr><td>${esc(k)}</td><td class="n">${n}</td></tr>`).join("");
  const best = days.filter((d) => web.estama[d] != null).sort((a, b) => web.estama[b] - web.estama[a])[0];
  const notes = [
    best ? `エステ魂のアクセスが一番多かったのは ${dayLabel(best)}（${web.estama[best]}）でした。` : "",
    occAll != null ? `出勤時間のうち予約で埋まったのは ${occAll}% でした。空き時間の告知・早割で、空いている時間を埋めていきます。` : "",
    web.errors.length ? `読めなかったもの：${web.errors.join("／")}` : "",
    "予約の件数は、予約台帳（WEB・LINE・お店で入力したもの）の数です。台帳に入れていない予約は含まれません。",
    "駅ちかの数字は「女の子ページ」へのアクセス（スマホ）で、お店全体のアクセスではありません。月をまたぐ週は、今月の分だけです。",
  ].filter(Boolean).map((t) => `<li>${esc(t)}</li>`).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>週の集客レポート ${esc(days[0])}</title>
<style>
:root{--bg:#faf8f4;--fg:#2b2620;--sub:#7a6f62;--line:#e6dfd4;--card:#fff;--accent:#9a7b4f}
@media (prefers-color-scheme:dark){:root{--bg:#1c1a17;--fg:#ece6dc;--sub:#a89c8c;--line:#3a352e;--card:#26231f;--accent:#c9a46e}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.7 -apple-system,"Hiragino Sans","Noto Sans JP",sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px}
.sub{color:var(--sub);margin:0 0 16px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.card b{display:block;font-size:24px;margin:2px 0}.card span{color:var(--sub);font-size:13px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}th{font-size:13px;color:var(--sub);font-weight:600}
td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.bar{display:inline-block;height:10px;border-radius:5px;background:var(--accent);min-width:2px}
.wrap{overflow-x:auto}ul{padding-left:20px}
</style></head><body><main>
<h1>週の集客レポート</h1>
<p class="sub">${esc(dayLabel(days[0]))}〜${esc(dayLabel(days[6]))}　（作成 ${esc(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " "))}）</p>
<div class="cards">${cards.map(([k, v, s]) => `<div class="card"><span>${esc(k)}</span><b>${esc(v)}</b><span>${esc(s)}</span></div>`).join("")}</div>
<h2>日ごと</h2><div class="wrap"><table><tr><th>日付</th><th>予約</th><th>埋まった割合</th><th>エステ魂 アクセス</th><th style="width:30%"></th><th>駅ちか 女の子ページ</th></tr>${rowsHtml}</table></div>
<h2>リラクシィのフォロワー</h2><table><tr><th>アカウント</th><th>フォロワー</th><th></th></tr>${rxRows}</table>
<h2>自動で行ったこと（1週間）</h2><table><tr><th>内容</th><th>回数</th></tr>${actRows}</table>
<h2>メモ</h2><ul>${notes}</ul>
</main></body></html>`;
}

async function main() {
  const cmd = process.argv[2] || "now";
  const state = readJSON(STATE, { weeks: {} });
  const days = lastWeek();
  if (cmd === "auto") {
    const j = new Date(Date.now() + 9 * 3600e3);
    if (j.getUTCDay() !== 1 || j.getUTCHours() < 9 || state.last === days[0]) { console.log("週のレポート：作る日時ではありません（月曜9時以降に1回）"); return; }
  } else if (cmd !== "now") throw new Error("使い方：node src/report.mjs now | auto");
  const config = JSON.parse(readFileSync(join(HERE, "config.local.json"), "utf8"));
  const { chromium } = await import("playwright");
  const b = await chromium.connectOverCDP(config.browserCdpUrl || "http://127.0.0.1:9333", { timeout: 5000 }).catch(() => null);
  if (!b) throw new Error("作業用ブラウザが開いていません（node src/browser.mjs で開いてください）");
  const page = await b.contexts()[0].newPage();
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  let web;
  try { web = await collectWeb(page, days); } finally { await page.close().catch(() => {}); await b.close().catch(() => {}); }
  const bk = await collectBookings(config, days);
  const acts = activity(days);
  const prevKey = Object.keys(state.weeks).filter((k) => k < days[0]).sort().pop();
  const prev = prevKey ? state.weeks[prevKey] : null;
  const html = render({ days, web, bk, acts, prev });
  const name = `週の集客レポート-${days[0]}.html`;
  mkdirSync(join(OUT, "reports"), { recursive: true, mode: 0o700 });
  const file = join(OUT, "reports", name);
  writeFileSync(file, html);
  const deskDir = config.reportDir || join(REPO, "..", "レポート");
  try { mkdirSync(deskDir, { recursive: true }); copyFileSync(file, join(deskDir, name)); } catch {}
  const bookKnown = days.some((d) => bk.book[d]);
  const occS = days.reduce((a, d) => a + (bk.book[d] && bk.shiftMin[d] ? bk.shiftMin[d] : 0), 0);
  state.weeks[days[0]] = {
    bookCount: bookKnown ? days.reduce((a, d) => a + (bk.book[d] ? bk.book[d].count : 0), 0) : null,
    occAll: occS ? Math.round((days.reduce((a, d) => a + (bk.book[d] && bk.shiftMin[d] ? bk.book[d].minutes : 0), 0) / occS) * 100) : null,
    estama: has(web.estama, days) ? sum(web.estama, days) : null, estamaRank: web.estamaRank,
    ekichika: has(web.ekichika, days) ? sum(web.ekichika, days) : null, rx: web.rx,
  };
  state.last = days[0];
  mkdirSync(OUT, { recursive: true, mode: 0o700 }); writeFileSync(STATE, JSON.stringify(state, null, 1));
  console.log(`週のレポート：作りました：${existsSync(join(deskDir, name)) ? join(deskDir, name) : file}${web.errors.length ? `（読めなかったもの ${web.errors.length}件）` : ""}`);
  if (process.platform === "darwin") spawnSync("/usr/bin/osascript", ["-e", `display notification "デスクトップの portal-sync/レポート に先週のレポートができました" with title "週の集客レポート" sound name "Glass"`]);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.log("週のレポート：止まりました：" + e.message); process.exitCode = 1; });
