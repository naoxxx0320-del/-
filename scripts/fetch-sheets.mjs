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

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const PUBLIC = join(ROOT, "public");

/** public/ 内の画像ファイルの内容ハッシュ（版）を data/photo-versions.json に出力。
 *  写真を同じファイル名で差し替えても、内容が変わればURLの ?v= が変わり、
 *  ブラウザ／CDNのキャッシュを確実に無効化できる。 */
function writePhotoVersions() {
  const versions = {};
  try {
    for (const f of readdirSync(PUBLIC)) {
      if (!/\.(jpe?g|png|webp|gif)$/i.test(f)) continue;
      const buf = readFileSync(join(PUBLIC, f));
      versions[f] = createHash("md5").update(buf).digest("hex").slice(0, 8);
    }
    writeFileSync(
      join(DATA, "photo-versions.json"),
      JSON.stringify(versions, null, 2) + "\n"
    );
    console.log(`photo-versions: ${Object.keys(versions).length} 件`);
  } catch (e) {
    console.error("photo-versions error:", e.message);
  }
}

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

// 只今の案内状況：セラピスト名簿（本日の出勤）から自動生成。
// 出勤中(✖️以外)の人を、名前＋案内時刻＋ステータスで一覧化。日付・更新時刻は自動。
function buildGuideFromRoster(roster) {
  const { date, time } = jstNow();
  const areasMap = new Map();
  for (const t of roster) {
    if (t.absent) continue;
    const area = t.area || "亀戸";
    if (!areasMap.has(area)) areasMap.set(area, []);
    areasMap.get(area).push({
      name: t.name,
      time: (t.guideTime || "").replace(/[〜~\s]+$/, ""), // 末尾の〜は表示側で付与
      status: t.status || "",
    });
  }
  return {
    date,
    updated: time,
    areas: [...areasMap].map(([area, list]) => ({ area, list })),
  };
}

// 「出勤」列が欠勤（✖️ など）かどうか。○・空欄は出勤扱い（表示）。
const isAbsent = (v) =>
  /^(✖️|✖|✗|×|✕|x|欠|欠勤|休|no|false|非表示)$/i.test((v || "").trim());

// 「在籍」列が非在籍（退店・休業など）かどうか。在籍・空欄・○は在籍扱い（表示）。
const isInactive = (v) =>
  /^(退店|退職|卒業|休業|休職|off|非表示|×|✖️|✖)$/i.test((v || "").trim());

// 「区分」列が未確定（申請中・希望休など）かどうか。確定・空欄はサイト表示。
const isDraft = (v) =>
  /^(申請|申請中|希望|希望休|未確定|保留|draft|下書き)$/i.test((v || "").trim());

// 出勤情報: 列 = 日付, ラベル, 名前, 出勤時間, ステータス, 出勤(○/✖️), 区分(確定/申請中/希望休)
function buildSchedule(objs) {
  const daysMap = new Map();
  for (const o of objs) {
    const date = o["日付"] || "";
    if (!date) continue;
    if (isAbsent(o["出勤"])) continue; // ✖️（欠勤）はサイトに出さない
    if (isDraft(o["区分"])) continue; // 申請中・希望休はサイトに出さない（確定のみ）
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

// セラピスト名簿（本日の出勤カード／出勤情報／セラピスト一覧・詳細ページの照合元）:
// 列 = 名前,出勤,案内時刻,年齢,T,B,カップ,W,H,ハート,ラベル,新人,出勤リボン,スケジュール,サブ,ステータス,タグ,SNS,写真,プロフィール
//   ・写真   … 複数枚は「;」区切り（先頭がメイン、残りは詳細ページのサブ写真）
//   ・プロフィール … 詳細ページの紹介文（「コメント」「紹介文」列でも可）
// 全員ぶんを出力し、欠勤(✖️)は absent:true を付与（表示側で除外／案内に利用）。
function buildRoster(objs) {
  const truthy = (v) => /^(1|true|○|◯|〇|はい|yes|y)$/i.test((v || "").trim());
  const bgs = [
    "linear-gradient(160deg,#e7dac2 0%,#d4c09e 55%,#c8b58c 100%)",
    "linear-gradient(160deg,#efe6d6 0%,#ddccb0 55%,#cebf9f 100%)",
  ];
  return objs
    .filter((o) => (o["名前"] || "").trim() !== "")
    .filter((o) => !isInactive(o["在籍"])) // 退店・休業は全ページから除外
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
      height: o["T"] || "",
      cup: o["カップ"] || "",
      tags: (o["タグ"] || "").split(";").map((s) => s.trim()).filter(Boolean),
      sched: o["スケジュール"] || "",
      schedSub: o["サブ"] || "",
      status: o["ステータス"] || "",
      guideTime: o["案内時刻"] || o["案内時間"] || "",
      area: o["エリア"] || "亀戸",
      sns: (o["SNS"] || "").split(";").map((s) => s.trim()).filter(Boolean),
      // 写真列は「;」区切りで複数指定可。先頭がメイン写真、残りは詳細ページのサブ写真。
      ...(() => {
        const photos = (o["写真"] || "")
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean);
        return photos.length ? { photo: photos[0], photos } : {};
      })(),
      profile: o["プロフィール"] || o["コメント"] || o["紹介文"] || "",
      photoBg: bgs[i % bgs.length],
      absent: isAbsent(o["出勤"]),
    }));
}

/* ---- メイン ---- */
async function run() {
  const jobs = [
    { env: "SCHEDULE_CSV_URL", file: "schedule.json", build: buildSchedule, marker: "日付" },
    // セラピスト（本日の出勤）シートから roster.json を作り、案内状況(guide.json)も自動生成
    {
      env: "THERAPISTS_CSV_URL",
      file: "roster.json",
      build: buildRoster,
      marker: "スケジュール",
      derive: (roster) => ["guide.json", buildGuideFromRoster(roster)],
    },
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
      const built = j.build(objs);
      writeJSON(j.file, built);
      updated++;
      if (j.derive) {
        const [dfile, dobj] = j.derive(built);
        writeJSON(dfile, dobj);
        updated++;
      }
    } catch (e) {
      console.error(`error ${j.file}: ${e.message}`);
      process.exitCode = 1;
    }
  }
  writePhotoVersions();
  console.log(`done. ${updated} file(s) updated.`);
}

export { parseCSV, toObjects, buildGuideFromRoster, buildSchedule, buildRoster };

// 直接実行時のみ処理を走らせる（テストからの import では走らせない）
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run();
}
