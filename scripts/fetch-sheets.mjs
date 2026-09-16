/**
 * Googleスプレッドシート（ウェブ公開CSV）→ data/*.json 変換スクリプト。
 *
 * GitHub Actions から定期実行されます。各シートの「ウェブに公開(CSV)」URL を
 * リポジトリの Variables に登録すると、その内容で data/*.json を更新します。
 *   - GUIDE_CSV_URL       … 案内状況シート
 *   - SCHEDULE_CSV_URL    … 出勤情報シート
 *   - THERAPISTS_CSV_URL  … 本日の出勤（セラピスト）シート
 *
 * URL が未設定のデータは更新をスキップし、既存の内容を保持します。
 * これにより、URL 登録前でもサンプルデータのままサイトが動作します。
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");

/* ---- CSV パーサ（引用符・改行対応） ---- */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * ヘッダ行 + データ行 → オブジェクト配列（空行は除外）。
 * `marker`（必須列名）を指定すると、その列名を含む行を見出し行として探し、
 * それより上の説明行・空行は読み飛ばします（見つからなければ先頭行を見出しとする）。
 */
function toObjects(text, marker) {
  const rows = parseCSV(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0) return [];
  let headerIdx = 0;
  if (marker) {
    const found = rows.findIndex((r) => r.map((c) => c.trim()).includes(marker));
    if (found >= 0) headerIdx = found;
  }
  const headers = rows[headerIdx].map((h) => h.trim());
  return rows.slice(headerIdx + 1).map((r) => {
    const o = {};
    headers.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

async function fetchCSV(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function readJSON(name) {
  const p = join(DATA, name);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}
function writeJSON(name, obj) {
  writeFileSync(join(DATA, name), JSON.stringify(obj, null, 2) + "\n");
  console.log(`updated data/${name}`);
}

/** 現在の JST 日付・時刻 */
function jstNow() {
  const fmt = (opts) =>
    new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", ...opts }).format(
      new Date()
    );
  const date = fmt({ year: "numeric", month: "numeric", day: "numeric" }).replace(
    /-/g,
    "/"
  );
  const time = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
  return { date, time };
}

/* ---- 変換ロジック ---- */

// 案内状況: 列 = エリア, 名前, 案内時間, ステータス
function buildGuide(objs) {
  const areasMap = new Map();
  for (const o of objs) {
    const area = o["エリア"] || "亀戸";
    if (!areasMap.has(area)) areasMap.set(area, []);
    areasMap.get(area).push({
      name: o["名前"] || "",
      time: o["案内時間"] || o["時間"] || "",
      status: o["ステータス"] || "",
    });
  }
  const { date, time } = jstNow();
  return {
    date,
    updated: time,
    areas: [...areasMap].map(([area, list]) => ({ area, list })),
  };
}

// 出勤情報: 列 = 日付, ラベル, 名前, 出勤時間, ステータス
function buildSchedule(objs) {
  const daysMap = new Map();
  for (const o of objs) {
    const date = o["日付"] || "";
    if (!date) continue;
    if (!daysMap.has(date))
      daysMap.set(date, { date, label: o["ラベル"] || date, list: [] });
    daysMap.get(date).list.push({
      name: o["名前"] || "",
      time: o["出勤時間"] || o["時間"] || "",
      status: o["ステータス"] || "",
    });
  }
  return { area: objs[0]?.["エリア"] || "亀戸", days: [...daysMap.values()] };
}

// 本日の出勤カード: 列 = 名前,出勤,年齢,T,B,カップ,W,H,ハート,ラベル,新人,出勤リボン,スケジュール,サブ,ステータス,SNS,写真
// 「出勤」列が ✖️（欠勤）の行はサイトに表示しません（○や空欄は表示）。
function buildTherapists(objs) {
  const truthy = (v) => /^(1|true|○|◯|〇|はい|yes|y)$/i.test((v || "").trim());
  const isAbsent = (v) =>
    /^(✖️|✖|✗|×|✕|x|欠|欠勤|休|no|false|非表示)$/i.test((v || "").trim());
  const bgs = [
    "linear-gradient(160deg,#e7dac2 0%,#d4c09e 55%,#c8b58c 100%)",
    "linear-gradient(160deg,#efe6d6 0%,#ddccb0 55%,#cebf9f 100%)",
  ];
  return objs
    .filter((o) => !isAbsent(o["出勤"]))
    .map((o, i) => ({
    name: o["名前"] || "",
    age: o["年齢"] || "",
    heart: o["ハート"] || (i % 2 ? "diamond" : "pink"),
    heartLabel: o["ラベル"] || (o["ハート"] === "diamond" ? "◆" : "AJ"),
    ribbon: o["出勤リボン"] || null,
    isNew: truthy(o["新人"]),
    stats: [
      `T.${o["T"] || ""}`,
      `B.${o["B"] || ""}${o["カップ"] ? `(${o["カップ"]})` : ""}`,
      `W.${o["W"] || ""}`,
      `H.${o["H"] || ""}`,
    ],
    sched: o["スケジュール"] || "",
    schedSub: o["サブ"] || "",
    status: o["ステータス"] || "",
    sns: (o["SNS"] || "").split(";").map((s) => s.trim()).filter(Boolean),
    ...(o["写真"] ? { photo: o["写真"] } : {}),
    photoBg: bgs[i % bgs.length],
  }));
}

/* ---- メイン ---- */
async function run() {
  const jobs = [
    { env: "GUIDE_CSV_URL", file: "guide.json", build: buildGuide, marker: "案内時間" },
    { env: "SCHEDULE_CSV_URL", file: "schedule.json", build: buildSchedule, marker: "日付" },
    { env: "THERAPISTS_CSV_URL", file: "therapists.json", build: buildTherapists, marker: "スケジュール" },
  ];
  let updated = 0;
  for (const j of jobs) {
    const url = process.env[j.env];
    if (!url) {
      console.log(`skip ${j.file}: ${j.env} 未設定（既存データを保持）`);
      continue;
    }
    try {
      const csv = await fetchCSV(url);
      const objs = toObjects(csv, j.marker);
      if (objs.length === 0) {
        console.log(`skip ${j.file}: シートが空です`);
        continue;
      }
      writeJSON(j.file, j.build(objs));
      updated++;
    } catch (e) {
      console.error(`error ${j.file}: ${e.message}`);
      process.exitCode = 1;
    }
  }
  console.log(`done. ${updated} file(s) updated.`);
}

export { parseCSV, toObjects, buildGuide, buildSchedule, buildTherapists };

// 直接実行時のみ処理を走らせる（テストからの import では走らせない）
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run();
}
