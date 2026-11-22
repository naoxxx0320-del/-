/* =====================================================================
   Googleビジネスプロフィール（GBP）への自動投稿
   ---------------------------------------------------------------------
   サイトの「お知らせ」に、その日（日本時間）に公開された記事があり、
   記事に Google投稿用の文章（news.json の "gbp"）が入っていれば、
   17時以降に1回だけ GBP の「最新情報」として投稿する。

   ・予約管理システムとは別の、新しい Apps Script プロジェクトに貼り付けて使う
     （予約・管理画面のプロジェクトの権限設定を変えないため）。
   ・店舗のビジネスプロフィールのオーナー（または管理者）の Google アカウントで実行する。
     認証はそのアカウントの権限（ScriptApp.getOAuthToken）を使うので、
     APIキーや秘密の文字列をコードやリポジトリに置かない。
   ・記事がサイトに出ている（ページが開ける）ことを確かめてから投稿する。
   ・スクリプトプロパティ GBP_AUTOPOST が "true" になるまでは投稿せず、
     「投稿する予定の内容」を実行ログに出すだけ（試運転）。

   スクリプトプロパティ：
     GBP_LOCATION     … 投稿先。gbpListLocations() の結果の "accounts/…/locations/…"
     GBP_AUTOPOST     … "true" で実際に投稿する（それ以外は試運転）
     GBP_NOTIFY_EMAIL … 投稿の成功・失敗を知らせるメールアドレス（任意）
     GBP_POSTED       … 投稿済みの記事の記録（自動で書き込む。手で変えない）
   手順は apps-script/gbp-autopost.md を参照。
   ===================================================================== */

var GBP_DEFAULTS_ = {
  NEWS_URL: "https://raw.githubusercontent.com/naoxxx0320-del/-/main/data/news.json",
  SITE_URL: "https://aroma-daiamond.com/",
  START_HOUR: 17, // この時刻（日本時間）以降に投稿する
  MAX_TRIES: 3, // 同じ記事の投稿失敗がこの回数に達したら、その記事はあきらめて知らせる
};
var GBP_API_ = {
  POSTS: "https://mybusiness.googleapis.com/v4/",
  ACCOUNTS: "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
  INFO: "https://mybusinessbusinessinformation.googleapis.com/v1/",
};

function gbpProps_() { return PropertiesService.getScriptProperties(); }
function gbpProp_(k, d) {
  var v = gbpProps_().getProperty(k);
  return v == null || v === "" ? d : v;
}
function gbpToday_() { return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd"); }
function gbpHour_() { return Number(Utilities.formatDate(new Date(), "Asia/Tokyo", "H")); }
function gbpSite_() {
  var s = gbpProp_("SITE_URL", GBP_DEFAULTS_.SITE_URL);
  return /\/$/.test(s) ? s : s + "/";
}

/* 投稿済みの記録 { 記事id: {state:"posted"|"failed", tries, at, name?, error?} } */
function gbpPosted_() {
  try { return JSON.parse(gbpProp_("GBP_POSTED", "{}")) || {}; } catch (e) { return {}; }
}
function gbpSavePosted_(m) {
  // 古い記録は30件だけ残す（プロパティの容量対策）
  var ids = Object.keys(m).sort().reverse().slice(0, 30), out = {};
  ids.forEach(function (k) { out[k] = m[k]; });
  gbpProps_().setProperty("GBP_POSTED", JSON.stringify(out));
}

function gbpFetchJson_(url, opt) {
  var res = UrlFetchApp.fetch(url, Object.assign({ muteHttpExceptions: true }, opt || {}));
  var txt = res.getContentText(), json = null;
  try { json = txt ? JSON.parse(txt) : {}; } catch (e) { json = null; }
  return { code: res.getResponseCode(), json: json, text: txt };
}
function gbpAuth_() {
  return { Authorization: "Bearer " + ScriptApp.getOAuthToken() };
}

/* 公開中のお知らせ（news.json）を読む。読めなければ null。 */
function gbpNews_() {
  var url = gbpProp_("NEWS_URL", GBP_DEFAULTS_.NEWS_URL);
  var r = gbpFetchJson_(url + (url.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now());
  if (r.code !== 200 || !r.json || !Array.isArray(r.json.posts)) return null;
  return r.json.posts;
}

/* 今日（日本時間）公開で、Google投稿用の文章があり、まだ投稿していない記事 */
function gbpCandidates_(posts, today, posted) {
  return (posts || []).filter(function (p) {
    if (!p || p.status !== "public" || p.date !== today) return false;
    if (!/^[\w-]+$/.test(String(p.id || ""))) return false;
    if (!String(p.gbp || "").trim()) return false;
    var rec = posted[p.id];
    return !rec || (rec.state === "failed" && (rec.tries || 0) < GBP_DEFAULTS_.MAX_TRIES);
  });
}

/* 記事のページがサイトに出ているか（ページが開けて、記事のURLが書かれている） */
function gbpIsLive_(p) {
  var url = gbpSite_() + "news/" + p.id + "/";
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  return res.getResponseCode() === 200 && res.getContentText().indexOf("news/" + p.id + "/") >= 0;
}

/* GBP に送る内容（LocalPost） */
function gbpBody_(p, withPhoto) {
  var body = {
    languageCode: "ja",
    topicType: "STANDARD",
    summary: String(p.gbp).trim().slice(0, 1500),
    callToAction: { actionType: "LEARN_MORE", url: gbpSite_() + "news/" + p.id + "/" },
  };
  if (withPhoto && p.image && /^[\w\-]+\.(jpe?g|png)$/i.test(p.image)) {
    body.media = [{ mediaFormat: "PHOTO", sourceUrl: gbpSite_() + p.image }];
  }
  return body;
}

function gbpSend_(location, body) {
  return gbpFetchJson_(GBP_API_.POSTS + location + "/localPosts", {
    method: "post",
    contentType: "application/json",
    headers: gbpAuth_(),
    payload: JSON.stringify(body),
  });
}

function gbpNotify_(subject, text) {
  var to = gbpProp_("GBP_NOTIFY_EMAIL", "");
  if (!to) return;
  try { MailApp.sendEmail(to, "[AROMA DIAMOND] " + subject, text); } catch (e) { Logger.log("メール送信に失敗: " + e); }
}

/* ===== トリガーから毎時呼ばれる本体 ===== */
function gbpAutoPost() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { done: false, reason: "busy" };
  try {
    return gbpRun_(false);
  } finally {
    lock.releaseLock();
  }
}
/* エディタから実行：今日投稿する予定の内容を確かめる（投稿しない） */
function gbpPreview() { return gbpRun_(true); }

function gbpRun_(previewOnly) {
  var today = gbpToday_();
  if (!previewOnly && gbpHour_() < Number(gbpProp_("START_HOUR", GBP_DEFAULTS_.START_HOUR))) {
    return { done: false, reason: "before_start" };
  }
  var posts = gbpNews_();
  if (!posts) {
    Logger.log("お知らせのデータが読めませんでした。次の回にもう一度試します。");
    return { done: false, reason: "news_unreadable" };
  }
  var posted = gbpPosted_();
  var list = gbpCandidates_(posts, today, posted);
  if (!list.length) {
    Logger.log(today + "：投稿する記事はありません。");
    return { done: false, reason: "no_post" };
  }
  var p = list[0]; // 1回の実行で1本だけ
  if (!gbpIsLive_(p)) {
    Logger.log("記事「" + p.title + "」はまだサイトに出ていません。次の回にもう一度確かめます。");
    return { done: false, reason: "not_live", id: p.id };
  }
  var location = gbpProp_("GBP_LOCATION", "");
  var body = gbpBody_(p, true);
  if (previewOnly || gbpProp_("GBP_AUTOPOST", "") !== "true" || !/^accounts\/\d+\/locations\/\d+$/.test(location)) {
    Logger.log("【試運転：投稿していません】投稿先 " + (location || "（GBP_LOCATION 未設定）") + "\n" + JSON.stringify(body, null, 2));
    return { done: false, reason: "dry_run", id: p.id, body: body };
  }

  var r = gbpSend_(location, body);
  if (r.code >= 300 && body.media) {
    // 写真が原因で断られることがあるため、写真なしで1回だけ送り直す
    Logger.log("写真付きの投稿が失敗（" + r.code + "）。写真なしで送り直します。");
    body = gbpBody_(p, false);
    r = gbpSend_(location, body);
  }
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX");
  var prev = posted[p.id] || {};
  if (r.code < 300) {
    posted[p.id] = { state: "posted", tries: (prev.tries || 0) + 1, at: now, name: (r.json && r.json.name) || "", gbpState: (r.json && r.json.state) || "" };
    gbpSavePosted_(posted);
    Logger.log("投稿しました：" + p.title + "（" + posted[p.id].name + "）");
    gbpNotify_("Googleに投稿しました", "記事：" + p.title + "\n投稿の状態：" + (posted[p.id].gbpState || "不明") + "\n記事：" + body.callToAction.url);
    return { done: true, id: p.id, name: posted[p.id].name };
  }
  var err = (r.json && r.json.error && (r.json.error.message || r.json.error.status)) || String(r.text || "").slice(0, 200);
  posted[p.id] = { state: "failed", tries: (prev.tries || 0) + 1, at: now, error: r.code + " " + err };
  gbpSavePosted_(posted);
  Logger.log("投稿に失敗しました（" + r.code + "）：" + err);
  if (posted[p.id].tries >= GBP_DEFAULTS_.MAX_TRIES) {
    gbpNotify_("Googleへの投稿に失敗しました", "記事：" + p.title + "\nエラー：" + r.code + " " + err +
      "\n" + GBP_DEFAULTS_.MAX_TRIES + "回失敗したため、この記事の自動投稿をやめました。Googleビジネスプロフィールから手動で投稿してください。");
  }
  return { done: false, reason: "api_error", code: r.code, error: err, id: p.id };
}

/* ===== エディタから1回実行する設定用の関数 ===== */

/* 投稿先の確認：このアカウントで管理しているビジネスプロフィールの一覧を実行ログに出す */
function gbpListLocations() {
  var a = gbpFetchJson_(GBP_API_.ACCOUNTS, { headers: gbpAuth_() });
  if (a.code !== 200) {
    Logger.log("アカウントの一覧を取得できませんでした（" + a.code + "）。APIの利用承認・有効化を確認してください。\n" + String(a.text).slice(0, 500));
    return [];
  }
  var out = [];
  (a.json.accounts || []).forEach(function (acc) {
    var l = gbpFetchJson_(GBP_API_.INFO + acc.name + "/locations?readMask=name,title&pageSize=100", { headers: gbpAuth_() });
    ((l.json && l.json.locations) || []).forEach(function (loc) {
      // 投稿のAPI（v4）は "accounts/…/locations/…" の形で指定する
      var full = acc.name + "/" + loc.name;
      out.push(full);
      Logger.log(full + "　" + (loc.title || ""));
    });
  });
  if (!out.length) Logger.log("ビジネスプロフィールが見つかりませんでした。オーナーか管理者のアカウントで実行してください。");
  return out;
}

/* 毎時の自動実行を設定する（17時以降、その日の記事を1回だけ投稿） */
function setupGbpAutoPost() {
  stopGbpAutoPost();
  ScriptApp.newTrigger("gbpAutoPost").timeBased().everyHours(1).create();
  Logger.log("自動投稿の確認を1時間ごとに実行するよう設定しました（投稿は17時以降・1日1本）。");
}
function stopGbpAutoPost() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "gbpAutoPost") ScriptApp.deleteTrigger(t);
  });
}
