// 全国メンズエステランキング（esthe-ranking.jp）の出勤：入れる形への変換
// 調査結果：docs/portal-sync/esthe-ranking.md
//  ・出勤 /shop/schedule/<日付>/ に、1日ずつ全員。人ごとに出勤開始・終了（30分刻み、06:00〜翌5:30）、
//    「出勤時間未定」「出勤解除」。[保存する]を押すまで保存されない。30日先まで登録できる。
//  ・画面の表示は「02:00(26:00)」の形。ツールの中では "26:00" で扱い、ページへの入力時に置き換える。
import { planForSite } from "../plan.mjs";

// 期間：今日から14日分（読み取りは1日1ページなので、読み込みの回数を抑える。設定で30日まで延ばせる）
export const SITE = { id: "esthe-ranking", name: "全国メンズエステランキング", days: 14, maxDays: 30, startMin: 6 * 60, startMax: 29 * 60 + 30, endMin: 6 * 60, endMax: 29 * 60 + 30 };

export function planEstheRanking(shifts, today, { days, ...opts } = {}) {
  const site = { ...SITE, days: Math.min(Math.max(Number(days) || SITE.days, 1), SITE.maxDays) };
  return planForSite(site, shifts, today, opts);
}

/** "26:00" → 画面の選択肢の文字（"02:00(26:00)"）。24時より前はそのまま */
export function toLabel(v) {
  const m = String(v).match(/^(\d{2}):(\d{2})$/);
  if (!m) return v;
  const h = +m[1];
  return h >= 24 ? `${String(h - 24).padStart(2, "0")}:${m[2]}(${v})` : v;
}
/** 画面の選択肢の文字（"02:00(26:00)" や "12:30"）→ "26:00" の形。読めなければ "" */
export function fromLabel(label) {
  const s = String(label).trim();
  const m = s.match(/\((\d{2}:\d{2})\)/);
  if (m) return m[1];
  return /^\d{2}:\d{2}$/.test(s) ? s : "";
}
