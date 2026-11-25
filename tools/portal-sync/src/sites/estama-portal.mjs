// エステ魂 店舗管理画面の出勤を操作する部分（Playwright）
// 一覧：https://estama.jp/admin/schedule/list/ （セラピストごとのリンク /admin/schedule/<ID>/）
// 個別：select[name="column[YYYY-MM-DD][select][select_start]"] / [select_end]、checkbox[name="column[YYYY-MM-DD][work_status]"]（お休み）
// 保存：#SendWorkSchedule → /admin/schedule/post_work_schedule/ に送信（応答の先頭が "OK" なら成功）。
//   ロボット判定（reCAPTCHA）の画面が出た場合は、突破せずに止めて利用者に知らせる。
// 守ること：隠し項目の値は読まない／入力欄が見つからないときは推測で書かず止める／「上位表示」などには触らない
import { toValue, fromValue } from "./estama.mjs";

const pause = (page, ms) => page.waitForTimeout(ms + Math.floor(Math.random() * 400));

async function guardLogin(page) {
  if (/\/login/.test(page.url())) throw new Error("エステ魂にログインしていません。作業用ブラウザでログインしてから、もう一度実行してください");
}

async function listCasts(page) {
  await page.goto("https://estama.jp/admin/schedule/list/", { waitUntil: "domcontentloaded" });
  await pause(page, 1800);
  await guardLogin(page);
  const casts = await page.evaluate(() => {
    const seen = new Map();
    for (const a of document.querySelectorAll("a[href*='/admin/schedule/']")) {
      const m = a.getAttribute("href").match(/\/admin\/schedule\/(\d+)\/?$/);
      if (!m || seen.has(m[1])) continue;
      const name = (a.textContent || "").replace(/\s+/g, " ").trim().split(" ")[0];
      seen.set(m[1], name);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  });
  if (!casts.length || casts.some((c) => !c.name)) throw new Error("エステ魂のセラピスト一覧を読めませんでした。書き込まずに止めました");
  return casts;
}

async function openCast(page, id) {
  await page.goto(`https://estama.jp/admin/schedule/${id}/`, { waitUntil: "domcontentloaded" });
  await pause(page, 1800);
  await guardLogin(page);
  if (!(await page.locator("select[name$='[select][select_start]']").count())) throw new Error("エステ魂の出勤ページの形が想定と違います。書き込まずに止めました");
}

async function readCast(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("select[name$='[select][select_start]']")].map((s) => {
      const date = s.name.match(/column\[([^\]]+)\]/)[1];
      const e = document.querySelector(`select[name="column[${date}][select][select_end]"]`);
      const off = document.querySelector(`input[name="column[${date}][work_status]"]`);
      return { date, start: s.value, end: e ? e.value : null, off: !!(off && off.checked) };
    })
  );
}

/** 今の出勤を読む（読むだけ。セラピストごとのページを順に開く） */
export async function readCurrent(page, dates) {
  const casts = await listCasts(page);
  const people = [];
  for (const c of casts) {
    await openCast(page, c.id);
    const rows = await readCast(page);
    const cells = dates.map((date, idx) => {
      const r = rows.find((x) => x.date === date);
      if (!r || r.end == null) return null;
      const st = fromValue(r.start), en = fromValue(r.end);
      const work = !!st && !r.off;
      return { idx, date, work, start: work ? st : "", end: work ? en : "" };
    });
    if (cells.some((x) => !x)) throw new Error(`エステ魂の出勤表（${c.name}）を読めませんでした（日付が足りません）。書き込まずに止めました`);
    people.push({ id: c.id, name: c.name, cells });
    await pause(page, 800);
  }
  return { dates, people };
}

/** 変更をセラピストごとに入力して保存し、読み直して確かめる */
export async function applyChanges(page, changes, log = () => {}) {
  const byCast = new Map();
  for (const c of changes) { if (!byCast.has(c.id)) byCast.set(c.id, []); byCast.get(c.id).push(c); }
  const results = [];
  for (const [id, list] of byCast) {
    await openCast(page, id);
    for (const c of list) {
      const base = `column[${c.date}]`;
      const s = page.locator(`select[name="${base}[select][select_start]"]`);
      const e = page.locator(`select[name="${base}[select][select_end]"]`);
      const off = page.locator(`input[name="${base}[work_status]"]`);
      if ((await s.count()) !== 1 || (await e.count()) !== 1) throw new Error(`入力欄が見つかりません（${c.date} ${c.name}）。保存せずに止めました`);
      if (c.want.work) {
        const sv = toValue(c.want.start), ev = toValue(c.want.end, { isEnd: true });
        const opts = await s.evaluate((el) => [...el.options].map((o) => o.value));
        const opte = await e.evaluate((el) => [...el.options].map((o) => o.value));
        if (!opts.includes(sv) || !opte.includes(ev)) throw new Error(`選べない時間です（${c.date} ${c.name} ${c.want.start}-${c.want.end}）。保存せずに止めました`);
        if ((await off.count()) === 1 && (await off.isChecked())) await off.uncheck({ force: true });
        await s.selectOption(sv); await pause(page, 300);
        await e.selectOption(ev); await pause(page, 300);
      } else {
        await s.selectOption(""); await pause(page, 300);
        await e.selectOption(""); await pause(page, 300);
      }
      log(`入力：${c.date} ${c.name} ${c.before} → ${c.after}`);
    }
    const btn = page.locator("#SendWorkSchedule");
    if ((await btn.count()) < 1) throw new Error(`保存ボタンが見つかりません（${list[0].name}）。保存せずに止めました`);
    log(`${list[0].name} の出勤を保存します`);
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/admin/schedule/post_work_schedule/"), { timeout: 20000 }).catch(() => null),
      btn.first().click(),
    ]);
    await pause(page, 1500);
    if (!res) {
      const captcha = await page.locator("#Recaptcha_schedule_box iframe, .iziModal-wrap #Recaptcha_schedule_box").count();
      throw new Error(captcha ? "ロボット判定（reCAPTCHA）の画面が出ました。突破はしません。作業用ブラウザで確認してください" : `保存の応答がありませんでした（${list[0].name}）。画面で確認してください`);
    }
    let body = ""; try { body = await res.text(); } catch {}
    if (!/^\s*\[\s*"OK"/.test(body)) throw new Error(`エステ魂が保存を受け付けませんでした（${list[0].name}）。画面で確認してください`);
    await openCast(page, id);
    const rows = await readCast(page);
    for (const c of list) {
      const r = rows.find((x) => x.date === c.date);
      const st = r ? fromValue(r.start) : "", en = r ? fromValue(r.end) : "";
      const work = !!r && !!st && !r.off;
      const ok = !!r && work === c.want.work && (!c.want.work || (st === c.want.start && en === c.want.end));
      results.push({ no: c.no, date: c.date, name: c.name, after: c.after, ok, now: !r ? "読めない" : work ? `${st}-${en}` : "出勤なし" });
    }
    await pause(page, 1500);
  }
  return { saved: true, results };
}
