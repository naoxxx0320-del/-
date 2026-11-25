// サイトごとの「入れる予定の表」を作る共通部分（通信しない）
//   site = { id, name, days, startMin, startMax, endMin, endMax }（分。深夜は 1440 を足した値）
import { dateRange, hhmm } from "./shifts.mjs";

/**
 * 出勤の一覧 → そのサイトに入れる表。
 * @param shifts collectShifts の shifts
 * @param today  営業日の今日 "YYYY-MM-DD"
 * @param opts.nameMap  サイトの表示名 → そのポータルでの名前（違う場合だけ）
 * @param opts.people   そのポータルに登録されている人の名前（分かれば。登録の無い人は「見送り」）
 * 戻り値 { dates, rows:[{name, cells:[{date, work, start, end}]}], skipped:[{date,name,reason}] }
 *   start/end は "26:00" の形（そのポータルの書き方への置き換えは各サイトの操作部分で行う）
 */
export function planForSite(site, shifts, today, { nameMap = {}, people = null } = {}) {
  const dates = dateRange(today, site.days);
  const inRange = new Set(dates);
  const byName = new Map();
  const skipped = [];
  const portalName = (n) => nameMap[n] || n;
  for (const s of shifts) {
    if (!inRange.has(s.date)) continue;
    const name = portalName(s.name);
    if (people && !people.includes(name)) { skipped.push({ date: s.date, name, reason: `${site.name}に登録されていないセラピストです` }); continue; }
    if (s.start == null) { skipped.push({ date: s.date, name, reason: `出勤時間が未定のため（${site.name}は時間の入力が必要）` }); continue; }
    const end = s.end ?? null;
    if (end == null) { skipped.push({ date: s.date, name, reason: "終了時刻が未定のため" }); continue; }
    if (s.start < site.startMin || s.start > site.startMax || end < site.endMin || end > site.endMax) {
      skipped.push({ date: s.date, name, reason: `${site.name}で選べない時間です（${hhmm(s.start)}〜${hhmm(end)}）` });
      continue;
    }
    if (!byName.has(name)) byName.set(name, new Map());
    byName.get(name).set(s.date, { date: s.date, work: true, start: hhmm(s.start), end: hhmm(end) });
  }
  // 登録されている人は、出勤の無い日も「出勤なし」として表に入れる（ダミーや古い出勤を取り消すため）
  const names = people ? [...people] : [...byName.keys()];
  const rows = names.map((name) => ({
    name,
    cells: dates.map((date) => (byName.get(name) && byName.get(name).get(date)) || { date, work: false, start: "", end: "" }),
  }));
  return { dates, rows, skipped };
}
