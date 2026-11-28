#!/usr/bin/env node
// 自動実行（Mac の launchd から1時間ごとに呼ばれる）。作業用ブラウザ（src/browser.mjs）が開いている前提。
// 順番：⓪ログインの確認（切れていればキーチェーンの ID・パスワードで入り直す）①出勤の反映（出勤を入れる・時間を変えるだけ。取り消しはしない）②写メ日記の転載（駅ちか）③ニュース ④上位表示
// どれかで止まっても次へ進む。ログインが切れているなど、オーナーの対応が必要なときは Mac の通知で知らせる。
// エステ魂：オーナーがエステ魂に電話で確認（2026-11-28）。ニュース・セラピストアピール・集客ワンクリックアピールの自動化は問題ない。
//   禁止されているのは、IP を変えて自分のお店に何度もアクセスし表示順位を上げること（このツールはしない）。
//   ニュースを止めるときは config.local.json の auto.estamaNews を false に。アピールは src/boost.mjs。
//   node src/auto.mjs          … すべて
//   node src/auto.mjs --dry    … 何も書き込まず、各段階の予定だけ表示
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(HERE, "out");
const NODE = process.execPath;
const DRY = process.argv.includes("--dry");
const config = JSON.parse(readFileSync(join(HERE, "config.local.json"), "utf8"));
const auto = config.auto || {};
const SHIFT_SITES = auto.shiftSites || ["ekichika", "esthe-ranking", "esban", "estama", "eslove"];
const NEWS_SITES = auto.newsSites || ["ekichika", "esban", "eslove", "esthe-ranking", ...(auto.estamaNews === false ? [] : ["estama"])];

const log = (s) => { console.log(s); mkdirSync(OUT, { recursive: true, mode: 0o700 }); appendFileSync(join(OUT, "auto-log.txt"), `${new Date().toISOString()} ${s}\n`); };
function notify(msg) {
  if (process.platform !== "darwin") return;
  const safe = msg.replace(/["\\]/g, "").slice(0, 180);
  spawnSync("/usr/bin/osascript", ["-e", `display notification "${safe}" with title "掲載サイトの自動更新" sound name "Glass"`]);
}
function run(args, { timeoutMs = 15 * 60e3 } = {}) {
  const r = spawnSync(NODE, args, { cwd: HERE, encoding: "utf8", timeout: timeoutMs });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  return { ok: r.status === 0, out };
}
const needsLogin = (s) => /ログインしていません|作業用ブラウザが開いていません|ロボット判定/.test(s);

async function main() {
  log(`---- 自動実行${DRY ? "（予定の表示だけ）" : ""} ----`);
  const problems = [];
  // ⓪ ログインの確認（駅ちか・全国メンズエステランキング。切れていればキーチェーンの ID・パスワードでログインし直す）
  if (!DRY) {
    const al = run(["src/autologin.mjs"], { timeoutMs: 5 * 60e3 });
    for (const l of al.out.split("\n").filter((x) => /：/.test(x))) log(`ログイン ${l}`);
    if (!al.ok) problems.push("ログインが切れているサイトがあります（自動でログインし直せませんでした）");
  }
  // ① 出勤の反映
  for (const site of SHIFT_SITES) {
    const d = run(["src/cli.mjs", "diff", site]);
    const line = (d.out.match(/■ .*変更点 \d+件/) || [d.out.split("\n").pop()])[0];
    log(`出勤 ${site}：${line}`);
    if (!d.ok) { problems.push(`${site} の出勤を読めません`); if (needsLogin(d.out)) problems.push(`${site} にログインが必要です`); continue; }
    if (DRY || /変更点 0件/.test(d.out)) continue;
    const a = run(["src/cli.mjs", "apply", site, "--yes"]); // 取り消し（削除系）は番号指定がないため実行されない
    log(`出勤 ${site}：${(a.out.match(/すべて反映.*|一致しなかったもの.*|止まりました.*/) || ["（結果なし）"])[0]}`);
    if (!a.ok) problems.push(`${site} の出勤の反映で止まりました`);
    if (/取り消す（要確認）/.test(d.out)) problems.push(`${site} に取り消し候補の出勤があります（手で確認してください）`);
  }
  // ② 写メ日記の転載
  const dp = run(["src/diary-post.mjs", DRY ? "plan" : "run"]);
  log(`写メ日記：${dp.out.split("\n").filter(Boolean).slice(-2).join(" / ")}`);
  if (!dp.ok) problems.push("写メ日記の転載で止まりました");
  // ③ ニュース
  for (const site of NEWS_SITES) {
    const n = run(["src/news.mjs", DRY ? "plan" : "run", "--site", site]);
    log(`ニュース ${site}：${n.out.split("\n").filter((l) => /：今日|止まりました/.test(l)).slice(-1)[0] || n.out.split("\n").pop()}`);
    if (!n.ok || /止まりました/.test(n.out)) { problems.push(`${site} のニュースで止まりました`); if (needsLogin(n.out)) problems.push(`${site} にログインが必要です`); }
  }
  // ④ 上位表示
  const bo = run(["src/boost.mjs", DRY ? "plan" : "run"]);
  log(`上位表示：${bo.out.split("\n").filter(Boolean).pop() || ""}`);
  if (!bo.ok) problems.push("上位表示で止まりました");

  if (problems.length) {
    const uniq = [...new Set(problems)];
    log(`要確認：${uniq.join("／")}`);
    if (!DRY) notify(uniq.slice(0, 3).join("／"));
  } else log("すべて終わりました");
}
main().catch((e) => { log("自動実行：止まりました：" + e.message); notify("自動実行が止まりました：" + e.message); process.exitCode = 1; });
