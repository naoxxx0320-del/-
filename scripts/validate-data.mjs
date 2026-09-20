/**
 * data/*.json の健全性チェック（CIで実行）。
 *
 * 目的：
 *  - 壊れたデータ（JSON構文エラー／必須配列が空など）での公開を防ぐ（＝ビルドを止める）
 *  - 軽微な不備（写真欠け・名簿にない名前・データ鮮度低下など）は警告として可視化
 *  - GitHub Actions のジョブサマリーに健全性レポートを出力（オーナーが一目で把握）
 *
 * 方針：
 *  - CRITICAL（致命的）が1つでもあれば exit 1（デプロイを止め、直前の公開を維持）
 *  - WARNING（警告）はデプロイを止めない（サイト運用を優先）
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");

const errors = []; // 致命的（デプロイを止める）
const warnings = []; // 警告（止めない）
const stats = []; // サマリー用の件数

const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

/** JSON を読む。壊れていれば CRITICAL。存在しなければ null（呼び出し側で判定）。 */
function load(name, { required = false } = {}) {
  const p = join(DATA, name);
  if (!existsSync(p)) {
    if (required) err(`${name}: ファイルが存在しません`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    err(`${name}: JSONの構文エラー（${e.message}）`);
    return null;
  }
}

/** 出勤時間文字列（例 "13:00〜翌2:00"）が解釈できるか。 */
function parsableShift(s) {
  return /(\d{1,2}):(\d{2})\s*[〜~\-]\s*(翌)?\s*(\d{1,2}):(\d{2})/.test(String(s || ""));
}

/** "YYYY/MM/DD" → Date（JST基準の素朴な変換）。失敗時 null。 */
function parseYmd(s) {
  const m = String(s || "").match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

// ---- roster.json（名簿：全ページの照合元） ----
const roster = load("roster.json", { required: true });
const rosterNames = new Set();
if (roster != null) {
  if (!Array.isArray(roster)) {
    err("roster.json: 配列ではありません");
  } else if (roster.length === 0) {
    err("roster.json: セラピストが0件です");
  } else {
    let noPhoto = 0;
    roster.forEach((t, i) => {
      if (!t || typeof t !== "object") return err(`roster[${i}]: オブジェクトではありません`);
      if (!String(t.name || "").trim()) err(`roster[${i}]: 名前がありません`);
      else rosterNames.add(t.name);
      if (t.id == null) warn(`roster「${t.name || i}」: id がありません`);
      if (!t.photo) noPhoto++;
    });
    stats.push(["セラピスト名簿", `${roster.length}名`]);
    if (noPhoto) warn(`写真未設定のセラピストが ${noPhoto}名 います`);
  }
}

// ---- schedule.json（出勤情報） ----
const schedule = load("schedule.json", { required: true });
if (schedule != null) {
  if (!schedule || !Array.isArray(schedule.days)) {
    err("schedule.json: days 配列がありません");
  } else {
    let shifts = 0;
    schedule.days.forEach((d, i) => {
      if (!d.date) err(`schedule.days[${i}]: 日付がありません`);
      if (!Array.isArray(d.list)) return err(`schedule.days[${i}]: list がありません`);
      d.list.forEach((e, j) => {
        shifts++;
        if (!String(e.name || "").trim()) err(`schedule ${d.label || d.date}[${j}]: 名前がありません`);
        else if (rosterNames.size && !rosterNames.has(e.name))
          warn(`出勤情報「${e.name}」は名簿(roster)に存在しません`);
        if (e.time && !parsableShift(e.time))
          warn(`出勤時間「${e.name}: ${e.time}」の形式が想定外です`);
      });
    });
    stats.push(["出勤情報", `${schedule.days.length}日 / 延べ${shifts}枠`]);
    if (schedule.days.length === 0) warn("schedule.json: 出勤日が0件です");
  }
}

// ---- guide.json（案内状況：鮮度もチェック） ----
const guide = load("guide.json");
if (guide != null) {
  if (!Array.isArray(guide.areas)) err("guide.json: areas 配列がありません");
  else {
    const n = guide.areas.reduce((a, g) => a + (g.list?.length || 0), 0);
    stats.push(["案内状況", `${guide.areas.length}エリア / ${n}名`]);
  }
  const gd = parseYmd(guide.date);
  if (gd) {
    const ageDays = Math.floor((Date.now() - gd.getTime()) / 86400000);
    stats.push(["案内状況の日付", `${guide.date}（更新 ${guide.updated || "?"}）`]);
    if (ageDays > 3) warn(`案内状況の日付が ${ageDays}日 前です（シート取得が停止している可能性）`);
  }
}

// ---- reserve-config.json（予約設定） ----
const rc = load("reserve-config.json", { required: true });
if (rc != null) {
  if (!rc.endpoint || !/^https:\/\//.test(rc.endpoint))
    warn("reserve-config.json: endpoint が未設定です（WEB予約の送信ができません）");
  if (!Array.isArray(rc.courses) || rc.courses.length === 0) {
    err("reserve-config.json: courses が空です");
  } else {
    rc.courses.forEach((c, i) => {
      if (!c.label) err(`courses[${i}]: label がありません`);
      if (typeof c.price !== "number" || !(c.price > 0))
        err(`courses[${i}]（${c.label || ""}）: price が不正です`);
    });
    stats.push(["予約コース", `${rc.courses.length}件`]);
  }
}

// ---- 上書きファイル（名簿に無い名前は警告） ----
for (const name of ["photo-overrides.json", "therapist-details.json"]) {
  const ov = load(name);
  if (ov && typeof ov === "object" && rosterNames.size) {
    for (const k of Object.keys(ov))
      if (!rosterNames.has(k)) warn(`${name}: 「${k}」は名簿(roster)に存在しません`);
  }
}

// ---- レポート出力 ----
const lines = [];
lines.push("## データ健全性チェック", "");
if (stats.length) {
  lines.push("| 項目 | 件数 |", "| --- | --- |");
  for (const [k, v] of stats) lines.push(`| ${k} | ${v} |`);
  lines.push("");
}
lines.push(
  errors.length
    ? `❌ **CRITICAL: ${errors.length}件**（デプロイを中止します）`
    : "✅ 致命的な問題はありません",
  warnings.length ? `⚠️ 警告: ${warnings.length}件` : "✅ 警告はありません",
  ""
);
if (errors.length) {
  lines.push("### ❌ 致命的な問題");
  for (const m of errors) lines.push(`- ${m}`);
  lines.push("");
}
if (warnings.length) {
  lines.push("### ⚠️ 警告");
  for (const m of warnings) lines.push(`- ${m}`);
  lines.push("");
}
const report = lines.join("\n");

// コンソール出力（＋GitHub注釈）
console.log(report);
for (const m of errors) console.log(`::error::${m}`);
for (const m of warnings) console.log(`::warning::${m}`);

// GitHub Actions のジョブサマリーへ追記
if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");
  } catch (e) {
    console.error("step summary 書き込み失敗:", e.message);
  }
}

process.exit(errors.length ? 1 : 0);
