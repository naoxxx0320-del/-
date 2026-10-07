/* Server draws only. Browser identifier restricts a browser, not a person. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const campaignId = document.querySelector('meta[name="lottery-campaign"]').content;
  const key = "aroma-lottery-browser:" + campaignId;
  const buttons = [...document.querySelectorAll("[data-gem]")];
  const names = ["ルビー", "ダイヤ", "サファイア"];
  const labels = { 1: "施術90分無料", 2: "衣装チェンジ無料", 3: "写真指名無料", 4: "パウダートリートメント無料" };
  const colors = [["#ef8caa", "#8b2447"], ["#ffe7aa", "#b28744"], ["#b2c9f5", "#4e608d"]];
  let browserId, selected = null, busy = false, ready = false;
  const messages = {
    NOT_CONFIGURED: "キャンペーンの準備中です。",
    NOT_STARTED: "キャンペーンはまだ始まっていません。",
    ENDED: "キャンペーンの受付は終了しました。",
    SOLD_OUT: "当選枠がすべて埋まったため、受付は終了しました。",
    BUSY: "ただいま混み合っています。少し待ってから再確認してください。",
    STORAGE_ERROR: "参加記録を保存できません。ブラウザーの保存機能を有効にしてから開き直してください。",
  };
  function gem(i) {
    return `<svg viewBox="0 0 120 110" aria-hidden="true"><path d="M26 16h68l20 30-54 58L6 46Z" fill="${colors[i][1]}"/><path d="M26 16 6 46h34Zm0 0 14 30 20-30Zm34 0 20 30 14-30Z" fill="${colors[i][0]}"/><path d="m40 46 20-30 20 30Z" fill="#fff3d4"/><path d="M40 46h40l-20 58Z" fill="${colors[i][0]}"/><path d="M26 16h68l20 30-54 58L6 46Z" fill="none" stroke="#fff3d4"/></svg>`;
  }
  function api(action) {
    return new Promise((resolve, reject) => {
      try {
        if (localStorage.getItem(key) !== browserId) return reject(new Error("STORAGE_ERROR"));
      } catch (_) { return reject(new Error("STORAGE_ERROR")); }
      if (!window.google?.script?.run) return reject(new Error("NOT_CONFIGURED"));
      const timer = setTimeout(() => reject(new Error("NETWORK_ERROR")), 30000);
      const done = (data) => { clearTimeout(timer); if (data?.ok !== true) reject(new Error(data?.error || "BAD_RESPONSE")); else resolve(data); };
      const request = { action, campaignId, browserId };
      if (action === "draw") request.gemIndex = String(selected);
      window.google.script.run.withSuccessHandler(done).withFailureHandler(() => {
        clearTimeout(timer); reject(new Error("NETWORK_ERROR"));
      }).lotteryUrlRequest(request);
    });
  }
  function showResult(result, repeated) {
    if (!result || result.outcome !== "win" || !labels[result.prizeId] || result.prizeLabel !== labels[result.prizeId] ||
        ![0, 1, 2].includes(result.gemIndex) || typeof result.drawId !== "string" || !result.drawId || !Number.isFinite(Date.parse(result.drawnAt))) {
      throw new Error("BAD_RESPONSE");
    }
    ready = false;
    $("choose").hidden = true; $("drawing").hidden = true; $("result").hidden = false;
    $("game").setAttribute("aria-busy", "false");
    $("result-art").innerHTML = gem(result.gemIndex); $("result-art").classList.add("win");
    $("result-label").textContent = repeated ? "YOUR SAVED RESULT" : "YOUR RESULT";
    $("result-title").textContent = `おめでとうございます。${result.prizeId}等です！`;
    $("result-prize").textContent = result.prizeLabel; $("result-prize").hidden = false;
    $("result-message").textContent = repeated ? "すでに抽選済みです。保存された結果を表示しています。再抽選はできません。" : "抽選結果を保存しました。受付番号を控えてください。";
    $("draw-id").textContent = "受付番号：" + result.drawId;
    $("result-title").focus({ preventScroll: true });
    $("game").scrollIntoView({ behavior: "auto", block: "start" });
  }
  function failed(error) {
    ready = false;
    buttons.forEach((button) => { button.disabled = true; });
    $("drawing").hidden = true; $("choose").hidden = false;
    $("game").setAttribute("aria-busy", "false"); $("draw").disabled = true;
    $("selection").textContent = messages[error.message] || "結果を確認できませんでした。再確認すると、保存済みの結果がある場合はその結果を表示します。";
    $("retry").hidden = error.message === "STORAGE_ERROR" || error.message === "NOT_CONFIGURED";
  }
  async function check() {
    if (busy || !browserId) return;
    busy = true; $("retry").disabled = true; $("draw").disabled = true;
    $("selection").textContent = "参加記録と保存済みの結果を確認しています。";
    try {
      const data = await api("status");
      if (data.result) showResult(data.result, true);
      else if (data.eligible === true) {
        ready = true; $("selection").textContent = "宝石をひとつ選んでください。同じブラウザーでの抽選は1回です。";
        $("draw").disabled = selected === null;
      } else throw new Error("BAD_RESPONSE");
      $("retry").hidden = true;
    } catch (error) { failed(error); }
    finally { busy = false; $("retry").disabled = false; buttons.forEach((button) => { button.disabled = !ready; }); }
  }
  buttons.forEach((button, i) => {
    button.disabled = true; button.querySelector(".gem-slot").innerHTML = gem(i);
    button.addEventListener("click", () => {
      if (!ready || busy) return;
      selected = i; buttons.forEach((b, j) => { b.setAttribute("aria-pressed", String(i === j)); b.querySelector(".check").textContent = i === j ? "✓" : "◇"; });
      $("selection").textContent = names[i] + "を選びました。"; $("draw").disabled = false;
    });
  });
  $("draw").addEventListener("click", async () => {
    if (!ready || busy || selected === null) return;
    busy = true; ready = false; $("draw").disabled = true;
    $("choose").hidden = true; $("drawing").hidden = false;
    $("drawing-gem").innerHTML = gem(selected); $("game").setAttribute("aria-busy", "true");
    try { const data = await api("draw"); showResult(data.result, data.repeated); }
    catch (error) { failed(error); }
    finally { busy = false; }
  });
  $("retry").addEventListener("click", check);
  try {
    browserId = localStorage.getItem(key);
    if (browserId === null) {
      const random = new Uint8Array(32); crypto.getRandomValues(random);
      browserId = [...random].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(key, browserId);
    }
    // Do not replace a damaged or unavailable stored identity and silently permit another draw.
    if (!/^[a-f0-9]{64}$/.test(browserId) || localStorage.getItem(key) !== browserId) throw new Error("STORAGE_ERROR");
    check();
  } catch (_) { failed(new Error("STORAGE_ERROR")); }
})();
