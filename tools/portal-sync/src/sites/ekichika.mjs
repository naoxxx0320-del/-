// 駅ちか（ranking-deli.jp）の出勤：入れる形への変換
// 調査結果：docs/portal-sync/ekichika.md
//  ・出勤管理 /admin/girlswork/ に、全員×今日から7日分。日ごとに開始・終了（30分刻み）と「出勤」チェック。[保存]1回。
//  ・開始 00:00〜29:30、終了 00:30〜30:00（深夜は 26:00 のように24時以降で書く）。
import { planForSite } from "../plan.mjs";

export const SITE = { id: "ekichika", name: "駅ちか", days: 7, startMin: 0, startMax: 29 * 60 + 30, endMin: 30, endMax: 30 * 60 };

export function planEkichika(shifts, today, opts = {}) {
  return planForSite(SITE, shifts, today, opts);
}
