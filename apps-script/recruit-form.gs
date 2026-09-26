/**
 * AROMA DAIAMOND｜求人応募フォームの受付（Google Apps Script）
 * ------------------------------------------------------------------
 * サイトの応募フォーム（/careers/・/recruit/）から POST された応募内容を
 * スプレッドシートに保存し、店舗宛にメール通知します。
 * 既存の「予約フォーム」と同じ仕組み（doPost）です。求人は専用のスプレッド
 * シートに保存するため、予約とは別のプロジェクトとして用意することを推奨します。
 *
 * 【セットアップ手順】
 *  1. 応募を保存したい Google スプレッドシートを新規作成する。
 *  2. 拡張機能 > Apps Script を開き、このコードを貼り付ける。
 *  3. 下の NOTIFY_TO に通知先メールアドレスを設定する。
 *  4. 「デプロイ > 新しいデプロイ > 種類: ウェブアプリ」を選ぶ。
 *     - 次のユーザーとして実行: 自分
 *     - アクセスできるユーザー: 全員
 *  5. 発行された「ウェブアプリのURL（/exec で終わるもの）」をコピーし、
 *     リポジトリの data/recruit-config.json の "endpoint" に貼り付ける。
 *  6. 募集を開始するときは data/recruit-config.json の該当 role の
 *     "status" を "draft" から "open" に変更する。
 *
 * ※応募者の個人情報を扱います。共有範囲・アクセス権限にご注意ください。
 */

// 通知先メールアドレス（必要に応じて変更してください）
var NOTIFY_TO = "naoxxx0320@gmail.com";

// 保存先シート名
var SHEET_NAME = "応募";

function doPost(e) {
  try {
    var p = (e && e.parameter) || {};
    var now = new Date();
    var tz = "Asia/Tokyo";
    var ts = Utilities.formatDate(now, tz, "yyyy/MM/dd HH:mm:ss");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        "受付日時", "応募職種", "職種キー", "お名前", "連絡方法", "連絡先",
        "希望時間帯", "希望勤務日数", "経験", "勤務開始希望", "ご質問・ご希望",
      ]);
    }

    sheet.appendRow([
      ts,
      p.roleLabel || "",
      p.role || "",
      p.name || "",
      p.method || "",
      p.contact || "",
      p.timePref || "",
      p.daysPref || "",
      p.experience || "",
      p.startPref || "",
      p.note || "",
    ]);

    // 店舗宛の通知メール（任意）
    if (NOTIFY_TO) {
      var body =
        "求人応募がありました。\n\n" +
        "受付日時: " + ts + "\n" +
        "応募職種: " + (p.roleLabel || "") + "\n" +
        "お名前: " + (p.name || "") + "\n" +
        "連絡方法: " + (p.method || "") + "\n" +
        "連絡先: " + (p.contact || "") + "\n" +
        "希望時間帯: " + (p.timePref || "") + "\n" +
        "希望勤務日数: " + (p.daysPref || "") + "\n" +
        "経験: " + (p.experience || "") + "\n" +
        "勤務開始希望: " + (p.startPref || "") + "\n" +
        "ご質問・ご希望: " + (p.note || "") + "\n";
      MailApp.sendEmail(NOTIFY_TO, "【求人応募】" + (p.roleLabel || "") + " " + (p.name || ""), body);
    }

    return ContentService.createTextOutput("OK").setMimeType(
      ContentService.MimeType.TEXT
    );
  } catch (err) {
    return ContentService.createTextOutput("ERROR: " + err).setMimeType(
      ContentService.MimeType.TEXT
    );
  }
}

// 動作確認用（ブラウザで開いたときの応答）
function doGet() {
  return ContentService.createTextOutput("AROMA DAIAMOND recruit endpoint OK");
}
