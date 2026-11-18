// 割引データ（data/offers.json）の共通処理。/offers/ と料金ページの総額例で使う。
import offers from "../../data/offers.json";
import price from "../../data/price.json";

// 日本時間の今日（YYYY-MM-DD）。公開（ビルド）時点で判定する。
function todayJst(nowMs = Date.now()) {
  return new Date(nowMs + 9 * 3600e3).toISOString().slice(0, 10);
}

// 実施中の割引（開始日を迎え、終了日を過ぎていないもの）
export function activeOffers(nowMs = Date.now()) {
  const d = todayJst(nowMs);
  return (offers.items || []).filter((o) => (!o.since || o.since <= d) && (!o.until || d <= o.until));
}

export function findOffer(id, nowMs = Date.now()) {
  return activeOffers(nowMs).find((o) => o.id === id) || null;
}

// ご利用例：対象コースの通常料金と割引後の料金
export function offerExample(o) {
  const c = (price.courses || []).find((x) => x.title === o.exampleCourse);
  if (!c) return null;
  return { course: c.title, price: c.price, after: c.price - o.amount };
}
