// エステラブ 店舗管理画面の出勤を操作する部分（Playwright）
// 表：https://eslove.jp/admin/shop/therapist_schedule/weekly?day=<ずらす日数>（form#indexForm の table。行＝セラピスト、列＝7日）
//   セル td.js-popupOpen[data-id=<セラピストID>][data-date=YYYYMMDD]。登録済みのセルは data-deleteurl が入る。
//   セルの中の .start / .end に出勤・退勤（"1200" / "2700" の形）。表示は .js-dataBox（「出勤」「12:00～翌3:00」）。
// 入れ方：セルを押す → 小窓 .sch-popup の select[name=start_time] / [name=end_time] → 「決定する」(.js-deside)
//   → 表の上の「保存する」(#js-allSend。「…の週の出勤情報を保存します。よろしいですか？」の確認が出る)。
// 守ること：
//  ・いまは「出勤を入れる」だけに対応。登録済みの出勤の変更・解除は止まって知らせる
//    （解除は受付（予約）と結びつくことがあるため。必要になったら、確かめてから追加する）。
//  ・確認画面は「出勤情報を保存します」だけ承認し、それ以外は断って止める。
//  ・入力欄が見つからないときは推測で書かず止める／出勤以外は触らない（同じ画面の受付・顧客の登録には触らない）。
import { toValue, fromValue, jstDate, dayOffset } from "./eslove.mjs";

export const BASE = "https://eslove.jp/admin/shop/therapist_schedule/weekly";
const pause = (page, ms) => page.waitForTimeout(ms + Math.floor(Math.random() * 400));
const compact = (iso) => iso.replace(/-/g, "");
const iso = (ymd) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

async function openWeek(page, todayIso) {
  const off = dayOffset(todayIso, jstDate());
  await page.goto(`${BASE}?day=${off}&week=0`, { waitUntil: "load" });
  await pause(page, 2000);
  if (/\/admin\/login/.test(page.url())) throw new Error("エステラブにログインしていません。作業用ブラウザでログインしてから、もう一度実行してください");
  if (!(await page.locator("#indexForm table tbody td.js-popupOpen").count())) throw new Error("エステラブの出勤表の形が想定と違います。書き込まずに止めました");
}

async function readTable(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("#indexForm table tbody tr")].map((tr) => ({
      // 名前は .nameWrap のリンクだけ（出勤があると同じ欄に「LINEで送る」などのリンクが増える）
      name: (tr.querySelector("th .nameWrap a") || tr.querySelector("th .nameWrap") || {}).textContent?.replace(/\s+/g, " ").trim() || "",
      cells: [...tr.querySelectorAll("td.js-popupOpen")].map((td) => ({
        id: td.getAttribute("data-id") || "",
        ymd: td.getAttribute("data-date") || "",
        registered: !!td.getAttribute("data-deleteurl"),
        start: (td.querySelector("input.start") || {}).value || "",
        end: (td.querySelector("input.end") || {}).value || "",
        shown: (td.querySelector(".js-dataBox") || {}).textContent?.replace(/\s+/g, " ").trim() || "",
      })),
    }))
  );
}

/** 今の出勤を読む（読むだけ） */
export async function readCurrent(page, todayIso) {
  await openWeek(page, todayIso);
  const rows = await readTable(page);
  const dates = (rows[0] ? rows[0].cells : []).map((c) => (/^\d{8}$/.test(c.ymd) ? iso(c.ymd) : null));
  if (dates.length !== 7 || dates.some((d) => !d)) throw new Error("エステラブの出勤表の日付を読めませんでした。書き込まずに止めました");
  if (dates[0] !== todayIso) throw new Error(`エステラブの出勤表が ${dates[0]} から始まっています（今日は ${todayIso}）。書き込まずに止めました`);
  const people = rows.map((r) => {
    const id = r.cells[0] ? r.cells[0].id : "";
    const cells = r.cells.map((c, i) => {
      const st = fromValue(c.start), en = fromValue(c.end);
      const work = c.registered && !!st && !!en;
      return { idx: i, date: iso(c.ymd), work, start: work ? st : "", end: work ? en : "", unknown: c.registered && !work, shown: c.shown };
    });
    return { id, name: r.name, cells };
  });
  if (!people.length || people.some((p) => !p.name || !p.id || p.cells.length !== 7 || p.cells.some((c, i) => c.date !== dates[i]))) {
    throw new Error("エステラブの出勤表を読み取れませんでした（画面の形が想定と違います）。書き込まずに止めました");
  }
  return { dates, people };
}

/** 出勤を入れて保存し、読み直して確かめる（いまは「出勤を入れる」だけに対応） */
export async function applyChanges(page, changes, todayIso, log = () => {}) {
  if (!changes.length) return { saved: false, results: [] };
  for (const c of changes) {
    if (c.type !== "add") throw new Error(`エステラブの「時間の変更・取り消し」はまだ対応していません（${c.date} ${c.name}）。何も書き込まずに止めました`);
  }
  await openWeek(page, todayIso);
  const dialogs = [];
  const onDialog = async (d) => {
    dialogs.push(d.message());
    try { if (/出勤情報を保存します/.test(d.message())) await d.accept(); else await d.dismiss(); }
    catch { dialogs.push("（確認画面に答えられませんでした）"); }
  };
  page.on("dialog", onDialog);
  try {
    for (const c of changes) {
      const cell = page.locator(`#indexForm td.js-popupOpen[data-id="${c.id}"][data-date="${compact(c.date)}"]`);
      if ((await cell.count()) !== 1) throw new Error(`入力するセルが見つかりません（${c.date} ${c.name}）。保存せずに止めました`);
      if (await cell.getAttribute("data-deleteurl")) throw new Error(`すでに出勤が登録されています（${c.date} ${c.name}）。保存せずに止めました`);
      await cell.click();
      const pop = page.locator(".sch-popup");
      // 小窓の中身は後から読み込まれる。前の小窓の欄に入力しないよう、この人・この日の中身になるまで待つ
      const body = pop.locator(`.sch-popup__content:has(input[name=therapist_id][value="${c.id}"]):has(input[name=day][value="${compact(c.date)}"])`);
      await body.waitFor({ state: "attached", timeout: 15000 });
      const s = body.locator("select[name=start_time]"), e = body.locator("select[name=end_time]");
      await s.waitFor({ state: "visible", timeout: 15000 });
      await pause(page, 600);
      const who = ((await pop.locator(".sch-popup__name").textContent()) || "").trim();
      if (who !== c.name) throw new Error(`小窓の名前が「${who}」です（${c.name} ではない）。保存せずに止めました`);
      const sv = toValue(c.want.start), ev = toValue(c.want.end);
      const opts = await s.evaluate((el) => [...el.options].map((o) => o.value));
      const opte = await e.evaluate((el) => [...el.options].map((o) => o.value));
      if (!opts.includes(sv) || !opte.includes(ev)) throw new Error(`エステラブで選べない時間です（${c.date} ${c.name} ${c.want.start}-${c.want.end}）。保存せずに止めました`);
      await s.selectOption(sv); await pause(page, 300);
      await e.selectOption(ev); await pause(page, 300);
      const decide = pop.locator(".js-deside");
      if (!(await decide.isVisible())) throw new Error(`「決定する」が見つかりません（${c.date} ${c.name}）。保存せずに止めました`);
      await decide.click();
      await pause(page, 800);
      const err = ((await pop.locator(".error").first().textContent().catch(() => "")) || "").trim();
      if (err) throw new Error(`入力でエラー（${c.date} ${c.name}）：${err}。保存せずに止めました`);
      if ((await cell.locator("input.start").inputValue()) !== sv) throw new Error(`表に反映されません（${c.date} ${c.name}）。保存せずに止めました`);
      log(`入力：${c.date} ${c.name} ${c.after}`);
    }
    const btn = page.locator("#js-allSend");
    if ((await btn.count()) !== 1) throw new Error("保存ボタンが見つかりません。保存せずに止めました");
    log("保存ボタンを押します");
    const posted = page.waitForResponse((r) => r.request().method() === "POST" && /\/therapist_schedule\/weekly(\?|$)/.test(r.url()), { timeout: 30000 }).catch(() => null);
    await btn.click();
    const res = await posted;
    await pause(page, 2500);
    if (dialogs.includes("（確認画面に答えられませんでした）")) throw new Error("保存の確認画面に答えられませんでした（別のところで閉じられた可能性）。保存されていない可能性があります。もう一度 diff で確かめてください");
    const bad = dialogs.filter((m) => !/出勤情報を保存します/.test(m));
    if (bad.length) throw new Error(`想定外の確認が出たため断りました：${bad.join(" / ")}`);
    if (!res) throw new Error("保存の応答がありませんでした。エステラブの画面で確認してください");
  } finally {
    page.off("dialog", onDialog);
  }
  const after = await readCurrent(page, todayIso);
  const results = changes.map((c) => {
    const p = after.people.find((x) => x.id === c.id);
    const cell = p && p.cells.find((x) => x.date === c.date);
    const ok = !!cell && cell.work === c.want.work && (!c.want.work || (cell.start === c.want.start && cell.end === c.want.end));
    return { no: c.no, date: c.date, name: c.name, after: c.after, ok, now: !cell ? "読めない" : cell.work ? `${cell.start}-${cell.end}` : cell.unknown ? "読み取れない表示" : "出勤なし" };
  });
  return { saved: true, results };
}
