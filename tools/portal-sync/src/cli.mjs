#!/usr/bin/env node
// ポータル一括更新ツール（フェーズ1：読み込み・点検・練習の一覧。ポータルには接続しない・書き込まない）
// 使い方：node src/cli.mjs check
//   設定：このフォルダの config.local.json（config.example.json を写して作る。Git には入れない）
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSource, displayNameMap } from "./source.mjs";
import { collectShifts, bizToday, siteTime } from "./shifts.mjs";
import { planEkichika } from "./sites/ekichika.mjs";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadConfig() {
  const p = join(HERE, "config.local.json");
  if (!existsSync(p)) throw new Error("config.local.json がありません。config.example.json を写して、スプレッドシートのURLを入れてください");
  return JSON.parse(readFileSync(p, "utf8"));
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
  L.push(`■ 駅ちか に入れる内容（練習。まだ書き込みません）：${plan.dates[0]}〜${plan.dates[plan.dates.length - 1]}`);
  for (const r of plan.rows) {
    const cells = r.cells.map((c) => (c.work ? `${c.date.slice(5)} ${c.start}-${c.end}` : `${c.date.slice(5)} 休`));
    L.push(`  ${r.name}：${cells.join(" / ")}`);
  }
  for (const s of plan.skipped) L.push(`  見送り ${s.date} ${s.name}：${s.reason}`);
  return L.join("\n");
}

async function check() {
  const config = loadConfig();
  const { schedule, roster } = await loadSource(config);
  const { shifts, problems } = collectShifts(schedule, displayNameMap(roster));
  const today = bizToday();
  const ek = (config.sites && config.sites.ekichika) || {};
  const plan = planEkichika(shifts, today, { nameMap: ek.nameMap || {}, people: ek.people || null });
  const text = formatReport({ today, problems, shifts, plan });
  console.log(text);
  const out = join(HERE, "out");
  mkdirSync(out, { recursive: true });
  const file = join(out, `check-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`);
  writeFileSync(file, text + "\n");
  console.log(`\n（この結果は ${file} にも保存しました）`);
  if (problems.some((p) => p.level === "error")) process.exitCode = 1;
}

const cmd = process.argv[2] || "check";
if (cmd === "check") check().catch((e) => { console.error("止まりました：" + e.message); process.exitCode = 1; });
else { console.error("使い方：node src/cli.mjs check"); process.exitCode = 1; }
