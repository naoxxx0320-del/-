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
  const text = await res.text();
  // 共有設定切れ等でCSVの代わりにHTML（ログイン/エラー画面）が返ることがある。
  // それをデータとして取り込むと空データで上書きしてしまうため、エラー扱いにする。
  const head = text.slice(0, 300).trim().toLowerCase();
  if (head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<head")) {
    throw new Error("CSVではなくHTMLが返却されました（シートの共有設定/URLを確認してください）");
  }
  return text;
}

/** 生成結果が空か（days が空、または配列が空）。空なら既存データを保持する。 */
function isEmptyBuilt(built) {
  if (Array.isArray(built)) return built.length === 0;
  // 出勤情報は過去日を除くと0日になり得る（今日以降の登録が無い）。その場合も空として上書きする
  if (built && Array.isArray(built.days)) return built.days.length === 0 && !built.today;
  return false;
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

// 週間出勤表の今日の行 → 名簿の absent（今日出ない人は absent:true）と本日の表示（時間・空き・案内時刻）
function todayEntries(sched) {
  const day = (sched.days || []).find((d) => dayKeyNum(d.date) === dayKeyNum(sched.today));
  return day ? day.list : [];
}
function applyTodayFromSchedule(roster, sched) {
  const list = todayEntries(sched);
  const byName = new Map(list.map((e, i) => [e.name, { ...e, i }]));
  return roster.map((t) => {
    const e = byName.get(t.name);
    if (!e) return { ...t, absent: true };
    return { ...t, absent: false, sched: e.time ? `本日 ${e.time}` : t.sched, status: e.status || t.status, guideTime: e.guideTime || "", todayOrder: e.i };
  });
}
function buildGuideFromSchedule(sched) {
  const list = todayEntries(sched).map((e) => ({ name: e.name, time: e.guideTime || "", status: e.status || "" }));
  return { date: sched.today, updated: sched.updated || jstNow().time, areas: list.length ? [{ area: sched.area || "亀戸", list }] : [] };
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

// 「開始」「終了」に分かれた表の時間 → "13:00〜翌2:00"。終了が開始以前なら翌日（翌を補う）。
function joinShiftTime(start, end) {
  const t = (v) => String(v || "").trim().replace(/^(\d{1,2}:\d{2}):00$/, "$1");
  const s = t(start), e = t(end);
  if (!s) return "";
  if (!e) return s;
  const min = (x) => { const m = x.match(/^(翌)?(\d{1,2}):(\d{2})$/); return m ? (m[1] ? 1440 : 0) + +m[2] * 60 + +m[3] : null; };
  const sm = min(s), em = min(e);
  const e2 = sm != null && em != null && em <= sm && !e.startsWith("翌") ? "翌" + e : e;
  return `${s}〜${e2}`;
}

function dayKeyNum(date) {
  const m = String(date || "").match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  return m ? +m[1] * 10000 + +m[2] * 100 + +m[3] : null;
}
function keyToSlash(k) {
  return `${Math.floor(k / 10000)}/${Math.floor((k % 10000) / 100)}/${k % 100}`;
}
function bizTodayKey(nowMs = Number(process.env.SCHEDULE_NOW_MS) || Date.now()) {
  const j = new Date(nowMs + 9 * 3600e3 - 6 * 3600e3);
  return j.getUTCFullYear() * 10000 + (j.getUTCMonth() + 1) * 100 + j.getUTCDate();
}

// 「ラベル」が空の行の表示名（"2026/9/20" → "9/20(日)"）。読めない日付はそのまま。
function autoDayLabel(date) {
  const m = String(date).match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (!m) return date;
  const wd = "日月火水木金土"[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
  return `${+m[2]}/${+m[3]}(${wd})`;
}

// 出勤情報: 列 = 日付, ラベル, 名前, 出勤時間（または 開始・終了）, ステータス, 出勤(○/✖️), 区分(確定/申請中/希望休)
function buildSchedule(objs) {
  const daysMap = new Map();
  for (const o of objs) {
    const date = o["日付"] || "";
    if (!date) continue;
    if (isAbsent(o["出勤"])) continue; // ✖️（欠勤）はサイトに出さない
    if (isDraft(o["区分"])) continue; // 申請中・希望休はサイトに出さない（確定のみ）
    if (!daysMap.has(date))
      daysMap.set(date, { date, label: o["ラベル"] || autoDayLabel(date), list: [] });
    const ord = String(o["並び"] || o["並び順"] || o["表示順"] || "").trim();
    daysMap.get(date).list.push({
      name: o["名前"] || "",
      time: o["出勤時間"] || o["時間"] || joinShiftTime(o["開始"], o["終了"]),
      status: o["ステータス"] || "",
      // 本日の出勤の「次の案内時刻」（管理画面の「本日」で更新）
      guideTime: String(o["案内時刻"] || o["案内時間"] || "").trim().replace(/^(\d{1,2}:\d{2}):00$/, "$1").replace(/[〜~\s]+$/, ""),
      ...(ord !== "" && !isNaN(Number(ord)) ? { order: Number(ord) } : {}),
    });
  }
  // 並び（管理画面で指定）がある人を先に、その順で。無い人はシートの順のまま後ろへ。
  for (const d of daysMap.values()) {
    d.list = d.list
      .map((e, i) => [e, i])
      .sort((a, b) => (a[0].order ?? 1e9) - (b[0].order ?? 1e9) || a[1] - b[1])
      .map(([e]) => e);
  }
  // 過去の日（日本時間の営業日。朝6時までは前日扱い）はサイトに出さない。シートの行はそのまま。
  // 表示側（出勤情報ページ）でも閲覧時点で同じ絞り込みをするので、次の更新までに日付が変わっても古い日は出ない。
  const today = bizTodayKey();
  const days = [...daysMap.values()]
    .filter((d) => { const k = dayKeyNum(d.date); return k == null || k >= today; })
    .sort((a, b) => (dayKeyNum(a.date) ?? 0) - (dayKeyNum(b.date) ?? 0));
  const now = jstNow();
  // today: 公開時点の営業日（表示側は閲覧時点の営業日で選び直す）。updated: 取り込んだ時刻
  return { area: objs[0]?.["エリア"] || "亀戸", today: keyToSlash(today), updated: now.time, days };
}

// セラピスト名簿（本日の出勤カード／出勤情報／セラピスト一覧・詳細ページの照合元）:
// 列 = 名前,出勤,案内時刻,年齢,T,B,カップ,W,H,ハート,ラベル,新人,出勤リボン,スケジュール,サブ,ステータス,タグ,SNS,写真,プロフィール
//   ・表示名 … 任意。詳細ページに出すフルネーム（例「白花 かれん」）。空なら名前
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
      id: i + 1, // 詳細ページ /therapist/<id>/ の安定ID（名簿の並び順）
      name: o["名前"] || "",
      // 「表示名」列（例: 白花 かれん）があれば詳細ページの表示名に使う。空なら名前。
      ...((o["表示名"] || o["フルネーム"] || "").trim()
        ? { nameFull: (o["表示名"] || o["フルネーム"]).trim() }
        : {}),
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

/** 写真の上書き対応表（data/photo-overrides.json）を roster に適用。
 *  セラピスト名 → ファイル名（複数枚は配列）で、シートの写真列より優先。
 *  → 画像を渡してもらえれば Claude 側でここを管理でき、シート更新でも消えない。
 *  例: { "花恋": "therapist-karen.jpg", "みお": ["mio1.jpg","mio2.jpg"] } */
function applyPhotoOverrides(roster) {
  const p = join(DATA, "photo-overrides.json");
  if (!existsSync(p)) return roster;
  let map = {};
  try {
    map = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.error("photo-overrides parse error:", e.message);
    return roster;
  }
  let n = 0;
  const out = roster.map((t) => {
    const ov = map[t.name];
    if (ov == null) return t;
    const photos = (Array.isArray(ov) ? ov : [ov])
      .map((s) => String(s).trim())
      .filter(Boolean);
    if (!photos.length) return t;
    n++;
    return { ...t, photo: photos[0], photos };
  });
  if (n) console.log(`photo-overrides: ${n} 名に適用`);
  return out;
}

/** セラピスト詳細の上書き（data/therapist-details.json）を roster に適用。
 *  セラピスト名 → { nameFull, age, height, cup, stats, tags, sns, profile ... } を
 *  シートの値に浅くマージ（指定した項目のみ上書き）。詳細ページの紹介文など、
 *  シートに列が無い情報を Claude 側で管理し、シート更新でも消えないようにする。 */
function applyDetailOverrides(roster) {
  const p = join(DATA, "therapist-details.json");
  if (!existsSync(p)) return roster;
  let map = {};
  try {
    map = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.error("therapist-details parse error:", e.message);
    return roster;
  }
  let n = 0;
  const out = roster.map((t) => {
    const ov = map[t.name];
    if (!ov || typeof ov !== "object") return t;
    n++;
    return { ...t, ...ov };
  });
  if (n) console.log(`therapist-details: ${n} 名に適用`);
  return out;
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
      // 案内状況は出勤情報（今日の行）から作る（下の applyTodayFromSchedule）
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
      if (isEmptyBuilt(built)) {
        console.log(`skip ${j.file}: 生成結果が空のため既存データを保持`);
        continue;
      }
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
  // 本日の出勤・只今の案内状況は、週間出勤表（schedule.json の今日の行）から作る
  const sched = readJSON("schedule.json");
  if (sched && sched.today) {
    const r0 = readJSON("roster.json");
    if (r0) {
      const r1 = applyTodayFromSchedule(r0, sched);
      if (JSON.stringify(r1) !== JSON.stringify(r0)) { writeJSON("roster.json", r1); updated++; }
    }
    writeJSON("guide.json", buildGuideFromSchedule(sched));
    updated++;
  }
  // 写真・詳細の上書きを roster.json に適用（シート取得の有無にかかわらず常に）
  const roster = readJSON("roster.json");
  if (roster) {
    let applied = applyPhotoOverrides(roster);
    applied = applyDetailOverrides(applied);
    if (JSON.stringify(applied) !== JSON.stringify(roster)) {
      writeJSON("roster.json", applied);
      updated++;
    }
  }
  writePhotoVersions();
  console.log(`done. ${updated} file(s) updated.`);
}

export { parseCSV, toObjects, buildGuideFromRoster, buildSchedule, buildRoster, applyTodayFromSchedule, buildGuideFromSchedule };

// 直接実行時のみ処理を走らせる（テストからの import では走らせない）
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run();
}
