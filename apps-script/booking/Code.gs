/* =============================================================================
 * 予約管理システム：バックエンド本体（Google Apps Script）
 * -----------------------------------------------------------------------------
 * WEB・LINE・電話の予約を「予約台帳」1本に集約し、重複防止・仮予約TTL・
 * 変更履歴・スタッフ認証（Googleアカウント許可リスト）・公開空き状況（個人情報
 * なし）を提供する。純ロジックは lib.gs を参照（両ファイルを同じGASプロジェクトに
 * 置くとグローバル関数として連結される）。
 *
 * ■ スクリプトプロパティ（プロジェクトの設定 → スクリプト プロパティ）
 *   SHEET_ID              … 予約台帳を置くスプレッドシートID（出勤情報と同じブック推奨）
 *   STAFF_EMAILS          … 管理画面を使えるスタッフのGoogleメール（カンマ区切り）
 *   TENTATIVE_TTL_MIN     … 仮予約の確認期限（分）。既定 30
 *   PROXY_SHARED_SECRET   … LINE署名検証プロキシから受け取る共有シークレット
 *   OWNER_EMAIL           … 店舗通知メール（任意）
 *   TEST_MODE             … "true" の間はメール送信せずログのみ（本番前の検証用）
 *
 * ■ デプロイ（2つのウェブアプリ）… README 参照
 *   公開API  : 実行=自分 / アクセス=全員         （availability / web_create / line_event）
 *   管理画面 : 実行=アクセスユーザー / アクセス=Googleアカウントを持つ全員（Admin）
 * ========================================================================== */

var LEDGER_SHEET = "予約台帳";
var HISTORY_SHEET = "予約履歴";
var SCHEDULE_SHEET = "出勤情報"; // 既存の出勤シート（空き・出勤内判定に使用）

var HEADER = [
  "予約ID", "経路", "状態", "状態ラベル", "担当者ID", "担当者名",
  "開始(JST)", "終了(JST)", "開始epoch", "終了epoch", "所要分",
  "コース", "料金", "お客様名", "電話", "メール", "LINE_UID",
  "仮予約期限epoch", "確認トークン", "冪等キー", "スタッフメモ",
  "作成日時(JST)", "更新日時(JST)", "最終操作者",
];
var HISTORY_HEADER = ["履歴ID", "日時(JST)", "予約ID", "操作者", "操作", "変更前", "変更後"];

/* ---------- 設定・共通 ---------- */
function props_() {
  return PropertiesService.getScriptProperties();
}
function cfg_(k, def) {
  var v = props_().getProperty(k);
  return v == null || v === "" ? def : v;
}
function sheetId_() {
  var id = cfg_("SHEET_ID", "");
  if (!id) throw new Error("SHEET_ID 未設定です（スクリプトプロパティ）");
  return id;
}
function book_() {
  return SpreadsheetApp.openById(sheetId_());
}
function nowMs_() {
  return Date.now();
}
function ttlMin_() {
  return parseInt(cfg_("TENTATIVE_TTL_MIN", "30"), 10) || 30;
}
function isTestMode_() {
  return String(cfg_("TEST_MODE", "false")).toLowerCase() === "true";
}
function genId_(prefix) {
  return (
    (prefix || "BK") +
    Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMddHHmmss") +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

/* ---------- シート準備 ---------- */
function ledger_() {
  var b = book_();
  var sh = b.getSheetByName(LEDGER_SHEET);
  if (!sh) {
    sh = b.insertSheet(LEDGER_SHEET);
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
  }
  return sh;
}
function history_() {
  var b = book_();
  var sh = b.getSheetByName(HISTORY_SHEET);
  if (!sh) {
    sh = b.insertSheet(HISTORY_SHEET);
    sh.appendRow(HISTORY_HEADER);
    sh.setFrozenRows(1);
  }
  return sh;
}
function colIndex_() {
  var map = {};
  HEADER.forEach(function (h, i) {
    map[h] = i;
  });
  return map;
}

/* 台帳の全行をオブジェクト配列で返す（ヘッダ行を除く）。rowNum も保持。 */
function readLedger_() {
  var sh = ledger_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, HEADER.length).getValues();
  var c = colIndex_();
  return values.map(function (r, i) {
    return {
      rowNum: i + 2,
      id: r[c["予約ID"]],
      source: r[c["経路"]],
      status: r[c["状態"]],
      therapistId: r[c["担当者ID"]],
      therapistName: r[c["担当者名"]],
      startAt: Number(r[c["開始epoch"]]) || 0,
      endAt: Number(r[c["終了epoch"]]) || 0,
      durationMin: Number(r[c["所要分"]]) || 0,
      course: r[c["コース"]],
      price: r[c["料金"]],
      customerName: r[c["お客様名"]],
      tel: r[c["電話"]],
      email: r[c["メール"]],
      lineUserId: r[c["LINE_UID"]],
      tentativeExpireAt: Number(r[c["仮予約期限epoch"]]) || 0,
      confirmToken: r[c["確認トークン"]],
      idempotencyKey: r[c["冪等キー"]],
      staffMemo: r[c["スタッフメモ"]],
      createdAt: r[c["作成日時(JST)"]],
      updatedAt: r[c["更新日時(JST)"]],
      updatedBy: r[c["最終操作者"]],
    };
  });
}

function objToRow_(o) {
  return [
    o.id, o.source, o.status, STATUS_LABEL[o.status] || o.status,
    o.therapistId, o.therapistName,
    fmtJst(o.startAt), fmtJst(o.endAt), o.startAt, o.endAt, o.durationMin,
    o.course, o.price, o.customerName, o.tel || "", o.email || "", o.lineUserId || "",
    o.tentativeExpireAt || "", o.confirmToken || "", o.idempotencyKey || "", o.staffMemo || "",
    o.createdAt, o.updatedAt, o.updatedBy || "",
  ];
}

function writeRow_(rowNum, o) {
  ledger_().getRange(rowNum, 1, 1, HEADER.length).setValues([objToRow_(o)]);
}
function appendRow_(o) {
  ledger_().appendRow(objToRow_(o));
}

/* 監査履歴を残す（変更前後・操作者）。 */
function logHistory_(bookingId, actor, action, before, after) {
  history_().appendRow([
    genId_("H"),
    Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss"),
    bookingId,
    actor || "",
    action,
    before ? JSON.stringify(before) : "",
    after ? JSON.stringify(after) : "",
  ]);
}

/* ---------- ロック（同時書き込みの直列化） ---------- */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25 * 1000); // 最大25秒待つ
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 出勤（空き・出勤内判定） ---------- */
/* 出勤シートから (name,dateStr) の勤務レンジ {startMs,endMs} を返す。無ければ null。
   列: 日付 / 名前 / 出勤時間 / 終了（"13:00〜翌2:00" 形式でも、開始/終了が分かれていても対応）。 */
function readShift_(name, dateStr) {
  var sh = book_().getSheetByName(SCHEDULE_SHEET);
  if (!sh || sh.getLastRow() < 2) return null;
  var v = sh.getDataRange().getValues();
  var head = v[0].map(function (x) {
    return String(x).trim();
  });
  var ci = {
    date: head.indexOf("日付"),
    name: head.indexOf("名前"),
    start: head.indexOf("出勤時間"),
    end: head.indexOf("終了"),
  };
  var want = normDate_(dateStr);
  for (var i = 1; i < v.length; i++) {
    var nm = ci.name >= 0 ? String(v[i][ci.name]).trim() : "";
    if (nm !== name) continue;
    var dv = ci.date >= 0 ? v[i][ci.date] : "";
    var dstr = dateCell_(dv);
    if (normDate_(dstr) !== want) continue;
    var sCell = ci.start >= 0 ? timeCell_(v[i][ci.start]) : "";
    var eCell = ci.end >= 0 ? timeCell_(v[i][ci.end]) : "";
    var startLabel = sCell,
      endLabel = eCell;
    // "13:00〜翌2:00" のように1セルに入っている場合
    var m = String(sCell).match(/(.+?)\s*[〜~\-]\s*(.+)/);
    if (m) {
      startLabel = m[1];
      endLabel = m[2];
    }
    var sMs = parseJstDateTime(dstr, startLabel);
    var eMs = parseJstDateTime(dstr, endLabel);
    if (sMs == null || eMs == null) return null;
    if (eMs <= sMs) eMs += 24 * 3600 * 1000; // 念のため（翌表記漏れ対策）
    return { startMs: sMs, endMs: eMs };
  }
  return null;
}
function dateCell_(dv) {
  return Object.prototype.toString.call(dv) === "[object Date]"
    ? Utilities.formatDate(dv, "Asia/Tokyo", "yyyy/M/d")
    : String(dv).trim();
}
function timeCell_(tv) {
  return Object.prototype.toString.call(tv) === "[object Date]"
    ? Utilities.formatDate(tv, "Asia/Tokyo", "H:mm")
    : String(tv).trim();
}
function normDate_(s) {
  var m = String(s || "").match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  return m ? +m[1] * 10000 + +m[2] * 100 + +m[3] : "";
}

/* ---------- コア操作 ---------- */
/* 予約を作成する（WEB/LINE/電話 共通）。
 * payload: {source, therapistId?, therapistName, dateStr, timeLabel, course,
 *           price, customerName, tel?, email?, lineUserId?, idempotencyKey?,
 *           asConfirmed?(電話など確認済みは直接確定), staffEmail?}
 * 戻り値: {ok, id, status, duplicated?} / 失敗時 {ok:false, reason}
 * すべてロック内で冪等・重複・出勤内判定を行う。 */
function createBooking(payload) {
  return withLock_(function () {
    var p = payload || {};
    var therapistId = p.therapistId || p.therapistName;
    if (!therapistId || !p.therapistName)
      return { ok: false, reason: "担当者が未指定です。" };
    var startMs = parseJstDateTime(p.dateStr, p.timeLabel);
    if (startMs == null) return { ok: false, reason: "日時が不正です。" };
    var dur = courseDurationMin(p.course);
    var endMs = startMs + dur * 60000;

    // 冪等キー（再送・Webhook再送の二重作成防止）
    var idem = makeIdempotencyKey({
      source: p.source,
      therapistId: therapistId,
      therapistName: p.therapistName,
      startMs: startMs,
      tel: p.tel,
      email: p.email,
      lineUserId: p.lineUserId,
      course: p.course,
      idempotencyKey: p.idempotencyKey,
    });
    var rows = readLedger_();
    var dup = rows.filter(function (r) {
      return (
        String(r.idempotencyKey) === String(idem) &&
        ACTIVE_STATUSES.indexOf(r.status) >= 0
      );
    })[0];
    if (dup) return { ok: true, id: dup.id, status: dup.status, duplicated: true };

    // 出勤内判定
    var shift = readShift_(p.therapistName, p.dateStr);
    if (shift && !withinShift(startMs, endMs, shift.startMs, shift.endMs)) {
      return { ok: false, reason: "コース終了が出勤時間を超えます。" };
    }

    // 重複判定（同一担当者・占有状態）
    var conflict = findConflict(rows, therapistId, startMs, endMs);
    if (conflict) return { ok: false, reason: "その時間は既に予約が入っています。" };

    var asConfirmed = !!p.asConfirmed;
    var now = nowMs_();
    var nowStr = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
    var o = {
      id: genId_("BK"),
      source: p.source || SOURCE.WEB,
      status: asConfirmed ? STATUS.CONFIRMED : STATUS.TENTATIVE,
      therapistId: therapistId,
      therapistName: p.therapistName,
      startAt: startMs,
      endAt: endMs,
      durationMin: dur,
      course: p.course || "",
      price: p.price || "",
      customerName: p.customerName || "",
      tel: p.tel || "",
      email: p.email || "",
      lineUserId: p.lineUserId || "",
      tentativeExpireAt: asConfirmed ? "" : now + ttlMin_() * 60000,
      confirmToken: asConfirmed ? "" : genId_("T"),
      idempotencyKey: idem,
      staffMemo: p.staffMemo || "",
      createdAt: nowStr,
      updatedAt: nowStr,
      updatedBy: p.staffEmail || p.source || "",
    };
    appendRow_(o);
    logHistory_(o.id, o.updatedBy, "create(" + o.status + ")", null, o);
    return { ok: true, id: o.id, status: o.status, confirmToken: o.confirmToken };
  });
}

/* メール確認リンクで確定（期限切れ・キャンセル済みは確定しない）。 */
function confirmByToken(token) {
  return withLock_(function () {
    if (!token) return { ok: false, reason: "トークンがありません。" };
    var rows = readLedger_();
    var r = rows.filter(function (x) {
      return String(x.confirmToken) === String(token) && x.confirmToken;
    })[0];
    if (!r) return { ok: false, reason: "予約が見つかりません。" };
    if (r.status === STATUS.CONFIRMED) return { ok: true, id: r.id, already: true };
    if (r.status !== STATUS.TENTATIVE)
      return { ok: false, reason: "この予約は確定できません（" + (STATUS_LABEL[r.status] || r.status) + "）。" };
    if (isTentativeExpired(r, nowMs_())) {
      _setStatus_(r, STATUS.EXPIRED, "system");
      return { ok: false, reason: "確認期限を過ぎたため、枠を解放しました。お手数ですが再度ご予約ください。" };
    }
    // 確定時にも重複を再確認（期限切れ解放後に他予約が入った可能性）
    var conflict = findConflict(rows, r.therapistId, r.startAt, r.endAt, r.id);
    if (conflict) return { ok: false, reason: "その時間は既に予約が入りました。別の時間をお選びください。" };
    _setStatus_(r, STATUS.CONFIRMED, "customer");
    return { ok: true, id: r.id };
  });
}

/* 状態だけ変える内部ヘルパー（ロック済み前提）。 */
function _setStatus_(r, to, actor) {
  if (!canTransition(r.status, to)) return false;
  var before = JSON.parse(JSON.stringify(r));
  var nowStr = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
  r.status = to;
  r.updatedAt = nowStr;
  r.updatedBy = actor || "";
  if (to !== STATUS.TENTATIVE) {
    r.confirmToken = "";
    r.tentativeExpireAt = "";
  }
  writeRow_(r.rowNum, r);
  logHistory_(r.id, actor, "status:" + before.status + "→" + to, before, r);
  return true;
}

/* 期限切れの仮予約を一括で解放（時間主導トリガーで定期実行）。 */
function expireTentatives() {
  return withLock_(function () {
    var rows = readLedger_();
    var now = nowMs_();
    var n = 0;
    rows.forEach(function (r) {
      if (isTentativeExpired(r, now)) {
        _setStatus_(r, STATUS.EXPIRED, "system");
        n++;
      }
    });
    return { ok: true, expired: n };
  });
}

/* ---------- スタッフ認証 ---------- */
function currentStaffEmail_() {
  // 管理デプロイ（実行=アクセスユーザー）では訪問者のメールが取れる
  var e = "";
  try {
    e = Session.getActiveUser().getEmail() || "";
  } catch (err) {
    e = "";
  }
  return e;
}
function staffAllowed_(email) {
  var list = cfg_("STAFF_EMAILS", "")
    .split(",")
    .map(function (s) {
      return s.trim().toLowerCase();
    })
    .filter(Boolean);
  return !!email && list.indexOf(email.toLowerCase()) >= 0;
}
function requireStaff_() {
  var e = currentStaffEmail_();
  if (!staffAllowed_(e)) {
    throw new Error("権限がありません（ログイン中: " + (e || "不明") + "）。管理者に連絡してください。");
  }
  return e;
}

/* ---------- 管理画面から呼ぶAPI（google.script.run）。すべて要スタッフ認証 ---------- */
function adminWhoAmI() {
  return { email: currentStaffEmail_(), allowed: staffAllowed_(currentStaffEmail_()) };
}

/* 日付(dateStr "2026/10/5")と絞り込みで一覧取得。 */
function adminList(params) {
  requireStaff_();
  var p = params || {};
  var want = p.dateStr ? normDate_(p.dateStr) : null;
  var rows = readLedger_();
  var out = rows
    .filter(function (r) {
      if (want && normDate_(fmtJst(r.startAt)) !== want) return false;
      if (p.therapistId && String(r.therapistId) !== String(p.therapistId)) return false;
      if (p.status && r.status !== p.status) return false;
      if (p.source && r.source !== p.source) return false;
      return true;
    })
    .sort(function (a, b) {
      return a.startAt - b.startAt;
    })
    .map(function (r) {
      return {
        id: r.id, source: r.source, status: r.status, statusLabel: STATUS_LABEL[r.status],
        therapistId: r.therapistId, therapistName: r.therapistName,
        start: fmtJst(r.startAt), end: fmtJst(r.endAt), durationMin: r.durationMin,
        course: r.course, price: r.price, customerName: r.customerName,
        tel: r.tel, email: r.email, lineUserId: r.lineUserId,
        staffMemo: r.staffMemo, updatedAt: r.updatedAt, updatedBy: r.updatedBy,
      };
    });
  return { ok: true, rows: out };
}

/* 手動登録（電話/LINEで受けた予約）。asConfirmed=true で直接確定も可。 */
function adminCreate(payload) {
  var staff = requireStaff_();
  var p = payload || {};
  p.source = p.source || SOURCE.PHONE;
  p.staffEmail = staff;
  if (p.asConfirmed == null) p.asConfirmed = true; // スタッフ登録は既定で確定
  return createBooking(p);
}

/* 変更（日時・担当者・コース・連絡先）。重複と出勤内を再確認。失敗時は元を保持。 */
function adminUpdate(id, changes) {
  var staff = requireStaff_();
  return withLock_(function () {
    var rows = readLedger_();
    var r = rows.filter(function (x) {
      return String(x.id) === String(id);
    })[0];
    if (!r) return { ok: false, reason: "予約が見つかりません。" };
    if (r.status === STATUS.CANCELLED || r.status === STATUS.EXPIRED)
      return { ok: false, reason: "この予約は変更できません（" + STATUS_LABEL[r.status] + "）。" };
    var before = JSON.parse(JSON.stringify(r));
    var ch = changes || {};

    var therapistName = ch.therapistName != null ? ch.therapistName : r.therapistName;
    var therapistId = ch.therapistId != null ? ch.therapistId : (ch.therapistName != null ? ch.therapistName : r.therapistId);
    var course = ch.course != null ? ch.course : r.course;
    var dur = courseDurationMin(course);
    var startMs = r.startAt;
    if (ch.dateStr != null && ch.timeLabel != null) {
      var parsed = parseJstDateTime(ch.dateStr, ch.timeLabel);
      if (parsed == null) return { ok: false, reason: "日時が不正です。" };
      startMs = parsed;
    }
    var endMs = startMs + dur * 60000;

    // 出勤内・重複を再確認（自分自身は除外）
    var dstr = fmtJst(startMs).split(" ")[0]; // "YYYY/MM/DD"
    var shift = readShift_(therapistName, dstr);
    if (shift && !withinShift(startMs, endMs, shift.startMs, shift.endMs))
      return { ok: false, reason: "コース終了が出勤時間を超えます。" };
    var conflict = findConflict(rows, therapistId, startMs, endMs, r.id);
    if (conflict) return { ok: false, reason: "変更後の時間が既存予約と重なります。" };

    // ここまで検証OK。元データは before に保持済み → 失敗時は書き込まないので消えない
    r.therapistId = therapistId;
    r.therapistName = therapistName;
    r.course = course;
    r.durationMin = dur;
    r.startAt = startMs;
    r.endAt = endMs;
    if (ch.price != null) r.price = ch.price;
    if (ch.customerName != null) r.customerName = ch.customerName;
    if (ch.tel != null) r.tel = ch.tel;
    if (ch.email != null) r.email = ch.email;
    r.updatedAt = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
    r.updatedBy = staff;
    writeRow_(r.rowNum, r);
    logHistory_(r.id, staff, "update", before, r);
    return { ok: true, id: r.id };
  });
}

/* 確定（電話など確認済みをスタッフが確定）。 */
function adminConfirm(id) {
  var staff = requireStaff_();
  return withLock_(function () {
    var rows = readLedger_();
    var r = rows.filter(function (x) {
      return String(x.id) === String(id);
    })[0];
    if (!r) return { ok: false, reason: "予約が見つかりません。" };
    if (r.status === STATUS.CONFIRMED) return { ok: true, id: r.id, already: true };
    if (!canTransition(r.status, STATUS.CONFIRMED))
      return { ok: false, reason: "確定できません（" + STATUS_LABEL[r.status] + "）。" };
    var conflict = findConflict(rows, r.therapistId, r.startAt, r.endAt, r.id);
    if (conflict) return { ok: false, reason: "その時間は既に予約が入っています。" };
    _setStatus_(r, STATUS.CONFIRMED, staff);
    return { ok: true, id: r.id };
  });
}

/* キャンセル（削除せず履歴として残す）。 */
function adminCancel(id, reason) {
  var staff = requireStaff_();
  return withLock_(function () {
    var rows = readLedger_();
    var r = rows.filter(function (x) {
      return String(x.id) === String(id);
    })[0];
    if (!r) return { ok: false, reason: "予約が見つかりません。" };
    if (r.status === STATUS.CANCELLED) return { ok: true, id: r.id, already: true };
    var before = JSON.parse(JSON.stringify(r));
    r.status = STATUS.CANCELLED;
    if (reason) r.staffMemo = (r.staffMemo ? r.staffMemo + " / " : "") + "キャンセル理由:" + reason;
    r.confirmToken = "";
    r.tentativeExpireAt = "";
    r.updatedAt = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
    r.updatedBy = staff;
    writeRow_(r.rowNum, r);
    logHistory_(r.id, staff, "cancel", before, r);
    return { ok: true, id: r.id };
  });
}

/* スタッフメモ編集。 */
function adminMemo(id, memo) {
  var staff = requireStaff_();
  return withLock_(function () {
    var rows = readLedger_();
    var r = rows.filter(function (x) {
      return String(x.id) === String(id);
    })[0];
    if (!r) return { ok: false, reason: "予約が見つかりません。" };
    var before = JSON.parse(JSON.stringify(r));
    r.staffMemo = memo || "";
    r.updatedAt = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
    r.updatedBy = staff;
    writeRow_(r.rowNum, r);
    logHistory_(r.id, staff, "memo", before, r);
    return { ok: true, id: r.id };
  });
}

/* ---------- 公開エンドポイント（doGet/doPost） ---------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === "availability") return availabilityResponse_(p);
  if (p.action === "confirm") return confirmPage_(p.token);
  // それ以外は管理画面（管理デプロイで配信・要ログイン）
  return serveAdmin_();
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (_) {
        body = (e && e.parameter) || {};
      }
    } else {
      body = (e && e.parameter) || {};
    }
    var action = body.action || (e && e.parameter && e.parameter.action);

    if (action === "web_create") {
      var r = createBooking({
        source: SOURCE.WEB,
        therapistId: body.therapistId,
        therapistName: body.therapistName,
        dateStr: body.dateStr,
        timeLabel: body.timeLabel,
        course: body.course,
        price: body.price,
        customerName: body.customerName,
        tel: body.tel,
        email: body.email,
        idempotencyKey: body.idempotencyKey,
      });
      return json_(r);
    }

    if (action === "line_event") {
      // LINE署名はプロキシ側で検証済み。プロキシの共有シークレットを確認する。
      var secret = cfg_("PROXY_SHARED_SECRET", "");
      if (!secret || body.proxySecret !== secret) {
        return json_({ ok: false, reason: "unauthorized" });
      }
      var rr = createBooking({
        source: SOURCE.LINE,
        therapistId: body.therapistId,
        therapistName: body.therapistName,
        dateStr: body.dateStr,
        timeLabel: body.timeLabel,
        course: body.course,
        price: body.price,
        customerName: body.customerName,
        lineUserId: body.lineUserId,
        idempotencyKey: body.idempotencyKey,
      });
      return json_(rr);
    }

    return json_({ ok: false, reason: "unknown action" });
  } catch (err) {
    return json_({ ok: false, reason: String(err) });
  }
}

/* 公開の空き状況：個人情報を含めず、担当者別の占有区間のみ返す。
   取得に失敗したら ok:false を返す（＝フロントは「空き」と誤表示しない）。 */
function availabilityResponse_(p) {
  try {
    var want = p.date ? normDate_(p.date) : null;
    var rows = readLedger_();
    var busy = rows
      .filter(function (r) {
        if (ACTIVE_STATUSES.indexOf(r.status) < 0) return false;
        if (want && normDate_(fmtJst(r.startAt)) !== want) return false;
        return true;
      })
      .map(function (r) {
        // 個人情報は一切含めない（担当者ID・区間・状態のみ）
        return { th: r.therapistId, s: r.startAt, e: r.endAt, st: r.status };
      });
    return jsonp_(p.callback, { ok: true, busy: busy });
  } catch (err) {
    return jsonp_(p.callback, { ok: false, reason: "availability error" });
  }
}

function confirmPage_(token) {
  var r = confirmByToken(token);
  var msg = r.ok
    ? (r.already ? "ご予約はすでに確定済みです。ありがとうございます。" : "ご予約が確定しました。ご来店をお待ちしております。")
    : "確定できませんでした：" + (r.reason || "");
  var html =
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font-family:sans-serif;max-width:420px;margin:40px auto;padding:0 20px;text-align:center;color:#333">' +
    '<h2 style="color:#5a4a33;letter-spacing:.08em">AROMA DAIAMOND</h2>' +
    "<p style=\"font-size:15px;line-height:1.9\">" + msg + "</p></div>";
  return HtmlService.createHtmlOutput(html);
}

function serveAdmin_() {
  var email = currentStaffEmail_();
  if (!staffAllowed_(email)) {
    return HtmlService.createHtmlOutput(
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<div style="font-family:sans-serif;max-width:420px;margin:40px auto;text-align:center;color:#333">' +
        "<h3>権限がありません</h3><p>ログイン中: " + (email || "不明") +
        "<br>管理者にGoogleアカウントの許可登録を依頼してください。</p></div>"
    );
  }
  var t = HtmlService.createTemplateFromFile("Admin");
  t.staffEmail = email;
  return t
    .evaluate()
    .setTitle("予約管理 | AROMA DAIAMOND")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/* roster を管理画面に渡す（担当者選択用。個人情報ではない）。 */
function adminTherapists() {
  requireStaff_();
  // 出勤シートの名前一覧（重複排除）。IDは名前を安定キーとして使用。
  var out = [];
  try {
    var sh = book_().getSheetByName(SCHEDULE_SHEET);
    if (sh && sh.getLastRow() > 1) {
      var v = sh.getDataRange().getValues();
      var head = v[0].map(function (x) {
        return String(x).trim();
      });
      var ni = head.indexOf("名前");
      var seen = {};
      for (var i = 1; i < v.length; i++) {
        var nm = ni >= 0 ? String(v[i][ni]).trim() : "";
        if (nm && !seen[nm]) {
          seen[nm] = 1;
          out.push({ id: nm, name: nm });
        }
      }
    }
  } catch (err) {}
  return { ok: true, therapists: out };
}

/* ---------- 出力ヘルパー ---------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
function jsonp_(cb, obj) {
  var s = JSON.stringify(obj);
  return cb
    ? ContentService.createTextOutput(cb + "(" + s + ")").setMimeType(
        ContentService.MimeType.JAVASCRIPT
      )
    : ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- 移行・バックアップ ---------- */
/* 既存「予約」「LINE予約」タブを新台帳へ移行する（元タブは消さない）。
 * 1) バックアップを作成 2) 既存行を台帳スキーマへ変換して追記（冪等キーで重複回避）。
 * 変換できない行はスキップしログに残す。dryRun=true で件数のみ確認。 */
function migrateFromLegacy(opts) {
  requireStaff_();
  var o = opts || {};
  var dryRun = !!o.dryRun;
  var report = { backup: null, scanned: 0, migrated: 0, skipped: 0, details: [] };

  if (!dryRun) report.backup = backupBook_();

  var existingKeys = {};
  readLedger_().forEach(function (r) {
    if (r.idempotencyKey) existingKeys[r.idempotencyKey] = 1;
  });

  // 「予約」(WEB) タブ：受付日時,希望日,予約時間,コース,料金,セラピスト,お名前,…,状態,キー,予約日時
  _migrateSheet_("予約", SOURCE.WEB, existingKeys, report, dryRun);
  // 「LINE予約」タブ
  _migrateSheet_("LINE予約", SOURCE.LINE, existingKeys, report, dryRun);

  return report;
}

function _migrateSheet_(sheetName, source, existingKeys, report, dryRun) {
  var sh = book_().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return;
  var v = sh.getDataRange().getValues();
  var head = v[0].map(function (x) {
    return String(x).trim();
  });
  var idx = function (names) {
    for (var k = 0; k < names.length; k++) {
      var i = head.indexOf(names[k]);
      if (i >= 0) return i;
    }
    return -1;
  };
  var ci = {
    date: idx(["希望日", "日付"]),
    time: idx(["予約時間", "時間"]),
    course: idx(["コース"]),
    price: idx(["料金"]),
    ther: idx(["セラピスト", "担当者", "名前"]),
    name: idx(["お名前", "氏名"]),
    tel: idx(["電話"]),
    email: idx(["メール"]),
    state: idx(["状態"]),
    recv: idx(["受付日時"]),
  };
  for (var i = 1; i < v.length; i++) {
    report.scanned++;
    var row = v[i];
    var dateStr = ci.date >= 0 ? dateCell_(row[ci.date]) : "";
    var timeStr = ci.time >= 0 ? timeCell_(row[ci.time]) : "";
    var therapist = ci.ther >= 0 ? String(row[ci.ther]).trim() : "";
    // 希望日が "9/16(水)" の場合は年を補完できないためスキップ（手動対応）
    var startMs = parseJstDateTime(normalizeLegacyDate_(dateStr), timeStr);
    if (startMs == null || !therapist) {
      report.skipped++;
      report.details.push({ sheet: sheetName, row: i + 1, reason: "日付/時刻/担当者を解釈できず" });
      continue;
    }
    var course = ci.course >= 0 ? String(row[ci.course]).trim() : "";
    var dur = courseDurationMin(course);
    var idem = makeIdempotencyKey({
      source: source,
      therapistId: therapist,
      startMs: startMs,
      tel: ci.tel >= 0 ? row[ci.tel] : "",
      email: ci.email >= 0 ? row[ci.email] : "",
      course: course,
    });
    if (existingKeys[idem]) {
      report.skipped++;
      continue;
    }
    var legacyState = ci.state >= 0 ? String(row[ci.state]).trim() : "";
    var status =
      /キャンセル/.test(legacyState) ? STATUS.CANCELLED :
      /確定/.test(legacyState) ? STATUS.CONFIRMED : STATUS.TENTATIVE;
    if (dryRun) {
      report.migrated++;
      existingKeys[idem] = 1;
      continue;
    }
    var nowStr = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
    appendRow_({
      id: genId_("MG"),
      source: source,
      status: status,
      therapistId: therapist,
      therapistName: therapist,
      startAt: startMs,
      endAt: startMs + dur * 60000,
      durationMin: dur,
      course: course,
      price: ci.price >= 0 ? row[ci.price] : "",
      customerName: ci.name >= 0 ? row[ci.name] : "",
      tel: ci.tel >= 0 ? row[ci.tel] : "",
      email: ci.email >= 0 ? row[ci.email] : "",
      lineUserId: "",
      tentativeExpireAt: "",
      confirmToken: "",
      idempotencyKey: idem,
      staffMemo: "移行(" + sheetName + ")",
      createdAt: ci.recv >= 0 ? dateCell_(row[ci.recv]) : nowStr,
      updatedAt: nowStr,
      updatedBy: "migration",
    });
    existingKeys[idem] = 1;
    report.migrated++;
  }
}

/* 旧「9/16(水)」形式の日付に年を補う（現在年。年跨ぎは手動確認）。 */
function normalizeLegacyDate_(s) {
  var str = String(s || "").trim();
  if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(str)) return str;
  var m = str.match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return "";
  var y = new Date().getFullYear();
  return y + "/" + (+m[1]) + "/" + (+m[2]);
}

/* ブック全体を複製してバックアップ（移行前の安全策）。 */
function backupBook_() {
  var f = DriveApp.getFileById(sheetId_());
  var name = f.getName() + " バックアップ " + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd_HHmmss");
  var copy = f.makeCopy(name);
  return { id: copy.getId(), name: name, url: copy.getUrl() };
}

/* ---------- セットアップ・検証補助 ---------- */
/* 初期セットアップ：シート作成＋期限切れトリガー登録。一度だけ実行。 */
function setup() {
  ledger_();
  history_();
  // 5分おきに期限切れ解放
  var exists = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === "expireTentatives";
  });
  if (!exists) {
    ScriptApp.newTrigger("expireTentatives").timeBased().everyMinutes(5).create();
  }
  return "setup done";
}

/* テスト用台帳でひと通り検証（TEST_MODE推奨）。本番台帳では実行しないこと。 */
function selfTest() {
  var date = Utilities.formatDate(new Date(Date.now() + 86400000), "Asia/Tokyo", "yyyy/M/d");
  var a = createBooking({ source: "電話", therapistName: "テスト太郎", dateStr: date, timeLabel: "14:00", course: "90分コース", price: 18000, customerName: "検証", tel: "000", asConfirmed: true });
  var b = createBooking({ source: "WEB", therapistName: "テスト太郎", dateStr: date, timeLabel: "15:00", course: "90分コース", price: 18000, customerName: "重複", tel: "111" });
  var c = createBooking({ source: "WEB", therapistName: "テスト太郎", dateStr: date, timeLabel: "14:00", course: "90分コース", price: 18000, customerName: "検証", tel: "000", asConfirmed: true }); // 冪等で重複なし
  return { create_confirmed: a, overlap_rejected: b, idempotent: c };
}
