/* 予約管理：純ロジックの自動テスト（Node）。
 * lib.gs を単一ソースとして読み込み、GASと同じ関数を検証する。
 *   実行: node apps-script/booking/tests/logic.test.mjs
 * GAS固有API(SpreadsheetApp等)は含まれないため、ここで全ロジックを検証できる。 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "lib.gs"), "utf8");
// lib.gs 末尾の module.exports を使って関数群を取り出す（単一ソース・複製なし）
const mod = { exports: {} };
// eslint-disable-next-line no-new-func
new Function("module", "exports", src)(mod, mod.exports);
const L = mod.exports;

let passed = 0;
function t(name, fn) {
  fn();
  passed++;
  console.log("  ✓ " + name);
}

console.log("予約管理ロジック テスト");

t("parseJstDateTime: 通常時刻をTZ非依存のepochに変換", () => {
  const ms = L.parseJstDateTime("2026/10/5", "14:00");
  assert.equal(ms, Date.UTC(2026, 9, 5, 5, 0)); // 14:00 JST = 05:00 UTC
});

t("parseJstDateTime: 翌表記は+1日として扱う", () => {
  const ms = L.parseJstDateTime("2026/10/5", "翌2:00");
  assert.equal(ms, Date.UTC(2026, 9, 6, -7, 0)); // = 2026/10/5 17:00 UTC
  assert.equal(L.fmtJst(ms), "2026/10/06 02:00");
});

t("parseJstDateTime: 不正入力は null", () => {
  assert.equal(L.parseJstDateTime("", "14:00"), null);
  assert.equal(L.parseJstDateTime("2026/10/5", "あ"), null);
});

t("courseDurationMin: コース名から所要分", () => {
  assert.equal(L.courseDurationMin("90分コース"), 90);
  assert.equal(L.courseDurationMin("延長30分"), 30);
  assert.equal(L.courseDurationMin("150分コース"), 150);
  assert.equal(L.courseDurationMin(""), 60);
});

t("rangesOverlap: 一部重複を検出・端の接触は非重複", () => {
  // 14:00-15:30 と 13:30-15:00 → 一部重複
  const aS = Date.UTC(2026, 9, 5, 5, 0),
    aE = Date.UTC(2026, 9, 5, 6, 30);
  const bS = Date.UTC(2026, 9, 5, 4, 30),
    bE = Date.UTC(2026, 9, 5, 6, 0);
  assert.equal(L.rangesOverlap(aS, aE, bS, bE), true);
  // 端が接するだけ（15:00-16:00 と 14:00-15:00）→ 非重複（連続予約OK）
  assert.equal(
    L.rangesOverlap(
      Date.UTC(2026, 9, 5, 6, 0),
      Date.UTC(2026, 9, 5, 7, 0),
      Date.UTC(2026, 9, 5, 5, 0),
      Date.UTC(2026, 9, 5, 6, 0)
    ),
    false
  );
});

t("withinShift: コース終了が出勤内か", () => {
  const sS = L.parseJstDateTime("2026/10/5", "13:00");
  const sE = L.parseJstDateTime("2026/10/5", "17:00");
  // 16:00開始+120分=18:00 → 出勤(〜17:00)外
  const rS = L.parseJstDateTime("2026/10/5", "16:00");
  const rE = rS + 120 * 60000;
  assert.equal(L.withinShift(rS, rE, sS, sE), false);
  // 15:00開始+120分=17:00 → ちょうど収まる
  const r2 = L.parseJstDateTime("2026/10/5", "15:00");
  assert.equal(L.withinShift(r2, r2 + 120 * 60000, sS, sE), true);
});

t("findConflict: 同一担当者の重複のみ拒否・他は無視", () => {
  const rows = [
    {
      id: "A",
      therapistId: "mio",
      status: "confirmed",
      startAt: L.parseJstDateTime("2026/10/5", "14:00"),
      endAt: L.parseJstDateTime("2026/10/5", "15:30"),
    },
    {
      id: "B",
      therapistId: "mio",
      status: "cancelled", // キャンセルは枠を占有しない
      startAt: L.parseJstDateTime("2026/10/5", "13:00"),
      endAt: L.parseJstDateTime("2026/10/5", "16:00"),
    },
    {
      id: "C",
      therapistId: "karen", // 別担当者
      status: "confirmed",
      startAt: L.parseJstDateTime("2026/10/5", "14:00"),
      endAt: L.parseJstDateTime("2026/10/5", "15:00"),
    },
  ];
  // mio 13:30-15:00 は A と一部重複
  const s = L.parseJstDateTime("2026/10/5", "13:30");
  const e = L.parseJstDateTime("2026/10/5", "15:00");
  assert.equal(L.findConflict(rows, "mio", s, e)?.id, "A");
  // karen は 15:00-16:00 なら重複なし
  assert.equal(
    L.findConflict(
      rows,
      "karen",
      L.parseJstDateTime("2026/10/5", "15:00"),
      L.parseJstDateTime("2026/10/5", "16:00")
    ),
    null
  );
  // excludeId で自分自身を除外（変更時の自己重複回避）
  assert.equal(
    L.findConflict(
      rows,
      "mio",
      L.parseJstDateTime("2026/10/5", "14:00"),
      L.parseJstDateTime("2026/10/5", "15:30"),
      "A"
    ),
    null
  );
});

t("日またぎ（深夜）予約の重複を正しく検出", () => {
  const rows = [
    {
      id: "N1",
      therapistId: "mio",
      status: "confirmed",
      startAt: L.parseJstDateTime("2026/10/5", "翌0:00"),
      endAt: L.parseJstDateTime("2026/10/5", "翌1:00"),
    },
  ];
  // 23:30開始60分 → 翌0:30終了。N1(翌0:00-翌1:00)と重複
  const s = L.parseJstDateTime("2026/10/5", "23:30");
  const e = s + 60 * 60000;
  assert.equal(L.findConflict(rows, "mio", s, e)?.id, "N1");
});

t("makeIdempotencyKey: 同入力は同一・指定キー優先", () => {
  const p = {
    source: "WEB",
    therapistId: "mio",
    startMs: 123,
    tel: "090-1111-2222",
    course: "90分コース",
  };
  assert.equal(L.makeIdempotencyKey(p), L.makeIdempotencyKey({ ...p }));
  assert.equal(L.makeIdempotencyKey({ idempotencyKey: "X", ...p }), "X");
  // 連絡先は小文字化して一致
  assert.equal(
    L.makeIdempotencyKey({ ...p, tel: undefined, email: "A@B.COM" }),
    L.makeIdempotencyKey({ ...p, tel: undefined, email: "a@b.com" })
  );
});

t("isTentativeExpired / canTransition", () => {
  const now = 1000;
  assert.equal(
    L.isTentativeExpired({ status: "tentative", tentativeExpireAt: 900 }, now),
    true
  );
  assert.equal(
    L.isTentativeExpired({ status: "tentative", tentativeExpireAt: 1100 }, now),
    false
  );
  assert.equal(
    L.isTentativeExpired({ status: "confirmed", tentativeExpireAt: 900 }, now),
    false
  );
  assert.equal(L.canTransition("tentative", "confirmed"), true);
  assert.equal(L.canTransition("confirmed", "cancelled"), true);
  assert.equal(L.canTransition("cancelled", "confirmed"), false); // 不正遷移
  assert.equal(L.canTransition("expired", "confirmed"), false); // 期限切れは確定不可
});

t("二重送信（同一冪等キー）は同じキーになる＝重複作成を防げる", () => {
  const p = { source: "LINE", therapistId: "mio", startMs: 555, lineUserId: "U999", course: "60分コース" };
  const k1 = L.makeIdempotencyKey(p);
  const k2 = L.makeIdempotencyKey({ ...p }); // Webhook再送を想定
  assert.equal(k1, k2);
});

t("minutesFromDate: 翌日の深夜は1440超", () => {
  assert.equal(L.minutesFromDate(L.parseJstDateTime("2026/10/5", "14:00"), "2026/10/5"), 840);
  assert.equal(L.minutesFromDate(L.parseJstDateTime("2026/10/5", "翌2:00"), "2026/10/5"), 1560);
  assert.equal(L.minutesFromDate(L.parseJstDateTime("2026/10/5", "0:00"), "2026/10/5"), 0);
});

t("gridPlacement: 開始行index・行span（10:00開始/30分刻み）", () => {
  const open = 600,
    step = 30,
    rows = 38; // 10:00〜翌5:00
  // 14:00-15:30 → start=(840-600)/30=8行目、span=3
  let g = L.gridPlacement(840, 930, open, step, rows);
  assert.deepEqual(g, { startIdx: 8, span: 3 });
  // 翌2:00-翌3:00（1560-1620）→ start=(1560-600)/30=32、span=2
  g = L.gridPlacement(1560, 1620, open, step, rows);
  assert.deepEqual(g, { startIdx: 32, span: 2 });
  // 営業前に終わる/営業後に始まる → null
  assert.equal(L.gridPlacement(300, 540, open, step, rows), null); // 5:00-9:00
  assert.equal(L.gridPlacement(1800, 1860, open, step, rows), null); // 30:00-
  // 枠をまたぐ場合はクランプ（9:30-11:00 → 0行目から）
  g = L.gridPlacement(570, 660, open, step, rows);
  assert.equal(g.startIdx, 0);
  assert.ok(g.span >= 1);
});

t("calcSettle: コース＋延長に率、指名料・オプションは全額、割引はお店負担", () => {
  const r = L.calcSettle({ coursePrice: 18000, extendCount: 1, extendPrice: 6000, nomFee: 1000, optionFee: 3000, discount: 2000, rate: 50 });
  assert.equal(r.courseSales, 24000);
  assert.equal(r.total, 24000 + 1000 + 3000 - 2000);
  assert.equal(r.back, 12000 + 1000 + 3000);
  assert.equal(r.shop, r.total - r.back);
  assert.equal(r.shop, 12000 - 2000);
});

t("calcSettle: 文字の金額・端数の四捨五入・不正な率は0%", () => {
  const r = L.calcSettle({ coursePrice: "¥13,000", rate: 45.5 });
  assert.equal(r.courseSales, 13000);
  assert.equal(r.back, Math.round(13000 * 0.455));
  assert.equal(L.calcSettle({ coursePrice: 13000, rate: 150 }).back, 0);
  assert.equal(L.calcSettle({ coursePrice: 13000, discount: -500, rate: 50 }).discount, 0);
});

t("bizDateOf: 翌2:00開始は前日の営業日・14:00は当日", () => {
  assert.equal(L.bizDateOf(L.parseJstDateTime("2026/10/5", "翌2:00")), "2026/10/5");
  assert.equal(L.bizDateOf(L.parseJstDateTime("2026/10/5", "14:00")), "2026/10/5");
  assert.equal(L.bizDateOf(L.parseJstDateTime("2026/10/6", "6:00")), "2026/10/6");
});

t("版：Code.gs・lib.gs・Admin.html の版が一致（貼り替え漏れ検出の基準）", () => {
  const code = readFileSync(join(here, "..", "Code.gs"), "utf8");
  const html = readFileSync(join(here, "..", "Admin.html"), "utf8");
  const v = (re, s) => (s.match(re) || [])[1];
  const lib = v(/var LIB_VERSION = "([^"]+)"/, src);
  assert.ok(lib);
  assert.equal(v(/var CODE_VERSION = "([^"]+)"/, code), lib);
  assert.equal(v(/var APP_VERSION = "([^"]+)"/, html), lib);
  // 途中で切れたコピーを検出できるよう、adminVersion は Code.gs の最後に置く
  const tail = code.trimEnd();
  assert.ok(tail.lastIndexOf("function adminVersion()") > tail.length - 300, "adminVersion が最後にない");
  assert.ok(tail.endsWith("}"));
});

console.log(`\n✅ 全 ${passed} 件 パス`);
