/** Run setupLottery from a new spreadsheet's bound Apps Script project. */
function setupLottery() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error("抽選専用スプレッドシートの「拡張機能 → Apps Script」から実行してください。");
  var ui = SpreadsheetApp.getUi();
  var input = ui.prompt("抽選のLINE接続設定", "LINEログインチャネルID（数字）を入力してください。Messaging APIのIDやチャネルシークレットではありません。", ui.ButtonSet.OK_CANCEL);
  if (input.getSelectedButton() !== ui.Button.OK) return;
  var channelId = input.getResponseText().trim();
  if (!/^\d+$/.test(channelId)) throw new Error("LINEログインチャネルIDを数字で入力してください。");
  var properties = PropertiesService.getScriptProperties();
  var next = Object.assign({}, LOTTERY_INSTALL_PROPERTIES, {
    LINE_LOGIN_CHANNEL_ID: channelId, LOTTERY_SHEET_ID: book.getId(),
  });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("別の処理が実行中です。少し待ってからやり直してください。");
  try {
    // Never reset a ledger or silently change the identity of an existing campaign.
    ["LOTTERY_CAMPAIGN_ID", "LINE_LOGIN_CHANNEL_ID", "LOTTERY_SHEET_ID"].forEach(function (key) {
      var existing = properties.getProperty(key);
      if (existing && existing !== next[key]) throw new Error("既存の接続設定と一致しません。別の抽選専用プロジェクトを使用してください。");
    });
    lotterySheet_({ sheetId: next.LOTTERY_SHEET_ID });
    SpreadsheetApp.flush();
    properties.setProperties(next, false);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
  ui.alert("抽選設定を保存しました。次に「デプロイ → 新しいデプロイ → ウェブアプリ」で公開し、末尾が /exec のURLを控えてください。まだLINEからの接続確認は完了していません。");
}
