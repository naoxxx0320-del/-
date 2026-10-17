// GA4 イベント送信の共通関数（gtag.js が読み込まれているときだけ送る）。
// ※氏名・電話番号・メール・LINE ID などの個人情報はパラメータに絶対に含めないこと。
//   送ってよいのはページの場所・コース名などの属性だけ。
export function track(name, params = {}) {
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", name, params);
    }
  } catch (e) {}
}

// 同じページ表示中に1回だけ送る（フォーム開始などの重複計測を防ぐ）。
const sent = new Set();
export function trackOnce(name, params = {}) {
  if (sent.has(name)) return;
  sent.add(name);
  track(name, params);
}
