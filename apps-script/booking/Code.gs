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
 *   OWNER_EMAIL           … 店舗通知メール（STORE_EMAIL 未設定時の控え先）
 *   STORE_EMAIL           … 予約控えメールの送り先（例 aromadiamond00@gmail.com）
 *   MAIL_SENDER_NAME      … 送信者表示名。既定 "AROMA DAIAMOND"
 *   STORE_TEL             … 文面に載せる電話番号。既定 "09043918013"
 *   PUBLIC_EXEC_URL       … 公開API /exec のURL（確認リンク生成用。未設定なら自動取得）
 *   TEST_MODE             … メール送信ガード。"false" で実送信、それ以外(既定)は送らずログのみ
 *                           ※本番切替は、テスト検証後に明示的に "false" を設定する
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
/* 予約台帳・予約履歴など「お客様情報を含むシート」を置くブック。
   LEDGER_SHEET_ID が設定されていればその（共有しない）ファイル、無ければ SHEET_ID と同じ。
   サイト用のデータ（出勤情報・本日の出勤）は公開用の SHEET_ID 側に残す。 */
function ledgerBook_() {
  var id = cfg_("LEDGER_SHEET_ID", "");
  return id ? SpreadsheetApp.openById(id) : book_();
}
function nowMs_() {
  return Date.now();
}
function ttlMin_() {
  return parseInt(cfg_("TENTATIVE_TTL_MIN", "30"), 10) || 30;
}
/* メール送信ガード。安全側の既定＝テストモード（TEST_MODE を明示的に "false"
   にしたときだけ実送信する）。未設定のまま誤って実送信することを防ぐ。 */
function isTestMode_() {
  // 前後の空白・大文字小文字を無視。"false" を明示したときだけ実送信。
  return String(cfg_("TEST_MODE", "true")).trim().toLowerCase() !== "false";
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
  var b = ledgerBook_();
  var sh = b.getSheetByName(LEDGER_SHEET);
  if (!sh) {
    sh = b.insertSheet(LEDGER_SHEET);
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
  }
  return sh;
}
function history_() {
  var b = ledgerBook_();
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
/* セル値を文字列へ。日付型(Date)はJST文字列に（google.script.run はDateを含む
   戻り値をnull化することがあるため、画面に返す値は必ずプリミティブにする）。 */
function cellStr_(v) {
  if (v == null) return "";
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return Utilities.formatDate(v, "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
  }
  return String(v);
}

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
      tel: fixTel_(r[c["電話"]]),
      email: r[c["メール"]],
      lineUserId: r[c["LINE_UID"]],
      tentativeExpireAt: Number(r[c["仮予約期限epoch"]]) || 0,
      confirmToken: r[c["確認トークン"]],
      idempotencyKey: r[c["冪等キー"]],
      staffMemo: r[c["スタッフメモ"]],
      createdAt: cellStr_(r[c["作成日時(JST)"]]),
      updatedAt: cellStr_(r[c["更新日時(JST)"]]),
      updatedBy: r[c["最終操作者"]],
    };
  });
}

/* 電話番号の先頭0を守る。シートは "08012345678" を数値に自動変換して0を落とすため、
   ・読み込み時：0が欠けた9〜10桁の数字（日本の番号は必ず0始まり）に0を補う
   ・書き込み時：先頭に ' を付けて「文字列」として保存（' 自体はセル値に含まれない） */
function fixTel_(v) {
  var s = String(v == null ? "" : v).trim();
  if (/^[1-9]\d{8,9}$/.test(s)) s = "0" + s;
  return s;
}
function telCell_(v) {
  var s = fixTel_(v);
  return s ? "'" + s : "";
}

function objToRow_(o) {
  return [
    o.id, o.source, o.status, STATUS_LABEL[o.status] || o.status,
    o.therapistId, o.therapistName,
    fmtJst(o.startAt), fmtJst(o.endAt), o.startAt, o.endAt, o.durationMin,
    o.course, o.price, o.customerName, telCell_(o.tel), o.email || "", o.lineUserId || "",
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
/* 出勤シートを読み込む（見出し行＝「名前」を含む行を自動検出）。
   戻り値: { sh, values, hi(見出し行index), head, c:{列index} } */
function schedSheet_() {
  var sh = book_().getSheetByName(SCHEDULE_SHEET);
  if (!sh) throw new Error("「" + SCHEDULE_SHEET + "」シートが見つかりません。");
  var v = sh.getLastRow() > 0 ? sh.getDataRange().getValues() : [[]];
  var hi = -1;
  for (var i = 0; i < Math.min(v.length, 10); i++) {
    var rowHead = v[i].map(function (x) {
      return String(x).trim();
    });
    if (rowHead.indexOf("名前") >= 0) {
      hi = i;
      break;
    }
  }
  if (hi < 0) throw new Error("「" + SCHEDULE_SHEET + "」シートに「名前」の見出しがありません。");
  var head = v[hi].map(function (x) {
    return String(x).trim();
  });
  var col = function (names) {
    for (var k = 0; k < names.length; k++) {
      var j = head.indexOf(names[k]);
      if (j >= 0) return j;
    }
    return -1;
  };
  var c = {
    date: col(["日付"]),
    label: col(["ラベル"]),
    name: col(["名前"]),
    time: col(["出勤時間", "時間"]),
    end: col(["終了"]),
    status: col(["ステータス"]),
    present: col(["出勤"]),
    kbn: col(["区分"]),
    area: col(["エリア"]),
  };
  return { sh: sh, values: v, hi: hi, head: head, c: c };
}
/* 「出勤」列の ✖️ 等（休み）／「区分」列の 申請中・希望休 等（未確定）。サイト側の判定と同じ。 */
function isAbsentMark_(v) {
  return /^(✖️|✖|✗|×|✕|x|欠|欠勤|休|休み|no|false|非表示)$/i.test(String(v == null ? "" : v).trim());
}
function isDraftKbn_(v) {
  return /^(申請|申請中|希望|希望休|未確定|保留|draft|下書き)$/i.test(String(v == null ? "" : v).trim());
}
/* 出勤シートの1行 → 出勤情報。休み・未確定・日付不正なら active=false。 */
function shiftRowInfo_(S, row) {
  var c = S.c;
  var dstr = c.date >= 0 ? dateCell_(row[c.date]) : "";
  var sCell = c.time >= 0 ? timeCell_(row[c.time]) : "";
  var eCell = c.end >= 0 ? timeCell_(row[c.end]) : "";
  var startLabel = sCell,
    endLabel = eCell;
  var m = String(sCell).match(/(.+?)\s*[〜~\-]\s*(.+)/); // "13:00〜翌2:00" 形式
  if (m) {
    startLabel = m[1];
    endLabel = m[2];
  }
  var sMs = parseJstDateTime(dstr, startLabel);
  var eMs = parseJstDateTime(dstr, endLabel);
  if (sMs != null && eMs != null && eMs <= sMs) eMs += 24 * 3600 * 1000; // 翌表記漏れ対策
  var absent = c.present >= 0 && isAbsentMark_(row[c.present]);
  var draft = c.kbn >= 0 && isDraftKbn_(row[c.kbn]);
  return {
    name: c.name >= 0 ? String(row[c.name]).trim() : "",
    date: dstr,
    dateKey: normDate_(dstr),
    time: sCell + (eCell && !m ? "〜" + eCell : ""),
    startMs: sMs,
    endMs: eMs,
    absent: absent,
    draft: draft,
    active: !absent && !draft && sMs != null && eMs != null,
  };
}

/* (name,dateStr) の勤務レンジ {startMs,endMs}。休み・未確定・未登録なら null。 */
function readShift_(name, dateStr) {
  var S;
  try {
    S = schedSheet_();
  } catch (e) {
    return null;
  }
  var want = normDate_(dateStr);
  for (var i = S.hi + 1; i < S.values.length; i++) {
    var info = shiftRowInfo_(S, S.values[i]);
    if (info.name !== name || info.dateKey !== want) continue;
    if (!info.active) continue;
    return { startMs: info.startMs, endMs: info.endMs };
  }
  return null;
}
/* その日に（誰かの）確定出勤が1件でも登録されているか。
   出勤表が読めない・未入力の日は false（＝出勤チェックをしない＝従来どおり受け付ける）。 */
function dayHasShifts_(dateStr) {
  var S;
  try {
    S = schedSheet_();
  } catch (e) {
    return false;
  }
  var want = normDate_(dateStr);
  for (var i = S.hi + 1; i < S.values.length; i++) {
    var info = shiftRowInfo_(S, S.values[i]);
    if (info.dateKey === want && info.active) return true;
  }
  return false;
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

/* ---------- 担当者ディレクトリ（安定ID） ----------
   出勤シートに任意の「担当者ID」（または「ID」）列があれば、それを
   “名前が変わっても不変の安定ID”として採用する。無ければ従来どおり名前をIDに使う。
   これにより、改名や表記ゆれがあっても予約と担当者の紐付けが壊れない。
   戻り値: { list:[{id,name}], byName:{<name>:<id>} }（名前で重複排除）。 */
function therapistDirectory_() {
  var out = { list: [], byName: {} };
  try {
    var S = schedSheet_();
    var v = S.values;
    var head = S.head;
    var ni = head.indexOf("名前");
    var idi = head.indexOf("担当者ID");
    if (idi < 0) idi = head.indexOf("ID");
    var seen = {};
    for (var i = S.hi + 1; i < v.length; i++) {
      var nm = ni >= 0 ? String(v[i][ni]).trim() : "";
      if (!nm || seen[nm]) continue;
      var id = idi >= 0 ? String(v[i][idi]).trim() : "";
      if (!id) id = nm; // ID列が空なら名前を安定キーに（従来互換）
      seen[nm] = 1;
      out.list.push({ id: id, name: nm });
      out.byName[nm] = id;
    }
  } catch (err) {}
  return out;
}

/* 名前（または既存ID）→ 安定ID。マッピングが無ければそのまま返す。 */
function resolveTherapistId_(nameOrId) {
  if (!nameOrId) return "";
  var dir = therapistDirectory_();
  return dir.byName[nameOrId] || nameOrId;
}

/* ---------- コア操作 ---------- */
/* 予約を作成する（WEB/LINE/電話 共通）。
 * payload: {source, therapistId?, therapistName, dateStr, timeLabel, course,
 *           price, customerName, tel?, email?, lineUserId?, idempotencyKey?,
 *           asConfirmed?(電話など確認済みは直接確定), staffEmail?}
 * 戻り値: {ok, id, status, duplicated?} / 失敗時 {ok:false, reason}
 * すべてロック内で冪等・重複・出勤内判定を行う。 */
function createBooking(payload) {
  var toNotify = null; // 送信はロック解放後（予約ロックを長引かせない）
  var result = withLock_(function () {
    var p = payload || {};
    if (!p.therapistName && !p.therapistId)
      return { ok: false, reason: "担当者が未指定です。" };
    // 安定IDに正規化する。
    //  ・管理画面が名前と異なる明示IDを渡した場合はそれを尊重（同名担当の区別）。
    //  ・WEB/LINE は名前のみ送るため、出勤シートの「担当者ID」列で名前→安定IDに解決。
    //  ・ID列が無ければ名前がそのままIDになる（従来互換）。
    var therapistId =
      p.therapistId && p.therapistId !== p.therapistName
        ? p.therapistId
        : resolveTherapistId_(p.therapistName || p.therapistId);
    if (!therapistId) return { ok: false, reason: "担当者が未指定です。" };
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
    // WEB・LINE：その日の出勤表に載っていない（休み・未登録）セラピストへの予約は断る。
    // サイトの出勤表示が切り替わるまでの間に、休みの人へ予約が入るのを防ぐため。
    // 出勤表が読めない／その日が未入力の場合は、従来どおり受け付ける。おまかせは対象外。
    var isOmakase = /おまかせ/.test(String(p.therapistName || ""));
    if (
      !shift && !isOmakase &&
      (p.source === SOURCE.WEB || p.source === SOURCE.LINE) &&
      dayHasShifts_(p.dateStr)
    ) {
      return { ok: false, reason: "その日は出勤予定がありません。別の日・セラピストをお選びください。" };
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
    toNotify = o;
    return { ok: true, id: o.id, status: o.status, confirmToken: o.confirmToken };
  });
  // 新規作成時の通知（仮予約=確認リンク／確定=確定メール）。重複(再送)時は toNotify=null で送らない。
  if (toNotify) {
    notifyCustomer_(toNotify, toNotify.status === STATUS.TENTATIVE ? "tentative" : "confirmed");
  }
  return result;
}

/* メール確認リンクで確定（期限切れ・キャンセル済みは確定しない）。 */
function confirmByToken(token) {
  var confirmedRow = null;
  var result = withLock_(function () {
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
    confirmedRow = JSON.parse(JSON.stringify(r));
    return { ok: true, id: r.id };
  });
  if (confirmedRow) notifyCustomer_(confirmedRow, "confirmed");
  return result;
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
  var expiredRows = [];
  var result = withLock_(function () {
    var rows = readLedger_();
    var now = nowMs_();
    rows.forEach(function (r) {
      if (isTentativeExpired(r, now)) {
        _setStatus_(r, STATUS.EXPIRED, "system");
        expiredRows.push(JSON.parse(JSON.stringify(r)));
      }
    });
    return { ok: true, expired: expiredRows.length };
  });
  expiredRows.forEach(function (r) {
    notifyCustomer_(r, "expired");
  });
  return result;
}

/* ---------- メール通知（確認リンク/確定/期限切れ/キャンセル・TEST_MODEでガード） ----------
   ・文面はここに集約（WEB/LINE/電話のどの経路でも同じテンプレート）。
   ・宛先メールが無い予約（電話・LINEなど）は自動スキップ（＝必須にしない）。
   ・TEST_MODE 中は実送信せずログのみ（本番前の検証用）。 */
function senderName_() {
  return cfg_("MAIL_SENDER_NAME", "AROMA DAIAMOND");
}
function storeEmail_() {
  return cfg_("STORE_EMAIL", "") || cfg_("OWNER_EMAIL", "");
}
function storeTel_() {
  return cfg_("STORE_TEL", "09043918013");
}
/* 公開API /exec のベースURL（確認リンク用）。未設定なら現デプロイのURLを使う。 */
function publicExecUrl_() {
  var u = cfg_("PUBLIC_EXEC_URL", "");
  if (u) return u;
  try {
    return (ScriptApp.getService().getUrl() || "");
  } catch (e) {
    return "";
  }
}
function confirmUrl_(token) {
  var base = publicExecUrl_();
  if (!base || !token) return "";
  return base + (base.indexOf("?") >= 0 ? "&" : "?") + "action=confirm&token=" + encodeURIComponent(token);
}

/* 予約内容の共通テキスト。 */
function mailBookingDetail_(r) {
  return [
    "日時: " + fmtJst(r.startAt) + " 〜 " + fmtJst(r.endAt).split(" ")[1],
    "セラピスト: " + (r.therapistName || ""),
    "コース: " + (r.course || "") + (r.price ? "（¥" + Number(r.price).toLocaleString("en-US") + "）" : ""),
    "お名前: " + (r.customerName || ""),
  ].join("\n");
}

/* 種別→{subject,body}。type: tentative/confirmed/expired/cancelled。 */
function mailTemplate_(type, r) {
  var nm = senderName_();
  var tel = storeTel_();
  var detail = mailBookingDetail_(r);
  if (type === "tentative") {
    var url = confirmUrl_(r.confirmToken);
    return {
      subject: "【" + nm + "】ご予約の確認（確定のお手続きをお願いします）",
      body: [
        (r.customerName || "お客様") + " 様",
        "",
        "この度はご予約ありがとうございます。ただいま【仮予約】の状態です。",
        "下記リンクを開くと、ご予約が【確定】します。",
        "",
        "▼ご予約を確定する",
        url || "（確認リンクの発行に失敗しました。お手数ですがお電話ください）",
        "",
        "※リンクの有効期限は発行から " + ttlMin_() + " 分です。期限を過ぎると枠は解放されます。",
        "",
        "▼ご予約内容（仮）",
        detail,
        "",
        "変更・キャンセルはお電話（" + tel + "）までご連絡ください。",
        nm,
      ].join("\n"),
    };
  }
  if (type === "confirmed") {
    return {
      subject: "【" + nm + "】ご予約が確定しました",
      body: [
        (r.customerName || "お客様") + " 様",
        "",
        "ご予約が【確定】しました。ご来店を心よりお待ちしております。",
        "",
        "▼ご予約内容",
        detail,
        "",
        "変更・キャンセルはお電話（" + tel + "）までご連絡ください。",
        nm,
      ].join("\n"),
    };
  }
  if (type === "expired") {
    return {
      subject: "【" + nm + "】仮予約の確認期限が過ぎました",
      body: [
        (r.customerName || "お客様") + " 様",
        "",
        "仮予約の確認期限（" + ttlMin_() + "分）を過ぎたため、枠を解放いたしました。",
        "恐れ入りますが、ご希望の場合は再度ご予約をお願いいたします。",
        "",
        "▼対象のご予約（仮）",
        detail,
        "",
        "お電話（" + tel + "）でも承ります。",
        nm,
      ].join("\n"),
    };
  }
  if (type === "cancelled") {
    return {
      subject: "【" + nm + "】ご予約をキャンセルしました",
      body: [
        (r.customerName || "お客様") + " 様",
        "",
        "下記のご予約をキャンセルいたしました。またのご利用をお待ちしております。",
        "",
        "▼キャンセルしたご予約",
        detail,
        "",
        "お心当たりがない場合はお電話（" + tel + "）までご連絡ください。",
        nm,
      ].join("\n"),
    };
  }
  return null;
}

/* 1通送信（TEST_MODE中はログのみ・宛先なしはスキップ）。 */
function sendMail_(to, subject, body) {
  if (!to) {
    Logger.log("[mail skip:宛先なし] " + subject);
    return false;
  }
  if (isTestMode_()) {
    Logger.log("[TEST_MODE 送信抑止] to=" + to + " / " + subject + "\n" + body);
    return false;
  }
  try {
    GmailApp.sendEmail(to, subject, body, { name: senderName_() });
    return true;
  } catch (e) {
    Logger.log("mail error: " + e);
    return false;
  }
}

/* お客様へ通知＋（新規・確定のみ）店舗へ控え。 */
function notifyCustomer_(r, type) {
  var tpl = mailTemplate_(type, r);
  if (!tpl) return;
  sendMail_(r.email, tpl.subject, tpl.body);
  var store = storeEmail_();
  if (store && (type === "tentative" || type === "confirmed")) {
    sendMail_(
      store,
      "[控え]" + tpl.subject + "（" + (r.therapistName || "") + "）",
      mailBookingDetail_(r) + "\n経路: " + (r.source || "") + "\n状態: " + (STATUS_LABEL[r.status] || r.status) + "\nID: " + (r.id || "")
    );
  }
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

/* 電話番号を数字だけに正規化（"090-1234-5678" と "09012345678" を同一視）。 */
function normTel_(s) {
  return String(s == null ? "" : s).replace(/[^0-9]/g, "");
}

/* 電話番号ごとのリピーター情報を作る。
   有効予約（確定・仮予約／キャンセル・期限切れは除外）を日付順に並べ、
   各予約IDが「何回目か(visitNo)」と「その番号の総来店数(visitCount)」を返す。
   戻り値: { <予約ID>: {visitNo, visitCount} }（電話が無い予約は含まれない）。 */
function visitInfoMap_(rows) {
  var byTel = {};
  rows.forEach(function (r) {
    if (ACTIVE_STATUSES.indexOf(r.status) < 0) return; // 来店とみなす状態のみ
    var tel = normTel_(r.tel);
    if (!tel) return;
    (byTel[tel] = byTel[tel] || []).push({ id: r.id, startAt: Number(r.startAt) || 0 });
  });
  var info = {};
  Object.keys(byTel).forEach(function (tel) {
    var arr = byTel[tel].sort(function (a, b) {
      return a.startAt - b.startAt;
    });
    arr.forEach(function (x, i) {
      info[x.id] = { visitNo: i + 1, visitCount: arr.length };
    });
  });
  return info;
}

/* 日付(dateStr "2026/10/5")と絞り込みで一覧取得。 */
function adminList(params) {
  requireStaff_();
  var p = params || {};
  var want = p.dateStr ? normDate_(p.dateStr) : null;
  var rows = readLedger_();
  var vinfo = visitInfoMap_(rows); // 全履歴からリピーター回数を算出
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
      var vi = vinfo[r.id] || {};
      return {
        id: r.id, source: r.source, status: r.status, statusLabel: STATUS_LABEL[r.status],
        therapistId: r.therapistId, therapistName: r.therapistName,
        start: fmtJst(r.startAt), end: fmtJst(r.endAt), durationMin: r.durationMin,
        course: r.course, price: r.price, customerName: r.customerName,
        tel: r.tel, email: r.email, lineUserId: r.lineUserId,
        staffMemo: r.staffMemo, updatedAt: r.updatedAt, updatedBy: r.updatedBy,
        visitNo: vi.visitNo || null, visitCount: vi.visitCount || null,
      };
    });
  return jsonSafe_({ ok: true, rows: out });
}

/* タイムテーブル（担当者×時間グリッド）用データを一括取得。
   その日に出勤 or 予約がある担当者だけを列にする。個人情報は管理画面内のみ。 */
function adminTimetable(dateStr) {
  requireStaff_();
  var openMin = parseInt(cfg_("GRID_OPEN_MIN", "600"), 10) || 600; // 10:00
  var closeMin = parseInt(cfg_("GRID_CLOSE_MIN", "1740"), 10) || 1740; // 翌5:00
  var step = parseInt(cfg_("GRID_STEP_MIN", "30"), 10) || 30;
  var want = normDate_(dateStr);

  var allRows = readLedger_();
  var vinfo = visitInfoMap_(allRows); // 全履歴からリピーター回数を算出
  var rows = allRows.filter(function (r) {
    return ACTIVE_STATUSES.indexOf(r.status) >= 0 && normDate_(fmtJst(r.startAt)) === want;
  });
  var bookings = rows.map(function (r) {
    var vi = vinfo[r.id] || {};
    return {
      id: r.id, therapistId: r.therapistId, therapistName: r.therapistName,
      status: r.status, statusLabel: STATUS_LABEL[r.status], source: r.source,
      course: r.course, customerName: r.customerName, price: r.price,
      tel: r.tel, email: r.email,
      start: fmtJst(r.startAt), end: fmtJst(r.endAt),
      startMin: minutesFromDate(r.startAt, dateStr), endMin: minutesFromDate(r.endAt, dateStr),
      visitNo: vi.visitNo || null, visitCount: vi.visitCount || null,
    };
  });

  var all = adminTherapists().therapists; // [{id,name}]（出勤シートの全名）
  var bookedIds = {};
  bookings.forEach(function (b) {
    bookedIds[String(b.therapistId)] = 1;
  });
  var therapists = [];
  all.forEach(function (t) {
    var sh = readShift_(t.name, dateStr);
    var worksToday = !!sh || bookedIds[String(t.id)];
    if (!worksToday) return; // その日に出勤も予約も無い人は列に出さない
    therapists.push({
      id: t.id, name: t.name,
      shiftStartMin: sh ? minutesFromDate(sh.startMs, dateStr) : null,
      shiftEndMin: sh ? minutesFromDate(sh.endMs, dateStr) : null,
    });
  });

  return jsonSafe_({ ok: true, openMin: openMin, closeMin: closeMin, step: step, therapists: therapists, bookings: bookings });
}

/* google.script.run はDate等を含む戻り値をnull化することがある。JSON往復で
   確実にプリミティブな素のオブジェクトにしてから返す（画面向けの保険）。 */
function jsonSafe_(o) {
  return JSON.parse(JSON.stringify(o));
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
  var confirmedRow = null;
  var result = withLock_(function () {
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
    confirmedRow = JSON.parse(JSON.stringify(r));
    return { ok: true, id: r.id };
  });
  if (confirmedRow) notifyCustomer_(confirmedRow, "confirmed");
  return result;
}

/* キャンセル（削除せず履歴として残す）。 */
function adminCancel(id, reason) {
  var staff = requireStaff_();
  var cancelledRow = null;
  var result = withLock_(function () {
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
    cancelledRow = JSON.parse(JSON.stringify(r));
    return { ok: true, id: r.id };
  });
  if (cancelledRow) notifyCustomer_(cancelledRow, "cancelled");
  return result;
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

/* WEB予約フォームの補足項目（フリガナ／お支払い／きっかけ／ご希望）を
   スタッフメモ用の1行にまとめる。各項目は長さを制限して保存する。 */
function webMemo_(b) {
  var clip = function (v, n) {
    return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
  };
  var parts = [];
  if (clip(b.kana, 50)) parts.push("フリガナ:" + clip(b.kana, 50));
  if (clip(b.pay, 30)) parts.push("支払:" + clip(b.pay, 30));
  if (clip(b.source, 50)) parts.push("きっかけ:" + clip(b.source, 50));
  if (clip(b.note, 300)) parts.push("ご希望:" + clip(b.note, 300));
  return parts.join(" / ");
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
        staffMemo: webMemo_(body),
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
        tel: body.tel,
        lineUserId: body.lineUserId,
        idempotencyKey: body.idempotencyKey,
        staffMemo: body.lineName ? "LINE表示名:" + String(body.lineName).slice(0, 50) : "",
        asConfirmed: true, // LINE予約はその場で確定（店舗方針）。署名検証済みルートのみ
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

/* roster を管理画面に渡す（担当者選択用。個人情報ではない）。
   IDは出勤シートの「担当者ID」列があればその安定ID、無ければ名前（従来互換）。 */
function adminTherapists() {
  requireStaff_();
  return { ok: true, therapists: therapistDirectory_().list };
}

/* ===================== セラピスト管理（出勤の登録・個別ページ） =====================
   出勤は既存の「出勤情報」シートに直接書き込む（サイト表示・WEB/LINE予約と同じデータ）。
   変更は「予約履歴」シートに SHIFT として記録する。 */
var WEEKDAY_JA_ = ["日", "月", "火", "水", "木", "金", "土"];
function keyToDate_(key) {
  key = +key;
  return Math.floor(key / 10000) + "/" + Math.floor((key % 10000) / 100) + "/" + (key % 100);
}
function addDays_(dstr, n) {
  var m = String(dstr).match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return "";
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  return d.getUTCFullYear() + "/" + (d.getUTCMonth() + 1) + "/" + d.getUTCDate();
}
function dateLabel_(dstr) {
  var m = String(dstr).match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return String(dstr);
  var dow = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  return +m[2] + "/" + +m[3] + "(" + WEEKDAY_JA_[dow] + ")";
}
function todayJst_() {
  return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/M/d");
}

/* 名簿（プロフィール）シート：「名前」と「年齢」の見出しを持つシートを自動で探す。
   Script Properties の THERAPIST_SHEET でシート名を指定することも可。見つからなければ null。 */
function profileSheet_() {
  var b = book_();
  // 既定はサイトが読んでいる「本日の出勤」。無い場合だけ、名前・年齢・タグ等の見出しで探す。
  var named = cfg_("THERAPIST_SHEET", "本日の出勤");
  var first = b.getSheetByName(named);
  var sheets = first ? [first] : b.getSheets();
  var skip = [SCHEDULE_SHEET, LEDGER_SHEET, HISTORY_SHEET, "応募", "予約", "LINE予約"];
  for (var k = 0; k < sheets.length; k++) {
    var sh = sheets[k];
    if (!sh || skip.indexOf(sh.getName()) >= 0 || sh.getLastRow() < 1) continue;
    var top = sh.getRange(1, 1, Math.min(5, sh.getLastRow()), Math.max(1, sh.getLastColumn())).getValues();
    for (var i = 0; i < top.length; i++) {
      var head = top[i].map(function (x) {
        return String(x).trim();
      });
      if (head.indexOf("名前") >= 0 && head.indexOf("年齢") >= 0 &&
          (first || head.indexOf("タグ") >= 0 || head.indexOf("スケジュール") >= 0 || head.indexOf("T") >= 0)) {
        return { sh: sh, hi: i, head: head, values: sh.getDataRange().getValues() };
      }
    }
  }
  return null;
}

/* セラピスト名の一覧（名簿シートの順 → 出勤シートにだけいる人を後ろに追加）。 */
function therapistNames_() {
  var names = [];
  var add = function (n) {
    n = String(n || "").trim();
    if (n && names.indexOf(n) < 0) names.push(n);
  };
  try {
    var P = profileSheet_();
    if (P) {
      var ni = P.head.indexOf("名前");
      for (var i = P.hi + 1; i < P.values.length; i++) add(P.values[i][ni]);
    }
  } catch (e) {}
  therapistDirectory_().list.forEach(function (t) {
    add(t.name);
  });
  return names;
}

/* その日の営業（5:00〜翌5:00）に入っている有効予約のうち、[sMs,eMs) に収まらないもの。
   sMs が null なら全件（＝出勤が無くなった場合）。 */
function bookingsOutside_(rows, name, dstr, sMs, eMs) {
  var dayS = parseJstDateTime(dstr, "5:00"),
    dayE = parseJstDateTime(dstr, "翌5:00");
  var tid = resolveTherapistId_(name);
  return rows.filter(function (r) {
    if (ACTIVE_STATUSES.indexOf(r.status) < 0) return false;
    if (String(r.therapistName) !== name && String(r.therapistId) !== String(tid)) return false;
    if (!(r.startAt >= dayS && r.startAt < dayE)) return false;
    return sMs == null || !withinShift(r.startAt, r.endAt, sMs, eMs);
  });
}
function outsideWarning_(list, what) {
  if (!list.length) return "";
  return what + "予約が " + list.length + " 件あります（" +
    list.map(function (r) {
      return fmtJst(r.startAt).split(" ")[1] + " " + (r.customerName || "名前なし");
    }).join("、") + "）。予約の変更・キャンセルが必要か確認してください。";
}

/* 週間出勤表：from から days 日分（既定7日）の出勤と、セラピスト一覧を返す。 */
function adminShifts(fromStr, days) {
  requireStaff_();
  var from = normDate_(fromStr) ? keyToDate_(normDate_(fromStr)) : todayJst_();
  var n = Math.min(Math.max(parseInt(days, 10) || 7, 1), 31);
  var dates = [],
    keys = {};
  for (var i = 0; i < n; i++) {
    var d = addDays_(from, i);
    dates.push({ date: d, label: dateLabel_(d) });
    keys[normDate_(d)] = 1;
  }
  var S = schedSheet_(),
    c = S.c;
  var shifts = [];
  var names = therapistNames_();
  for (var r = S.hi + 1; r < S.values.length; r++) {
    var row = S.values[r];
    var info = shiftRowInfo_(S, row);
    if (!info.name || !keys[info.dateKey]) continue;
    if (names.indexOf(info.name) < 0) names.push(info.name);
    shifts.push({
      row: r + 1,
      date: keyToDate_(info.dateKey),
      name: info.name,
      time: info.time,
      status: c.status >= 0 ? String(row[c.status]).trim() : "",
      kbn: c.kbn >= 0 ? String(row[c.kbn]).trim() : "",
      absent: info.absent,
      draft: info.draft,
    });
  }
  return jsonSafe_({ ok: true, from: from, dates: dates, names: names, shifts: shifts });
}

/* 編集対象の行を特定（行番号と元の名前・日付が一致するか確認。ずれていたら null）。 */
function findShiftRow_(S, row, name, dateStr) {
  var r = +row;
  if (!r || r <= S.hi + 1 || r > S.values.length) return null;
  var info = shiftRowInfo_(S, S.values[r - 1]);
  if (info.name !== String(name || "").trim() || info.dateKey !== normDate_(dateStr)) return null;
  return r;
}

/* 出勤の登録・変更。p = {row?, origName?, origDate?, name, date, start, end, status?, kbn?}
   row 無し＝新規（同じ人・同じ日の行があればそれを更新）。 */
function adminShiftSave(p) {
  var staff = requireStaff_();
  p = p || {};
  var name = String(p.name || "").trim();
  if (!name) return { ok: false, reason: "セラピストを選んでください。" };
  var dkey = normDate_(p.date);
  if (!dkey) return { ok: false, reason: "日付が不正です。" };
  var dstr = keyToDate_(dkey);
  var start = String(p.start || "").trim(),
    end = String(p.end || "").trim();
  var sMs = parseJstDateTime(dstr, start),
    eMs = parseJstDateTime(dstr, end);
  if (sMs == null || eMs == null) return { ok: false, reason: "出勤時間が不正です。" };
  if (eMs <= sMs) return { ok: false, reason: "終了は開始より後にしてください（深夜は「翌2:00」のように選んでください）。" };

  var res = withLock_(function () {
    var S = schedSheet_(),
      c = S.c;
    if (c.date < 0 || c.name < 0 || c.time < 0)
      return { ok: false, reason: "出勤情報シートに「日付」「名前」「出勤時間」の列が必要です。" };
    var target = -1,
      orig = null;
    if (p.row) {
      target = findShiftRow_(S, p.row, p.origName, p.origDate) || -1;
      if (target < 0) return { ok: false, reason: "出勤表がほかで更新されました。画面を更新してからやり直してください。" };
      orig = shiftRowInfo_(S, S.values[target - 1]);
    }
    for (var i = S.hi + 1; i < S.values.length; i++) {
      if (i + 1 === target) continue;
      var inf = shiftRowInfo_(S, S.values[i]);
      if (inf.name === name && inf.dateKey === dkey) {
        if (target < 0) target = i + 1; // 新規だが既に行がある → その行を更新
        else return { ok: false, reason: name + "さんの" + dateLabel_(dstr) + "の出勤はすでに登録されています。" };
      }
    }
    var width = Math.max(S.head.length, S.sh.getLastColumn());
    var arr, before = null;
    if (target > 0) {
      arr = S.sh.getRange(target, 1, 1, width).getValues()[0];
      before = arr.slice();
    } else {
      arr = [];
      for (var w = 0; w < width; w++) arr.push("");
    }
    arr[c.date] = "'" + dstr;
    if (c.label >= 0) arr[c.label] = "'" + dateLabel_(dstr);
    arr[c.name] = name;
    if (c.end >= 0) {
      arr[c.time] = "'" + start;
      arr[c.end] = "'" + end;
    } else {
      arr[c.time] = "'" + start + "〜" + end;
    }
    if (c.status >= 0) arr[c.status] = String(p.status || "").trim() || String(arr[c.status] || "").trim() || "空きあり";
    if (c.present >= 0) arr[c.present] = "○";
    if (c.kbn >= 0) arr[c.kbn] = String(p.kbn || "").trim() || "確定";
    if (c.area >= 0 && !String(arr[c.area] || "").trim()) arr[c.area] = "亀戸";
    if (target > 0) S.sh.getRange(target, 1, 1, width).setValues([arr]);
    else S.sh.appendRow(arr);
    logHistory_("SHIFT", staff, "出勤" + (before ? "変更" : "登録") + " " + name + " " + dstr, before, arr);
    return { ok: true, orig: orig };
  });
  if (!res.ok) return res;
  // 予約との整合チェック（警告のみ。予約は自動では動かさない）
  var rows = readLedger_();
  var warn = outsideWarning_(bookingsOutside_(rows, name, dstr, sMs, eMs), "この出勤時間の外に");
  if (res.orig && (res.orig.name !== name || res.orig.dateKey !== dkey)) {
    var w2 = outsideWarning_(bookingsOutside_(rows, res.orig.name, keyToDate_(res.orig.dateKey), null, null),
      "変更前（" + res.orig.name + " " + dateLabel_(res.orig.date) + "）に");
    warn = [warn, w2].filter(Boolean).join("\n");
  }
  return { ok: true, warning: warn };
}

/* 休みにする／出勤に戻す。p = {row, name, date, absent:true|false} */
function adminShiftSetAbsent(p) {
  var staff = requireStaff_();
  p = p || {};
  var res = withLock_(function () {
    var S = schedSheet_(),
      c = S.c;
    if (c.present < 0) return { ok: false, reason: "出勤情報シートに「出勤」列（○/✖️）がありません。" };
    var r = findShiftRow_(S, p.row, p.name, p.date);
    if (!r) return { ok: false, reason: "出勤表がほかで更新されました。画面を更新してからやり直してください。" };
    var cell = S.sh.getRange(r, c.present + 1);
    var before = cell.getValue();
    cell.setValue(p.absent ? "✖️" : "○");
    logHistory_("SHIFT", staff, (p.absent ? "休みに変更 " : "出勤に戻す ") + p.name + " " + p.date, { 出勤: before }, { 出勤: p.absent ? "✖️" : "○" });
    return { ok: true };
  });
  if (!res.ok || !p.absent) return res;
  var dstr = keyToDate_(normDate_(p.date));
  return { ok: true, warning: outsideWarning_(bookingsOutside_(readLedger_(), String(p.name).trim(), dstr, null, null), "この日に") };
}

/* 出勤の削除（登録間違いなど）。p = {row, name, date} */
function adminShiftDelete(p) {
  var staff = requireStaff_();
  p = p || {};
  var res = withLock_(function () {
    var S = schedSheet_();
    var r = findShiftRow_(S, p.row, p.name, p.date);
    if (!r) return { ok: false, reason: "出勤表がほかで更新されました。画面を更新してからやり直してください。" };
    var before = S.values[r - 1];
    S.sh.deleteRow(r);
    logHistory_("SHIFT", staff, "出勤削除 " + p.name + " " + p.date, before, null);
    return { ok: true };
  });
  if (!res.ok) return res;
  var dstr = keyToDate_(normDate_(p.date));
  return { ok: true, warning: outsideWarning_(bookingsOutside_(readLedger_(), String(p.name).trim(), dstr, null, null), "この日に") };
}

/* セラピスト個別ページ：プロフィール（名簿シートの値）・今後2週間の出勤・今後の予約・件数。 */
function adminTherapistDetail(name) {
  requireStaff_();
  name = String(name || "").trim();
  if (!name) return { ok: false, reason: "セラピストが指定されていません。" };
  var profile = [];
  try {
    var P = profileSheet_();
    if (P) {
      var ni = P.head.indexOf("名前");
      for (var i = P.hi + 1; i < P.values.length; i++) {
        if (String(P.values[i][ni]).trim() !== name) continue;
        P.head.forEach(function (h, j) {
          var v = P.values[i][j];
          if (h && h !== "名前" && String(v).trim() !== "") profile.push({ label: h, value: cellStr_(v) });
        });
        break;
      }
    }
  } catch (e) {}

  var today = todayJst_();
  var keys = {};
  for (var d = 0; d < 14; d++) keys[normDate_(addDays_(today, d))] = 1;
  var shifts = [];
  var S = schedSheet_();
  for (var r = S.hi + 1; r < S.values.length; r++) {
    var info = shiftRowInfo_(S, S.values[r]);
    if (info.name !== name || !keys[info.dateKey]) continue;
    shifts.push({
      row: r + 1, date: keyToDate_(info.dateKey), label: dateLabel_(info.date), time: info.time,
      absent: info.absent, draft: info.draft,
      status: S.c.status >= 0 ? String(S.values[r][S.c.status]).trim() : "",
    });
  }
  shifts.sort(function (a, b) {
    return normDate_(a.date) - normDate_(b.date);
  });

  var tid = resolveTherapistId_(name);
  var mine = readLedger_().filter(function (x) {
    return String(x.therapistName) === name || String(x.therapistId) === String(tid);
  });
  var dayStart = parseJstDateTime(today, "0:00");
  var upcoming = mine
    .filter(function (x) {
      return ACTIVE_STATUSES.indexOf(x.status) >= 0 && x.endAt >= dayStart;
    })
    .sort(function (a, b) {
      return a.startAt - b.startAt;
    })
    .map(function (x) {
      return {
        id: x.id, start: fmtJst(x.startAt), end: fmtJst(x.endAt), course: x.course, price: x.price,
        customerName: x.customerName, status: x.status, statusLabel: STATUS_LABEL[x.status], source: x.source,
      };
    });
  var ym = today.split("/").slice(0, 2).join("/");
  var monthCount = mine.filter(function (x) {
    return x.status === STATUS.CONFIRMED && fmtJst(x.startAt).indexOf(ym.replace(/\/(\d)$/, "/0$1")) === 0;
  }).length;
  return jsonSafe_({
    ok: true, name: name, profile: profile, shifts: shifts, bookings: upcoming,
    counts: { thisMonth: monthCount, upcoming: upcoming.length },
  });
}

/* ===================== プロフィール編集・写真・サイトへの反映 =====================
   ・プロフィールの正本は「本日の出勤」シート（サイトはこのシートを読み込む）。
   ・写真ファイルはサイトのリポジトリ(public/)に置く必要があるため、GitHub API で登録する。
   ・旧来の上書きファイル（data/therapist-details.json・data/photo-overrides.json）の値は
     編集画面に表示し、保存時にシートへ移して上書きファイルから外す（以後はシートが正本）。
   Script Properties:
     GITHUB_TOKEN  … このリポジトリだけに「Contents」「Actions」の読み書き権限を持つトークン
     GITHUB_REPO   … 既定 "naoxxx0320-del/-"   GITHUB_BRANCH … 既定 "main"
     SITE_URL      … 既定 "https://aroma-daiamond.com/"（写真のプレビュー用） */
var PROFILE_FIELDS_ = [
  { key: "表示名", label: "表示名（フルネーム）", hint: "例：白花 かれん（空なら名前を表示）", group: "基本" },
  { key: "年齢", group: "基本" },
  { key: "T", label: "身長（T）", group: "基本" },
  { key: "B", label: "バスト（B）", group: "基本" },
  { key: "カップ", group: "基本" },
  { key: "W", label: "ウエスト（W）", group: "基本" },
  { key: "H", label: "ヒップ（H）", group: "基本" },
  { key: "新人", type: "check", label: "新人（NEWマーク）", group: "基本" },
  { key: "在籍", hint: "「退店」「休業」と入れるとサイトに表示されません（空欄＝在籍）", group: "基本" },
  { key: "タグ", hint: "「;」区切り　例：癒し系;スレンダー;笑顔が素敵", group: "紹介" },
  { key: "プロフィール", type: "textarea", label: "紹介文", group: "紹介" },
  { key: "SNS", hint: "「;」区切り", group: "紹介" },
  { key: "ハート", hint: "pink / diamond", group: "紹介" },
  { key: "ラベル", hint: "ハートの中の文字", group: "紹介" },
  { key: "出勤", hint: "✖️ で本日はお休み（サイトの「本日出勤」に出ません）。空欄・○＝本日出勤", group: "本日の出勤カード" },
  { key: "案内時刻", group: "本日の出勤カード" },
  { key: "出勤リボン", group: "本日の出勤カード" },
  { key: "スケジュール", hint: "例：本日 13:00〜翌2:00", group: "本日の出勤カード" },
  { key: "サブ", hint: "例：ご予約受付中", group: "本日の出勤カード" },
  { key: "ステータス", hint: "例：空きあり", group: "本日の出勤カード" },
];
var DETAILS_PATH_ = "data/therapist-details.json";
var PHOTO_OV_PATH_ = "data/photo-overrides.json";

/* 上書きファイル（therapist-details.json の1人分）→ シートの列の値。consumed は移せた項目。 */
function detailsToSheet_(ov) {
  var v = {},
    used = {};
  ov = ov || {};
  (ov.stats || []).forEach(function (x) {
    var m = String(x).match(/^([TBWH])\.([^()]*)(?:\((.+)\))?$/);
    if (!m) return;
    if (m[2]) v[m[1]] = m[2];
    if (m[1] === "B" && m[3]) v["カップ"] = m[3];
  });
  if (ov.stats) used.stats = 1;
  var map = {
    nameFull: "表示名", age: "年齢", height: "T", cup: "カップ", profile: "プロフィール",
    heart: "ハート", heartLabel: "ラベル", ribbon: "出勤リボン", sched: "スケジュール",
    schedSub: "サブ", status: "ステータス", guideTime: "案内時刻",
  };
  Object.keys(map).forEach(function (k) {
    if (ov[k] == null) return;
    v[map[k]] = String(ov[k]);
    used[k] = 1;
  });
  if (ov.tags) { v["タグ"] = [].concat(ov.tags).join(";"); used.tags = 1; }
  if (ov.sns) { v["SNS"] = [].concat(ov.sns).join(";"); used.sns = 1; }
  if (ov.isNew != null) { v["新人"] = ov.isNew ? "○" : ""; used.isNew = 1; }
  return { values: v, consumed: used };
}

/* ---- GitHub ---- */
function ghToken_() { return cfg_("GITHUB_TOKEN", ""); }
function ghRepo_() { return cfg_("GITHUB_REPO", "naoxxx0320-del/-"); }
function ghBranch_() { return cfg_("GITHUB_BRANCH", "main"); }
function ghRaw_(method, path, body) {
  var tok = ghToken_();
  if (!tok) throw new Error("GitHubの鍵（GITHUB_TOKEN）が設定されていません。");
  var opt = {
    method: method,
    headers: { Authorization: "Bearer " + tok, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    muteHttpExceptions: true,
  };
  if (body) {
    opt.contentType = "application/json";
    opt.payload = JSON.stringify(body);
  }
  var res = UrlFetchApp.fetch("https://api.github.com/repos/" + ghRepo_() + path, opt);
  var txt = res.getContentText();
  var json = null;
  try { json = txt ? JSON.parse(txt) : {}; } catch (e) { json = {}; }
  return { code: res.getResponseCode(), json: json };
}
function gh_(method, path, body) {
  var r = ghRaw_(method, path, body);
  if (r.code >= 300) {
    var why = r.code === 401 ? "GitHubの鍵が無効か、期限切れです"
      : r.code === 403 || r.code === 404 ? "GitHubの鍵に必要な権限がありません（このリポジトリの Contents と Actions の読み書き）"
      : "GitHubでエラーが発生しました";
    throw new Error(why + "（" + r.code + "）");
  }
  return r.json;
}
function encPath_(path) {
  return String(path).split("/").map(encodeURIComponent).join("/");
}
/* リポジトリ内のJSONを読む。鍵があればAPI（最新）、無ければ公開URL。無ければ {}。 */
function readRepoJson_(path) {
  var txt = "";
  if (ghToken_()) {
    var r = ghRaw_("GET", "/contents/" + encPath_(path) + "?ref=" + encodeURIComponent(ghBranch_()));
    if (r.code === 404) return {};
    if (r.code >= 300) gh_("GET", "/contents/" + encPath_(path)); // エラー内容を投げる
    txt = Utilities.newBlob(Utilities.base64Decode(String(r.json.content || "").replace(/\s/g, ""))).getDataAsString("UTF-8");
  } else {
    var res = UrlFetchApp.fetch("https://raw.githubusercontent.com/" + ghRepo_() + "/" + ghBranch_() + "/" + encPath_(path), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return {};
    txt = res.getContentText();
  }
  try { return JSON.parse(txt || "{}") || {}; } catch (e) { return {}; }
}
/* 1回のコミットで複数ファイルを登録（main へ push → サイトが自動で作り直される）。
   files は配列、または最新の内容を読み直して配列を返す関数（同時更新でやり直す場合に備える）。
   要素: {path, content, encoding:"utf-8"|"base64"}。空配列なら何もしない。 */
function ghCommit_(message, files) {
  var br = ghBranch_();
  for (var attempt = 0; attempt < 3; attempt++) {
    var list = typeof files === "function" ? files() : files;
    if (!list || !list.length) return null;
    var baseSha = gh_("GET", "/git/ref/heads/" + encodeURIComponent(br)).object.sha;
    var baseTree = gh_("GET", "/git/commits/" + baseSha).tree.sha;
    var tree = list.map(function (f) {
      var b = gh_("POST", "/git/blobs", { content: f.content, encoding: f.encoding || "utf-8" });
      return { path: f.path, mode: "100644", type: "blob", sha: b.sha };
    });
    var t = gh_("POST", "/git/trees", { base_tree: baseTree, tree: tree });
    var c = gh_("POST", "/git/commits", { message: message, tree: t.sha, parents: [baseSha] });
    var r = ghRaw_("PATCH", "/git/refs/heads/" + encodeURIComponent(br), { sha: c.sha, force: false });
    if (r.code < 300) return c.sha;
    if (r.code !== 422) gh_("PATCH", "/git/refs/heads/" + encodeURIComponent(br), { sha: c.sha, force: false });
  }
  throw new Error("ほかの更新と重なりました。少し待ってからもう一度保存してください。");
}
function ghDispatchDeploy_() {
  gh_("POST", "/actions/workflows/deploy.yml/dispatches", { ref: ghBranch_() });
}
/* シートに書く値：= + @ で始まる文字は数式として解釈されないよう ' を付ける。 */
function safeCell_(v) {
  var s = String(v == null ? "" : v);
  return /^[=+@]/.test(s) ? "'" + s : s;
}

/* 編集画面用：シートの値＋旧上書きファイルの値（あれば優先）＋写真の一覧。 */
function adminProfileGet(name) {
  requireStaff_();
  name = String(name || "").trim();
  var P = profileSheet_();
  if (!P) return { ok: false, reason: "「本日の出勤」シートが見つかりません。" };
  var ni = P.head.indexOf("名前");
  var row = null;
  if (name) {
    for (var i = P.hi + 1; i < P.values.length; i++) {
      if (String(P.values[i][ni]).trim() === name) { row = P.values[i]; break; }
    }
  }
  var values = {};
  P.head.forEach(function (h, j) {
    if (h) values[h] = row ? cellStr_(row[j]) : "";
  });
  var det = {}, pho = null, ovErr = "";
  if (row) {
    try {
      det = readRepoJson_(DETAILS_PATH_)[name] || {};
      pho = readRepoJson_(PHOTO_OV_PATH_)[name];
    } catch (e) {
      ovErr = "旧設定ファイルを読めませんでした（" + e.message + "）。";
    }
  }
  // 新しく追加する人は「本日の出勤」に出ないよう、出勤を ✖️ で始める（サイトは ✖️ 以外を本日出勤と表示）
  if (!row) values["出勤"] = "✖️";
  var mapped = detailsToSheet_(det).values;
  Object.keys(mapped).forEach(function (k) { values[k] = mapped[k]; });
  if (/^(1|true|○|◯|〇|はい|yes|y)$/i.test(String(values["新人"] || "").trim())) values["新人"] = "○";
  var photos = pho != null ? [].concat(pho) : String(values["写真"] || "").split(";");
  photos = photos.map(function (x) { return String(x).trim(); }).filter(Boolean);
  var known = PROFILE_FIELDS_.map(function (f) { return f.key; });
  var fields = PROFILE_FIELDS_.slice();
  P.head.forEach(function (h) {
    if (h && h !== "名前" && h !== "写真" && known.indexOf(h) < 0) fields.push({ key: h, group: "その他" });
  });
  return jsonSafe_({
    ok: true, name: name, exists: !!row, fields: fields, values: values, photos: photos,
    siteUrl: cfg_("SITE_URL", "https://aroma-daiamond.com/"), hasToken: !!ghToken_(),
    migrated: Object.keys(det).length > 0 || pho != null, warning: ovErr,
  });
}

/* 保存：シートに書き込み、旧上書きファイルにあればそこから外し、サイトの作り直しを開始。
   p = {name, isNew, values:{列名:値}, photos:[ファイル名…]} */
function adminProfileSave(p) {
  var staff = requireStaff_();
  p = p || {};
  var name = String(p.name || "").trim();
  if (!name) return { ok: false, reason: "名前を入力してください。" };
  if (/[;\n\r\t]/.test(name) || name.length > 30) return { ok: false, reason: "名前に使えない文字が含まれています。" };
  var vals = p.values || {};
  var photos = p.photos ? [].concat(p.photos).map(function (x) { return String(x).trim(); }).filter(Boolean) : null;
  if (photos && photos.some(function (f) { return !/^[\w.\-]+\.(jpe?g|png|webp)$/i.test(f) && !/^https?:\/\//.test(f); }))
    return { ok: false, reason: "写真のファイル名が不正です。" };

  var needGit = false;
  if (!p.isNew) {
    var det = readRepoJson_(DETAILS_PATH_)[name], pho = readRepoJson_(PHOTO_OV_PATH_)[name];
    needGit = (det && Object.keys(detailsToSheet_(det).consumed).length > 0) || pho != null;
    if (needGit && !ghToken_())
      return { ok: false, reason: "この方の情報は旧設定ファイルにも入っているため、保存にはGitHubの鍵（GITHUB_TOKEN）の設定が必要です。" };
  }
  if (p.isNew && !String(vals["出勤"] || "").trim()) vals["出勤"] = "✖️";
  var allow = PROFILE_FIELDS_.map(function (f) { return f.key; }).concat(["写真"]);
  var res = withLock_(function () {
    var P = profileSheet_();
    if (!P) return { ok: false, reason: "「本日の出勤」シートが見つかりません。" };
    var head = P.head.slice(),
      ni = head.indexOf("名前");
    var rowNum = -1;
    for (var i = P.hi + 1; i < P.values.length; i++) {
      if (String(P.values[i][ni]).trim() === name) { rowNum = i + 1; break; }
    }
    if (rowNum < 0 && !p.isNew) return { ok: false, reason: "名簿に見つかりません。画面を更新してください。" };
    if (rowNum > 0 && p.isNew) return { ok: false, reason: "同じ名前のセラピストがすでにいます。" };
    // 値がある項目で、シートに列が無いもの（表示名・紹介文・写真など）は列を追加
    var addCols = Object.keys(vals).filter(function (k) {
      return allow.indexOf(k) >= 0 && head.indexOf(k) < 0 && String(vals[k] || "").trim() !== "";
    });
    if (photos && photos.length && head.indexOf("写真") < 0) addCols.push("写真");
    addCols.forEach(function (k) {
      head.push(k);
      P.sh.getRange(P.hi + 1, head.length).setValue(k);
    });
    var width = Math.max(head.length, P.sh.getLastColumn());
    var arr;
    if (rowNum > 0) arr = P.sh.getRange(rowNum, 1, 1, width).getValues()[0];
    else { arr = []; for (var w = 0; w < width; w++) arr.push(""); }
    arr[ni] = name;
    Object.keys(vals).forEach(function (k) {
      var j = head.indexOf(k);
      if (j < 0 || k === "名前" || k === "写真") return;
      arr[j] = safeCell_(vals[k]);
    });
    if (photos) arr[head.indexOf("写真")] = photos.join(";");
    if (rowNum > 0) P.sh.getRange(rowNum, 1, 1, width).setValues([arr]);
    else P.sh.appendRow(arr);
    logHistory_("PROFILE", staff, (rowNum > 0 ? "プロフィール更新 " : "セラピスト追加 ") + name, null, null);
    return { ok: true };
  });
  if (!res.ok) return res;

  var deployed = false, note = "";
  try {
    if (needGit) {
      var sha = ghCommit_("管理画面: " + name + " のプロフィールをシートへ移行", function () {
        var d = readRepoJson_(DETAILS_PATH_), q = readRepoJson_(PHOTO_OV_PATH_), files = [];
        if (d[name]) {
          var used = detailsToSheet_(d[name]).consumed, rest = {};
          Object.keys(d[name]).forEach(function (k) { if (!used[k]) rest[k] = d[name][k]; });
          if (Object.keys(rest).length) d[name] = rest; else delete d[name];
          files.push({ path: DETAILS_PATH_, content: JSON.stringify(d, null, 2) + "\n" });
        }
        if (q[name] != null) {
          delete q[name];
          files.push({ path: PHOTO_OV_PATH_, content: JSON.stringify(q, null, 2) + "\n" });
        }
        return files;
      });
      deployed = !!sha; // push でサイトの作り直しが始まる
    }
    if (!deployed && ghToken_()) { ghDispatchDeploy_(); deployed = true; }
  } catch (e) {
    note = "シートには保存しましたが、サイトへの反映の開始に失敗しました（" + e.message + "）。";
  }
  if (!ghToken_()) note = "シートに保存しました。サイトには次の自動更新（数時間おき）で反映されます。すぐ反映するにはGitHubの鍵の設定が必要です。";
  return { ok: true, deployed: deployed, note: note };
}

/* 写真の登録：ブラウザで縮小した画像（dataURL）をサイトのリポジトリ public/ に追加。
   返したファイル名を編集画面の写真一覧に加え、「保存」でシートの写真列に書き込む。 */
function adminPhotoUpload(p) {
  requireStaff_();
  p = p || {};
  if (!ghToken_()) return { ok: false, reason: "写真の登録には、GitHubの鍵（GITHUB_TOKEN）の設定が必要です。" };
  var m = String(p.dataUrl || "").match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+\/=]+)$/);
  if (!m) return { ok: false, reason: "画像の形式が読み取れませんでした（JPEG・PNG・WebPに対応）。" };
  if (m[2].length > 4 * 1024 * 1024) return { ok: false, reason: "画像が大きすぎます。" };
  var file = "therapist-" + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMddHHmmss") + "-" +
    Math.random().toString(36).slice(2, 6) + "." + (m[1] === "jpeg" ? "jpg" : m[1]);
  ghCommit_("管理画面: 写真を追加（" + String(p.name || "").slice(0, 20) + "）", [
    { path: "public/" + file, content: m[2], encoding: "base64" },
  ]);
  return { ok: true, file: file };
}

/* 「今すぐサイトに反映」：サイトの作り直しを開始（出勤やプロフィールをシートから取り込み直す）。 */
function adminDeployNow() {
  requireStaff_();
  if (!ghToken_()) return { ok: false, reason: "すぐに反映するには、GitHubの鍵（GITHUB_TOKEN）の設定が必要です。設定するまでは数時間おきの自動更新で反映されます。" };
  ghDispatchDeploy_();
  return { ok: true };
}
/* 直近のサイト更新の状況（反映中か・完了か）。 */
function adminDeployStatus() {
  requireStaff_();
  if (!ghToken_()) return { ok: false };
  var r = gh_("GET", "/actions/workflows/deploy.yml/runs?per_page=1");
  var run = (r.workflow_runs || [])[0];
  if (!run) return { ok: true, status: "none" };
  return { ok: true, status: run.status, conclusion: run.conclusion, startedAt: run.run_started_at || run.created_at };
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
  var sh = ledgerBook_().getSheetByName(sheetName) || book_().getSheetByName(sheetName);
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

/* ---------- お客様情報を非公開ファイルへ移す（エディタから実行） ----------
   サイトはスプレッドシートを「リンクを知っている全員」に共有して読み込んでいるため、
   同じファイルにある予約台帳などのお客様情報も、ファイルIDを知る人に読めてしまう。
   そこで、お客様情報を含むシートだけを、誰とも共有しない別ファイルへ移す。
   手順1 privateBookStep1_copy  : 新しい非公開ファイルを作ってコピーし、LEDGER_SHEET_ID を設定
   手順2 privateBookStep2_remove: コピーを確認したあと、元ファイルからそのシートを削除 */
var PRIVATE_TABS_ = [LEDGER_SHEET, HISTORY_SHEET, "予約", "LINE予約"];
function privateBookStep1_copy() {
  requireStaff_();
  var src = book_();
  if (cfg_("LEDGER_SHEET_ID", "")) {
    Logger.log("すでに LEDGER_SHEET_ID が設定済みです: " + ledgerBook_().getUrl());
    return;
  }
  var dst = SpreadsheetApp.create("AROMA DAIAMOND 予約台帳（非公開・共有しない）");
  var report = [];
  PRIVATE_TABS_.forEach(function (name) {
    var sh = src.getSheetByName(name);
    if (!sh) return;
    var copy = sh.copyTo(dst);
    copy.setName(name);
    var ok = copy.getLastRow() === sh.getLastRow() && copy.getLastColumn() === sh.getLastColumn();
    report.push(name + ": " + sh.getLastRow() + "行 → コピー" + (ok ? "OK" : "【行数が一致しません】"));
    if (!ok) throw new Error("コピーの行数が一致しません: " + name);
  });
  // 新規作成時の空シート「シート1」を削除
  dst.getSheets().forEach(function (sh) {
    if (PRIVATE_TABS_.indexOf(sh.getName()) < 0 && dst.getSheets().length > 1) dst.deleteSheet(sh);
  });
  props_().setProperty("LEDGER_SHEET_ID", dst.getId());
  report.forEach(function (x) {
    Logger.log(x);
  });
  Logger.log("新しい非公開ファイル: " + dst.getUrl());
  Logger.log("以降、予約台帳・予約履歴はこのファイルに読み書きします。中身を確認したら privateBookStep2_remove を実行してください。");
}
function privateBookStep2_remove() {
  requireStaff_();
  var lid = cfg_("LEDGER_SHEET_ID", "");
  if (!lid || lid === sheetId_()) throw new Error("先に privateBookStep1_copy を実行してください。");
  var src = book_(),
    dst = ledgerBook_();
  PRIVATE_TABS_.forEach(function (name) {
    var a = src.getSheetByName(name),
      b = dst.getSheetByName(name);
    if (!a) return;
    if (!b) throw new Error("非公開ファイルに「" + name + "」がありません。削除を中止しました。");
    // 移動後に元ファイルへ書かれた行（旧システム等）があれば、削除せず止める
    if (a.getLastRow() > b.getLastRow())
      throw new Error("元ファイルの「" + name + "」に、コピー後の追記があります（" + a.getLastRow() + "行 > " + b.getLastRow() + "行）。削除を中止しました。");
    src.deleteSheet(a);
    Logger.log("元ファイルから削除: " + name);
  });
  Logger.log("完了。公開用ファイルには、お客様情報のシートは残っていません。");
}

/* エディタの「実行」から呼ぶための移行ラッパー（引数を渡せないため）。
   migrateDry: 書き込みなしで件数を確認 / migrateRun: バックアップ後に移行（再実行しても重複しない）。 */
function migrateDry() {
  Logger.log(JSON.stringify(migrateFromLegacy({ dryRun: true }), null, 2));
}
function migrateRun() {
  Logger.log(JSON.stringify(migrateFromLegacy({ dryRun: false }), null, 2));
}

/* ブック全体を複製してバックアップ（移行前の安全策）。 */
function backupBook_() {
  var ids = [sheetId_()];
  var lid = cfg_("LEDGER_SHEET_ID", "");
  if (lid && lid !== ids[0]) ids.push(lid);
  var out = ids.map(function (id) {
    var f = DriveApp.getFileById(id);
    var name = f.getName() + " バックアップ " + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd_HHmmss");
    var copy = f.makeCopy(name);
    return { id: copy.getId(), name: name, url: copy.getUrl() };
  });
  return out.length === 1 ? out[0] : out;
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
