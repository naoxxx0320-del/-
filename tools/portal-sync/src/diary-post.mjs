#!/usr/bin/env node
// 写メ日記：02（ゼロツー）の本人の公開投稿を、駅ちかの写メ日記に転載する
//   node src/diary-post.mjs plan        … 転載する予定の日記を表示するだけ
//   node src/diary-post.mjs run [--max n] … 新しい日記を転載する（1回の実行で最大 n 件、既定 3）
// 了承：02 運営（オーナーが電話で確認）・セラピスト全員（2026-11-26）。写真は本人の投稿どおり（オーナー判断）。
// しくみ：02 の公開の一覧（scripts/fetch-diary.mjs と同じ）→ 在籍表で照合 → 駅ちかの「女の子」（表示名）を選んで投稿。
//   写真は 02 の配信元から作業用ブラウザで読み、JPEG に変えて添付（02 の画像は WebP で、ブラウザ以外からは取得できないため）。
//   最初の実行では、6時間より前の日記は「転載しない」印を付ける（古い日記をまとめて流さないため）。
// 記録：out/diary-post-state.json（転載した 02 の投稿番号）、out/diary-post-log.txt
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSource } from "./source.mjs";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(HERE, "..", "..");
const OUT = join(HERE, "out");
const STATE = join(OUT, "diary-post-state.json");
const FIRST_RUN_HOURS = 6;
const log = (s) => { console.log(s); mkdirSync(OUT, { recursive: true, mode: 0o700 }); appendFileSync(join(OUT, "diary-post-log.txt"), `${new Date().toISOString()} ${s}\n`); };
const readJSON = (p, fb) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fb; } };
const strip = (s) => String(s || "").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/[ \t]+\n/g, "\n").trim();
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toHtml = (text) => text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br />")}</p>`).join("\n");
const atMs = (at) => Date.parse(String(at).replace(" ", "T") + ":00+09:00");

/** 日記のタイトル：本文の最初の行（絵文字を外し、50文字まで）。空なら「写メ日記」 */
export function diaryTitle(text) {
  const first = strip(text).split("\n").map((l) => l.trim()).find(Boolean) || "写メ日記";
  return [...first].length > 50 ? [...first].slice(0, 49).join("") + "…" : first;
}

async function fetchDiary(roster) {
  const { buildDiary } = await import(join(REPO, "scripts", "fetch-diary.mjs"));
  const conf = readJSON(join(REPO, "data", "diary-config.json"), {});
  if (!conf.shopId) throw new Error("data/diary-config.json の shopId が未設定です");
  const res = await fetch(`https://m-sns.net/api/shop-timeline.php?shop_id=${encodeURIComponent(conf.shopId)}&limit=50`, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`02 から取得できませんでした（HTTP ${res.status}）`);
  const { posts } = buildDiary(await res.json(), roster, { accounts: conf.accounts || {} });
  const list = [];
  for (const [name, arr] of Object.entries(posts)) {
    const disp = (roster.find((r) => r.name === name) || {}).nameFull || name;
    for (const p of arr) list.push({ ...p, name, disp });
  }
  return list.sort((a, b) => (a.at < b.at ? -1 : 1)); // 古い順に転載
}

/** 02 の画像を作業用ブラウザの別のタブで直接開き（同じ配信元のページとして扱われる）、JPEG のバイト列にする */
async function imageAsJpeg(page, url) {
  const tab = await page.context().newPage();
  try {
    const res = await tab.goto(url, { waitUntil: "load", timeout: 30000 });
    if (!res || !res.ok()) return null;
    const b64 = await tab.evaluate(async () => {
      const img = document.querySelector("img");
      if (!img) return null;
      if (!img.complete) await new Promise((ok) => { img.onload = ok; img.onerror = ok; });
      if (!img.naturalWidth) return null;
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      return c.toDataURL("image/jpeg", 0.9).split(",")[1];
    });
    return b64 ? Buffer.from(b64, "base64") : null;
  } catch { return null; } finally { await tab.close().catch(() => {}); }
}

async function postEkichika(page, d) {
  await page.goto("https://ranking-deli.jp/admin/maildiary/edit/", { waitUntil: "load" });
  await page.waitForTimeout(2000 + Math.random() * 500);
  if (/login/.test(page.url())) throw new Error("駅ちかにログインしていません");
  const form = page.locator("form#md_edit_form");
  if ((await form.count()) !== 1) throw new Error("写メ日記の入力欄が見つかりません");
  // 女の子を選ぶ（表示名）
  const girl = form.locator("li.select_girls").filter({ has: page.locator(".girl-name", { hasText: new RegExp(`^${d.disp}$`) }) });
  if ((await girl.count()) !== 1) throw new Error(`駅ちかに「${d.disp}」が見つかりません`);
  await form.locator(".girls_name_btn").click(); await page.waitForTimeout(800);
  await girl.click(); await page.waitForTimeout(800);
  const gid = await form.locator("input#girls_id").inputValue();
  if (!gid) throw new Error(`「${d.disp}」を選べませんでした`);
  // 写真（あれば1枚目）
  if (d.images[0]) {
    const buf = await imageAsJpeg(page, d.images[0]);
    if (!buf) throw new Error("02 の写真を読めませんでした");
    await form.locator("input#md_img_upload").setInputFiles({ name: `diary-${d.id}.jpg`, mimeType: "image/jpeg", buffer: buf });
    await page.waitForTimeout(3000);
  }
  await form.locator("input[name=title]").fill(diaryTitle(d.text));
  const ok = await page.evaluate((html) => {
    const C = window.CKEDITOR; const inst = C && (C.instances.ckeditor2 || Object.values(C.instances).find((i) => i.element && i.element.$ && i.element.$.name === "body"));
    if (!inst) return false; inst.setData(html); inst.updateElement(); return true;
  }, toHtml(strip(d.text)));
  if (!ok) throw new Error("日記本文の入力欄（エディタ）が見つかりません");
  const show = form.locator("input[name=display_flg][value='1']");
  const lbl = show.locator("xpath=ancestor::label[1]");
  if (await lbl.count()) await lbl.click(); else await show.check({ force: true });
  if (!(await show.isChecked())) throw new Error("「表示」を選べません");
  await page.waitForTimeout(600);
  const seen = [];
  const onDialog = async (x) => { seen.push(x.message()); try { if (/投稿|更新|登録|よろしい/.test(x.message())) await x.accept(); else await x.dismiss(); } catch {} };
  page.on("dialog", onDialog);
  try {
    const btn = form.locator("button[name=maildiary_submit]");
    if ((await btn.count()) !== 1) throw new Error("「写メ日記を更新する」が見つかりません");
    await Promise.all([page.waitForLoadState("domcontentloaded"), btn.click()]);
    await page.waitForTimeout(3000);
  } finally { page.off("dialog", onDialog); }
  // 一覧で確かめる
  await page.goto("https://ranking-deli.jp/admin/maildiary/", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1800);
  const t = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, "");
  return { ok: t.includes(diaryTitle(d.text).replace(/\s+/g, "").slice(0, 15)), dialogs: seen };
}

async function main() {
  const cmd = process.argv[2] || "plan";
  const max = Number(process.argv[process.argv.indexOf("--max") + 1]) || 3;
  const config = JSON.parse(readFileSync(join(HERE, "config.local.json"), "utf8"));
  const state = readJSON(STATE, {});
  state.ekichika ||= { posted: [], skipped: [] };
  const { roster } = await loadSource(config);
  const all = await fetchDiary(roster);
  if (!state.initialized) {
    const cut = Date.now() - FIRST_RUN_HOURS * 3600e3;
    state.ekichika.skipped = all.filter((d) => atMs(d.at) < cut).map((d) => d.id);
    state.initialized = true;
  }
  const done = new Set([...state.ekichika.posted, ...state.ekichika.skipped]);
  const todo = all.filter((d) => !done.has(d.id));
  if (cmd === "plan") {
    console.log(`駅ちか 写メ日記：転載予定 ${todo.length}件`);
    for (const d of todo) console.log(`  ${d.at} ${d.disp}：${diaryTitle(d.text)}（写真 ${d.images.length}枚）`);
    mkdirSync(OUT, { recursive: true, mode: 0o700 }); writeFileSync(STATE, JSON.stringify(state, null, 1));
    return;
  }
  if (cmd !== "run") throw new Error("使い方：node src/diary-post.mjs plan | run [--max n]");
  const { chromium } = await import("playwright");
  const b = await chromium.connectOverCDP(config.browserCdpUrl || "http://127.0.0.1:9333", { timeout: 5000 }).catch(() => null);
  if (!b) throw new Error("作業用ブラウザが開いていません（node src/browser.mjs で開いてください）");
  const page = await b.contexts()[0].newPage();
  try {
    for (const d of todo.slice(0, max)) {
      try {
        const r = await postEkichika(page, d);
        if (r.ok) { state.ekichika.posted.push(d.id); log(`駅ちか 写メ日記：転載し、一覧で確認しました：${d.disp}「${diaryTitle(d.text)}」`); }
        else log(`駅ちか 写メ日記：操作はしましたが一覧で確認できません（次の回で確かめます）：${d.disp}「${diaryTitle(d.text)}」${r.dialogs.length ? "［" + r.dialogs.join(" / ") + "］" : ""}`);
      } catch (e) { log(`駅ちか 写メ日記：止まりました（${d.disp}：${e.message}）`); break; }
      mkdirSync(OUT, { recursive: true, mode: 0o700 }); writeFileSync(STATE, JSON.stringify(state, null, 1));
    }
  } finally {
    mkdirSync(OUT, { recursive: true, mode: 0o700 }); writeFileSync(STATE, JSON.stringify(state, null, 1));
    await page.close().catch(() => {}); await b.close().catch(() => {});
  }
}
main().catch((e) => { log("写メ日記の転載：止まりました：" + e.message); process.exitCode = 1; });
