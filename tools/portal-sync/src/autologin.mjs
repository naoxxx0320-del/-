#!/usr/bin/env node
// ログインが切れていたら、Mac のキーチェーンに保存した ID・パスワードで自動でログインし直す（駅ちか・全国メンズエステランキング）。
// ID・パスワードはキーチェーンからその場で読み、ログイン画面に入れるだけ（表示・記録・ファイル保存はしない）。
// キーチェーンへの保存はオーナーが一度だけ行う（ターミナルで。パスワードは画面に表示されない）：
//   security add-generic-password -U -s portal-sync-ekichika -a <駅ちかのログインID> -w
//   security add-generic-password -U -s portal-sync-esthe-ranking -a <全国メンズエステランキングのログインID> -w
//   node src/autologin.mjs [--site ekichika|esthe-ranking]   … ログインを確かめ、切れていればログインし直す
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(HERE, "out");
const log = (s) => { console.log(s); mkdirSync(OUT, { recursive: true, mode: 0o700 }); appendFileSync(join(OUT, "autologin-log.txt"), `${new Date().toISOString()} ${s}\n`); };

export const LOGIN = {
  ekichika: {
    name: "駅ちか", check: "https://ranking-deli.jp/admin/", login: "https://ranking-deli.jp/admin/login",
    id: "input[name=email]", pw: "input[name=password]", submit: "input[type=submit][name=submit]",
    isOut: (url) => /\/admin\/login/.test(url),
  },
  "esthe-ranking": {
    name: "全国メンズエステランキング", check: "https://www.esthe-ranking.jp/shop/news/", login: "https://www.esthe-ranking.jp/login/",
    id: "form[action='/login/'] input[name=loginname]", pw: "form[action='/login/'] input[name=password]", submit: "form[action='/login/'] button",
    isOut: (url) => /\/login/.test(url),
  },
};

/** キーチェーン（「ログイン」）から ID とパスワードを読む。読めないときは理由（why）を返す（ID・パスワードは含めない） */
function fromKeychain(site) {
  const svc = `portal-sync-${site}`;
  const meta = spawnSync("/usr/bin/security", ["find-generic-password", "-s", svc], { encoding: "utf8" });
  if (meta.status !== 0) {
    return { why: meta.status === 44
      ? `キーチェーン「ログイン」に「${svc}」という項目が見つかりません（名前の違い、または「iCloud」に保存された可能性）`
      : `キーチェーンを開けませんでした（${meta.status}：${(meta.stderr || "").trim().slice(0, 80)}）` };
  }
  const acct = (meta.stdout.match(/"acct"<blob>="([^"]*)"/) || [])[1];
  if (!acct) return { why: `「${svc}」にアカウント名（ログインID）が入っていません` };
  const pw = spawnSync("/usr/bin/security", ["find-generic-password", "-s", svc, "-w"], { encoding: "utf8" });
  if (pw.status !== 0) return { why: `「${svc}」のパスワードを読めませんでした（アクセスが許可されていない可能性：${pw.status}）` };
  return { id: acct, pw: pw.stdout.replace(/\n$/, "") };
}

/** ログインを確かめ、切れていればログインし直す。結果を文字で返す（ID・パスワードは含めない） */
export async function ensureLogin(page, site) {
  const s = LOGIN[site];
  await page.goto(s.check, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2000);
  if (!s.isOut(page.url())) return { ok: true, msg: `${s.name}：ログイン中` };
  const cred = fromKeychain(site);
  if (cred.why) return { ok: false, msg: `${s.name}：ログインが切れています。自動でログインできません：${cred.why}` };
  await page.goto(s.login, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1500);
  const id = page.locator(s.id).first(), pw = page.locator(s.pw).first();
  if (!(await id.count()) || !(await pw.count())) return { ok: false, msg: `${s.name}：ログイン画面の形が想定と違います` };
  await id.fill(cred.id); await page.waitForTimeout(300);
  await pw.fill(cred.pw); await page.waitForTimeout(300);
  const btn = page.locator(s.submit).first();
  await Promise.all([page.waitForLoadState("domcontentloaded").catch(() => {}), btn.click()]);
  await page.waitForTimeout(3500);
  await page.goto(s.check, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2000);
  return s.isOut(page.url())
    ? { ok: false, msg: `${s.name}：自動ログインできませんでした（ID・パスワードが変わった、または追加の確認が必要になった可能性）` }
    : { ok: true, msg: `${s.name}：ログインが切れていたため、自動でログインし直しました` };
}

async function main() {
  const i = process.argv.indexOf("--site");
  const sites = i > 0 ? [process.argv[i + 1]] : Object.keys(LOGIN);
  const config = JSON.parse(readFileSync(join(HERE, "config.local.json"), "utf8"));
  const { chromium } = await import("playwright");
  const b = await chromium.connectOverCDP(config.browserCdpUrl || "http://127.0.0.1:9333", { timeout: 5000 }).catch(() => null);
  if (!b) throw new Error("作業用ブラウザが開いていません");
  const page = await b.contexts()[0].newPage();
  page.on("dialog", (d) => d.dismiss().catch(() => {}));
  let bad = 0;
  try {
    for (const site of sites) {
      if (!LOGIN[site]) throw new Error(`使えるサイト：${Object.keys(LOGIN).join(" / ")}`);
      const r = await ensureLogin(page, site).catch((e) => ({ ok: false, msg: `${LOGIN[site].name}：${e.message}` }));
      log(r.msg); if (!r.ok) bad++;
    }
  } finally { await page.close().catch(() => {}); await b.close().catch(() => {}); }
  if (bad) process.exitCode = 1;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { log("自動ログイン：止まりました：" + e.message); process.exitCode = 1; });
