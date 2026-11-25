// 全国メンズエステランキング 店舗管理画面の出勤ページを操作する部分（Playwright）
// ページ：https://www.esthe-ranking.jp/shop/schedule/<YYYY-MM-DD>/ （1日1ページ、全員が tr[data-girl-id] で並ぶ）
//   名前：tr の2列目の span。開始 select[name="<ID>[start_work]"]、終了 [end_work]。未設定は値 "0"。
//   選択肢の値は "06:00"〜"23:30"、深夜は "00:00"〜"05:30"（表示は "03:00(27:00)"）。6時より前の値は翌日の時刻。
//   「出勤時間未定」 checkbox[name="<ID>[is_time_not_set]"]、出勤がある行だけ「出勤解除」 checkbox[name="<ID>[delete_flag]"]。
//   [保存する]（button）を押すまで保存されない。
// 守ること：隠し項目の値は読まない・記録しない／入力欄が見つからないときは推測で書かず止める／出勤以外は触らない
export const BASE = "https://www.esthe-ranking.jp/shop/schedule/";

const pause = (page, ms) => page.waitForTimeout(ms + Math.floor(Math.random() * 400));

/** "27:00" → 選択肢の値 "03:00"（24時以降は24を引く） */
export function toValue(v) {
  const m = String(v).match(/^(\d{2}):(\d{2})$/);
  if (!m) return "";
  const h = +m[1];
  return `${String(h >= 24 ? h - 24 : h).padStart(2, "0")}:${m[2]}`;
}
/** 選択肢の値 "03:00" → "27:00"（6時より前は翌日）。"0" や空は "" */
export function fromValue(v) {
  const m = String(v).match(/^(\d{2}):(\d{2})$/);
  if (!m) return "";
  const h = +m[1];
  return `${String(h < 6 ? h + 24 : h).padStart(2, "0")}:${m[2]}`;
}

export async function openDate(page, date) {
  await page.goto(`${BASE}${date}/`, { waitUntil: "domcontentloaded" });
  await pause(page, 1800);
  if (/\/login/.test(page.url())) throw new Error("全国メンズエステランキングにログインしていません。開いたブラウザでログインしてから、もう一度実行してください");
  const n = await page.locator("tr[data-girl-id] select[name$='[start_work]']").count();
  if (!n) throw new Error(`全国メンズエステランキングの出勤ページ（${date}）の形が想定と違います。書き込まずに止めました`);
}

async function readDate(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("tr[data-girl-id]")].map((tr) => {
      const id = tr.getAttribute("data-girl-id");
      const s = tr.querySelector(`select[name="${id}[start_work]"]`);
      const e = tr.querySelector(`select[name="${id}[end_work]"]`);
      const nt = tr.querySelector(`input[type=checkbox][name="${id}[is_time_not_set]"]`);
      const nameEl = tr.children[1] && tr.children[1].querySelector("span");
      return { id, name: nameEl ? nameEl.textContent.trim() : "", start: s ? s.value : null, end: e ? e.value : null, notSet: !!(nt && nt.checked) };
    })
  );
}

/** 今の出勤を読む（読むだけ。1日1ページを順に開く） */
export async function readCurrent(page, dates) {
  const people = new Map();
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    await openDate(page, date);
    for (const r of await readDate(page)) {
      if (!r.id || r.start == null || r.end == null) throw new Error(`出勤表（${date}）を読み取れませんでした。書き込まずに止めました`);
      if (!people.has(r.id)) people.set(r.id, { id: r.id, name: r.name, cells: [] });
      const st = fromValue(r.start), en = fromValue(r.end);
      const work = r.notSet || !!st;
      people.get(r.id).cells.push({ idx: i, date, work, start: work ? (r.notSet ? "時間未定" : st) : "", end: work ? (r.notSet ? "" : en) : "" });
    }
  }
  const list = [...people.values()];
  if (!list.length || list.some((p) => p.cells.length !== dates.length)) throw new Error("出勤表の人数が日によって違います（途中で登録が変わった可能性）。書き込まずに止めました");
  return { dates, people: list };
}

/** 変更を日付ごとに入力・保存し、読み直して確かめる */
export async function applyChanges(page, changes, log = () => {}) {
  const byDate = new Map();
  for (const c of changes) { if (!byDate.has(c.date)) byDate.set(c.date, []); byDate.get(c.date).push(c); }
  const results = [];
  for (const [date, list] of [...byDate.entries()].sort()) {
    await openDate(page, date);
    for (const c of list) {
      const s = page.locator(`select[name="${c.id}[start_work]"]`);
      const e = page.locator(`select[name="${c.id}[end_work]"]`);
      const nt = page.locator(`input[type=checkbox][name="${c.id}[is_time_not_set]"]`);
      const del = page.locator(`input[type=checkbox][name="${c.id}[delete_flag]"]`);
      if ((await s.count()) !== 1 || (await e.count()) !== 1) throw new Error(`入力欄が見つかりません（${date} ${c.name}）。保存せずに止めました`);
      if (c.want.work) {
        const sv = toValue(c.want.start), ev = toValue(c.want.end);
        const opts = await s.evaluate((el) => [...el.options].map((o) => o.value));
        const opte = await e.evaluate((el) => [...el.options].map((o) => o.value));
        if (!opts.includes(sv) || !opte.includes(ev)) throw new Error(`選べない時間です（${date} ${c.name} ${c.want.start}-${c.want.end}）。保存せずに止めました`);
        if ((await nt.count()) === 1 && (await nt.isChecked())) await nt.uncheck();
        if ((await del.count()) === 1 && (await del.isChecked())) await del.uncheck();
        await s.selectOption(sv); await pause(page, 300);
        await e.selectOption(ev); await pause(page, 300);
      } else {
        if ((await del.count()) !== 1) throw new Error(`「出勤解除」が見つかりません（${date} ${c.name}）。保存せずに止めました`);
        await del.check(); await pause(page, 300);
      }
      log(`入力：${date} ${c.name} ${c.before} → ${c.after}`);
    }
    const btn = page.locator("form[action*='/shop/schedule/'] button", { hasText: "保存する" }).first();
    if ((await btn.count()) !== 1) throw new Error(`保存ボタンが見つかりません（${date}）。保存せずに止めました`);
    log(`${date} を保存します`);
    await Promise.all([page.waitForLoadState("domcontentloaded"), btn.click()]);
    await pause(page, 2500);
    await openDate(page, date);
    const now = await readDate(page);
    for (const c of list) {
      const r = now.find((x) => x.id === c.id);
      const st = r ? fromValue(r.start) : "", en = r ? fromValue(r.end) : "";
      const work = !!r && (r.notSet || !!st);
      const ok = !!r && work === c.want.work && (!c.want.work || (st === c.want.start && en === c.want.end && !r.notSet));
      results.push({ no: c.no, date, name: c.name, after: c.after, ok, now: !r ? "読めない" : work ? (r.notSet ? "時間未定" : `${st}-${en}`) : "出勤なし" });
    }
    await pause(page, 1500);
  }
  return { saved: true, results };
}
