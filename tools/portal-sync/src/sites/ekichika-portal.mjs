// 駅ちか 店舗管理画面の出勤ページを操作する部分（Playwright）
// ページ：https://ranking-deli.jp/admin/girlswork/
//   form[action*="girlswork/"] の中に、セラピストごとの ul.girls_schedule（名前は span.girls_name）。
//   日ごと（0〜6）に select[name="girl_work[ID][日][start_time]"] / [end_time]（値は "00:00"〜"29:30"）と
//   チェックボックス [work_flg]（出勤）。保存は input.js-one_submit（ページ全体で1回）。
// 守ること：
//   ・ページの隠し項目（ログイン情報が入っているものがある）は読まない・記録しない
//   ・入力欄が見つからない・形が違うときは推測で書かず、止めて報告する
//   ・「上位表示」など、出勤以外のボタンは押さない
export const URL_SCHEDULE = "https://ranking-deli.jp/admin/girlswork/";

const pause = (page, ms) => page.waitForTimeout(ms + Math.floor(Math.random() * 400)); // 人の操作に近い間隔

/** ログインしているか（ログイン画面に飛ばされていないか） */
export async function openSchedule(page) {
  await page.goto(URL_SCHEDULE, { waitUntil: "domcontentloaded" });
  await pause(page, 1500);
  const ok = await page.locator("form[action*='girlswork/'] ul.girls_schedule").count();
  if (!ok) {
    if (/login/i.test(page.url())) throw new Error("駅ちかにログインしていません。開いたブラウザでログインしてから、もう一度実行してください");
    throw new Error("駅ちかの出勤ページの形が想定と違います（画面が変わった可能性）。書き込まずに止めました");
  }
}

/** "11/25" → "2026-11-25"（今日に近い年を選ぶ） */
export function labelToIso(label, todayIso) {
  const m = String(label).match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const y0 = +todayIso.slice(0, 4);
  const cands = [y0 - 1, y0, y0 + 1].map((y) => `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`);
  const t = Date.parse(todayIso);
  return cands.sort((a, b) => Math.abs(Date.parse(a) - t) - Math.abs(Date.parse(b) - t))[0];
}

/** 今の出勤を読む（読むだけ） */
export async function readCurrent(page, todayIso) {
  const raw = await page.evaluate(() => {
    const form = document.querySelector("form[action*='girlswork/']");
    return [...form.querySelectorAll("ul.girls_schedule")].map((ul) => {
      const name = (ul.querySelector(".girls_name") || {}).textContent || "";
      const any = ul.querySelector("select[name^='girl_work']");
      const id = any ? any.name.match(/girl_work\[(\d+)\]/)[1] : "";
      const cells = [];
      for (let d = 0; d < 7; d++) {
        const s = ul.querySelector(`select[name="girl_work[${id}][${d}][start_time]"]`);
        const e = ul.querySelector(`select[name="girl_work[${id}][${d}][end_time]"]`);
        const w = ul.querySelector(`input[name="girl_work[${id}][${d}][work_flg]"]`);
        if (!s || !e || !w) continue;
        const og = s.querySelector("optgroup");
        cells.push({ idx: d, label: og ? og.label : "", work: w.checked, start: s.value, end: e.value });
      }
      return { id, name: name.trim(), cells };
    });
  });
  const people = raw.map((p) => ({
    ...p,
    cells: p.cells.map((c) => ({ idx: c.idx, date: labelToIso(c.label, todayIso), work: c.work, start: c.work ? c.start : "", end: c.work ? c.end : "" })),
  }));
  const dates = people.length ? people[0].cells.map((c) => c.date) : [];
  if (!people.length || people.some((p) => !p.id || p.cells.length !== 7 || p.cells.some((c) => !c.date))) {
    throw new Error("駅ちかの出勤表を読み取れませんでした（画面の形が想定と違います）。書き込まずに止めました");
  }
  return { dates, people };
}

/**
 * 変更を入力して保存する。changes は diffShifts の要素（実行するものだけ）。
 * 保存のあと読み直して、入れた内容になっているかを確かめ、結果を返す。
 */
export async function applyChanges(page, changes, todayIso, log = () => {}) {
  if (!changes.length) return { saved: false, results: [] };
  for (const c of changes) {
    const base = `girl_work[${c.id}][${c.idx}]`;
    const s = page.locator(`select[name="${base}[start_time]"]`);
    const e = page.locator(`select[name="${base}[end_time]"]`);
    const w = page.locator(`input[name="${base}[work_flg]"]`);
    if ((await s.count()) !== 1 || (await e.count()) !== 1 || (await w.count()) !== 1) {
      throw new Error(`入力欄が見つかりません（${c.date} ${c.name}）。保存せずに止めました`);
    }
    if (c.want.work) {
      const opts = await s.evaluate((el) => [...el.options].map((o) => o.value));
      const opte = await e.evaluate((el) => [...el.options].map((o) => o.value));
      if (!opts.includes(c.want.start) || !opte.includes(c.want.end)) throw new Error(`駅ちかで選べない時間です（${c.date} ${c.name} ${c.want.start}-${c.want.end}）。保存せずに止めました`);
      await s.selectOption(c.want.start); await pause(page, 300);
      await e.selectOption(c.want.end); await pause(page, 300);
      if (!(await w.isChecked())) await w.check();
    } else {
      if (await w.isChecked()) await w.uncheck();
    }
    log(`入力：${c.date} ${c.name} ${c.after}`);
    await pause(page, 500);
  }
  const btn = page.locator("form[action*='girlswork/'] input.js-one_submit").first();
  if ((await btn.count()) !== 1) throw new Error("保存ボタンが見つかりません。保存せずに止めました");
  log("保存ボタンを押します");
  await Promise.all([page.waitForLoadState("domcontentloaded"), btn.click()]);
  await pause(page, 2500);
  await openSchedule(page); // 読み直し
  const after = await readCurrent(page, todayIso);
  const results = changes.map((c) => {
    const p = after.people.find((x) => x.id === c.id);
    const cell = p && p.cells.find((x) => x.idx === c.idx);
    const ok = !!cell && cell.work === c.want.work && (!c.want.work || (cell.start === c.want.start && cell.end === c.want.end));
    return { no: c.no, date: c.date, name: c.name, after: c.after, ok, now: cell ? (cell.work ? `${cell.start}-${cell.end}` : "出勤なし") : "読めない" };
  });
  return { saved: true, results };
}
