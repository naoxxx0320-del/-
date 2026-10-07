/* 出勤情報の「今日以降」だけを残す（日本時間・営業日基準）。
   朝6時までは前日の営業日として扱う（深夜営業のため、翌2:00 までの出勤は前日の日付で表示）。
   シートの行は消さず、サイトの表示からだけ外す。 */
export const BIZ_DAY_CUTOFF_HOUR = 6;

export function dayKey(dateStr) {
  const m = String(dateStr || "").match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  return m ? +m[1] * 10000 + +m[2] * 100 + +m[3] : null;
}

// 日本時間の営業日（YYYYMMDD の数値）。端末のタイムゾーンに依存しない。
export function bizTodayKey(nowMs = Date.now()) {
  const j = new Date(nowMs + 9 * 3600e3 - BIZ_DAY_CUTOFF_HOUR * 3600e3);
  return j.getUTCFullYear() * 10000 + (j.getUTCMonth() + 1) * 100 + j.getUTCDate();
}

// 今日（営業日）以降の日だけを日付順で返す。日付が読めない日はそのまま残す。
export function upcomingDays(days, nowMs = Date.now()) {
  const today = bizTodayKey(nowMs);
  return (days || [])
    .filter((d) => {
      const k = dayKey(d.date);
      return k == null || k >= today;
    })
    .sort((a, b) => (dayKey(a.date) ?? 0) - (dayKey(b.date) ?? 0));
}
