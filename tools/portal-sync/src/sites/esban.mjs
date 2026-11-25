// エステ番長（es-ban.com）の出勤：入れる形への変換
// 調査結果：docs/portal-sync/esban.md
//  ・出勤情報 /admin/content_manage/therapist_schedule に、全員×今日から7日分の表。
//  ・登録は「1人×1日」ごとのページ（/admin/therapist_schedule/add?date=YYYY-MM-DD&t=ID）。出勤・退勤は 10:00〜翌5:00（30分刻み）。
//  ・選択肢の値は "t1000"（10:00）・"t1050"（10:30）・"t2700"（翌3:00）の形。
import { planForSite } from "../plan.mjs";

export const SITE = { id: "esban", name: "エステ番長", days: 7, startMin: 10 * 60, startMax: 29 * 60, endMin: 10 * 60, endMax: 29 * 60 };

export function planEsban(shifts, today, opts = {}) {
  return planForSite(SITE, shifts, today, opts);
}

/** "27:30" → "t2750"（30分は 50） */
export function toValue(v) {
  const m = String(v).match(/^(\d{2}):(\d{2})$/);
  if (!m) return "";
  return `t${+m[1]}${m[2] === "30" ? "50" : "00"}`;
}
/** 表の表示 "03:00" などの時刻（6時より前は翌日）→ "27:00" */
export function fromShown(v) {
  const m = String(v).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  const h = +m[1];
  return `${String(h < 6 ? h + 24 : h).padStart(2, "0")}:${m[2]}`;
}
