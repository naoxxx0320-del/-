"use client";
/* 会員制度の通信（予約管理API）と計測。API の URL は予約と同じ apiV2。 */
import reserveCfg from "../../data/reserve-config.json";

export const API = (reserveCfg.apiV2 || "").trim();

// JSONP（GETで読むだけ：受付状況・会員証）。失敗・タイムアウトは null。
export function jsonp(params, timeoutMs = 15000) {
  return new Promise((resolve) => {
    if (!API || typeof window === "undefined") return resolve(null);
    const cb = "__mb_" + Math.random().toString(36).slice(2);
    const s = document.createElement("script");
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      try { delete window[cb]; } catch (e) { window[cb] = undefined; }
      s.remove();
      resolve(v);
    };
    window[cb] = (data) => finish(data);
    s.onerror = () => finish(null);
    const q = new URLSearchParams({ ...params, callback: cb, _: String(Date.now()) });
    s.src = API + (API.includes("?") ? "&" : "?") + q.toString();
    document.body.appendChild(s);
    setTimeout(() => finish(null), timeoutMs);
  });
}

// 登録（POST・text/plain でプリフライトなし）。結果のJSONを確認する。
export async function post(body) {
  if (!API) return { ok: false, reason: "ただ今準備中です。" };
  try {
    const res = await fetch(API, { method: "POST", body: JSON.stringify(body) });
    return await res.json();
  } catch (e) {
    return { ok: false, reason: "通信に失敗しました。時間をおいてもう一度お試しください。" };
  }
}

// 計測（Google アナリティクスが有効なときだけ）
export function track(name, params = {}) {
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") window.gtag("event", name, params);
  } catch (e) {}
}
