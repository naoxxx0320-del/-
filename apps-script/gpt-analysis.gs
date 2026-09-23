/**
 * AROMA DAIAMOND｜GPT 経営・分析レポート自動生成（Google Apps Script）
 * ------------------------------------------------------------------
 * 予約データ（Googleスプレッドシート）を集計し、OpenAI API（GPT）に渡して
 * 「経営・分析担当」としての分析レポートを自動生成し、レポート用シートへ保存
 * ＋（任意で）メール送信します。時間主導トリガーで定期実行できます。
 *
 * ▼ Claude との連携（役割分担）
 *   GPT   … 分析・調査・経営（データから気づき・施策・優先度を出す）
 *   Claude… 実装（GPTのレポート末尾「Claude Codeへの実装依頼」をこのClaudeに渡す）
 *
 * ▼ 重要（プライバシー）
 *   氏名・電話・メール・フリガナ等の個人情報は OpenAI に送信しません。
 *   集計値（コース別件数・時間帯・曜日・流入元・売上合計など）のみ送ります。
 *
 * ▼ 重要（APIキー）
 *   OpenAI API キーは ChatGPT（Plus/無料）とは別物です。
 *   platform.openai.com で取得（従量課金）し、下記 Script Properties に設定します。
 *
 * ▼ セットアップ（詳細は apps-script/README.md）
 *   スクリプトのプロパティ（プロジェクトの設定 > スクリプト プロパティ）:
 *     OPENAI_API_KEY  … OpenAI の API キー（sk-... ）※必須
 *     OPENAI_MODEL    … 使用モデル名（例は platform.openai.com/docs/models で確認）
 *     SHEET_ID        … 予約データが入ったスプレッドシートのID ※必須
 *     DATA_SHEETS     … 集計対象シート名（カンマ区切り。例: "予約,LINE予約"）
 *     OWNER_EMAIL     … レポート通知メールの送り先（任意）
 */

var SP = PropertiesService.getScriptProperties();
var REPORT_SHEET = "GPT分析レポート"; // レポートの保存先（無ければ自動作成）

// 個人情報とみなす列（ヘッダー名に含まれたら OpenAI に送らない）
var PERSONAL_KEYS = ["名前", "氏名", "name", "kana", "フリガナ", "ふりがな",
  "メール", "mail", "email", "電話", "tel", "連絡", "contact", "住所", "address"];

/** 手動実行・トリガー実行の入口 */
function runAnalysis() {
  var key = SP.getProperty("OPENAI_API_KEY");
  var sheetId = SP.getProperty("SHEET_ID");
  if (!key) throw new Error("OPENAI_API_KEY が未設定です（スクリプト プロパティに設定してください）。");
  if (!sheetId) throw new Error("SHEET_ID が未設定です。");

  var summary = buildSummary_(sheetId);
  var report = callOpenAI_(key, summary);
  saveReport_(sheetId, report);

  var to = SP.getProperty("OWNER_EMAIL");
  if (to) {
    MailApp.sendEmail(
      to,
      "【AROMA DAIAMOND】GPT経営・分析レポート " +
        Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd"),
      report
    );
  }
  return report;
}

/** 予約データを集計して、個人情報を含まないサマリーテキストを作る */
function buildSummary_(sheetId) {
  var ss = SpreadsheetApp.openById(sheetId);
  var names = (SP.getProperty("DATA_SHEETS") || "予約,LINE予約")
    .split(",").map(function (s) { return s.trim(); }).filter(String);

  var lines = ["# 集計期間: 全データ（" +
    Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd") + " 時点）"];
  var grand = 0;

  names.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    var values = sh.getDataRange().getValues();
    var header = values.shift().map(String);

    // 列インデックスの推定（ヘッダー名の部分一致）
    var idx = function (keys) {
      for (var c = 0; c < header.length; c++) {
        var h = header[c].toLowerCase();
        for (var k = 0; k < keys.length; k++) {
          if (h.indexOf(keys[k]) >= 0) return c;
        }
      }
      return -1;
    };
    var iCourse = idx(["コース", "course"]);
    var iTh = idx(["セラピスト", "therapist", "指名"]);
    var iSrc = idx(["きっかけ", "source", "流入"]);
    var iPrice = idx(["料金", "price", "金額"]);
    var iDate = idx(["日", "date", "希望日"]);
    var iTime = idx(["時間", "time", "予約時間"]);

    var byCourse = {}, byTh = {}, bySrc = {}, byWeekday = {}, byHour = {};
    var revenue = 0, count = values.length;

    values.forEach(function (row) {
      grand++;
      if (iCourse >= 0) inc_(byCourse, row[iCourse]);
      if (iTh >= 0) inc_(byTh, row[iTh]);
      if (iSrc >= 0) inc_(bySrc, row[iSrc]);
      if (iPrice >= 0) {
        var p = Number(String(row[iPrice]).replace(/[^0-9.]/g, ""));
        if (!isNaN(p)) revenue += p;
      }
      if (iDate >= 0) {
        var d = parseDate_(row[iDate]);
        if (d) inc_(byWeekday, ["日", "月", "火", "水", "木", "金", "土"][d.getDay()] + "曜");
      }
      if (iTime >= 0) {
        var hm = String(row[iTime]).match(/(\d{1,2})[:：]/);
        if (hm) inc_(byHour, hm[1] + "時台");
      }
    });

    lines.push("\n## シート「" + name + "」 予約件数: " + count + "件");
    if (iPrice >= 0) lines.push("- 売上合計(概算): " + revenue.toLocaleString("ja-JP") + "円");
    if (iCourse >= 0) lines.push("- コース別: " + fmtCount_(byCourse));
    if (iTh >= 0) lines.push("- 指名/セラピスト別: " + fmtCount_(byTh));
    if (iSrc >= 0) lines.push("- 流入元別: " + fmtCount_(bySrc));
    if (iDate >= 0) lines.push("- 曜日別: " + fmtCount_(byWeekday));
    if (iTime >= 0) lines.push("- 時間帯別: " + fmtCount_(byHour));
  });

  if (grand === 0) {
    lines.push("\n（予約データがまだありません。DATA_SHEETS のシート名をご確認ください。）");
  }
  return lines.join("\n");
}

function inc_(obj, key) {
  var k = String(key == null ? "" : key).trim();
  if (!k) k = "（未入力）";
  obj[k] = (obj[k] || 0) + 1;
}
function fmtCount_(obj) {
  var arr = Object.keys(obj).map(function (k) { return [k, obj[k]]; });
  arr.sort(function (a, b) { return b[1] - a[1]; });
  return arr.map(function (x) { return x[0] + " " + x[1] + "件"; }).join(" / ") || "データなし";
}
function parseDate_(v) {
  if (v instanceof Date) return v;
  var m = String(v).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  var m2 = String(v).match(/(\d{1,2})\D+(\d{1,2})/);
  if (m2) return new Date(new Date().getFullYear(), +m2[1] - 1, +m2[2]);
  return null;
}

/** OpenAI Chat Completions を呼び、分析レポート本文を返す */
function callOpenAI_(key, summary) {
  var model = SP.getProperty("OPENAI_MODEL") || "gpt-4o-mini";
  var system =
    "あなたは東京・亀戸のメンズエステ『AROMA DAIAMOND』の経営・分析アドバイザーです。" +
    "渡されるのは個人を特定できない集計データのみです。日本語で、次の構成で簡潔に出力してください。\n" +
    "1) 現状サマリ（数字の要点）\n" +
    "2) 気づき・課題（データから読み取れること）\n" +
    "3) 施策提案（優先度 P0〜P2 を付け、根拠と期待効果を一言で）\n" +
    "4) Claude Codeへの実装依頼（サイトで実装可能な施策があれば、具体的な指示として箇条書き）\n" +
    "5) 追加で取得したいデータ（判断精度を上げるために欲しい数値）\n" +
    "推測で数値を断定せず、データが乏しい項目は『データ不足』と明記すること。" +
    "最終的な経営判断は経営者が行う前提で、提案として述べること。";
  var payload = {
    model: model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: "以下は当店の予約集計データです。分析と提案をお願いします。\n\n" + summary },
    ],
    temperature: 0.4,
  };
  var res = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + key },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code !== 200) {
    throw new Error("OpenAI APIエラー (" + code + "): " + body.slice(0, 500));
  }
  var json = JSON.parse(body);
  return (json.choices && json.choices[0] && json.choices[0].message.content) || "(空の応答)";
}

/** レポートをシートへ保存 */
function saveReport_(sheetId, report) {
  var ss = SpreadsheetApp.openById(sheetId);
  var sh = ss.getSheetByName(REPORT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(REPORT_SHEET);
    sh.appendRow(["生成日時", "レポート"]);
  }
  sh.appendRow([
    Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm"),
    report,
  ]);
}

/** 週1回（毎週月曜9時）自動実行するトリガーを作成（1回だけ実行すればOK） */
function setupWeeklyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "runAnalysis") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("runAnalysis")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .inTimezone("Asia/Tokyo")
    .create();
}
