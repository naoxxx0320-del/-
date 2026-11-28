// リラクシィ（rx-sns.jp）の出勤：入れる形への変換（通信しない）
//  ・店舗の「出勤管理」/u/aromadiamond/shifts に、所属セラピスト×7日の表（「今週」「来週」の2週）。
//  ・日ごとに「未設定／出勤／休み」を選ぶと、その場で保存される。出勤のときは「出勤時間」「退勤時間」（分の値。0〜1920＝翌8:00、30分刻み）。
//  ・オーナーの選択：出勤表に出勤のない日は「休み」にする（未設定のときだけ。出勤を休みに変える＝取り消しは、ほかのサイトと同じく手で確認）。
import { planForSite } from "../plan.mjs";

export const SITE = { id: "rx", name: "リラクシィ", days: 14, startMin: 0, startMax: 1890, endMin: 30, endMax: 1920 };

export function planRx(shifts, today, opts = {}) {
  return planForSite(SITE, shifts, today, opts);
}

/** "16:00" → 960、"26:30" → 1590 */
export const toMin = (hhmm) => { const m = String(hhmm).match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null; };
/** 960 → "16:00"、1590 → "26:30" */
export const fromMin = (v) => { const n = Number(v); return Number.isFinite(n) ? `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}` : ""; };

/** 「未設定」の日で、出勤表にも出勤がない日 → 「休みにする」変更（番号は from から） */
export function restChanges(current, plan, from = 0) {
  const out = [];
  const cur = new Map(current.people.map((p) => [p.name, p]));
  for (const row of plan.rows) {
    const p = cur.get(row.name);
    if (!p) continue;
    for (const want of row.cells) {
      const have = p.cells.find((c) => c.date === want.date);
      if (!have || want.work || !have.unset) continue;
      out.push({ no: from + out.length + 1, type: "rest", name: row.name, id: p.id, idx: have.idx, date: want.date, before: "未設定", after: "休み", want: { work: false, off: true } });
    }
  }
  return out;
}
