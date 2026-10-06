/**
 * AROMA DAIAMOND — LINE 自動応答＋自動予約 bot（Google Apps Script）
 * =====================================================================
 * これは「サイト」とは別に動くサーバー処理です。LINE Messaging API の
 * Webhook を受け取り、トーク上で自動応答・予約受付を行い、予約内容を
 * Googleスプレッドシート（出勤情報と同じブック）に書き込みます。
 *
 * ■ 構成（予約管理システムと連携）
 *   LINE → Cloudflare Worker（X-Line-Signature を検証）→ このボット（会話）
 *        → 予約管理API（apps-script/booking の Code.gs）line_event → 共有台帳
 *   ・GASのdoPostでは署名ヘッダを直接取得できないため、署名検証はWorkerで行う。
 *   ・このボットはWorker経由（proxySecret一致）の正規リクエストのみ受理する。
 *   ・予約は独自シートではなく「共有台帳」に一本化（WEB/LINE/電話を同一台帳で管理）。
 *
 * ■ 設定（スクリプトのプロパティに登録：プロジェクトの設定 → スクリプト プロパティ）
 *   LINE_CHANNEL_ACCESS_TOKEN … Messaging API チャネルの長期アクセストークン
 *   LINE_CHANNEL_SECRET        … チャネルシークレット（※署名検証はWorker側で使用）
 *   SHEET_ID                   … 出勤情報が入ったスプレッドシートのID（出勤読取に使用）
 *   OWNER_EMAIL                … 予約通知メールの送り先（任意）
 *   PROXY_SHARED_SECRET        … Worker／予約管理APIと共有する秘密文字列（必須）
 *   BOOKING_API_URL            … 予約管理API（公開デプロイ）の /exec URL（必須）
 *
 * ■ デプロイ：デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *   実行するユーザー = 自分 / アクセスできるユーザー = 全員
 *   発行された /exec URL を Cloudflare Worker の GAS_EXEC_URL に設定し、
 *   LINE の Webhook URL は「Worker の URL」に設定する（直接このURLを登録しない）。
 *
 * 詳しい手順は apps-script/README.md / apps-script/booking/README.md を参照。
 * =====================================================================
 */

// ---- 設定値 ----
const SP = PropertiesService.getScriptProperties();
const TOKEN = SP.getProperty("LINE_CHANNEL_ACCESS_TOKEN");
const CHANNEL_SECRET = SP.getProperty("LINE_CHANNEL_SECRET");
const SHEET_ID = SP.getProperty("SHEET_ID");
const OWNER_EMAIL = SP.getProperty("OWNER_EMAIL") || "";

const SCHEDULE_SHEET = "出勤情報"; // 日付/ラベル/エリア/名前/出勤時間/ステータス/出勤/区分
// 予約は独自シートではなく共有台帳（予約管理API）へ一本化（旧 "LINE予約" シートは廃止）。
const AREA = "亀戸";
const TEL = "090-4391-8013";

// コース（サイトの reserve-config.json と揃える）
const COURSES = [
  { label: "60分コース", price: 13000, honshimei: false },
  { label: "70分あおむけコース", price: 18000, honshimei: false },
  { label: "90分コース", price: 18000, honshimei: false },
  { label: "120分コース", price: 23000, honshimei: false },
  { label: "150分コース", price: 28000, honshimei: true },
];

const yen = (n) => "¥" + Number(n).toLocaleString("en-US");

/* =========================================================
   Webhook エントリポイント
   ========================================================= */
function doPost(e) {
  try {
    let body = {};
    try {
      body = JSON.parse(e.postData.contents);
    } catch (_) {
      body = (e && e.parameter) || {};
    }

    // Cloudflare Worker で X-Line-Signature を検証済みの正規Webhookのみ受理する。
    // Worker は {action:"line_webhook", proxySecret, lineBody(生のLINE JSON文字列)} を転送する。
    // （GASのdoPostでは署名ヘッダを直接取得できないため、検証はWorker側で実施）
    const proxySecret = SP.getProperty("PROXY_SHARED_SECRET") || "";
    if (body.action === "line_webhook") {
      if (!proxySecret || body.proxySecret !== proxySecret) {
        return ContentService.createTextOutput("unauthorized");
      }
      let line = {};
      try {
        line = JSON.parse(body.lineBody || "{}");
      } catch (_) {}
      (line.events || []).forEach(handleEvent);
      return ContentService.createTextOutput("OK");
    }

    // プロキシ未経由（署名検証不可）の直接Webhookは受理しない＝なりすまし防止。
    // LINEのWebhook URLには必ず Worker のURLを設定してください。
    return ContentService.createTextOutput("forbidden");
  } catch (err) {
    console.error("doPost error: " + err);
    return ContentService.createTextOutput("OK"); // LINEへは200で応答（再送ループ回避）
  }
}

function handleEvent(ev) {
  const uid = ev.source && ev.source.userId;
  if (ev.type === "follow") {
    reply(ev.replyToken, [welcomeMessage()]);
    return;
  }
  if (ev.type === "postback") {
    handlePostback(uid, ev.postback.data, ev.replyToken);
    return;
  }
  if (ev.type === "message" && ev.message.type === "text") {
    handleText(uid, (ev.message.text || "").trim(), ev.replyToken);
    return;
  }
}

/* =========================================================
   状態管理（ユーザーごと・CacheServiceに1時間保持）
   ========================================================= */
function getState(uid) {
  const c = CacheService.getScriptCache().get("st_" + uid);
  return c ? JSON.parse(c) : null;
}
function setState(uid, s) {
  CacheService.getScriptCache().put("st_" + uid, JSON.stringify(s), 3600);
}
function clearState(uid) {
  CacheService.getScriptCache().remove("st_" + uid);
}

/* =========================================================
   テキスト受信
   ========================================================= */
function handleText(uid, text, replyToken) {
  const st = getState(uid);

  // 予約フローの「お名前入力」ステップ
  if (st && st.step === "name") {
    st.name = text;
    st.step = "confirm";
    setState(uid, st);
    reply(replyToken, [confirmMessage(st)]);
    return;
  }
  // 予約フローの「時間 自由入力」も許可
  if (st && st.step === "time") {
    const t = normalizeTime(text);
    if (t) {
      st.time = t;
      st.step = "course";
      setState(uid, st);
      reply(replyToken, [courseMessage()]);
      return;
    }
  }

  // キーワード自動応答
  if (/予約|よやく/.test(text)) return startBooking(uid, replyToken);
  if (/料金|コース|値段|price/i.test(text)) return reply(replyToken, [priceMessage()]);
  if (/出勤|本日|今日|だれ|誰/.test(text)) return reply(replyToken, [todayMessage()]);
  if (/アクセス|場所|住所|どこ/.test(text)) return reply(replyToken, [accessMessage()]);
  if (/電話|でんわ|tel/i.test(text)) return reply(replyToken, [telMessage()]);
  if (/キャンセル|やめ|中止/.test(text)) {
    clearState(uid);
    return reply(replyToken, [textMsg("ご予約の入力を中止しました。またいつでもどうぞ。")]);
  }

  // それ以外はメニュー案内
  reply(replyToken, [menuMessage()]);
}

/* =========================================================
   ポストバック受信（ボタン選択）
   ========================================================= */
function handlePostback(uid, data, replyToken) {
  const q = parseQuery(data);
  const a = q.a;

  if (a === "start") return startBooking(uid, replyToken);
  if (a === "price") return reply(replyToken, [priceMessage()]);
  if (a === "today") return reply(replyToken, [todayMessage()]);

  let st = getState(uid) || {};

  if (a === "date") {
    st = { step: "th", date: q.v, label: q.l || q.v };
    setState(uid, st);
    return reply(replyToken, [therapistMessage(q.v)]);
  }
  if (a === "th") {
    st.therapist = q.v;
    st.step = "time";
    setState(uid, st);
    return reply(replyToken, [timeMessage(st.date, q.v)]);
  }
  if (a === "time") {
    st.time = q.v;
    st.step = "course";
    setState(uid, st);
    return reply(replyToken, [courseMessage()]);
  }
  if (a === "course") {
    const c = COURSES[Number(q.v)];
    if (!c) return reply(replyToken, [courseMessage()]);
    if (c.honshimei && st.therapist === "おまかせ") {
      return reply(replyToken, [
        textMsg("150分以上のコースは本指名（セラピストご指名）のみご予約いただけます。セラピストを選び直してください。"),
        therapistMessage(st.date),
      ]);
    }
    st.course = c.label;
    st.price = c.price;
    st.step = "name";
    setState(uid, st);
    return reply(replyToken, [textMsg("お名前（ニックネーム可）をご入力ください。")]);
  }
  if (a === "confirm") {
    return finalizeBooking(uid, replyToken);
  }
  if (a === "cancel") {
    clearState(uid);
    return reply(replyToken, [textMsg("ご予約の入力を中止しました。")]);
  }
  // 不明なpostback
  return reply(replyToken, [menuMessage()]);
}

/* =========================================================
   予約フロー
   ========================================================= */
function startBooking(uid, replyToken) {
  const days = getDays();
  if (days.length === 0) {
    return reply(replyToken, [
      textMsg(
        "申し訳ございません。ただ今オンライン予約枠の準備中です。お電話（" +
          TEL +
          "）でご連絡ください。"
      ),
    ]);
  }
  setState(uid, { step: "date" });
  reply(replyToken, [dateMessage(days)]);
}

function finalizeBooking(uid, replyToken) {
  const st = getState(uid);
  if (!st || !st.date || !st.therapist || !st.time || !st.course || !st.name) {
    clearState(uid);
    return reply(replyToken, [textMsg("入力が不完全でした。もう一度「予約」と送ってください。")]);
  }
  const name = getDisplayName(uid);

  // 共有台帳（予約管理API Code.gs）へ line_event として登録する。
  // ・重複／出勤外／満席の判定はバックエンド（LockService＋区間重複）で行う。
  // ・冪等キーで Webhook 再送・確定ボタン二度押しの二重作成を防ぐ。
  const res = createOnLedger_({
    therapistId: st.therapist,
    therapistName: st.therapist,
    dateStr: st.date,
    timeLabel: st.time,
    course: st.course,
    price: st.price,
    customerName: st.name,
    lineUserId: uid,
    idempotencyKey: ["LINE", uid, st.date, st.time, st.course].join("|"),
  });

  // バックエンド結果を確認してから完了を案内（＝未登録を完了と誤表示しない）。
  if (!res || !res.ok) {
    st.step = "time";
    setState(uid, st);
    return reply(replyToken, [
      textMsg(
        (res && res.reason) ||
          "申し訳ございません。その枠はご予約いただけませんでした。別の時間をお選びください。"
      ),
      timeMessage(st.date, st.therapist),
    ]);
  }

  // オーナー通知（任意）
  if (OWNER_EMAIL) {
    try {
      MailApp.sendEmail(
        OWNER_EMAIL,
        "【LINE予約】" + st.therapist + " " + (st.label || st.date) + " " + st.time,
        [
          "LINEから新しい予約が入りました。",
          "日時: " + (st.label || st.date) + " " + st.time,
          "セラピスト: " + st.therapist,
          "コース: " + st.course + "（" + yen(st.price) + "）",
          "お名前: " + st.name + "（LINE表示名: " + name + "）",
          "予約ID: " + (res.id || ""),
        ].join("\n")
      );
    } catch (e) {}
  }
  clearState(uid);
  reply(replyToken, [
    textMsg(
      [
        "ご予約ありがとうございます。以下の内容で【仮予約】を承りました。",
        "",
        "▼ご予約内容",
        "日時: " + (st.label || st.date) + " " + st.time,
        "セラピスト: " + st.therapist,
        "コース: " + st.course + "（" + yen(st.price) + "）",
        "お名前: " + st.name,
        "",
        "確定のご連絡を店舗より差し上げます。変更・キャンセルはお電話（" + TEL + "）まで。",
      ].join("\n")
    ),
  ]);
}

/* 共有台帳API（予約管理 Code.gs の公開デプロイ）へ line_event をPOSTして登録する。
   戻り値は {ok:true,id,status,confirmToken} もしくは {ok:false,reason}。
   サーバ間通信（CORS無関係）。proxySecret で正規ルートであることを示す。 */
function createOnLedger_(payload) {
  const url = SP.getProperty("BOOKING_API_URL") || "";
  const secret = SP.getProperty("PROXY_SHARED_SECRET") || "";
  if (!url || !secret) {
    return {
      ok: false,
      reason: "ただ今オンライン予約の受付準備中です。お手数ですがお電話（" + TEL + "）でご予約ください。",
    };
  }
  const body = Object.assign({ action: "line_event", proxySecret: secret }, payload);
  try {
    const r = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
      followRedirects: true,
    });
    try {
      return JSON.parse(r.getContentText());
    } catch (_) {
      return { ok: false, reason: "予約連携の応答が不正でした。お手数ですがお電話（" + TEL + "）でご予約ください。" };
    }
  } catch (e) {
    return { ok: false, reason: "予約連携に失敗しました。お手数ですがお電話（" + TEL + "）でご予約ください。" };
  }
}

/* =========================================================
   スプレッドシート
   ========================================================= */
function ss() {
  return SpreadsheetApp.openById(SHEET_ID);
}

// 出勤情報を読み、[{date,label,name,time,status}] を返す（欠勤✖️・申請中は除外）
function readSchedule() {
  const sh = ss().getSheetByName(SCHEDULE_SHEET);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  // 見出し行（「名前」を含む行）を探す
  let hi = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i].map((c) => String(c).trim()).indexOf("名前") >= 0) {
      hi = i;
      break;
    }
  }
  const head = values[hi].map((c) => String(c).trim());
  const col = (name) => head.indexOf(name);
  const ci = {
    date: col("日付"),
    label: col("ラベル"),
    name: col("名前"),
    time: col("出勤時間") >= 0 ? col("出勤時間") : col("時間"),
    status: col("ステータス"),
    present: col("出勤"),
    kbn: col("区分"),
  };
  const out = [];
  const absent = (v) => /^(✖️|✖|✗|×|✕|x|欠|欠勤|休|no|false|非表示)$/i.test(String(v || "").trim());
  const draft = (v) => /^(申請|申請中|希望|希望休|未確定|保留|draft|下書き)$/i.test(String(v || "").trim());
  for (let i = hi + 1; i < values.length; i++) {
    const r = values[i];
    const date = ci.date >= 0 ? String(r[ci.date]).trim() : "";
    const name = ci.name >= 0 ? String(r[ci.name]).trim() : "";
    if (!date || !name) continue;
    if (ci.present >= 0 && absent(r[ci.present])) continue;
    if (ci.kbn >= 0 && draft(r[ci.kbn])) continue;
    out.push({
      date: normalizeDate(date),
      label: ci.label >= 0 && r[ci.label] ? String(r[ci.label]).trim() : normalizeDate(date),
      name: name,
      time: ci.time >= 0 ? String(r[ci.time]).trim() : "",
      status: ci.status >= 0 ? String(r[ci.status]).trim() : "",
    });
  }
  return out;
}

function getDays() {
  const rows = readSchedule();
  const seen = {};
  const days = [];
  rows.forEach((r) => {
    if (!seen[r.date]) {
      seen[r.date] = true;
      days.push({ date: r.date, label: r.label });
    }
  });
  return days.slice(0, 10);
}

function getTherapistsOn(date) {
  const rows = readSchedule().filter((r) => r.date === date);
  const names = [];
  rows.forEach((r) => {
    if (names.indexOf(r.name) < 0) names.push(r.name);
  });
  return { names: names, rows: rows };
}

function getShiftOf(date, name) {
  const r = readSchedule().find((x) => x.date === date && x.name === name);
  return r ? r.time : "";
}

// ※ 予約の書き込み・重複チェックは共有台帳（予約管理API Code.gs）に一本化したため、
//    旧 writeReservation / isTaken（独自 "LINE予約" シート）は廃止しました。
//    登録は createOnLedger_()、重複/出勤外/満席の判定はバックエンド側で行います。

/* =========================================================
   メッセージ（テキスト＆クイックリプライ）
   ========================================================= */
function textMsg(text) {
  return { type: "text", text: text };
}

function qr(items) {
  return { items: items.slice(0, 13) }; // LINEの上限13件
}
function qrPostback(label, data, displayText) {
  return {
    type: "action",
    action: {
      type: "postback",
      label: String(label).slice(0, 20),
      data: data,
      displayText: displayText || label,
    },
  };
}

function welcomeMessage() {
  return {
    type: "text",
    text:
      "AROMA DAIAMOND（亀戸）へようこそ。\n「予約」と送るか下のボタンからご予約いただけます。\n料金・本日の出勤もお気軽にどうぞ。",
    quickReply: qr([
      qrPostback("📅 予約する", "a=start"),
      qrPostback("💰 料金", "a=price"),
      qrPostback("👩 本日の出勤", "a=today"),
    ]),
  };
}

function menuMessage() {
  return {
    type: "text",
    text: "ご用件をお選びください。",
    quickReply: qr([
      qrPostback("📅 予約する", "a=start"),
      qrPostback("💰 料金", "a=price"),
      qrPostback("👩 本日の出勤", "a=today"),
    ]),
  };
}

function priceMessage() {
  const lines = COURSES.map(
    (c) => "・" + c.label + " … " + yen(c.price) + (c.honshimei ? "（本指名のみ）" : "")
  );
  return textMsg("【コース料金】\n" + lines.join("\n") + "\n\nご予約は「予約」と送ってください。");
}

function todayMessage() {
  const days = getDays();
  if (days.length === 0) return textMsg("本日の出勤情報は準備中です。お電話（" + TEL + "）でご確認ください。");
  const today = days[0];
  const { rows } = getTherapistsOn(today.date);
  const lines = rows.map(
    (r) => "・" + r.name + "  " + (r.time || "") + (r.status ? "  【" + r.status + "】" : "")
  );
  return textMsg("【" + today.label + " の出勤】\n" + lines.join("\n") + "\n\nご予約は「予約」と送ってください。");
}

function accessMessage() {
  return textMsg(
    "【アクセス】\nエリア：東京都・" + AREA + "\nお部屋の住所はご予約確定後にご案内いたします。\nお電話：" + TEL
  );
}
function telMessage() {
  return textMsg("お電話：" + TEL + "\n[営業]10:00〜翌5:00 / [電話受付]9:30〜翌4:00");
}

function dateMessage(days) {
  return {
    type: "text",
    text: "ご希望の日を選んでください。",
    quickReply: qr(
      days.map((d) => qrPostback(d.label, "a=date&v=" + enc(d.date) + "&l=" + enc(d.label), d.label))
    ),
  };
}

function therapistMessage(date) {
  const { names } = getTherapistsOn(date);
  const items = names.map((n) => qrPostback(n, "a=th&v=" + enc(n), n));
  items.push(qrPostback("おまかせ（指名なし）", "a=th&v=" + enc("おまかせ"), "おまかせ"));
  return {
    type: "text",
    text: "セラピストを選んでください。",
    quickReply: qr(items),
  };
}

function timeMessage(date, therapist) {
  const shift = therapist === "おまかせ" ? "10:00〜翌5:00" : getShiftOf(date, therapist);
  const slots = hourlySlots(shift);
  const items = slots.map((s) => qrPostback(s, "a=time&v=" + enc(s), s));
  return {
    type: "text",
    text:
      "ご希望の開始時間を選んでください。\n（一覧に無い時間は直接ご入力いただけます／出勤 " +
      (shift || "未設定") +
      "）",
    quickReply: qr(items),
  };
}

function courseMessage() {
  const items = COURSES.map((c, i) =>
    qrPostback(c.label.replace("コース", ""), "a=course&v=" + i, c.label)
  );
  return {
    type: "text",
    text: "コースを選んでください。",
    quickReply: qr(items),
  };
}

function confirmMessage(st) {
  return {
    type: "text",
    text:
      [
        "以下の内容でよろしいですか？",
        "",
        "日時: " + (st.label || st.date) + " " + st.time,
        "セラピスト: " + st.therapist,
        "コース: " + st.course + "（" + yen(st.price) + "）",
        "お名前: " + st.name,
      ].join("\n"),
    quickReply: qr([
      qrPostback("✅ この内容で予約", "a=confirm", "予約を確定"),
      qrPostback("✖️ キャンセル", "a=cancel", "キャンセル"),
    ]),
  };
}

/* =========================================================
   LINE API
   ========================================================= */
function reply(replyToken, messages) {
  if (!replyToken) return;
  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + TOKEN },
    payload: JSON.stringify({ replyToken: replyToken, messages: messages }),
    muteHttpExceptions: true,
  });
}

function getDisplayName(uid) {
  try {
    const res = UrlFetchApp.fetch("https://api.line.me/v2/bot/profile/" + uid, {
      headers: { Authorization: "Bearer " + TOKEN },
      muteHttpExceptions: true,
    });
    const j = JSON.parse(res.getContentText());
    return j.displayName || "";
  } catch (e) {
    return "";
  }
}

/* =========================================================
   ユーティリティ
   ========================================================= */
function enc(s) {
  return encodeURIComponent(String(s));
}
function parseQuery(data) {
  const o = {};
  String(data || "")
    .split("&")
    .forEach((kv) => {
      const p = kv.split("=");
      o[p[0]] = decodeURIComponent(p[1] || "");
    });
  return o;
}
function normalizeDate(s) {
  const m = String(s || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (m) return m[1] + "/" + Number(m[2]) + "/" + Number(m[3]);
  return String(s || "").trim();
}
function normalizeTime(s) {
  const m = String(s || "").match(/(翌)?\s*(\d{1,2})[:：](\d{2})/);
  if (!m) return "";
  return (m[1] ? "翌" : "") + Number(m[2]) + ":" + m[3];
}
// 出勤時間 "13:00〜翌2:00" → 1時間刻みの開始候補（最大12件）
function hourlySlots(shift) {
  const m = String(shift || "").match(/(\d{1,2}):(\d{2})\s*[〜~\-]\s*(翌)?\s*(\d{1,2}):(\d{2})/);
  let start, end;
  if (m) {
    start = Number(m[1]) * 60 + Number(m[2]);
    end = Number(m[4]) * 60 + Number(m[5]) + (m[3] ? 1440 : 0);
    if (end <= start) end += 1440;
  } else {
    start = 10 * 60;
    end = 29 * 60;
  }
  const out = [];
  for (let t = Math.ceil(start / 60) * 60; t <= end - 60 && out.length < 12; t += 60) {
    const h = Math.floor((t % 1440) / 60);
    const nextday = t >= 1440;
    out.push((nextday ? "翌" : "") + h + ":00");
  }
  return out;
}
