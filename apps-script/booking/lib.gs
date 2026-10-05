/* =============================================================================
 * 予約管理システム：純ロジック（Google Apps Script と Node テストで共有）
 * -----------------------------------------------------------------------------
 * このファイルは GAS 固有API（SpreadsheetApp 等）を一切使いません。
 *  ・GAS では他の .gs と連結され、グローバル関数として使えます。
 *  ・Node テスト（tests/logic.test.mjs）では本ファイルを文字列として読み込み、
 *    同じ関数を検証します（＝ロジックの単一ソース・両環境で同一挙動）。
 * 時刻はすべて「JST壁時計 → UTC epoch(ms)」に正規化して比較します。
 * サーバやブラウザのタイムゾーンに依存しません（JST = UTC+9 を直接計算）。
 * ========================================================================== */

var STATUS = {
  TENTATIVE: "tentative", // 仮予約
  CONFIRMED: "confirmed", // 確定
  CANCELLED: "cancelled", // キャンセル（削除せず履歴として残す）
  EXPIRED: "expired", // 期限切れ（仮予約の確認期限超過）
};
var STATUS_LABEL = {
  tentative: "仮予約",
  confirmed: "確定",
  cancelled: "キャンセル",
  expired: "期限切れ",
};
var SOURCE = { WEB: "WEB", LINE: "LINE", PHONE: "電話" };

// 枠を占有する（重複・空き状況の対象になる）状態
var ACTIVE_STATUSES = [STATUS.TENTATIVE, STATUS.CONFIRMED];

/* "2026/10/5"（または 2026/10/05）+ "14:00" / "翌2:00" → JST壁時計の epoch(ms)。
   翌日表記（翌2:00）は +1日。JSTはUTC+9なので UTC では hh-9 で計算する。 */
function parseJstDateTime(dateStr, timeLabel) {
  var dm = String(dateStr || "").match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  var tm = String(timeLabel || "").match(/(翌)?\s*(\d{1,2}):(\d{2})/);
  if (!dm || !tm) return null;
  var y = +dm[1],
    mo = +dm[2],
    d = +dm[3];
  var next = tm[1] ? 1 : 0,
    hh = +tm[2],
    mm = +tm[3];
  return Date.UTC(y, mo - 1, d + next, hh - 9, mm, 0, 0);
}

/* epoch(ms) → JST表示文字列 "YYYY/MM/DD HH:mm"（純粋計算・TZ非依存）。 */
function fmtJst(ms) {
  if (ms == null) return "";
  var d = new Date(ms + 9 * 3600 * 1000); // UTC基準のDateをJST壁時計に平行移動
  var p = function (n) {
    return String(n).padStart(2, "0");
  };
  return (
    d.getUTCFullYear() +
    "/" +
    p(d.getUTCMonth() + 1) +
    "/" +
    p(d.getUTCDate()) +
    " " +
    p(d.getUTCHours()) +
    ":" +
    p(d.getUTCMinutes())
  );
}

/* コース名 → 所要分（"90分コース"→90 / "延長30分"→30）。既定60。 */
function courseDurationMin(courseLabel) {
  var m = String(courseLabel || "").match(/(\d+)\s*分/);
  return m ? +m[1] : 60;
}

/* 区間[aS,aE)と[bS,bE)が重なるか（端が接するだけは重ならない＝連続予約OK）。 */
function rangesOverlap(aS, aE, bS, bE) {
  return aS < bE && bS < aE;
}

/* 予約[start,end]が出勤[shiftStart,shiftEnd]に収まるか。 */
function withinShift(start, end, shiftStart, shiftEnd) {
  return start >= shiftStart && end <= shiftEnd;
}

/* 冪等キー：同一リクエストの再送・LINE Webhook 再送での二重作成を防ぐ。
   呼び出し側が idempotencyKey を渡せばそれを優先。無ければ決定的に合成する
   （ハッシュを使わず文字列連結＝GAS/Nodeで完全一致）。 */
function makeIdempotencyKey(p) {
  if (p && p.idempotencyKey) return String(p.idempotencyKey);
  var contact = (p.lineUserId || p.email || p.tel || "").toString().toLowerCase();
  return [
    p.source || "",
    p.therapistId || p.therapistName || "",
    p.startMs || "",
    contact,
    p.course || "",
  ].join("|");
}

/* 仮予約が確認期限を過ぎているか。 */
function isTentativeExpired(row, nowMs) {
  return (
    row.status === STATUS.TENTATIVE &&
    row.tentativeExpireAt &&
    nowMs > Number(row.tentativeExpireAt)
  );
}

/* 状態遷移の妥当性（不正な遷移を拒否）。 */
function canTransition(from, to) {
  var allowed = {
    tentative: [STATUS.CONFIRMED, STATUS.CANCELLED, STATUS.EXPIRED],
    confirmed: [STATUS.CANCELLED],
    cancelled: [],
    expired: [],
  };
  return (allowed[from] || []).indexOf(to) >= 0;
}

/* 新規予約が既存予約群と重なるか（同一担当者・占有状態のみ対象）。
   rows: [{therapistId,status,startAt,endAt,id}]  戻り値: 競合行 or null。
   excludeId を渡すと自分自身を除外（変更時の自己重複回避）。 */
function findConflict(rows, therapistId, startMs, endMs, excludeId) {
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (excludeId && String(r.id) === String(excludeId)) continue;
    if (String(r.therapistId) !== String(therapistId)) continue;
    if (ACTIVE_STATUSES.indexOf(r.status) < 0) continue;
    if (rangesOverlap(startMs, endMs, Number(r.startAt), Number(r.endAt))) return r;
  }
  return null;
}

/* ---- 管理タイムテーブル（担当者×時間グリッド）用の純ロジック ---- */

/* epoch(ms) を「その日(dateStr)の0:00からの経過分」に変換（JST）。
   翌日の深夜（翌2:00）は 24:00=1440 を超える値になる（例 翌2:00→1560）。 */
function minutesFromDate(epochMs, dateStr) {
  var base = parseJstDateTime(dateStr, "0:00");
  if (base == null || epochMs == null) return null;
  return Math.round((epochMs - base) / 60000);
}

/* 予約[startMin,endMin]（その日0:00基準の分）を、開始行index・行spanに変換。
   openMin: グリッド開始分（例 10:00=600）/ stepMin: 1行の分（例 30）/ rowCount: 行数。
   枠外ははみ出さないようクランプする。戻り値 {startIdx, span} / 範囲外は null。 */
function gridPlacement(startMin, endMin, openMin, stepMin, rowCount) {
  if (startMin == null || endMin == null) return null;
  if (endMin <= openMin) return null; // 開始前に終わる
  var closeMin = openMin + rowCount * stepMin;
  if (startMin >= closeMin) return null; // 営業後に始まる
  var startIdx = Math.floor((Math.max(startMin, openMin) - openMin) / stepMin);
  var endIdx = Math.ceil((Math.min(endMin, closeMin) - openMin) / stepMin);
  startIdx = Math.max(0, Math.min(startIdx, rowCount - 1));
  endIdx = Math.max(startIdx + 1, Math.min(endIdx, rowCount));
  return { startIdx: startIdx, span: endIdx - startIdx };
}

// Node テスト用のエクスポート（GASでは typeof module === 'undefined' で無視される）
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    STATUS,
    STATUS_LABEL,
    SOURCE,
    ACTIVE_STATUSES,
    parseJstDateTime,
    fmtJst,
    courseDurationMin,
    rangesOverlap,
    withinShift,
    makeIdempotencyKey,
    isTentativeExpired,
    canTransition,
    findConflict,
    minutesFromDate,
    gridPlacement,
  };
}
