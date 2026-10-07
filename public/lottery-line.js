/* Live mode only. No demo outcomes, localStorage participation limit, or browser draw. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const buttons = [...document.querySelectorAll("[data-gem]")];
  let config, selected = null, busy = false, ready = false, needsLogin = false;
  const names = ["ルビー", "ダイヤ", "サファイア"];
  const colors = [["#ef8caa", "#8b2447"], ["#ffe7aa", "#b28744"], ["#b2c9f5", "#4e608d"]];
  const messages = {
    FRIEND_REQUIRED: "公式LINEを友だち追加してから、参加資格を再確認してください。",
    NOT_STARTED: "キャンペーンはまだ始まっていません。",
    ENDED: "キャンペーンの受付は終了しました。",
    SOLD_OUT: "当選枠がすべて埋まったため、受付は終了しました。",
    LINE_AUTH_FAILED: "LINEの本人確認ができませんでした。もう一度ログインしてください。",
    NOT_CONFIGURED: "キャンペーンの準備中です。",
    BUSY: "ただいま混み合っています。少し待ってから再確認してください。",
  };
  function gem(i) {
    return `<svg viewBox="0 0 120 110" aria-hidden="true"><path d="M26 16h68l20 30-54 58L6 46Z" fill="${colors[i][1]}"/><path d="M26 16 6 46h34Zm0 0 14 30 20-30Zm34 0 20 30 14-30Z" fill="${colors[i][0]}"/><path d="m40 46 20-30 20 30Z" fill="#fff3d4"/><path d="M40 46h40l-20 58Z" fill="${colors[i][0]}"/><path d="M26 16h68l20 30-54 58L6 46Zm-20 30h108M26 16l14 30 20 58 20-58 14-30" fill="none" stroke="#fff3d4" stroke-width="1"/></svg>`;
  }
  function showResult(result, repeated) {
    const prizes = { 1: "施術90分無料", 2: "衣装チェンジ無料", 3: "写真指名無料", 4: "パウダートリートメント無料" };
    if (!result || !["win", "lose"].includes(result.outcome) || ![0, 1, 2].includes(result.gemIndex) ||
        typeof result.drawId !== "string" || !result.drawId || !Number.isFinite(Date.parse(result.drawnAt)) ||
        (result.outcome === "win" && (!prizes[result.prizeId] || result.prizeLabel !== prizes[result.prizeId])) ||
        (result.outcome === "lose" && result.prizeId != null)) throw new Error("BAD_RESPONSE");
    $("choose").hidden = true;
    $("drawing").hidden = true;
    $("result").hidden = false;
    $("game").setAttribute("aria-busy", "false");
    $("result-art").innerHTML = gem(result.gemIndex);
    $("result-art").classList.toggle("win", result.outcome === "win");
    $("result-label").textContent = repeated ? "YOUR SAVED RESULT" : "YOUR RESULT";
    $("result-title").textContent = result.outcome === "win" ? `おめでとうございます。${result.prizeId}等です！` : "今回は、落選となりました。";
    $("result-prize").textContent = result.outcome === "win" ? result.prizeLabel : "";
    $("result-prize").hidden = result.outcome !== "win";
    $("result-message").textContent = repeated ? "すでに抽選済みです。保存された結果を表示しています。再抽選はできません。" : "抽選結果を保存しました。このLINEアカウントでの参加は終了です。";
    $("draw-id").textContent = "受付番号：" + result.drawId;
    $("result-title").focus({ preventScroll: true });
    ready = false;
  }
  async function api(action) {
    const idToken = window.liff.getIDToken(), accessToken = window.liff.getAccessToken();
    if (!idToken || !accessToken) throw new Error("LINE_AUTH_FAILED");
    const body = new URLSearchParams({ action, campaignId: config.campaignId, idToken, accessToken });
    if (action === "draw") body.set("gemIndex", String(selected));
    const response = await fetch(config.endpoint, { method: "POST", body, credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error("NETWORK_ERROR");
    const data = await response.json();
    if (!data || data.ok !== true) throw new Error(data?.error || "BAD_RESPONSE");
    return data;
  }
  function failed(error) {
    ready = false;
    needsLogin = error.message === "LINE_AUTH_FAILED";
    buttons.forEach((button) => { button.disabled = true; });
    $("drawing").hidden = true;
    $("choose").hidden = false;
    $("game").setAttribute("aria-busy", "false");
    $("draw").disabled = true;
    $("selection").textContent = messages[error.message] || "結果を確認できませんでした。再確認すると、保存済みの結果がある場合はその結果を表示します。";
    $("retry").hidden = false;
  }
  async function check() {
    if (busy || !config) return;
    busy = true;
    $("retry").disabled = true;
    $("draw").disabled = true;
    $("selection").textContent = "参加資格と保存済みの結果を確認しています。";
    try {
      const data = await api("status");
      if (data.result) showResult(data.result, true);
      else if (data.eligible === true) {
        ready = true;
        $("selection").textContent = selected === null ? "宝石をひとつ選んでください。抽選は1回だけです。" : names[selected] + "を選びました。";
        $("draw").disabled = selected === null;
      } else throw new Error("BAD_RESPONSE");
      $("retry").hidden = true;
    } catch (error) { failed(error); }
    finally { busy = false; $("retry").disabled = false; buttons.forEach((button) => { button.disabled = !ready; }); }
  }
  buttons.forEach((button, i) => {
    button.querySelector(".gem-slot").innerHTML = gem(i);
    button.disabled = true;
    button.addEventListener("click", () => {
      if (!ready || busy) return;
      selected = i;
      buttons.forEach((b, j) => {
        b.setAttribute("aria-pressed", String(i === j));
        b.querySelector(".check").textContent = i === j ? "✓" : "◇";
      });
      $("selection").textContent = names[i] + "を選びました。";
      $("draw").disabled = false;
    });
  });
  $("draw").addEventListener("click", async () => {
    if (!ready || busy || selected === null) return;
    busy = true;
    $("draw").disabled = true;
    $("choose").hidden = true;
    $("drawing").hidden = false;
    $("drawing-gem").innerHTML = gem(selected);
    $("game").setAttribute("aria-busy", "true");
    try { const data = await api("draw"); showResult(data.result, data.repeated); }
    catch (error) { failed(error); }
    finally { busy = false; }
  });
  $("retry").addEventListener("click", async () => {
    if (needsLogin && window.liff?.isLoggedIn()) { window.liff.logout(); needsLogin = false; }
    if (window.liff && !window.liff.isLoggedIn()) { window.liff.login({ redirectUri: location.href.split("#")[0] }); return; }
    await check();
    buttons.forEach((button) => { button.disabled = !ready; });
  });
  async function init() {
    try {
      const response = await fetch("./lottery-line-config.json", { cache: "no-store" });
      config = await response.json();
      if (!config.liffId || !config.campaignId || !/^https:\/\//.test(config.endpoint || "")) throw new Error("NOT_CONFIGURED");
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
        script.onload = resolve;
        script.onerror = () => reject(new Error("LINE_AUTH_FAILED"));
        document.head.appendChild(script);
      });
      await window.liff.init({ liffId: config.liffId });
      if (!window.liff.isLoggedIn()) { $("selection").textContent = "LINEへのログインが必要です。"; $("retry").textContent = "LINEでログインする"; $("retry").hidden = false; return; }
      $("retry").textContent = "参加資格・結果を再確認";
      await check();
      buttons.forEach((button) => { button.disabled = !ready; });
    } catch (error) {
      $("selection").textContent = messages[error.message] || "参加ページを読み込めませんでした。通信環境をご確認ください。";
      config = null;
      $("draw").disabled = true;
    }
  }
  init();
})();
