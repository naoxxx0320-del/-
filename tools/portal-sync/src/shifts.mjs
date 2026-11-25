// 出勤データ（schedule.json と同じ形）→ ポータルに入れる「出勤の一覧」と、入力の点検。
// 時間は「営業日の0:00からの分」で持つ（翌2:00 = 26:00 = 1560分）。朝6時までの開始は前日の営業日の続きとみなす。

export const DAY_START_MIN = 6 * 60; // 営業日の切り替え（サイトと同じく朝6時）

/** "2026/11/25" や "2026-11-25" → "2026-11-25"（読めなければ null） */
export function isoDate(s) {
  const m = String(s || "").match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/** "13:00" "翌2:00" "26:00" → 営業日の0:00からの分。読めなければ null */
export function toMinutes(s, { isStart = false } = {}) {
  const m = String(s || "").trim().match(/^(翌)?(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  let v = +m[2] * 60 + +m[3];
  if (+m[3] >= 60) return null;
  if (m[1]) v += 1440;
  // 開始が朝6時より前（例「1:00」）は、その営業日の深夜（翌1:00）
  if (isStart && !m[1] && v < DAY_START_MIN) v += 1440;
  return v;
}

/** "12:00〜18:00" "13:00〜翌2:00" "13:00"（終了なし）"" → {start, end}（分。無ければ null） */
export function parseTimeRange(t) {
  const s = String(t || "").replace(/\s/g, "").replace(/[～~]/g, "〜");
  if (!s) return { start: null, end: null, raw: "" };
  const [a, b] = s.split("〜");
  const start = toMinutes(a, { isStart: true });
  let end = b ? toMinutes(b) : null;
  // 終了が開始以前で「翌」が無い（例 20:00〜2:00）→ 翌日とみなす
  if (start != null && end != null && end <= start && end < 1440) end += 1440;
  return { start, end, raw: s };
}

/** 分 → "26:00" の形（2桁） */
export function hhmm(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 分 → サイトと同じ書き方（"翌2:00"） */
export function siteTime(min) {
  if (min == null) return "";
  const n = min >= 1440 ? min - 1440 : min;
  return (min >= 1440 ? "翌" : "") + `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}

/**
 * schedule（days[].list[]）と名簿から、出勤の一覧と点検結果を作る。
 * 戻り値 { shifts: [{date, key, name, start, end}], problems: [{level:"error"|"warn", date, name, message}] }
 *   key = シートの名前（照合キー）、name = 表示名（ポータルに出す名前）
 */
export function collectShifts(schedule, nameMap = new Map()) {
  const shifts = [], problems = [];
  const seen = new Set();
  for (const d of (schedule && schedule.days) || []) {
    const date = isoDate(d.date);
    if (!date) { problems.push({ level: "error", date: String(d.date), name: "", message: "日付が読めません" }); continue; }
    for (const e of d.list || []) {
      const key = String(e.name || "").trim();
      if (!key) { problems.push({ level: "error", date, name: "", message: "名前が空の出勤があります" }); continue; }
      const name = nameMap.get(key) || key;
      if (nameMap.size && !nameMap.has(key)) problems.push({ level: "warn", date, name: key, message: "名簿（本日の出勤シート）にいない名前です" });
      const id = `${date}|${name}`;
      if (seen.has(id)) { problems.push({ level: "error", date, name, message: "同じ日に同じ人の出勤が2つあります" }); continue; }
      seen.add(id);
      const r = parseTimeRange(e.time);
      if (r.start == null) {
        problems.push({ level: "warn", date, name, message: r.raw ? `出勤時間「${r.raw}」が読めません` : "出勤時間が未定です（時間のいるポータルには反映しません）" });
        shifts.push({ date, key, name, start: null, end: null });
        continue;
      }
      if (r.start % 30 || (r.end != null && r.end % 30)) problems.push({ level: "error", date, name, message: `出勤時間「${r.raw}」が30分単位ではありません（ポータルは30分単位）` });
      if (r.end != null && r.end <= r.start) problems.push({ level: "error", date, name, message: `終了「${siteTime(r.end)}」が開始より前です` });
      shifts.push({ date, key, name, start: r.start, end: r.end });
    }
  }
  shifts.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? 1e9) - (b.start ?? 1e9) || a.name.localeCompare(b.name));
  return { shifts, problems };
}

/** 営業日の今日（"2026-11-25"）。朝6時までは前日 */
export function bizToday(nowMs = Date.now()) {
  const j = new Date(nowMs + 9 * 3600e3 - DAY_START_MIN * 60e3);
  return `${j.getUTCFullYear()}-${String(j.getUTCMonth() + 1).padStart(2, "0")}-${String(j.getUTCDate()).padStart(2, "0")}`;
}

/** "2026-11-25" から n 日分の日付 */
export function dateRange(start, n) {
  const [y, m, d] = start.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
}
