// エステ魂（estama.jp）の出勤：入れる形への変換
// 調査結果：docs/portal-sync/estama.md
//  ・セラピストごとのページ /admin/schedule/<ID>/ に今日から14日分。日ごとに出勤・退勤（30分刻み）と「お休み」。
//  ・選択肢の値は "9:30"〜"28:30"（時は0埋めなし）。退勤は "99:99"＝「未定(LASTまで)」も選べる。
//  ・保存はページの保存ボタン（#SendWorkSchedule）で、まとめて送られる。
import { planForSite } from "../plan.mjs";

// 閉店（翌5:00＝29:00）までの出勤は、退勤を「未定(LASTまで)」にする（エステ魂の退勤の選択肢は 28:30 まで）
export const SITE = { id: "estama", name: "エステ魂", days: 14, startMin: 9 * 60 + 30, startMax: 28 * 60 + 30, endMin: 9 * 60 + 30, endMax: 29 * 60 };
export const LAST = "29:00";

export function planEstama(shifts, today, opts = {}) {
  return planForSite(SITE, shifts, today, opts);
}

/** "09:30" "26:00" → 選択肢の値 "9:30" "26:00"。退勤の 29:00 は "99:99"（LASTまで） */
export function toValue(v, { isEnd = false } = {}) {
  const m = String(v).match(/^(\d{2}):(\d{2})$/);
  if (!m) return "";
  if (isEnd && v === LAST) return "99:99";
  return `${+m[1]}:${m[2]}`;
}
/** 選択肢の値 → "09:30" の形。"99:99"（LASTまで）は "29:00"。空は "" */
export function fromValue(v) {
  if (v === "99:99") return LAST;
  const m = String(v).match(/^(\d{1,2}):(\d{2})$/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}
