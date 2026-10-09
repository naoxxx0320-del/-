/**
 * AROMA DIAMOND — LINE 自動応答＋自動予約 bot（Google Apps Script）
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
 *   （店舗への予約通知は予約管理API側の STORE_EMAIL に一本化。OWNER_EMAIL は不要）
 *   PROXY_SHARED_SECRET        … Worker／予約管理APIと共有する秘密文字列（必須）
 *   BOOKING_API_URL            … 予約管理API（公開デプロイ）の /exec URL（必須）
 *   SITE_URL（任意）           … セラピスト写真の置き場所。既定 https://aroma-daiamond.com/
 *
 * ■ 画面：各ステップをカード（Flex Message）と大きいボタンで表示（STEP 1〜6）。
 *   日付 → セラピスト（写真カード）→ 開始時間（空いている時間だけ・30分刻み）→ コース（入るものだけ）
 *   → お名前 → お電話 → 確認 → 確定。各ステップに「戻る」「最初から」「やめる」。
 *   空き時間は予約管理APIの公開空き状況（名前・電話などは含まない）で判定。最終判定は台帳側。
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

const SCHEDULE_SHEET = "出勤情報"; // 日付/ラベル/エリア/名前/出勤時間/ステータス/出勤/区分
// 予約は独自シートではなく共有台帳（予約管理API）へ一本化（旧 "LINE予約" シートは廃止）。
const AREA = "亀戸";
const TEL = "090-4391-8013";
// セラピストの写真の置き場所（サイト）。スクリプトプロパティ SITE_URL で変更可
const SITE_URL = SP.getProperty("SITE_URL") || "https://aroma-daiamond.com/";

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

/* 速さのための記憶：同じ処理の中では1回だけ読み、短時間はキャッシュも使う。
   （シートの読み込み・予約APIの呼び出しは1回1〜3秒かかるため） */
let MEMO = {};
function memo_(key, ttlSec, fn) {
  if (Object.prototype.hasOwnProperty.call(MEMO, key)) return MEMO[key];
  const cache = CacheService.getScriptCache();
  if (ttlSec) {
    const hit = cache.get("m_" + key);
    if (hit) return (MEMO[key] = JSON.parse(hit));
  }
  const v = fn();
  if (ttlSec) {
    try { cache.put("m_" + key, JSON.stringify(v), ttlSec); } catch (e) {}
  }
  return (MEMO[key] = v);
}
function forget_(key) {
  delete MEMO[key];
  CacheService.getScriptCache().remove("m_" + key);
}

function handleEvent(ev) {
  MEMO = {};
  const t0 = Date.now();
  try {
    handleEvent_(ev);
  } finally {
    console.log("LINE " + ev.type + " " + (ev.postback ? ev.postback.data : "") + " … " + (Date.now() - t0) + "ms");
  }
}
function handleEvent_(ev) {
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
   step: date → th → time → course → name → tel → confirm
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
   テキスト受信（お名前・お電話の入力、キーワード）
   ========================================================= */
function handleText(uid, text, replyToken) {
  const st = getState(uid);

  if (/^(キャンセル|やめる|やめます|中止)$/.test(text)) {
    clearState(uid);
    return reply(replyToken, [cancelledMessage()]);
  }

  // お名前入力
  if (st && st.step === "name") {
    const name = text.replace(/\s+/g, " ").trim().slice(0, 30);
    if (!name) return reply(replyToken, [nameMessage(uid)]);
    st.name = name;
    st.step = "tel";
    setState(uid, st);
    return reply(replyToken, [telMessage_(st)]);
  }
  // お電話番号入力
  if (st && st.step === "tel") {
    const tel = normalizePhone(text);
    if (!tel) {
      return reply(replyToken, [
        textMsg("⚠ お電話番号を数字でお送りください（例：090-1234-5678）"),
        telMessage_(st),
      ]);
    }
    st.tel = tel;
    st.step = "confirm";
    setState(uid, st);
    return reply(replyToken, [confirmMessage(st)]);
  }
  // 時間の直接入力（例「14:30」）
  if (st && st.step === "time") {
    const t = normalizeTime(text);
    if (t) return pickTime_(uid, st, t, replyToken);
  }

  // キーワード自動応答
  if (/予約|よやく/.test(text)) return startBooking(uid, replyToken);
  if (/料金|コース|値段|price/i.test(text)) return reply(replyToken, [priceMessage()]);
  if (/出勤|本日|今日|だれ|誰/.test(text)) return reply(replyToken, todayMessages());
  if (/アクセス|場所|住所|どこ/.test(text)) return reply(replyToken, [accessMessage()]);
  if (/電話|でんわ|tel/i.test(text)) return reply(replyToken, [telInfoMessage()]);

  // 予約の途中なら、今のステップをもう一度表示
  if (st && st.step) return reply(replyToken, stepMessages_(uid, st));
  reply(replyToken, [menuMessage()]);
}

/* =========================================================
   ポストバック受信（ボタン）
   ========================================================= */
function handlePostback(uid, data, replyToken) {
  const q = parseQuery(data);
  const a = q.a;

  if (a === "start") return startBooking(uid, replyToken);
  if (a === "menu") return reply(replyToken, [menuMessage()]);
  if (a === "price") return reply(replyToken, [priceMessage()]);
  if (a === "today") return reply(replyToken, todayMessages());
  if (a === "cancel") {
    clearState(uid);
    return reply(replyToken, [cancelledMessage()]);
  }

  let st = getState(uid) || {};

  if (a === "back") return goBack_(uid, st, replyToken);

  if (a === "date") {
    st = { step: "th", date: q.v, label: q.l || dayLabel(q.v) };
    setState(uid, st);
    return reply(replyToken, therapistMessages(st.date, st.label));
  }
  // 「本日の出勤」カードから直接（日付＋セラピスト）
  if (a === "pick") {
    st = { step: "time", date: q.d, label: dayLabel(q.d), therapist: q.v };
    setState(uid, st);
    return reply(replyToken, [timeMessage(st)]);
  }
  if (!st.date) return startBooking(uid, replyToken); // 古いボタン等で状態が無い

  if (a === "th") {
    st.therapist = q.v;
    st.step = "time";
    delete st.time;
    delete st.course;
    setState(uid, st);
    return reply(replyToken, [timeMessage(st)]);
  }
  if (!st.therapist) return reply(replyToken, therapistMessages(st.date, st.label));

  if (a === "time") return pickTime_(uid, st, q.v, replyToken);
  if (!st.time) return reply(replyToken, [timeMessage(st)]);

  if (a === "course") {
    const c = COURSES[Number(q.v)];
    if (!c) return reply(replyToken, [courseMessage(st)]);
    if (c.honshimei && st.therapist === "おまかせ") {
      return reply(replyToken, [textMsg("⚠ " + c.label + "は本指名（セラピストご指名）の方のみご予約いただけます。"), courseMessage(st)]);
    }
    if (courseOptions_(st).every((x) => x.i !== Number(q.v))) {
      return reply(replyToken, [textMsg("⚠ その時間からは" + c.label + "をお取りできません。別のコースか時間をお選びください。"), courseMessage(st)]);
    }
    st.course = c.label;
    st.price = c.price;
    st.step = "name";
    setState(uid, st);
    return reply(replyToken, [nameMessage(uid)]);
  }
  if (a === "name") {
    st.name = String(q.v || "").slice(0, 30);
    if (!st.course || !st.name) return reply(replyToken, stepMessages_(uid, st));
    st.step = "tel";
    setState(uid, st);
    return reply(replyToken, [telMessage_(st)]);
  }
  if (a === "confirm") return finalizeBooking(uid, replyToken);

  // 不明なボタン
  return reply(replyToken, st.step ? stepMessages_(uid, st) : [menuMessage()]);
}

/* 時間を選んだとき（ボタン・直接入力の共通）。空いていなければ時間の選び直し。 */
function pickTime_(uid, st, t, replyToken) {
  const slots = timeSlots_(st);
  if (slots.indexOf(t) < 0 && slots.indexOf("翌" + t) >= 0) t = "翌" + t; // 「1:00」→ 深夜の「翌1:00」
  if (slots.indexOf(t) < 0) {
    return reply(replyToken, [textMsg("⚠ " + t + " はご予約いただけません（埋まっている・時間外）。空いている時間からお選びください。"), timeMessage(st)]);
  }
  st.time = t;
  st.step = "course";
  delete st.course;
  setState(uid, st);
  return reply(replyToken, [courseMessage(st)]);
}

/* ひとつ前のステップへ戻る */
function goBack_(uid, st, replyToken) {
  const prev = { th: "date", time: "th", course: "time", name: "course", tel: "name", confirm: "tel" };
  const to = prev[st.step];
  if (!to || to === "date") return startBooking(uid, replyToken);
  st.step = to;
  setState(uid, st);
  return reply(replyToken, stepMessages_(uid, st));
}

/* 今のステップの画面 */
function stepMessages_(uid, st) {
  switch (st.step) {
    case "th": return therapistMessages(st.date, st.label);
    case "time": return [timeMessage(st)];
    case "course": return [courseMessage(st)];
    case "name": return [nameMessage(uid)];
    case "tel": return [telMessage_(st)];
    case "confirm": return [confirmMessage(st)];
    default: return [dateMessage(getDays())];
  }
}

/* =========================================================
   予約フロー
   ========================================================= */
function startBooking(uid, replyToken) {
  const days = getDays();
  if (days.length === 0) {
    clearState(uid);
    return reply(replyToken, [
      card_("ご予約", null, [
        txt_("ただ今オンラインでご予約いただける日がありません。", { wrap: true }),
        txt_("お手数ですが、お電話でお問い合わせください。", { wrap: true, size: "sm", color: C.sub, margin: "md" }),
      ], [uriBtn_("📞 電話する（" + TEL + "）", "tel:" + TEL.replace(/-/g, ""))]),
    ]);
  }
  setState(uid, { step: "date" });
  reply(replyToken, [dateMessage(days)]);
}

function finalizeBooking(uid, replyToken) {
  const st = getState(uid);
  if (!st || !st.date || !st.therapist || !st.time || !st.course || !st.name || !st.tel) {
    clearState(uid);
    return reply(replyToken, [textMsg("入力が途中で切れてしまいました。お手数ですが、もう一度はじめからお願いします。"), menuMessage()]);
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
    tel: st.tel,
    lineUserId: uid,
    lineName: name, // LINE表示名（スタッフメモに記録）
    idempotencyKey: ["LINE", uid, st.date, st.time, st.course].join("|"),
  });

  // バックエンド結果を確認してから完了を案内（＝未登録を完了と誤表示しない）。
  if (!res || !res.ok) {
    forget_("busy_" + st.date); // 埋まった可能性があるので空き状況を取り直す
    st.step = "time";
    delete st.time;
    setState(uid, st);
    return reply(replyToken, [
      textMsg("⚠ " + ((res && res.reason) || "申し訳ございません。その時間はご予約いただけませんでした。") + "\n別の時間をお選びください。"),
      timeMessage(st),
    ]);
  }

  // 店舗への通知は予約管理API側の「店舗控えメール」(STORE_EMAIL)に一本化（二重通知を防ぐ）
  clearState(uid);
  reply(replyToken, [doneMessage(st)]);
  forget_("busy_" + st.date); // 次の人には、この予約を反映した空き時間を出す
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
   スプレッドシート（出勤・プロフィール）と空き状況
   ========================================================= */
function ss() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function cellText_(v, fmt) {
  if (Object.prototype.toString.call(v) === "[object Date]") return Utilities.formatDate(v, "Asia/Tokyo", fmt);
  return String(v == null ? "" : v).trim();
}

// 出勤情報を読み、[{date,label,name,time,startMin,endMin,status}] を返す（欠勤✖️・申請中は除外）
// 「出勤時間」列（"13:00〜翌2:00"）にも、「開始」「終了」に分かれた表（終了 "2:00" は翌日）にも対応。
function readSchedule() {
  return memo_("sched", 60, readScheduleRaw_); // 出勤表の変更は最大1分で反映
}
function readScheduleRaw_() {
  const sh = ss().getSheetByName(SCHEDULE_SHEET);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  // 見出し行（「名前」を含む行）を探す
  let hi = 0;
  for (let i = 0; i < Math.min(values.length, 10); i++) {
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
    start: col("開始"),
    end: col("終了"),
    status: col("ステータス"),
    present: col("出勤"),
    kbn: col("区分"),
    order: col("並び"),
  };
  const out = [];
  const absent = (v) => /^(✖️|✖|✗|×|✕|x|欠|欠勤|休|休み|no|false|非表示)$/i.test(String(v || "").trim());
  const draft = (v) => /^(申請|申請中|希望|希望休|未確定|保留|draft|下書き)$/i.test(String(v || "").trim());
  for (let i = hi + 1; i < values.length; i++) {
    const r = values[i];
    const date = normalizeDate(ci.date >= 0 ? cellText_(r[ci.date], "yyyy/M/d") : "");
    const name = ci.name >= 0 ? String(r[ci.name]).trim() : "";
    if (!date || !name || !/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(date)) continue;
    if (ci.present >= 0 && absent(r[ci.present])) continue;
    if (ci.kbn >= 0 && draft(r[ci.kbn])) continue;
    let time = ci.time >= 0 ? cellText_(r[ci.time], "H:mm") : "";
    if (!time && ci.start >= 0) {
      const s = cellText_(r[ci.start], "H:mm"), e = ci.end >= 0 ? cellText_(r[ci.end], "H:mm") : "";
      time = s && e ? s + "〜" + e : s;
    }
    const rng = shiftRange(time);
    out.push({
      date: date,
      label: ci.label >= 0 && String(r[ci.label]).trim() ? String(r[ci.label]).trim() : dayLabel(date),
      name: name,
      time: rng ? minLabel(rng[0]) + "〜" + minLabel(rng[1]) : time,
      startMin: rng ? rng[0] : null,
      endMin: rng ? rng[1] : null,
      status: ci.status >= 0 ? String(r[ci.status]).trim() : "",
      order: ci.order >= 0 && String(r[ci.order]).trim() !== "" ? Number(r[ci.order]) || 0 : 1e9,
      row: i,
    });
  }
  out.sort((a, b) => dateKey(a.date) - dateKey(b.date) || a.order - b.order || a.row - b.row);
  return out;
}

// 予約可能な日（日本時間の営業日。朝6時までは前日）以降を日付順に最大10日。
function getDays() {
  const rows = readSchedule();
  const today = bizTodayKey();
  const seen = {};
  const days = [];
  rows.forEach((r) => {
    const k = dateKey(r.date);
    if (!k || k < today) return;
    if (!seen[r.date]) {
      seen[r.date] = { date: r.date, label: r.label, k: k, count: 0 };
      days.push(seen[r.date]);
    }
    seen[r.date].count++;
  });
  days.sort((a, b) => a.k - b.k);
  return days.slice(0, 10);
}

function getTherapistsOn(date) {
  const rows = readSchedule().filter((r) => r.date === date);
  const seen = {};
  return rows.filter((r) => (seen[r.name] ? false : (seen[r.name] = true)));
}

// 名簿（本日の出勤シート）：名前 → {photo, age, height, cup, tags}
function readProfiles_() {
  return memo_("prof", 300, readProfilesRaw_);
}
function readProfilesRaw_() {
  const out = {};
  try {
    const sh = ss().getSheetByName(SP.getProperty("THERAPIST_SHEET") || "本日の出勤");
    if (!sh) return out;
    const v = sh.getDataRange().getValues();
    let hi = -1;
    for (let i = 0; i < Math.min(v.length, 5); i++) {
      if (v[i].map((c) => String(c).trim()).indexOf("名前") >= 0) { hi = i; break; }
    }
    if (hi < 0) return out;
    const head = v[hi].map((c) => String(c).trim());
    const g = (r, k) => (head.indexOf(k) >= 0 ? String(r[head.indexOf(k)] == null ? "" : r[head.indexOf(k)]).trim() : "");
    for (let i = hi + 1; i < v.length; i++) {
      const name = g(v[i], "名前");
      if (!name) continue;
      out[name] = {
        photo: g(v[i], "写真").split(";").map((x) => x.trim()).filter(Boolean)[0] || "",
        age: g(v[i], "年齢"),
        height: g(v[i], "T"),
        cup: g(v[i], "カップ"),
        tags: g(v[i], "タグ").split(";").map((x) => x.trim()).filter(Boolean).slice(0, 2),
      };
    }
  } catch (e) {}
  // サイト側の写真の上書き設定（まだシートに写真が無い人の分）
  try {
    const ov = photoOverrides_();
    Object.keys(ov).forEach((n) => {
      out[n] = out[n] || {};
      if (!out[n].photo) out[n].photo = [].concat(ov[n])[0] || "";
    });
  } catch (e) {}
  return out;
}
function photoOverrides_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get("photo_ov");
  if (hit) return JSON.parse(hit);
  let ov = {};
  try {
    const r = UrlFetchApp.fetch("https://raw.githubusercontent.com/naoxxx0320-del/-/main/data/photo-overrides.json", { muteHttpExceptions: true });
    if (r.getResponseCode() === 200) ov = JSON.parse(r.getContentText()) || {};
  } catch (e) {}
  cache.put("photo_ov", JSON.stringify(ov), 600);
  return ov;
}
function photoUrl_(file) {
  if (!file) return "";
  if (/^https:\/\//.test(file)) return file;
  if (/^http:/.test(file)) return "";
  return SITE_URL.replace(/\/?$/, "/") + encodeURIComponent(file);
}

/* 予約済みの時間（共有台帳の公開空き状況API。名前・電話などは含まない）
   その日の 0:00 からの分 [{th, s, e}]。翌日分（深夜）も含めて取得。 */
function busyOn_(date) {
  return memo_("busy_" + date, 45, () => fetchBusy_(date));
}
function fetchBusy_(date) {
  const url = SP.getProperty("BOOKING_API_URL") || "";
  if (!url) return [];
  const base = dayStartMs(date);
  const out = [];
  // その日と翌日（深夜分）を同時に取得
  const reqs = [date, addDay(date)].map((d) => ({ url: url + "?action=availability&date=" + encodeURIComponent(d), muteHttpExceptions: true, followRedirects: true }));
  let res = [];
  try { res = UrlFetchApp.fetchAll(reqs); } catch (e) { return out; }
  res.forEach((r) => {
    try {
      const j = JSON.parse(r.getContentText());
      (j.busy || []).forEach((b) => out.push({ th: String(b.th), s: (b.s - base) / 60000, e: (b.e - base) / 60000 }));
    } catch (e) {}
  });
  return out;
}

/* 空いている開始時間（30分刻み）。最短コース（60分）が入る時間だけ。今日なら今から30分後以降。 */
function timeSlots_(st, rowsArg, busyArg) {
  const rows = rowsArg || getTherapistsOn(st.date);
  const busy = busyArg || busyOn_(st.date);
  const minDur = Math.min.apply(null, COURSES.map((c) => courseMin(c.label)));
  const targets = st.therapist === "おまかせ" ? rows : rows.filter((r) => r.name === st.therapist);
  const earliest = dateKey(st.date) === bizTodayKey() ? nowMinOf(st.date) + 30 : -1e9;
  const slots = {};
  targets.forEach((r) => {
    if (r.startMin == null || r.endMin == null) return;
    const mine = busy.filter((b) => b.th === r.name);
    for (let t = Math.ceil(r.startMin / 30) * 30; t + minDur <= r.endMin; t += 30) {
      if (t < earliest) continue;
      if (mine.some((b) => t < b.e && b.s < t + minDur)) continue;
      slots[t] = true;
    }
  });
  return Object.keys(slots).map(Number).sort((a, b) => a - b).map(minLabel);
}

/* 選んだ時間から入るコース（出勤終了・次の予約まで）。[{i, c}] */
function courseOptions_(st, rowsArg, busyArg) {
  const rows = rowsArg || getTherapistsOn(st.date);
  const busy = busyArg || busyOn_(st.date);
  const t = labelMin(st.time);
  const targets = st.therapist === "おまかせ" ? rows : rows.filter((r) => r.name === st.therapist);
  return COURSES.map((c, i) => ({ i: i, c: c })).filter((x) => {
    if (x.c.honshimei && st.therapist === "おまかせ") return false;
    const dur = courseMin(x.c.label);
    return targets.some((r) => r.endMin != null && t >= r.startMin && t + dur <= r.endMin &&
      !busy.some((b) => b.th === r.name && t < b.e && b.s < t + dur));
  });
}

/* =========================================================
   メッセージ（カード＝Flex Message と大きいボタン）
   ========================================================= */
const C = { wine: "#7A1F2B", wine2: "#9B2C3B", gold: "#B8975A", ink: "#2A2420", sub: "#7A6A4A", bg: "#FAF6EE", line: "#E8DFCC", ok: "#2E7D4F" };
const STEPS = 6;

function textMsg(text) {
  return { type: "text", text: text };
}
function txt_(text, o) {
  return Object.assign({ type: "text", text: String(text), color: C.ink, size: "md" }, o || {});
}
function postBtn_(label, data, style, displayText) {
  return {
    type: "button",
    style: style || "secondary",
    height: "sm",
    color: style === "primary" ? C.wine : style === "link" ? C.sub : "#F1EADB",
    action: { type: "postback", label: String(label).slice(0, 40), data: data, displayText: displayText || String(label).slice(0, 40) },
  };
}
function uriBtn_(label, uri) {
  return { type: "button", style: "link", height: "sm", color: C.wine, action: { type: "uri", label: String(label).slice(0, 40), uri: uri } };
}
function stepHead_(n, title, sub) {
  const c = [];
  if (n) c.push(txt_("STEP " + n + " / " + STEPS, { size: "xs", color: C.gold, weight: "bold" }));
  c.push(txt_(title, { size: "lg", weight: "bold", color: C.wine, wrap: true }));
  if (sub) c.push(txt_(sub, { size: "sm", color: C.sub, wrap: true, margin: "sm" }));
  return { type: "box", layout: "vertical", contents: c, paddingBottom: "md" };
}
// 「戻る」「最初から」「やめる」
function navBox_(back) {
  const items = [];
  if (back) items.push(postBtn_("◀ 戻る", "a=back", "link", "戻る"));
  items.push(postBtn_("最初から", "a=start", "link", "最初から"));
  items.push(postBtn_("やめる", "a=cancel", "link", "やめる"));
  return { type: "box", layout: "horizontal", contents: items, spacing: "sm", margin: "md" };
}
function card_(title, n, bodyContents, footerContents, sub) {
  return {
    type: "flex",
    altText: (n ? "STEP " + n + "/" + STEPS + " " : "") + title,
    contents: {
      type: "bubble",
      size: "mega",
      header: stepHead_(n, title, sub),
      body: { type: "box", layout: "vertical", contents: bodyContents, spacing: "sm" },
      footer: footerContents && footerContents.length ? { type: "box", layout: "vertical", contents: footerContents, spacing: "sm" } : undefined,
      styles: { header: { backgroundColor: C.bg }, footer: { separator: true } },
    },
  };
}
// ボタンを n 列に並べる
function grid_(buttons, cols) {
  const rows = [];
  for (let i = 0; i < buttons.length; i += cols) {
    const row = buttons.slice(i, i + cols);
    while (row.length < cols) row.push({ type: "filler" });
    rows.push({ type: "box", layout: "horizontal", contents: row, spacing: "sm" });
  }
  return rows;
}
function kv_(k, v) {
  return {
    type: "box", layout: "baseline", spacing: "md",
    contents: [txt_(k, { size: "sm", color: C.sub, flex: 3 }), txt_(v || "-", { size: "sm", wrap: true, flex: 7, weight: "bold" })],
  };
}

function welcomeMessage() {
  return menuMessage("AROMA DIAMOND（亀戸）へようこそ。\nご予約・本日の出勤・料金は下のボタンからどうぞ。");
}
function menuMessage(lead) {
  return card_("AROMA DIAMOND 亀戸", null, [
    txt_(lead || "ご用件をお選びください。", { wrap: true, size: "sm", color: C.sub }),
  ], [
    postBtn_("📅 予約する", "a=start", "primary", "予約する"),
    postBtn_("👩 本日の出勤", "a=today", "secondary", "本日の出勤"),
    postBtn_("💰 料金・コース", "a=price", "secondary", "料金・コース"),
    uriBtn_("📞 電話する（" + TEL + "）", "tel:" + TEL.replace(/-/g, "")),
  ]);
}
function cancelledMessage() {
  return card_("ご予約の入力をやめました", null, [txt_("またいつでもどうぞ。", { size: "sm", color: C.sub })], [postBtn_("📅 もう一度予約する", "a=start", "primary", "予約する")]);
}

function priceMessage() {
  const rows = COURSES.map((c) => ({
    type: "box", layout: "baseline", contents: [
      txt_(c.label + (c.honshimei ? "（本指名のみ）" : ""), { size: "sm", flex: 7, wrap: true }),
      txt_(yen(c.price), { size: "sm", flex: 3, align: "end", weight: "bold", color: C.wine }),
    ],
  }));
  rows.push(txt_("指名料・オプションは料金表をご覧ください。", { size: "xs", color: C.sub, margin: "md", wrap: true }));
  return card_("料金・コース", null, rows, [postBtn_("📅 予約する", "a=start", "primary", "予約する"), uriBtn_("料金表を見る（サイト）", SITE_URL.replace(/\/?$/, "/") + "system/")]);
}

function accessMessage() {
  return card_("アクセス", null, [
    txt_("エリア：東京都・" + AREA, { size: "sm" }),
    txt_("お部屋の住所は、ご予約の確定後にご案内いたします。", { size: "sm", wrap: true, color: C.sub }),
  ], [uriBtn_("📞 電話する（" + TEL + "）", "tel:" + TEL.replace(/-/g, ""))]);
}
function telInfoMessage() {
  return card_("お電話", null, [
    txt_(TEL, { size: "xl", weight: "bold", color: C.wine }),
    txt_("営業 10:00〜翌5:00 ／ 電話受付 9:30〜翌4:00", { size: "sm", color: C.sub, wrap: true }),
  ], [uriBtn_("📞 電話をかける", "tel:" + TEL.replace(/-/g, ""))]);
}

// STEP1 日付
function dateMessage(days) {
  const btns = days.map((d) =>
    postBtn_(d.label + "　出勤" + d.count + "名", "a=date&v=" + enc(d.date) + "&l=" + enc(d.label), "secondary", d.label)
  );
  return card_("ご希望の日を選んでください", 1, btns, [navBox_(false)]);
}

// セラピストのカード（写真つき）
function therapistBubble_(r, prof, opts) {
  const p = prof || {};
  const img = photoUrl_(p.photo);
  const spec = [p.age ? p.age + "歳" : "", p.height ? "T" + p.height : "", p.cup ? p.cup + "カップ" : ""].filter(Boolean).join(" / ");
  const body = [
    txt_(r.name, { size: "xl", weight: "bold", color: C.wine }),
  ];
  if (spec) body.push(txt_(spec, { size: "xs", color: C.sub }));
  if (p.tags && p.tags.length) body.push(txt_(p.tags.join("・"), { size: "xs", color: C.gold, wrap: true }));
  body.push(txt_("🕐 " + (r.time || "時間未定"), { size: "sm", margin: "md" }));
  if (opts.full) body.push(txt_("この日の空きはありません", { size: "sm", color: "#999999" }));
  else if (r.status) body.push(txt_(r.status, { size: "sm", color: /満|終了/.test(r.status) ? "#999999" : C.ok, weight: "bold" }));
  const b = {
    type: "bubble",
    size: "kilo",
    body: { type: "box", layout: "vertical", contents: body, spacing: "xs" },
    footer: {
      type: "box", layout: "vertical", contents: [
        opts.full
          ? txt_("満員", { align: "center", color: "#999999", size: "sm" })
          : postBtn_(opts.label || "この人を選ぶ", opts.data, "primary", r.name + "を選ぶ"),
      ],
    },
  };
  if (img) b.hero = { type: "image", url: img, size: "full", aspectRatio: "3:4", aspectMode: "cover" };
  return b;
}

// STEP2 セラピスト（横にスライド）
function therapistMessages(date, label) {
  const rows = getTherapistsOn(date);
  const prof = readProfiles_();
  const busy = busyOn_(date);
  const bubbles = rows.slice(0, 11).map((r) => {
    const full = timeSlots_({ date: date, therapist: r.name }, rows, busy).length === 0;
    return therapistBubble_(r, prof[r.name], { full: full, data: "a=th&v=" + enc(r.name) });
  });
  const anyFree = timeSlots_({ date: date, therapist: "おまかせ" }, rows, busy).length > 0;
  bubbles.push({
    type: "bubble", size: "kilo",
    body: { type: "box", layout: "vertical", justifyContent: "center", contents: [
      txt_("おまかせ", { size: "xl", weight: "bold", color: C.wine }),
      txt_("指名なし。空いているセラピストがご案内します。", { size: "sm", color: C.sub, wrap: true, margin: "md" }),
    ] },
    footer: { type: "box", layout: "vertical", contents: [anyFree
      ? postBtn_("おまかせで選ぶ", "a=th&v=" + enc("おまかせ"), "primary", "おまかせ")
      : txt_("満員", { align: "center", color: "#999999", size: "sm" })] },
  });
  return [
    {
      type: "flex",
      altText: "STEP 2/" + STEPS + " セラピストを選んでください",
      contents: { type: "carousel", contents: bubbles },
    },
    card_("セラピストを選んでください", 2, [
      txt_(label + "　出勤 " + rows.length + "名", { size: "sm", weight: "bold" }),
      txt_("上のカードを横にスライドして、「この人を選ぶ」を押してください。", { size: "sm", color: C.sub, wrap: true }),
    ], [navBox_(true)]),
  ];
}

// STEP3 時間
function timeMessage(st) {
  const rows = getTherapistsOn(st.date);
  const slots = timeSlots_(st, rows, busyOn_(st.date));
  const r = rows.find((x) => x.name === st.therapist);
  const sub = st.label + "　" + (st.therapist === "おまかせ" ? "おまかせ" : st.therapist + "（出勤 " + (r ? r.time : "未定") + "）");
  if (!slots.length) {
    return card_("空いている時間がありません", 3, [
      txt_("申し訳ございません。この日はご予約いただける時間がありません。", { size: "sm", wrap: true }),
      txt_("別のセラピスト・別の日をお選びいただくか、お電話でお問い合わせください。", { size: "sm", wrap: true, color: C.sub }),
    ], [navBox_(true)], sub);
  }
  const btns = slots.map((t) => postBtn_(t, "a=time&v=" + enc(t), "secondary", t + "〜"));
  return card_("開始時間を選んでください", 3, grid_(btns, 3).concat([
    txt_("表示されているのは空いている時間です（30分ごと）。", { size: "xs", color: C.sub, wrap: true, margin: "md" }),
  ]), [navBox_(true)], sub);
}

// STEP4 コース
function courseMessage(st) {
  const opts = courseOptions_(st);
  const sub = st.label + " " + st.time + "〜　" + (st.therapist === "おまかせ" ? "おまかせ" : st.therapist);
  if (!opts.length) {
    return card_("この時間から入るコースがありません", 4, [
      txt_("出勤終了や次のご予約までの時間が足りません。開始時間を選び直してください。", { size: "sm", wrap: true }),
    ], [navBox_(true)], sub);
  }
  const btns = opts.map((x) =>
    postBtn_(x.c.label + "　" + yen(x.c.price), "a=course&v=" + x.i, "secondary", x.c.label)
  );
  const notes = [];
  if (st.therapist === "おまかせ") notes.push(txt_("※150分コースは本指名の方のみです。", { size: "xs", color: C.sub, wrap: true, margin: "md" }));
  return card_("コースを選んでください", 4, btns.concat(notes), [navBox_(true)], sub);
}

// STEP5 お名前
function nameMessage(uid) {
  const dn = uid ? getDisplayName(uid) : "";
  const footer = [];
  if (dn) footer.push(postBtn_("「" + dn.slice(0, 20) + "」で登録", "a=name&v=" + enc(dn.slice(0, 30)), "secondary", dn.slice(0, 30)));
  footer.push(navBox_(true));
  return card_("お名前を送ってください", 5, [
    txt_("このトークにお名前を入力して送信してください。ニックネームでも大丈夫です。", { size: "sm", wrap: true }),
    txt_("✏️ 下の入力欄に文字を打って送信", { size: "sm", color: C.gold, weight: "bold", margin: "md" }),
  ], footer);
}

// STEP6 お電話
function telMessage_(st) {
  return card_("お電話番号を送ってください", 6, [
    txt_("例：090-1234-5678", { size: "md", weight: "bold" }),
    txt_("ご予約内容の確認でご連絡することがあります。", { size: "sm", wrap: true, color: C.sub }),
    txt_("✏️ 下の入力欄に番号を打って送信", { size: "sm", color: C.gold, weight: "bold", margin: "md" }),
  ], [navBox_(true)], st && st.name ? st.name + " 様" : "");
}

// 確認
function confirmMessage(st) {
  return card_("ご予約内容の確認", null, [
    kv_("日時", st.label + "　" + st.time + "〜"),
    kv_("セラピスト", st.therapist === "おまかせ" ? "おまかせ（指名なし）" : st.therapist),
    kv_("コース", st.course),
    kv_("料金", yen(st.price)),
    kv_("お名前", st.name + " 様"),
    kv_("お電話", st.tel),
    txt_("内容がよろしければ「この内容で予約する」を押してください。", { size: "xs", color: C.sub, wrap: true, margin: "lg" }),
  ], [
    postBtn_("✅ この内容で予約する", "a=confirm", "primary", "この内容で予約する"),
    navBox_(true),
  ], "まだ予約は確定していません");
}

// 完了
function doneMessage(st) {
  return {
    type: "flex",
    altText: "ご予約が確定しました（" + st.label + " " + st.time + "〜）",
    contents: {
      type: "bubble",
      header: { type: "box", layout: "vertical", backgroundColor: C.wine, contents: [
        txt_("✅ ご予約が確定しました", { color: "#FFFFFF", weight: "bold", size: "lg" }),
      ] },
      body: { type: "box", layout: "vertical", spacing: "sm", contents: [
        kv_("日時", st.label + "　" + st.time + "〜"),
        kv_("セラピスト", st.therapist === "おまかせ" ? "おまかせ（指名なし）" : st.therapist),
        kv_("コース", st.course + "（" + yen(st.price) + "）"),
        kv_("お名前", st.name + " 様"),
        kv_("お電話", st.tel),
        txt_("ご来店をお待ちしております。お部屋のご案内は当日ご連絡いたします。変更・キャンセルはお電話でお願いいたします。", { size: "xs", color: C.sub, wrap: true, margin: "lg" }),
      ] },
      footer: { type: "box", layout: "vertical", contents: [uriBtn_("📞 電話する（" + TEL + "）", "tel:" + TEL.replace(/-/g, ""))] },
    },
  };
}

// 本日の出勤（写真カード → そのまま予約へ）
function todayMessages() {
  const days = getDays();
  const today = days.find((d) => d.k === bizTodayKey());
  if (!today) {
    return [card_("本日の出勤", null, [txt_("本日の出勤情報は準備中です。", { size: "sm" })], [
      days.length ? postBtn_("📅 ほかの日を予約する", "a=start", "primary", "予約する") : uriBtn_("📞 電話する（" + TEL + "）", "tel:" + TEL.replace(/-/g, "")),
    ])];
  }
  const rows = getTherapistsOn(today.date);
  const prof = readProfiles_();
  const busy = busyOn_(today.date);
  const bubbles = rows.slice(0, 12).map((r) => {
    const full = timeSlots_({ date: today.date, therapist: r.name }, rows, busy).length === 0;
    return therapistBubble_(r, prof[r.name], { full: full, label: "この人で予約", data: "a=pick&d=" + enc(today.date) + "&v=" + enc(r.name) });
  });
  return [
    textMsg("【" + today.label + " 本日の出勤】" + rows.length + "名\nカードを横にスライドしてご覧ください。"),
    { type: "flex", altText: "本日の出勤 " + rows.length + "名", contents: { type: "carousel", contents: bubbles } },
  ];
}

/* =========================================================
   LINE API
   ========================================================= */
function reply(replyToken, messages) {
  if (!replyToken) return;
  // 未定義（footer なし等）のキーを落としてから送る
  const clean = JSON.parse(JSON.stringify(messages.slice(0, 5)));
  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + TOKEN },
    payload: JSON.stringify({ replyToken: replyToken, messages: clean }),
    muteHttpExceptions: true,
  });
}

function getDisplayName(uid) {
  return memo_("dn_" + uid, 21600, () => fetchDisplayName_(uid));
}
function fetchDisplayName_(uid) {
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
   ユーティリティ（日付・時刻）
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
function dateKey(d) {
  const m = String(d || "").match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0;
}
// "2026/10/8" → "10/8(木)"
function dayLabel(d) {
  const m = String(d || "").match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return String(d || "");
  const wd = "日月火水木金土"[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
  return Number(m[2]) + "/" + Number(m[3]) + "(" + wd + ")";
}
function addDay(d) {
  const m = String(d).match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  const x = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1));
  return x.getUTCFullYear() + "/" + (x.getUTCMonth() + 1) + "/" + x.getUTCDate();
}
// その日の 0:00（日本時間）の epoch ms
function dayStartMs(d) {
  const m = String(d).match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) - 9 * 3600 * 1000;
}
// 日本時間の営業日（朝6時までは前日）YYYYMMDD
function bizTodayKey() {
  const j = new Date(Date.now() + 9 * 3600e3 - 6 * 3600e3);
  return j.getUTCFullYear() * 10000 + (j.getUTCMonth() + 1) * 100 + j.getUTCDate();
}
// その日の 0:00 から見た「今」の分（深夜は 24:00 以降）
function nowMinOf(d) {
  return Math.floor((Date.now() - dayStartMs(d)) / 60000);
}
// "翌2:30" → 1590、"14:00" → 840
function labelMin(t) {
  const m = String(t || "").match(/(翌)?\s*(\d{1,2})[:：](\d{2})/);
  return m ? (m[1] ? 1440 : 0) + Number(m[2]) * 60 + Number(m[3]) : null;
}
function minLabel(min) {
  const h = Math.floor(min / 60), mm = min % 60;
  return (h >= 24 ? "翌" + (h - 24) : h) + ":" + (mm < 10 ? "0" : "") + mm;
}
// "13:00〜翌2:00" / "13:00〜2:00"（終了が開始以前なら翌日）→ [780, 1560]
function shiftRange(time) {
  const m = String(time || "").match(/(翌)?\s*(\d{1,2})[:：](\d{2})(?::\d{2})?\s*[〜~\-]\s*(翌)?\s*(\d{1,2})[:：](\d{2})/);
  if (!m) return null;
  const s = (m[1] ? 1440 : 0) + Number(m[2]) * 60 + Number(m[3]);
  let e = (m[4] ? 1440 : 0) + Number(m[5]) * 60 + Number(m[6]);
  if (e <= s) e += 1440;
  return [s, e];
}
function courseMin(label) {
  const m = String(label).match(/(\d+)\s*分/);
  return m ? Number(m[1]) : 60;
}
// 電話番号を数字だけに正規化（全角・ハイフン・+81 に対応）。日本の番号として不正なら ""。
function normalizePhone(s) {
  let t = String(s || "").replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  let d = t.replace(/[^0-9]/g, "");
  if (/^81\d{9,10}$/.test(d)) d = "0" + d.slice(2);
  return /^0\d{9,10}$/.test(d) ? d : "";
}
function normalizeTime(s) {
  const t = String(s || "").replace(/[０-９：]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const m = t.match(/(翌)?\s*(\d{1,2})[:：](\d{2})/);
  if (!m) return "";
  return (m[1] ? "翌" : "") + Number(m[2]) + ":" + m[3];
}

/* =========================================================
   セットアップ補助（エディタの「実行」から使う）
   ========================================================= */
// 必要な設定がそろっているか確認（値そのものは表示しない）＋予約可能日を表示
function checkSetup() {
  ["LINE_CHANNEL_ACCESS_TOKEN", "SHEET_ID", "PROXY_SHARED_SECRET", "BOOKING_API_URL"].forEach((n) => {
    Logger.log(n + ": " + (SP.getProperty(n) ? "設定済み" : "未設定"));
  });
  Logger.log("予約可能日: " + JSON.stringify(getDays()));
}
// 共有シークレット用のランダム文字列を作る（実行ログにだけ表示。チャット等には貼らない）
function makeSecret() {
  Logger.log(Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, ""));
}
