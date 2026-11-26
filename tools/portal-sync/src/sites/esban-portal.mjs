// エステ番長 店舗管理画面の出勤を操作する部分（Playwright）
// 表：https://es-ban.com/admin/content_manage/therapist_schedule （table。1列目が名前、続く7列が日付。未登録のセルは「未登録」と登録リンク）
// 登録：/admin/therapist_schedule/add?date=YYYY-MM-DD&t=ID の select[name=work_start] / [name=work_end]（値 "t1000" など）、[保存]。
// 時間の変更：表のセルの「編集」リンク /admin/therapist_schedule/<番号>（題名「YYYY-MM-DD:<ID> を編集」）で同じ欄を選び直して[保存]。
//   30分ごとの受付状況（◯✕）は、サイトに空き状況の情報がないため触らない（初期値のまま）。
// 守ること：隠し項目の値は読まない／入力欄が見つからないときは推測で書かず止める／出勤以外は触らない
import { toValue, fromShown } from "./esban.mjs";

export const TABLE = "https://es-ban.com/admin/content_manage/therapist_schedule";
const pause = (page, ms) => page.waitForTimeout(ms + Math.floor(Math.random() * 400));

async function openTable(page) {
  await page.goto(TABLE, { waitUntil: "domcontentloaded" });
  await pause(page, 1800);
  if (/\/user\/login/.test(page.url())) throw new Error("エステ番長にログインしていません。作業用ブラウザでログインしてから、もう一度実行してください");
  if (!(await page.locator("table tbody tr").count())) throw new Error("エステ番長の出勤表の形が想定と違います。書き込まずに止めました");
}

/** 今の出勤を読む（読むだけ） */
export async function readCurrent(page, todayIso) {
  await openTable(page);
  const raw = await page.evaluate(() => {
    const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
    const tbl = document.querySelector("table");
    const heads = [...tbl.querySelectorAll("thead th")].map(t);
    return { heads, rows: [...tbl.querySelectorAll("tbody tr")].map((tr) => ({
      cells: [...tr.children].map((td) => ({ text: t(td), links: [...td.querySelectorAll("a")].map((a) => a.getAttribute("href") || "") })),
    })) };
  });
  const y = +todayIso.slice(0, 4);
  const dates = raw.heads.slice(1, 8).map((h) => {
    const m = h.match(/(\d{1,2})\/(\d{1,2})/);
    if (!m) return null;
    const mo = +m[1], yy = mo === 1 && todayIso.slice(5, 7) === "12" ? y + 1 : y;
    return `${yy}-${String(mo).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  });
  if (dates.length !== 7 || dates.some((d) => !d)) throw new Error("エステ番長の出勤表の日付を読めませんでした。書き込まずに止めました");
  const people = raw.rows.map((r) => {
    const name = r.cells[0].text;
    let id = "";
    const cells = r.cells.slice(1, 8).map((c, i) => {
      const add = c.links.find((l) => /therapist_schedule\/add/.test(l));
      const m = add && add.match(/[?&]t=(\d+)/);
      if (m) id = m[1];
      const times = c.text.match(/\d{1,2}:\d{2}/g) || [];
      const unregistered = /未登録/.test(c.text);
      const off = /お休み/.test(c.text);
      const work = !unregistered && !off && times.length >= 2;
      return { idx: i, date: dates[i], work, start: work ? fromShown(times[0]) : "", end: work ? fromShown(times[1]) : "", editLink: c.links.find((l) => !/therapist_schedule\/add/.test(l)) || "", unknown: !unregistered && !off && times.length < 2 };
    });
    return { id, name, cells };
  });
  if (people.some((p) => !p.id && p.cells.every((c) => !c.editLink))) throw new Error("エステ番長のセラピストの番号を読めませんでした。書き込まずに止めました");
  return { dates, people };
}

/** 変更を1件ずつ登録し、表を読み直して確かめる（「出勤を入れる」「時間を変える」に対応。取り消しは未対応） */
export async function applyChanges(page, changes, todayIso, log = () => {}) {
  for (const c of changes) {
    if (c.type !== "add" && c.type !== "change") throw new Error(`エステ番長の「出勤の取り消し」はまだ対応していません（${c.date} ${c.name}）。何も書き込まずに止めました`);
  }
  // 時間を変えるときは、表のセルの「編集」リンク（/admin/therapist_schedule/<番号>）を開く
  const edit = new Map();
  if (changes.some((c) => c.type === "change")) {
    const now = await readCurrent(page, todayIso);
    for (const p of now.people) for (const cell of p.cells) if (cell.editLink) edit.set(`${p.name}|${cell.date}`, cell.editLink);
  }
  for (const c of changes) {
    if (c.type === "change") {
      const link = edit.get(`${c.name}|${c.date}`);
      if (!link || !/^\/admin\/therapist_schedule\/\d+$/.test(link)) throw new Error(`編集のリンクが見つかりません（${c.date} ${c.name}）。保存せずに止めました`);
      await page.goto(`https://es-ban.com${link}`, { waitUntil: "domcontentloaded" });
      await pause(page, 1500);
      const title = await page.title();
      if (!title.includes(`${c.date}:${c.id}`)) throw new Error(`編集画面が ${c.date} ${c.name} のものではありません（${title}）。保存せずに止めました`);
    } else {
      await page.goto(`https://es-ban.com/admin/therapist_schedule/add?date=${c.date}&t=${c.id}`, { waitUntil: "domcontentloaded" });
      await pause(page, 1500);
    }
    const s = page.locator("select[name=work_start]"), e = page.locator("select[name=work_end]");
    if ((await s.count()) !== 1 || (await e.count()) !== 1) throw new Error(`入力欄が見つかりません（${c.date} ${c.name}）。保存せずに止めました`);
    const sv = toValue(c.want.start), ev = toValue(c.want.end);
    const opts = await s.evaluate((el) => [...el.options].map((o) => o.value));
    const opte = await e.evaluate((el) => [...el.options].map((o) => o.value));
    if (!opts.includes(sv) || !opte.includes(ev)) throw new Error(`選べない時間です（${c.date} ${c.name} ${c.want.start}-${c.want.end}）。保存せずに止めました`);
    await s.selectOption(sv); await pause(page, 300);
    await e.selectOption(ev); await pause(page, 300);
    const btn = page.locator("input[type=submit][value='保存']").first();
    if ((await btn.count()) !== 1) throw new Error(`保存ボタンが見つかりません（${c.date} ${c.name}）。保存せずに止めました`);
    log(`入力・保存：${c.date} ${c.name} ${c.before} → ${c.after}`);
    await Promise.all([page.waitForLoadState("domcontentloaded"), btn.click()]);
    await pause(page, 2000);
  }
  const after = await readCurrent(page, todayIso);
  const results = changes.map((c) => {
    const p = after.people.find((x) => x.name === c.name);
    const cell = p && p.cells.find((x) => x.date === c.date);
    const ok = !!cell && cell.work === c.want.work && (!c.want.work || (cell.start === c.want.start && cell.end === c.want.end));
    return { no: c.no, date: c.date, name: c.name, after: c.after, ok, now: !cell ? "読めない" : cell.work ? `${cell.start}-${cell.end}` : cell.unknown ? "読み取れない表示" : "出勤なし" };
  });
  return { saved: true, results };
}
