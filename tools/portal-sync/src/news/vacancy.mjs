// 空き時間の告知：計算と文章（通信しない）
// 空き＝本日の出勤（出勤表シート）から、予約の入っている時間（予約管理の公開の空き状況：担当者・時間帯だけ）を除いたもの。
// 60分以上あいていて、開始が今から30分より後のものだけ（WEB予約と同じ決まり）。
import { dayLabel, timeLabel } from "./compose.mjs";

export const SLOTS = [11 * 60, 15 * 60, 19 * 60]; // 告知する時刻（オーナーの選択）
export const MIN_LEN = 60;
export const LEAD_MIN = 30;

const ceilTo = (m, step) => Math.ceil(m / step) * step;

/**
 * 本日の空き。
 *   shifts：本日の出勤 [{ key（シートの名前）, name（表示名）, start, end }]（分。0:00 から。翌は 1440 以上）
 *   busy：予約 [{ th（シートの名前）, s, e }]（ミリ秒）
 *   midnightMs：営業日の 0:00（日本時間）のミリ秒、nowMs：今
 */
export function freeWindows({ shifts, busy, midnightMs, nowMs, minLen = MIN_LEN, leadMin = LEAD_MIN, step = 10 }) {
  const nowMin = (nowMs - midnightMs) / 60000;
  const out = [];
  for (const s of shifts || []) {
    if (s.start == null || s.end == null || s.end <= s.start) continue;
    const taken = (busy || [])
      .filter((b) => String(b.th) === String(s.key) || String(b.th) === String(s.name))
      .map((b) => ({ s: (b.s - midnightMs) / 60000, e: (b.e - midnightMs) / 60000 }))
      .filter((b) => Number.isFinite(b.s) && Number.isFinite(b.e) && b.e > b.s)
      .sort((a, b) => a.s - b.s);
    let cur = Math.max(s.start, ceilTo(nowMin + leadMin, step));
    const push = (to) => { if (to - cur >= minLen) out.push({ name: s.name, start: cur, end: to }); };
    for (const b of taken) {
      if (b.e <= cur) continue;
      if (b.s > cur) push(Math.floor(Math.min(b.s, s.end)));
      cur = Math.max(cur, ceilTo(b.e, step));
      if (cur >= s.end) break;
    }
    if (cur < s.end) push(s.end);
  }
  return out.sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
}

/** 今告知する時刻（まだ出していない時刻のうち、来ている一番新しいもの。なければ null） */
export function dueSlot(nowMin, done = []) {
  const due = SLOTS.filter((m) => nowMin >= m);
  if (!due.length) return null;
  const last = due[due.length - 1];
  return done.includes(last) ? null : last;
}

const range = (w) => `${timeLabel(w.start)}〜${timeLabel(w.end)}`;
/** 早割（10:00〜17:00 に開始）に入る空きがあるか */
export const hasHayawari = (windows, offer) => !!offer && windows.some((w) => w.start >= 10 * 60 && w.start < 17 * 60);

/** 掲載サイト向けの告知 */
export function vacancyPost({ today, windows, nowMin, hayawari = null }) {
  if (!windows.length) return null;
  const names = [...new Set(windows.map((w) => w.name))];
  const at = timeLabel(Math.floor(nowMin / 10) * 10);
  const body = [
    `本日${dayLabel(today)}、ご案内できるお時間です（${at}時点）。`,
    "",
    ...windows.map((w) => `・${w.name}　${range(w)}`),
    "",
    ...(hasHayawari(windows, hayawari) ? [`10:00〜17:00 に開始のご予約は、早割で${Number(hayawari.amount).toLocaleString("ja-JP")}円OFFです（${hayawari.courses || "全コース"}）。`, ""] : []),
    "ご予約の状況により、埋まっている場合がございます。お早めにお問い合わせください。",
    "ご予約・お問い合わせを心よりお待ちしております。",
  ].join("\n");
  return {
    type: "vacancy",
    key: `vacancy:${today}:${at}`,
    title: `【本日の空き】${names.slice(0, 2).join("・")}${names.length > 2 ? "ほか" : ""} ${timeLabel(windows[0].start)}〜`,
    body,
    displayName: windows[0].name,
  };
}

/** リラクシィ（本人のアカウント）向けの短い告知 */
export function rxVacancyText({ windows, hayawari = null }) {
  if (!windows.length) return null;
  return [
    `本日 ${windows.map(range).join("・")} ご案内できます✨`,
    ...(hasHayawari(windows, hayawari) ? [`10:00〜17:00 開始のご予約は早割で${Number(hayawari.amount).toLocaleString("ja-JP")}円OFFです`] : []),
    "ご予約お待ちしております🌸",
  ].join("\n");
}
