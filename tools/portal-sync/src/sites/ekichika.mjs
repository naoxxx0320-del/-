// 駅ちか（ranking-deli.jp）の出勤：入れる形への変換（フェーズ1：ポータルには接続しない）
// 調査結果：docs/portal-sync/ekichika.md
//  ・出勤管理 /admin/girlswork/ に、全員×今日から7日分。日ごとに開始・終了（30分刻み）と「出勤」チェック。[保存]1回。
//  ・開始 00:00〜29:30、終了 00:30〜30:00（深夜は 26:00 のように24時以降で書く）。
import { dateRange, hhmm } from "../shifts.mjs";

export const SITE = { id: "ekichika", name: "駅ちか", days: 7, startMin: 0, startMax: 29 * 60 + 30, endMin: 30, endMax: 30 * 60 };

/**
 * 出勤の一覧 → 駅ちかに入れる表。
 * @param shifts collectShifts の shifts
 * @param today  営業日の今日 "YYYY-MM-DD"
 * @param opts.nameMap  サイトの表示名 → 駅ちかでの名前（違う場合だけ。例 { "ひなた": "ひなた" }）
 * @param opts.people   駅ちかに登録されている人の名前（分かれば。登録の無い人は「見送り」にする）
 * 戻り値 { dates, rows:[{name, cells:[{date, work, start, end}]}], skipped:[{date,name,reason}] }
 */
export function planEkichika(shifts, today, { nameMap = {}, people = null } = {}) {
  const dates = dateRange(today, SITE.days);
  const inRange = new Set(dates);
  const byName = new Map();
  const skipped = [];
  const portalName = (n) => nameMap[n] || n;
  for (const s of shifts) {
    if (!inRange.has(s.date)) continue;
    const name = portalName(s.name);
    if (people && !people.includes(name)) { skipped.push({ date: s.date, name, reason: "駅ちかに登録されていないセラピストです" }); continue; }
    if (s.start == null) { skipped.push({ date: s.date, name, reason: "出勤時間が未定のため（駅ちかは時間の入力が必要）" }); continue; }
    const end = s.end ?? null;
    if (end == null) { skipped.push({ date: s.date, name, reason: "終了時刻が未定のため" }); continue; }
    if (s.start < SITE.startMin || s.start > SITE.startMax || end < SITE.endMin || end > SITE.endMax) {
      skipped.push({ date: s.date, name, reason: `駅ちかで選べない時間です（${hhmm(s.start)}〜${hhmm(end)}）` });
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
