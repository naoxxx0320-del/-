#!/usr/bin/env node
// ポータル一括更新ツール
//   node src/cli.mjs check               … 読み込み・点検・駅ちかに入れる予定の一覧（ポータルに接続しない）
//   node src/cli.mjs diff <サイト>        … そのサイトの今の出勤を読み、変更点の一覧を作る（読むだけ・書き込まない）
//   node src/cli.mjs apply <サイト>       … diff の一覧のうち、承認したものを書き込む（確認あり）
//        サイト：ekichika（駅ちか）/ esthe-ranking（全国メンズエステランキング）/ esban（エステ番長）/ estama（エステ魂）/ eslove（エステラブ）
//        --only 1,2     その番号だけ実行
//        --remove 3,4   出勤の取り消し（削除系）は、番号で個別に指定したものだけ実行
//        --yes          確認の質問を省く（Claude が利用者の承認を得て実行するとき用）
//   設定：このフォルダの config.local.json（Git に入れない）
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { loadSource, displayNameMap } from "./source.mjs";
import { collectShifts, bizToday, siteTime } from "./shifts.mjs";
import { planEkichika } from "./sites/ekichika.mjs";
import { planEstheRanking as planEstheRankingSync } from "./sites/esthe-ranking.mjs";
import { planEsban as planEsbanSync } from "./sites/esban.mjs";
import { planEstama as planEstamaSync } from "./sites/estama.mjs";
import { planEslove as planEsloveSync } from "./sites/eslove.mjs";
import { diffShifts, formatChanges, selectChanges } from "./diff.mjs";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(HERE, "out");
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

function loadConfig() {
  const p = join(HERE, "config.local.json");
  if (!existsSync(p)) throw new Error("config.local.json がありません。config.example.json を写して、スプレッドシートのURLを入れてください");
  return JSON.parse(readFileSync(p, "utf8"));
}
function save(name, text) {
  mkdirSync(OUT, { recursive: true, mode: 0o700 });
  const f = join(OUT, name);
  writeFileSync(f, text);
  return f;
}
function argList(flag) {
  const i = process.argv.indexOf(flag);
  if (i < 0) return null;
  return String(process.argv[i + 1] || "").split(",").map((x) => Number(x.trim())).filter((n) => n > 0);
}

export function formatReport({ today, problems, shifts, plan }) {
  const L = [];
  L.push(`■ 点検（営業日の今日：${today}）`);
  const errs = problems.filter((p) => p.level === "error"), warns = problems.filter((p) => p.level === "warn");
  if (!problems.length) L.push("  問題はありません");
  for (const p of errs) L.push(`  ✖ ${p.date} ${p.name}：${p.message}`);
  for (const p of warns) L.push(`  △ ${p.date} ${p.name}：${p.message}`);
  L.push("");
  L.push(`■ 出勤（今日から）：${shifts.filter((s) => s.date >= today).length}件`);
  for (const s of shifts.filter((s) => s.date >= today).slice(0, 60)) L.push(`  ${s.date} ${s.name} ${s.start == null ? "時間未定" : siteTime(s.start) + "〜" + siteTime(s.end)}`);
  L.push("");
  L.push(`■ 駅ちか に入れる内容（予定）：${plan.dates[0]}〜${plan.dates[plan.dates.length - 1]}`);
  for (const r of plan.rows) {
    const cells = r.cells.map((c) => (c.work ? `${c.date.slice(5)} ${c.start}-${c.end}` : `${c.date.slice(5)} 休`));
    L.push(`  ${r.name}：${cells.join(" / ")}`);
  }
  for (const s of plan.skipped) L.push(`  見送り ${s.date} ${s.name}：${s.reason}`);
  return L.join("\n");
}

async function prepare(config) {
  const { schedule, roster } = await loadSource(config);
  const { shifts, problems } = collectShifts(schedule, displayNameMap(roster));
  return { shifts, problems, today: bizToday() };
}

async function check() {
  const config = loadConfig();
  const { shifts, problems, today } = await prepare(config);
  const ek = (config.sites && config.sites.ekichika) || {};
  const plan = planEkichika(shifts, today, { nameMap: ek.nameMap || {}, people: ek.people || null });
  const text = formatReport({ today, problems, shifts, plan });
  console.log(text);
  console.log(`\n（この結果は ${save(`check-${stamp()}.txt`, text + "\n")} にも保存しました）`);
  if (problems.some((p) => p.level === "error")) process.exitCode = 1;
}

/** 画面が見えるブラウザを開く（ログイン状態は利用者のフォルダに保存。Git に入れない） */
async function withBrowser(config, fn) {
  const { chromium } = await import("playwright");
  // すでに開いている作業用ブラウザ（node src/browser.mjs で起動。ログイン済み）があればそれを使う。
  // ブラウザを閉じるとログインが切れるサイト（全国メンズエステランキングなど）でも、開いている間は続けて使える。
  const cdp = config.browserCdpUrl || "http://127.0.0.1:9333";
  let shared = null;
  try { shared = await chromium.connectOverCDP(cdp, { timeout: 3000 }); } catch { shared = null; }
  if (shared) {
    const ctx = shared.contexts()[0];
    const page = await ctx.newPage();
    try { return await fn(page); } finally { await page.close().catch(() => {}); await shared.close().catch(() => {}); }
  }
  const profile = resolve(config.browserProfile || join(HERE, "..", "..", "..", ".profile"));
  mkdirSync(profile, { recursive: true, mode: 0o700 });
  const ctx = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: false, viewport: null });
  try {
    const page = ctx.pages()[0] || (await ctx.newPage());
    return await fn(page);
  } finally {
    await ctx.close();
  }
}

// サイトごとの読み取り・予定表・書き込み（同じ流れで扱えるようにそろえる）
const SITES = {
  ekichika: {
    name: "駅ちか",
    async read(page, today) {
      const ek = await import("./sites/ekichika-portal.mjs");
      await ek.openSchedule(page);
      return ek.readCurrent(page, today);
    },
    plan(shifts, today, current, conf) {
      return planEkichika(shifts, today, { nameMap: conf.nameMap || {}, people: current.people.map((p) => p.name) });
    },
    async apply(page, changes, today, log) {
      const ek = await import("./sites/ekichika-portal.mjs");
      await ek.openSchedule(page);
      return ek.applyChanges(page, changes, today, log);
    },
  },
  "esthe-ranking": {
    name: "全国メンズエステランキング",
    async read(page, today, conf) {
      const er = await import("./sites/esthe-ranking-portal.mjs");
      const { planEstheRanking } = await import("./sites/esthe-ranking.mjs");
      const dates = planEstheRanking([], today, { days: conf.days }).dates;
      return er.readCurrent(page, dates);
    },
    plan(shifts, today, current, conf) {
      return planEstheRankingSync(shifts, today, { days: conf.days, nameMap: conf.nameMap || {}, people: current.people.map((p) => p.name) });
    },
    async apply(page, changes, today, log) {
      const er = await import("./sites/esthe-ranking-portal.mjs");
      return er.applyChanges(page, changes, log);
    },
  },
};
SITES.esban = {
  name: "エステ番長",
  async read(page, today) {
    const eb = await import("./sites/esban-portal.mjs");
    return eb.readCurrent(page, today);
  },
  plan(shifts, today, current, conf) {
    return planEsbanSync(shifts, today, { nameMap: conf.nameMap || {}, people: current.people.map((p) => p.name) });
  },
  async apply(page, changes, today, log) {
    const eb = await import("./sites/esban-portal.mjs");
    return eb.applyChanges(page, changes, today, log);
  },
};
SITES.estama = {
  name: "エステ魂",
  async read(page, today) {
    const es = await import("./sites/estama-portal.mjs");
    return es.readCurrent(page, planEstamaSync([], today).dates);
  },
  plan(shifts, today, current, conf) {
    return planEstamaSync(shifts, today, { nameMap: conf.nameMap || {}, people: current.people.map((p) => p.name) });
  },
  async apply(page, changes, today, log) {
    const es = await import("./sites/estama-portal.mjs");
    return es.applyChanges(page, changes, log);
  },
};
SITES.eslove = {
  name: "エステラブ",
  async read(page, today) {
    const el = await import("./sites/eslove-portal.mjs");
    return el.readCurrent(page, today);
  },
  plan(shifts, today, current, conf) {
    return planEsloveSync(shifts, today, { nameMap: conf.nameMap || {}, people: current.people.map((p) => p.name) });
  },
  async apply(page, changes, today, log) {
    const el = await import("./sites/eslove-portal.mjs");
    return el.applyChanges(page, changes, today, log);
  },
};
const siteOf = (id) => {
  const s = SITES[id];
  if (!s) throw new Error(`使えるサイト：${Object.keys(SITES).join(" / ")}`);
  return s;
};

async function siteState(config, page, id) {
  const site = siteOf(id);
  const { shifts, problems, today } = await prepare(config);
  if (problems.some((p) => p.level === "error")) {
    throw new Error("入力に誤り（✖）があります。check で内容を確かめ、スプレッドシートを直してから実行してください");
  }
  const conf = (config.sites && config.sites[id]) || {};
  const current = await site.read(page, today, conf);
  const plan = site.plan(shifts, today, current, conf);
  const changes = diffShifts(current, plan);
  return { site, today, current, plan, changes };
}

async function diff(id) {
  const config = loadConfig();
  await withBrowser(config, async (page) => {
    const { site, today, current, plan, changes } = await siteState(config, page, id);
    const text = [
      `${site.name}の今の登録：${current.people.map((p) => p.name).join("・")}（${current.dates[0]}〜${current.dates[current.dates.length - 1]}）`,
      formatChanges(site.name, changes, plan.skipped),
      "",
      "※ まだ何も書き込んでいません。反映するには apply を実行します（出勤の取り消しは番号を個別に指定）。",
    ].join("\n");
    console.log(text);
    save(`pending-${id}.json`, JSON.stringify({ createdAt: new Date().toISOString(), today, changes, skipped: plan.skipped }, null, 1));
    console.log(`\n（${save(`diff-${id}-${stamp()}.txt`, text + "\n")} に保存しました）`);
  });
}

async function apply(id) {
  const site = siteOf(id);
  const config = loadConfig();
  const pendingFile = join(OUT, `pending-${id}.json`);
  if (!existsSync(pendingFile)) throw new Error("先に diff を実行して、変更点を確認してください");
  const pending = JSON.parse(readFileSync(pendingFile, "utf8"));
  if (Date.now() - Date.parse(pending.createdAt) > 30 * 60e3) throw new Error("diff から30分以上たっています。もう一度 diff を実行して、最新の変更点を確認してください");
  const only = argList("--only"), removeNos = argList("--remove") || [];
  const chosen = selectChanges(pending.changes, { only, removeNos });
  if (!chosen.length) { console.log("実行する変更がありません"); return; }
  console.log(formatChanges(`${site.name}（これから実行するもの）`, chosen));
  if (!process.argv.includes("--yes")) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const a = await rl.question(`\nこの内容で${site.name}に書き込みますか？ 書き込む場合は yes と入力してください：`);
    rl.close();
    if (a.trim().toLowerCase() !== "yes") { console.log("やめました（何も書き込んでいません）"); return; }
  }
  const lines = [];
  const log = (s) => { console.log(s); lines.push(s); };
  await withBrowser(config, async (page) => {
    const { today, changes } = await siteState(config, page, id);
    // diff のあとにポータルやシートが変わっていないか（同じ変更点がそのまま残っているか）
    const key = (c) => `${c.date}|${c.name}|${c.before}|${c.after}`;
    const nowKeys = new Set(changes.map(key));
    const stale = chosen.filter((c) => !nowKeys.has(key(c)));
    if (stale.length) throw new Error(`diff のあとで内容が変わっています（${stale.map((c) => c.no).join(",")}番）。もう一度 diff を実行してください。何も書き込んでいません`);
    const fresh = changes.filter((c) => chosen.some((x) => key(x) === key(c)));
    const { results } = await site.apply(page, fresh, today, log);
    for (const r of results) log(`${r.ok ? "成功" : "失敗"}：${r.date} ${r.name} → ${r.after}（今の表示：${r.now}）`);
    const bad = results.filter((r) => !r.ok);
    log(bad.length ? `一致しなかったものが ${bad.length}件あります。${site.name}の画面で確認してください` : `すべて反映され、読み直して一致を確認しました（${results.length}件）`);
  });
  console.log(`\n（記録：${save(`apply-${id}-${stamp()}.txt`, lines.join("\n") + "\n")}）`);
}

const [cmd = "check", site] = process.argv.slice(2);
const run = { check, diff: () => diff(site), apply: () => apply(site) }[cmd];
if (!run) { console.error("使い方：node src/cli.mjs check | diff <サイト> | apply <サイト>（サイト：ekichika / esthe-ranking / esban / estama / eslove）"); process.exitCode = 1; }
else run().catch((e) => { console.error("止まりました：" + e.message); process.exitCode = 1; });
