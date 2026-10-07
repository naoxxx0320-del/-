/** URL-only deployment: browser identifier is not proof of a unique person. */
function lotteryUrlConfig_() {
  var properties = PropertiesService.getScriptProperties();
  var sheetId = properties.getProperty("LOTTERY_URL_SHEET_ID");
  if (!sheetId || properties.getProperty("LOTTERY_URL_CAMPAIGN_ID") !== LOTTERY_URL_CAMPAIGN.campaignId) throw new Error("NOT_CONFIGURED");
  var cfg = Object.assign({}, LOTTERY_URL_CAMPAIGN, { sheetId: sheetId });
  cfg.prizeRules = lotteryPrizeRules_(JSON.stringify(cfg.prizeRules));
  if (!cfg.campaignId || !isFinite(Date.parse(cfg.startsAt)) || !isFinite(Date.parse(cfg.endsAt)) ||
      Date.parse(cfg.startsAt) >= Date.parse(cfg.endsAt) || cfg.exhaustedPrizePolicy !== "equal_lower" ||
      cfg.prizeRules.slice(1).some(function (rule) { return rule.maxWinners !== null ||
        !(rule.probability > 0) || Math.abs(rule.probability - (1 - cfg.prizeRules[0].probability) / 3) > 1e-12; })) {
    throw new Error("NOT_CONFIGURED");
  }
  return cfg;
}

/** Only callable operation for visitors. Outcome, time and inventory are server-owned. */
function lotteryUrlRequest(request) {
  var lock = null;
  try {
    var cfg = lotteryUrlConfig_();
    if (!request || request.campaignId !== cfg.campaignId || ["status", "draw"].indexOf(request.action) < 0 ||
        typeof request.browserId !== "string" || !/^[a-f0-9]{64}$/.test(request.browserId)) {
      return { ok: false, error: "INVALID_REQUEST" };
    }
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      cfg.campaignId + ":browser:" + request.browserId, Utilities.Charset.UTF_8);
    var accountKey = digest.map(function (byte) { return ("0" + ((byte + 256) % 256).toString(16)).slice(-2); }).join("");
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return { ok: false, error: "BUSY" };
    var data = lotterySheet_(cfg);
    var decision = lotteryDecide_(request, data.rows, cfg, { accountKey: accountKey, friend: true }, Date.now(), Math.random, function () { return Utilities.getUuid(); });
    if (decision.row) {
      data.sheet.appendRow(decision.row);
      SpreadsheetApp.flush();
    }
    return decision.response;
  } catch (error) {
    return { ok: false, error: ["NOT_CONFIGURED", "DATA_ERROR"].indexOf(error.message) >= 0 ? error.message : "SERVER_ERROR" };
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function doGet() {
  return HtmlService.createHtmlOutput(LOTTERY_URL_HTML).setTitle("AROMA DAIAMOND 宝石の抽選")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function setupUrlLottery() {
  // Require the spreadsheet editor context before any setup write.
  var ui = SpreadsheetApp.getUi();
  var book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error("新しい抽選専用シートの「拡張機能 → Apps Script」から実行してください。");
  var properties = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("別の処理が実行中です。少し待ってから再実行してください。");
  try {
    var currentSheet = properties.getProperty("LOTTERY_URL_SHEET_ID");
    var currentCampaign = properties.getProperty("LOTTERY_URL_CAMPAIGN_ID");
    if ((currentSheet && currentSheet !== book.getId()) || (currentCampaign && currentCampaign !== LOTTERY_URL_CAMPAIGN.campaignId) ||
        properties.getProperty("LINE_LOGIN_CHANNEL_ID") || properties.getProperty("LOTTERY_SHEET_ID")) {
      throw new Error("既存の接続設定があるため停止しました。新しい抽選専用シート・プロジェクトを使ってください。");
    }
    lotterySheet_({ sheetId: book.getId() });
    SpreadsheetApp.flush();
    properties.setProperties({ LOTTERY_URL_SHEET_ID: book.getId(), LOTTERY_URL_CAMPAIGN_ID: LOTTERY_URL_CAMPAIGN.campaignId }, false);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
  ui.alert("URL抽選の台帳を設定しました。次にウェブアプリとしてデプロイし、末尾が /exec のURLで動作を確認してください。LINE設定は不要です。");
}
