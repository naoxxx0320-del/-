// エステラブ（eslove.jp）の出勤：入れる形への変換
// 調査結果：docs/portal-sync/eslove.md
//  ・出勤情報（週別）/admin/shop/therapist_schedule/weekly に、全員×7日分の表。?day=-1 で表の始まりを1日ずらせる。
//  ・セルを押すと小窓が開き、出勤・退勤（30分刻み、6:00〜翌6:00）を選んで「決定する」→ 表の上の「保存する」でまとめて保存。
//  ・選択肢の値は "600"（6:00）・"1230"（12:30）・"2930"（翌5:30）の形（24時以降は24を足した時刻）。
import { planForSite } from "../plan.mjs";

export const SITE = { id: "eslove", name: "エステラブ", days: 7, startMin: 6 * 60, startMax: 29 * 60 + 30, endMin: 6 * 60 + 30, endMax: 30 * 60 };

export function planEslove(shifts, today, opts = {}) {
  return planForSite(SITE, shifts, today, opts);
}

/** "06:00" → "600"、"29:30" → "2930" */
export function toValue(v) {
  const m = String(v).match(/^(\d{2}):(\d{2})$/);
  return m ? `${+m[1]}${m[2]}` : "";
}
/** 選択肢・表の値 "600" / "2930" → "06:00" / "29:30"。空や読めないものは "" */
export function fromValue(v) {
  const m = String(v).trim().match(/^(\d{1,2})(\d{2})$/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}
/** 日本時間の暦の日付（"2026-11-26"） */
export function jstDate(nowMs = Date.now()) {
  return new Date(nowMs + 9 * 3600e3).toISOString().slice(0, 10);
}
/** 表の始まりを営業日の今日に合わせるための ?day= の値（暦の今日から何日ずらすか） */
export function dayOffset(todayIso, calendarIso) {
  return Math.round((Date.parse(todayIso + "T00:00:00Z") - Date.parse(calendarIso + "T00:00:00Z")) / 86400e3);
}
