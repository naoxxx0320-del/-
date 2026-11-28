// リラクシィの出勤管理を読む・書く（Playwright）。作業用ブラウザはリラクシィに店舗アカウントでログインしている前提。
// 守ること：選ぶのは表の「状態」「出勤時間」「退勤時間」だけ（選ぶとその場で保存される）。書いたあとは読み直して確かめる。
import { toMin, fromMin } from "./rx.mjs";

const URL = "https://rx-sns.jp/u/aromadiamond/shifts";
const pause = (page, ms) => page.waitForTimeout(ms + Math.floor(Math.random() * 400));

async function open(page, week = 0) {
  await page.goto(URL, { waitUntil: "load" }); await pause(page, 3000);
  if (/\/login/.test(page.url())) throw new Error("リラクシィにログインしていません");
  if ((await page.locator("select[aria-label$='のステータス']").count()) < 1) throw new Error("リラクシィの出勤管理の表が見つかりません（店舗アカウントでログインしているか確かめてください）");
  if (week === 1) {
    const next = page.locator("button[aria-label='次の週']");
    if ((await next.count()) !== 1) throw new Error("「来週」が見つかりません");
    await next.click(); await pause(page, 2500);
  }
}
async function readWeek(page) {
  return page.evaluate(() => [...document.querySelectorAll("select[aria-label$='のステータス']")].map((s) => {
    const m = s.getAttribute("aria-label").match(/^(.+) (\d{4}-\d{2}-\d{2})のステータス$/);
    const td = s.closest("td");
    const st = td.querySelector("select[aria-label='出勤時間']"), en = td.querySelector("select[aria-label='退勤時間']");
    return m ? { name: m[1], date: m[2], status: s.value, start: st ? st.value : "", end: en ? en.value : "" } : null;
  }).filter(Boolean));
}

/** 今の出勤：{ dates, people:[{ id, name, cells:[{ idx, date, work, start, end, unset, off, week }] }] } */
export async function readCurrent(page) {
  const all = [];
  for (const week of [0, 1]) { await open(page, week); for (const c of await readWeek(page)) all.push({ ...c, week }); }
  const people = new Map();
  for (const c of all) {
    if (!people.has(c.name)) people.set(c.name, { id: c.name, name: c.name, cells: [] });
    const work = c.status === "working";
    people.get(c.name).cells.push({ idx: c.date, date: c.date, week: c.week, work, start: work ? fromMin(c.start) : "", end: work ? fromMin(c.end) : "", unset: c.status === "unset", off: c.status === "off" });
  }
  const dates = [...new Set(all.map((c) => c.date))].sort();
  return { dates, people: [...people.values()] };
}

async function setOne(page, c) {
  const status = page.locator(`select[aria-label='${c.name} ${c.date}のステータス']`);
  if ((await status.count()) !== 1) throw new Error(`${c.name} ${c.date} の欄が見つかりません`);
  const td = status.locator("xpath=ancestor::td[1]");
  if (c.type === "rest") { await status.selectOption("off"); await pause(page, 1800); return; }
  if ((await status.inputValue()) !== "working") { await status.selectOption("working"); await pause(page, 2000); }
  const s = String(toMin(c.want.start)), e = String(toMin(c.want.end));
  const st = td.locator("select[aria-label='出勤時間']"), en = td.locator("select[aria-label='退勤時間']");
  if ((await st.count()) !== 1 || (await en.count()) !== 1) throw new Error(`${c.name} ${c.date} の時間の欄が見つかりません`);
  // 退勤を先に広げてから出勤を動かす（退勤より後の出勤は選べないため）
  const curStart = Number(await st.inputValue());
  if (Number(e) > curStart) { await en.selectOption(e); await pause(page, 1500); await st.selectOption(s); await pause(page, 1500); }
  else { await st.selectOption(s); await pause(page, 1500); await en.selectOption(e); await pause(page, 1500); }
  if ((await en.inputValue()) !== e) { await en.selectOption(e); await pause(page, 1500); }
}

/** 変更を入れ、読み直して確かめる。戻り値 { saved, results:[{ no, date, name, after, ok, now }] } */
export async function applyChanges(page, changes, todayIso, log = () => {}) {
  if (!changes.length) return { saved: false, results: [] };
  const cur = await readCurrent(page);
  const weekOf = new Map(cur.people.flatMap((p) => p.cells.map((c) => [`${p.name}|${c.date}`, c.week])));
  for (const week of [0, 1]) {
    const todo = changes.filter((c) => weekOf.get(`${c.name}|${c.date}`) === week);
    if (!todo.length) continue;
    await open(page, week);
    for (const c of todo) { await setOne(page, c); log(`  入れました：${c.date} ${c.name} → ${c.after}`); }
  }
  const after = await readCurrent(page);
  const results = changes.map((c) => {
    const cell = (after.people.find((p) => p.name === c.name) || { cells: [] }).cells.find((x) => x.date === c.date);
    const ok = !!cell && (c.type === "rest" ? cell.off : c.want.work ? cell.work && cell.start === c.want.start && cell.end === c.want.end : !cell.work);
    return { no: c.no, date: c.date, name: c.name, after: c.after, ok, now: !cell ? "読めない" : cell.work ? `${cell.start}-${cell.end}` : cell.off ? "休み" : "未設定" };
  });
  return { saved: true, results };
}
