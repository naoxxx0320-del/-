/* =============================================================================
 * LINE Webhook 署名検証プロキシ（Cloudflare Worker・無料枠で動作）
 * -----------------------------------------------------------------------------
 * Apps Script は受信ヘッダ(X-Line-Signature)を取得できないため、正規のWebhookで
 * あることを厳密に検証できません。このWorkerが「LINE → 検証 → Apps Script」の
 * 間に入り、HMAC-SHA256署名を検証してから、共有シークレット付きでApps Scriptへ
 * 中継します（＝なりすまし防止・要件『正規のWebhookを検証』を満たす）。
 *
 * ■ Cloudflare 側の環境変数（Settings → Variables / Secrets）
 *   LINE_CHANNEL_SECRET  … LINEチャネルシークレット（Secret推奨）
 *   GAS_EXEC_URL         … Apps Script 公開デプロイの /exec URL
 *   PROXY_SHARED_SECRET  … Apps Script のスクリプトプロパティと同じ共有シークレット
 *
 * ■ LINE Developers → Messaging API → Webhook URL に、このWorkerのURLを設定。
 *   （検証ボタンもこのWorkerに来るため 200 を返します）
 * ========================================================================== */

export default {
  // Cloudflare Module Worker: 第3引数 ctx で waitUntil が使える。
  // GAS_EXEC_URL は「LINEボット（line-booking.gs）の公開デプロイ /exec」を指すこと。
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      // LINEの「検証」やヘルスチェック
      return new Response("ok", { status: 200 });
    }
    const body = await request.text();
    const signature = request.headers.get("x-line-signature") || "";

    const valid = await verifySignature(body, signature, env.LINE_CHANNEL_SECRET);
    if (!valid) {
      return new Response("invalid signature", { status: 401 });
    }

    // 署名OK。Apps Script へ共有シークレット付きで中継（生のLINEボディも渡す）。
    // LINEはWebhookに素早い200を期待するため、中継はwaitUntilで非同期にして即200を返す。
    const forward = fetch(env.GAS_EXEC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "line_webhook",
        proxySecret: env.PROXY_SHARED_SECRET,
        lineBody: body, // 検証済みの生ボディ（Apps Script側で JSON.parse して events を処理）
      }),
    }).catch((e) => console.log("forward error", e));

    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(forward); // 中継を待たずに即200（LINEのタイムアウト回避）
    } else {
      await forward;
    }
    return new Response("ok", { status: 200 });
  },
};

async function verifySignature(body, signature, secret) {
  if (!signature || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  // 定数時間比較（タイミング攻撃対策）
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
