#!/usr/bin/env node
// 上位表示（無料の回数だけ。有料ポイントは使わない）を、10:00〜翌5:00 に均等に配って押す
//   node src/boost.mjs plan        … 残り回数と、今押すかどうかを表示するだけ
//   node src/boost.mjs run [--now] … 時間が来ていれば1回押す（--now は配分を無視して1回）
// 対象：
//   ・駅ちか：管理画面トップの「一括上位表示」（.all_disp_button、確認「一括上位表示します。よろしいですか？」）。1日の残り回数はページに出る（深夜0時にリセット）
//   ・エステラブ：新着情報の「更新または上位化する」＝ニュースの投稿（src/news.mjs）で行う
//   ・エステ魂：セラピストアピール（本日出勤の人だけ。1人1日1回、出勤の1時間前から退勤まで、開始の早い順。1日3回・朝6時リセット）。
//     オーナーがエステ魂に電話で確認（2026-11-28）：セラピストアピール・ニュースの自動化は可、お店のランキングを上げる操作は不可。
//     → 集客ワンクリックアピール（お店の表示順を上げる）は押さない
//   ・全国メンズエステランキング・エステ番長：上位表示のボタンはない
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allowedSoFar } from "./news/compose.mjs";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(HERE, "out");
const STATE = join(OUT, "boost-state.json");
const log = (s) => { console.log(s); mkdirSync(OUT, { recursive: true, mode: 0o700 }); appendFileSync(join(OUT, "boost-log.txt"), `${new Date().toISOString()} ${s}\n`); };
const readJSON = (p, fb) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fb; } };
const jst = (ms = Date.now()) => new Date(ms + 9 * 3600e3);
/** 駅ちかの回数は深夜0時にリセット：暦の日付で数える。配分は 10:00〜翌5:00 の営業時間の中で */
const calDay = () => jst().toISOString().slice(0, 10);
function bizMinutes() { const j = jst(); const m = j.getUTCHours() * 60 + j.getUTCMinutes(); return m < 6 * 60 ? m + 24 * 60 : m; }

async function ekichikaBoost(page, { dryRun }) {
  await page.goto("https://ranking-deli.jp/admin/", { waitUntil: "load" });
  await page.waitForTimeout(2000 + Math.random() * 500);
  if (/login/.test(page.url())) throw new Error("駅ちかにログインしていません");
  const read = () => page.evaluate(() => ({ remain: Number((document.querySelector("span.remaining_disp_num") || {}).textContent), last: ((document.querySelector("li.last_disp_date") || {}).textContent || "").trim() }));
  const before = await read();
  if (!Number.isFinite(before.remain)) throw new Error("駅ちかの残り回数を読めません。押さずに止めました");
  if (dryRun || before.remain <= 0) return { before, after: before, pressed: false };
  const btn = page.locator(".all_disp_button");
  if ((await btn.count()) < 1) throw new Error("駅ちかの「一括上位表示」ボタンが見つかりません。押さずに止めました");
  const msgs = [];
  const onDialog = async (d) => {
    msgs.push(d.message());
    try { if (d.type() === "confirm" ? /一括上位表示します/.test(d.message()) : true) await d.accept(); else await d.dismiss(); } catch {}
  };
  page.on("dialog", onDialog);
  try {
    const res = page.waitForResponse((r) => r.url().includes("/admin/bulktop/create.json"), { timeout: 20000 }).catch(() => null);
    await btn.first().click();
    const r = await res;
    await page.waitForTimeout(2500);
    if (!r) throw new Error("一括上位表示の応答がありませんでした（押されていない可能性）");
  } finally { page.off("dialog", onDialog); }
  const after = await read();
  return { before, after, pressed: after.remain < before.remain, msgs };
}

/** "16:00～24:00" → { start, end }（分。退勤が出勤より前なら翌日） */
export function parseShift(t) {
  const m = String(t || "").match(/(\d{1,2}):(\d{2})\s*[～〜~-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const start = +m[1] * 60 + +m[2];
  let end = +m[3] * 60 + +m[4];
  if (end <= start) end += 24 * 60;
  return { start, end };
}
/** 次にアピールする1人：本日出勤（エステ魂の表示）・今日まだ・出勤の1時間前から退勤まで・開始の早い順 */
export function pickAppeal(rows, { nowMin, done = [], remain = 0, leadMin = 60 }) {
  if (!(remain > 0)) return null;
  return rows
    .map((r) => ({ ...r, shift: parseShift(r.shiftText) }))
    .filter((r) => r.shift && !done.includes(r.id) && nowMin >= r.shift.start - leadMin && nowMin < r.shift.end)
    .sort((a, b) => a.shift.start - b.shift.start)[0] || null;
}

async function estamaRead(page) {
  await page.goto("https://estama.jp/admin/cast/appeal/", { waitUntil: "load" });
  await page.waitForTimeout(2000 + Math.random() * 500);
  if (/login/.test(page.url())) throw new Error("エステ魂にログインしていません");
  const remain = Number(((await page.evaluate(() => document.body.innerText)).match(/本日の残り回数\s*(\d+)\s*回/) || [])[1]);
  const rows = await page.evaluate(() => [...document.querySelectorAll("a.send-easy_post2[data-post='single_appeal_exec']")].map((a) => {
    const id = (a.getAttribute("data-row").match(/cast_appeal,(\d+)/) || [])[1];
    let row = a; for (let i = 0; i < 6 && row.parentElement && !row.querySelector(".l-appeal_cast_name"); i++) row = row.parentElement;
    const name = (row.querySelector(".l-appeal_cast_name") || {}).textContent?.trim() || "";
    const text = row.innerText || "";
    return { id, name, shiftText: (text.match(/\d{1,2}:\d{2}\s*[～〜]\s*\d{1,2}:\d{2}/) || [""])[0], last: ((text.match(/最終アピール\s*([^\n]+)/) || [])[1] || "").trim() };
  }).filter((r) => r.id));
  if (!Number.isFinite(remain)) throw new Error("エステ魂のアピールの残り回数を読めません。押さずに止めました");
  return { remain, rows };
}
async function estamaAppeal(page, row) {
  const link = page.locator(`a.send-easy_post2[data-post='single_appeal_exec'][data-row='cast,cast_appeal,${row.id}']`);
  if ((await link.count()) !== 1) throw new Error(`${row.name}の「アピールする」が見つかりません。押さずに止めました`);
  const res = page.waitForResponse((r) => r.url().includes("/admin_post/single_appeal_exec"), { timeout: 20000 }).catch(() => null);
  await link.click();
  const r = await res;
  await page.waitForTimeout(2500);
  if (!r) throw new Error("アピールの応答がありませんでした");
  return estamaRead(page);
}

async function main() {
  const cmd = process.argv[2] || "plan";
  const config = JSON.parse(readFileSync(join(HERE, "config.local.json"), "utf8"));
  const state = readJSON(STATE, {});
  const day = calDay();
  const st = ((state.ekichika ||= {})[day] ||= { count: 0, quota: null });
  const { chromium } = await import("playwright");
  const b = await chromium.connectOverCDP(config.browserCdpUrl || "http://127.0.0.1:9333", { timeout: 5000 }).catch(() => null);
  if (!b) throw new Error("作業用ブラウザが開いていません（node src/browser.mjs で開いてください）");
  const page = await b.contexts()[0].newPage();
  try {
  try {
    const peek = await ekichikaBoost(page, { dryRun: true });
    if (st.quota == null) st.quota = st.count + peek.before.remain; // その日の上限＝押した回数＋残り
    const want = process.argv.includes("--now") ? st.count + 1 : allowedSoFar(st.quota, bizMinutes());
    const head = `駅ちか 一括上位表示：今日 ${st.count}回押した／残り ${peek.before.remain}回（最終 ${peek.before.last || "—"}）`;
    if (cmd !== "run" && cmd !== "plan") throw new Error("使い方：node src/boost.mjs plan | run [--now]");
    if (cmd === "plan") console.log(`${head}${st.count < want && peek.before.remain > 0 ? " … 今押せます" : " … 次の時間を待ちます"}`);
    else if (st.count >= want || peek.before.remain <= 0) log(`${head} … 今は押しません`);
    else {
      const r = await ekichikaBoost(page, { dryRun: false });
      if (r.pressed) st.count++;
      log(`駅ちか 一括上位表示：${r.pressed ? "押しました" : "押しましたが残り回数が減っていません（画面で確認してください）"}（残り ${r.before.remain} → ${r.after.remain}、最終 ${r.after.last}）${r.msgs && r.msgs.length ? `［${r.msgs.join(" / ").replace(/\s+/g, " ")}］` : ""}`);
    }
  } catch (e) { log("駅ちか 一括上位表示：止まりました：" + e.message); process.exitCode = 1; }
  // エステ魂 セラピストアピール（朝6時リセット＝営業日で数える）
  try {
    const biz = jst(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
    const es = ((state.estama ||= {})[biz] ||= { done: [] });
    const now = bizMinutes();
    const cur = await estamaRead(page);
    const working = cur.rows.filter((r) => parseShift(r.shiftText));
    const next = pickAppeal(cur.rows, { nowMin: now, done: es.done, remain: cur.remain });
    const head = `エステ魂 セラピストアピール：残り ${cur.remain}回／本日出勤 ${working.map((r) => `${r.name} ${r.shiftText}`).join("・") || "なし"}／今日アピール済み ${es.done.length}人`;
    if (cmd === "plan") { console.log(`${head}${next ? ` … 今 ${next.name} をアピールできます` : " … 今はなし"}`); return; }
    if (!next) { log(`${head} … 今はなし`); return; }
    const after = await estamaAppeal(page, next);
    const row = after.rows.find((r) => r.id === next.id);
    const ok = after.remain < cur.remain;
    if (ok) es.done.push(next.id);
    log(`エステ魂 セラピストアピール：${next.name}（${next.shiftText}）${ok ? "をアピールしました" : "を押しましたが残り回数が減っていません（画面で確認してください）"}（残り ${cur.remain} → ${after.remain}、最終アピール ${row ? row.last : "?"}）`);
  } catch (e) { log("エステ魂 セラピストアピール：止まりました：" + e.message); process.exitCode = 1; }
  } finally {
    mkdirSync(OUT, { recursive: true, mode: 0o700 }); writeFileSync(STATE, JSON.stringify(state, null, 1));
    await page.close().catch(() => {}); await b.close().catch(() => {});
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { log("上位表示：止まりました：" + e.message); process.exitCode = 1; });
